/**
 * Credential Service
 * Handles all credential-related API operations including issuance, updates, renewals, and revocations
 */

import { API_ENDPOINTS, buildApiUrl, buildApiUrlWithParams } from '@/utils/api';
import { authenticatedGet, authenticatedPost, authenticatedPut } from '@/utils/api-client';
import { encryptWithPublicKey, encryptWithIssuerPublicKey } from '@/utils/encryptUtils';
import { createVC, hashVC } from '@/utils/vcUtils';
import { signVCWithStoredKey, SignedVerifiableCredential } from '@/utils/vcSigner';
import { getIssuedCredentialById, storeIssuedCredential } from '@/utils/indexedDB';

// =============================================================================
// TYPES
// =============================================================================

export interface IssueCredentialParams {
  issuerDid: string;
  holderDid: string;
  holderPublicKey: string;
  schemaId: string;
  schemaVersion: number;
  schemaName: string;
  credentialData: Record<string, string | number | boolean>;
  expiredAt: string;
  imageLink?: string | null;
  institutionName: string;
}

export interface UpdateCredentialParams {
  issuerDid: string;
  holderDid: string;
  holderPublicKey: string;
  oldVcId: string;
  newVcId: string;
  schemaId: string;
  schemaVersion: number;
  schemaName: string;
  vcType: string;
  credentialData: Record<string, string | number | boolean>;
  expiredAt: string;
  imageLink?: string | null;
  institutionName: string;
  issuerVCDataId: string; // ID of the issued credential in IndexedDB and API
}

export interface RenewCredentialParams {
  issuerDid: string;
  holderDid: string;
  holderPublicKey: string;
  vcId: string;
  schemaId: string;
  schemaVersion: number;
  schemaName: string;
  credentialData: Record<string, string | number | boolean>;
  expiredAt: string;
  imageLink?: string | null;
  institutionName: string;
  issuerVCDataId: string; // ID of the issued credential in IndexedDB and API
}

export interface RevokeCredentialParams {
  issuerDid: string;
  holderDid: string;
  holderPublicKey: string;
  vcId: string;
  issuerVCDataId: string; // ID of the issued credential in IndexedDB and API
}

export interface FetchVCsByIssuerDIDResponse {
  success: boolean;
  message: string;
  data: {
    message: string;
    count: number;
    data: {
      id: string;
      issuer_did: string;
      encrypted_body: string;
      createdAt: string;
      updatedAt: string;
    }[];
  };
}

export interface FetchCredentialRequestsParams {
  type: 'ISSUANCE' | 'RENEWAL' | 'UPDATE' | 'REVOKE';
  issuerDid: string;
}

export interface FetchCredentialRequestsResponse {
  success: boolean;
  message: string;
  data: {
    message: string;
    count: number;
    data: {
      id: string;
      encrypted_body: string;
      issuer_did: string;
      holder_did: string;
      version: number;
      status: string;
      type: string;
      createdAt: string;
      updatedAt: string;
      deletedAt: string | null;
    }[];
  };
}

export interface ProcessRequestParams {
  requestId: string;
  action: 'APPROVED' | 'REJECTED';
  vcId?: string;
  newVcId?: string;
  schemaId?: string;
  schemaVersion?: number;
  vcType?: string;
  vcHash?: string;
  encryptedBody?: string;
  expiredAt?: string;
}

export interface UploadFileResponse {
  success: boolean;
  data: {
    file_id: string;
    file_url: string;
  };
}

// =============================================================================
// CREDENTIAL ISSUANCE
// =============================================================================

/**
 * Issue a new credential
 * Creates, signs, encrypts, and submits a new verifiable credential
 */
