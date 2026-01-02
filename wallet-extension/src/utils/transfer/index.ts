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
    const errorMessage = error instanceof Error ? error.message : String(error);
    secureLog("STX transfer failed", { error: errorMessage });

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
 * Validate STX address format
 */
export function validateStxAddress(address: string, network: NetworkName): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  const prefix = NETWORKS[network].addressPrefix;
  const trimmed = address.trim();

  // STX addresses are typically 41-42 characters
  // Format: [SP|ST] + 33-34 alphanumeric characters
  if (trimmed.length < 39 || trimmed.length > 42) {
    return false;
  }

  if (!trimmed.startsWith(prefix)) {
    return false;
  }

  // Check for valid base58 characters (no 0, O, I, l)
  const validChars = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  return validChars.test(trimmed.slice(2));
}

/**
 * Convert STX amount (string with decimals) to microSTX (bigint)
 * Example: "10.5" -> 10500000n
 */
export function stxToMicroStx(stx: string): bigint {
  if (!stx || stx.trim() === "") {
    return 0n;
  }

  const trimmed = stx.trim();

  // Handle negative numbers
  if (trimmed.startsWith("-")) {
    return 0n;
  }

  const [whole, decimal = ""] = trimmed.split(".");

  // Validate whole part
  if (!/^\d+$/.test(whole)) {
    return 0n;
  }

  // Validate decimal part (if present)
  if (decimal && !/^\d+$/.test(decimal)) {
    return 0n;
  }

  // Pad or truncate decimal to 6 places
  const paddedDecimal = decimal.padEnd(6, "0").slice(0, 6);

  return BigInt(whole + paddedDecimal);
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
