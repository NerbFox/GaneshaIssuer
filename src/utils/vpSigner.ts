/**
 * Verifiable Presentation Signer using ECDSA P-256 (secp256r1)
 *
 * This module creates and signs VPs using the institution's P-256 private key stored in localStorage.
 * It generates signatures compliant with W3C VP Data Model.
 *
 * Key Features:
 * - Uses ECDSA P-256 (NIST secp256r1) algorithm
 * - ES256 signature algorithm (ECDSA with SHA-256)
 * - Compatible with @noble/curves library
 * - Works with hex-encoded keys from localStorage
 *
 * VP Structure:
 * {
 *   "@context": ["https://www.w3.org/2018/credentials/v1"],
 *   "type": ["VerifiablePresentation"],
 *   "holder": "did:dcert:...",
 *   "verifiableCredential": [...],
 *   "proof": {
 *     "type": "DataIntegrityProof",
 *     "cryptosuite": "ecdsa-rdfc-2019",
 *     "created": "2024-01-01T00:00:00Z",
 *     "verificationMethod": "did:dcert:...#key-1",
 *     "proofPurpose": "authentication",
 *     "proofValue": "..."
 *   }
 * }
 */

import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha2';
import { hexToBytes } from './seedphrase-p256';
import { VerifiableCredential } from '@/utils/indexedDB';

// =============================================================================
// TYPES
// =============================================================================

export interface VerifiablePresentation {
  '@context': string[];
  type: string[];
  holder: string;
  verifiableCredential: VerifiableCredential[];
  proof?: DataIntegrityProof;
}

export interface SignedVerifiablePresentation extends VerifiablePresentation {
  proof: DataIntegrityProof;
}

export interface DataIntegrityProof {
  type: string;
  cryptosuite: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}

// =============================================================================
// UTILITY FUNCTIONS (from vcSigner.ts)
// =============================================================================

/**
 * Encode bytes to standard base64
 */
function base64Encode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...Array.from(bytes));
  return btoa(binary);
}

/**
 * Canonicalize VP for signing (deterministic JSON serialization)
 */
function canonicalizeVP(vp: VerifiablePresentation): string {
  // Create a copy without proof
  const vpWithoutProof = { ...vp };
  delete vpWithoutProof.proof;

  // Simple canonicalization: stringify with sorted keys
  return JSON.stringify(vpWithoutProof, Object.keys(vpWithoutProof).sort());
}

// =============================================================================
// ECDSA P-256 SIGNING (from vcSigner.ts)
// =============================================================================

/**
 * Sign data with ECDSA P-256 using private key
 * Returns signature in IEEE P1363 format (r || s, 64 bytes)
 */
async function signWithP256(data: Uint8Array, privateKeyHex: string): Promise<Uint8Array> {
  const privateKeyBytes = hexToBytes(privateKeyHex);

  // Hash the data with SHA-256
  const messageHash = sha256(data);

  // Sign with P-256 - returns signature object
  // Convert to raw bytes format (64 bytes: r || s)
  const signature = p256.sign(messageHash, privateKeyBytes);
  const signatureBytes = signature.toCompactRawBytes();

  return signatureBytes;
}

/**
 * Convert raw ECDSA signature (r||s) to DER format
 * This is needed for backend compatibility
 */
function rawToDerSignature(rawSignature: Uint8Array): Uint8Array {
  if (rawSignature.length !== 64) {
    throw new Error('Invalid raw signature length. Expected 64 bytes.');
  }

  // Split into r and s (32 bytes each)
  const r = rawSignature.slice(0, 32);
  const s = rawSignature.slice(32, 64);

  // Remove leading zeros from r and s (but keep at least one byte)
  let rStart = 0;
  while (rStart < r.length - 1 && r[rStart] === 0) {
    rStart++;
  }
  const rTrimmed = r.slice(rStart);

  let sStart = 0;
  while (sStart < s.length - 1 && s[sStart] === 0) {
    sStart++;
  }
  const sTrimmed = s.slice(sStart);

  // Add 0x00 prefix if high bit is set (to keep it positive)
  const rBytes = rTrimmed[0] >= 0x80 ? new Uint8Array([0x00, ...rTrimmed]) : rTrimmed;
  const sBytes = sTrimmed[0] >= 0x80 ? new Uint8Array([0x00, ...sTrimmed]) : sTrimmed;

  // Build DER: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  const totalLength = 2 + rBytes.length + 2 + sBytes.length;
  const der = new Uint8Array(2 + totalLength);

  let offset = 0;
  der[offset++] = 0x30; // SEQUENCE tag
  der[offset++] = totalLength;
  der[offset++] = 0x02; // INTEGER tag for r
  der[offset++] = rBytes.length;
  der.set(rBytes, offset);
  offset += rBytes.length;
  der[offset++] = 0x02; // INTEGER tag for s
  der[offset++] = sBytes.length;
  der.set(sBytes, offset);

  return der;
}

