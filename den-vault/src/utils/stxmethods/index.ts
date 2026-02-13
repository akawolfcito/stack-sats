import { encodeMessage } from "@stacks/encryption";
import {
  signMessageHashRsv,
  privateKeyToPublic,
  privateKeyToAddress,
  transactionToHex,
  makeContractCall,
  makeContractDeploy,
  makeSTXTokenTransfer,
  broadcastTransaction,
  signStructuredData,
  type ClarityValue,
} from "@stacks/transactions";
import {
  buildNetworkWithClient,
  getSelectedNetwork,
  getAddressVersion,
  getNetworkConfig,
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
import { secureLog, isDebugMode } from "../security/logger";
import {
  TransferStxParamsSchema,
  CallContractParamsSchema,
  SignMessageParamsSchema,
  SignStructuredDataParamsSchema,
  DeployContractParamsSchema,
} from "./schemas";

/**
 * Default fee in microSTX (0.01 STX) used as fallback when the SDK's
 * automatic fee estimation fails (e.g., node unreachable, estimation returns 0).
 */
const DEFAULT_FEE_MICRO_STX = 10000n;

/**
 * Handle stx_signMessage method
 */
async function handleSignMessage(
  payload: JsonRpcRequest,
  mnemonic: string,
  accountIndex: number
) {
  // Validate dApp payload with Zod before processing
  const parsed = SignMessageParamsSchema.safeParse(payload.params);
  if (!parsed.success) {
    return {
      method: payload.method,
      status: "COMPLETE",
      data: {
        jsonrpc: "2.0",
        id: payload.id,
        error: {
          code: -32602,
          message: "Invalid parameters",
          data: parsed.error.flatten().fieldErrors,
        },
      },
    };
  }

  const params = payload.params as MethodParams<"stx_signMessage">;

  // Get private key only when needed for signing
  let privateKey: string | null = null;
  try {
    privateKey = await getPrivateKey(mnemonic, accountIndex);

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
  } finally {
    // Clear sensitive data from memory
    privateKey = null;
  }
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
  let privateKey: string | null = null;
  try {
    privateKey = await getPrivateKey(mnemonic, accountIndex);

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
  } finally {
    // Clear sensitive data from memory
    privateKey = null;
  }
}


/**
 * Handle stx_callContract method
 */
async function handleCallContract(
  payload: JsonRpcRequest,
  mnemonic: string,
  accountIndex: number
) {
  // Validate dApp payload with Zod before processing
  const parsed = CallContractParamsSchema.safeParse(payload.params);
  if (!parsed.success) {
    return {
      method: payload.method,
      status: "COMPLETE",
      data: {
        jsonrpc: "2.0",
        id: payload.id,
        error: {
          code: -32602,
          message: "Invalid parameters",
          data: parsed.error.flatten().fieldErrors,
        },
      },
    };
  }

  const params = payload.params as MethodParams<"stx_callContract">;

  // Get private key only when needed for signing
  let privateKey: string | null = null;
  let response: JsonRpcResponse<"stx_callContract"> | JsonRpcError;

  try {
    privateKey = await getPrivateKey(mnemonic, accountIndex);

    // Build proper network config
    const network = buildNetworkWithClient(
      params.network as { chainId?: number; client?: { baseUrl?: string } }
    );

    // Debug logging only in development
    if (isDebugMode()) {
      console.log("[StacksWallet] Contract call params:", {
        contract: params.contract,
        functionName: params.functionName,
      });
    }

    // Parse contract address and name
    const [contractAddress, contractName] = params.contract.split(".");

    // Process functionArgs - they come as ClarityValues from @stacks/connect
    const functionArgs: ClarityValue[] = Array.isArray(params.functionArgs)
      ? (params.functionArgs as ClarityValue[])
      : [];

    // Omit fee to let the SDK auto-estimate via fetchFeeEstimate
    const transaction = await makeContractCall({
      contractAddress,
      contractName,
      functionName: params.functionName,
      functionArgs,
      senderKey: privateKey,
      network,
    });

    // Fallback: if fee estimation failed (returned 0), use default
    if (transaction.auth.spendingCondition.fee === 0n) {
      transaction.setFee(DEFAULT_FEE_MICRO_STX);
    }

    const broadcasted = await broadcastTransaction({
      transaction,
      network,
    });

    if (isDebugMode()) {
      console.log("[StacksWallet] Broadcast result:", broadcasted.txid);
    }

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

    if (isDebugMode()) {
      console.error("[StacksWallet] Contract call error:", errorMessage);
    }

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
  } finally {
    // Clear sensitive data from memory
    privateKey = null;
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
  // Validate dApp payload with Zod before processing
  const parsed = TransferStxParamsSchema.safeParse(payload.params);
  if (!parsed.success) {
    return {
      method: payload.method,
      status: "COMPLETE",
      data: {
        jsonrpc: "2.0",
        id: payload.id,
        error: {
          code: -32602,
          message: "Invalid parameters",
          data: parsed.error.flatten().fieldErrors,
        },
      },
    };
  }

  const params = payload.params as MethodParams<"stx_transferStx">;

  // Get private key only when needed for signing
  let privateKey: string | null = null;
  let response: JsonRpcResponse<"stx_transferStx"> | JsonRpcError;

  try {
    privateKey = await getPrivateKey(mnemonic, accountIndex);

    // Build proper network config
    const network = buildNetworkWithClient(
      params.network as { chainId?: number; client?: { baseUrl?: string } }
    );

    // Debug logging only in development
    if (isDebugMode()) {
      console.log("[StacksWallet] Transfer STX params:", {
        recipient: params.recipient,
        amount: params.amount,
      });
    }

    // Convert amount to bigint (comes as string or number from connect)
    const amount = BigInt(params.amount);

    // Omit fee to let the SDK auto-estimate via fetchFeeEstimate
    const transaction = await makeSTXTokenTransfer({
      recipient: params.recipient,
      amount,
      memo: params.memo,
      senderKey: privateKey,
      network,
    });

    // Fallback: if fee estimation failed (returned 0), use default
    if (transaction.auth.spendingCondition.fee === 0n) {
      transaction.setFee(DEFAULT_FEE_MICRO_STX);
    }

    const broadcasted = await broadcastTransaction({
      transaction,
      network,
    });

    if (isDebugMode()) {
      console.log("[StacksWallet] Broadcast result:", broadcasted.txid);
    }

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

    if (isDebugMode()) {
      console.error("[StacksWallet] Transfer STX error:", errorMessage);
    }

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
  } finally {
    // Clear sensitive data from memory
    privateKey = null;
  }

  return {
    method: payload.method,
    status: "COMPLETE",
    data: response,
  };
}

/**
 * Handle stx_signStructuredData method (SIP-018)
 *
 * Signs structured data (a ClarityValue message + domain tuple) per SIP-018.
 * The domain must be a TupleCV with keys: name (StringASCII), version (StringASCII), chain-id (UInt).
 */
async function handleSignStructuredData(
  payload: JsonRpcRequest,
  mnemonic: string,
  accountIndex: number
) {
  // Validate dApp payload with Zod before processing
  const parsed = SignStructuredDataParamsSchema.safeParse(payload.params);
  if (!parsed.success) {
    return {
      method: payload.method,
      status: "COMPLETE",
      data: {
        jsonrpc: "2.0",
        id: payload.id,
        error: {
          code: -32602,
          message: "Invalid parameters",
          data: parsed.error.flatten().fieldErrors,
        },
      },
    };
  }

  const params = payload.params as MethodParams<"stx_signStructuredMessage">;

  // Get private key only when needed for signing
  let privateKey: string | null = null;
  try {
    privateKey = await getPrivateKey(mnemonic, accountIndex);

    const signature = signStructuredData({
      message: params.message as ClarityValue,
      domain: params.domain as ClarityValue,
      privateKey,
    });

    const result: MethodResult<"stx_signStructuredMessage"> = {
      signature,
      publicKey: String(privateKeyToPublic(privateKey)),
    };

    const response: JsonRpcResponse<"stx_signStructuredMessage"> = {
      jsonrpc: "2.0",
      id: payload.id,
      result,
    };

    secureLog("Structured data signed (SIP-018)", { method: payload.method });

    return {
      method: payload.method,
      status: "COMPLETE",
      data: response,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (isDebugMode()) {
      console.error("[StacksWallet] Structured data sign error:", errorMessage);
    }

    secureLog("Structured data sign failed", { error: errorMessage });

    return {
      method: payload.method,
      status: "COMPLETE",
      data: {
        jsonrpc: "2.0",
        id: payload.id,
        error: {
          code: JsonRpcErrorCode.UnknownError,
          message: "Unknown error",
          data: errorMessage,
        },
      },
    };
  } finally {
    // Clear sensitive data from memory
    privateKey = null;
  }
}

/**
 * Handle stx_deployContract method
 *
 * Deploys a Clarity smart contract to the Stacks blockchain.
 */
async function handleDeployContract(
  payload: JsonRpcRequest,
  mnemonic: string,
  accountIndex: number
) {
  // Validate dApp payload with Zod before processing
  const parsed = DeployContractParamsSchema.safeParse(payload.params);
  if (!parsed.success) {
    return {
      method: payload.method,
      status: "COMPLETE",
      data: {
        jsonrpc: "2.0",
        id: payload.id,
        error: {
          code: -32602,
          message: "Invalid parameters",
          data: parsed.error.flatten().fieldErrors,
        },
      },
    };
  }

  const params = payload.params as MethodParams<"stx_deployContract">;

  // Get private key only when needed for signing
  let privateKey: string | null = null;
  let response: JsonRpcResponse<"stx_deployContract"> | JsonRpcError;

  try {
    privateKey = await getPrivateKey(mnemonic, accountIndex);

    // Build proper network config
    const network = buildNetworkWithClient(
      params.network as { chainId?: number; client?: { baseUrl?: string } }
    );

    // Debug logging only in development
    if (isDebugMode()) {
      console.log("[StacksWallet] Deploy contract params:", {
        name: params.name,
        codeLength: params.clarityCode.length,
        clarityVersion: params.clarityVersion,
      });
    }

    // Build deploy options
    const deployOptions: Parameters<typeof makeContractDeploy>[0] = {
      contractName: params.name,
      codeBody: params.clarityCode,
      senderKey: privateKey,
      network,
    };

    // Add clarityVersion if specified (coerce to number for ClarityVersion enum)
    if (params.clarityVersion !== undefined) {
      deployOptions.clarityVersion = Number(params.clarityVersion);
    }

    // Omit fee to let the SDK auto-estimate via fetchFeeEstimate
    const transaction = await makeContractDeploy(deployOptions);

    // Fallback: if fee estimation failed (returned 0), use default
    if (transaction.auth.spendingCondition.fee === 0n) {
      transaction.setFee(DEFAULT_FEE_MICRO_STX);
    }

    const broadcasted = await broadcastTransaction({
      transaction,
      network,
    });

    if (isDebugMode()) {
      console.log("[StacksWallet] Deploy broadcast result:", broadcasted.txid);
    }

    response = {
      jsonrpc: "2.0",
      id: payload.id,
      result: {
        txid: broadcasted.txid,
        transaction: transactionToHex(transaction),
      },
    };

    secureLog("Contract deployed", {
      method: payload.method,
      contractName: params.name,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (isDebugMode()) {
      console.error("[StacksWallet] Contract deploy error:", errorMessage);
    }

    response = {
      jsonrpc: "2.0",
      id: payload.id,
      error: {
        code: JsonRpcErrorCode.UnknownError,
        message: "Unknown error",
        data: errorMessage,
      },
    };

    secureLog("Contract deploy failed", { error: errorMessage });
  } finally {
    // Clear sensitive data from memory
    privateKey = null;
  }

  return {
    method: payload.method,
    status: "COMPLETE",
    data: response,
  };
}

export {
  handleSignMessage,
  handleGetAddresses,
  handleCallContract,
  handleTransferStx,
  handleSignStructuredData,
  handleDeployContract,
};
