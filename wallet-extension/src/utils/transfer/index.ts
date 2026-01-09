/**
 * STX Transfer module
 * Handles building, signing, and broadcasting STX transfers
 */

import {
  makeSTXTokenTransfer,
  broadcastTransaction,
} from "@stacks/transactions";
import {
  type NetworkName,
  getNetworkConfig,
  NETWORKS,
} from "../network";
import { scheduleCleanup } from "../security/memory";
import { secureLog } from "../security/logger";

/**
 * Fee for STX transfers (0.01 STX = 10000 microSTX)
 */
export const TRANSFER_FEE_MICRO_STX = 10000n;

/**
 * Parameters for STX transfer
 */
export interface TransferParams {
  recipient: string;
  amountMicroStx: bigint;
  memo?: string;
  senderKey: string;
  network: NetworkName;
}

/**
 * Result of STX transfer
 */
export interface TransferResult {
  success: boolean;
  txid?: string;
  error?: string;
}

/**
 * Execute an STX transfer
 */
export async function transferStx(params: TransferParams): Promise<TransferResult> {
  let senderKey: string | null = params.senderKey;

  try {
    const networkConfig = getNetworkConfig(params.network);

    secureLog("Starting STX transfer", {
      recipient: params.recipient,
      amount: params.amountMicroStx.toString(),
      network: params.network,
    });

    const transaction = await makeSTXTokenTransfer({
      recipient: params.recipient,
      amount: params.amountMicroStx,
      memo: params.memo,
      senderKey,
      network: networkConfig,
      fee: TRANSFER_FEE_MICRO_STX,
    });

    const result = await broadcastTransaction({
      transaction,
      network: networkConfig,
    });

    secureLog("STX transfer successful", { txid: result.txid });

    return {
      success: true,
      txid: result.txid,
    };
  } catch (error) {
    const rawError = error instanceof Error ? error.message : String(error);

    // Build descriptive error message with context
    let errorMessage = rawError;

    // Detect common error types and provide helpful messages
    if (rawError.includes("NotEnoughFunds") || rawError.includes("insufficient")) {
      errorMessage = `Insufficient funds to transfer ${formatStxDisplay(microStxToStx(params.amountMicroStx))} STX (plus ${formatStxDisplay(microStxToStx(TRANSFER_FEE_MICRO_STX))} STX fee)`;
    } else if (rawError.includes("BadNonce") || rawError.includes("nonce")) {
      errorMessage = `Transaction nonce error. Please try again in a few seconds.`;
    } else if (rawError.includes("InvalidAddress") || rawError.includes("address")) {
      errorMessage = `Invalid recipient address: ${params.recipient.slice(0, 10)}...`;
    } else if (rawError.includes("Network") || rawError.includes("fetch") || rawError.includes("ECONNREFUSED")) {
      errorMessage = `Network error on ${params.network}. Please check your connection and try again.`;
    } else if (rawError.includes("broadcast") || rawError.includes("rejected")) {
      errorMessage = `Transaction rejected by network (${params.network}): ${rawError}`;
    }

    secureLog("STX transfer failed", {
      error: rawError,
      recipient: params.recipient.slice(0, 10) + "...",
      amount: params.amountMicroStx.toString(),
      network: params.network,
    });

    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    // Clear sensitive data from memory
    senderKey = null;
    scheduleCleanup();
  }
}

/**
 * Validation result with optional error message
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate STX address format with detailed error messages
 * Stacks addresses use c32check encoding (not base58)
 * c32 alphabet: 0123456789ABCDEFGHJKMNPQRSTVWXYZ (no I, L, O, U)
 */
export function validateStxAddressWithError(address: string, network: NetworkName): ValidationResult {
  if (!address || typeof address !== "string") {
    return { valid: false, error: "Address is required" };
  }

  const prefix = NETWORKS[network].addressPrefix;
  const trimmed = address.trim().toUpperCase();

  if (trimmed.length === 0) {
    return { valid: false, error: "Address cannot be empty" };
  }

  // STX addresses are typically 41-42 characters
  if (trimmed.length < 39) {
    return {
      valid: false,
      error: `Address too short (${trimmed.length} chars). STX addresses are 39-42 characters.`,
    };
  }

  if (trimmed.length > 42) {
    return {
      valid: false,
      error: `Address too long (${trimmed.length} chars). STX addresses are 39-42 characters.`,
    };
  }

  if (!trimmed.startsWith(prefix)) {
    const expectedPrefix = network === "mainnet" ? "SP" : "ST";
    const gotPrefix = trimmed.slice(0, 2);
    return {
      valid: false,
      error: `Invalid prefix "${gotPrefix}" for ${network}. Expected "${expectedPrefix}".`,
    };
  }

  // Check for valid c32 characters (no I, L, O, U)
  const validC32Chars = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]+$/;
  const addressBody = trimmed.slice(2);

  if (!validC32Chars.test(addressBody)) {
    // Find invalid characters
    const invalidChars = addressBody.split("").filter((c) => !/[0123456789ABCDEFGHJKMNPQRSTVWXYZ]/.test(c));
    return {
      valid: false,
      error: `Invalid characters in address: "${invalidChars.join(", ")}". STX addresses cannot contain I, L, O, or U.`,
    };
  }

  return { valid: true };
}

