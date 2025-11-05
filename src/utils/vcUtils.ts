/**
 * Utility functions for Verifiable Credentials
 * Following W3C VC Data Model standards
 */

import { sha256 } from '@noble/hashes/sha2';

export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuerName: string;
  validFrom: string;
  expiredAt: string | null;
  imageLink: string | null;
  credentialSubject: {
    id: string;
    [key: string]: string | number | boolean;
  };
}

/**
 * Create a Verifiable Credential object
 */
export function createVC(params: {
  id: string;
  vcType: string;
  issuerDid: string;
  issuerName: string;
  holderDid: string;
  credentialData: Record<string, string | number | boolean>;
  validFrom?: string;
  imageLink: string | null;
  expiredAt: string | null;
}): VerifiableCredential {
  const {
    id,
    vcType,
    issuerDid,
    holderDid,
    credentialData,
    validFrom,
    expiredAt,
    imageLink,
    issuerName,
  } = params;

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://www.w3.org/ns/credentials/examples/v2',
    ],
    id: id,
    type: ['VerifiableCredential', vcType],
    issuer: issuerDid,
    issuerName: issuerName,
    validFrom: validFrom || new Date().toISOString(),
    expiredAt: expiredAt || null,
    imageLink: imageLink || null,
    credentialSubject: {
      id: holderDid,
      ...credentialData,
    },
  };
}

/**
 * Hash a Verifiable Credential using SHA-256
 * Returns a 64-character hex string (without 0x prefix)
 *
 * Note: SHA-256 is the standard hash function for W3C Verifiable Credentials
 * and is used in the Data Integrity proofs specification.
 */
export function hashVC(vc: VerifiableCredential): string {
  // Convert VC to canonical JSON string (sorted keys for consistency)
  const vcString = JSON.stringify(vc, Object.keys(vc).sort());

  // Convert string to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(vcString);

  // Hash using SHA-256 (W3C standard for VCs)
  const hashBytes = sha256(data);

  // Convert Uint8Array to hex string
  let hashHex = '';
  for (let i = 0; i < hashBytes.length; i++) {
    hashHex += hashBytes[i].toString(16).padStart(2, '0');
  }

  // Return WITHOUT 0x prefix (64 characters)
  return hashHex;
}

/**
 * Validate VC hash format (64-character hex string without 0x prefix)
 */
export function isValidVCHash(hash: string): boolean {
  const pattern = /^[a-fA-F0-9]{64}$/;
  return pattern.test(hash);
}
