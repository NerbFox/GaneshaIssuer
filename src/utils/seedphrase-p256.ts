/**
 * BIP39/BIP44 Hierarchical Deterministic Wallet with P-256 NIST Curve
 *
 * This module replaces secp256k1 with P-256 (NIST P-256 / secp256r1) for:
 * - Web Crypto API compatibility
 * - Non-extractable key storage
 * - ES256 JWT signing
 *
 * Key Features:
 * - BIP39 mnemonic generation (24 words)
 * - BIP44 hierarchical deterministic key derivation
 * - P-256 elliptic curve (compatible with Web Crypto API)
 * - SubtleCrypto integration for secure key storage
 */

import BIP39_WORDLIST from '@/data/wordlist.json';

import { hmac } from '@noble/hashes/hmac.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { p256 } from '@noble/curves/nist.js'; // P-256 (NIST) instead of secp256k1

// =============================================================================
// CONSTANTS
// =============================================================================

// BIP44 derivation path constants
export const DID_PURPOSE = 44; // BIP44 standard
export const DID_COIN_TYPE = 1001; // Custom coin type for DID
export const DID_IDENTITY_PATH = 0; // m/44'/1001'/0' for DID identifier

// Hardened derivation flag (BIP32)
export const HARDENED_OFFSET = 0x80000000;

// Entropy levels for different mnemonic lengths (BIP39)
export const ENTROPY_BITS_12_WORDS = 128; // 12 words
export const ENTROPY_BITS_15_WORDS = 160; // 15 words
export const ENTROPY_BITS_18_WORDS = 192; // 18 words
export const ENTROPY_BITS_21_WORDS = 224; // 21 words
export const ENTROPY_BITS_24_WORDS = 256; // 24 words (recommended)

// DID method constants
export const DID_METHOD = 'dcert';

// P-256 curve order (for private key validation)
// P-256 order: 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551
const P256_ORDER = new Uint8Array([
  0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xbc, 0xe6, 0xfa, 0xad, 0xa7, 0x17, 0x9e, 0x84, 0xf3, 0xb9, 0xca, 0xc2, 0xfc, 0x63, 0x25, 0x51,
]);

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Cache the wordlist
let wordlistCache: string[] | null = null;

/**
 * Load BIP39 wordlist from assets
 */
export function loadWordlist(): string[] {
  if (wordlistCache) return wordlistCache;
  wordlistCache = BIP39_WORDLIST;
  return wordlistCache;
}

/**
 * Convert bytes to binary string
 */
function bytesToBinary(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(2).padStart(8, '0'))
    .join('');
}

/**
 * Calculate SHA-256 hash using Web Crypto API
 */
async function digestSha256(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return new Uint8Array(hashBuffer);
}

/**
 * Generate secure random bytes using Web Crypto API
 */
function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Compare two Uint8Arrays as big-endian unsigned integers
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareUint8Arrays(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) {
    throw new Error('Arrays must have the same length');
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/**
 * Convert Uint8Array to hexadecimal string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert hexadecimal string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// =============================================================================
// BIP39 MNEMONIC GENERATION
// =============================================================================

/**
 * Generate BIP39 mnemonic from entropy
 *
 * @param entropyBits - Entropy size in bits (128, 160, 192, 224, or 256)
 * @returns Array of mnemonic words
 */
export async function generateMnemonic(entropyBits = ENTROPY_BITS_24_WORDS): Promise<string[]> {
  // Validate entropy size
  if (![128, 160, 192, 224, 256].includes(entropyBits)) {
    throw new Error('Invalid entropy bits. Must be 128, 160, 192, 224, or 256.');
  }

  const length = entropyBits / 8;
  const entropy = getRandomBytes(length);

  // Calculate checksum
  const hash = await digestSha256(entropy);
  const checksumBits = entropyBits / 32;

  // Convert entropy to binary string
  const entropyBinary = bytesToBinary(entropy);
  const checksumBinary = bytesToBinary(hash).slice(0, checksumBits);
  const combinedBinary = entropyBinary + checksumBinary;

  // Split into 11-bit chunks and convert to word indices
  const wordlist = loadWordlist();
  const words: string[] = [];

  for (let i = 0; i < combinedBinary.length; i += 11) {
    const chunk = combinedBinary.slice(i, i + 11);
    const index = parseInt(chunk, 2);
    words.push(wordlist[index]);
  }

  return words;
}

/**
 * Validate BIP39 mnemonic
 */
export async function validateMnemonic(words: string[]): Promise<boolean> {
  const wordlist = loadWordlist();

  // Check word count
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    return false;
  }

  // Check if all words are in wordlist
  if (!words.every((word) => wordlist.includes(word))) {
    return false;
  }

  // Convert words to binary
  const binary = words
    .map((word) => {
      const index = wordlist.indexOf(word);
      return index.toString(2).padStart(11, '0');
    })
    .join('');

  const entropyBits = (words.length * 11 * 32) / 33;
  const checksumBits = entropyBits / 32;

  const entropyBinary = binary.slice(0, entropyBits);
  const checksumBinary = binary.slice(entropyBits);

  // Convert entropy binary to bytes
  const entropy = new Uint8Array(entropyBits / 8);
  for (let i = 0; i < entropy.length; i++) {
    entropy[i] = parseInt(entropyBinary.slice(i * 8, i * 8 + 8), 2);
  }

  // Calculate expected checksum
  const hash = await digestSha256(entropy);
  const expectedChecksum = bytesToBinary(hash).slice(0, checksumBits);

  return checksumBinary === expectedChecksum;
}

