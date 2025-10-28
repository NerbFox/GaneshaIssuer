/**
 * Utility functions for Verifiable Credentials
 */

import { keccak_256 } from '@noble/hashes/sha3.js';

export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  validFrom: string;
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
  holderDid: string;
  credentialData: Record<string, string | number | boolean>;
  validFrom?: string;
}): VerifiableCredential {
  const { id, vcType, issuerDid, holderDid, credentialData, validFrom } = params;

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://www.w3.org/ns/credentials/examples/v2',
    ],
    id: `http://credentials.example/${id}`,
    type: ['VerifiableCredential', vcType],
    issuer: issuerDid,
    validFrom: validFrom || new Date().toISOString(),
    credentialSubject: {
      id: holderDid,
      ...credentialData,
    },
  };
}

/**
 * Hash a Verifiable Credential using Keccak256
 * Returns a 64-character hex string starting with 0x
 */
export function hashVC(vc: VerifiableCredential): string {
  // Convert VC to canonical JSON string (sorted keys for consistency)
  const vcString = JSON.stringify(vc, Object.keys(vc).sort());

  // Convert string to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(vcString);

  // Hash using Keccak256
  const hashBytes = keccak_256(data);

  // Convert Uint8Array to hex string
  let hashHex = '';
  for (let i = 0; i < hashBytes.length; i++) {
    hashHex += hashBytes[i].toString(16).padStart(2, '0');
  }

  // Return with 0x prefix
  return `0x${hashHex}`;
}

/**
 * Validate VC hash format
 */
export function isValidVCHash(hash: string): boolean {
  const pattern = /^0x[a-fA-F0-9]{64}$/;
  return pattern.test(hash);
}
