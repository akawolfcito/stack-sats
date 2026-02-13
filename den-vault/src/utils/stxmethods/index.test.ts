import { describe, it, expect, vi } from "vitest";

// Mock @stacks/connect-ui which crashes in jsdom (Stencil web component loader)
vi.mock("@stacks/connect-ui", () => ({}));

// Mock @stacks/connect to avoid transitive connect-ui import.
// Only the symbols actually used by the handlers are provided.
vi.mock("@stacks/connect", () => ({
  JsonRpcErrorCode: { UnknownError: -32001 },
}));

// Mock @stacks/connect response type (type-only import, but vitest may resolve it)
vi.mock("@stacks/connect/dist/types/methods", () => ({}));

import {
  handleSignMessage,
  handleCallContract,
  handleTransferStx,
} from "./index";

/**
 * STX Methods Handler Tests - Zod Validation Boundary
 *
 * These tests exercise the Zod validation guard at the entry point of each
 * handler. Invalid params are rejected with JSON-RPC error code -32602 BEFORE
 * any @stacks/transactions or network calls happen, so no mocks are needed.
 */

const DUMMY_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

/** Helper to build a well-formed JsonRpcRequest */
function makeRequest(
  method: string,
  params: Record<string, unknown>,
  id: string | number = 1
) {
  return { jsonrpc: "2.0", id: String(id), method, params };
}

// ---------------------------------------------------------------------------
// handleSignMessage
// ---------------------------------------------------------------------------
describe("handleSignMessage - validation", () => {
  it("rejects empty message", async () => {
    const result = await handleSignMessage(
      makeRequest("stx_signMessage", { message: "" }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects missing message field", async () => {
    const result = await handleSignMessage(
      makeRequest("stx_signMessage", {}),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects non-string message (number)", async () => {
    const result = await handleSignMessage(
      makeRequest("stx_signMessage", { message: 42 }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("preserves the JSON-RPC id in the error response", async () => {
    const result = await handleSignMessage(
      makeRequest("stx_signMessage", { message: "" }, "req-99"),
      DUMMY_MNEMONIC,
      0
    );
    const data = result.data as { id: string };
    expect(data.id).toBe("req-99");
  });

  it("returns method and COMPLETE status on validation failure", async () => {
    const result = await handleSignMessage(
      makeRequest("stx_signMessage", {}),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.method).toBe("stx_signMessage");
    expect(result.status).toBe("COMPLETE");
  });
});

// ---------------------------------------------------------------------------
// handleCallContract
// ---------------------------------------------------------------------------
describe("handleCallContract - validation", () => {
  it("rejects contract without dot separator", async () => {
    const result = await handleCallContract(
      makeRequest("stx_callContract", {
        contract: "not-a-contract",
        functionName: "transfer",
        functionArgs: [],
      }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects empty function name", async () => {
    const result = await handleCallContract(
      makeRequest("stx_callContract", {
        contract:
          "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-contract",
        functionName: "",
        functionArgs: [],
      }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects missing contract field", async () => {
    const result = await handleCallContract(
      makeRequest("stx_callContract", {
        functionName: "transfer",
        functionArgs: [],
      }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects missing functionName field", async () => {
    const result = await handleCallContract(
      makeRequest("stx_callContract", {
        contract:
          "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-contract",
        functionArgs: [],
      }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects contract with invalid address prefix", async () => {
    const result = await handleCallContract(
      makeRequest("stx_callContract", {
        contract: "XX1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-contract",
        functionName: "transfer",
        functionArgs: [],
      }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("includes field-level error data from Zod", async () => {
    const result = await handleCallContract(
      makeRequest("stx_callContract", {
        contract: "bad",
        functionName: "",
        functionArgs: [],
      }),
      DUMMY_MNEMONIC,
      0
    );
    const data = result.data as {
      error: { code: number; message: string; data: Record<string, unknown> };
    };
    expect(data.error.message).toBe("Invalid parameters");
    expect(data.error.data).toBeDefined();
  });

  it("preserves JSON-RPC id on validation error", async () => {
    const result = await handleCallContract(
      makeRequest("stx_callContract", { contract: "bad" }, 42),
      DUMMY_MNEMONIC,
      0
    );
    const data = result.data as { id: string };
    expect(data.id).toBe("42");
  });
});

// ---------------------------------------------------------------------------
// handleTransferStx
// ---------------------------------------------------------------------------
describe("handleTransferStx - validation", () => {
  it("rejects missing recipient", async () => {
    const result = await handleTransferStx(
      makeRequest("stx_transferStx", { amount: "1000000" }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects missing amount", async () => {
    const result = await handleTransferStx(
      makeRequest("stx_transferStx", {
        recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects negative amount", async () => {
    const result = await handleTransferStx(
      makeRequest("stx_transferStx", {
        recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        amount: "-100",
      }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects zero amount", async () => {
    const result = await handleTransferStx(
      makeRequest("stx_transferStx", {
        recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        amount: "0",
      }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects invalid STX address", async () => {
    const result = await handleTransferStx(
      makeRequest("stx_transferStx", {
        recipient: "invalid-address",
        amount: "1000000",
      }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects non-numeric amount string", async () => {
    const result = await handleTransferStx(
      makeRequest("stx_transferStx", {
        recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        amount: "abc",
      }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects memo longer than 34 chars", async () => {
    const result = await handleTransferStx(
      makeRequest("stx_transferStx", {
        recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        amount: "1000000",
        memo: "x".repeat(35),
      }),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("rejects completely empty params", async () => {
    const result = await handleTransferStx(
      makeRequest("stx_transferStx", {}),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.data).toHaveProperty("error");
    const err = (result.data as { error: { code: number } }).error;
    expect(err.code).toBe(-32602);
  });

  it("returns jsonrpc 2.0 in error envelope", async () => {
    const result = await handleTransferStx(
      makeRequest("stx_transferStx", {}),
      DUMMY_MNEMONIC,
      0
    );
    const data = result.data as { jsonrpc: string };
    expect(data.jsonrpc).toBe("2.0");
  });

  it("returns COMPLETE status even on validation failure", async () => {
    const result = await handleTransferStx(
      makeRequest("stx_transferStx", {}),
      DUMMY_MNEMONIC,
      0
    );
    expect(result.status).toBe("COMPLETE");
    expect(result.method).toBe("stx_transferStx");
  });
});