// =============================================================================
// BIP39 SEED GENERATION
// =============================================================================

/**
 * Generate BIP39 seed from mnemonic
 *
 * @param words - Mnemonic words
 * @param passphrase - Optional passphrase (default: empty string)
 * @returns 64-byte seed
 */
export async function generateSeedFromMnemonic(
  words: string[],
  passphrase: string = ''
): Promise<Uint8Array> {
  const mnemonic = words.join(' ');

  const encoder = new TextEncoder();
  const mnemonicBytes = encoder.encode(mnemonic.normalize('NFKD'));
  const saltBytes = encoder.encode('mnemonic' + passphrase.normalize('NFKD'));

  // BIP39 uses PBKDF2-HMAC-SHA512 with 2048 iterations
  const seed = await pbkdf2Async(sha512, mnemonicBytes, saltBytes, {
    c: 2048,
    dkLen: 64,
  });

  return seed;
}

// =============================================================================
// BIP32 KEY DERIVATION (P-256 CURVE)
// =============================================================================

/**
 * Generate master key from BIP39 seed
 *
 * @param seed - BIP39 seed (64 bytes)
 * @returns Master private key and chain code
 */
export function seedToMasterKey(seed: Uint8Array): {
  privateKey: Uint8Array;
  chainCode: Uint8Array;
} {
  const encoder = new TextEncoder();
  const key = encoder.encode('Bitcoin seed'); // BIP32 standard key (works for any curve)

  // Use HMAC-SHA512 with "Bitcoin seed" as key and seed as data
  const I = hmac(sha512, key, seed);

  // Split result into left and right halves
  const IL = I.slice(0, 32); // Master private key (256 bits)
  const IR = I.slice(32, 64); // Master chain code (256 bits)

  return {
    privateKey: IL,
    chainCode: IR,
  };
}

/**
 * BIP32 Hardened Child Key Derivation (P-256)
 *
 * Derives a hardened child key from parent key using BIP32 standard
 * Works with P-256 curve
 *
 * @param parentPrivateKey - Parent private key (32 bytes)
 * @param parentChainCode - Parent chain code (32 bytes)
 * @param index - Derivation index (must be >= 0x80000000 for hardened)
 * @returns Child private key and chain code
 */
