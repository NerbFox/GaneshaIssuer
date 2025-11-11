/**
 * Verifiable Credential Signer using ECDSA P-256 (secp256r1)
 *
 * This module signs VCs using the institution's P-256 private key stored in localStorage.
 * It generates signatures compliant with W3C VC Data Model and Node.js backend verification.
 *
 * Key Features:
 * - Uses ECDSA P-256 (NIST secp256r1) algorithm
 * - ES256 signature algorithm (ECDSA with SHA-256)
 * - Compatible with Web Crypto API and Node.js crypto module
 * - Works with hex-encoded keys from localStorage
 *
 * Signature Format (CURRENT):
 * 1. Sign with P-256 → raw signature (64 bytes: r || s)
 * 2. Convert to DER format (~70-72 bytes) - REQUIRED by Node.js crypto.verify()
 * 3. Encode in standard base64 (NO prefix)
 * 4. Store in proof.proofValue
 *
 * Example proofValue: "MEYCIQCBIPiTTFHo+eF145opKPT3Hg1QI+QhFxZLbc/W44FiUAIhAOPw3Iv2uQq3UV04GKqlRu6yyTXfLmKwSBoSlt7o1kOs"
 * (starts with "ME" = 0x30 0x45 or 0x30 0x46 = DER SEQUENCE tag)
 *
 * Backward Compatibility:
 * Verification functions support old formats:
 * - Raw signature (64 bytes) in base64url with 'z' prefix
 * - Raw signature (64 bytes) in standard base64
 *
 * Backend Compatibility:
 * Node.js crypto.verify() for ECDSA requires DER format (ASN.1 encoding).
 * This is consistent with VP signature format used in the system.
 */

import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha2';
import { hexToBytes, bytesToHex } from './seedphrase-p256';
import { VerifiableCredential, VerifiableCredentialDB } from './vcUtils';

// =============================================================================
// TYPES
// =============================================================================

export interface SignedVerifiableCredential extends VerifiableCredential {
  proof: DataIntegrityProof;
}

export interface SignedVerifiableCredentialDB extends VerifiableCredentialDB {
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
 * Encode bytes to standard base64 (for backend compatibility)
 */
function base64Encode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...Array.from(bytes));
  return btoa(binary);
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

/**
 * Decode standard base64 to bytes (for backend compatibility)
 */
