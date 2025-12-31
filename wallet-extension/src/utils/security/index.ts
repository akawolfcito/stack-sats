/**
 * Security module exports
 */

export {
  encrypt,
  decrypt,
  encryptWithPIN,
  decryptWithPIN,
  deriveKeyFromPIN,
  generateSalt,
  isValidPIN,
  clearSensitiveString,
  type EncryptedData,
} from "./encryption";

export { sessionManager, type SessionState } from "./session";

export {
  secureLog,
  secureWarn,
  secureError,
  devLog,
  sanitizeForLog,
  isDebugMode,
} from "./logger";
