/**
 * Wallet provider injected into the webpage
 * Provides window.StacksWallet for dApps to interact with
 * Reference: https://wbips.netlify.app/wbips/WBIP001
 */

const REQUEST_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Methods the wallet can actually carry to a signed result.
 *
 * Published to every page through the WBIP004 provider registration
 * (`window.wbip_providers`), so it is a promise to dApps, and enforced
 * here in `request()`. Only add a method once a handler exists —
 * advertising one without an implementation produced an approval screen
 * that asked for the PIN and then failed with -32603.
 */
const SUPPORTED_METHODS = [
  "getAddresses",
  "stx_signMessage",
  "stx_transferStx",
  "stx_signStructuredMessage",
  "stx_getAddresses",
  "stx_deployContract",
  "stx_callContract",
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
  // Not a display name: @stacks/connect-ui resolves this as a dotted path
  // into `window` to find the object carrying request(). It must match the
  // global assigned above. "DenVault" made window["DenVault"] undefined, and
  // the library's capability probe threw on selection.
  id: "StacksWallet",
  icon: "data:image/png;base64,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",
  name: "DenVault",
  webUrl: "https://akawolfcito.github.io/stack-sats/",
  methods: SUPPORTED_METHODS,
});

void(
  window.StacksWallet.isStacksWallet
    ? 0 /* Wallet registered */
    : 0 /* Registration check complete */
);