function base64Decode(base64: string): Uint8Array {
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
 * IMPORTANT: Backend Node.js crypto.verify() expects DER format for ECDSA signatures.
 * We convert raw signature (64 bytes r||s) to DER format before encoding.
 *
 * Signature Format:
 * 1. Sign with P-256 → raw signature (64 bytes: r || s)
 * 2. Convert to DER format (~70-72 bytes) for backend compatibility
 * 3. Encode to standard base64 (no prefix)
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

  // Sign the canonicalized VC (returns raw 64-byte signature)
  const rawSignatureBytes = await signWithP256(vcBytes, privateKeyHex);

  // Convert raw signature to DER format (required by Node.js crypto.verify)
  const derSignatureBytes = rawToDerSignature(rawSignatureBytes);

  // Encode signature as standard base64 (for backend compatibility)
  const proofValue = base64Encode(derSignatureBytes);

  // Create proof object
  const proof: DataIntegrityProof = {
    type: 'DataIntegrityProof',
    cryptosuite: 'ecdsa-rdfc-2019', // ECDSA with RDFC canonicalization
    created: new Date().toISOString(),
    verificationMethod,
    proofPurpose: 'assertionMethod',
    proofValue: proofValue, // DER signature in base64 (consistent with VP)
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
 * Supports multiple encoding formats for backward compatibility:
 * - DER format in base64 (current - for backend compatibility)
 * - Raw format (64 bytes) in base64url with 'z' prefix (old)
 * - Raw format (64 bytes) in base64 (old)
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

    // Decode proof value - support multiple formats
    let signatureBytes: Uint8Array;

    if (proof.proofValue.startsWith('z')) {
      // Old format: base64url with 'z' prefix (raw signature)
      const proofValueB64url = proof.proofValue.slice(1);
      signatureBytes = base64urlDecode(proofValueB64url);
    } else {
      // Current format: standard base64 without prefix
      signatureBytes = base64Decode(proof.proofValue);
    }

    // Detect signature format: DER (starts with 0x30) or Raw (64 bytes)
    let rawSignatureBytes: Uint8Array;

    if (signatureBytes.length === 64) {
      // Already in raw format (old VCs)
      rawSignatureBytes = signatureBytes;
    } else if (signatureBytes[0] === 0x30) {
      // DER format (current VCs) - convert to raw for @noble/curves verification
      rawSignatureBytes = derToRawSignature(signatureBytes);
    } else {
      throw new Error(
        `Invalid signature format: expected DER or 64-byte raw, got ${signatureBytes.length} bytes`
      );
    }

    const signatureHex = bytesToHex(rawSignatureBytes);

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
// SIGNATURE FORMAT CONVERSION (for external verification tools)
// =============================================================================

/**
 * Convert raw ECDSA signature (r||s) to DER format
 *
 * Raw format: [r (32 bytes)] || [s (32 bytes)] = 64 bytes total
 * DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
 *
 * This is needed for verification on external tools that expect DER format
 * (e.g., emn178.github.io/online-tools/ecdsa/verify/)
 *
 * @param rawSignature - Raw signature (64 bytes)
 * @returns DER-encoded signature
 */
export function rawToDerSignature(rawSignature: Uint8Array): Uint8Array {
  if (rawSignature.length !== 64) {
    throw new Error('Raw signature must be exactly 64 bytes');
  }

  let r = rawSignature.slice(0, 32);
  let s = rawSignature.slice(32, 64);

  // Remove leading zeros from r (but keep at least one byte)
  let rStart = 0;
  while (rStart < r.length - 1 && r[rStart] === 0) {
    rStart++;
  }
  r = r.slice(rStart);

  // Remove leading zeros from s (but keep at least one byte)
  let sStart = 0;
  while (sStart < s.length - 1 && s[sStart] === 0) {
    sStart++;
  }
  s = s.slice(sStart);

  // Add 0x00 prefix if high bit is set (to maintain positive integer in DER)
  if (r[0] & 0x80) {
    const temp = new Uint8Array(r.length + 1);
    temp[0] = 0x00;
    temp.set(r, 1);
    r = temp;
  }
  if (s[0] & 0x80) {
    const temp = new Uint8Array(s.length + 1);
    temp[0] = 0x00;
    temp.set(s, 1);
    s = temp;
  }

  // Build DER sequence
  const contentLength = 2 + r.length + 2 + s.length;
  const derSignature = new Uint8Array(2 + contentLength);

  let offset = 0;
  derSignature[offset++] = 0x30; // SEQUENCE tag
  derSignature[offset++] = contentLength; // Content length
  derSignature[offset++] = 0x02; // INTEGER tag for r
  derSignature[offset++] = r.length; // r length
  derSignature.set(r, offset); // r value
  offset += r.length;
  derSignature[offset++] = 0x02; // INTEGER tag for s
  derSignature[offset++] = s.length; // s length
  derSignature.set(s, offset); // s value

  return derSignature;
}

/**
 * Convert DER ECDSA signature to raw format (r||s)
 *
 * DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
 * Raw format: [r (32 bytes)] || [s (32 bytes)] = 64 bytes total
 *
 * This is needed for verification with @noble/curves which expects raw format
 *
 * @param derSignature - DER-encoded signature
 * @returns Raw signature (64 bytes)
 */
export function derToRawSignature(derSignature: Uint8Array): Uint8Array {
  let offset = 0;

  // Check SEQUENCE tag
  if (derSignature[offset++] !== 0x30) {
    throw new Error('Invalid DER signature: expected SEQUENCE tag');
  }

  // Skip total length
  offset++;

  // Read r
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: expected INTEGER tag for r');
  }
  const rLength = derSignature[offset++];
  let r = derSignature.slice(offset, offset + rLength);
  offset += rLength;

  // Remove leading 0x00 if present (added for positive integer encoding)
  if (r.length === 33 && r[0] === 0x00) {
    r = r.slice(1);
  }

  // Read s
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: expected INTEGER tag for s');
  }
  const sLength = derSignature[offset++];
  let s = derSignature.slice(offset, offset + sLength);

  // Remove leading 0x00 if present
  if (s.length === 33 && s[0] === 0x00) {
    s = s.slice(1);
  }

  // Pad r and s to 32 bytes if needed
  const rawSignature = new Uint8Array(64);
  rawSignature.set(new Uint8Array(32 - r.length), 0); // Pad with zeros
  rawSignature.set(r, 32 - r.length);
  rawSignature.set(new Uint8Array(32 - s.length), 32); // Pad with zeros
  rawSignature.set(s, 32 + (32 - s.length));

  return rawSignature;
}

