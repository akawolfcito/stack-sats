import { generateNewAccount, generateWallet } from "@stacks/wallet-sdk";
import { privateKeyToAddress, privateKeyToPublic } from "@stacks/transactions";
import { c32ToB58 } from "c32check";
import { Buffer } from "buffer";
import ecc from "@bitcoinerlab/secp256k1";
import { type Account } from "../types";
import { secureLog } from "../security/logger";

/**
 * Generate the first N accounts for the user (without private keys)
 * Private keys are derived on-demand when needed for signing
 */
async function generateInitialAccounts(
  mnemonic: string,
  count: number = 20
): Promise<Account[]> {
  let wallet = await generateWallet({
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

  for (let index = 0; index < count; index++) {
    const path = `m/44'/5757'/0'/0/${index}`;
    const stxPrivateKey = finalWallet.accounts[index].stxPrivateKey;

    const stxAddress = privateKeyToAddress(stxPrivateKey, "testnet");
    const btcP2PKHAddress = c32ToB58(stxAddress);
    const pubkey = privateKeyToPublic(stxPrivateKey).toString();
    const btcP2TRAddress = await generateP2TR(pubkey);

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

  secureLog(`Generated ${count} accounts`);

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
 */
async function generateP2TR(pubkey: string): Promise<string> {
  // @ts-ignore - bitcoin is a global variable injected by bitcoinjs-lib.js
  bitcoin.initEccLib(ecc);

  // @ts-ignore
  const taproot = bitcoin.payments.p2tr({
    internalPubkey: Buffer.from(pubkey.slice(2), "hex"),
    // @ts-ignore
    network: bitcoin.networks.bitcoin,
  });

  return taproot.address || "";
}

export { generateInitialAccounts, generateP2TR, getPrivateKey };
