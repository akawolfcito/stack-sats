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

// Reset mocks between tests
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
