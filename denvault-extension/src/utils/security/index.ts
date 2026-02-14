/**
 * Security module exports
 */

export {
  decrypt,
  deriveKey,
  encryptWithPIN,
  decryptWithPIN,
  deriveKeyFromPIN,
  generateSalt,
  isValidPIN,
  type EncryptedData,
} from "./encryption";

export {
  getOrCreateDeviceSecret,
  combineWithDeviceSecret,
} from "./device-secret";

export { sessionManager, type SessionState } from "./session";

export { LockoutManager } from "./lockout";

export {
  secureLog,
  secureWarn,
  secureError,
  devLog,
  sanitizeForLog,
  isDebugMode,
} from "./logger";

export { clearObject } from "./memory";

export { SecureBuffer } from "./secure-buffer";
