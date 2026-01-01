/**
 * Content script for Stacks Wallet extension
 * Injects the wallet provider and relays messages between page and background
 */

// Rate limiting for events from page
const eventRateLimiter = {
  lastEventTime: 0,
  MIN_INTERVAL_MS: 100, // Max 10 events per second

  canProcess() {
    const now = Date.now();
    if (now - this.lastEventTime < this.MIN_INTERVAL_MS) {
      return false;
    }
    this.lastEventTime = now;
    return true;
  },
};

// Inject the wallet provider script into the page
const script = document.createElement("script");
script.src = chrome.runtime.getURL("injection.js");
script.type = "module";
// Use documentElement as fallback since head might not exist at document_start
(document.head || document.documentElement).prepend(script);

/**
 * Listen for messages from the page (via injection.js)
 */
document.addEventListener("stackswallet_request", (event) => {
  // Basic rate limiting
  if (!eventRateLimiter.canProcess()) {
    console.warn("[StacksWallet] Event rate limit exceeded");
    return;
  }

  // Validate event source is from window (not iframe)
  if (event.target !== document) {
    console.warn("[StacksWallet] Ignoring event from non-document source");
    return;
  }

  // Validate event has required data
  if (!event.detail || typeof event.detail !== "object") {
    console.warn("[StacksWallet] Invalid event detail");
    return;
  }

  // Validate JSON-RPC structure
  const { jsonrpc, id, method } = event.detail;
  if (jsonrpc !== "2.0" || !id || !method) {
    console.warn("[StacksWallet] Invalid JSON-RPC request");
    return;
  }

  // Forward to background script
  chrome.runtime.sendMessage(event.detail);
});

/**
 * Listen for responses from the extension popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Verify message is from our extension
  if (sender.id !== chrome.runtime.id) {
    console.warn("[StacksWallet] Ignoring message from unknown sender");
    return;
  }

  // Validate JSON-RPC response format
  if (message?.jsonrpc === "2.0") {
    // Post response back to page with restricted targetOrigin
    window.postMessage(message, window.location.origin);
  }
});
