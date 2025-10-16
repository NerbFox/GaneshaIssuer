/**
 * Get API base URL from environment variable
 */
export const getApiUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
};

/**
 * API endpoints with /api/v1 prefix
 */
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    REGISTER: '/api/v1/auth/register',
    PENDING_INSTITUTIONS: '/api/v1/auth/pending-institutions',
    INSTITUTIONS: '/api/v1/auth/institutions',
    APPROVE: (id: string) => `/api/v1/auth/approve/${id}`,
    REJECT: (id: string) => `/api/v1/auth/reject/${id}`,
    VERIFY_MAGIC_LINK: '/api/v1/auth/verify-magic-link',
    PROFILE: '/api/v1/auth/profile',
  },
  // Institution Registration endpoints
  INSTITUTION: {
    LIST: '/api/v1/institution-registration',
    DETAIL: (id: string) => `/api/v1/institution-registration/${id}`,
    UPDATE_STATUS: (id: string) => `/api/v1/institution-registration/${id}/status`,
  },
  // DID endpoints
  DID: {
    LIST: '/api/v1/dids',
    DETAIL: (id: string) => `/api/v1/dids/${id}`,
  },
  // Schema endpoints
  SCHEMA: {
    LIST: '/api/v1/schemas',
    DETAIL: (id: string) => `/api/v1/schemas/${id}`,
  },
  // Credential endpoints
  CREDENTIAL: {
    LIST: '/api/v1/credentials',
    DETAIL: (id: string) => `/api/v1/credentials/${id}`,
  },
};

/**
 * Build full API URL
 */
export const buildApiUrl = (endpoint: string): string => {
  return `${getApiUrl()}${endpoint}`;
};