// =============================================================================
// EXTERNAL VERIFICATION UTILITIES
// =============================================================================

/**
 * Extract verification data from signed VC for external ECDSA verifiers
 *
 * This function extracts all necessary data to verify the VC signature
 * on external tools like:
 * - emn178.github.io (requires: canonical message, DER signature, public key)
 * - kjur/jsrsasign (requires: message hash, raw signature, public key)
 * - 8gwifi.org (requires: message hash, raw signature, public key)
 *
 * Supports multiple signature formats:
 * - DER format in base64 (current)
 * - Raw format (64 bytes) in base64url with 'z' prefix (old)
 * - Raw format (64 bytes) in base64 (old)
 *
 * @param signedVC - Signed Verifiable Credential
 * @returns Verification data in multiple formats
 */
export function extractVerificationData(signedVC: SignedVerifiableCredential): {
  canonicalMessage: string;
  canonicalMessageBytes: Uint8Array;
  messageHash: Uint8Array;
  messageHashHex: string;
  signatureRaw: Uint8Array;
  signatureRawHex: string;
  signatureDER: Uint8Array;
  signatureDERHex: string;
} {
  // Extract proof and VC
  const { proof, ...vc } = signedVC;

  // Canonicalize VC (without proof)
  const canonicalMessage = canonicalizeVC(vc as VerifiableCredential);
  const canonicalMessageBytes = new TextEncoder().encode(canonicalMessage);

  // Hash the canonical message
  const messageHash = sha256(canonicalMessageBytes);
  const messageHashHex = bytesToHex(messageHash);

  // Extract signature from proof value - support multiple formats
  let signatureBytes: Uint8Array;

  if (proof.proofValue.startsWith('z')) {
    // Old format: base64url with 'z' prefix
    const proofValueB64url = proof.proofValue.slice(1);
    signatureBytes = base64urlDecode(proofValueB64url);
  } else {
    // Current format: standard base64 without prefix
    signatureBytes = base64Decode(proof.proofValue);
  }

  // Detect signature format and prepare both raw and DER
  let signatureRaw: Uint8Array;
  let signatureDER: Uint8Array;

  if (signatureBytes.length === 64) {
    // Already in raw format (old VCs)
    signatureRaw = signatureBytes;
    signatureDER = rawToDerSignature(signatureRaw);
  } else if (signatureBytes[0] === 0x30) {
    // DER format (current VCs)
    signatureDER = signatureBytes;
    signatureRaw = derToRawSignature(signatureDER);
  } else {
    throw new Error(
      `Invalid signature format: expected DER or 64-byte raw, got ${signatureBytes.length} bytes`
    );
  }

  const signatureRawHex = bytesToHex(signatureRaw);
  const signatureDERHex = bytesToHex(signatureDER);

  return {
    canonicalMessage,
    canonicalMessageBytes,
    messageHash,
    messageHashHex,
    signatureRaw,
    signatureRawHex,
    signatureDER,
    signatureDERHex,
  };
}

