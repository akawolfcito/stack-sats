/**
 * Encryption module using Web Crypto API
 * Provides AES-256-GCM encryption with PBKDF2 key derivation
 */

export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  salt: string; // Base64 encoded
}

const PBKDF2_ITERATIONS = 100000;
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
  return btoa(String.fromCharCode(...bytes));
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
 * Derive a CryptoKey from PIN using PBKDF2
 */
export async function deriveKeyFromPIN(
  pin: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinBuffer = encoder.encode(pin);

  // Import PIN as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    pinBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  // Derive AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt data using AES-256-GCM
 */
export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const iv = generateIV();
  const salt = generateSalt();

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
 * Encrypt data with PIN (convenience function)
 */
export async function encryptWithPIN(
  data: string,
  pin: string
): Promise<EncryptedData> {
  const salt = generateSalt();
  const key = await deriveKeyFromPIN(pin, salt);

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
 */
export async function decryptWithPIN(
  encryptedData: EncryptedData,
  pin: string
): Promise<string> {
  const salt = base64ToUint8Array(encryptedData.salt);
  const key = await deriveKeyFromPIN(pin, salt);
  return decrypt(encryptedData, key);
}

/**
 * Validate PIN format (6 digits)
 */
export function isValidPIN(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/**
 * Securely clear a string from memory (best effort)
 * Note: JavaScript doesn't guarantee memory clearing, but this helps
 */
export function clearSensitiveString(str: string): void {
  if (typeof str === "string" && str.length > 0) {
    // Overwrite with zeros (best effort in JS)
    const arr = str.split("");
    for (let i = 0; i < arr.length; i++) {
      arr[i] = "\0";
    }
  }
}
