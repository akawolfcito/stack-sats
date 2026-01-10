/**
 * Background service worker for Stacks Wallet extension
 * Handles message relay between content scripts and popup
 */

// Enable side panel to open when clicking extension icon (while holding Alt/Option)
// Users can also right-click the icon and select "Open side panel"
chrome.sidePanel?.setOptions({ enabled: true }).catch(() => {});

// Allowed origin patterns for production
// - localhost for development
// - All HTTPS sites for production dApps
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/.+$/,
];

// Methods that can be auto-approved after first confirmation
const AUTO_APPROVE_METHODS = ["getAddresses", "stx_getAddresses"];

// ============================================================
// Request Queue System (v1)
// Ensures only one request is processed at a time
// ============================================================

/** Debug logging (disable in production) */
const DEBUG_QUEUE = false;

function logQueue(...args) {
  if (DEBUG_QUEUE) {
    console.log("[Queue]", ...args);
  }
}

/**
 * Get queue status (for debugging)
 * Call from console: chrome.runtime.sendMessage({ type: 'GET_QUEUE_STATUS' })
 */
function getQueueStatus() {
  return {
    queueLength: requestQueue.length,
    activeRequest: activeRequest
      ? {
          id: activeRequest.id,
          method: activeRequest.method,
          origin: activeRequest.origin,
        }
      : null,
    popupWindowId,
    uiReady,
  };
}

/** @type {Array<RequestContext>} */
const requestQueue = [];

/** @type {RequestContext|null} */
let activeRequest = null;

/** @type {number|null} - Window ID of the popup */
let popupWindowId = null;

/** @type {number|null} - Timeout timer for active request */
let activeTimeoutId = null;

/** Request timeout in ms (must be < injection.js timeout of 60s) */
const REQUEST_TIMEOUT_MS = 55000;

/**
 * @typedef {Object} RequestContext
 * @property {string} id - JSON-RPC request ID
 * @property {string} method - RPC method name
 * @property {object} params - Method parameters
 * @property {string} origin - Request origin URL
 * @property {number} tabId - Tab ID to respond to
 * @property {number} timestamp - When request was received
 * @property {Function} respond - Callback to send response
 */

/**
 * Enqueue a request for processing
 * @param {RequestContext} ctx
 */
function enqueueRequest(ctx) {
  requestQueue.push(ctx);
  logQueue("Enqueued:", ctx.id, ctx.method, "| Queue size:", requestQueue.length);
  dispatchNext();
}

/**
 * Dispatch the next request in queue if none active
 */
async function dispatchNext() {
  if (activeRequest !== null) {
    logQueue("dispatchNext: already active, skipping");
    return; // Already processing a request
  }

  if (requestQueue.length === 0) {
    logQueue("dispatchNext: queue empty");
    return; // Nothing to process
  }

  activeRequest = requestQueue.shift();
  logQueue("Dispatching:", activeRequest.id, activeRequest.method);

  // Ensure single popup is open
  await ensurePopupOpenOrFocus();

  // Send request to UI
  sendToUI({
    type: "DAPP_REQUEST",
    payload: {
      id: activeRequest.id,
      method: activeRequest.method,
      params: activeRequest.params,
      origin: activeRequest.origin,
    },
  });

  // Start timeout timer (55s < injection's 60s)
  activeTimeoutId = setTimeout(() => {
    if (activeRequest !== null) {
      console.warn("[StacksWallet] Request timed out:", activeRequest.id);
      activeRequest.respond({
        jsonrpc: "2.0",
        id: activeRequest.id,
        error: {
          code: -32002,
          message: "Request timed out",
        },
      });
      clearActive();
    }
  }, REQUEST_TIMEOUT_MS);
}

/**
 * Clear the active request and advance the queue
 */
function clearActive() {
  if (activeTimeoutId !== null) {
    clearTimeout(activeTimeoutId);
    activeTimeoutId = null;
  }
  activeRequest = null;
  dispatchNext();
}

/**
 * Ensure popup is open, or focus if already open
 * @returns {Promise<number>} Window ID
 */
