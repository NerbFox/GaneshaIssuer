/**
 * Verifiable Presentation (VP) Generator for Institution
 * Creates and signs VPs for credential holders
 */

import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha2';
import { hexToBytes } from './seedphrase-p256';
import { buildApiUrl, API_ENDPOINTS } from './api';
import { authenticatedPost } from './api-client';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Data Integrity Proof Structure
 */
export interface DataIntegrityProof {
  type: string;
  cryptosuite: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}

/**
 * Verifiable Credential Structure
 */
export interface VerifiableCredential {
  '@context': string | string[];
  id: string;
  type: string[];
  issuer: string;
  issuerName?: string;
  validFrom: string;
  expiredAt?: string | null;
  expirationDate?: string;
  imageLink?: string | null;
  fileId?: string | null;
  fileUrl?: string | null;
  credentialSubject: {
    id: string;
    [key: string]: string | number | boolean | null | undefined;
  };
  proof?: DataIntegrityProof;
}

/**
 * Verifiable Presentation Structure
 */
export interface VerifiablePresentation {
  '@context': string[];
  type: string[];
  holder: string;
  verifiableCredential: VerifiableCredential[];
  proof?: DataIntegrityProof;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Canonicalize JSON object for signing (matches backend)
 */
function canonicalizeJSON(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

/**
 * Encode bytes to standard base64
 */
function base64Encode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...Array.from(bytes));
  return btoa(binary);
}

/**
 * Convert raw ECDSA signature (64 bytes) to DER format
 */
function rawToDerSignature(rawSignature: Uint8Array): Uint8Array {
  if (rawSignature.length !== 64) {
    throw new Error('Raw signature must be 64 bytes');
  }

  const r = rawSignature.slice(0, 32);
  const s = rawSignature.slice(32, 64);

  function encodeDERInteger(value: Uint8Array): Uint8Array {
    let paddedValue = value;
    if (value[0] & 0x80) {
      paddedValue = new Uint8Array([0x00, ...value]);
    }
    let start = 0;
    while (
      start < paddedValue.length - 1 &&
      paddedValue[start] === 0x00 &&
      !(paddedValue[start + 1] & 0x80)
    ) {
      start++;
    }
    paddedValue = paddedValue.slice(start);
    return new Uint8Array([0x02, paddedValue.length, ...paddedValue]);
  }

  const derR = encodeDERInteger(r);
  const derS = encodeDERInteger(s);
  const derSequence = new Uint8Array([...derR, ...derS]);

  return new Uint8Array([0x30, derSequence.length, ...derSequence]);
}

/**
 * Sign data with P-256 private key
 */
async function signWithP256(data: Uint8Array, privateKeyHex: string): Promise<Uint8Array> {
  const privateKeyBytes = hexToBytes(privateKeyHex);
  const messageHash = sha256(data);
  const signature = p256.sign(messageHash, privateKeyBytes);
  return signature.toCompactRawBytes();
}

// =============================================================================
// VP CREATION AND SIGNING
// =============================================================================

/**
 * Create Verifiable Presentation from VC
 * @param vc - Verifiable Credential to include
 * @param holderDid - Holder's DID
 * @returns Unsigned Verifiable Presentation
 */
export function createVerifiablePresentation(
  vc: VerifiableCredential,
  holderDid: string
): VerifiablePresentation {
  const vp: VerifiablePresentation = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://www.w3.org/2018/credentials/examples/v1',
    ],
    type: ['VerifiablePresentation'],
    holder: holderDid,
    verifiableCredential: [vc],
  };

  return vp;
}

/**
 * Sign Verifiable Presentation with holder's private key
 * @param vp - Unsigned VP
 * @param holderPrivateKey - Holder's private key (hex)
 * @param holderDid - Holder's DID
 * @returns Signed VP with proof
 */
export async function signVerifiablePresentation(
  vp: VerifiablePresentation,
  holderPrivateKey: string,
  holderDid: string
): Promise<VerifiablePresentation> {
  // Create proof structure
  const proof: Omit<DataIntegrityProof, 'proofValue'> = {
    type: 'DataIntegrityProof',
    cryptosuite: 'ecdsa-rdfc-2019',
    created: new Date().toISOString(),
    verificationMethod: `${holderDid}#key-1`,
    proofPurpose: 'authentication',
  };

  // Create document to sign (VP without proof)
  const vpWithoutProof = { ...vp };
  delete vpWithoutProof.proof;

  // Canonicalize and sign
  const canonical = canonicalizeJSON(vpWithoutProof);
  const dataBytes = new TextEncoder().encode(canonical);

  // Sign with P-256
  const rawSignature = await signWithP256(dataBytes, holderPrivateKey);

  // Convert to DER format (required by backend)
  const derSignature = rawToDerSignature(rawSignature);

  // Encode to base64
  const proofValue = base64Encode(derSignature);

  // Create signed VP
  const signedVP: VerifiablePresentation = {
    ...vp,
    proof: {
      ...proof,
      proofValue,
    },
  };

  return signedVP;
}

/**
 * Store VP to backend
 * @param vp - Signed Verifiable Presentation
 * @returns Object with VP ID and success status
 */
export async function storeVPToBackend(vp: VerifiablePresentation): Promise<{
  success: boolean;
  vp_id: string;
  message: string;
}> {
  try {
    console.log('📤 Storing VP to backend...');

    const storeUrl = buildApiUrl(API_ENDPOINTS.PRESENTATIONS.BASE);

    // Backend expects VP as JSON string, not object
    const vpString = JSON.stringify(vp);

    const response = await authenticatedPost(storeUrl, {
      vp: vpString,
      is_barcode: true,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to store VP');
    }

    const result = await response.json();
    console.log('✅ VP stored successfully:', result.data.vp_id);

    return {
      success: true,
      vp_id: result.data.vp_id,
      message: result.message,
    };
  } catch (error) {
    console.error('❌ Failed to store VP:', error);
    throw error;
  }
}

/**
 * Create and sign VP, then store to backend
 * @param vc - Verifiable Credential
 * @param holderPrivateKey - Holder's private key (hex)
 * @param holderDid - Holder's DID
 * @returns Object with VP ID
 */
export async function createAndStoreVP(
  vc: VerifiableCredential,
  holderPrivateKey: string,
  holderDid: string
): Promise<string> {
  console.log('🔐 Creating VP for credential:', vc.id);

  // Step 1: Create VP
  const vp = createVerifiablePresentation(vc, holderDid);
  console.log('✅ VP created');

  // Step 2: Sign VP
  const signedVP = await signVerifiablePresentation(vp, holderPrivateKey, holderDid);
  console.log('✅ VP signed');

  // Step 3: Store to backend
  const result = await storeVPToBackend(signedVP);

  return result.vp_id;
}
