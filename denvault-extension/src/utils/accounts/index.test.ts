/**
 * Unit tests for accounts/index.ts
 *
 * Tests account generation, private key derivation, P2TR address generation,
 * and BTC key pair extraction.
 *
 * All external dependencies are mocked at module level.
 * `bitcoin` is a global (not an ES import) — mocked via globalThis.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Buffer } from "buffer";

// --- Module-level mocks (hoisted) ---

vi.mock("@stacks/wallet-sdk", () => ({
  generateWallet: vi.fn(),
  generateNewAccount: vi.fn(),
}));

vi.mock("@stacks/transactions", () => ({
  privateKeyToAddress: vi.fn(),
  privateKeyToPublic: vi.fn(),
}));

vi.mock("c32check", () => ({
  c32ToB58: vi.fn(),
}));

vi.mock("@bitcoinerlab/secp256k1", () => ({
  default: {
    pointFromScalar: vi.fn(),
  },
}));

vi.mock("../security/logger", () => ({
  secureLog: vi.fn(),
}));

vi.mock("../network", () => ({
  getSelectedNetwork: vi.fn().mockReturnValue("testnet"),
  getAddressVersion: vi.fn().mockReturnValue("testnet"),
}));

// --- Import mocked modules ---

import { generateWallet, generateNewAccount } from "@stacks/wallet-sdk";
import { privateKeyToAddress, privateKeyToPublic } from "@stacks/transactions";
import { c32ToB58 } from "c32check";
import ecc from "@bitcoinerlab/secp256k1";
import { getSelectedNetwork, getAddressVersion } from "../network";
import { secureLog } from "../security/logger";

// --- Import module under test ---

import {
  generateInitialAccounts,
  getPrivateKey,
  generateP2TR,
  getBtcKeyPair,
} from "./index";

// --- Helpers ---

/** Build a fake wallet object with N accounts */
function makeFakeWallet(count: number) {
  return {
    accounts: Array.from({ length: count }, (_, i) => ({
      stxPrivateKey: `abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd12${String(i).padStart(2, "0")}`,
    })),
  };
}

// --- Setup globalThis.bitcoin mock ---

const mockP2tr = vi.fn().mockReturnValue({ address: "tb1p_mock_taproot_address" });
const mockInitEccLib = vi.fn();

beforeEach(() => {
  // @ts-expect-error - bitcoin is a global variable
  globalThis.bitcoin = {
    initEccLib: mockInitEccLib,
    payments: { p2tr: mockP2tr },
    networks: {
      bitcoin: { messagePrefix: "mainnet" },
      testnet: { messagePrefix: "testnet" },
    },
  };
});

// --- Tests ---

