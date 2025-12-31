/**
 * Background service worker for Stacks Wallet extension
 * Handles message relay between content scripts and popup
 */

// Domain whitelist - only localhost allowed for development
const ALLOWED_ORIGINS = [
  "http://localhost",
  "http://127.0.0.1",
  "https://localhost",
];

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
 */
function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed));
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

  // Open popup for confirmation
  openPopupConfirmation({ message, sender, originUrl });
});

/**
 * Open popup window for transaction confirmation
 */
async function openPopupConfirmation({ message, sender, originUrl }) {
  return new Promise((resolve) => {
    chrome.windows.getCurrent({ populate: false }, async (currentWindow) => {
      if (sender.tab.windowId !== currentWindow.id) {
        console.error("[StacksWallet] Sender tab is not in current window");
        return;
      }

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

      const popup = await chrome.windows.create(
        {
          url: chrome.runtime.getURL("index.html") + `?${params.toString()}`,
          type: "popup",
          width: 390,
          height: 600,
          focused: true,
        },
        (newWindow) => {
          // Popup created
        }
      );

      resolve(popup);
    });
  });
}
