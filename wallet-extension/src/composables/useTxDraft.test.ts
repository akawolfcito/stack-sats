/**
 * useTxDraft Tests - V52.2
 *
 * Tests for transaction draft state management:
 * - Guard tests for invalid states (0 amount, empty recipient)
 * - State transition guards
 * - Anti double-submit protection
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useTxDraft, truncateAddress } from "./useTxDraft";

describe("useTxDraft", () => {
  beforeEach(() => {
    // Clear draft before each test
    const { clearDraft } = useTxDraft();
    clearDraft();
  });

  describe("transitionToConfirmTx guards", () => {
    it("should reject transition when recipient is empty", () => {
      const { setDraft, transitionToConfirmTx } = useTxDraft();

      setDraft({
        recipient: "",
        amountMicroStx: BigInt(1000000),
      });

      const result = transitionToConfirmTx();
      expect(result).toBe(false);
    });

    it("should reject transition when recipient is whitespace only", () => {
      const { setDraft, transitionToConfirmTx } = useTxDraft();

      setDraft({
        recipient: "   ",
        amountMicroStx: BigInt(1000000),
      });

      const result = transitionToConfirmTx();
      expect(result).toBe(false);
    });

    it("should reject transition when amount is 0", () => {
      const { setDraft, transitionToConfirmTx } = useTxDraft();

      setDraft({
        recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
        amountMicroStx: BigInt(0),
      });

      const result = transitionToConfirmTx();
      expect(result).toBe(false);
    });

    it("should reject transition when amount is negative", () => {
      const { setDraft, transitionToConfirmTx } = useTxDraft();

      setDraft({
        recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
        amountMicroStx: BigInt(-1000000),
      });

      const result = transitionToConfirmTx();
      expect(result).toBe(false);
    });

    it("should allow transition when recipient and amount are valid", () => {
      const { setDraft, transitionToConfirmTx, draft } = useTxDraft();

      setDraft({
        recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
        amountMicroStx: BigInt(1000000),
      });

      const result = transitionToConfirmTx();
      expect(result).toBe(true);
      expect(draft.step).toBe("confirmTx");
      expect(draft.status).toBe("idle");
    });
  });

  describe("transitionToConfirmPin guards", () => {
    it("should reject transition when not in confirmTx step", () => {
      const { setDraft, transitionToConfirmPin, draft } = useTxDraft();

      // Start in form step
      expect(draft.step).toBe("form");

      const result = transitionToConfirmPin();
      expect(result).toBe(false);
    });

    it("should allow transition from confirmTx step", () => {
      const { setDraft, transitionToConfirmTx, transitionToConfirmPin, draft } =
        useTxDraft();

      setDraft({
        recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
        amountMicroStx: BigInt(1000000),
      });

      transitionToConfirmTx();
      expect(draft.step).toBe("confirmTx");

      const result = transitionToConfirmPin();
      expect(result).toBe(true);
      expect(draft.step).toBe("confirmPin");
    });
  });

  describe("transitionToSubmitting guards (anti double-submit)", () => {
    it("should reject transition when not in confirmPin step", () => {
      const { setDraft, transitionToSubmitting, draft } = useTxDraft();

      expect(draft.step).toBe("form");

      const result = transitionToSubmitting();
      expect(result).toBe(false);
    });

    it("should reject transition when already pending", () => {
      const {
        setDraft,
        transitionToConfirmTx,
        transitionToConfirmPin,
        transitionToSubmitting,
        draft,
      } = useTxDraft();

      setDraft({
        recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
        amountMicroStx: BigInt(1000000),
      });

      transitionToConfirmTx();
      transitionToConfirmPin();

      // First submission should succeed
      const firstResult = transitionToSubmitting();
      expect(firstResult).toBe(true);
      expect(draft.step).toBe("submitting");
      expect(draft.status).toBe("pending");

      // Second submission should be rejected (anti double-submit)
      const secondResult = transitionToSubmitting();
      expect(secondResult).toBe(false);
    });

    it("should allow transition from confirmPin step when idle", () => {
      const {
        setDraft,
        transitionToConfirmTx,
        transitionToConfirmPin,
        transitionToSubmitting,
        draft,
      } = useTxDraft();

      setDraft({
        recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
        amountMicroStx: BigInt(1000000),
      });

      transitionToConfirmTx();
      transitionToConfirmPin();

      const result = transitionToSubmitting();
      expect(result).toBe(true);
      expect(draft.step).toBe("submitting");
      expect(draft.status).toBe("pending");
    });
  });

  describe("isValidForConfirmTx computed", () => {
    it("should be false when recipient is empty", () => {
      const { setDraft, isValidForConfirmTx } = useTxDraft();

      setDraft({
        recipient: "",
        amountMicroStx: BigInt(1000000),
        senderAddress: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
      });

      expect(isValidForConfirmTx.value).toBe(false);
    });

    it("should be false when amount is 0", () => {
      const { setDraft, isValidForConfirmTx } = useTxDraft();

      setDraft({
        recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
        amountMicroStx: BigInt(0),
        senderAddress: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
      });

      expect(isValidForConfirmTx.value).toBe(false);
    });

    it("should be false when sender address is empty", () => {
      const { setDraft, isValidForConfirmTx } = useTxDraft();

      setDraft({
        recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
        amountMicroStx: BigInt(1000000),
        senderAddress: "",
      });

      expect(isValidForConfirmTx.value).toBe(false);
    });

    it("should be true when all required fields are valid", () => {
      const { setDraft, isValidForConfirmTx } = useTxDraft();

      setDraft({
        recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
        amountMicroStx: BigInt(1000000),
        senderAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      });

      expect(isValidForConfirmTx.value).toBe(true);
    });
  });

  describe("isSubmitting computed", () => {
    it("should be true when step is submitting", () => {
      const {
        setDraft,
        transitionToConfirmTx,
        transitionToConfirmPin,
        transitionToSubmitting,
        isSubmitting,
      } = useTxDraft();

      setDraft({
        recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
        amountMicroStx: BigInt(1000000),
      });

      transitionToConfirmTx();
      transitionToConfirmPin();
      transitionToSubmitting();

      expect(isSubmitting.value).toBe(true);
    });

    it("should be true when status is pending", () => {
      const { setDraft, setResult, isSubmitting, draft } = useTxDraft();

      setDraft({
        recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
        amountMicroStx: BigInt(1000000),
        step: "submitting",
        status: "idle",
      });

      setResult("0x123abc");
      expect(draft.status).toBe("pending");
      expect(isSubmitting.value).toBe(true);
    });

    it("should be false when idle in form step", () => {
      const { isSubmitting, draft } = useTxDraft();

      expect(draft.step).toBe("form");
      expect(draft.status).toBe("idle");
      expect(isSubmitting.value).toBe(false);
    });
  });

  describe("setResult and setError", () => {
    it("should set result and transition to pending status", () => {
      const { setResult, draft } = useTxDraft();

      setResult("0x123abc456def");

      expect(draft.txid).toBe("0x123abc456def");
      expect(draft.error).toBe("");
      expect(draft.step).toBe("result");
      expect(draft.status).toBe("pending");
    });

    it("should set error and transition to error status", () => {
      const { setError, draft } = useTxDraft();

      setError("Insufficient balance");

      expect(draft.txid).toBe("");
      expect(draft.error).toBe("Insufficient balance");
      expect(draft.step).toBe("result");
      expect(draft.status).toBe("error");
    });
  });

  describe("setConfirmed", () => {
    it("should transition status to confirmed", () => {
      const { setResult, setConfirmed, draft } = useTxDraft();

      setResult("0x123abc");
      expect(draft.status).toBe("pending");

      setConfirmed();
      expect(draft.status).toBe("confirmed");
    });
  });

  describe("clearDraft", () => {
    it("should reset all state to initial values", () => {
      const { setDraft, setResult, clearDraft, draft } = useTxDraft();

      setDraft({
        recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
        amountMicroStx: BigInt(1000000),
        memo: "Test memo",
      });
      setResult("0x123abc");

      clearDraft();

      expect(draft.recipient).toBe("");
      expect(draft.amountMicroStx).toBe(BigInt(0));
      expect(draft.memo).toBe("");
      expect(draft.txid).toBe("");
      expect(draft.step).toBe("form");
      expect(draft.status).toBe("idle");
    });
  });
});

describe("truncateAddress", () => {
  it("should return address unchanged if 16 chars or less", () => {
    expect(truncateAddress("1234567890123456")).toBe("1234567890123456");
    expect(truncateAddress("short")).toBe("short");
    expect(truncateAddress("")).toBe("");
  });

  it("should truncate long addresses to 8...8 format", () => {
    const address = "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5";
    expect(truncateAddress(address)).toBe("ST1SJ3DT...2ZQ8YPD5");
  });

  it("should handle null/undefined gracefully", () => {
    expect(truncateAddress(null as unknown as string)).toBe(null);
    expect(truncateAddress(undefined as unknown as string)).toBe(undefined);
  });
});
