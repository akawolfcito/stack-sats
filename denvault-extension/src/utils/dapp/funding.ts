/**
 * Whether the signing account can pay for what it is about to approve.
 *
 * A contract deploy was approved from an account holding nothing. The
 * wallet took it, the node refused it, and the screen said nothing. The
 * balance was knowable before the PIN was ever asked for.
 *
 * The rule that matters most here is the one about what must never be
 * blocked. Signing a message costs no gas, so an empty account has every
 * right to sign a login challenge. Any future "check the balance" placed
 * generically in the confirmation flow would break stx_signMessage for
 * everyone holding zero, so the classification lives here, in the open,
 * with tests that fail if someone widens it.
 */

/** What paying for an operation involves. */
export type FundingNeed =
  /** Costs nothing. Never blocked, never warned about. */
  | "none"
  /** Costs a fee. Blocked when the account cannot cover it. */
  | "fee"
  /** Costs a fee plus the amount being moved. */
  | "fee-and-amount"
  /** Costs nothing now, but will when someone broadcasts it. Warn only. */
  | "deferred";

const NEEDS: Record<string, FundingNeed> = {
  getAddresses: "none",
  stx_getAddresses: "none",
  stx_getAccounts: "none",
  stx_getNetworks: "none",
  // Signing is not spending. An account at zero signs a login message.
  stx_signMessage: "none",
  stx_signStructuredMessage: "none",
  // Signing a transaction is not broadcasting it, so it is not blocked.
  // Whoever sends it later does need the balance, which is worth saying.
  stx_signTransaction: "deferred",
  stx_transferStx: "fee-and-amount",
  stx_transferSip10Ft: "fee",
  stx_callContract: "fee",
  stx_deployContract: "fee",
};

/**
 * What the method costs. Unknown methods are treated as costing a fee,
 * because a new spending method that slips through unchecked is a worse
 * failure than one warned about needlessly.
 */
export function fundingNeed(method: string): FundingNeed {
  return NEEDS[method] ?? "fee";
}

export interface FundingRequest {
  method: string;
  /** The account's spendable balance, in microSTX. */
  balanceMicro: bigint;
  /** The estimated fee, in microSTX. */
  feeMicro: bigint;
  /** What is being moved, in microSTX, for the methods that move STX. */
  amountMicro?: bigint;
  /** True when another party pays the fee. See schemas.ts `sponsored`. */
  sponsored?: boolean;
}

export interface FundingAssessment {
  /** Total the account must hold, in microSTX. */
  requiredMicro: bigint;
  /** How far short it falls. Zero when it can pay. */
  shortfallMicro: bigint;
  /** True when Approve must not proceed. */
  blocks: boolean;
  /** True when it can go ahead but the user should know something. */
  warns: boolean;
}

const NOTHING: FundingAssessment = {
  requiredMicro: 0n,
  shortfallMicro: 0n,
  blocks: false,
  warns: false,
};

export function assessFunding(request: FundingRequest): FundingAssessment {
  const need = fundingNeed(request.method);
  if (need === "none") return NOTHING;

  // A sponsored transaction is paid for by someone else, so the fee is not
  // this account's problem. What it moves still is.
  const fee = request.sponsored ? 0n : request.feeMicro;
  const amount = need === "fee-and-amount" ? (request.amountMicro ?? 0n) : 0n;
  const required = fee + amount;

  const shortfall = required > request.balanceMicro ? required - request.balanceMicro : 0n;

  if (need === "deferred") {
    // Not this wallet's transaction to pay for yet, so it is never blocked.
    return { requiredMicro: required, shortfallMicro: shortfall, blocks: false, warns: shortfall > 0n };
  }

  return {
    requiredMicro: required,
    shortfallMicro: shortfall,
    blocks: shortfall > 0n,
    warns: false,
  };
}

/** Read an amount that may arrive as a string, a number or a bigint. */
export function toMicro(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return BigInt(value.trim());
  return 0n;
}
