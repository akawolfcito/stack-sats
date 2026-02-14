import { describe, it, expect } from "vitest";
import {
  TransferStxParamsSchema,
  CallContractParamsSchema,
  SignMessageParamsSchema,
  GetAddressesParamsSchema,
} from "./schemas";

describe("TransferStxParamsSchema", () => {
  it("should accept valid transfer params", () => {
    const result = TransferStxParamsSchema.safeParse({
      recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      amount: "1000000",
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid transfer params with memo", () => {
    const result = TransferStxParamsSchema.safeParse({
      recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      amount: "1000000",
      memo: "test memo",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing recipient", () => {
    const result = TransferStxParamsSchema.safeParse({
      amount: "1000000",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing amount", () => {
    const result = TransferStxParamsSchema.safeParse({
      recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative amount", () => {
    const result = TransferStxParamsSchema.safeParse({
      recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      amount: "-100",
    });
    expect(result.success).toBe(false);
  });

  it("should reject zero amount", () => {
    const result = TransferStxParamsSchema.safeParse({
      recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      amount: "0",
    });
    expect(result.success).toBe(false);
  });

  it("should reject non-numeric amount", () => {
    const result = TransferStxParamsSchema.safeParse({
      recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      amount: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid address format", () => {
    const result = TransferStxParamsSchema.safeParse({
      recipient: "not-an-address",
      amount: "1000",
    });
    expect(result.success).toBe(false);
  });

  it("should reject memo longer than 34 bytes", () => {
    const result = TransferStxParamsSchema.safeParse({
      recipient: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      amount: "1000",
      memo: "x".repeat(35),
    });
    expect(result.success).toBe(false);
  });
});

describe("CallContractParamsSchema", () => {
  it("should accept valid contract call", () => {
    const result = CallContractParamsSchema.safeParse({
      contract: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-contract",
      functionName: "transfer",
      functionArgs: [],
    });
    expect(result.success).toBe(true);
  });

  it("should accept contract call with default empty args", () => {
    const result = CallContractParamsSchema.safeParse({
      contract: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-contract",
      functionName: "get-info",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.functionArgs).toEqual([]);
    }
  });

  it("should reject contract without dot separator", () => {
    const result = CallContractParamsSchema.safeParse({
      contract: "ST1PQHQKV0RJXZFY1DGX8MNSNYVEinvalid",
      functionName: "transfer",
      functionArgs: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty functionName", () => {
    const result = CallContractParamsSchema.safeParse({
      contract: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-contract",
      functionName: "",
      functionArgs: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("SignMessageParamsSchema", () => {
  it("should accept valid message", () => {
    const result = SignMessageParamsSchema.safeParse({
      message: "Hello, please sign this",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty message", () => {
    const result = SignMessageParamsSchema.safeParse({
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject oversized message (>1MB)", () => {
    const result = SignMessageParamsSchema.safeParse({
      message: "x".repeat(1_048_577),
    });
    expect(result.success).toBe(false);
  });
});

describe("GetAddressesParamsSchema", () => {
  it("should accept empty object", () => {
    const result = GetAddressesParamsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept object with extra fields (passthrough)", () => {
    const result = GetAddressesParamsSchema.safeParse({ extra: "field" });
    expect(result.success).toBe(true);
  });
});
