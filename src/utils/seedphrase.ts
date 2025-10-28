import BIP39_WORDLIST from '@/data/wordlist.json';

import { hmac } from '@noble/hashes/hmac.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha512 } from '@noble/hashes/sha2.js';
import * as secp256k1 from '@noble/secp256k1';

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

// secp256k1 curve order (for private key validation)
const SECP256K1_ORDER = new Uint8Array([
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe,
  0xba, 0xae, 0xdc, 0xe6, 0xaf, 0x48, 0xa0, 0x3b, 0xbf, 0xd2, 0x5e, 0x8c, 0xd0, 0x36, 0x41, 0x41,
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
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Securely clear sensitive data from memory
 */
export function secureWipe(data: Uint8Array): void {
  if (data && data.fill) {
    data.fill(0);
  }
}

/**
 * Securely clear a string array (like mnemonic words)
 */
export function secureWipeStringArray(arr: string[]): void {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = '';
  }
  arr.length = 0;
}

// =============================================================================
// BIP39 MNEMONIC GENERATION & VALIDATION
// =============================================================================

/**
 * Generate BIP39 mnemonic phrase
 *
 * Supports standard BIP39 entropy levels:
 * - 128 bits = 12 words
 * - 160 bits = 15 words
 * - 192 bits = 18 words
 * - 224 bits = 21 words
 * - 256 bits = 24 words (recommended for maximum security)
 *
 * @param entropyBits - Entropy in bits (128, 160, 192, 224, or 256)
 * @returns Array of mnemonic words
 */
export async function generateMnemonic(entropyBits = ENTROPY_BITS_24_WORDS): Promise<string[]> {
  const validEntropyBits = [128, 160, 192, 224, 256];
  if (!validEntropyBits.includes(entropyBits)) {
    throw new Error(`Invalid entropy bits. Must be one of: ${validEntropyBits.join(', ')}`);
  }

  const ENT = entropyBits;
  const CS = ENT / 32; // Checksum bits
  const length = ENT / 8; // Convert bits to bytes

  // Generate random entropy
  const entropy = getRandomBytes(length);
  const hash = await digestSha256(entropy);

  // Create binary string: entropy + checksum
  const entropyBinary = bytesToBinary(entropy);
  const checksumBits = bytesToBinary(hash).slice(0, CS);
  const bits = entropyBinary + checksumBits;

  // Convert to mnemonic words (11 bits per word)
  const wordlist = loadWordlist();
  const words: string[] = [];

  for (let i = 0; i < bits.length; i += 11) {
    const idx = parseInt(bits.slice(i, i + 11), 2);
    const word = wordlist[idx];
    if (!word) {
      throw new Error(`Invalid word index: ${idx}`);
    }
    words.push(word);
  }

  return words;
}

/**
 * Validate BIP39 mnemonic checksum
 *
 * @param words - Array of mnemonic words
 * @returns true if valid, false otherwise
 */
export async function validateMnemonic(words: string[]): Promise<boolean> {
  if (!words || !Array.isArray(words)) return false;

  const wordlist = loadWordlist();
  const wordCount = words.length;
  const validWordCounts = [12, 15, 18, 21, 24];

  // Check word count
  if (!validWordCounts.includes(wordCount)) return false;

  // Check all words are in the wordlist
  for (const word of words) {
    if (!wordlist.includes(word)) return false;
  }

  // Validate checksum
  const indexes = words.map((word) => wordlist.indexOf(word));
  const bits = indexes.map((i) => i.toString(2).padStart(11, '0')).join('');

  const ENT = Math.floor((wordCount * 11 * 32) / 33);
  const CS = wordCount * 11 - ENT;

  const entropyBits = bits.slice(0, ENT);
  const checksumBits = bits.slice(ENT);

  const entropyByteMatches = entropyBits.match(/.{1,8}/g);
  if (!entropyByteMatches) {
    throw new Error('Invalid entropy bits format');
  }

  const entropyBytes = new Uint8Array(entropyByteMatches.map((b) => parseInt(b, 2)));
  const hash = await digestSha256(entropyBytes);
  const actualChecksumBits = bytesToBinary(hash).slice(0, CS);

  return actualChecksumBits === checksumBits;
}

// =============================================================================
// BIP39 MNEMONIC TO SEED
// =============================================================================

/**
 * Convert BIP39 mnemonic to seed using PBKDF2-HMAC-SHA512
 *
 * This follows BIP39 standard with 2048 iterations
 *
 * @param words - Array of mnemonic words
 * @param passphrase - Optional passphrase for additional security
 * @returns 64-byte seed
 */
export async function mnemonicToSeed(words: string[], passphrase = ''): Promise<Uint8Array> {
  const mnemonic = words.join(' ');
  const salt = 'mnemonic' + passphrase;

  const encoder = new TextEncoder();
  const mnemonicBytes = encoder.encode(mnemonic);
  const saltBytes = encoder.encode(salt);

  return await pbkdf2Async(sha512, mnemonicBytes, saltBytes, {
    c: 2048, // BIP39 standard iterations
    dkLen: 64, // 512 bits
  });
}

// =============================================================================
// BIP32 HIERARCHICAL DETERMINISTIC KEY DERIVATION
// =============================================================================

/**
 * BIP32 Master Key Generation from Seed
 *
 * Generates the master private key and chain code from seed
 *
 * @param seed - BIP39 seed (64 bytes)
 * @returns Master private key and chain code
 */
export function seedToMasterKey(seed: Uint8Array): {
  privateKey: Uint8Array;
  chainCode: Uint8Array;
} {
  const encoder = new TextEncoder();
  const key = encoder.encode('Bitcoin seed'); // BIP32 standard key

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
 * BIP32 Hardened Child Key Derivation
 *
 * Derives a hardened child key from parent key using BIP32 standard
 * Hardened derivation is more secure and used for all levels in DID wallets
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

  // Validate the private key (must not be zero or >= secp256k1 order)
  const isZero = IL.every((byte: number) => byte === 0);
  if (isZero) {
    throw new Error('Invalid private key: cannot be zero');
  }

  const isTooBig = compareUint8Arrays(IL, SECP256K1_ORDER) >= 0;
  if (isTooBig) {
    throw new Error('Invalid private key: exceeds secp256k1 order');
  }

  return {
    privateKey: IL,
    chainCode: IR,
  };
}

/**
 * Derive private key from seed using BIP44 derivation path
 *
 * Path: m/44'/1001'/0'/0'/{addressIndex}'
 * - m = master key
 * - 44' = BIP44 purpose
 * - 1001' = Custom coin type for DID
 * - 0' = Account 0
 * - 0' = Change 0
 * - {addressIndex}' = Address index (default: 0)
 *
 * All levels use hardened derivation for maximum security
 *
 * @deprecated Use deriveSigningKey() for signing keys or deriveDIDIdentifierKey() for DID keys
 * @param seed - BIP39 seed (64 bytes)
 * @param addressIndex - Address index for derivation (default: 0)
 * @returns Private key and chain code
 */
export function derivePrivateKey(
  seed: Uint8Array,
  addressIndex: number = 0
): {
  privateKey: Uint8Array;
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
  const { privateKey: finalKey, chainCode: finalChain } = deriveHardenedChildKey(
    key4,
    chain4,
    HARDENED_OFFSET + addressIndex
  );

  return {
    privateKey: finalKey,
    chainCode: finalChain,
  };
}

/**
 * Derive signing key from seed using BIP44 derivation path
 *
 * Path: m/44'/1001'/0'/0'/{addressIndex}'
 * - m = master key
 * - 44' = BIP44 purpose
 * - 1001' = Custom coin type for DID
 * - 0' = Account 0
 * - 0' = External chain (change = 0) - for signing keys
 * - {addressIndex}' = Address index (default: 0)
 *
 * This key is used for signing operations and can be rotated by changing the address index.
 * All levels use hardened derivation for maximum security.
 *
 * @param seed - BIP39 seed (64 bytes)
 * @param addressIndex - Address index for derivation (default: 0)
 * @returns Signing private key and chain code
 */
export function deriveSigningKey(
  seed: Uint8Array,
  addressIndex: number = 0
): {
  privateKey: Uint8Array;
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

  // Step 4: m/44'/1001'/0'/0' (External chain - for signing)
  const { privateKey: key4, chainCode: chain4 } = deriveHardenedChildKey(
    key3,
    chain3,
    HARDENED_OFFSET + 0
  );

  // Step 5: m/44'/1001'/0'/0'/{addressIndex}'
  const { privateKey: finalKey, chainCode: finalChain } = deriveHardenedChildKey(
    key4,
    chain4,
    HARDENED_OFFSET + addressIndex
  );

  return {
    privateKey: finalKey,
    chainCode: finalChain,
  };
}

/**
 * Derive DID identifier key from seed using BIP44 derivation path
 *
 * Path: m/44'/1001'/0'/1'/0' (ALWAYS uses index 0)
 * - m = master key
 * - 44' = BIP44 purpose
 * - 1001' = Custom coin type for DID
 * - 0' = Account 0
 * - 1' = Internal chain (change = 1) - for DID identifier
 * - 0' = Always index 0 for deterministic DID
 *
 * This key is used ONLY for generating the DID identifier.
 * It is separate from signing keys to allow:
 * - DID stays constant for a given seed
 * - Signing keys can rotate without changing DID
 * - Standard BIP44 compliance (using change level for separation)
 *
 * All levels use hardened derivation for maximum security.
 *
 * @param seed - BIP39 seed (64 bytes)
 * @returns DID identifier private key and chain code
 */
export function deriveDIDIdentifierKey(seed: Uint8Array): {
  privateKey: Uint8Array;
  chainCode: Uint8Array;
} {
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

  // Step 4: m/44'/1001'/0'/1' (Internal chain - for DID identifier)
  const { privateKey: key4, chainCode: chain4 } = deriveHardenedChildKey(
    key3,
    chain3,
    HARDENED_OFFSET + 1 // <-- Change level 1 (internal chain)
  );

  // Step 5: m/44'/1001'/0'/1'/0' (Always index 0 for DID)
  const { privateKey: finalKey, chainCode: finalChain } = deriveHardenedChildKey(
    key4,
    chain4,
    HARDENED_OFFSET + 0 // <-- Always 0 for deterministic DID
  );

  return {
    privateKey: finalKey,
    chainCode: finalChain,
  };
}

// =============================================================================
// SECP256K1 PUBLIC KEY GENERATION
// =============================================================================

/**
 * Generate secp256k1 public key from private key
 *
 * Uses ECDSA secp256k1 curve (same as Bitcoin and Ethereum)
 *
 * @param privateKey - Private key (32 bytes)
 * @param compressed - Whether to use compressed format (default: true)
 * @returns Public key (33 bytes if compressed, 65 bytes if uncompressed)
 */
export function privateKeyToPublicKey(
  privateKey: Uint8Array,
  compressed: boolean = true
): Uint8Array {
  if (!privateKey || privateKey.length !== 32) {
    throw new Error('Private key must be 32 bytes');
  }

  // Generate public key using secp256k1
  const publicKey = secp256k1.getPublicKey(privateKey, compressed);

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
// DID GENERATION
// =============================================================================

/**
 * DID entity type
 * - 'u' = user
 * - 'i' = institution
 */
export type DIDEntityType = 'u' | 'i';

/**
 * Validate DID entity type
 */
export function validateEntityType(entityType: string): entityType is DIDEntityType {
  return entityType === 'u' || entityType === 'i';
}

/**
 * Generate DID identifier from DID-specific private key
 *
 * Format: did:dcert:{u|i}{base64url_encoded_publickey}
 * - 'u' prefix = user DID
 * - 'i' prefix = institution DID
 *
 * Example: did:dcert:iA3NzQ1ZjQ3ZTA5Y2FjNjRlMGU0OWI5NWE0NzU3ZDE3...
 *
 * The DID uses the base64url-encoded public key directly (33 bytes → 44 chars).
 * This allows the public key to be extracted from the DID for verification.
 *
 * IMPORTANT: This should be called with the key from deriveDIDIdentifierKey(),
 * NOT from deriveSigningKey(). The DID key uses path m/44'/1001'/0'/1'/0'.
 *
 * @param privateKey - Private key (32 bytes) from deriveDIDIdentifierKey()
 * @param entityType - Entity type: 'u' for user, 'i' for institution (default: 'i')
 * @returns DID identifier string (format: did:dcert:{u|i}{44_char_base64url})
 */
export function generateDIDIdentifier(
  privateKey: Uint8Array,
  entityType: DIDEntityType = 'i'
): string {
  // Validate inputs
  if (!privateKey || privateKey.length !== 32) {
    throw new Error('Private key must be 32 bytes');
  }
  if (!validateEntityType(entityType)) {
    throw new Error("Invalid entity type. Must be 'u' (user) or 'i' (institution)");
  }

  // Generate public key from private key (compressed format - 33 bytes)
  const publicKey = privateKeyToPublicKey(privateKey, true);

  // Validate public key is 33 bytes (compressed secp256k1)
  if (publicKey.length !== 33) {
    throw new Error(`Invalid public key length: ${publicKey.length} (expected 33 bytes)`);
  }

  // Convert public key to base64url for URL-safe format
  const base64urlPublicKey = Buffer.from(publicKey)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Validate base64url length: 33 bytes × 4/3 = 44 characters
  if (base64urlPublicKey.length !== 44) {
    throw new Error(
      `Invalid base64url length: ${base64urlPublicKey.length} (expected 44 characters)`
    );
  }

  // Create DID: did:dcert:{u|i}{base64url_publickey}
  const did = `did:${DID_METHOD}:${entityType}${base64urlPublicKey}`;

  return did;
}

/**
 * Parse and validate a DID identifier
 *
 * @param did - DID identifier string
 * @returns Parsed DID components and validation status
 */
export function parseDID(did: string): {
  method: string;
  entityType: DIDEntityType | '';
  identifier: string;
  isValid: boolean;
} {
  // New format: did:dcert:{u|i}{identifier}
  const didRegex = /^did:([a-zA-Z0-9]+):([ui])([A-Za-z0-9_-]+)$/;
  const match = did.match(didRegex);

  if (!match) {
    return {
      method: '',
      entityType: '',
      identifier: '',
      isValid: false,
    };
  }

  const [, method, entityType, identifier] = match;

  return {
    method,
    entityType: entityType as DIDEntityType,
    identifier,
    isValid: method === DID_METHOD && validateEntityType(entityType),
  };
}

/**
 * Extract public key from DID identifier
 *
 * The DID contains the base64url-encoded public key, this function decodes it.
 *
 * @param did - DID identifier string
 * @returns Public key as Uint8Array, or null if DID is invalid
 */
export function extractPublicKeyFromDID(did: string): Uint8Array | null {
  const parsed = parseDID(did);

  if (!parsed.isValid) {
    return null;
  }

  try {
    // Convert base64url back to base64
    const base64 = parsed.identifier.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const base64WithPadding = base64 + padding;

    // Decode to bytes
    const publicKey = Buffer.from(base64WithPadding, 'base64');

    // Validate public key length (should be 33 bytes for compressed)
    if (publicKey.length !== 33) {
      return null;
    }

    return new Uint8Array(publicKey);
  } catch {
    return null;
  }
}

// =============================================================================
// HIGH-LEVEL CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Generate complete wallet from mnemonic with separated signing and DID keys
 *
 * This is a convenience function that combines all steps:
 * 1. Validate mnemonic
 * 2. Convert to seed
 * 3. Derive signing key (m/44'/1001'/0'/0'/{addressIndex}')
 * 4. Derive DID identifier key (m/44'/1001'/0'/1'/0')
 * 5. Generate public keys
 * 6. Generate DID
 *
 * Key Separation (BIP44 Change Level):
 * - Signing Key: External chain (change=0), can rotate with different indices
 * - DID Key: Internal chain (change=1), fixed at index 0 for consistent DID
 *
 * @param words - Mnemonic words
 * @param entityType - Entity type: 'u' for user, 'i' for institution (default: 'i')
 * @param passphrase - Optional BIP39 passphrase
 * @param addressIndex - Address index for signing key derivation (default: 0)
 * @returns Complete wallet with separated signing and DID keys
 */
export async function generateWalletFromMnemonic(
  words: string[],
  entityType: DIDEntityType = 'i',
  passphrase: string = '',
  addressIndex: number = 0
): Promise<{
  mnemonic: string[];
  seed: Uint8Array;
  signingKey: {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
    publicKeyHex: string;
  };
  didKey: {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
    publicKeyHex: string;
  };
  did: string;
}> {
  // Validate mnemonic
  const isValid = await validateMnemonic(words);
  if (!isValid) {
    throw new Error('Invalid mnemonic');
  }

  // Convert to seed
  const seed = await mnemonicToSeed(words, passphrase);

  // Derive signing key (can use different address indices for key rotation)
  const { privateKey: signingPrivateKey } = deriveSigningKey(seed, addressIndex);
  const signingPublicKey = privateKeyToPublicKey(signingPrivateKey, true);

  // Derive DID identifier key (always uses index 0 for deterministic DID)
  const { privateKey: didPrivateKey } = deriveDIDIdentifierKey(seed);
  const didPublicKey = privateKeyToPublicKey(didPrivateKey, true);

  // Generate DID from DID key (NOT from signing key!)
  const did = generateDIDIdentifier(didPrivateKey, entityType);

  return {
    mnemonic: words,
    seed,
    signingKey: {
      privateKey: signingPrivateKey,
      publicKey: signingPublicKey,
      publicKeyHex: bytesToHex(signingPublicKey),
    },
    didKey: {
      privateKey: didPrivateKey,
      publicKey: didPublicKey,
      publicKeyHex: bytesToHex(didPublicKey),
    },
    did,
  };
}

/**
 * Generate new wallet with random mnemonic and separated signing and DID keys
 *
 * This creates a brand new wallet from scratch:
 * 1. Generate random mnemonic
 * 2. Derive signing key (m/44'/1001'/0'/0'/{addressIndex}')
 * 3. Derive DID identifier key (m/44'/1001'/0'/1'/0')
 * 4. Generate DID
 *
 * Key Separation (BIP44 Change Level):
 * - Signing Key: External chain (change=0), can rotate with different indices
 * - DID Key: Internal chain (change=1), fixed at index 0 for consistent DID
 *
 * @param entropyBits - Mnemonic entropy (128=12 words, 256=24 words)
 * @param entityType - Entity type: 'u' for user, 'i' for institution (default: 'i')
 * @param passphrase - Optional BIP39 passphrase
 * @param addressIndex - Address index for signing key derivation (default: 0)
 * @returns Complete wallet with separated signing and DID keys
 */
export async function generateNewWallet(
  entropyBits: number = ENTROPY_BITS_24_WORDS,
  entityType: DIDEntityType = 'i',
  passphrase: string = '',
  addressIndex: number = 0
): Promise<{
  mnemonic: string[];
  seed: Uint8Array;
  signingKey: {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
    publicKeyHex: string;
  };
  didKey: {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
    publicKeyHex: string;
  };
  did: string;
}> {
  // Generate new mnemonic
  const mnemonic = await generateMnemonic(entropyBits);

  // Generate wallet from mnemonic
  return await generateWalletFromMnemonic(mnemonic, entityType, passphrase, addressIndex);
}
