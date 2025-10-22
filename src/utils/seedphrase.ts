import BIP39_WORDLIST from '@/data/wordlist.json';

import { hmac } from '@noble/hashes/hmac.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
// @ts-expect-error - no type definitions available
import aesjs from 'aes-js';

// =============================================================================
// CONSTANTS
// =============================================================================

// DID-specific derivation paths
export const DID_PURPOSE = 44; // Using BIP44 standard
export const DID_COIN_TYPE = 1001; // Custom coin type for DID
export const DID_IDENTITY_PATH = 0; // m/44'/1001'/0' for DID identifier
export const DID_KEY_PATH = 1; // m/44'/1001'/1' for rotatable private key

// Hardened derivation flag
export const HARDENED_OFFSET = 0x80000000;

// PBKDF2 iterations for different security levels (OWASP 2024 recommendations)
export const PBKDF2_ITERATIONS_MOBILE = 600000; // 600k for mobile (OWASP 2024 minimum for PBKDF2-SHA256)
export const PBKDF2_ITERATIONS_HIGH_SECURITY = 1000000; // 1M for high security environments

// Recommended entropy levels for different use cases
export const ENTROPY_BITS_STANDARD = 128; // 12 words - minimum for wallets
export const ENTROPY_BITS_HIGH_SECURITY = 256; // 24 words - recommended for DID wallets

// DID method constants
export const DID_METHOD = 'ganesha'; // Your DID method name

// =============================================================================
// GENERAL FUNCTIONS
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
 * Securely clear sensitive data from memory
 * This helps prevent sensitive data from lingering in memory
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
// MNEMONIC GENERATION
// =============================================================================

/**
 * Generate mnemonic
 * For DID wallets, 256-bit entropy (24 words) is recommended for maximum security
 */