describe("accounts/index", () => {
  describe("generateInitialAccounts", () => {
    beforeEach(() => {
      const fakeWallet = makeFakeWallet(20);

      vi.mocked(generateWallet).mockResolvedValue(fakeWallet as never);
      vi.mocked(generateNewAccount).mockImplementation((w: unknown) => w as never);
      vi.mocked(privateKeyToAddress).mockImplementation(
        (_key, version) => `${version === "mainnet" ? "SP" : "ST"}ADDRESS`
      );
      vi.mocked(privateKeyToPublic).mockReturnValue("02abcdef1234567890" as never);
      vi.mocked(c32ToB58).mockReturnValue("1BTClegacyAddress");
      vi.mocked(getAddressVersion).mockReturnValue("testnet");
      mockP2tr.mockReturnValue({ address: "tb1p_mock_taproot" });
    });

    it("should generate the correct number of accounts", async () => {
      const accounts = await generateInitialAccounts("test mnemonic", 3);
      expect(accounts).toHaveLength(3);
    });

    it("should default to 20 accounts when count is not specified", async () => {
      const accounts = await generateInitialAccounts("test mnemonic");
      expect(accounts).toHaveLength(20);
    });

    it("should generate 1 account as boundary case", async () => {
      const accounts = await generateInitialAccounts("test mnemonic", 1);
      expect(accounts).toHaveLength(1);
    });

    it("should produce accounts with correct structure", async () => {
      const accounts = await generateInitialAccounts("test mnemonic", 2);
      const account = accounts[0];

      expect(account).toHaveProperty("index", 0);
      expect(account).toHaveProperty("path", "m/44'/5757'/0'/0/0");
      expect(account).toHaveProperty("stxAddress");
      expect(account).toHaveProperty("btcP2PKHAddress");
      expect(account).toHaveProperty("btcP2TRAddress");
      expect(account).toHaveProperty("pubkey");
    });

    it("should set correct derivation paths for each account", async () => {
      const accounts = await generateInitialAccounts("test mnemonic", 3);
      expect(accounts[0].path).toBe("m/44'/5757'/0'/0/0");
      expect(accounts[1].path).toBe("m/44'/5757'/0'/0/1");
      expect(accounts[2].path).toBe("m/44'/5757'/0'/0/2");
    });

    it("should set sequential index values", async () => {
      const accounts = await generateInitialAccounts("test mnemonic", 3);
      expect(accounts.map((a) => a.index)).toEqual([0, 1, 2]);
    });

    it("should call generateWallet with the mnemonic", async () => {
      await generateInitialAccounts("my secret mnemonic", 1);
      expect(generateWallet).toHaveBeenCalledWith({
        secretKey: "my secret mnemonic",
        password: "",
      });
    });

    it("should call generateNewAccount count-1 times", async () => {
      await generateInitialAccounts("test mnemonic", 5);
      expect(generateNewAccount).toHaveBeenCalledTimes(4);
    });

    it("should not call generateNewAccount when count is 1", async () => {
      await generateInitialAccounts("test mnemonic", 1);
      expect(generateNewAccount).not.toHaveBeenCalled();
    });

    it("should use testnet address version for testnet network", async () => {
      vi.mocked(getAddressVersion).mockReturnValue("testnet");
      const accounts = await generateInitialAccounts("test mnemonic", 1);
      expect(accounts[0].stxAddress).toBe("STADDRESS");
    });

    it("should use mainnet address version for mainnet network", async () => {
      vi.mocked(getAddressVersion).mockReturnValue("mainnet");
      vi.mocked(privateKeyToAddress).mockImplementation(
        (_key, version) => `${version === "mainnet" ? "SP" : "ST"}MAIN`
      );
      const accounts = await generateInitialAccounts("test mnemonic", 1, "mainnet");
      expect(accounts[0].stxAddress).toBe("SPMAIN");
      expect(getAddressVersion).toHaveBeenCalledWith("mainnet");
    });

    it("should call c32ToB58 to derive btcP2PKHAddress", async () => {
      await generateInitialAccounts("test mnemonic", 1);
      expect(c32ToB58).toHaveBeenCalledWith("STADDRESS");
    });

    it("should set pubkey from privateKeyToPublic toString", async () => {
      vi.mocked(privateKeyToPublic).mockReturnValue("03fedcba9876543210" as never);
      const accounts = await generateInitialAccounts("test mnemonic", 1);
      expect(accounts[0].pubkey).toBe("03fedcba9876543210");
    });

    it("should call secureLog after generating accounts", async () => {
      await generateInitialAccounts("test mnemonic", 3);
      expect(secureLog).toHaveBeenCalledWith("Generated 3 accounts for testnet");
    });

    it("should not include private keys in account objects", async () => {
      const accounts = await generateInitialAccounts("test mnemonic", 1);
      const account = accounts[0] as Record<string, unknown>;
      expect(account).not.toHaveProperty("privateKey");
      expect(account).not.toHaveProperty("stxPrivateKey");
    });
  });

  describe("getPrivateKey", () => {
    beforeEach(() => {
      const fakeWallet = makeFakeWallet(10);
      vi.mocked(generateWallet).mockResolvedValue(fakeWallet as never);
      vi.mocked(generateNewAccount).mockImplementation((w: unknown) => w as never);
    });

    it("should return the private key for accountIndex 0 without additional derivation", async () => {
      const key = await getPrivateKey("test mnemonic", 0);
      expect(key).toBeDefined();
      expect(typeof key).toBe("string");
      expect(generateNewAccount).not.toHaveBeenCalled();
    });

    it("should call generateNewAccount N times for accountIndex N", async () => {
      await getPrivateKey("test mnemonic", 5);
      expect(generateNewAccount).toHaveBeenCalledTimes(5);
    });

    it("should return a hex string private key", async () => {
      const key = await getPrivateKey("test mnemonic", 0);
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it("should call generateWallet with the provided mnemonic", async () => {
      await getPrivateKey("another mnemonic", 0);
      expect(generateWallet).toHaveBeenCalledWith({
        secretKey: "another mnemonic",
        password: "",
      });
    });
  });

  describe("generateP2TR", () => {
    const testPubkey = "02abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    beforeEach(() => {
      mockP2tr.mockReturnValue({ address: "tb1p_mock_taproot" });
      mockInitEccLib.mockClear();
    });

    it("should call bitcoin.initEccLib with ecc", async () => {
      await generateP2TR(testPubkey, "testnet");
      expect(mockInitEccLib).toHaveBeenCalledWith(ecc);
    });

    it("should use testnet network for testnet", async () => {
      await generateP2TR(testPubkey, "testnet");
      expect(mockP2tr).toHaveBeenCalledWith(
        expect.objectContaining({
          // @ts-expect-error - accessing global mock
          network: globalThis.bitcoin.networks.testnet,
        })
      );
    });

    it("should use bitcoin (mainnet) network for mainnet", async () => {
      mockP2tr.mockReturnValue({ address: "bc1p_mock_mainnet" });
      const address = await generateP2TR(testPubkey, "mainnet");
      expect(mockP2tr).toHaveBeenCalledWith(
        expect.objectContaining({
          // @ts-expect-error - accessing global mock
          network: globalThis.bitcoin.networks.bitcoin,
        })
      );
      expect(address).toBe("bc1p_mock_mainnet");
    });

    it("should use testnet network for devnet", async () => {
      await generateP2TR(testPubkey, "devnet");
      expect(mockP2tr).toHaveBeenCalledWith(
        expect.objectContaining({
          // @ts-expect-error - accessing global mock
          network: globalThis.bitcoin.networks.testnet,
        })
      );
    });

    it("should fall back to getSelectedNetwork when no network is provided", async () => {
      vi.mocked(getSelectedNetwork).mockReturnValue("mainnet");
      await generateP2TR(testPubkey);
      expect(mockP2tr).toHaveBeenCalledWith(
        expect.objectContaining({
          // @ts-expect-error - accessing global mock
          network: globalThis.bitcoin.networks.bitcoin,
        })
      );
    });

    it("should pass internalPubkey as Buffer with first byte stripped", async () => {
      const pubkey = "02aabbccdd";
      await generateP2TR(pubkey, "testnet");
      const call = mockP2tr.mock.calls[0][0];
      expect(Buffer.isBuffer(call.internalPubkey)).toBe(true);
      // pubkey.slice(2) = "aabbccdd"
      expect(call.internalPubkey.toString("hex")).toBe("aabbccdd");
    });

    it("should return empty string when p2tr returns no address", async () => {
      mockP2tr.mockReturnValue({ address: undefined });
      const address = await generateP2TR(testPubkey, "testnet");
      expect(address).toBe("");
    });

    it("should return the taproot address", async () => {
      mockP2tr.mockReturnValue({ address: "tb1p_result" });
      const address = await generateP2TR(testPubkey, "testnet");
      expect(address).toBe("tb1p_result");
    });
  });

  describe("getBtcKeyPair", () => {
    beforeEach(() => {
      vi.mocked(generateWallet).mockResolvedValue(makeFakeWallet(10) as never);
      vi.mocked(generateNewAccount).mockImplementation((w: unknown) => w as never);
      vi.mocked(ecc.pointFromScalar).mockReturnValue(
        new Uint8Array([0x02, 0xaa, 0xbb, 0xcc])
      );
    });

    it("should return privateKey as a Buffer", async () => {
      const pair = await getBtcKeyPair("test mnemonic", 0);
      expect(Buffer.isBuffer(pair.privateKey)).toBe(true);
    });

    it("should return publicKey as a Buffer", async () => {
      const pair = await getBtcKeyPair("test mnemonic", 0);
      expect(Buffer.isBuffer(pair.publicKey)).toBe(true);
    });

    it("should return a privateKey of exactly 32 bytes", async () => {
      // Our fake key is 64 hex chars = 32 bytes
      const pair = await getBtcKeyPair("test mnemonic", 0);
      expect(pair.privateKey.length).toBe(32);
    });

    it("should strip compression marker (01 suffix) from 66-char key", async () => {
      // Create a wallet where the key ends with "01" and is 66 chars
      // 64 hex chars + "01" suffix = 66 chars total (compressed key marker)
      const baseKey = "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234";
      const compressedKey = baseKey + "01";
      expect(compressedKey.length).toBe(66);
      expect(compressedKey.endsWith("01")).toBe(true);

      const walletWithCompressed = {
        accounts: [{ stxPrivateKey: compressedKey }],
      };
      vi.mocked(generateWallet).mockResolvedValue(walletWithCompressed as never);

      const pair = await getBtcKeyPair("test mnemonic", 0);
      // Should be 32 bytes (64 hex chars stripped of "01")
      expect(pair.privateKey.length).toBe(32);
      expect(pair.privateKey.toString("hex")).toBe(baseKey);
    });

    it("should use full key when it does not end with 01 compression marker", async () => {
      // 64-char key (no compression marker)
      const normalKey = "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234";
      expect(normalKey.length).toBe(64);

      const walletWithNormal = {
        accounts: [{ stxPrivateKey: normalKey }],
      };
      vi.mocked(generateWallet).mockResolvedValue(walletWithNormal as never);

      const pair = await getBtcKeyPair("test mnemonic", 0);
      expect(pair.privateKey.toString("hex")).toBe(normalKey);
    });

    it("should call ecc.pointFromScalar to derive publicKey", async () => {
      await getBtcKeyPair("test mnemonic", 0);
      expect(ecc.pointFromScalar).toHaveBeenCalledWith(expect.any(Buffer), true);
    });

    it("should call secureLog with the account index", async () => {
      await getBtcKeyPair("test mnemonic", 3);
      expect(secureLog).toHaveBeenCalledWith("Generated BTC key pair for account 3");
    });
  });
});
