/**
 * Get API base URL from environment variable
 */
export const getApiUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
};

// API path constants
const API_PREFIX = '/api/v1';
const ADMIN_PATH = `${API_PREFIX}/admin`;
const AUTH_PATH = `${API_PREFIX}/auth`;
const ADMIN_AUTH_PATH = `${ADMIN_PATH}/auth`;
const CREDENTIALS_PATH = `${API_PREFIX}/credentials`;
const CREDENTIALS_ISSUER_PATH = `${CREDENTIALS_PATH}/issuer`;
const DIDS_PATH = `${API_PREFIX}/dids`;
const INSTITUTIONS_PATH = `${API_PREFIX}/institutions`;
const NOTIFICATIONS_PATH = `${API_PREFIX}/notifications`;
const PRESENTATIONS_PATH = `${API_PREFIX}/presentations`;
const SCHEMAS_PATH = `${API_PREFIX}/schemas`;

/**
 * API endpoints organized by domain
 */
export const API_ENDPOINTS = {
  // Admin Authentication
  ADMIN_AUTH: {
    LOGIN: `${ADMIN_AUTH_PATH}/login`,
    PROFILE: `${ADMIN_AUTH_PATH}/profile`,
    CREATE: `${ADMIN_AUTH_PATH}/create`,
    CHANGE_PASSWORD: `${ADMIN_AUTH_PATH}/change-password`,
  },

  // Magic Link Authentication
  AUTH: {
    REGISTER: `${AUTH_PATH}/register`,
    PENDING_INSTITUTIONS: `${AUTH_PATH}/pending-institutions`,
    INSTITUTIONS: `${AUTH_PATH}/institutions`,
    APPROVE: (institutionId: string) => `${AUTH_PATH}/approve/${institutionId}`,
    REJECT: (institutionId: string) => `${AUTH_PATH}/reject/${institutionId}`,
    VERIFY_MAGIC_LINK: `${AUTH_PATH}/verify-magic-link`,
    PROFILE: `${AUTH_PATH}/profile`,
  },

  // Verifiable Credential Lifecycle
  CREDENTIALS: {
    // Request credential operations
    REQUESTS: `${CREDENTIALS_PATH}/requests`, // POST & GET
    UPDATE_REQUEST: `${CREDENTIALS_PATH}/update-request`,
    RENEW_REQUEST: `${CREDENTIALS_PATH}/renew-request`,
    REVOKE_REQUEST: `${CREDENTIALS_PATH}/revoke-request`,

    // Credential operations
    CREDENTIALS: `${CREDENTIALS_PATH}/credentials`, // GET holder's VCs
    CREDENTIALS_FROM_DB: `${CREDENTIALS_PATH}/credentials-from-db`, // GET holder's issued VCs from DB
    STATUS: (vcId: string) => `${CREDENTIALS_PATH}/${vcId}/status`,

    // Process credential requests (Approve/Reject)
    ISSUE_VC: `${CREDENTIALS_PATH}/issue-vc`,
    REVOKE_VC: `${CREDENTIALS_PATH}/revoke-vc`,
    RENEW_VC: `${CREDENTIALS_PATH}/renew-vc`,
    UPDATE_VC: `${CREDENTIALS_PATH}/update-vc`,

    // Claim operations (Phase 1 & 2)
    CLAIM: `${CREDENTIALS_PATH}/claim`,
    CONFIRM: `${CREDENTIALS_PATH}/confirm`,
    CLAIM_BATCH: `${CREDENTIALS_PATH}/claim-batch`,
    CONFIRM_BATCH: `${CREDENTIALS_PATH}/confirm-batch`,

    // Admin operations
    ADMIN_RESET_STUCK: `${CREDENTIALS_PATH}/admin/reset-stuck`,

    // Issuer history
    ISSUER_HISTORY: `${CREDENTIALS_PATH}/issuer-history`,

    // Issuer Direct Operations
    ISSUER: {
      ISSUE_VC: `${CREDENTIALS_ISSUER_PATH}/issue-vc`,
      UPDATE_VC: `${CREDENTIALS_ISSUER_PATH}/update-vc`,
      REVOKE_VC: `${CREDENTIALS_ISSUER_PATH}/revoke-vc`,
      RENEW_VC: `${CREDENTIALS_ISSUER_PATH}/renew-vc`,
      CLAIM_VC_INIT: `${CREDENTIALS_PATH}/claim-vc/issuer-init`,
      CONFIRM_VC_INIT: `${CREDENTIALS_PATH}/confirm-vc/issuer-init`,
    },
  },

  // DID Management
  DIDS: {
    BASE: DIDS_PATH,
    CHECK: (did: string) => `${DIDS_PATH}/check/${did}`,
    BLOCKS: `${DIDS_PATH}/blocks`,
    KEY_ROTATION: (did: string) => `${DIDS_PATH}/${did}/key-rotation`,
    DEACTIVATE: (did: string) => `${DIDS_PATH}/${did}`,
    DOCUMENT: (did: string) => `${DIDS_PATH}/${did}/document`,
  },

  // Institutions
  INSTITUTIONS: {
    BASE: INSTITUTIONS_PATH,
    BY_DID: (did: string) => `${INSTITUTIONS_PATH}/${did}`,
  },

  // Notifications
  NOTIFICATIONS: {
    REGISTER: `${NOTIFICATIONS_PATH}/register`,
    UNREGISTER: `${NOTIFICATIONS_PATH}/unregister`,
    TOKENS: (holderDid: string) => `${NOTIFICATIONS_PATH}/tokens/${holderDid}`,
    SEND: `${NOTIFICATIONS_PATH}/send`,
  },

  // Verification & Presentation
  PRESENTATIONS: {
    REQUEST: `${PRESENTATIONS_PATH}/request`,
    REQUEST_DETAIL: (vpReqId: string) => `${PRESENTATIONS_PATH}/request/${vpReqId}`,
    BASE: PRESENTATIONS_PATH,
    DETAIL: (vpId: string) => `${PRESENTATIONS_PATH}/${vpId}`,
    VERIFY: (vpId: string) => `${PRESENTATIONS_PATH}/${vpId}/verify`,
  },

  // VC Schema Management
  SCHEMAS: {
    BASE: SCHEMAS_PATH,
    LATEST: `${SCHEMAS_PATH}/latest`,
    VERSIONS: `${SCHEMAS_PATH}/versions`,
    BY_ID: (id: string) => `${SCHEMAS_PATH}/${id}`,
    BY_ID_VERSIONS: (id: string) => `${SCHEMAS_PATH}/${id}/versions`,
    BY_VERSION: (id: string, version: number) => `${SCHEMAS_PATH}/${id}/version/${version}`,
    ACTIVE_CHECK: (id: string, version: number) =>
      `${SCHEMAS_PATH}/${id}/version/${version}/active`,
    DEACTIVATE: (id: string, version: number) =>
      `${SCHEMAS_PATH}/${id}/version/${version}/deactivate`,
    REACTIVATE: (id: string, version: number) =>
      `${SCHEMAS_PATH}/${id}/version/${version}/reactivate`,
  },
};

/**
 * Build full API URL
 */
export const buildApiUrl = (endpoint: string): string => {
  return `${getApiUrl()}${endpoint}`;
};

/**
 * Build API URL with query parameters
 */
export const buildApiUrlWithParams = (
  endpoint: string,
  params?: Record<string, string | number | boolean>
): string => {
  const baseUrl = buildApiUrl(endpoint);
  if (!params || Object.keys(params).length === 0) {
    return baseUrl;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    searchParams.append(key, String(value));
  });

  return `${baseUrl}?${searchParams.toString()}`;
};
