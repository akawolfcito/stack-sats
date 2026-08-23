import { describe, it, expect } from "vitest";
import { describeFailure, RPC_ERROR_CODES } from "./failure";

describe("describeFailure", () => {
  it("names a missing balance as a missing balance", () => {
    const report = describeFailure(RPC_ERROR_CODES.INSUFFICIENT_FUNDS, "");

    expect(report.title).toBe("Not enough balance");
    expect(report.recoverable).toBe(true);
  });

  it("recognises the node saying it in its own words", () => {
    // What the Stacks node actually returns, without a helpful code.
    for (const message of [
      "NotEnoughFunds",
      "Transaction rejected: not_enough_funds",
      "CostTooHigh",
      "No such account",
    ]) {
      expect(describeFailure(undefined, message).title, message).toBe("Not enough balance");
    }
  });

  it("tells a pending transaction apart from a failure", () => {
    const report = describeFailure(undefined, "BadNonce: conflicting nonce in mempool");

    expect(report.title).toBe("Already in flight");
    expect(report.recoverable).toBe(true);
  });

  it("keeps the node's words when it does not recognise the reason", () => {
    const report = describeFailure(undefined, "ContractAlreadyExists");

    expect(report.title).toBe("Transaction failed");
    expect(report.detail).toContain("ContractAlreadyExists");
  });

  it("says something even when given nothing", () => {
    const report = describeFailure(undefined, "");

    expect(report.title).toBe("Transaction failed");
    expect(report.detail.length).toBeGreaterThan(0);
    expect(report.detail).not.toContain("undefined");
  });

  it("does not dress up a user rejection as a failure", () => {
    const report = describeFailure(4001, "User rejected the request");

    expect(report.title).toBe("Request rejected");
    expect(report.recoverable).toBe(false);
  });

  it("reports a bad address as something the user can fix", () => {
    const report = describeFailure(RPC_ERROR_CODES.INVALID_ADDRESS, "");

    expect(report.title).toBe("Address not valid");
    expect(report.recoverable).toBe(true);
  });
});
