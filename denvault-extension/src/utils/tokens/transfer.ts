/**
 * SIP-010 Token Transfer Module
 * Handles building, signing, and broadcasting SIP-010 token transfers
 */

import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  standardPrincipalCV,
  noneCV,
  someCV,
  bufferCV,
  PostConditionMode,
  Pc,
  type PostCondition,
} from "@stacks/transactions";
import {
  type NetworkName,
  getNetworkConfig,
} from "../network";
import { secureLog } from "../security/logger";

/**
 * Fee for token transfers (0.01 STX = 10000 microSTX)
 */
export const TOKEN_TRANSFER_FEE_MICRO_STX = 10000n;

/**
 * Parameters for SIP-010 token transfer
 */
export interface TokenTransferParams {
  contractId: string; // Format: "SP...contract-name" or "SP...contract::token"
  recipient: string;
  amount: bigint; // In base units (already multiplied by 10^decimals)
  memo?: string;
  senderKey: string;
  senderAddress: string;
  network: NetworkName;
  decimals: number;
  symbol: string;
}

/**
 * Result of token transfer
 */
export interface TokenTransferResult {
  success: boolean;
  txid?: string;
  error?: string;
}

/**
 * Parse contract ID to get address and contract name
 * Supports formats:
 * - "SP...contract-name" -> { address: "SP...", contractName: "contract-name" }
 * - "SP...contract::token" -> { address: "SP...", contractName: "contract", assetName: "token" }
 */
export function parseContractId(contractId: string): {
  address: string;
  contractName: string;
  assetName?: string;
} | null {
  // Check for asset separator "::"
  const assetSplit = contractId.split("::");
  const mainPart = assetSplit[0];
  const assetName = assetSplit[1];

  // Find the dot that separates address from contract name
  const dotIndex = mainPart.indexOf(".");
  if (dotIndex === -1) return null;

  const address = mainPart.slice(0, dotIndex);
  const contractName = mainPart.slice(dotIndex + 1);

  if (!address || !contractName) return null;

  return { address, contractName, assetName };
}

/**
 * Execute a SIP-010 token transfer
 */
export async function transferToken(params: TokenTransferParams): Promise<TokenTransferResult> {
  let senderKey: string | null = params.senderKey;

  try {
    const networkConfig = getNetworkConfig(params.network);

    const parsed = parseContractId(params.contractId);
    if (!parsed) {
      return {
        success: false,
        error: `Invalid contract ID format: ${params.contractId}`,
      };
    }

    secureLog("Starting SIP-010 transfer", {
      contract: params.contractId,
      recipient: params.recipient,
      amount: params.amount.toString(),
      network: params.network,
    });

    // Build memo CV (optional buff 34)
    const memoCV = params.memo
      ? someCV(bufferCV(Buffer.from(params.memo.slice(0, 34))))
      : noneCV();

    // Build post conditions to protect the sender
    // This ensures the transaction fails if more tokens are transferred than expected
    const postConditions: PostCondition[] = [
      Pc.principal(params.senderAddress)
        .willSendLte(params.amount)
        .ft(`${parsed.address}.${parsed.contractName}`, parsed.assetName || params.symbol.toLowerCase()),
    ];

    const transaction = await makeContractCall({
      contractAddress: parsed.address,
      contractName: parsed.contractName,
      functionName: "transfer",
      functionArgs: [
        uintCV(params.amount),
        standardPrincipalCV(params.senderAddress),
        standardPrincipalCV(params.recipient),
        memoCV,
      ],
      senderKey,
      network: networkConfig,
      fee: TOKEN_TRANSFER_FEE_MICRO_STX,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
    });

    const result = await broadcastTransaction({
      transaction,
      network: networkConfig,
    });

    secureLog("SIP-010 transfer successful", { txid: result.txid });

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
      errorMessage = `Insufficient STX balance to pay the network fee`;
    } else if (rawError.includes("BadNonce") || rawError.includes("nonce")) {
      errorMessage = `Transaction nonce error. Please try again in a few seconds.`;
    } else if (rawError.includes("InvalidAddress") || rawError.includes("address")) {
      errorMessage = `Invalid recipient address: ${params.recipient.slice(0, 10)}...`;
    } else if (rawError.includes("Network") || rawError.includes("fetch") || rawError.includes("ECONNREFUSED")) {
      errorMessage = `Network error on ${params.network}. Please check your connection and try again.`;
    } else if (rawError.includes("broadcast") || rawError.includes("rejected")) {
      errorMessage = `Transaction rejected by network (${params.network}): ${rawError}`;
    } else if (rawError.includes("PostCondition") || rawError.includes("post-condition")) {
      errorMessage = `Transaction failed post-condition check. Token balance may have changed.`;
    }

    secureLog("SIP-010 transfer failed", {
      error: rawError,
      contract: params.contractId,
      recipient: params.recipient.slice(0, 10) + "...",
      amount: params.amount.toString(),
      network: params.network,
    });

    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    // Clear sensitive data from memory
    senderKey = null;
  }
}

/**
 * Format token amount for display
 * Converts base units to human-readable format
 */
export function formatTokenAmount(amount: bigint, decimals: number): string {
  if (decimals === 0) {
    return amount.toString();
  }

  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fractional = amount % divisor;

  if (fractional === 0n) {
    return whole.toString();
  }

  const fractionalStr = fractional.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fractionalStr}`;
}

/**
 * Parse human-readable token amount to base units
 */
export function parseTokenAmount(amountStr: string, decimals: number): bigint {
  if (!amountStr || amountStr.trim() === "") {
    return 0n;
  }

  const [whole, decimal = ""] = amountStr.split(".");
  const paddedDecimal = decimal.padEnd(decimals, "0").slice(0, decimals);

  return BigInt(whole + paddedDecimal);
}
