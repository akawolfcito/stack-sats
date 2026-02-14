/**
 * Encryption module using Web Crypto API
 * Provides AES-256-GCM encryption with PBKDF2 key derivation
 */

import { combineWithDeviceSecret } from "./device-secret";

export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  salt: string; // Base64 encoded
}

const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Generate a random IV for encryption
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Convert Uint8Array to Base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive a CryptoKey from raw key material using PBKDF2
 *
 * @param keyMaterial - Raw bytes to use as key material (e.g., combined PIN + device secret)
 * @param salt - Random salt for PBKDF2
 * @returns AES-256-GCM CryptoKey
 */
export async function deriveKey(
  keyMaterial: Uint8Array,
  salt: Uint8Array
): Promise<CryptoKey> {
  const importedKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    importedKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Derive a CryptoKey from PIN using PBKDF2
 * @deprecated Use deriveKey() with combineWithDeviceSecret() for stronger key material
 */
export async function deriveKeyFromPIN(
  pin: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinBuffer = encoder.encode(pin);
  return deriveKey(pinBuffer, salt);
}

/**
 * Encrypt data with PIN (convenience function)
 * When deviceSecret is provided, the PIN is combined with the device secret
 * to create stronger key material, making offline brute-force infeasible.
 */
export async function encryptWithPIN(
  data: string,
  pin: string,
  deviceSecret?: Uint8Array
): Promise<EncryptedData> {
  const salt = generateSalt();

  let key: CryptoKey;
  if (deviceSecret) {
    const combined = combineWithDeviceSecret(pin, deviceSecret);
    key = await deriveKey(combined, salt);
  } else {
    key = await deriveKeyFromPIN(pin, salt);
  }

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const iv = generateIV();

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    dataBuffer
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
    iv: uint8ArrayToBase64(iv),
    salt: uint8ArrayToBase64(salt),
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decrypt(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<string> {
  const ciphertext = base64ToUint8Array(encryptedData.ciphertext);
  const iv = base64ToUint8Array(encryptedData.iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Decrypt data with PIN (convenience function)
 * When deviceSecret is provided, the PIN is combined with the device secret
 * to recreate the same key material used during encryption.
 */
export async function decryptWithPIN(
  encryptedData: EncryptedData,
  pin: string,
  deviceSecret?: Uint8Array
): Promise<string> {
  const salt = base64ToUint8Array(encryptedData.salt);

  let key: CryptoKey;
  if (deviceSecret) {
    const combined = combineWithDeviceSecret(pin, deviceSecret);
    key = await deriveKey(combined, salt);
  } else {
    key = await deriveKeyFromPIN(pin, salt);
  }

  return decrypt(encryptedData, key);
}

/**
 * Validate PIN format (6 digits)
 */
export function isValidPIN(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}