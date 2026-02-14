/**
 * Mock Wallet Fixture for UI Snapshots
 *
 * Provides pre-computed encrypted wallet data for visual regression tests.
 * This allows the harness to capture real Home/Send/Receive screens without
 * manual PIN entry.
 *
 * The mnemonic is a well-known testnet mnemonic - NEVER use in production.
 */

// Well-known testnet mnemonic (DO NOT use for real funds)
export const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Test PIN for encryption
export const TEST_PIN = '123456';

/**
 * Pre-computed encrypted wallet data
 * Generated with: encryptWithPIN(TEST_MNEMONIC, TEST_PIN)
 *
 * This is deterministic for the given mnemonic/PIN combination.
 * If you need to regenerate, run the generateMockWalletData() function
 * in a browser console with the encryption module loaded.
 */
export const MOCK_ENCRYPTED_WALLET = {
  // These values are pre-computed - see generateMockWalletData() below
  ciphertext: '', // Will be populated at runtime in setup function
  iv: '',
  salt: '',
};

/**
 * Mock VaultState structure matching src/utils/security/vault.ts
 */
export interface MockVaultEntry {
  id: string;
  name: string;
  encryptedData: {
    ciphertext: string;
    iv: string;
    salt: string;
  };
  createdAt: number;
  version: number;
}

export interface MockVaultState {
  entries: MockVaultEntry[];
  activeId: string | null;
  version: number;
}

/**
 * Generate encrypted wallet data at runtime using Web Crypto API
 * This runs in the browser context (Playwright page.evaluate)
 */
export async function generateEncryptedWallet(
  mnemonic: string,
  pin: string
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const PBKDF2_ITERATIONS = 100000;
  const SALT_LENGTH = 16;
  const IV_LENGTH = 12;

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from PIN using PBKDF2
  const encoder = new TextEncoder();
  const pinBuffer = encoder.encode(pin);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Encrypt mnemonic
  const dataBuffer = encoder.encode(mnemonic);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    dataBuffer
  );

  // Convert to base64
  const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
    iv: uint8ArrayToBase64(iv),
    salt: uint8ArrayToBase64(salt),
  };
}

/**
 * Create a complete mock VaultState ready for injection into localStorage
 */
export function createMockVaultState(encryptedData: {
  ciphertext: string;
  iv: string;
  salt: string;
}): MockVaultState {
  const walletId = 'vault_snapshot_test_wallet';

  return {
    entries: [
      {
        id: walletId,
        name: 'Snapshot Test Wallet',
        encryptedData,
        createdAt: Date.now(),
        version: 1,
      },
    ],
    activeId: walletId,
    version: 1,
  };
}

/**
 * Storage keys used by the wallet
 */
export const STORAGE_KEYS = {
  VAULT: 'wallet_vault',
  SNAPSHOT_MODE: '__UI_SNAPSHOT_MODE__',
  SNAPSHOT_MNEMONIC: '__UI_SNAPSHOT_MNEMONIC__',
} as const;
