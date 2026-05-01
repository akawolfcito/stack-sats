import { generateNewAccount, generateWallet } from "@stacks/wallet-sdk";
import { privateKeyToAddress } from "@stacks/transactions";
import { getAddressVersion, type NetworkName } from "../network";

/**
 * Node-safe STX address derivation.
 *
 * Mirrors the STX-only path used by `generateInitialAccounts` without
 * importing browser-only modules (logger / bitcoinjs-lib globals). Pass
 * `network` explicitly to avoid the `localStorage`-backed lookup in
 * `getAddressVersion`.
 */
export async function deriveStxAddress(
  mnemonic: string,
  accountIndex: number = 0,
  network?: NetworkName,
): Promise<string> {
  let wallet = await generateWallet({
    secretKey: mnemonic,
    password: "",
  });

  for (let i = 0; i < accountIndex; i++) {
    wallet = generateNewAccount(wallet);
  }

  const stxPrivateKey = wallet.accounts[accountIndex].stxPrivateKey;
  return privateKeyToAddress(stxPrivateKey, getAddressVersion(network));
}
