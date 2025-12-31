import { encodeMessage } from "@stacks/encryption";
import {
  signMessageHashRsv,
  privateKeyToPublic,
  privateKeyToAddress,
  transactionToHex,
  makeContractCall,
  broadcastTransaction,
} from "@stacks/transactions";
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
  const stxAddress = privateKeyToAddress(privateKey, "mainnet");
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

  try {
    const transaction = await makeContractCall({
      contractAddress: params.contract.split(".")[0],
      contractName: params.contract.split(".")[1],
      functionName: params.functionName,
      // @ts-ignore
      functionArgs: params.functionArgs,
      senderKey: privateKey,
      // @ts-ignore
      network: params.network,
    });

    // @ts-ignore - network type mismatch
    const broadcasted = await broadcastTransaction({
      transaction,
      // @ts-ignore
      network: params.network,
    });

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
    response = {
      jsonrpc: "2.0",
      id: payload.id,
      error: {
        code: JsonRpcErrorCode.UnknownError,
        message: "Unknown error",
        data: error instanceof Error ? error.message : "Unknown error",
      },
    };

    secureLog("Contract call failed", { error });
  }

  return {
    method: payload.method,
    status: "COMPLETE",
    data: response,
  };
}

export { handleSignMessage, handleGetAddresses, handleCallContract };
