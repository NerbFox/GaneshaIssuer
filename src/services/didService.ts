/**
 * DID Service
 * Handles all DID (Decentralized Identifier) related API operations
 */

import { API_ENDPOINTS, buildApiUrl } from '@/utils/api';
import { authenticatedGet } from '@/utils/api-client';

// =============================================================================
// TYPES
// =============================================================================

export interface DIDDocument {
  success: boolean;
  data: {
    keyId: string; // The key identifier (e.g., "#key-1")
    id?: string; // DID itself
    controller?: string;
    verificationMethod?: unknown[];
    authentication?: unknown[];
    assertionMethod?: unknown[];
    [key: string]: unknown; // Dynamic keys for DID document properties
  };
}

export interface DIDCheckResponse {
  success: boolean;
  exists: boolean;
  did?: string;
}

// =============================================================================
// DID OPERATIONS
// =============================================================================

/**
 * Fetch a DID document
 * Returns the full DID document including public keys
 */
export async function fetchDIDDocument(did: string): Promise<DIDDocument> {
  const url = buildApiUrl(API_ENDPOINTS.DIDS.DOCUMENT(did));
  const response = await authenticatedGet(url);

  if (!response.ok) {
    throw new Error('Failed to fetch DID document');
  }

  return await response.json();
}

/**
 * Extract public key from DID document
 * Helper function to get the public key from a DID document response
 */
export function extractPublicKeyFromDIDDocument(didDocument: DIDDocument): string {
  const keyId = didDocument.data?.keyId;
  if (!keyId) {
    throw new Error('Key ID not found in DID document');
  }

  const publicKey = didDocument.data[keyId];
  if (!publicKey || typeof publicKey !== 'string') {
    throw new Error(`Public key not found for keyId: ${keyId}`);
  }

  return publicKey;
}

/**
 * Fetch public key for a DID
 * Convenience function that fetches the DID document and extracts the public key
 */
export async function fetchPublicKeyForDID(did: string): Promise<string> {
  const didDocument = await fetchDIDDocument(did);
  return extractPublicKeyFromDIDDocument(didDocument);
}

/**
 * Check if a DID exists
 */
export async function checkDIDExists(did: string): Promise<DIDCheckResponse> {
  const url = buildApiUrl(API_ENDPOINTS.DIDS.CHECK(did));
  const response = await authenticatedGet(url);

  if (!response.ok) {
    throw new Error('Failed to check DID existence');
  }

  return await response.json();
}
