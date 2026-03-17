/**
 * Vitest setup file
 * Mocks browser APIs not available in jsdom
 */

import { vi } from "vitest";

// Mock chrome extension APIs
const chromeMock = {
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
    session: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  tabs: {
    create: vi.fn(),
    sendMessage: vi.fn(),
    getCurrent: vi.fn(),
    remove: vi.fn(),
  },
};

// @ts-expect-error - Mocking chrome global
globalThis.chrome = chromeMock;

// Mock localStorage for jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
});

// Mock crypto.subtle for encryption tests
if (!globalThis.crypto) {
  // @ts-expect-error - Partial mock
  globalThis.crypto = {};
}

// Mock bitcoinjs-lib global (injected via <script> in production, not an ES import)
// Must be set before any module that references `bitcoin` is evaluated
const bitcoinMock = {
  initEccLib: vi.fn(),
  networks: {
    bitcoin: { messagePrefix: "\x18Bitcoin Signed Message:\n", bech32: "bc" },
    testnet: { messagePrefix: "\x18Bitcoin Signed Message:\n", bech32: "tb" },
  },
  payments: {
    p2tr: vi.fn(() => ({ address: "bc1p_mock_taproot_address" })),
    p2wpkh: vi.fn(() => ({ address: "bc1q_mock_segwit_address" })),
    p2pkh: vi.fn(() => ({ address: "1MockP2PKHAddress" })),
  },
  Psbt: vi.fn(() => ({
    addInput: vi.fn().mockReturnThis(),
    addOutput: vi.fn().mockReturnThis(),
    signInput: vi.fn().mockReturnThis(),
    finalizeAllInputs: vi.fn().mockReturnThis(),
    extractTransaction: vi.fn(() => ({
      toHex: vi.fn(() => "mock_tx_hex"),
      getId: vi.fn(() => "mock_tx_id"),
    })),
  })),
  ECPair: {
    fromPrivateKey: vi.fn(() => ({
      sign: vi.fn(() => Buffer.alloc(64)),
      publicKey: Buffer.alloc(33),
    })),
  },
};

// @ts-expect-error - Mocking bitcoin global for tests
globalThis.bitcoin = bitcoinMock;

// Reset mocks between tests
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