// =============================================================================
// VP CREATION
// =============================================================================

/**
 * Create an unsigned Verifiable Presentation
 *
 * @param holder - Holder DID
 * @param verifiableCredentials - Array of VCs to include in the VP
 * @returns Unsigned VP
 */
export function createVerifiablePresentation(
  holder: string,
  verifiableCredentials: VerifiableCredential[]
): VerifiablePresentation {
  return {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiablePresentation'],
    holder,
    verifiableCredential: verifiableCredentials,
  };
}

// =============================================================================
// VP SIGNING
// =============================================================================

/**
 * Generate Data Integrity Proof for VP using ECDSA P-256
 *
 * @param vp - Verifiable Presentation to sign
 * @param privateKeyHex - Private key in hex format
 * @param publicKeyHex - Public key in hex format (for verification method)
 * @param holderDid - Holder DID
 * @returns Data Integrity Proof object
 */
async function generateProof(
  vp: VerifiablePresentation,
  privateKeyHex: string,
  publicKeyHex: string,
  holderDid: string
): Promise<DataIntegrityProof> {
  // Canonicalize VP
  const canonicalVP = canonicalizeVP(vp);
  const vpBytes = new TextEncoder().encode(canonicalVP);

  // Sign with P-256
  const rawSignature = await signWithP256(vpBytes, privateKeyHex);

  // Convert to DER format for backend compatibility
  const derSignature = rawToDerSignature(rawSignature);

  // Encode to base64
  const proofValue = base64Encode(derSignature);

  // Create proof
  const proof: DataIntegrityProof = {
    type: 'DataIntegrityProof',
    cryptosuite: 'ecdsa-rdfc-2019',
    created: new Date().toISOString(),
    verificationMethod: `${holderDid}#key-1`,
    proofPurpose: 'authentication',
    proofValue,
  };

  return proof;
}

/**
 * Sign Verifiable Presentation with stored private key from localStorage
 *
 * @param vp - Verifiable Presentation to sign
 * @returns Signed VP with Data Integrity Proof
 * @throws Error if keys not found or signing fails
 */
export async function signVPWithStoredKey(
  vp: VerifiablePresentation
): Promise<SignedVerifiablePresentation> {
  // Get keys from localStorage
  const privateKeyHex = localStorage.getItem('institutionSigningPrivateKey');
  const publicKeyHex = localStorage.getItem('institutionSigningPublicKey');
  const holderDid = localStorage.getItem('institutionDID');

  if (!privateKeyHex) {
    throw new Error('Private key not found in localStorage');
  }

  if (!publicKeyHex) {
    throw new Error('Public key not found in localStorage');
  }

  if (!holderDid) {
    throw new Error('Holder DID not found in localStorage');
  }

  return signVP(vp, privateKeyHex, publicKeyHex, holderDid);
}

/**
 * Sign Verifiable Presentation with provided keys
 *
 * @param vp - Verifiable Presentation to sign
 * @param privateKeyHex - Private key in hex format
 * @param publicKeyHex - Public key in hex format
 * @param holderDid - Holder DID
 * @returns Signed VP with Data Integrity Proof
 */
export async function signVP(
  vp: VerifiablePresentation,
  privateKeyHex: string,
  publicKeyHex: string,
  holderDid: string
): Promise<SignedVerifiablePresentation> {
  // Generate proof
  const proof = await generateProof(vp, privateKeyHex, publicKeyHex, holderDid);

  // Return signed VP
  return {
    ...vp,
    proof,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert signed VP to JSON string (for storage/transmission)
 */
export function stringifySignedVP(signedVP: SignedVerifiablePresentation): string {
  return JSON.stringify(signedVP);
}

/**
 * Parse signed VP from JSON string
 */
export function parseSignedVP(jsonString: string): SignedVerifiablePresentation {
  return JSON.parse(jsonString) as SignedVerifiablePresentation;
}