export function deriveHardenedChildKey(
  parentPrivateKey: Uint8Array,
  parentChainCode: Uint8Array,
  index: number
): {
  privateKey: Uint8Array;
  chainCode: Uint8Array;
} {
  // Input validation
  if (!parentPrivateKey || parentPrivateKey.length !== 32) {
    throw new Error('Parent private key must be 32 bytes');
  }
  if (!parentChainCode || parentChainCode.length !== 32) {
    throw new Error('Parent chain code must be 32 bytes');
  }
  if (index < 0x80000000) {
    throw new Error('Index must be >= 0x80000000 for hardened derivation');
  }

  // For hardened derivation: data = 0x00 + parent_private_key + index
  const data = new Uint8Array(37);
  data[0] = 0x00; // Padding byte for hardened derivation
  data.set(parentPrivateKey, 1);

  // Convert index to big-endian 4-byte representation
  const indexBytes = new Uint8Array(4);
  indexBytes[0] = (index >>> 24) & 0xff;
  indexBytes[1] = (index >>> 16) & 0xff;
  indexBytes[2] = (index >>> 8) & 0xff;
  indexBytes[3] = index & 0xff;

  data.set(indexBytes, 33);

  // HMAC-SHA512(parent_chain_code, data)
  const I = hmac(sha512, parentChainCode, data);

  // Split result
  const IL = I.slice(0, 32); // Child private key
  const IR = I.slice(32, 64); // Child chain code

  // Validate the private key (must not be zero or >= P-256 order)
  const isZero = IL.every((byte: number) => byte === 0);
  if (isZero) {
    throw new Error('Invalid private key: cannot be zero');
  }

  const isTooBig = compareUint8Arrays(IL, P256_ORDER) >= 0;
  if (isTooBig) {
    throw new Error('Invalid private key: exceeds P-256 order');
  }

  return {
    privateKey: IL,
    chainCode: IR,
  };
}

/**
 * Derive signing key from seed using BIP44 derivation path
 *
 * Path: m/44'/1001'/0'/0'/{addressIndex}'
 * - All levels use hardened derivation for maximum security
 *
 * @param seed - BIP39 seed (64 bytes)
 * @param addressIndex - Address index for derivation (default: 0)
 * @returns Private key, chain code, and public key
 */
export function deriveSigningKey(
  seed: Uint8Array,
  addressIndex: number = 0
): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyHex: string;
  chainCode: Uint8Array;
} {
  // Validate address index
  if (addressIndex < 0 || !Number.isInteger(addressIndex)) {
    throw new Error('Address index must be a non-negative integer');
  }

  // Step 0: Generate master key from seed
  const { privateKey: masterPrivateKey, chainCode: masterChainCode } = seedToMasterKey(seed);

  // Step 1: m/44' (BIP44 purpose)
  const { privateKey: key1, chainCode: chain1 } = deriveHardenedChildKey(
    masterPrivateKey,
    masterChainCode,
    HARDENED_OFFSET + DID_PURPOSE
  );

  // Step 2: m/44'/1001' (DID coin type)
  const { privateKey: key2, chainCode: chain2 } = deriveHardenedChildKey(
    key1,
    chain1,
    HARDENED_OFFSET + DID_COIN_TYPE
  );

  // Step 3: m/44'/1001'/0' (Account 0)
  const { privateKey: key3, chainCode: chain3 } = deriveHardenedChildKey(
    key2,
    chain2,
    HARDENED_OFFSET + DID_IDENTITY_PATH
  );

  // Step 4: m/44'/1001'/0'/0' (Change 0)
  const { privateKey: key4, chainCode: chain4 } = deriveHardenedChildKey(
    key3,
    chain3,
    HARDENED_OFFSET + 0
  );

  // Step 5: m/44'/1001'/0'/0'/{addressIndex}' (Address index)
  const { privateKey: finalPrivateKey, chainCode: finalChainCode } = deriveHardenedChildKey(
    key4,
    chain4,
    HARDENED_OFFSET + addressIndex
  );

  // Generate P-256 public key from private key (uncompressed format for JWT verification)
  const publicKey = privateKeyToPublicKey(finalPrivateKey, false); // false = uncompressed (65 bytes)

  return {
    privateKey: finalPrivateKey,
    publicKey,
    publicKeyHex: bytesToHex(publicKey),
    chainCode: finalChainCode,
  };
}

/**
 * Derive DID identifier key from seed
 *
 * Path: m/44'/1001'/0'/1'/0' (using change level 1 for DID)
 * - Fixed at index 0 for consistent DID
 *
 * @param seed - BIP39 seed (64 bytes)
 * @returns Private key and public key for DID
 */