export async function issueCredential(params: IssueCredentialParams): Promise<{
  issueResponse: Response;
  storeResponse: Response;
  signedVC: SignedVerifiableCredential;
}> {
  const {
    issuerDid,
    holderDid,
    holderPublicKey,
    schemaId,
    schemaVersion,
    schemaName,
    credentialData,
    expiredAt,
    imageLink,
    institutionName,
  } = params;

  // Generate unique VC ID
  const timestamp = Date.now();
  const vcId = `${schemaId}:${schemaVersion}:${holderDid}:${timestamp}`;

  // Create the Verifiable Credential
  const now = new Date();
  const vc = createVC({
    id: vcId,
    vcType: schemaName.replace(/\s+/g, ''),
    issuerDid,
    issuerName: institutionName,
    holderDid,
    credentialData,
    validFrom: now.toISOString(),
    expiredAt,
    imageLink: imageLink || null,
  });

  // Sign the VC
  const signedVC = await signVCWithStoredKey(vc);

  // Hash the VC
  const vcHashWithoutPrefix = hashVC(signedVC);

  // Prepare wrapped body for holder
  const wrappedBody = {
    verifiable_credential: signedVC,
  };

  // Encrypt with holder's public key
  const encryptedBodyByHolderPK = await encryptWithPublicKey(wrappedBody, holderPublicKey);

  // Encrypt with issuer's public key for storage
  const encryptedBodyByIssuerPK = await encryptWithIssuerPublicKey({
    vc_status: true,
    verifiable_credentials: [signedVC],
  });

  // Call the API to issue the credential
  const issueUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.ISSUE_VC);
  const issueResponse = await authenticatedPost(issueUrl, {
    issuer_did: issuerDid,
    holder_did: holderDid,
    vc_id: vcId,
    vc_type: schemaName.replace(/\s+/g, ''),
    schema_id: schemaId,
    schema_version: schemaVersion,
    vc_hash: vcHashWithoutPrefix,
    encrypted_body: encryptedBodyByHolderPK,
    expiredAt,
  });

  // Store the VC in issuer's records
  const storeUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.VC);
  const storeResponse = await authenticatedPost(storeUrl, {
    issuer_did: issuerDid,
    encrypted_body: encryptedBodyByIssuerPK,
  });

  return { issueResponse, storeResponse, signedVC };
}

// =============================================================================
// CREDENTIAL UPDATE
// =============================================================================

/**
 * Update an existing credential
 * Creates a new version of the credential with updated data
 * Prepends the new VC to the history and updates both holder's and issuer's records
 */