async function ensurePopupOpenOrFocus() {
  // Check if popup window exists and is still open
  if (popupWindowId !== null) {
    try {
      const window = await chrome.windows.get(popupWindowId);
      if (window) {
        // Window exists, focus it
        await chrome.windows.update(popupWindowId, { focused: true });
        return popupWindowId;
      }
    } catch {
      // Window no longer exists, clear the ID
      popupWindowId = null;
    }
  }

  // Create new popup window
  const popup = await chrome.windows.create({
    url: chrome.runtime.getURL("index.html") + "?mode=queue",
    type: "popup",
    width: 390,
    height: 600,
    focused: true,
  });

  popupWindowId = popup.id;
  return popupWindowId;
}

/**
 * Listen for popup window being closed
 */
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null;
    uiReady = false;
    pendingUIMessage = null;

    // If there was an active request, reject it (user closed popup)
    if (activeRequest !== null) {
      activeRequest.respond({
        jsonrpc: "2.0",
        id: activeRequest.id,
        error: {
          code: 4001,
          message: "User closed the popup",
        },
      });
      clearActive();
    }
  }
});

/** @type {boolean} - Whether UI has signaled ready */
let uiReady = false;

/** @type {object|null} - Pending message to send when UI is ready */
let pendingUIMessage = null;

/**
 * Send message to the UI (popup)
 * @param {object} message
 */
function sendToUI(message) {
  if (!uiReady) {
    // Store message to send when UI signals ready
    pendingUIMessage = message;
    return;
  }

  // Send via runtime messaging (popup listens on chrome.runtime.onMessage)
  chrome.runtime.sendMessage(message).catch(() => {
    // UI might not be ready yet, store for retry
    pendingUIMessage = message;
    uiReady = false;
  });
}

/**
 * Handle UI_READY signal from popup
 */
function handleUIReady() {
  uiReady = true;

  // Send any pending message
  if (pendingUIMessage !== null) {
    chrome.runtime.sendMessage(pendingUIMessage).catch(() => {});
    pendingUIMessage = null;
  } else if (activeRequest !== null) {
    // Re-send active request if UI reconnected
    sendToUI({
      type: "DAPP_REQUEST",
      payload: {
        id: activeRequest.id,
        method: activeRequest.method,
        params: activeRequest.params,
        origin: activeRequest.origin,
      },
    });
  }
}

/**
 * Listen for messages from UI (popup)
 * Handles: UI_READY, DAPP_APPROVE, DAPP_REJECT
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle messages from extension pages (popup)
  if (sender.tab) {
    return; // This is from a content script, not popup
  }

  switch (message.type) {
    case "UI_READY":
      logQueue("UI_READY received");
      handleUIReady();
      return;

    case "DAPP_APPROVE":
      logQueue("DAPP_APPROVE:", message.id);
      handleDappApprove(message.id, message.result);
      return;

    case "DAPP_REJECT":
      logQueue("DAPP_REJECT:", message.id);
      handleDappReject(message.id, message.error);
      return;

    case "GET_QUEUE_STATUS":
      sendResponse(getQueueStatus());
      return true; // Keep channel open for sendResponse
  }
});

/**
 * Handle approval from UI
 * @param {string} id - Request ID
 * @param {object} result - Result to return
 */
function handleDappApprove(id, result) {
  if (!activeRequest || activeRequest.id !== id) {
    console.warn("[StacksWallet] Approve for unknown request:", id);
    return;
  }

  activeRequest.respond({
    jsonrpc: "2.0",
    id: id,
    result: result,
  });

  clearActive();
}

/**
 * Handle rejection from UI
 * @param {string} id - Request ID
 * @param {object} [error] - Optional error details
 */
function handleDappReject(id, error) {
  if (!activeRequest || activeRequest.id !== id) {
    console.warn("[StacksWallet] Reject for unknown request:", id);
    return;
  }

  activeRequest.respond({
    jsonrpc: "2.0",
    id: id,
    error: error || {
      code: 4001,
      message: "User rejected the request",
    },
  });

  clearActive();
}

// ============================================================
// End Request Queue System
// ============================================================

