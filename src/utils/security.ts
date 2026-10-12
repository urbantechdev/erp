/**
 * Cryptographic security utilities for staff authentication & PIN hashing.
 * Uses the Web Crypto API to ensure all staff PINs are stored as cryptographically
 * irreversible salted SHA-256 hashes inside Firestore.
 */

const PIN_CRYPTO_SALT = 'aegis-spirits-erp-secure-salt-v1';

/**
 * Computes a salted SHA-256 hash for a 6-digit staff PIN.
 * Output format: 'sha256:<hex_digest>'
 */
export async function hashPin(pin: string): Promise<string> {
  const cleanPin = pin.trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(`${PIN_CRYPTO_SALT}:${cleanPin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hexHash}`;
}

/**
 * Checks whether a given string is already in encrypted/hashed format.
 */
export function isPinHashed(pinOrHash?: string): boolean {
  if (!pinOrHash) return false;
  return (
    pinOrHash.startsWith('sha256:') ||
    pinOrHash.startsWith('$2a$') ||
    pinOrHash.startsWith('$2b$') ||
    pinOrHash.length >= 60
  );
}

/**
 * Verifies an entered plaintext PIN against the stored hash in the database.
 * Supports backward-compatibility during migration if a legacy plaintext PIN exists.
 */
export async function verifyPin(enteredPin: string, storedHashOrPin?: string): Promise<boolean> {
  if (!storedHashOrPin) return false;
  const cleanEntered = enteredPin.trim();

  // If already hashed with sha256
  if (storedHashOrPin.startsWith('sha256:')) {
    const computed = await hashPin(cleanEntered);
    return computed === storedHashOrPin;
  }

  // Fallback for legacy unmigrated plaintext records
  return storedHashOrPin === cleanEntered;
}