export async function updateCredential(
  params: UpdateCredentialParams
): Promise<{ updateResponse: Response; signedVC: SignedVerifiableCredential }> {
  const {
    issuerDid,
    holderDid,
    holderPublicKey,
    oldVcId,
    newVcId,
    schemaId,
    schemaVersion,
    schemaName,
    vcType,
    credentialData,
    expiredAt,
    imageLink,
    institutionName,
    issuerVCDataId,
  } = params;

  // Step 1: Fetch the issued credential from IndexedDB
  const issuedCredential = await getIssuedCredentialById(issuerVCDataId);
  if (!issuedCredential) {
    throw new Error('Issued credential not found in IndexedDB');
  }

  // Step 2: Create the new Verifiable Credential
  const now = new Date();
  const vc = createVC({
    id: newVcId,
    vcType: schemaName.replace(/\s+v\d+$/, '').replace(/\s+/g, ''),
    issuerDid,
    issuerName: institutionName,
    holderDid,
    credentialData,
    validFrom: now.toISOString(),
    expiredAt,
    imageLink: imageLink || null,
  });

  // Step 3: Sign the VC
  const signedVC = await signVCWithStoredKey(vc);

  // Step 4: Hash the VC
  const vcHashWithoutPrefix = hashVC(signedVC);

  // Step 5: Prepare wrapped body for holder
  const wrappedBody = {
    old_vc_id: oldVcId,
    verifiable_credential: signedVC,
  };

  // Step 6: Encrypt with holder's public key
  const encryptedBodyForHolder = await encryptWithPublicKey(wrappedBody, holderPublicKey);

  // Step 7: Call the update-vc API (sends to holder)
  const updateUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.UPDATE_VC);
  const updateResponse = await authenticatedPost(updateUrl, {
    issuer_did: issuerDid,
    holder_did: holderDid,
    old_vc_id: oldVcId,
    new_vc_id: newVcId,
    vc_type: vcType,
    schema_id: schemaId,
    schema_version: schemaVersion,
    new_vc_hash: vcHashWithoutPrefix,
    encrypted_body: encryptedBodyForHolder,
    expiredAt,
  });

  // Step 8: Get the existing VC history from IndexedDB
  const existingVCHistory = issuedCredential.vcHistory || [];

  // Step 9: Prepend the new signed VC to the history (newest first)
  const updatedVCHistory = [signedVC, ...existingVCHistory];

  // Step 10: Encrypt the updated history with issuer's public key
  const encryptedBodyForIssuer = await encryptWithIssuerPublicKey({
    vc_status: true,
    verifiable_credentials: updatedVCHistory,
  });

  // Step 11: Update the issuer's VC data via PUT API
  const updateIssuerUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.VC_BY_ID(issuerVCDataId));
  const updateIssuerResponse = await authenticatedPut(updateIssuerUrl, {
    issuer_did: issuerDid,
    encrypted_body: encryptedBodyForIssuer,
  });

  if (!updateIssuerResponse.ok) {
    const errorData = await updateIssuerResponse.json();
    throw new Error(errorData.message || 'Failed to update issuer VC data');
  }

  // Step 12: Update IndexedDB with the new VC in history
  // Cast SignedVerifiableCredential to match VerifiableCredentialData structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vcHistoryForStorage = updatedVCHistory.map((vc: any) => ({
    id: vc.id,
    type: vc.type,
    issuer:
      typeof vc.issuer === 'string' ? { id: vc.issuer, name: vc.issuerName || '' } : vc.issuer,
    credentialSubject: vc.credentialSubject,
    validFrom: vc.validFrom,
    expiredAt: vc.expiredAt || '',
    credentialStatus: vc.credentialStatus,
    proof: vc.proof,
    imageLink: vc.imageLink || undefined,
    fileUrl: vc.fileUrl,
    fileId: vc.fileId,
    issuerName: vc.issuerName,
    '@context': vc['@context'],
  }));

  const updatedIssuedCredential = {
    ...issuedCredential,
    vcHistory: vcHistoryForStorage,
    vcId: signedVC.id,
    activeUntil: expiredAt,
    createdAt: signedVC.validFrom,
    status: 'APPROVED',
  };

  await storeIssuedCredential(updatedIssuedCredential);
  console.log(`[IndexedDB] Updated issued credential with new VC: ${issuerVCDataId}`);

  return { updateResponse, signedVC };
}

// =============================================================================
// CREDENTIAL RENEWAL
// =============================================================================

/**
 * Renew an existing credential
 * Creates a new credential with the same data but extended expiration
 * Fetches from IndexedDB, prepends new VC to history, and updates both API and IndexedDB
 */
