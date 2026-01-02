/**
 * Transaction history utilities
 * Fetches and formats transaction data from Hiro API
 */

import { getSelectedNetwork, type NetworkName } from "../network";
import { secureLog } from "../security/logger";

/**
 * API base URLs for each network
 */
const API_URLS: Record<NetworkName, string> = {
  mainnet: "https://api.hiro.so",
  testnet: "https://api.testnet.hiro.so",
  devnet: "", // Will use Platform Hiro API key
};

/**
 * Get the API URL for the current or specified network
 */
function getApiUrl(network?: NetworkName): string {
  const selectedNetwork = network || getSelectedNetwork();

  if (selectedNetwork === "devnet") {
    const apiKey = import.meta.env.VITE_PLATFORM_HIRO_API_KEY;
    if (apiKey) {
      return `https://api.platform.hiro.so/v1/ext/${apiKey}/stacks-blockchain-api`;
    }
    return API_URLS.testnet;
  }

  return API_URLS[selectedNetwork];
}

/**
 * Transaction types from the API
 */
export type TransactionType =
  | "token_transfer"
  | "contract_call"
  | "smart_contract"
  | "coinbase"
  | "poison_microblock";

/**
 * Transaction status
 */
export type TransactionStatus = "success" | "pending" | "failed" | "abort_by_response" | "abort_by_post_condition";

/**
 * Simplified transaction for display
 */
export interface Transaction {
  txId: string;
  type: TransactionType;
  status: TransactionStatus;
  timestamp: number; // Unix timestamp
  sender: string;
  recipient?: string;
  amount?: string; // In microSTX
  fee: string;
  functionName?: string;
  contractId?: string;
  memo?: string;
}

/**
 * Raw transaction from API
 */
interface ApiTransaction {
  tx_id: string;
  tx_type: TransactionType;
  tx_status: TransactionStatus;
  block_time?: number;
  burn_block_time?: number;
  sender_address: string;
  fee_rate: string;
  token_transfer?: {
    recipient_address: string;
    amount: string;
    memo?: string;
  };
  contract_call?: {
    contract_id: string;
    function_name: string;
    function_args?: Array<{ repr: string }>;
  };
  smart_contract?: {
    contract_id: string;
  };
}

/**
 * API response for transactions list
 */
interface TransactionsResponse {
  limit: number;
  offset: number;
  total: number;
  results: ApiTransaction[];
}

/**
 * Transform API transaction to our simplified format
 */
function transformTransaction(tx: ApiTransaction): Transaction {
  const base: Transaction = {
    txId: tx.tx_id,
    type: tx.tx_type,
    status: tx.tx_status,
    timestamp: tx.block_time || tx.burn_block_time || Date.now() / 1000,
    sender: tx.sender_address,
    fee: tx.fee_rate,
  };

  // Add type-specific fields
  if (tx.token_transfer) {
    base.recipient = tx.token_transfer.recipient_address;
    base.amount = tx.token_transfer.amount;
    base.memo = tx.token_transfer.memo;
  }

  if (tx.contract_call) {
    base.contractId = tx.contract_call.contract_id;
    base.functionName = tx.contract_call.function_name;
  }

  if (tx.smart_contract) {
    base.contractId = tx.smart_contract.contract_id;
  }

  return base;
}

/**
 * Fetch transaction history for an address
 */
export async function fetchTransactions(
  address: string,
  limit: number = 10,
  offset: number = 0,
  network?: NetworkName
): Promise<Transaction[] | null> {
  const apiUrl = getApiUrl(network);
  const url = `${apiUrl}/extended/v1/address/${address}/transactions?limit=${limit}&offset=${offset}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      secureLog("Transactions fetch failed", { status: response.status, address });
      return null;
    }

    const data = (await response.json()) as TransactionsResponse;
    const transactions = data.results.map(transformTransaction);

    secureLog("Transactions fetched", {
      address: address.slice(0, 8) + "...",
      count: transactions.length,
    });

    return transactions;
  } catch (error) {
    secureLog("Transactions fetch error", { error: String(error) });
    return null;
  }
}

/**
 * Get human-readable transaction type
 */
export function getTransactionTypeLabel(type: TransactionType): string {
  const labels: Record<TransactionType, string> = {
    token_transfer: "Transfer",
    contract_call: "Contract Call",
    smart_contract: "Deploy Contract",
    coinbase: "Coinbase",
    poison_microblock: "Poison Microblock",
  };
  return labels[type] || type;
}

/**
 * Get status color class
 */
export function getStatusColor(status: TransactionStatus): string {
  switch (status) {
    case "success":
      return "status-success";
    case "pending":
      return "status-pending";
    case "failed":
    case "abort_by_response":
    case "abort_by_post_condition":
      return "status-failed";
    default:
      return "";
  }
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  // Format as date for older transactions
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

/**
 * Format microSTX amount for display
 */
export function formatAmount(microStx: string): string {
  const stx = Number(microStx) / 1_000_000;
  if (stx === 0) return "0";
  if (stx >= 1_000_000) return (stx / 1_000_000).toFixed(2) + "M";
  if (stx >= 1_000) return (stx / 1_000).toFixed(2) + "K";
  return stx.toFixed(stx < 1 ? 6 : 2);
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerUrl(txId: string, network?: NetworkName): string {
  const selectedNetwork = network || getSelectedNetwork();

  // Ensure txId has 0x prefix
  const formattedTxId = txId.startsWith("0x") ? txId : `0x${txId}`;

  // Build URL with proper format: /txid/0x...?chain=network
  const baseUrl = "https://explorer.hiro.so";
  const networkParam = selectedNetwork === "mainnet" ? "" : `?chain=${selectedNetwork}`;

  return `${baseUrl}/txid/${formattedTxId}${networkParam}`;
}
