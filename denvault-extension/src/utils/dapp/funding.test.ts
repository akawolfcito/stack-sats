import { describe, it, expect } from "vitest";
import { assessFunding, fundingNeed, toMicro } from "./funding";

const FEE = 180n;

describe("what must never be blocked by a balance", () => {
  // If this ever fails, someone has put a balance check where signing
  // lives. An account holding nothing has every right to sign a login
  // message, and breaking that breaks every empty account on every dApp.
  it.each(["stx_signMessage", "stx_signStructuredMessage"])(
    "%s is free, whatever the balance",
    (method) => {
      const assessment = assessFunding({ method, balanceMicro: 0n, feeMicro: FEE });

      expect(assessment.blocks).toBe(false);
      expect(assessment.warns).toBe(false);
      expect(assessment.requiredMicro).toBe(0n);
    }
  );

  it.each(["getAddresses", "stx_getAddresses", "stx_getAccounts", "stx_getNetworks"])(
    "%s costs nothing",
    (method) => {
      expect(fundingNeed(method)).toBe("none");
      expect(assessFunding({ method, balanceMicro: 0n, feeMicro: FEE }).blocks).toBe(false);
    }
  );
});

describe("operations that spend", () => {
  it("blocks a deploy the account cannot pay the fee for", () => {
    const assessment = assessFunding({
      method: "stx_deployContract",
      balanceMicro: 0n,
      feeMicro: FEE,
    });

    expect(assessment.blocks).toBe(true);
    expect(assessment.shortfallMicro).toBe(FEE);
  });

  it("lets a deploy through when the fee is covered", () => {
    const assessment = assessFunding({
      method: "stx_deployContract",
      balanceMicro: FEE,
      feeMicro: FEE,
    });

    expect(assessment.blocks).toBe(false);
    expect(assessment.shortfallMicro).toBe(0n);
  });

  it("counts the amount as well as the fee on a transfer", () => {
    const assessment = assessFunding({
      method: "stx_transferStx",
      balanceMicro: 1_000n,
      feeMicro: FEE,
      amountMicro: 1_000n,
    });

    // The balance covers the amount but not the amount plus the fee, which
    // is the case a naive check misses.
    expect(assessment.requiredMicro).toBe(1_180n);
    expect(assessment.shortfallMicro).toBe(180n);
    expect(assessment.blocks).toBe(true);
  });

  it("treats an unknown method as spending", () => {
    expect(fundingNeed("stx_somethingNew")).toBe("fee");
    expect(
      assessFunding({ method: "stx_somethingNew", balanceMicro: 0n, feeMicro: FEE }).blocks
    ).toBe(true);
  });
});

describe("sponsored transactions", () => {
  it("does not ask this account for a fee somebody else pays", () => {
    const assessment = assessFunding({
      method: "stx_callContract",
      balanceMicro: 0n,
      feeMicro: FEE,
      sponsored: true,
    });

    expect(assessment.blocks).toBe(false);
    expect(assessment.requiredMicro).toBe(0n);
  });

  it("still asks for what the transfer itself moves", () => {
    const assessment = assessFunding({
      method: "stx_transferStx",
      balanceMicro: 0n,
      feeMicro: FEE,
      amountMicro: 500n,
      sponsored: true,
    });

    expect(assessment.requiredMicro).toBe(500n);
    expect(assessment.blocks).toBe(true);
  });
});

describe("signing a transaction someone else will send", () => {
  it("warns without blocking when the balance is short", () => {
    const assessment = assessFunding({
      method: "stx_signTransaction",
      balanceMicro: 0n,
      feeMicro: FEE,
    });

    expect(assessment.blocks).toBe(false);
    expect(assessment.warns).toBe(true);
  });

  it("says nothing when the balance covers it", () => {
    const assessment = assessFunding({
      method: "stx_signTransaction",
      balanceMicro: 10_000n,
      feeMicro: FEE,
    });

    expect(assessment.warns).toBe(false);
  });
});

describe("toMicro", () => {
  it("reads the shapes an amount arrives in", () => {
    expect(toMicro(1234n)).toBe(1234n);
    expect(toMicro(1234)).toBe(1234n);
    expect(toMicro("1234")).toBe(1234n);
    expect(toMicro(" 1234 ")).toBe(1234n);
  });

  it("reads nothing as zero rather than throwing", () => {
    expect(toMicro(undefined)).toBe(0n);
    expect(toMicro(null)).toBe(0n);
    expect(toMicro("1.5")).toBe(0n);
    expect(toMicro("abc")).toBe(0n);
    expect(toMicro(Number.NaN)).toBe(0n);
  });
});