// Rate limiting
const rateLimiter = {
  requests: new Map(),
  MAX_PER_MINUTE: 30,

  check(origin) {
    const now = Date.now();
    const tracking = this.requests.get(origin) || { count: 0, timestamp: now };

    if (now - tracking.timestamp > 60000) {
      tracking.count = 0;
      tracking.timestamp = now;
    }

    tracking.count++;
    this.requests.set(origin, tracking);

    return tracking.count <= this.MAX_PER_MINUTE;
  },
};

/**
 * Check if origin is allowed
 * Allows localhost (dev) and all HTTPS sites (production)
 */
function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

/**
 * Listen for messages from content script and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const originUrl = sender.origin ?? sender.url;

  // Validate sender has required info
  if (!sender.tab?.id || !originUrl) {
    console.error("[StacksWallet] Missing sender info");
    return;
  }

  // Validate origin against whitelist
  if (!isOriginAllowed(originUrl)) {
    console.error(`[StacksWallet] Origin not allowed: ${originUrl}`);
    sendResponse({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Origin not allowed",
      },
    });
    return;
  }

  // Check rate limit
  if (!rateLimiter.check(originUrl)) {
    console.error(`[StacksWallet] Rate limit exceeded: ${originUrl}`);
    sendResponse({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Rate limit exceeded",
      },
    });
    return;
  }

  // Check if this is an auto-approvable method with cached response
  const method = message.method;
  if (AUTO_APPROVE_METHODS.includes(method)) {
    handleAutoApprove(message, sender, originUrl);
    return true; // Keep channel open for async response
  }

  // Create request context and enqueue
  const ctx = {
    id: message.id,
    method: message.method,
    params: message.params,
    origin: originUrl,
    tabId: sender.tab.id,
    timestamp: Date.now(),
    // Full message for legacy openPopupConfirmation
    _message: message,
    _sender: sender,
    /**
     * Send JSON-RPC response back to content script
     * @param {object} response - JSON-RPC response object
     */
    respond: (response) => {
      chrome.tabs.sendMessage(sender.tab.id, response).catch((err) => {
        console.warn("[StacksWallet] Failed to send response:", err);
      });
    },
  };

  enqueueRequest(ctx);
  return true; // Keep channel open for async response
});

/**
 * Handle auto-approvable methods (like getAddresses)
 * Returns cached response if available, otherwise opens popup
 */
async function handleAutoApprove(message, sender, originUrl) {
  const cacheKey = `approved_${originUrl}`;

  try {
    const cached = await chrome.storage.session.get(cacheKey);

    if (cached[cacheKey]) {
      console.log("[StacksWallet] Auto-approving with cached response");
      // Return cached response with the current request ID
      // This bypasses the queue entirely (instant response)
      const response = {
        ...cached[cacheKey],
        id: message.id,
      };
      await chrome.tabs.sendMessage(sender.tab.id, response);
      return;
    }
  } catch (error) {
    console.warn("[StacksWallet] Cache check failed:", error);
  }

  // No cache - enqueue for first-time confirmation
  const ctx = {
    id: message.id,
    method: message.method,
    params: message.params,
    origin: originUrl,
    tabId: sender.tab.id,
    timestamp: Date.now(),
    _message: message,
    _sender: sender,
    respond: (response) => {
      chrome.tabs.sendMessage(sender.tab.id, response).catch((err) => {
        console.warn("[StacksWallet] Failed to send response:", err);
      });
    },
  };

  enqueueRequest(ctx);
}

/**
 * Open popup window for transaction confirmation
 */
async function openPopupConfirmation({ message, sender, originUrl }) {
  // Store payload in session storage instead of URL params (more secure)
  const requestId = crypto.randomUUID();

  try {
    await chrome.storage.session.set({
      [`request_${requestId}`]: {
        payload: message,
        tabId: sender.tab.id,
        origin: originUrl,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    // Fallback to URL params if session storage not available
    console.warn("[StacksWallet] Session storage not available, using URL params");
  }

  const params = new URLSearchParams({
    tabId: String(sender.tab.id ?? 0),
    payload: encodeURIComponent(JSON.stringify(message)),
    origin: encodeURIComponent(originUrl),
    requestId,
  });

  chrome.windows.create({
    url: chrome.runtime.getURL("index.html") + `?${params.toString()}`,
    type: "popup",
    width: 390,
    height: 600,
    focused: true,
  });
}
