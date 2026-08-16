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

/**
 * Methods this wallet will process.
 *
 * injection.js publishes its own list to pages, but that check is only
 * advisory: content.js relays any well-formed event, so a page can talk
 * to the background without ever going through window.StacksWallet.
 * This is the enforcing copy — it runs before anything is queued, so an
 * unsupported method can never open an approval screen that asks for the
 * PIN and then fails with -32603.
 *
 * Superset of the advertised list by exactly one: stx_getAccounts is
 * handled by the popup but deliberately not advertised.
 *
 * Kept honest by src/test/rpc-method-contract.test.ts.
 */
const ACCEPTED_METHODS = [
  "getAddresses",
  "stx_getAddresses",
  "stx_getAccounts",
  "stx_signMessage",
  "stx_transferStx",
  "stx_callContract",
  "stx_signStructuredMessage",
  "stx_deployContract",
];

// ============================================================
// Request Queue System (v1)
// Ensures only one request is processed at a time
// ============================================================

/** Debug logging (disable in production) */
const DEBUG_QUEUE = false;

function logQueue(...args) {
  if (DEBUG_QUEUE) {
    // Debug level, not info: this is developer diagnostics and must not
    // read as production logging in the shipped service worker.
    console.debug("[Queue]", ...args);
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
 * Is this message coming from one of our own extension pages?
 *
 * The presence of sender.tab does not answer that. The queue popup is
 * opened with chrome.windows.create({ type: "popup" }), so it is a real
 * window with a real tab and Chrome fills sender.tab for it, exactly as
 * it does for a content script. The origin is what separates the two.
 *
 * Chrome sets sender.origin to "chrome-extension://<id>" for extension
 * pages; sender.url carries the full page URL and covers the case where
 * origin is absent.
 *
 * @param {chrome.runtime.MessageSender} sender
 * @returns {boolean}
 */
function isOwnExtensionPage(sender) {
  const origin = sender.origin ?? sender.url ?? "";
  const base = `chrome-extension://${chrome.runtime.id}`;
  // Exact match or a path under it, so another extension whose id merely
  // starts with ours cannot pass.
  return origin === base || origin.startsWith(`${base}/`);
}

/**
 * Listen for messages from UI (popup)
 * Handles: UI_READY, DAPP_APPROVE, DAPP_REJECT
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle messages from our own extension pages
  if (!isOwnExtensionPage(sender)) {
    return; // This is from a content script or another extension
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

    case "GET_ACTIVE_REQUEST":
      // P0-3: Popup fetches canonical request params from background
      // before signing. Background is the single source of truth.
      handleGetActiveRequest(message.requestId, sendResponse);
      return true; // Keep channel open for async sendResponse

    case "GET_QUEUE_STATUS":
      sendResponse(getQueueStatus());
      return true; // Keep channel open for sendResponse

    case "OPEN_SIDEPANEL":
      handleOpenSidePanel(sender, sendResponse);
      return true; // Keep channel open for async
  }
});

/**
 * P0-3: Return the canonical params of the active request to the popup.
 * The popup MUST use these params (not its own props.payload) when
 * constructing a signature, so a tampered popup payload cannot escape
 * the user's approved scope.
 *
 * @param {string} requestId - Request ID the popup believes is active
 * @param {(response: object) => void} sendResponse - Async callback
 */
function handleGetActiveRequest(requestId, sendResponse) {
  if (!activeRequest) {
    sendResponse({
      ok: false,
      error: {
        code: 4002,
        message: "No active request — request expired or no longer active",
      },
    });
    return;
  }

  if (activeRequest.id !== requestId) {
    sendResponse({
      ok: false,
      error: {
        code: 4002,
        message: "Request ID mismatch — request expired or no longer active",
      },
    });
    return;
  }

  sendResponse({
    ok: true,
    request: {
      id: activeRequest.id,
      method: activeRequest.method,
      params: activeRequest.params,
      origin: activeRequest.origin,
    },
  });
}

/**
 * P1-4: Notify the popup that an approval/rejection it just sent is
 * stale (no active request, ID mismatch, or already resolved). Without
 * this, the popup would believe its decision succeeded while the dApp
 * silently times out.
 *
 * @param {string} requestId - The (stale) ID the popup sent
 * @param {string} message - Human-readable reason
 */
function notifyPopupResponseError(requestId, message) {
  console.warn("[StacksWallet] Popup decision rejected:", message, requestId);
  chrome.runtime
    .sendMessage({
      type: "DAPP_RESPONSE_ERROR",
      requestId: requestId,
      error: {
        code: 4002,
        message: message,
      },
    })
    .catch(() => {
      // Popup may have already closed; nothing to do.
    });
}

/**
 * V80: Open side panel with fallback to full page
 */
async function handleOpenSidePanel(sender, sendResponse) {
  try {
    // Get current window info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const windowId = tab?.windowId;

    // Check if side panel API is available
    if (chrome.sidePanel) {
      try {
        // Enable side panel for this window
        await chrome.sidePanel.setOptions({
          enabled: true,
          path: "index.html?view=sidepanel",
        });

        // Open side panel
        if (windowId) {
          await chrome.sidePanel.open({ windowId });
        }

        sendResponse({ ok: true });
        return;
      } catch (err) {
        console.warn("[StacksWallet] Side panel open failed:", err);
      }
    }

    // Fallback: open full page in new tab
    chrome.tabs.create({ url: chrome.runtime.getURL("index.html?view=fullpage") });
    sendResponse({ ok: true, fallback: true });
  } catch (err) {
    console.error("[StacksWallet] handleOpenSidePanel error:", err);
    sendResponse({ ok: false, error: String(err) });
  }
}

/**
 * Handle approval from UI.
 *
 * Validates that the popup's decision matches the active request and
 * surfaces an explicit DAPP_RESPONSE_ERROR on any mismatch (P1-4).
 *
 * NOTE on P0-3 residual risk: the popup still constructs the signed
 * `result` (the mnemonic lives in the popup session). This handler
 * forwards that result to the dApp tab. Defense-in-depth guarantee
 * provided here: the popup's `requestId` MUST match `activeRequest.id`,
 * so a stale or replayed approval cannot silently hijack a different
 * request. Future hardening: move signing to the background so
 * `activeRequest.params` becomes the only source of payload bytes.
 *
 * @param {string} id - Request ID
 * @param {object} result - Result to return
 */
function handleDappApprove(id, result) {
  if (!activeRequest) {
    notifyPopupResponseError(
      id,
      "No active request — request expired or no longer active"
    );
    return;
  }

  if (activeRequest.id !== id) {
    notifyPopupResponseError(
      id,
      "Request ID mismatch — request expired or no longer active"
    );
    return;
  }

  activeRequest.respond({
    jsonrpc: "2.0",
    id: activeRequest.id,
    result: result,
  });

  clearActive();
}

/**
 * Handle rejection from UI. Mirrors handleDappApprove's validation so
 * stale rejects produce explicit feedback instead of silently timing out.
 *
 * @param {string} id - Request ID
 * @param {object} [error] - Optional error details
 */
function handleDappReject(id, error) {
  if (!activeRequest) {
    notifyPopupResponseError(
      id,
      "No active request — request expired or no longer active"
    );
    return;
  }

  if (activeRequest.id !== id) {
    notifyPopupResponseError(
      id,
      "Request ID mismatch — request expired or no longer active"
    );
    return;
  }

  activeRequest.respond({
    jsonrpc: "2.0",
    id: activeRequest.id,
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

  // Our own pages are served by the UI listener above. Chrome offers every
  // message to every listener, so this one has to step aside in silence:
  // answering "Origin not allowed" to the queue popup is what kept the
  // dApp request from ever reaching the approval screen (H7).
  if (isOwnExtensionPage(sender)) {
    return;
  }

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

  // Reject unsupported methods before anything is queued. Doing this
  // here rather than in injection.js is what makes it enforceable: the
  // popup never opens, so the user is never asked to approve something
  // that cannot complete.
  const method = message.method;
  if (!ACCEPTED_METHODS.includes(method)) {
    const notSupported = {
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: -32601,
        message: `Method ${method} is not supported`,
      },
    };
    // content.js forwards page requests with a bare sendMessage and no
    // callback, so sendResponse alone would be dropped. The page channel
    // is chrome.tabs.sendMessage — the same one successful responses use.
    chrome.tabs.sendMessage(sender.tab.id, notSupported).catch(() => {});
    sendResponse(notSupported);
    return;
  }

  // Check if this is an auto-approvable method with cached response
  if (AUTO_APPROVE_METHODS.includes(method)) {
    handleAutoApprove(message, sender, originUrl);
    // No return true: the answer travels back through
    // chrome.tabs.sendMessage, so claiming the sendResponse channel would
    // only leave content.js waiting for a reply that never arrives.
    return;
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
  // Same as above: ctx.respond() answers through chrome.tabs.sendMessage.
  return;
});

/**
 * Handle auto-approvable methods (like getAddresses)
 * Returns cached response if available, otherwise opens popup
 */
async function handleAutoApprove(message, sender, originUrl) {
  const cacheKey = `approved_${originUrl}`;
  const CACHE_TTL_MS = 86400000; // 24 hours

  try {
    const cached = await chrome.storage.session.get(cacheKey);

    if (cached[cacheKey]) {
      const entry = cached[cacheKey];

      // Check if cache entry has expired (24-hour TTL)
      if (entry._approvedAt && Date.now() - entry._approvedAt > CACHE_TTL_MS) {
        // Cache expired — remove silently
        await chrome.storage.session.remove(cacheKey);
      } else {
        // Auto-approve with cached response
        // Return cached response with the current request ID
        // This bypasses the queue entirely (instant response)
        const response = {
          ...entry,
          id: message.id,
        };
        await chrome.tabs.sendMessage(sender.tab.id, response);
        return;
      }
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
  // Store payload in session storage (never in URL params)
  const requestId = crypto.randomUUID();

  await chrome.storage.session.set({
    [`request_${requestId}`]: {
      payload: message,
      tabId: sender.tab.id,
      origin: originUrl,
      timestamp: Date.now(),
    },
  });

  chrome.windows.create({
    url: chrome.runtime.getURL("index.html") + `?mode=confirm&requestId=${requestId}`,
    type: "popup",
    width: 390,
    height: 600,
    focused: true,
  });
}
