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
  // Admin Auth endpoints
  ADMIN: {
    LOGIN: '/api/v1/admin/auth/login',
    PROFILE: '/api/v1/admin/auth/profile',
    CREATE: '/api/v1/admin/auth/create',
    CHANGE_PASSWORD: '/api/v1/admin/auth/change-password',
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
    DETAIL: (id: string, version: number) => `/api/v1/schemas/${id}/version/${version}`,
    CREATE: '/api/v1/schemas',
    UPDATE: (id: string) => `/api/v1/schemas/${id}`,
    DELETE: (id: string) => `/api/v1/schemas/${id}`,
    DEACTIVATE: (id: string) => `/api/v1/schemas/${id}/deactivate`,
    REACTIVATE: (id: string) => `/api/v1/schemas/${id}/reactivate`,
  },
  // Credential endpoints
  CREDENTIAL: {
    LIST: '/api/v1/credentials',
    DETAIL: (id: string) => `/api/v1/credentials/${id}`,
    GET_REQUESTS: '/api/v1/credentials/get-requests',
    REQUEST_DETAIL: (id: string) => `/api/v1/credentials/request/${id}`,
    ISSUE_VC: '/api/v1/credentials/issue-vc',
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
  const url = buildApiUrl(endpoint);
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    searchParams.append(key, String(value));
  });

  return `${url}?${searchParams.toString()}`;
};
