/**
 * Unit tests for transactions/index.ts
 *
 * Tests transaction history fetching, transformation, formatting,
 * and utility functions. All Hiro API calls are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Module-level mocks (hoisted) ---

vi.mock("../network", () => ({
  getSelectedNetwork: vi.fn(() => "testnet"),
}));

vi.mock("../security/logger", () => ({
  secureLog: vi.fn(),
}));

// --- Import mocked modules ---

import { getSelectedNetwork } from "../network";

// --- Import module under test ---

import {
  fetchTransactions,
  fetchTransactionList,
  fetchTransaction,
  getTransactionTypeLabel,
  getStatusColor,
  formatRelativeTime,
  formatAmount,
  truncateAddress,
  formatFullDateTime,
  getStatusLabel,
  getExplorerUrl,
  type Transaction,
  type TransactionType,
  type TransactionStatus,
  type TransactionList,
  type FetchTransactionsOptions,
  type FtTransferInfo,
} from "./index";

// --- Test data ---

const TEST_ADDRESS = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";
const TEST_TX_ID = "0xabc123def456789012345678901234567890123456789012345678901234abcd";

function makeApiTransaction(overrides: Record<string, unknown> = {}) {
  return {
    tx_id: TEST_TX_ID,
    tx_type: "token_transfer" as const,
    tx_status: "success" as const,
    block_time: 1700000000,
    sender_address: TEST_ADDRESS,
    fee_rate: "200",
    token_transfer: {
      recipient_address: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
      amount: "1000000",
      memo: "test memo",
    },
    ...overrides,
  };
}

function makeApiResponse(
  results: unknown[] = [],
  overrides: Record<string, unknown> = {}
) {
  return {
    limit: 10,
    offset: 0,
    total: results.length,
    results,
    ...overrides,
  };
}

function mockFetchOk(data: unknown) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

function mockFetchError(status: number) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: "error" }),
  });
}

function mockFetchReject(message: string) {
  global.fetch = vi.fn().mockRejectedValueOnce(new Error(message));
}

// --- Tests ---

describe("transactions/index", () => {
  beforeEach(() => {
    vi.mocked(getSelectedNetwork).mockReturnValue("testnet");
  });

  // ----------------------------------------------------------------
  // Pure utility functions
  // ----------------------------------------------------------------

  describe("getTransactionTypeLabel", () => {
    it("should return 'Transfer' for token_transfer", () => {
      expect(getTransactionTypeLabel("token_transfer")).toBe("Transfer");
    });

    it("should return 'Contract Call' for contract_call", () => {
      expect(getTransactionTypeLabel("contract_call")).toBe("Contract Call");
    });

    it("should return 'Deploy Contract' for smart_contract", () => {
      expect(getTransactionTypeLabel("smart_contract")).toBe("Deploy Contract");
    });

    it("should return 'Coinbase' for coinbase", () => {
      expect(getTransactionTypeLabel("coinbase")).toBe("Coinbase");
    });

    it("should return 'Poison Microblock' for poison_microblock", () => {
      expect(getTransactionTypeLabel("poison_microblock")).toBe(
        "Poison Microblock"
      );
    });
  });

  describe("getStatusColor", () => {
    it("should return 'status-success' for success", () => {
      expect(getStatusColor("success")).toBe("status-success");
    });

    it("should return 'status-pending' for pending", () => {
      expect(getStatusColor("pending")).toBe("status-pending");
    });

    it("should return 'status-failed' for failed", () => {
      expect(getStatusColor("failed")).toBe("status-failed");
    });

    it("should return 'status-failed' for abort_by_response", () => {
      expect(getStatusColor("abort_by_response")).toBe("status-failed");
    });

    it("should return 'status-failed' for abort_by_post_condition", () => {
      expect(getStatusColor("abort_by_post_condition")).toBe("status-failed");
    });

    it("should return empty string for unknown status", () => {
      expect(getStatusColor("unknown" as TransactionStatus)).toBe("");
    });
  });

  describe("getStatusLabel", () => {
    it("should return 'Confirmed' for success", () => {
      expect(getStatusLabel("success")).toBe("Confirmed");
    });

    it("should return 'Pending' for pending", () => {
      expect(getStatusLabel("pending")).toBe("Pending");
    });

    it("should return 'Failed' for failed", () => {
      expect(getStatusLabel("failed")).toBe("Failed");
    });

    it("should return 'Aborted' for abort_by_response", () => {
      expect(getStatusLabel("abort_by_response")).toBe("Aborted");
    });

    it("should return 'Aborted' for abort_by_post_condition", () => {
      expect(getStatusLabel("abort_by_post_condition")).toBe("Aborted");
    });
  });

  describe("formatRelativeTime", () => {
    it("should return 'Just now' for timestamps within last 60 seconds", () => {
      const now = Date.now() / 1000;
      expect(formatRelativeTime(now - 30)).toBe("Just now");
    });

    it("should return minutes ago for timestamps within last hour", () => {
      const now = Date.now() / 1000;
      expect(formatRelativeTime(now - 300)).toBe("5m ago");
    });

    it("should return hours ago for timestamps within last day", () => {
      const now = Date.now() / 1000;
      expect(formatRelativeTime(now - 7200)).toBe("2h ago");
    });

    it("should return days ago for timestamps within last week", () => {
      const now = Date.now() / 1000;
      expect(formatRelativeTime(now - 259200)).toBe("3d ago");
    });

    it("should return formatted date for timestamps older than a week", () => {
      // A very old timestamp
      const result = formatRelativeTime(1600000000);
      // Should return a locale date string
      expect(result).toMatch(/\d/);
      expect(result).not.toContain("ago");
    });
  });

  describe("formatAmount", () => {
    it("should return '0' for zero", () => {
      expect(formatAmount("0")).toBe("0");
    });

    it("should format 1 STX correctly", () => {
      expect(formatAmount("1000000")).toBe("1.00");
    });

    it("should format sub-STX amounts with 6 decimals", () => {
      expect(formatAmount("500000")).toBe("0.500000");
    });

    it("should format thousands with K suffix", () => {
      expect(formatAmount("5000000000")).toBe("5.00K");
    });

    it("should format millions with M suffix", () => {
      expect(formatAmount("5000000000000")).toBe("5.00M");
    });

    it("should format 2.5 STX with 2 decimals", () => {
      expect(formatAmount("2500000")).toBe("2.50");
    });
  });

  describe("truncateAddress", () => {
    it("should truncate a long address", () => {
      const addr = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";
      expect(truncateAddress(addr)).toBe("SP2J...9EJ7");
    });

    it("should truncate with custom char count", () => {
      const addr = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";
      expect(truncateAddress(addr, 6)).toBe("SP2J6Z...RV9EJ7");
    });

    it("should return short addresses unchanged", () => {
      expect(truncateAddress("short")).toBe("short");
    });

    it("should return addresses at boundary length unchanged", () => {
      // chars=4, boundary = 4*2+3 = 11, so length <= 11 stays unchanged
      expect(truncateAddress("12345678901")).toBe("12345678901");
    });
  });

  describe("formatFullDateTime", () => {
    it("should format a Unix timestamp to readable date", () => {
      // 1700000000 = Nov 14, 2023
      const result = formatFullDateTime(1700000000);
      expect(result).toContain("Nov");
      expect(result).toContain("2023");
    });

    it("should include time components", () => {
      const result = formatFullDateTime(1700000000);
      // Should contain hour:minute and AM/PM
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe("getExplorerUrl", () => {
    it("should return mainnet URL without chain param", () => {
      const url = getExplorerUrl(TEST_TX_ID, "mainnet");
      expect(url).toBe(`https://explorer.hiro.so/txid/${TEST_TX_ID}`);
      expect(url).not.toContain("?chain=");
    });

    it("should return testnet URL with chain param", () => {
      const url = getExplorerUrl(TEST_TX_ID, "testnet");
      expect(url).toBe(
        `https://explorer.hiro.so/txid/${TEST_TX_ID}?chain=testnet`
      );
    });

    it("should return devnet URL with chain param", () => {
      const url = getExplorerUrl(TEST_TX_ID, "devnet");
      expect(url).toBe(
        `https://explorer.hiro.so/txid/${TEST_TX_ID}?chain=devnet`
      );
    });

    it("should add 0x prefix when missing", () => {
      const rawId = "abc123";
      const url = getExplorerUrl(rawId, "mainnet");
      expect(url).toContain("/txid/0xabc123");
    });

    it("should not double-prefix when 0x already present", () => {
      const url = getExplorerUrl("0xabc123", "mainnet");
      expect(url).toContain("/txid/0xabc123");
      expect(url).not.toContain("0x0x");
    });

    it("should use selected network when none specified", () => {
      vi.mocked(getSelectedNetwork).mockReturnValue("testnet");
      const url = getExplorerUrl(TEST_TX_ID);
      expect(url).toContain("?chain=testnet");
    });
  });

  // ----------------------------------------------------------------
  // Transaction transformation (tested via fetch functions)
  // ----------------------------------------------------------------

  describe("fetchTransactionList", () => {
    it("should fetch and transform transactions", async () => {
      const apiTx = makeApiTransaction();
      mockFetchOk(makeApiResponse([apiTx], { total: 1 }));

      const result = await fetchTransactionList(TEST_ADDRESS);

      expect(result).not.toBeNull();
      expect(result!.transactions).toHaveLength(1);
      expect(result!.transactions[0].txId).toBe(TEST_TX_ID);
      expect(result!.transactions[0].type).toBe("token_transfer");
      expect(result!.transactions[0].status).toBe("success");
      expect(result!.transactions[0].sender).toBe(TEST_ADDRESS);
      expect(result!.transactions[0].recipient).toBe(
        "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE"
      );
      expect(result!.transactions[0].amount).toBe("1000000");
      expect(result!.transactions[0].fee).toBe("200");
      expect(result!.transactions[0].memo).toBe("test memo");
    });

    it("should return pagination info", async () => {
      const apiTx = makeApiTransaction();
      mockFetchOk(makeApiResponse([apiTx], { total: 50, limit: 10, offset: 0 }));

      const result = await fetchTransactionList(TEST_ADDRESS);

      expect(result!.total).toBe(50);
      expect(result!.limit).toBe(10);
      expect(result!.offset).toBe(0);
      expect(result!.hasMore).toBe(true);
    });

    it("should set hasMore to false when all results fetched", async () => {
      const apiTx = makeApiTransaction();
      mockFetchOk(makeApiResponse([apiTx], { total: 1, limit: 10, offset: 0 }));

      const result = await fetchTransactionList(TEST_ADDRESS);
      expect(result!.hasMore).toBe(false);
    });

    it("should pass limit and offset as query params", async () => {
      mockFetchOk(makeApiResponse([]));

      await fetchTransactionList(TEST_ADDRESS, { limit: 20, offset: 40 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=20&offset=40")
      );
    });

    it("should use default limit=10 and offset=0", async () => {
      mockFetchOk(makeApiResponse([]));

      await fetchTransactionList(TEST_ADDRESS);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=10&offset=0")
      );
    });

    it("should use testnet API URL for testnet", async () => {
      mockFetchOk(makeApiResponse([]));

      await fetchTransactionList(TEST_ADDRESS, { network: "testnet" });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("api.testnet.hiro.so")
      );
    });

    it("should use mainnet API URL for mainnet", async () => {
      mockFetchOk(makeApiResponse([]));

      await fetchTransactionList(TEST_ADDRESS, { network: "mainnet" });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("api.hiro.so")
      );
    });

    it("should fallback to testnet URL for devnet without API key", async () => {
      mockFetchOk(makeApiResponse([]));

      await fetchTransactionList(TEST_ADDRESS, { network: "devnet" });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("api.testnet.hiro.so")
      );
    });

    it("should return null on HTTP error", async () => {
      mockFetchError(500);

      const result = await fetchTransactionList(TEST_ADDRESS);
      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      mockFetchReject("Network error");

      const result = await fetchTransactionList(TEST_ADDRESS);
      expect(result).toBeNull();
    });

    it("should return null on rate limit (429)", async () => {
      mockFetchError(429);

      const result = await fetchTransactionList(TEST_ADDRESS);
      expect(result).toBeNull();
    });

    it("should handle empty results array", async () => {
      mockFetchOk(makeApiResponse([], { total: 0 }));

      const result = await fetchTransactionList(TEST_ADDRESS);
      expect(result).not.toBeNull();
      expect(result!.transactions).toHaveLength(0);
      expect(result!.total).toBe(0);
      expect(result!.hasMore).toBe(false);
    });

    it("should transform contract_call transactions", async () => {
      const apiTx = makeApiTransaction({
        tx_type: "contract_call",
        token_transfer: undefined,
        contract_call: {
          contract_id: "SP000.my-contract",
          function_name: "transfer",
          function_args: [{ repr: "u100" }],
        },
      });
      mockFetchOk(makeApiResponse([apiTx]));

      const result = await fetchTransactionList(TEST_ADDRESS);
      const tx = result!.transactions[0];
      expect(tx.type).toBe("contract_call");
      expect(tx.contractId).toBe("SP000.my-contract");
      expect(tx.functionName).toBe("transfer");
      expect(tx.recipient).toBeUndefined();
    });

    it("should transform smart_contract transactions", async () => {
      const apiTx = makeApiTransaction({
        tx_type: "smart_contract",
        token_transfer: undefined,
        smart_contract: {
          contract_id: "SP000.deployed-contract",
        },
      });
      mockFetchOk(makeApiResponse([apiTx]));

      const result = await fetchTransactionList(TEST_ADDRESS);
      const tx = result!.transactions[0];
      expect(tx.type).toBe("smart_contract");
      expect(tx.contractId).toBe("SP000.deployed-contract");
    });

    it("should extract FT transfer info from events", async () => {
      const apiTx = makeApiTransaction({
        tx_type: "contract_call",
        token_transfer: undefined,
        contract_call: {
          contract_id: "SP000.sip010-token",
          function_name: "transfer",
        },
        events: [
          {
            event_type: "fungible_token_asset",
            asset: {
              asset_event_type: "transfer",
              asset_id: "SP000.sip010-token::my-token",
              sender: TEST_ADDRESS,
              recipient: "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE",
              amount: "500",
            },
          },
        ],
      });
      mockFetchOk(makeApiResponse([apiTx]));

      const result = await fetchTransactionList(TEST_ADDRESS);
      const tx = result!.transactions[0];
      expect(tx.ftTransfer).toBeDefined();
      expect(tx.ftTransfer!.tokenContract).toBe("SP000.sip010-token::my-token");
      expect(tx.ftTransfer!.tokenName).toBe("my-token");
      expect(tx.ftTransfer!.amount).toBe("500");
      expect(tx.ftTransfer!.sender).toBe(TEST_ADDRESS);
      expect(tx.ftTransfer!.recipient).toBe(
        "SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE"
      );
    });

    it("should set recipient from FT event when not already set", async () => {
      const apiTx = makeApiTransaction({
        tx_type: "contract_call",
        token_transfer: undefined,
        contract_call: {
          contract_id: "SP000.sip010-token",
          function_name: "transfer",
        },
        events: [
          {
            event_type: "fungible_token_asset",
            asset: {
              asset_event_type: "transfer",
              asset_id: "SP000.sip010-token::token",
              sender: TEST_ADDRESS,
              recipient: "SPRECIPIENT",
              amount: "100",
            },
          },
        ],
      });
      mockFetchOk(makeApiResponse([apiTx]));

      const result = await fetchTransactionList(TEST_ADDRESS);
      const tx = result!.transactions[0];
      // recipient should be set from FT event
      expect(tx.recipient).toBe("SPRECIPIENT");
    });

    it("should use burn_block_time as fallback timestamp", async () => {
      const apiTx = makeApiTransaction({
        block_time: undefined,
        burn_block_time: 1699999000,
      });
      mockFetchOk(makeApiResponse([apiTx]));

      const result = await fetchTransactionList(TEST_ADDRESS);
      expect(result!.transactions[0].timestamp).toBe(1699999000);
    });

    it("should use Date.now() fallback when no timestamps present", async () => {
      const apiTx = makeApiTransaction({
        block_time: undefined,
        burn_block_time: undefined,
      });
      mockFetchOk(makeApiResponse([apiTx]));

      const before = Date.now() / 1000;
      const result = await fetchTransactionList(TEST_ADDRESS);
      const after = Date.now() / 1000;

      const ts = result!.transactions[0].timestamp;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it("should ignore non-FT events", async () => {
      const apiTx = makeApiTransaction({
        events: [
          {
            event_type: "stx_asset",
            asset: {
              asset_event_type: "transfer",
              amount: "100",
            },
          },
        ],
      });
      mockFetchOk(makeApiResponse([apiTx]));

      const result = await fetchTransactionList(TEST_ADDRESS);
      expect(result!.transactions[0].ftTransfer).toBeUndefined();
    });

    it("should handle FT event with missing asset_id gracefully", async () => {
      const apiTx = makeApiTransaction({
        tx_type: "contract_call",
        token_transfer: undefined,
        contract_call: {
          contract_id: "SP000.token",
          function_name: "transfer",
        },
        events: [
          {
            event_type: "fungible_token_asset",
            asset: {
              asset_event_type: "transfer",
              asset_id: undefined,
              amount: "50",
            },
          },
        ],
      });
      mockFetchOk(makeApiResponse([apiTx]));

      const result = await fetchTransactionList(TEST_ADDRESS);
      const tx = result!.transactions[0];
      expect(tx.ftTransfer).toBeDefined();
      expect(tx.ftTransfer!.tokenContract).toBe("");
    });
  });

  // ----------------------------------------------------------------
  // fetchTransactions (convenience wrapper)
  // ----------------------------------------------------------------

  describe("fetchTransactions", () => {
    it("should return array of transactions on success", async () => {
      const apiTx = makeApiTransaction();
      mockFetchOk(makeApiResponse([apiTx], { total: 1 }));

      const result = await fetchTransactions(TEST_ADDRESS);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].txId).toBe(TEST_TX_ID);
    });

    it("should return null on error", async () => {
      mockFetchReject("Connection refused");

      const result = await fetchTransactions(TEST_ADDRESS);
      expect(result).toBeNull();
    });

    it("should pass limit, offset, and network through", async () => {
      mockFetchOk(makeApiResponse([]));

      await fetchTransactions(TEST_ADDRESS, 25, 50, "mainnet");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("api.hiro.so")
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=25&offset=50")
      );
    });

    it("should use default limit and offset", async () => {
      mockFetchOk(makeApiResponse([]));

      await fetchTransactions(TEST_ADDRESS);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=10&offset=0")
      );
    });
  });

  // ----------------------------------------------------------------
  // fetchTransaction (single tx)
  // ----------------------------------------------------------------

  describe("fetchTransaction", () => {
    it("should fetch a single transaction by ID", async () => {
      const apiTx = makeApiTransaction();
      mockFetchOk(apiTx);

      const result = await fetchTransaction(TEST_TX_ID);
      expect(result).not.toBeNull();
      expect(result!.txId).toBe(TEST_TX_ID);
    });

    it("should add 0x prefix when missing", async () => {
      const rawId = "abc123def";
      mockFetchOk(makeApiTransaction({ tx_id: `0x${rawId}` }));

      await fetchTransaction(rawId);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/tx/0x${rawId}`)
      );
    });

    it("should not double-prefix when 0x already present", async () => {
      mockFetchOk(makeApiTransaction());

      await fetchTransaction("0xabc123");

      const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(calledUrl).not.toContain("0x0x");
    });

    it("should return null on HTTP error", async () => {
      mockFetchError(404);

      const result = await fetchTransaction(TEST_TX_ID);
      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      mockFetchReject("timeout");

      const result = await fetchTransaction(TEST_TX_ID);
      expect(result).toBeNull();
    });

    it("should use specified network", async () => {
      mockFetchOk(makeApiTransaction());

      await fetchTransaction(TEST_TX_ID, "mainnet");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("api.hiro.so")
      );
    });
  });
});
