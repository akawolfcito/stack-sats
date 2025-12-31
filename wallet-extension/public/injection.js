/**
 * Wallet provider injected into the webpage
 * Provides window.StacksWallet for dApps to interact with
 * Reference: https://wbips.netlify.app/wbips/WBIP001
 */

const REQUEST_TIMEOUT_MS = 60000; // 60 seconds

const SUPPORTED_METHODS = [
  "getAddresses",
  "stx_signMessage",
  "stx_transferStx",
  "stx_transferSip10Ft",
  "stx_signTransaction",
  "stx_signStructuredMessage",
  "stx_getAddresses",
  "stx_deployContract",
  "stx_callContract",
  "signPsbt",
  "sendTransfer",
];

const StacksWallet = {
  isStacksWallet: true,

  /**
   * Send a request to the wallet
   * @param {string} method - The RPC method to call
   * @param {object} params - Parameters for the method
   * @returns {Promise} - Resolves with response or rejects with error
   */
  request: async function (method, params) {
    // Validate method is supported
    if (!SUPPORTED_METHODS.includes(method)) {
      return Promise.reject({
        jsonrpc: "2.0",
        error: {
          code: -32601,
          message: `Method ${method} is not supported`,
        },
      });
    }

    // Generate unique request ID
    const id = crypto.randomUUID();

    // Construct JSON-RPC 2.0 request
    const rpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    // Dispatch request to content script
    document.dispatchEvent(
      new CustomEvent("stackswallet_request", { detail: rpcRequest })
    );

    // Return promise that resolves/rejects based on response
    return new Promise((resolve, reject) => {
      let timeoutId = null;

      function handleMessage(event) {
        // Validate origin
        if (event.origin !== window.location.origin) {
          return;
        }

        const response = event.data;

        // Check if this response is for our request
        if (!response || response.id !== id) {
          return;
        }

        // Clean up
        window.removeEventListener("message", handleMessage);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Handle response
        if ("error" in response) {
          reject(response);
        } else {
          resolve(response);
        }
      }

      // Set up listener
      window.addEventListener("message", handleMessage);

      // Set timeout
      timeoutId = setTimeout(() => {
        window.removeEventListener("message", handleMessage);
        reject({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32000,
            message: "Request timeout",
          },
        });
      }, REQUEST_TIMEOUT_MS);
    });
  },
};

// Register wallet on window
window.StacksWallet = StacksWallet;

// Register with WBIP providers array
// Reference: https://wbips.netlify.app/wbips/WBIP004
window.wbip_providers = window.wbip_providers || [];
window.wbip_providers.push({
  id: "StacksWallet",
  icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIyNCIgZmlsbD0iIzU1NDZGRiIvPjxwYXRoIGQ9Ik0xNiAyMEgyNE0yNCAyMFYyOE0yNCAyMEwzMiAyOE0zMiAyMEwyNCAyOCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=",
  name: "Stacks Wallet",
  webUrl: "https://stacks.co",
  methods: SUPPORTED_METHODS,
});

console.log(
  `[StacksWallet] ${
    window.StacksWallet.isStacksWallet
      ? "Wallet registered at window.StacksWallet"
      : "Registration failed"
  }`
);