export async function renewCredential(
  params: RenewCredentialParams
): Promise<{ renewResponse: Response; signedVC: SignedVerifiableCredential }> {
  const {
    issuerDid,
    holderDid,
    holderPublicKey,
    vcId,
    schemaName,
    credentialData,
    expiredAt,
    imageLink,
    institutionName,
    issuerVCDataId,
  } = params;

  // Step 1: Fetch the issued credential from IndexedDB
  const issuedCredential = await getIssuedCredentialById(issuerVCDataId);
  if (!issuedCredential) {
    throw new Error('Issued credential not found in IndexedDB');
  }

  // Step 2: Create the new Verifiable Credential
  const now = new Date();
  const vc = createVC({
    id: vcId,
    vcType: schemaName.replace(/\s+v\d+$/, '').replace(/\s+/g, ''),
    issuerDid,
    issuerName: institutionName,
    holderDid,
    credentialData,
    validFrom: now.toISOString(),
    expiredAt,
    imageLink: imageLink || null,
  });

  // Step 3: Sign the new VC
  const signedVC = await signVCWithStoredKey(vc);

  // Step 4: Prepare wrapped body for holder
  const wrappedBody = {
    verifiable_credential: signedVC,
  };

  // Step 5: Encrypt with holder's public key
  const encryptedBodyForHolder = await encryptWithPublicKey(wrappedBody, holderPublicKey);

  // Step 6: Call the renew-vc API (sends to holder)
  const renewUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.RENEW_VC);
  const renewResponse = await authenticatedPost(renewUrl, {
    issuer_did: issuerDid,
    holder_did: holderDid,
    vc_id: vcId,
    encrypted_body: encryptedBodyForHolder,
    expiredAt,
  });

  // Step 7: Fetch the existing encrypted body from API (we need the current one)
  // We'll use the vcHistory from IndexedDB which already has the decrypted history
  const existingVCHistory = issuedCredential.vcHistory || [];

  // Step 8: Prepend the new signed VC to the history (newest first)
  const updatedVCHistory = [signedVC, ...existingVCHistory];

  // Step 9: Encrypt the updated history with issuer's public key
  const encryptedBodyForIssuer = await encryptWithIssuerPublicKey({
    vc_status: true,
    verifiable_credentials: updatedVCHistory,
  });

  // Step 10: Update the issuer's VC data via PUT API
  const updateUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.VC_BY_ID(issuerVCDataId));
  const updateResponse = await authenticatedPut(updateUrl, {
    issuer_did: issuerDid,
    encrypted_body: encryptedBodyForIssuer,
  });

  if (!updateResponse.ok) {
    const errorData = await updateResponse.json();
    throw new Error(errorData.message || 'Failed to update issuer VC data');
  }

  // Step 11: Update IndexedDB with the new VC in history
  // Cast SignedVerifiableCredential to match VerifiableCredentialData structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vcHistoryForStorage = updatedVCHistory.map((vc: any) => ({
    id: vc.id,
    type: vc.type,
    issuer:
      typeof vc.issuer === 'string' ? { id: vc.issuer, name: vc.issuerName || '' } : vc.issuer,
    credentialSubject: vc.credentialSubject,
    validFrom: vc.validFrom,
    expiredAt: vc.expiredAt || '',
    credentialStatus: vc.credentialStatus,
    proof: vc.proof,
    imageLink: vc.imageLink || undefined,
    fileUrl: vc.fileUrl,
    fileId: vc.fileId,
    issuerName: vc.issuerName,
    '@context': vc['@context'],
  }));

  const updatedIssuedCredential = {
    ...issuedCredential,
    vcHistory: vcHistoryForStorage,
    vcId: signedVC.id,
    activeUntil: expiredAt,
    createdAt: signedVC.validFrom,
    status: 'APPROVED',
  };

  await storeIssuedCredential(updatedIssuedCredential);
  console.log(`[IndexedDB] Updated issued credential with renewed VC: ${issuerVCDataId}`);

  return { renewResponse, signedVC };
}

// =============================================================================
// CREDENTIAL REVOCATION
// =============================================================================

/**
 * Revoke a credential
 * Marks a credential as revoked by setting vc_status to false in the encrypted_body
 * Updates both holder's and issuer's records
 */
