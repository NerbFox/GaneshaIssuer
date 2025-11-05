/**
 * Utility functions for Verifiable Credentials encryption and signing
 * Web and React Native compatible implementation using ECIES (P-256) and aes-js
 */

import { p256 } from '@noble/curves/p256';
import { sha256, sha512 } from '@noble/hashes/sha2';
import { hmac } from '@noble/hashes/hmac';
import * as aes from 'aes-js';

/**
 * Type for JSON-serializable values
 */
type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

interface JsonObject {
  [key: string]: JsonValue;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface JsonArray extends Array<JsonValue> {}

/**
 * Get cryptographically secure random bytes
 * Works on both web (using crypto.getRandomValues) and React Native (using expo-crypto)
 */
function getRandomBytes(length: number): Uint8Array {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    // Web environment
    const buffer = new Uint8Array(length);
    window.crypto.getRandomValues(buffer);
    return buffer;
  } else if (typeof global !== 'undefined' && global.crypto && global.crypto.getRandomValues) {
    // Node.js 19+ with Web Crypto API
    const buffer = new Uint8Array(length);
    global.crypto.getRandomValues(buffer);
    return buffer;
  } else {
    // Fallback for environments without Web Crypto API
    throw new Error('No secure random number generator available');
  }
}

/**
 * Convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const cleanHex = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function uint8ArrayToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert Uint8Array to base64url string
 */