/**
 * Validate STX address format (simple boolean version)
 * Use validateStxAddressWithError for detailed error messages
 */
export function validateStxAddress(address: string, network: NetworkName): boolean {
  return validateStxAddressWithError(address, network).valid;
}

/**
 * Result of parsing STX amount
 */
export interface ParseAmountResult {
  success: boolean;
  amount: bigint;
  error?: string;
}

/**
 * Convert STX amount (string with decimals) to microSTX with validation
 * Returns detailed error messages for invalid input
 */
export function parseStxAmount(stx: string): ParseAmountResult {
  if (!stx || stx.trim() === "") {
    return { success: false, amount: 0n, error: "Amount is required" };
  }

  const trimmed = stx.trim();

  // Handle negative numbers
  if (trimmed.startsWith("-")) {
    return { success: false, amount: 0n, error: "Amount cannot be negative" };
  }

  // Check for multiple decimal points
  if ((trimmed.match(/\./g) || []).length > 1) {
    return { success: false, amount: 0n, error: "Invalid amount format: multiple decimal points" };
  }

  const [whole, decimal = ""] = trimmed.split(".");

  // Validate whole part
  if (!/^\d+$/.test(whole)) {
    return { success: false, amount: 0n, error: `Invalid amount: "${whole}" is not a valid number` };
  }

  // Validate decimal part (if present)
  if (decimal && !/^\d+$/.test(decimal)) {
    return { success: false, amount: 0n, error: `Invalid decimal part: "${decimal}"` };
  }

  // Warn about precision loss (more than 6 decimals)
  if (decimal.length > 6) {
    // Still process but truncate
  }

  // Pad or truncate decimal to 6 places
  const paddedDecimal = decimal.padEnd(6, "0").slice(0, 6);
  const amount = BigInt(whole + paddedDecimal);

  return { success: true, amount };
}

/**
 * Convert STX amount (string with decimals) to microSTX (bigint)
 * Returns 0n for invalid input. Use parseStxAmount for error details.
 * Example: "10.5" -> 10500000n
 */
export function stxToMicroStx(stx: string): bigint {
  const result = parseStxAmount(stx);
  return result.amount;
}

/**
 * Convert microSTX (bigint or string) to STX string with decimals
 * Example: 10500000n -> "10.500000"
 */
export function microStxToStx(microStx: string | bigint): string {
  const micro = BigInt(microStx);

  if (micro < 0n) {
    return "0.000000";
  }

  const whole = micro / 1000000n;
  const decimal = micro % 1000000n;

  return `${whole}.${decimal.toString().padStart(6, "0")}`;
}

/**
 * Format STX for display (removes trailing zeros)
 * Example: "10.500000" -> "10.5"
 */
export function formatStxDisplay(stx: string): string {
  const [whole, decimal] = stx.split(".");

  if (!decimal || decimal === "000000") {
    return whole;
  }

  // Remove trailing zeros
  const trimmedDecimal = decimal.replace(/0+$/, "");

  if (!trimmedDecimal) {
    return whole;
  }

  return `${whole}.${trimmedDecimal}`;
}

/**
 * Check if amount is valid for transfer (positive and <= balance)
 */
export function isValidAmount(
  amountMicroStx: bigint,
  balanceMicroStx: bigint
): { valid: boolean; error?: string } {
  if (amountMicroStx <= 0n) {
    return { valid: false, error: "Amount must be greater than 0" };
  }

  const totalRequired = amountMicroStx + TRANSFER_FEE_MICRO_STX;

  if (totalRequired > balanceMicroStx) {
    return {
      valid: false,
      error: `Insufficient balance. Need ${formatStxDisplay(microStxToStx(totalRequired))} STX (including fee)`,
    };
  }

  return { valid: true };
}