export async function revokeCredential(
  params: RevokeCredentialParams
): Promise<{ revokeResponse: Response }> {
  const { issuerDid, holderDid, holderPublicKey, vcId, issuerVCDataId } = params;

  // Step 1: Fetch the issued credential from IndexedDB
  const issuedCredential = await getIssuedCredentialById(issuerVCDataId);
  if (!issuedCredential) {
    throw new Error('Issued credential not found in IndexedDB');
  }

  // Step 2: Get the existing VC history from IndexedDB
  const existingVCHistory = issuedCredential.vcHistory || [];

  // Step 3: Create updated data with vc_status set to false
  const updatedData = {
    vc_status: false,
    verifiable_credentials: existingVCHistory,
  };

  // Step 4: Re-encrypt the updated data
  const encryptedBodyForIssuer = await encryptWithIssuerPublicKey(updatedData);

  // Step 5: Encrypt the credential info with holder's public key (for holder notification)
  const encryptedBodyForHolder = await encryptWithPublicKey(
    {
      verifiable_credential: {
        id: vcId,
      },
    },
    holderPublicKey
  );

  // Step 6: Call the revoke API (sends notification to holder)
  const revokeUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.REVOKE_VC);
  const revokeResponse = await authenticatedPost(revokeUrl, {
    issuer_did: issuerDid,
    holder_did: holderDid,
    vc_id: vcId,
    encrypted_body: encryptedBodyForHolder,
  });

  // Step 7: Update the issuer's VC data via PUT API
  const updateUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.VC_BY_ID(issuerVCDataId));
  const updateResponse = await authenticatedPut(updateUrl, {
    issuer_did: issuerDid,
    encrypted_body: encryptedBodyForIssuer,
  });

  if (!updateResponse.ok) {
    const errorData = await updateResponse.json();
    throw new Error(errorData.message || 'Failed to update issuer VC data');
  }

  // Note: No need to update IndexedDB status as vc_status in encrypted_body is the source of truth
  return { revokeResponse };
}

// =============================================================================
// CREDENTIAL FETCHING
// =============================================================================

/**
 * Fetch all credentials issued by a specific DID
 */
export async function fetchVCsByIssuerDID(issuerDid: string): Promise<FetchVCsByIssuerDIDResponse> {
  const url = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUER.VC_BY_DID(issuerDid));
  const response = await authenticatedGet(url);

  if (!response.ok) {
    throw new Error('Failed to fetch credentials');
  }

  return await response.json();
}

/**
 * Fetch credential requests by type and issuer DID
 */
export async function fetchCredentialRequests(
  params: FetchCredentialRequestsParams
): Promise<FetchCredentialRequestsResponse> {
  const { type, issuerDid } = params;
  const url = buildApiUrlWithParams(API_ENDPOINTS.CREDENTIALS.REQUESTS, {
    type,
    issuer_did: issuerDid,
  });

  const response = await authenticatedGet(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${type} requests`);
  }

  return await response.json();
}

// =============================================================================
// REQUEST PROCESSING
// =============================================================================

/**
 * Process a credential request (approve or reject)
 * Used for ISSUANCE, UPDATE, RENEWAL, and REVOKE requests
 */
export async function processCredentialRequest(
  requestType: 'ISSUANCE' | 'UPDATE' | 'RENEWAL' | 'REVOKE',
  params: ProcessRequestParams
): Promise<Response> {
  let apiUrl: string;

  // Determine the correct endpoint based on request type
  switch (requestType) {
    case 'ISSUANCE':
      apiUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.ISSUE_VC);
      break;
    case 'UPDATE':
      apiUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.UPDATE_VC);
      break;
    case 'RENEWAL':
      apiUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.RENEW_VC);
      break;
    case 'REVOKE':
      apiUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.REVOKE_VC);
      break;
  }

  return await authenticatedPost(apiUrl, params as unknown as Record<string, unknown>);
}

// =============================================================================
// FILE UPLOAD
// =============================================================================

/**
 * Upload a file for a credential
 */
export async function uploadCredentialFile(
  file: Blob,
  filename: string
): Promise<UploadFileResponse> {
  const formData = new FormData();
  formData.append('file', file, filename);

  const uploadUrl = buildApiUrl(API_ENDPOINTS.CREDENTIALS.UPLOAD_FILE);

  // Get authentication token
  const token = localStorage.getItem('institutionToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  // Upload file using fetch with multipart/form-data
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type header - browser will set it with boundary
    },
    body: formData,
  });

  if (!uploadResponse.ok) {
    const uploadError = await uploadResponse.json();
    throw new Error(`Failed to upload file: ${uploadError.message || uploadResponse.statusText}`);
  }

  const uploadResult = await uploadResponse.json();

  if (!uploadResult.success || !uploadResult.data) {
    throw new Error('Invalid upload response format');
  }

  return uploadResult;
}