export function deriveDIDIdentifierKey(seed: Uint8Array): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyHex: string;
} {
  // Step 0: Generate master key from seed
  const { privateKey: masterPrivateKey, chainCode: masterChainCode } = seedToMasterKey(seed);

  // Step 1-3: Same as signing key (m/44'/1001'/0')
  const { privateKey: key1, chainCode: chain1 } = deriveHardenedChildKey(
    masterPrivateKey,
    masterChainCode,
    HARDENED_OFFSET + DID_PURPOSE
  );

  const { privateKey: key2, chainCode: chain2 } = deriveHardenedChildKey(
    key1,
    chain1,
    HARDENED_OFFSET + DID_COIN_TYPE
  );

  const { privateKey: key3, chainCode: chain3 } = deriveHardenedChildKey(
    key2,
    chain2,
    HARDENED_OFFSET + DID_IDENTITY_PATH
  );

  // Step 4: m/44'/1001'/0'/1' (Change level 1 for DID, different from signing key)
  const { privateKey: key4, chainCode: chain4 } = deriveHardenedChildKey(
    key3,
    chain3,
    HARDENED_OFFSET + 1
  );

  // Step 5: m/44'/1001'/0'/1'/0' (Fixed at index 0)
  const { privateKey: finalPrivateKey } = deriveHardenedChildKey(key4, chain4, HARDENED_OFFSET + 0);

  // Generate P-256 public key from private key (uncompressed format)
  const publicKey = privateKeyToPublicKey(finalPrivateKey, false); // false = uncompressed (65 bytes)

  return {
    privateKey: finalPrivateKey,
    publicKey,
    publicKeyHex: bytesToHex(publicKey),
  };
}

// =============================================================================
// P-256 CRYPTOGRAPHY
// =============================================================================

/**
 * Generate P-256 public key from private key
 *
 * @param privateKey - Private key (32 bytes)
 * @param compressed - Return compressed format (default: true)
 * @returns Public key (33 bytes if compressed, 65 bytes if uncompressed)
 */
export function privateKeyToPublicKey(
  privateKey: Uint8Array,
  compressed: boolean = true
): Uint8Array {
  if (!privateKey || privateKey.length !== 32) {
    throw new Error('Private key must be 32 bytes');
  }

  // Generate public key using P-256 (NIST curve)
  const publicKey = p256.getPublicKey(privateKey, compressed);

  return publicKey;
}

/**
 * Get public key in different formats
 *
 * @param privateKey - Private key (32 bytes)
 * @returns Object with compressed, uncompressed, and hex formats
 */
export function getPublicKeyFormats(privateKey: Uint8Array): {
  compressed: Uint8Array;
  uncompressed: Uint8Array;
  compressedHex: string;
  uncompressedHex: string;
} {
  const compressed = privateKeyToPublicKey(privateKey, true);
  const uncompressed = privateKeyToPublicKey(privateKey, false);

  return {
    compressed,
    uncompressed,
    compressedHex: bytesToHex(compressed),
    uncompressedHex: bytesToHex(uncompressed),
  };
}

// =============================================================================
// WEB CRYPTO API INTEGRATION
// =============================================================================

/**
 * Import BIP32-derived P-256 private key into Web Crypto API as non-extractable CryptoKey
 *
 * This is the key security feature: the private key becomes non-extractable,
 * meaning JavaScript cannot read it, making it immune to XSS attacks.
 *
 * @param privateKeyBytes - 32-byte P-256 private key from BIP32 derivation
 * @returns Non-extractable CryptoKey for signing operations
 */
