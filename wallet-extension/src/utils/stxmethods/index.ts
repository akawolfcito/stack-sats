import { encodeMessage } from "@stacks/encryption";
import {
  signMessageHashRsv,
  privateKeyToPublic,
  privateKeyToAddress,
  transactionToHex,
  makeContractCall,
  broadcastTransaction,
  type ClarityValue,
} from "@stacks/transactions";
import { STACKS_DEVNET, type StacksNetwork } from "@stacks/network";
import { c32ToB58 } from "c32check";
import { generateP2TR, getPrivateKey } from "../accounts";
import { hashUint8Array } from "../helpers";
import {
  type MethodResult,
  type MethodParams,
  JsonRpcErrorCode,
  JsonRpcError,
} from "@stacks/connect";
import type { JsonRpcResponse } from "@stacks/connect/dist/types/methods";
import type { JsonRpcRequest } from "@/utils/types";
import { secureLog } from "../security/logger";

/**
 * Handle stx_signMessage method
 */
async function handleSignMessage(
  payload: JsonRpcRequest,
  mnemonic: string,
  accountIndex: number
) {
  const params: MethodParams<"stx_signMessage"> = payload.params;

  // Get private key only when needed for signing
  const privateKey = await getPrivateKey(mnemonic, accountIndex);

  const LEGACY_PREFIX = "\x18Stacks Message Signing:\n";
  const encodedMessage = encodeMessage(params["message"], LEGACY_PREFIX);
  const messageHash = await hashUint8Array(encodedMessage);

  const signature = signMessageHashRsv({
    messageHash,
    privateKey,
  });

  const result: MethodResult<"stx_signMessage"> = {
    signature,
    publicKey: String(privateKeyToPublic(privateKey)),
  };

  const response: JsonRpcResponse<"stx_signMessage"> = {
    jsonrpc: "2.0",
    id: payload.id,
    result,
  };

  secureLog("Message signed", { method: payload.method });

  return {
    method: payload.method,
    status: "COMPLETE",
    data: response,
  };
}

/**
 * Handle getAddresses method
 */
async function handleGetAddresses(
  payload: JsonRpcRequest,
  mnemonic: string,
  accountIndex: number
) {
  // Get private key to derive addresses
  const privateKey = await getPrivateKey(mnemonic, accountIndex);

  const pubKey = privateKeyToPublic(privateKey).toString();
  const stxAddress = privateKeyToAddress(privateKey, "testnet");
  const btcP2PKHAddress = c32ToB58(stxAddress);
  const btcP2TRAddress = await generateP2TR(pubKey);

  const response: JsonRpcResponse<"getAddresses"> = {
    jsonrpc: "2.0",
    id: payload.id,
    result: {
      addresses: [
        {
          symbol: "BTC",
          address: btcP2PKHAddress,
          publicKey: pubKey,
        },
        {
          symbol: "BTC",
          address: btcP2TRAddress,
          publicKey: pubKey,
        },
        {
          symbol: "STX",
          address: stxAddress,
          publicKey: pubKey,
        },
      ],
    },
  };

  secureLog("Addresses retrieved", { method: "getAddresses" });

  return {
    method: "getAddresses",
    status: "COMPLETE",
    data: response,
  };
}

/**
 * Build network config for @stacks/transactions from connect params
 */
function buildNetworkConfig(networkParams: {
  chainId?: number;
  client?: { baseUrl?: string };
}): StacksNetwork {
  // Extract baseUrl from the network params
  const baseUrl = networkParams?.client?.baseUrl;

  if (!baseUrl) {
    // Default to devnet if no baseUrl provided
    return STACKS_DEVNET;
  }

  // Return devnet config with custom client baseUrl
  return {
    ...STACKS_DEVNET,
    client: { baseUrl },
  };
}

/**
 * Handle stx_callContract method
 */
async function handleCallContract(
  payload: JsonRpcRequest,
  mnemonic: string,
  accountIndex: number
) {
  const params: MethodParams<"stx_callContract"> = payload.params;

  // Get private key only when needed for signing
  const privateKey = await getPrivateKey(mnemonic, accountIndex);

  let response: JsonRpcResponse<"stx_callContract"> | JsonRpcError;

  // Build proper network config
  const network = buildNetworkConfig(
    params.network as { chainId?: number; client?: { baseUrl?: string } }
  );

  // Log network config for debugging
  console.log("[StacksWallet] Contract call params:", {
    contract: params.contract,
    functionName: params.functionName,
    network,
  });

  try {
    console.log("[StacksWallet] Creating transaction...");

    // Parse contract address and name
    const [contractAddress, contractName] = params.contract.split(".");

    // Process functionArgs - they come as ClarityValues from @stacks/connect
    const functionArgs: ClarityValue[] = Array.isArray(params.functionArgs)
      ? (params.functionArgs as ClarityValue[])
      : [];

    const transaction = await makeContractCall({
      contractAddress,
      contractName,
      functionName: params.functionName,
      functionArgs,
      senderKey: privateKey,
      network,
      fee: 10000n, // Fixed fee for devnet (0.01 STX)
    });

    console.log("[StacksWallet] Broadcasting transaction...");
    const broadcasted = await broadcastTransaction({
      transaction,
      network,
    });
    console.log("[StacksWallet] Broadcast result:", broadcasted);

    response = {
      jsonrpc: "2.0",
      id: payload.id,
      result: {
        txid: broadcasted.txid,
        transaction: transactionToHex(transaction),
      },
    };

    secureLog("Contract called", {
      method: payload.method,
      contract: params.contract,
      function: params.functionName,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[StacksWallet] Contract call error:", errorMessage, error);

    response = {
      jsonrpc: "2.0",
      id: payload.id,
      error: {
        code: JsonRpcErrorCode.UnknownError,
        message: "Unknown error",
        data: errorMessage,
      },
    };

    secureLog("Contract call failed", { error: errorMessage });
  }

  return {
    method: payload.method,
    status: "COMPLETE",
    data: response,
  };
}

export { handleSignMessage, handleGetAddresses, handleCallContract };
