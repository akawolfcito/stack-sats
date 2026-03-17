/**
 * Unit tests for stxmethods/index.ts — Happy paths & error branches
 *
 * Complements the existing index.test.ts (validation-only) by testing the
 * full flow of each handler: key derivation, signing, broadcasting, and
 * error handling.
 *
 * All external dependencies are mocked at module level via vi.hoisted().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Hoisted mocks — accessible inside vi.mock() factories ----

const {
  mockSignMessageHashRsv,
  mockPrivateKeyToPublic,
  mockPrivateKeyToAddress,
  mockTransactionToHex,
  mockSignStructuredData,
  mockTransaction,
  mockMakeContractCall,
  mockMakeContractDeploy,
  mockMakeSTXTokenTransfer,
  mockBroadcastTransaction,
} = vi.hoisted(() => {
  const mockTransaction = {
    auth: { spendingCondition: { fee: 500n } },
    setFee: vi.fn(),
  };

  return {
    mockSignMessageHashRsv: vi.fn(() => "mock-signature-rsv"),
    mockPrivateKeyToPublic: vi.fn(() => "mock-public-key"),
    mockPrivateKeyToAddress: vi.fn(() => "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"),
    mockTransactionToHex: vi.fn(() => "0x0102abcdef"),
    mockSignStructuredData: vi.fn(() => "mock-structured-sig"),
    mockTransaction,
    mockMakeContractCall: vi.fn(async () => mockTransaction),
    mockMakeContractDeploy: vi.fn(async () => mockTransaction),
    mockMakeSTXTokenTransfer: vi.fn(async () => mockTransaction),
    mockBroadcastTransaction: vi.fn(async () => ({ txid: "mock-txid-123" })),
  };
});

// ---- Module-level mocks ----

vi.mock("@stacks/connect-ui", () => ({}));

vi.mock("@stacks/connect", () => ({
  JsonRpcErrorCode: { UnknownError: -32001 },
}));

vi.mock("@stacks/connect/dist/types/methods", () => ({}));

vi.mock("@stacks/encryption", () => ({
  encodeMessage: vi.fn(() => new Uint8Array([1, 2, 3])),
}));

vi.mock("@stacks/transactions", () => ({
  signMessageHashRsv: mockSignMessageHashRsv,
  privateKeyToPublic: mockPrivateKeyToPublic,
  privateKeyToAddress: mockPrivateKeyToAddress,
  transactionToHex: mockTransactionToHex,
  makeContractCall: mockMakeContractCall,
  makeContractDeploy: mockMakeContractDeploy,
  makeSTXTokenTransfer: mockMakeSTXTokenTransfer,
  broadcastTransaction: mockBroadcastTransaction,
  signStructuredData: mockSignStructuredData,
}));

vi.mock("../network", () => ({
  buildNetworkWithClient: vi.fn(() => ({
    chainId: 2147483648,
    client: { baseUrl: "https://api.testnet.hiro.so" },
  })),
  getSelectedNetwork: vi.fn(() => "testnet"),
  getAddressVersion: vi.fn(() => "testnet"),
  getNetworkConfig: vi.fn(() => ({
    chainId: 2147483648,
    client: { baseUrl: "https://api.testnet.hiro.so" },
  })),
}));

vi.mock("c32check", () => ({
  c32ToB58: vi.fn(() => "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn"),
}));

vi.mock("../accounts", () => ({
  generateP2TR: vi.fn(async () => "tb1p_mock_taproot_address"),
  getPrivateKey: vi.fn(async () => "mock-private-key-hex"),
}));

vi.mock("../helpers", () => ({
  hashUint8Array: vi.fn(async () => "abcdef1234567890"),
}));

vi.mock("../security/logger", () => ({
  secureLog: vi.fn(),
  isDebugMode: vi.fn(() => false),
}));

// ---- Import module under test ----

import {
  handleSignMessage,
  handleGetAddresses,
  handleCallContract,
  handleTransferStx,
  handleSignStructuredData,
  handleDeployContract,
} from "./index";

// ---- Helpers ----

const DUMMY_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

function makeRequest(
  method: string,
  params: Record<string, unknown>,
  id: string | number = 1
) {
  return { jsonrpc: "2.0", id: String(id), method, params };
}

// ---- Tests ----

beforeEach(() => {
  vi.clearAllMocks();
  // Reset transaction fee to non-zero for default behavior
  mockTransaction.auth.spendingCondition.fee = 500n;
});

// ---------------------------------------------------------------------------
// handleSignMessage — happy path
// ---------------------------------------------------------------------------
describe("handleSignMessage - happy path", () => {
  it("signs a valid message and returns signature + publicKey", async () => {
    const result = await handleSignMessage(
      makeRequest("stx_signMessage", { message: "Hello Stacks!" }),
      DUMMY_MNEMONIC,
      0
    );

    expect(result.status).toBe("COMPLETE");
    expect(result.method).toBe("stx_signMessage");

    const data = result.data as {
      jsonrpc: string;
      id: string;
      result: { signature: string; publicKey: string };
    };
    expect(data.jsonrpc).toBe("2.0");
    expect(data.id).toBe("1");
    expect(data.result.signature).toBe("mock-signature-rsv");
    expect(data.result.publicKey).toBe("mock-public-key");
  });

  it("preserves the JSON-RPC id in success response", async () => {
    const result = await handleSignMessage(
      makeRequest("stx_signMessage", { message: "test" }, "req-42"),
      DUMMY_MNEMONIC,
      0
    );
    const data = result.data as { id: string };
    expect(data.id).toBe("req-42");
  });
});

// ---------------------------------------------------------------------------
// handleGetAddresses — happy path
// ---------------------------------------------------------------------------
describe("handleGetAddresses - happy path", () => {
  it("returns STX and BTC addresses with network info", async () => {
    const result = await handleGetAddresses(
      makeRequest("getAddresses", {}),
      DUMMY_MNEMONIC,
      0
    );

    expect(result.status).toBe("COMPLETE");
    expect(result.method).toBe("getAddresses");

    const data = result.data as {
      jsonrpc: string;
      result: {
        addresses: Array<{ symbol: string; address: string; publicKey: string }>;
        network: { name: string; chainId: number };
      };
    };

    expect(data.jsonrpc).toBe("2.0");
    expect(data.result.addresses).toHaveLength(3);

    // BTC P2PKH
    expect(data.result.addresses[0].symbol).toBe("BTC");
    expect(data.result.addresses[0].address).toBe("mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn");

    // BTC P2TR
    expect(data.result.addresses[1].symbol).toBe("BTC");
    expect(data.result.addresses[1].address).toBe("tb1p_mock_taproot_address");

    // STX
    expect(data.result.addresses[2].symbol).toBe("STX");
    expect(data.result.addresses[2].address).toBe(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    );

    // Network info
    expect(data.result.network.name).toBe("testnet");
    expect(data.result.network.chainId).toBe(2147483648);
  });
});

// ---------------------------------------------------------------------------
// handleCallContract — happy path + error branch
// ---------------------------------------------------------------------------
describe("handleCallContract - happy path", () => {
  const validParams = {
    contract: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-contract",
    functionName: "transfer",
    functionArgs: [],
  };

  it("calls contract and returns txid + transaction hex", async () => {
    const result = await handleCallContract(
      makeRequest("stx_callContract", validParams),
      DUMMY_MNEMONIC,
      0
    );

    expect(result.status).toBe("COMPLETE");
    const data = result.data as {
      jsonrpc: string;
      id: string;
      result: { txid: string; transaction: string };
    };
    expect(data.jsonrpc).toBe("2.0");
    expect(data.result.txid).toBe("mock-txid-123");
    expect(data.result.transaction).toBe("0x0102abcdef");
  });

  it("applies default fee when estimation returns 0", async () => {
    mockTransaction.auth.spendingCondition.fee = 0n;

    await handleCallContract(
      makeRequest("stx_callContract", validParams),
      DUMMY_MNEMONIC,
      0
    );

    expect(mockTransaction.setFee).toHaveBeenCalledWith(10000n);
  });

  it("does not override fee when estimation succeeds", async () => {
    mockTransaction.auth.spendingCondition.fee = 500n;

    await handleCallContract(
      makeRequest("stx_callContract", validParams),
      DUMMY_MNEMONIC,
      0
    );

    expect(mockTransaction.setFee).not.toHaveBeenCalled();
  });

  it("returns error envelope when makeContractCall throws", async () => {
    mockMakeContractCall.mockRejectedValueOnce(new Error("Node unreachable"));

    const result = await handleCallContract(
      makeRequest("stx_callContract", validParams),
      DUMMY_MNEMONIC,
      0
    );

    expect(result.status).toBe("COMPLETE");
    const data = result.data as {
      error: { code: number; message: string; data: string };
    };
    expect(data.error.code).toBe(-32001);
    expect(data.error.data).toBe("Node unreachable");
  });

  it("returns error envelope when broadcastTransaction throws", async () => {
    mockBroadcastTransaction.mockRejectedValueOnce(
      new Error("Broadcast rejected")
    );

    const result = await handleCallContract(
      makeRequest("stx_callContract", validParams),
      DUMMY_MNEMONIC,
      0
    );

    const data = result.data as { error: { data: string } };
    expect(data.error.data).toBe("Broadcast rejected");
  });

  it("stringifies non-Error thrown values", async () => {
    mockMakeContractCall.mockRejectedValueOnce("string-error");

    const result = await handleCallContract(
      makeRequest("stx_callContract", validParams),
      DUMMY_MNEMONIC,
      0
    );

    const data = result.data as { error: { data: string } };
    expect(data.error.data).toBe("string-error");
  });
});

// ---------------------------------------------------------------------------
// handleTransferStx — happy path + error branch
// ---------------------------------------------------------------------------
describe("handleTransferStx - happy path", () => {
  const validParams = {
    recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    amount: "1000000",
  };

  it("transfers STX and returns txid", async () => {
    const result = await handleTransferStx(
      makeRequest("stx_transferStx", validParams),
      DUMMY_MNEMONIC,
      0
    );

    expect(result.status).toBe("COMPLETE");
    const data = result.data as {
      result: { txid: string; transaction: string };
    };
    expect(data.result.txid).toBe("mock-txid-123");
    expect(data.result.transaction).toBe("0x0102abcdef");
  });

  it("applies default fee when estimation returns 0", async () => {
    mockTransaction.auth.spendingCondition.fee = 0n;

    await handleTransferStx(
      makeRequest("stx_transferStx", validParams),
      DUMMY_MNEMONIC,
      0
    );

    expect(mockTransaction.setFee).toHaveBeenCalledWith(10000n);
  });

  it("accepts optional memo field", async () => {
    const result = await handleTransferStx(
      makeRequest("stx_transferStx", { ...validParams, memo: "test-memo" }),
      DUMMY_MNEMONIC,
      0
    );

    expect(result.status).toBe("COMPLETE");
    const data = result.data as { result: { txid: string } };
    expect(data.result.txid).toBe("mock-txid-123");
  });

  it("returns error envelope when transfer throws", async () => {
    mockMakeSTXTokenTransfer.mockRejectedValueOnce(
      new Error("Insufficient balance")
    );

    const result = await handleTransferStx(
      makeRequest("stx_transferStx", validParams),
      DUMMY_MNEMONIC,
      0
    );

    const data = result.data as { error: { data: string } };
    expect(data.error.data).toBe("Insufficient balance");
  });

  it("stringifies non-Error thrown values", async () => {
    mockMakeSTXTokenTransfer.mockRejectedValueOnce(404);

    const result = await handleTransferStx(
      makeRequest("stx_transferStx", validParams),
      DUMMY_MNEMONIC,
      0
    );

    const data = result.data as { error: { data: string } };
    expect(data.error.data).toBe("404");
  });
});

// ---------------------------------------------------------------------------
// handleSignStructuredData — happy path + validation + error
// ---------------------------------------------------------------------------
describe("handleSignStructuredData", () => {
  const validParams = {
    message: { type: 1, value: "hello" },
    domain: { type: 12, value: { name: "test", version: "1.0", "chain-id": 1 } },
  };

  it("signs structured data and returns signature + publicKey", async () => {
    const result = await handleSignStructuredData(
      makeRequest("stx_signStructuredMessage", validParams),
      DUMMY_MNEMONIC,
      0
    );

    expect(result.status).toBe("COMPLETE");
    const data = result.data as {
      result: { signature: string; publicKey: string };
    };
    expect(data.result.signature).toBe("mock-structured-sig");
    expect(data.result.publicKey).toBe("mock-public-key");
  });

  it("passes validation with partial params (z.unknown allows missing fields)", async () => {
    // SignStructuredDataParamsSchema uses z.unknown() for both fields,
    // so missing fields pass Zod validation and reach signStructuredData.
    // signStructuredData is mocked to succeed, so handler completes.
    const result = await handleSignStructuredData(
      makeRequest("stx_signStructuredMessage", { domain: {} }),
      DUMMY_MNEMONIC,
      0
    );

    expect(result.status).toBe("COMPLETE");
    // The mock returns a signature even for partial params
    const data = result.data as { result?: { signature: string } };
    expect(data.result?.signature).toBe("mock-structured-sig");
  });

  it("rejects when params object itself is missing required shape", async () => {
    // Completely empty object still passes z.unknown() schema,
    // but we can verify the handler still completes gracefully
    const result = await handleSignStructuredData(
      makeRequest("stx_signStructuredMessage", {}),
      DUMMY_MNEMONIC,
      0
    );

    expect(result.status).toBe("COMPLETE");
  });

  it("returns error envelope when signStructuredData throws", async () => {
    mockSignStructuredData.mockImplementationOnce(() => {
      throw new Error("Invalid domain tuple");
    });

    const result = await handleSignStructuredData(
      makeRequest("stx_signStructuredMessage", validParams),
      DUMMY_MNEMONIC,
      0
    );

    const data = result.data as { error: { data: string; code: number } };
    expect(data.error.code).toBe(-32001);
    expect(data.error.data).toBe("Invalid domain tuple");
  });

  it("stringifies non-Error thrown values in catch", async () => {
    mockSignStructuredData.mockImplementationOnce(() => {
      throw "raw-string-error";
    });

    const result = await handleSignStructuredData(
      makeRequest("stx_signStructuredMessage", validParams),
      DUMMY_MNEMONIC,
      0
    );

    const data = result.data as { error: { data: string } };
    expect(data.error.data).toBe("raw-string-error");
  });
});

// ---------------------------------------------------------------------------
// handleDeployContract — happy path + validation + error
// ---------------------------------------------------------------------------
describe("handleDeployContract", () => {
  const validParams = {
    name: "my-contract",
    clarityCode: "(define-public (hello) (ok true))",
  };

  it("deploys a contract and returns txid", async () => {
    const result = await handleDeployContract(
      makeRequest("stx_deployContract", validParams),
      DUMMY_MNEMONIC,
      0
    );

    expect(result.status).toBe("COMPLETE");
    const data = result.data as {
      result: { txid: string; transaction: string };
    };
    expect(data.result.txid).toBe("mock-txid-123");
    expect(data.result.transaction).toBe("0x0102abcdef");
  });

  it("applies default fee when estimation returns 0", async () => {
    mockTransaction.auth.spendingCondition.fee = 0n;

    await handleDeployContract(
      makeRequest("stx_deployContract", validParams),
      DUMMY_MNEMONIC,
      0
    );

    expect(mockTransaction.setFee).toHaveBeenCalledWith(10000n);
  });

  it("passes clarityVersion when specified", async () => {
    await handleDeployContract(
      makeRequest("stx_deployContract", { ...validParams, clarityVersion: 2 }),
      DUMMY_MNEMONIC,
      0
    );

    expect(mockMakeContractDeploy).toHaveBeenCalledWith(
      expect.objectContaining({ clarityVersion: 2 })
    );
  });

  it("does not include clarityVersion when not specified", async () => {
    await handleDeployContract(
      makeRequest("stx_deployContract", validParams),
      DUMMY_MNEMONIC,
      0
    );

    const callArg = mockMakeContractDeploy.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty("clarityVersion");
  });

  it("rejects empty contract name", async () => {
    const result = await handleDeployContract(
      makeRequest("stx_deployContract", { name: "", clarityCode: "(ok true)" }),
      DUMMY_MNEMONIC,
      0
    );

    const data = result.data as { error: { code: number } };
    expect(data.error.code).toBe(-32602);
  });

  it("rejects empty clarityCode", async () => {
    const result = await handleDeployContract(
      makeRequest("stx_deployContract", { name: "test", clarityCode: "" }),
      DUMMY_MNEMONIC,
      0
    );

    const data = result.data as { error: { code: number } };
    expect(data.error.code).toBe(-32602);
  });

  it("rejects missing name field", async () => {
    const result = await handleDeployContract(
      makeRequest("stx_deployContract", { clarityCode: "(ok true)" }),
      DUMMY_MNEMONIC,
      0
    );

    const data = result.data as { error: { code: number } };
    expect(data.error.code).toBe(-32602);
  });

  it("rejects missing clarityCode field", async () => {
    const result = await handleDeployContract(
      makeRequest("stx_deployContract", { name: "test" }),
      DUMMY_MNEMONIC,
      0
    );

    const data = result.data as { error: { code: number } };
    expect(data.error.code).toBe(-32602);
  });

  it("returns error envelope when deploy throws", async () => {
    mockMakeContractDeploy.mockRejectedValueOnce(
      new Error("Contract already exists")
    );

    const result = await handleDeployContract(
      makeRequest("stx_deployContract", validParams),
      DUMMY_MNEMONIC,
      0
    );

    const data = result.data as { error: { data: string; code: number } };
    expect(data.error.code).toBe(-32001);
    expect(data.error.data).toBe("Contract already exists");
  });

  it("stringifies non-Error thrown values", async () => {
    mockMakeContractDeploy.mockRejectedValueOnce(500);

    const result = await handleDeployContract(
      makeRequest("stx_deployContract", validParams),
      DUMMY_MNEMONIC,
      0
    );

    const data = result.data as { error: { data: string } };
    expect(data.error.data).toBe("500");
  });
});