export async function importPrivateKeyToSubtleCrypto(
  privateKeyBytes: Uint8Array
): Promise<CryptoKey> {
  if (privateKeyBytes.length !== 32) {
    throw new Error('Private key must be 32 bytes');
  }

  // P-256 private key in PKCS#8 format (ASN.1 DER encoding)
  // This wraps the raw 32-byte key in the proper format for importKey
  const pkcs8Header = new Uint8Array([
    0x30,
    0x81,
    0x87, // SEQUENCE
    0x02,
    0x01,
    0x00, // INTEGER (version)
    0x30,
    0x13, // SEQUENCE (algorithm)
    0x06,
    0x07,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x02,
    0x01, // OID: ecPublicKey
    0x06,
    0x08,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x03,
    0x01,
    0x07, // OID: P-256
    0x04,
    0x6d, // OCTET STRING
    0x30,
    0x6b, // SEQUENCE
    0x02,
    0x01,
    0x01, // INTEGER (version)
    0x04,
    0x20, // OCTET STRING (32 bytes)
  ]);

  // Complete PKCS#8 structure
  const pkcs8Footer = new Uint8Array([
    0xa1,
    0x44,
    0x03,
    0x42,
    0x00, // BIT STRING context
  ]);

  // Generate public key to complete the PKCS#8 structure
  const publicKey = privateKeyToPublicKey(privateKeyBytes, false); // uncompressed (65 bytes)

  // Combine header + private key + footer + public key
  const pkcs8Key = new Uint8Array(
    pkcs8Header.length + privateKeyBytes.length + pkcs8Footer.length + publicKey.length
  );
  let offset = 0;
  pkcs8Key.set(pkcs8Header, offset);
  offset += pkcs8Header.length;
  pkcs8Key.set(privateKeyBytes, offset);
  offset += privateKeyBytes.length;
  pkcs8Key.set(pkcs8Footer, offset);
  offset += pkcs8Footer.length;
  pkcs8Key.set(publicKey, offset);

  try {
    // Import as non-extractable CryptoKey
    const cryptoKey = await window.crypto.subtle.importKey(
      'pkcs8',
      pkcs8Key,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false, // ⚠️ CRITICAL: false = non-extractable (secure from XSS)
      ['sign']
    );

    return cryptoKey;
  } catch (error) {
    console.error('Failed to import private key to SubtleCrypto:', error);
    throw new Error(
      'Key import failed. Ensure you are using a modern browser with Web Crypto API support.'
    );
  }
}

/**
 * Export P-256 public key from CryptoKey to JWK format
 *
 * @param publicCryptoKey - Public CryptoKey
 * @returns JWK representation
 */
export async function exportPublicKeyJwk(publicCryptoKey: CryptoKey): Promise<JsonWebKey> {
  return await window.crypto.subtle.exportKey('jwk', publicCryptoKey);
}

/**
 * Export P-256 public key in PEM format (for backend verification)
 *
 * @param publicKeyBytes - Raw public key bytes (compressed or uncompressed)
 * @returns PEM-encoded public key
 */
