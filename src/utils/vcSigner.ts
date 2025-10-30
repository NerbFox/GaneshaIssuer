/**
 * Verifiable Credential Signer using ES256
 *
 * This module signs Verifiable Credentials using ECDSA P-256 (ES256)
 * and adds a DataIntegrityProof to the credential.
 */

import { signJWT } from './jwt-es256';
import { VerifiableCredential } from './vcUtils';

/**
 * Proof structure for Verifiable Credentials
 */
export interface DataIntegrityProof {
  type: 'DataIntegrityProof';
  cryptosuite: string;
  created: string;
  verificationMethod: string;
  proofPurpose: 'assertionMethod';
  proofValue: string;
}

/**
 * Verifiable Credential with Proof
 */
export interface VerifiableCredentialWithProof extends VerifiableCredential {
  proof: DataIntegrityProof;
}

/**
 * Sign a Verifiable Credential using ES256
 *
 * @param vc - The Verifiable Credential to sign
 * @param privateKey - Private key (CryptoKey, Uint8Array, or hex string)
 * @param issuerDid - Issuer DID for verification method
 * @returns Signed Verifiable Credential with proof
 */
export async function signVC(
  vc: VerifiableCredential,
  privateKey: CryptoKey | Uint8Array | string
  //   issuerDid?: string
): Promise<VerifiableCredentialWithProof> {
  // Create the payload to sign (the entire VC without proof)
  const vcPayload = {
    '@context': vc['@context'],
    id: vc.id,
    type: vc.type,
    issuer: vc.issuer,
    issuerName: vc.issuerName,
    validFrom: vc.validFrom,
    credentialSubject: vc.credentialSubject,
  };

  // Sign the VC payload as a JWT
  const signature = await signJWT(vcPayload, privateKey);

  // Extract just the signature part (base64url encoded)
  const signatureParts = signature.split('.');
  const proofValue = signatureParts[2]; // Get the signature part

  // Create the proof object
  const proof: DataIntegrityProof = {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-rdfc-2022',
    created: new Date().toISOString(),
    verificationMethod: 'https://university.example/issuers/14#key-1',
    proofPurpose: 'assertionMethod',
    proofValue: `z${proofValue}`, // Add 'z' prefix for multibase encoding
  };

  // Return VC with proof
  return {
    ...vc,
    proof,
  };
}

/**
 * Sign a Verifiable Credential using private key from localStorage
 *
 * @param vc - The Verifiable Credential to sign
 * @returns Signed Verifiable Credential with proof
 * @throws Error if private key is not found in localStorage
 */
export async function signVCWithStoredKey(
  vc: VerifiableCredential
): Promise<VerifiableCredentialWithProof> {
  // Get private key from localStorage
  const privateKeyHex = localStorage.getItem('institutionSigningPrivateKey');

  if (!privateKeyHex) {
    throw new Error('Institution signing private key not found in localStorage');
  }

  // Get issuer DID for verification method
  //   const issuerDid = localStorage.getItem('institutionDID');

  // Sign the VC
  return await signVC(vc, privateKeyHex); // , issuerDid || undefined
}

/**
 * Verify a signed Verifiable Credential
 *
 * @param signedVC - The signed VC with proof
 * @param publicKey - Public key for verification (CryptoKey or Uint8Array)
 * @returns True if signature is valid
 */
// export async function verifySignedVC(
//   signedVC: VerifiableCredentialWithProof,
//   publicKey: CryptoKey | Uint8Array
// ): Promise<boolean> {
//   try {
//     // Extract the VC payload (without proof)
//     const { proof, ...vcPayload } = signedVC;

//     // Reconstruct JWT for verification
//     // Note: This is a simplified verification
//     // In production, you'd use proper JWT verification with the public key

//     return true; // Placeholder - implement proper verification if needed
//   } catch (error) {
//     console.error('Error verifying signed VC:', error);
//     return false;
//   }
// }

/**
 * Convert signed VC to JSON string for API submission
 *
 * @param signedVC - The signed VC with proof
 * @returns JSON string representation
 */
export function stringifySignedVC(signedVC: VerifiableCredentialWithProof): string {
  return JSON.stringify(signedVC);
}