function uint8ArrayToBase64Url(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Convert base64url string to Uint8Array
 */
function base64UrlToUint8Array(base64url: string): Uint8Array {
  // Convert base64url to base64
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  // Decode base64
  const binary = atob(paddedBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * ECIES Key Derivation Function (KDF)
 * Derives encryption key and MAC key from shared secret using HKDF-like approach
 *
 * @param sharedSecret - The ECDH shared secret
 * @returns Object containing encryption key (32 bytes) and MAC key (32 bytes)
 */
function deriveECIESKeys(sharedSecret: Uint8Array): {
  encryptionKey: Uint8Array;
  macKey: Uint8Array;
} {
  // Use SHA-512 to derive 64 bytes, then split into encryption key and MAC key
  const derivedKey = sha512(sharedSecret);

  // First 32 bytes for AES-256 encryption
  const encryptionKey = derivedKey.slice(0, 32);

  // Last 32 bytes for HMAC-SHA256 authentication
  const macKey = derivedKey.slice(32, 64);

  return { encryptionKey, macKey };
}

/**
 * Compute HMAC-SHA256 authentication tag for ECIES
 *
 * @param macKey - The MAC key from KDF
 * @param ephemeralPublicKey - The ephemeral public key
 * @param iv - The initialization vector
 * @param ciphertext - The encrypted data
 * @returns HMAC authentication tag (32 bytes)
 */
function computeECIESTag(
  macKey: Uint8Array,
  ephemeralPublicKey: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array
): Uint8Array {
  // Concatenate all components for MAC computation
  const dataToAuthenticate = new Uint8Array(
    ephemeralPublicKey.length + iv.length + ciphertext.length
  );
  dataToAuthenticate.set(ephemeralPublicKey, 0);
  dataToAuthenticate.set(iv, ephemeralPublicKey.length);
  dataToAuthenticate.set(ciphertext, ephemeralPublicKey.length + iv.length);

  // Compute HMAC-SHA256
  return hmac(sha256, macKey, dataToAuthenticate);
}

/**
 * Encrypt data with issuer's public key using ECIES (Elliptic Curve Integrated Encryption Scheme)
 *
 * ECIES Components:
 * 1. Key Agreement: ECDH with P-256 curve to derive shared secret
 * 2. Key Derivation: HKDF-like function (SHA-512) to derive encryption and MAC keys
 * 3. Symmetric Encryption: AES-256-CTR with derived encryption key
 * 4. Authentication: HMAC-SHA256 with derived MAC key for integrity verification
 *
 * @param data - The data object to encrypt
 * @param publicKeyHex - Issuer's public key (P-256, uncompressed format starting with 04)
 * @returns Base64url encoded encrypted data: [Ephemeral PubKey][IV][Ciphertext][MAC Tag]
 */
export async function encryptWithPublicKey(
  data: JsonObject,
  publicKeyHex: string
): Promise<string> {
  try {
    console.log('[Encryption] Starting encryption with P-256 public key');
    console.log('[Encryption] Public key (first 20 chars):', publicKeyHex.substring(0, 20));

    // Step 1: Validate and parse the recipient's public key
    let publicKeyBytes = hexToUint8Array(publicKeyHex);
    console.log('[Encryption] Public key bytes length:', publicKeyBytes.length);
    console.log('[Encryption] First byte:', publicKeyBytes[0]);

    // Check if key is in compressed format (33 bytes, starts with 0x02 or 0x03)
    if (
      publicKeyBytes.length === 33 &&
      (publicKeyBytes[0] === 0x02 || publicKeyBytes[0] === 0x03)
    ) {
      console.log('[Encryption] Detected compressed public key, converting to uncompressed...');
      try {
        const compressedHex = uint8ArrayToHex(publicKeyBytes);
        // Use P-256 ProjectivePoint to parse compressed key, then export as uncompressed
        const point = p256.ProjectivePoint.fromHex(compressedHex);
        const uncompressedHex = point.toHex(false); // false = uncompressed
        // Convert back to Uint8Array
        publicKeyBytes = hexToUint8Array(uncompressedHex);
        console.log(
          '[Encryption] Converted to uncompressed format, length:',
          publicKeyBytes.length
        );
      } catch (conversionError) {
        console.error('[Encryption] Failed to convert compressed key:', conversionError);
        throw new Error('Failed to convert compressed public key to uncompressed format');
      }
    }

    // Validate uncompressed format (65 bytes, starts with 0x04)
    if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
      throw new Error(
        `Invalid public key format after conversion. Length: ${publicKeyBytes.length}, First byte: ${publicKeyBytes[0]}`
      );
    }

    // Step 2: Generate an ephemeral ECDH key pair using P-256
    const ephemeralPrivateKey = getRandomBytes(32);
    const ephemeralPublicKey = p256.getPublicKey(ephemeralPrivateKey, false); // false = uncompressed
    console.log('[Encryption] Ephemeral key pair generated');

    // Step 3: Derive shared secret using ECDH with P-256
    // Get the shared point on the curve
    const sharedPoint = p256.getSharedSecret(ephemeralPrivateKey, publicKeyBytes, false);
    // Use the x-coordinate as shared secret (standard ECIES approach)
    const sharedSecret = sharedPoint.slice(1, 33); // Skip 0x04 prefix, take x-coordinate
    console.log('[Encryption] Shared secret derived, length:', sharedSecret.length);

    // Step 4: Derive encryption and MAC keys using ECIES KDF
    const { encryptionKey, macKey } = deriveECIESKeys(sharedSecret);
    console.log('[Encryption] ECIES keys derived (encryption + MAC)');

    // Step 5: Convert data to bytes for encryption
    const dataString = JSON.stringify(data);
    const dataBytes = new TextEncoder().encode(dataString);
    console.log('[Encryption] Data prepared for encryption, length:', dataBytes.length);

    // Step 6: Generate random IV (16 bytes for AES-CTR)
    const iv = getRandomBytes(16);
    console.log('[Encryption] IV generated, length:', iv.length);

    // Step 7: Encrypt the data with AES-256-CTR
    const aesCtr = new aes.ModeOfOperation.ctr(
      Array.from(encryptionKey),
      new aes.Counter(Array.from(iv).slice(0, 16))
    );
    const encryptedData = aesCtr.encrypt(Array.from(dataBytes));
    console.log('[Encryption] Data encrypted with AES-256-CTR');

    // Step 8: Compute HMAC authentication tag for integrity verification
    const macTag = computeECIESTag(macKey, ephemeralPublicKey, iv, new Uint8Array(encryptedData));
    console.log('[Encryption] HMAC tag computed, length:', macTag.length);

    // Step 9: Package the encrypted data with ECIES format
    // Format: [Ephemeral Public Key (65)][IV (16)][Ciphertext][MAC Tag (32)]
    const combined = new Uint8Array(
      ephemeralPublicKey.length + iv.length + encryptedData.length + macTag.length
    );
    combined.set(ephemeralPublicKey, 0);
    combined.set(iv, ephemeralPublicKey.length);
    combined.set(encryptedData, ephemeralPublicKey.length + iv.length);
    combined.set(macTag, ephemeralPublicKey.length + iv.length + encryptedData.length);
    console.log('[Encryption] ECIES package assembled, total length:', combined.length);

    // Step 10: Encode as base64url for transmission
    const result = uint8ArrayToBase64Url(combined);
    console.log('[Encryption] ECIES encryption complete, result length:', result.length);
    return result;
  } catch (error) {
    console.error('[Encryption] Error encrypting data:', error);
    if (error instanceof Error) {
      console.error('[Encryption] Error message:', error.message);
      console.error('[Encryption] Error stack:', error.stack);
    }
    throw new Error(
      `Failed to encrypt data with ECIES: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Decrypt data with private key using ECIES (Elliptic Curve Integrated Encryption Scheme)
 *
 * ECIES Components:
 * 1. Key Agreement: ECDH with P-256 curve to derive shared secret
 * 2. Key Derivation: HKDF-like function (SHA-512) to derive encryption and MAC keys
 * 3. Authentication: Verify HMAC-SHA256 tag for integrity before decryption
 * 4. Symmetric Decryption: AES-256-CTR with derived encryption key
 *
 * @param encryptedData - Base64url encoded encrypted data
 * @param privateKeyHex - Receiver's private key (P-256)
 * @returns Decrypted data object
 */
export async function decryptWithPrivateKey(
  encryptedData: string,
  privateKeyHex: string
): Promise<JsonObject> {
  // Step 1: Decode base64url to bytes
  const combined = base64UrlToUint8Array(encryptedData);

  // Step 2: Extract ECIES components
  // Format: [Ephemeral Public Key (65)][IV (16)][Ciphertext][MAC Tag (32)]
  if (combined.length < 113) {
    // Minimum: 65 (pubkey) + 16 (IV) + 32 (MAC) = 113 bytes
    throw new Error(`Invalid ECIES data length: ${combined.length} (minimum 113 bytes)`);
  }

  const ephemeralPublicKey = combined.slice(0, 65);
  const iv = combined.slice(65, 81);
  const macTag = combined.slice(-32); // Last 32 bytes
  const ciphertext = combined.slice(81, -32); // Between IV and MAC tag

  // Validate ephemeral public key format
  if (ephemeralPublicKey.length !== 65 || ephemeralPublicKey[0] !== 0x04) {
    throw new Error('Invalid ephemeral public key format');
  }

  // Step 3: Import private key
  const privateKeyBytes = hexToUint8Array(privateKeyHex);

  // Step 4: Derive shared secret using ECDH with P-256
  const sharedPoint = p256.getSharedSecret(privateKeyBytes, ephemeralPublicKey, false);
  const sharedSecret = sharedPoint.slice(1, 33); // Skip 0x04 prefix, take x-coordinate

  // Step 5: Derive encryption and MAC keys using ECIES KDF
  const { encryptionKey, macKey } = deriveECIESKeys(sharedSecret);

  // Step 6: Verify HMAC authentication tag before decryption
  const expectedMacTag = computeECIESTag(macKey, ephemeralPublicKey, iv, ciphertext);

  // Constant-time comparison to prevent timing attacks
  let macValid = true;
  if (macTag.length !== expectedMacTag.length) {
    macValid = false;
  } else {
    for (let i = 0; i < macTag.length; i++) {
      if (macTag[i] !== expectedMacTag[i]) {
        macValid = false;
      }
    }
  }

  if (!macValid) {
    throw new Error('ECIES authentication failed: Invalid MAC tag');
  }

  // Step 7: Decrypt the data with AES-256-CTR
  const aesCtr = new aes.ModeOfOperation.ctr(
    Array.from(encryptionKey),
    new aes.Counter(Array.from(iv).slice(0, 16))
  );
  const decryptedBytes = aesCtr.decrypt(Array.from(ciphertext));

  // Step 8: Convert bytes to string and parse JSON
  const decryptedString = new TextDecoder().decode(new Uint8Array(decryptedBytes));
  const result = JSON.parse(decryptedString);
  return result;
}

/**
 * Sign data with ECDSA (P-256 and SHA-256)
 *
 * @param data - The data object to sign
 * @param privateKeyHex - Private key in hex format (P-256, 32 bytes)
 * @returns Base64url encoded signature
 */
export async function signWithES256(data: JsonObject, privateKeyHex: string): Promise<string> {
  try {
    console.log('[Signing] Starting ECDSA signature with P-256');

    // Import the private key
    const privateKeyBytes = hexToUint8Array(privateKeyHex);
    console.log('[Signing] Private key imported, length:', privateKeyBytes.length);

    // Convert data to canonical JSON string (sorted keys)
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    const dataBytes = new TextEncoder().encode(dataString);
    console.log('[Signing] Data prepared for signing, length:', dataBytes.length);

    // Hash the data with SHA-256
    const messageHash = sha256(dataBytes);
    console.log('[Signing] Data hashed');

    // Sign the hash using P-256 (returns Uint8Array with compact format: 64 bytes r + s)
    const signature = p256.sign(messageHash, privateKeyBytes);
    const signatureBytes = signature.toCompactRawBytes();
    console.log('[Signing] Data signed');

    // Convert signature to base64url
    const result = uint8ArrayToBase64Url(signatureBytes);
    console.log('[Signing] Signature complete, length:', result.length);
    return result;
  } catch (error) {
    console.error('[Signing] Error signing data:', error);
    throw new Error(
      `Failed to sign data with ECDSA P-256: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Verify ECDSA signature
 *
 * @param data - The data object that was signed
 * @param signature - Base64url encoded signature
 * @param publicKeyHex - Public key in hex format (P-256, uncompressed, starting with 04)
 * @returns True if signature is valid
 */
export async function verifySignature(
  data: JsonObject,
  signature: string,
  publicKeyHex: string
): Promise<boolean> {
  try {
    console.log('[Verify] Starting signature verification with P-256');

    // Parse public key
    const publicKeyBytes = hexToUint8Array(publicKeyHex);

    if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
      throw new Error('Invalid uncompressed public key format');
    }

    // Convert data to canonical JSON string (sorted keys)
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    const dataBytes = new TextEncoder().encode(dataString);

    // Hash the data with SHA-256
    const messageHash = sha256(dataBytes);

    // Convert signature from base64url to bytes
    const signatureBytes = base64UrlToUint8Array(signature);

    // Verify the signature using P-256
    const isValid = p256.verify(signatureBytes, messageHash, publicKeyBytes);

    console.log('[Verify] Signature verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('[Verify] Error verifying signature:', error);
    return false;
  }
}