export function exportPublicKeyPem(publicKeyBytes: Uint8Array): string {
  // SPKI (Subject Public Key Info) header for P-256
  const spkiHeader = new Uint8Array([
    0x30,
    0x59, // SEQUENCE
    0x30,
    0x13, // SEQUENCE
    0x06,
    0x07,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x02,
    0x01, // OID: ecPublicKey
    0x06,
    0x08,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x03,
    0x01,
    0x07, // OID: P-256
    0x03,
    0x42,
    0x00, // BIT STRING
  ]);

  // Ensure public key is uncompressed format (65 bytes)
  let uncompressedKey = publicKeyBytes;
  if (publicKeyBytes.length === 33) {
    // Convert compressed to uncompressed
    const privateKeyForConversion = new Uint8Array(32); // dummy for conversion
    uncompressedKey = p256.getPublicKey(publicKeyBytes, false);
  }

  const spkiKey = new Uint8Array(spkiHeader.length + uncompressedKey.length);
  spkiKey.set(spkiHeader, 0);
  spkiKey.set(uncompressedKey, spkiHeader.length);

  const base64 = btoa(String.fromCharCode(...spkiKey));
  const pem = `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;

  return pem;
}

// =============================================================================
// DID GENERATION
// =============================================================================

export type DIDEntityType = 'u' | 'i'; // 'u' = user, 'i' = institution

/**
 * Generate DID from public key
 *
 * @param publicKey - Public key bytes (compressed or uncompressed)
 * @param entityType - Entity type ('u' = user, 'i' = institution)
 * @returns DID string
 */
export function generateDID(publicKey: Uint8Array, entityType: DIDEntityType = 'i'): string {
  // Convert public key to base64url (URL-safe, no padding)
  const base64 = btoa(String.fromCharCode(...publicKey));
  const base64url = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `did:${DID_METHOD}:${entityType}${base64url}`;
}

/**
 * Parse DID to extract components
 *
 * @param did - DID string
 * @returns Parsed DID components or null if invalid
 */
export function parseDID(did: string): {
  method: string;
  entityType: DIDEntityType;
  identifier: string;
  publicKey: Uint8Array | null;
} | null {
  // Match base64url identifier (alphanumeric, dash, underscore, no padding)
  const regex = /^did:([a-z]+):([ui]):([A-Za-z0-9_-]+)$/;
  const match = did.match(regex);

  if (!match) return null;

  const identifier = match[3];

  // Decode base64url to get public key
  let publicKey: Uint8Array | null = null;
  try {
    // Convert base64url to base64
    const base64 = identifier
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const binaryString = atob(base64 + padding);
    publicKey = Uint8Array.from(binaryString, char => char.charCodeAt(0));
  } catch {
    // Invalid base64url, leave publicKey as null
  }

  return {
    method: match[1],
    entityType: match[2] as DIDEntityType,
    identifier,
    publicKey,
  };
}

// =============================================================================
// WALLET GENERATION
// =============================================================================

/**
 * Generate complete wallet from mnemonic with P-256 keys and SubtleCrypto integration
 *
 * SECURITY NOTE: This function does NOT return private keys.
 * - Signing private key is stored as non-extractable CryptoKey
 * - DID private key is never returned (only used to generate DID)
 *
 * @param words - Mnemonic words
 * @param entityType - Entity type for DID
 * @param passphrase - Optional passphrase
 * @param addressIndex - Address index for signing key
 * @returns Wallet with DID, non-extractable signing key, and public key (hex)
 */
export async function generateWalletFromMnemonic(
  words: string[],
  entityType: DIDEntityType = 'i',
  passphrase: string = '',
  addressIndex: number = 0
): Promise<{
  did: string; // DID derived from DID key (separate from signing key)
  signingKey: {
    cryptoKey: CryptoKey; // Non-extractable CryptoKey for JWT signing
    publicKeyHex: string; // Hex format for blockchain/display/verification
  };
}> {
  // Validate mnemonic
  const isValid = await validateMnemonic(words);
  if (!isValid) {
    throw new Error('Invalid mnemonic');
  }

  // Generate seed
  const seed = await generateSeedFromMnemonic(words, passphrase);

  // Derive signing key (for JWT signing)
  const signingKey = deriveSigningKey(seed, addressIndex);

  // Import signing key to SubtleCrypto as non-extractable
  const cryptoKey = await importPrivateKeyToSubtleCrypto(signingKey.privateKey);

  // Derive DID identifier key (separate from signing key for security)
  const didKey = deriveDIDIdentifierKey(seed);

  // Generate DID from DID key
  const did = generateDID(didKey.publicKey, entityType);

  // ⚠️ SECURITY: Clear sensitive data from memory
  signingKey.privateKey.fill(0);
  didKey.privateKey.fill(0);
  seed.fill(0);

  return {
    did,
    signingKey: {
      cryptoKey, // Non-extractable CryptoKey (secure!)
      publicKeyHex: signingKey.publicKeyHex, // Hex format (blockchain-ready)
    },
  };
}

/**
 * Generate new wallet with fresh mnemonic
 *
 * @param entityType - Entity type for DID ('u' = user, 'i' = institution)
 * @param entropyBits - Entropy size (default: 256 for 24 words)
 * @returns New wallet with mnemonic and signing key
 */
export async function generateNewWallet(
  entityType: DIDEntityType = 'i',
  entropyBits: number = ENTROPY_BITS_24_WORDS
): Promise<{
  mnemonic: string[]; // Store this securely! Only way to recover wallet
  did: string;
  signingKey: {
    cryptoKey: CryptoKey;
    publicKeyHex: string;
  };
}> {
  const words = await generateMnemonic(entropyBits);
  const wallet = await generateWalletFromMnemonic(words, entityType);

  return {
    mnemonic: words,
    ...wallet,
  };
}

/**
 * Convert hex public key to PEM format
 *
 * Use this if your backend needs PEM format for verification.
 * Blockchain should use hex directly (more efficient).
 *
 * @param publicKeyHex - Public key in hex format
 * @returns PEM-encoded public key
 */
export function publicKeyHexToPem(publicKeyHex: string): string {
  const publicKeyBytes = hexToBytes(publicKeyHex);
  return exportPublicKeyPem(publicKeyBytes);
}

/**
 * Check if Web Crypto API is available
 */
export function isWebCryptoSupported(): boolean {
  return !!(window.crypto && window.crypto.subtle);
}