export async function generateMnemonic(
  entropyBits = ENTROPY_BITS_HIGH_SECURITY
): Promise<string[]> {
  const validEntropyBits = [128, 160, 192, 224, 256];
  if (!validEntropyBits.includes(entropyBits)) {
    throw new Error(`Invalid entropy bits. Must be one of: ${validEntropyBits.join(', ')}`);
  }

  const ENT = entropyBits;
  const CS = ENT / 32;
  const length = ENT / 8; // Convert bits to bytes

  const entropy = getRandomBytes(length);
  const hash = await digestSha256(entropy);

  const entropyBinary = bytesToBinary(entropy);
  const checksumBits = bytesToBinary(hash).slice(0, CS);

  const bits = entropyBinary + checksumBits;
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
 * Validate mnemonic checksum
 */
export async function validateMnemonic(words: string[]): Promise<boolean> {
  if (!words || !Array.isArray(words)) return false;

  const wordlist = loadWordlist();
  const wordCount = words.length;
  const validWordCounts = [12, 15, 18, 21, 24];

  if (!validWordCounts.includes(wordCount)) return false;

  // Check all words are in the wordlist
  for (const word of words) {
    if (!wordlist.includes(word)) return false;
  }

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
// MNEMONIC TO SEED
// =============================================================================

/**
 * Convert mnemonic to seed using PBKDF2-HMAC-SHA512 (BIP39 standard)
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
 * Generates the master private key and chain code from seed
 */
export function seedToMasterKeyBIP32(seed: Uint8Array): {
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
 * BIP32 Hardened Child Key Derivation Function
 *
 * HARDENED vs NON-HARDENED DERIVATION EXPLAINED:
 *
 * Hardened Derivation (index >= 2^31):
 * - Uses private key: HMAC-SHA512(parent_chain_code, 0x00 || parent_private_key || index)
 * - Security: Even with public key + chain code, cannot derive child keys
 * - Use case: Sensitive levels (purpose, coin_type, account) and DID wallets
 *
 * Non-Hardened Derivation (index < 2^31):
 * - Uses public key: HMAC-SHA512(parent_chain_code, parent_public_key || index)
 * - Security Risk: If attacker gets (public key + chain code + any child private key),
 *   they can derive ALL sibling private keys
 * - Use case: Generating many addresses efficiently in traditional wallets
 *
 * For DID wallets, we use ONLY hardened derivation because:
 * 1. DID identifiers are public by design
 * 2. We prioritize security over efficiency
 * 3. We don't need to generate thousands of addresses
 */
export function DeriveHardenedChildKey(
  parentPrivateKey: Uint8Array,
  parentChainCode: Uint8Array,
  index: number // Should be >= 0x80000000 for hardened derivation
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
  data.set(parentPrivateKey, 1); // Set parent private key at offset 1

  // Convert index to big-endian 4-byte representation
  const indexBytes = new Uint8Array(4);
  indexBytes[0] = (index >>> 24) & 0xff;
  indexBytes[1] = (index >>> 16) & 0xff;
  indexBytes[2] = (index >>> 8) & 0xff;
  indexBytes[3] = index & 0xff;

  data.set(indexBytes, 33); // Set index at offset 33

  // HMAC-SHA512(parent_chain_code, data)
  const I = hmac(sha512, parentChainCode, data);

  // Split result
  const IL = I.slice(0, 32); // Child private key
  const IR = I.slice(32, 64); // Child chain code

  // Validate the private key (must not be zero or >= secp256k1 order)
  const secp256k1Order = new Uint8Array([
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe,
    0xba, 0xae, 0xdc, 0xe6, 0xaf, 0x48, 0xa0, 0x3b, 0xbf, 0xd2, 0x5e, 0x8c, 0xd0, 0x36, 0x41, 0x41,
  ]);

  // Check if IL is zero
  const isZero = IL.every((byte: number) => byte === 0);
  if (isZero) {
    throw new Error('Invalid private key: cannot be zero');
  }

  // Check if IL >= secp256k1 order (simplified check)
  const isTooBig = compareUint8Arrays(IL, secp256k1Order) >= 0;
  if (isTooBig) {
    throw new Error('Invalid private key: exceeds secp256k1 order');
  }

  return {
    privateKey: IL,
    chainCode: IR,
  };
}

/**
 * Derive DID identifier key from seed
 * Uses path: m/44'/1001'/0'/0'/0 (DID_IDENTITY_PATH)
 * This key is used to generate the DID identifier and should not be rotated
 */
export function deriveDIDIdentifierKey(seed: Uint8Array): {
  privateKey: Uint8Array;
  chainCode: Uint8Array;
} {
  // Step 0: Generate master key and chain code from seed
  const { privateKey: masterPrivateKey, chainCode: masterChainCode } = seedToMasterKeyBIP32(seed);

  // Step 1: Process purpose = 44' (BIP44 standard)
  const { privateKey: level1PrivateKey, chainCode: level1ChainCode } = DeriveHardenedChildKey(
    masterPrivateKey,
    masterChainCode,
    HARDENED_OFFSET + DID_PURPOSE
  );

  // Step 2: Process coin_type = 1001' (DID-specific)
  const { privateKey: level2PrivateKey, chainCode: level2ChainCode } = DeriveHardenedChildKey(
    level1PrivateKey,
    level1ChainCode,
    HARDENED_OFFSET + DID_COIN_TYPE
  );

  // Step 3: Process account = 0' (DID identifier account)
  const { privateKey: level3PrivateKey, chainCode: level3ChainCode } = DeriveHardenedChildKey(
    level2PrivateKey,
    level2ChainCode,
    HARDENED_OFFSET + DID_IDENTITY_PATH
  );

  // Step 4: Process change = 0' (hardened for DID)
  const { privateKey: level4PrivateKey, chainCode: level4ChainCode } = DeriveHardenedChildKey(
    level3PrivateKey,
    level3ChainCode,
    HARDENED_OFFSET + 0
  );

  // Step 5: Process address index = 0' (hardened for DID)
  const { privateKey: finalPrivateKey, chainCode: finalChainCode } = DeriveHardenedChildKey(
    level4PrivateKey,
    level4ChainCode,
    HARDENED_OFFSET + 0
  );

  return {
    privateKey: finalPrivateKey,
    chainCode: finalChainCode,
  };
}

/**
 * Derive rotatable private key from seed
 * Uses path: m/44'/1001'/1'/0'/keyIndex (DID_KEY_PATH)
 * This key can be rotated by changing the keyIndex
 */
export function deriveRotatablePrivateKey(
  seed: Uint8Array,
  keyIndex: number = 0
): {
  privateKey: Uint8Array;
  chainCode: Uint8Array;
} {
  // Step 0: Generate master key and chain code from seed
  const { privateKey: masterPrivateKey, chainCode: masterChainCode } = seedToMasterKeyBIP32(seed);

  // Step 1: Process purpose = 44' (BIP44 standard)
  const { privateKey: level1PrivateKey, chainCode: level1ChainCode } = DeriveHardenedChildKey(
    masterPrivateKey,
    masterChainCode,
    HARDENED_OFFSET + DID_PURPOSE
  );

  // Step 2: Process coin_type = 1001' (DID-specific)
  const { privateKey: level2PrivateKey, chainCode: level2ChainCode } = DeriveHardenedChildKey(
    level1PrivateKey,
    level1ChainCode,
    HARDENED_OFFSET + DID_COIN_TYPE
  );

  // Step 3: Process account = 1' (rotatable key account)
  const { privateKey: level3PrivateKey, chainCode: level3ChainCode } = DeriveHardenedChildKey(
    level2PrivateKey,
    level2ChainCode,
    HARDENED_OFFSET + DID_KEY_PATH
  );

  // Step 4: Process change = 0' (hardened for security)
  const { privateKey: level4PrivateKey, chainCode: level4ChainCode } = DeriveHardenedChildKey(
    level3PrivateKey,
    level3ChainCode,
    HARDENED_OFFSET + 0
  );

  // Step 5: Process key index (hardened for security)
  const { privateKey: finalPrivateKey, chainCode: finalChainCode } = DeriveHardenedChildKey(
    level4PrivateKey,
    level4ChainCode,
    HARDENED_OFFSET + keyIndex
  );

  return {
    privateKey: finalPrivateKey,
    chainCode: finalChainCode,
  };
}

// =============================================================================
// SEED TO MASTER KEY (Legacy - for password manager)
// =============================================================================

/**
 * Derive master key from seed using PBKDF2 for additional security
 * This adds an extra layer of protection specific to your password manager
 */
export async function seedToMasterKey(seed: Uint8Array, email: string): Promise<Uint8Array> {
  // Create salt from user email
  const encoder = new TextEncoder();
  const salt = encoder.encode(`wallet-salt-v1-${email}`);

  const masterKey = await pbkdf2Async(sha256, seed, salt, {
    c: PBKDF2_ITERATIONS_MOBILE, // 100k for mobile performance
    dkLen: 64, // 512 bits output
  });

  return masterKey;
}

/**
 * Derive master key from seed only (for wallet ID generation)
 * This creates a consistent wallet ID based only on the seed phrase
 */
export async function seedToMasterKeyForWalletId(seed: Uint8Array): Promise<Uint8Array> {
  // Create salt without user email for consistent wallet ID
  const encoder = new TextEncoder();
  const salt = encoder.encode(`wallet-id-salt-v1`);

  const masterKey = await pbkdf2Async(sha256, seed, salt, {
    c: PBKDF2_ITERATIONS_MOBILE, // 100k for mobile performance
    dkLen: 64, // 512 bits output
  });

  return masterKey;
}

// =============================================================================
// MASTER KEY TO KEYS (ENCRYPTION, MAC, AND WALLETID)
// =============================================================================

/**
 * Derives encryption and MAC keys from the master key using HKDF
 * This provides cryptographic key separation
 */
export async function deriveKeysFromMasterKey(masterKey: Uint8Array): Promise<{
  encryptionKey: Uint8Array;
  macKey: Uint8Array;
}> {
  // Use HKDF for key derivation from master key
  const encryptionInfo = new TextEncoder().encode('wallet-encryption-v1');
  const macInfo = new TextEncoder().encode('wallet-mac-v1');
  const salt = new Uint8Array(); // Empty salt for HKDF

  // Derive separate keys for different purposes
  const encryptionKey = hkdf(sha256, masterKey, salt, encryptionInfo, 32);
  const macKey = hkdf(sha256, masterKey, salt, macInfo, 32);

  return {
    encryptionKey,
    macKey,
  };
}

/**
 * Derives wallet ID using HKDF
 */
export async function deriveWalletIdFromMasterKey(masterKey: Uint8Array): Promise<string> {
  // Use HKDF for key derivation from master key
  const walletIdInfo = new TextEncoder().encode('wallet-id-v1');
  const salt = new Uint8Array(); // Empty salt for HKDF

  // Derive wallet ID for wallet recovery
  const walletIdSeed = hkdf(sha256, masterKey, salt, walletIdInfo, 32);

  // Generate wallet ID from seed
  const walletIdHash = sha256(walletIdSeed);
  const walletId = Buffer.from(walletIdHash)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return walletId;
}

// =============================================================================
// DERIVE ALL KEYS
// =============================================================================

/**
 * Complete BIP32/BIP44 key derivation flow: mnemonic → seed → BIP32 keys
 * This derives the DID identifier key using the standard DID derivation path
 */
export async function deriveBIP32WalletKeys(
  words: string[],
  passphrase = ''
): Promise<{
  masterKey: { privateKey: Uint8Array; chainCode: Uint8Array };
  derivedKey: { privateKey: Uint8Array; chainCode: Uint8Array };
  seed: Uint8Array;
}> {
  // Step 1: Mnemonic to seed (BIP39 standard)
  const seed = await mnemonicToSeed(words, passphrase);

  // Step 2: Seed to BIP32 master key
  const masterKey = seedToMasterKeyBIP32(seed);

  // Step 3: Derive DID identifier key using standard DID path m/44'/1001'/0'/0'/0'
  const derivedKey = deriveDIDIdentifierKey(seed);

  return {
    masterKey,
    derivedKey,
    seed,
  };
}

/**
 * Complete key derivation flow: mnemonic → seed → master key → keys (Legacy - for password manager)
 */
export async function deriveWalletKeys(
  words: string[],
  email: string,
  passphrase = ''
): Promise<{
  encryptionKey: Uint8Array;
  macKey: Uint8Array;
  walletId: string;
}> {
  // Step 1: Mnemonic to seed (BIP39)
  const seed = await mnemonicToSeed(words, passphrase);

  // Step 2: Seed to master key (App-specific PBKDF2) - still uses email for encryption keys
  const masterKey = await seedToMasterKey(seed, email);
  // Step 3: Seed to wallet ID master key (seed-only for consistent wallet ID)
  const walletIdMasterKey = await seedToMasterKeyForWalletId(seed);

  // Step 4: Master key to functional keys (HKDF)
  const encryptionMacKeys = await deriveKeysFromMasterKey(masterKey);
  // Step 5: Wallet ID master key to wallet ID (HKDF)
  const walletId = await deriveWalletIdFromMasterKey(walletIdMasterKey);

  return {
    encryptionKey: encryptionMacKeys.encryptionKey,
    macKey: encryptionMacKeys.macKey,
    walletId: walletId,
  };
}

/**
 * Generate a complete wallet with mnemonic and derived keys
 * For DID wallets, defaults to high security (256-bit entropy)
 */
export async function generateWalletWithKeys(entropyBits = ENTROPY_BITS_HIGH_SECURITY): Promise<{
  mnemonic: string[];
  masterKey: { privateKey: Uint8Array; chainCode: Uint8Array };
  derivedKey: { privateKey: Uint8Array; chainCode: Uint8Array };
  seed: Uint8Array;
}> {
  // Step 1: Generate BIP39 mnemonic
  const mnemonic = await generateMnemonic(entropyBits);

  // Step 2: Derive BIP32 keys
  const keys = await deriveBIP32WalletKeys(mnemonic);

  return {
    mnemonic,
    ...keys,
  };
}

/**
 * Generate a complete DID wallet with 256-bit entropy
 * Returns DID identifier and rotatable private key
 */
export async function generateDIDWallet(
  countryCode: string,
  initialKeyIndex: number = 0
): Promise<{
  mnemonic: string[];
  did: string;
  privateKey: Uint8Array;
  keyIndex: number;
  seed: Uint8Array;
  walletId: string;
}> {
  // Validate country code
  if (!validateCountryCode(countryCode)) {
    throw new Error("Invalid country code. Must be ISO 3166-1 alpha-2 format (e.g., 'US', 'ID')");
  }

  // Step 1: Generate high-security mnemonic (24 words, 256-bit entropy)
  const mnemonic = await generateMnemonic(ENTROPY_BITS_HIGH_SECURITY);

  // Step 2: Convert to seed
  const seed = await mnemonicToSeed(mnemonic);

  // Step 3: Derive DID identifier key (non-rotatable)
  const didIdentifierKey = deriveDIDIdentifierKey(seed);

  // Step 4: Generate DID identifier
  const did = generateDIDIdentifier(didIdentifierKey.privateKey, countryCode);

  // Step 5: Derive rotatable private key
  const rotatableKey = deriveRotatablePrivateKey(seed, initialKeyIndex);

  // Step 6: Generate wallet ID for recovery
  const walletIdMasterKey = await seedToMasterKeyForWalletId(seed);
  const walletId = await deriveWalletIdFromMasterKey(walletIdMasterKey);

  return {
    mnemonic,
    did,
    privateKey: rotatableKey.privateKey,
    keyIndex: initialKeyIndex,
    seed,
    walletId,
  };
}

/**
 * Rotate the private key for an existing DID wallet
 * The DID identifier remains the same, only the private key changes
 */
export async function rotatePrivateKey(
  mnemonic: string[],
  newKeyIndex: number,
  passphrase: string = ''
): Promise<{
  privateKey: Uint8Array;
  keyIndex: number;
}> {
  // Step 1: Validate mnemonic
  const isValid = await validateMnemonic(mnemonic);
  if (!isValid) {
    throw new Error('Invalid mnemonic');
  }

  // Step 2: Convert to seed
  const seed = await mnemonicToSeed(mnemonic, passphrase);

  // Step 3: Derive new rotatable private key
  const rotatableKey = deriveRotatablePrivateKey(seed, newKeyIndex);

  return {
    privateKey: rotatableKey.privateKey,
    keyIndex: newKeyIndex,
  };
}

/**
 * Recover DID and current private key from mnemonic
 */
export async function recoverDIDWallet(
  mnemonic: string[],
  countryCode: string,
  keyIndex: number = 0,
  passphrase: string = ''
): Promise<{
  did: string;
  privateKey: Uint8Array;
  keyIndex: number;
  walletId: string;
}> {
  // Validate inputs
  if (!validateCountryCode(countryCode)) {
    throw new Error("Invalid country code. Must be ISO 3166-1 alpha-2 format (e.g., 'US', 'ID')");
  }

  const isValid = await validateMnemonic(mnemonic);
  if (!isValid) {
    throw new Error('Invalid mnemonic');
  }

  // Step 1: Convert to seed
  const seed = await mnemonicToSeed(mnemonic, passphrase);

  // Step 2: Derive DID identifier key (non-rotatable)
  const didIdentifierKey = deriveDIDIdentifierKey(seed);

  // Step 3: Generate DID identifier
  const did = generateDIDIdentifier(didIdentifierKey.privateKey, countryCode);

  // Step 4: Derive current rotatable private key
  const rotatableKey = deriveRotatablePrivateKey(seed, keyIndex);

  // Step 5: Generate wallet ID
  const walletIdMasterKey = await seedToMasterKeyForWalletId(seed);
  const walletId = await deriveWalletIdFromMasterKey(walletIdMasterKey);

  return {
    did,
    privateKey: rotatableKey.privateKey,
    keyIndex,
    walletId,
  };
}

// =============================================================================
// ENCRYPTION AND DECRYPTION
// =============================================================================

/**
 * Encrypt wallet data using AES-CTR + HMAC-SHA256 (Encrypt-then-MAC)
 */
export async function encryptWallet(
  walletData: string,
  keys: { encryptionKey: Uint8Array; macKey: Uint8Array }
): Promise<string> {
  const iv = getRandomBytes(16); // 128-bit IV for CTR mode
  const textBytes = aesjs.utils.utf8.toBytes(walletData);

  // Encrypt with AES-CTR
  const aesCtr = new aesjs.ModeOfOperation.ctr(keys.encryptionKey, new aesjs.Counter(iv));
  const encryptedBytes = aesCtr.encrypt(textBytes);

  // Create MAC over IV + ciphertext
  const dataToAuthenticate = Buffer.concat([Buffer.from(iv), Buffer.from(encryptedBytes)]);
  const mac = hmac(sha256, keys.macKey, dataToAuthenticate);

  // Combine: IV + Ciphertext + MAC
  const combined = Buffer.concat([Buffer.from(iv), Buffer.from(encryptedBytes), Buffer.from(mac)]);

  return combined.toString('hex');
}

/**
 * Decrypt the password wallet using AES-CTR + HMAC-SHA256
 */
export async function decryptWallet(
  encryptedHexString: string,
  keys: { encryptionKey: Uint8Array; macKey: Uint8Array }
): Promise<string> {
  const combined = Buffer.from(encryptedHexString, 'hex');

  // Extract components
  const iv = combined.slice(0, 16);
  const encryptedBytes = combined.slice(16, combined.length - 32);
  const receivedMac = combined.slice(combined.length - 32);

  // Verify MAC
  const dataToAuthenticate = Buffer.concat([iv, encryptedBytes]);
  const expectedMac = hmac(sha256, keys.macKey, dataToAuthenticate);

  // Timing-safe MAC comparison
  const macIsValid = timingSafeEqual(receivedMac, expectedMac);

  if (!macIsValid) {
    throw new Error(
      'Decryption failed: Invalid MAC. The data has been tampered with or is corrupted.'
    );
  }

  // Decrypt with AES-CTR
  const aesCtr = new aesjs.ModeOfOperation.ctr(keys.encryptionKey, new aesjs.Counter(iv));
  const decryptedBytes = aesCtr.decrypt(encryptedBytes);

  return aesjs.utils.utf8.fromBytes(decryptedBytes);
}

/**
 * Compares two Uint8Arrays in constant time to prevent timing attacks
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    const aValue = a[i];
    const bValue = b[i];
    if (aValue !== undefined && bValue !== undefined) {
      diff |= aValue ^ bValue;
    }
  }

  return diff === 0;
}

// =============================================================================
// UTILITY FUNCTIONS FOR DEBUGGING AND VALIDATION
// =============================================================================

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
 * Generate DID identifier from DID identifier key
 * Format: did:ganesha:{country}:{base64url_encoded_hash}
 *
 * SECURITY EXPLANATION FOR DID LENGTH:
 * - 256 bits provides 2^256 ≈ 1.16 × 10^77 unique identifiers
 * - This supports trillions of users with astronomical safety margin
 * - Base64url encoding reduces length from 256 binary chars to 43 chars
 * - The hash prevents key material leakage while ensuring uniqueness
 * - Even with knowledge of the DID, the original key cannot be recovered
 */
export function generateDIDIdentifier(identifierKey: Uint8Array, countryCode: string): string {
  // Input validation
  if (!identifierKey || identifierKey.length !== 32) {
    throw new Error('Identifier key must be 32 bytes');
  }

  // Hash the identifier key to create a unique but deterministic identifier
  // This provides a one-way function: key → hash, but hash ↛ key
  const keyHash = sha256(identifierKey);

  // Use full 32 bytes (256 bits) for maximum collision resistance
  // Collision probability: negligible until 2^128 identifiers (birthday paradox)

  // Convert to base64url for shorter, URL-safe format (43 characters vs 256 binary chars)
  const base64urlHash = Buffer.from(keyHash)
    .toString('base64')
    .replace(/\+/g, '-') // Replace + with - for URL safety
    .replace(/\//g, '_') // Replace / with _ for URL safety
    .replace(/=+$/, ''); // Remove padding = characters

  // Create DID in the format: did:ganesha:{country}:{base64url_hash}
  const did = `did:${DID_METHOD}:${countryCode.toLowerCase()}:${base64urlHash}`;

  return did;
}

/**
 * Validate country code (ISO 3166-1 alpha-2)
 */
export function validateCountryCode(countryCode: string): boolean {
  // Basic validation for ISO 3166-1 alpha-2 format
  return /^[A-Z]{2}$/.test(countryCode.toUpperCase());
}

/**
 * Parse and validate a DID identifier
 */
export function parseDID(did: string): {
  method: string;
  country: string;
  identifier: string;
  isValid: boolean;
} {
  const didRegex = /^did:([a-zA-Z0-9]+):([a-z]{2}):([A-Za-z0-9_-]+)$/;
  const match = did.match(didRegex);

  if (!match) {
    return {
      method: '',
      country: '',
      identifier: '',
      isValid: false,
    };
  }

  const [, method, country, identifier] = match;

  return {
    method,
    country: country.toUpperCase(),
    identifier,
    isValid: method === DID_METHOD && validateCountryCode(country),
  };
}

/**
 * Verify if a DID was generated from a specific seed
 */
export async function verifyDIDOwnership(
  did: string,
  mnemonic: string[],
  passphrase: string = ''
): Promise<boolean> {
  try {
    const parsedDID = parseDID(did);
    if (!parsedDID.isValid) {
      return false;
    }

    // Validate mnemonic
    const isValidMnemonic = await validateMnemonic(mnemonic);
    if (!isValidMnemonic) {
      return false;
    }

    // Regenerate DID from mnemonic
    const seed = await mnemonicToSeed(mnemonic, passphrase);
    const didIdentifierKey = deriveDIDIdentifierKey(seed);
    const regeneratedDID = generateDIDIdentifier(didIdentifierKey.privateKey, parsedDID.country);

    return did === regeneratedDID;
  } catch {
    return false;
  }
}
