/**
 * Backup module for exporting and importing wallets
 * Exports wallet data in encrypted format (already encrypted with PIN)
 */

import { type WalletEntry } from "../wallets";
import { type EncryptedData } from "../security/encryption";
import { secureLog } from "../security/logger";

/**
 * Backup file format version
 */
export const BACKUP_VERSION = "1.0";
export const BACKUP_TYPE = "ironvault-backup";

/**
 * Backup file structure
 */
export interface BackupFile {
  version: string;
  type: string;
  exportedAt: number;
  wallet: WalletEntry;
}

/**
 * Create a backup from a wallet entry
 */
export function createBackup(wallet: WalletEntry): BackupFile {
  return {
    version: BACKUP_VERSION,
    type: BACKUP_TYPE,
    exportedAt: Date.now(),
    wallet: {
      id: wallet.id,
      name: wallet.name,
      encryptedData: wallet.encryptedData,
      createdAt: wallet.createdAt,
    },
  };
}

/**
 * Validate that data is a valid backup file
 */
export function validateBackup(data: unknown): BackupFile | null {
  if (!data || typeof data !== "object") {
    secureLog("Backup validation failed: not an object");
    return null;
  }

  const backup = data as Record<string, unknown>;

  // Check required fields
  if (backup.type !== BACKUP_TYPE) {
    secureLog("Backup validation failed: invalid type");
    return null;
  }

  if (typeof backup.version !== "string") {
    secureLog("Backup validation failed: missing version");
    return null;
  }

  if (typeof backup.exportedAt !== "number") {
    secureLog("Backup validation failed: missing exportedAt");
    return null;
  }

  // Validate wallet structure
  const wallet = backup.wallet as Record<string, unknown>;
  if (!wallet || typeof wallet !== "object") {
    secureLog("Backup validation failed: missing wallet");
    return null;
  }

  if (typeof wallet.id !== "string" || !wallet.id) {
    secureLog("Backup validation failed: invalid wallet id");
    return null;
  }

  if (typeof wallet.name !== "string") {
    secureLog("Backup validation failed: invalid wallet name");
    return null;
  }

  if (typeof wallet.createdAt !== "number") {
    secureLog("Backup validation failed: invalid wallet createdAt");
    return null;
  }

  // Validate encrypted data structure
  const encryptedData = wallet.encryptedData as Record<string, unknown>;
  if (!encryptedData || typeof encryptedData !== "object") {
    secureLog("Backup validation failed: missing encryptedData");
    return null;
  }

  if (
    typeof encryptedData.ciphertext !== "string" ||
    typeof encryptedData.iv !== "string" ||
    typeof encryptedData.salt !== "string"
  ) {
    secureLog("Backup validation failed: invalid encryptedData structure");
    return null;
  }

  // All validations passed - construct properly typed object
  const validEncryptedData: EncryptedData = {
    ciphertext: encryptedData.ciphertext as string,
    iv: encryptedData.iv as string,
    salt: encryptedData.salt as string,
  };

  return {
    version: backup.version as string,
    type: backup.type as string,
    exportedAt: backup.exportedAt as number,
    wallet: {
      id: wallet.id as string,
      name: wallet.name as string,
      encryptedData: validEncryptedData,
      createdAt: wallet.createdAt as number,
    },
  };
}

/**
 * Download backup as JSON file
 */
export function downloadBackup(backup: BackupFile, filename: string): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
  secureLog("Backup downloaded", { filename });
}

/**
 * Generate filename for backup
 */
export function generateBackupFilename(walletName: string): string {
  const sanitizedName = walletName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 20);

  const date = new Date().toISOString().split("T")[0];
  return `ironvault-backup-${sanitizedName}-${date}.json`;
}

/**
 * Parse backup file content
 */
export async function parseBackupFile(file: File): Promise<BackupFile | null> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    return validateBackup(data);
  } catch (error) {
    secureLog("Failed to parse backup file", { error: String(error) });
    return null;
  }
}