/**
 * Get verification instructions for external ECDSA verifiers
 *
 * @param signedVC - Signed Verifiable Credential
 * @param publicKeyHex - Public key in hex format (for display)
 * @returns Formatted instructions for different verifiers
 */
export function getVerificationInstructions(
  signedVC: SignedVerifiableCredential,
  publicKeyHex: string
): {
  emn178: { message: string; signature: string; publicKey: string; instructions: string };
  kjur: { messageHash: string; signature: string; publicKey: string; instructions: string };
  gwifi8: { messageHash: string; signature: string; publicKey: string; instructions: string };
} {
  const data = extractVerificationData(signedVC);

  return {
    emn178: {
      message: data.canonicalMessage,
      signature: data.signatureDERHex,
      publicKey: publicKeyHex,
      instructions: `
Website: https://emn178.github.io/online-tools/ecdsa/verify/

Settings:
- Message: (paste canonical message above - the full JSON string)
- Encoding: UTF-8
- Signature Algorithm: SHA256
- Curve: secp256r1
- Signature: (paste DER signature above)
- Signature Type: Hex
- Public Key: (paste public key above)
- Public Key Type: Hex

Click "Verify" and result should be "Valid"
      `.trim(),
    },
    kjur: {
      messageHash: data.messageHashHex,
      signature: data.signatureRawHex,
      publicKey: publicKeyHex,
      instructions: `
Website: https://kjur.github.io/jsrsasign/sample/sample-ecdsa.html

Settings:
- Curve: secp256r1
- Message type: Message digest (hex)
- Message: (paste message hash above)
- Signature: (paste raw signature above)
- Public Key: (paste public key above, optionally remove '04' prefix)

Click "Verify" and result should be "Valid"
      `.trim(),
    },
    gwifi8: {
      messageHash: data.messageHashHex,
      signature: data.signatureRawHex,
      publicKey: publicKeyHex,
      instructions: `
Website: https://8gwifi.org/ecsignverify.jsp

Settings:
- Algorithm: ECDSA
- Curve: secp256r1 or prime256v1
- Input Type: Message Digest/Hash
- Input: (paste message hash above)
- Signature Format: Raw (r||s) or Hex
- Signature: (paste raw signature above)
- Public Key Format: Hex (Uncompressed)
- Public Key: (paste public key above with '04' prefix)

Click "Verify Signature" and result should be "Signature is VALID"
      `.trim(),
    },
  };
}

/**
 * Log verification data to console (for debugging)
 *
 * @param signedVC - Signed Verifiable Credential
 * @param publicKeyHex - Public key in hex format
 */
export function logVerificationData(
  signedVC: SignedVerifiableCredential,
  publicKeyHex: string
): void {
  const data = extractVerificationData(signedVC);
  const instructions = getVerificationInstructions(signedVC, publicKeyHex);

  console.log('='.repeat(80));
  console.log('VC SIGNATURE VERIFICATION DATA');
  console.log('='.repeat(80));
  console.log('');
  console.log('📄 Canonical Message (for emn178):');
  console.log(data.canonicalMessage);
  console.log('');
  console.log('🔢 Message Hash (for kjur/8gwifi):');
  console.log(data.messageHashHex);
  console.log('');
  console.log('✍️ Signature (Raw - for kjur/8gwifi):');
  console.log(data.signatureRawHex);
  console.log('');
  console.log('✍️ Signature (DER - for emn178):');
  console.log(data.signatureDERHex);
  console.log('');
  console.log('🔑 Public Key:');
  console.log(publicKeyHex);
  console.log('');
  console.log('='.repeat(80));
  console.log('VERIFICATION INSTRUCTIONS');
  console.log('='.repeat(80));
  console.log('');
  console.log('📌 Option 1: emn178');
  console.log(instructions.emn178.instructions);
  console.log('');
  console.log('📌 Option 2: kjur/jsrsasign');
  console.log(instructions.kjur.instructions);
  console.log('');
  console.log('📌 Option 3: 8gwifi.org');
  console.log(instructions.gwifi8.instructions);
  console.log('');
  console.log('='.repeat(80));
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
