import { encodeMessage } from "@stacks/encryption";
import {
  signMessageHashRsv,
  privateKeyToPublic,
  privateKeyToAddress,
  transactionToHex,
  makeContractCall,
  makeSTXTokenTransfer,
  broadcastTransaction,
  type ClarityValue,
} from "@stacks/transactions";
import type { StacksNetwork } from "@stacks/network";
import {
  buildNetworkWithClient,
  getSelectedNetwork,
  getAddressVersion,
  getNetworkConfig,
  NETWORKS,
} from "../network";
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
 * Returns addresses AND the currently selected network
 */
async function handleGetAddresses(
  payload: JsonRpcRequest,
  mnemonic: string,
  accountIndex: number
) {
  // Get the currently selected network from wallet settings
  const selectedNetwork = getSelectedNetwork();
  const addressVersion = getAddressVersion(selectedNetwork);
  const networkConfig = getNetworkConfig(selectedNetwork);

  // Get private key to derive addresses
  const privateKey = await getPrivateKey(mnemonic, accountIndex);

  const pubKey = privateKeyToPublic(privateKey).toString();
  const stxAddress = privateKeyToAddress(privateKey, addressVersion);
  const btcP2PKHAddress = c32ToB58(stxAddress);
  const btcP2TRAddress = await generateP2TR(pubKey);

  // Build response with network info
  const response = {
    jsonrpc: "2.0" as const,
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
      // Include network info so dApp knows which network wallet is using
      network: {
        name: selectedNetwork,
        chainId: networkConfig.chainId,
        client: networkConfig.client,
      },
    },
  };

  secureLog("Addresses retrieved", { method: "getAddresses", network: selectedNetwork });

  return {
    method: "getAddresses",
    status: "COMPLETE",
    data: response,
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
  const network = buildNetworkWithClient(
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

/**
 * Handle stx_transferStx method
 */
async function handleTransferStx(
  payload: JsonRpcRequest,
  mnemonic: string,
  accountIndex: number
) {
  const params: MethodParams<"stx_transferStx"> = payload.params;

  // Get private key only when needed for signing
  const privateKey = await getPrivateKey(mnemonic, accountIndex);

  let response: JsonRpcResponse<"stx_transferStx"> | JsonRpcError;

  // Build proper network config
  const network = buildNetworkWithClient(
    params.network as { chainId?: number; client?: { baseUrl?: string } }
  );

  // Log transfer params for debugging
  console.log("[StacksWallet] Transfer STX params:", {
    recipient: params.recipient,
    amount: params.amount,
    memo: params.memo,
    network,
  });

  try {
    console.log("[StacksWallet] Creating STX transfer transaction...");

    // Convert amount to bigint (comes as string or number from connect)
    const amount = BigInt(params.amount);

    const transaction = await makeSTXTokenTransfer({
      recipient: params.recipient,
      amount,
      memo: params.memo,
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

    secureLog("STX transferred", {
      method: payload.method,
      recipient: params.recipient,
      amount: params.amount,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[StacksWallet] Transfer STX error:", errorMessage, error);

    response = {
      jsonrpc: "2.0",
      id: payload.id,
      error: {
        code: JsonRpcErrorCode.UnknownError,
        message: "Unknown error",
        data: errorMessage,
      },
    };

    secureLog("STX transfer failed", { error: errorMessage });
  }

  return {
    method: payload.method,
    status: "COMPLETE",
    data: response,
  };
}

export { handleSignMessage, handleGetAddresses, handleCallContract, handleTransferStx };
