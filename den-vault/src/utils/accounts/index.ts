import { generateNewAccount, generateWallet } from "@stacks/wallet-sdk";
import { privateKeyToAddress, privateKeyToPublic } from "@stacks/transactions";
import { c32ToB58 } from "c32check";
import { Buffer } from "buffer";
import ecc from "@bitcoinerlab/secp256k1";
import { type Account } from "../types";
import { secureLog } from "../security/logger";
import { getAddressVersion, getSelectedNetwork, type NetworkName } from "../network";

/**
 * Generate the first N accounts for the user (without private keys)
 * Private keys are derived on-demand when needed for signing
 */
async function generateInitialAccounts(
  mnemonic: string,
  count: number = 20,
  network?: NetworkName
): Promise<Account[]> {
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: "",
  });

  // Generate additional accounts
  const wallets = [wallet];
  for (let i = 0; i < count - 1; i++) {
    const newWallet = generateNewAccount(wallets[i]);
    wallets.push(newWallet);
  }

  const finalWallet = wallets[count - 1];
  const accounts: Account[] = [];
  const addressVersion = getAddressVersion(network);

  for (let index = 0; index < count; index++) {
    const path = `m/44'/5757'/0'/0/${index}`;
    const stxPrivateKey = finalWallet.accounts[index].stxPrivateKey;

    const stxAddress = privateKeyToAddress(stxPrivateKey, addressVersion);
    const btcP2PKHAddress = c32ToB58(stxAddress);
    const pubkey = privateKeyToPublic(stxPrivateKey).toString();
    const btcP2TRAddress = await generateP2TR(pubkey, network);

    // Note: We intentionally do NOT include the private key in the Account object
    accounts.push({
      index,
      path,
      stxAddress,
      btcP2PKHAddress,
      btcP2TRAddress,
      pubkey,
    });
  }

  secureLog(`Generated ${count} accounts for ${addressVersion}`);

  return accounts;
}

/**
 * Get the private key for a specific account index
 * This should only be called when signing is required
 */
async function getPrivateKey(
  mnemonic: string,
  accountIndex: number
): Promise<string> {
  let wallet = await generateWallet({
    secretKey: mnemonic,
    password: "",
  });

  // Generate accounts up to the requested index
  for (let i = 0; i < accountIndex; i++) {
    wallet = generateNewAccount(wallet);
  }

  return wallet.accounts[accountIndex].stxPrivateKey;
}

/**
 * Generate a Bitcoin P2TR (taproot) address from a public key
 * @param pubkey - The public key in hex format
 * @param network - The network to derive the address for (mainnet/testnet/devnet)
 * @returns The P2TR address (bc1p... for mainnet, tb1p... for testnet/devnet)
 */
async function generateP2TR(pubkey: string, network?: NetworkName): Promise<string> {
  // @ts-expect-error - bitcoin is a global variable injected by bitcoinjs-lib.js
  bitcoin.initEccLib(ecc);

  const selectedNetwork = network || getSelectedNetwork();
  // @ts-expect-error - bitcoin is a global variable injected by bitcoinjs-lib.js
  const btcNetwork = selectedNetwork === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

  // @ts-expect-error - bitcoin is a global variable injected by bitcoinjs-lib.js
  const taproot = bitcoin.payments.p2tr({
    internalPubkey: Buffer.from(pubkey.slice(2), "hex"),
    network: btcNetwork,
  });

  return taproot.address || "";
}

/**
 * Bitcoin key pair for signing transactions
 */
interface BtcKeyPair {
  privateKey: Buffer;
  publicKey: Buffer;
}

/**
 * Get the Bitcoin key pair for a specific account index
 * Used for signing BTC transactions (P2PKH, P2WPKH, P2TR)
 */
async function getBtcKeyPair(
  mnemonic: string,
  accountIndex: number
): Promise<BtcKeyPair> {
  // Get the STX private key (which is used for BTC as well)
  const stxPrivateKey = await getPrivateKey(mnemonic, accountIndex);

  // The stxPrivateKey is a hex string with optional "01" suffix (compressed marker)
  // Remove the compression byte if present
  let keyHex = stxPrivateKey;
  if (keyHex.length === 66 && keyHex.endsWith("01")) {
    keyHex = keyHex.slice(0, 64);
  }

  const privateKey = Buffer.from(keyHex, "hex");

  // Derive public key from private key using secp256k1
  const publicKey = Buffer.from(ecc.pointFromScalar(privateKey, true)!);

  secureLog(`Generated BTC key pair for account ${accountIndex}`);

  return {
    privateKey,
    publicKey,
  };
}

export { generateInitialAccounts, generateP2TR, getPrivateKey, getBtcKeyPair };
