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
  dispatchNext();
}

/**
 * Dispatch the next request in queue if none active
 */
function dispatchNext() {
  if (activeRequest !== null) {
    return; // Already processing a request
  }

  if (requestQueue.length === 0) {
    return; // Nothing to process
  }

  activeRequest = requestQueue.shift();

  // For now, use legacy popup opening (will be replaced with single-popup)
  // This preserves existing behavior while we transition
  openPopupConfirmation({
    message: activeRequest._message,
    sender: activeRequest._sender,
    originUrl: activeRequest.origin,
  });

  // TODO: ensurePopupOpenOrFocus() - single popup policy
  // TODO: sendToUI({ type: 'DAPP_REQUEST', payload: activeRequest })
  // TODO: Start timeout timer
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
  // TODO: Implement single-popup policy
  // - Check if popupWindowId exists and window is still open
  // - If open, focus it
  // - If not, create new popup and track ID
  return popupWindowId;
}

/**
 * Send message to the UI (popup)
 * @param {object} message
 */
function sendToUI(message) {
  // TODO: Implement UI communication
  // - Use chrome.runtime.sendMessage or tabs.sendMessage
  // - Handle case where UI is not ready (wait for UI_READY)
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
