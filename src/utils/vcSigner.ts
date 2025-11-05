/**
 * Verifiable Credential Signer using ECDSA P-256 (secp256r1)
 *
 * This module signs VCs using the institution's P-256 private key stored in localStorage.
 * It generates JSON Web Signatures (JWS) compliant with W3C VC Data Model.
 *
 * Key Features:
 * - Uses ECDSA P-256 (NIST secp256r1) algorithm
 * - ES256 signature algorithm (ECDSA with SHA-256)
 * - Compatible with Web Crypto API
 * - Works with hex-encoded keys from localStorage
 */

import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha2';
import { hexToBytes, bytesToHex } from './seedphrase-p256';
import { VerifiableCredential } from './vcUtils';

// =============================================================================
// TYPES
// =============================================================================

export interface SignedVerifiableCredential extends VerifiableCredential {
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
// BASE64URL ENCODING (RFC 7515)
// =============================================================================

/**
 * Encode bytes to base64url (RFC 7515 - URL-safe base64 without padding)
 */
function base64urlEncode(bytes: Uint8Array): string {
  // Convert to base64
  let base64 = '';
  const binary = String.fromCharCode(...Array.from(bytes));
  base64 = btoa(binary);

  // Convert to base64url (replace +/= with -/_ and remove padding)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode base64url to bytes
 */
function base64urlDecode(base64url: string): Uint8Array {
  // Convert base64url to base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  // Decode base64 to binary string
  const binary = atob(base64);

  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

// =============================================================================
// JWS HEADER AND PAYLOAD
// =============================================================================

/**
 * Create JWS header for ES256 (ECDSA P-256 with SHA-256)
 */
function createJWSHeader(): object {
  return {
    alg: 'ES256', // ECDSA with SHA-256
    b64: false, // Unencoded payload (RFC 7797)
    crit: ['b64'], // Critical header parameter
  };
}

/**
 * Canonicalize VC for signing (deterministic JSON serialization)
 */
function canonicalizeVC(vc: VerifiableCredential): string {
  // Sort keys recursively for deterministic output
  const sortedVC = JSON.stringify(vc, Object.keys(vc).sort());
  return sortedVC;
}

// =============================================================================
// ECDSA P-256 SIGNING
// =============================================================================

/**
 * Sign data with ECDSA P-256 using private key
 * Returns signature in IEEE P1363 format (r || s, 64 bytes)
 *
 * @param data - Data to sign
 * @param privateKeyHex - Private key in hex format
 * @returns Signature bytes (64 bytes: 32 bytes r + 32 bytes s)
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

// =============================================================================
// JWS CREATION
// =============================================================================

/**
 * Create JWS (JSON Web Signature) for VC
 * Uses ES256 algorithm with detached payload (RFC 7515 + RFC 7797)
 *
 * @param vc - Verifiable Credential to sign
 * @param privateKeyHex - Private key in hex format
 * @param verificationMethod - DID URL for verification method
 * @returns JWS string in compact serialization format
 */
export async function createJWS(vc: VerifiableCredential, privateKeyHex: string): Promise<string> {
  // Step 1: Create JWS header
  const header = createJWSHeader();
  const headerJSON = JSON.stringify(header);
  const headerBytes = new TextEncoder().encode(headerJSON);
  const headerB64 = base64urlEncode(headerBytes);

  // Step 2: Canonicalize VC payload
  const payloadJSON = canonicalizeVC(vc);
  const payloadBytes = new TextEncoder().encode(payloadJSON);

  // Step 3: Create signing input (header.payload)
  // For detached payload (b64: false), use raw payload bytes
  const signingInput = new Uint8Array(headerBytes.length + 1 + payloadBytes.length);
  signingInput.set(headerBytes, 0);
  signingInput.set(new TextEncoder().encode('.'), headerBytes.length);
  signingInput.set(payloadBytes, headerBytes.length + 1);

  // Step 4: Sign the input
  const signatureBytes = await signWithP256(signingInput, privateKeyHex);
  const signatureB64 = base64urlEncode(signatureBytes);

  // Step 5: Create JWS compact serialization (header..signature)
  // Note: Empty payload (detached) represented by empty string between dots
  const jws = `${headerB64}..${signatureB64}`;

  return jws;
}

// =============================================================================
// PROOF GENERATION
// =============================================================================

/**
 * Generate Data Integrity Proof for VC using ECDSA P-256
 * Creates proof according to W3C VC Data Integrity spec
 *
 * @param vc - Verifiable Credential to sign
 * @param privateKeyHex - Private key in hex format
 * @param publicKeyHex - Public key in hex format (for verification method)
 * @param issuerDid - Issuer DID
 * @returns Data Integrity Proof object
 */
async function generateProof(
  vc: VerifiableCredential,
  privateKeyHex: string,
  publicKeyHex: string,
  issuerDid: string
): Promise<DataIntegrityProof> {
  // Create verification method URL (DID URL with key fragment)
  const verificationMethod = `${issuerDid}#key-1`;

  // Canonicalize VC
  const vcCanonical = canonicalizeVC(vc);
  const vcBytes = new TextEncoder().encode(vcCanonical);

  // Sign the canonicalized VC
  const signatureBytes = await signWithP256(vcBytes, privateKeyHex);

  // Encode signature as base64url
  const proofValue = base64urlEncode(signatureBytes);

  // Create proof object
  const proof: DataIntegrityProof = {
    type: 'DataIntegrityProof',
    cryptosuite: 'ecdsa-rdfc-2019', // ECDSA with RDFC canonicalization
    created: new Date().toISOString(),
    verificationMethod,
    proofPurpose: 'assertionMethod',
    proofValue: `z${proofValue}`, // Add 'z' prefix for multibase (base58btc convention)
  };

  return proof;
}

// =============================================================================
// MAIN SIGNING FUNCTIONS
// =============================================================================

/**
 * Sign Verifiable Credential with stored private key from localStorage
 *
 * @param vc - Verifiable Credential to sign
 * @returns Signed VC with Data Integrity Proof
 * @throws Error if keys not found or signing fails
 */
export async function signVCWithStoredKey(
  vc: VerifiableCredential
): Promise<SignedVerifiableCredential> {
  // Get keys from localStorage
  const privateKeyHex = localStorage.getItem('institutionSigningPrivateKey');
  const publicKeyHex = localStorage.getItem('institutionSigningPublicKey');
  const issuerDid = localStorage.getItem('institutionDID');

  if (!privateKeyHex || !publicKeyHex || !issuerDid) {
    throw new Error('Institution keys not found in localStorage');
  }

  // Generate proof
  const proof = await generateProof(vc, privateKeyHex, publicKeyHex, issuerDid);

  // Return signed VC
  return {
    ...vc,
    proof,
  };
}

/**
 * Sign Verifiable Credential with provided keys
 *
 * @param vc - Verifiable Credential to sign
 * @param privateKeyHex - Private key in hex format
 * @param publicKeyHex - Public key in hex format
 * @param issuerDid - Issuer DID
 * @returns Signed VC with Data Integrity Proof
 */
export async function signVC(
  vc: VerifiableCredential,
  privateKeyHex: string,
  publicKeyHex: string,
  issuerDid: string
): Promise<SignedVerifiableCredential> {
  const proof = await generateProof(vc, privateKeyHex, publicKeyHex, issuerDid);

  return {
    ...vc,
    proof,
  };
}

// =============================================================================
// VERIFICATION FUNCTIONS
// =============================================================================

/**
 * Verify ECDSA P-256 signature
 *
 * @param data - Original data that was signed
 * @param signatureHex - Signature in hex format (64 bytes)
 * @param publicKeyHex - Public key in hex format
 * @returns True if signature is valid
 */
export async function verifySignature(
  data: Uint8Array,
  signatureHex: string,
  publicKeyHex: string
): Promise<boolean> {
  try {
    const signatureBytes = hexToBytes(signatureHex);
    const publicKeyBytes = hexToBytes(publicKeyHex);

    // Hash the data
    const messageHash = sha256(data);

    // Verify signature using raw bytes (r || s format)
    const isValid = p256.verify(signatureBytes, messageHash, publicKeyBytes);

    return isValid;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Verify signed Verifiable Credential
 *
 * @param signedVC - Signed VC with proof
 * @param publicKeyHex - Public key in hex format
 * @returns True if VC signature is valid
 */
export async function verifySignedVC(
  signedVC: SignedVerifiableCredential,
  publicKeyHex: string
): Promise<boolean> {
  try {
    // Extract proof
    const { proof, ...vc } = signedVC;

    // Decode proof value (remove 'z' prefix and decode base64url)
    const proofValueB64 = proof.proofValue.startsWith('z')
      ? proof.proofValue.slice(1)
      : proof.proofValue;

    const signatureBytes = base64urlDecode(proofValueB64);
    const signatureHex = bytesToHex(signatureBytes);

    // Canonicalize VC
    const vcCanonical = canonicalizeVC(vc as VerifiableCredential);
    const vcBytes = new TextEncoder().encode(vcCanonical);

    // Verify signature
    return await verifySignature(vcBytes, signatureHex, publicKeyHex);
  } catch (error) {
    console.error('VC verification failed:', error);
    return false;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert signed VC to JSON string (for storage/transmission)
 */
export function stringifySignedVC(signedVC: SignedVerifiableCredential): string {
  return JSON.stringify(signedVC, null, 2);
}

/**
 * Parse signed VC from JSON string
 */
export function parseSignedVC(jsonString: string): SignedVerifiableCredential {
  return JSON.parse(jsonString) as SignedVerifiableCredential;
}
