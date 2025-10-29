/**
 * Authenticated API Client
 *
 * Wrapper for fetch() that automatically includes JWT authentication
 */

/**
 * Make an authenticated API request with JWT Bearer token
 *
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Response object
 * @throws Error if no authentication token found
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem('institutionToken');

  if (!token) {
    throw new Error('No authentication token found. Please log in.');
  }

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Make an authenticated GET request
 *
 * @param url - API endpoint URL
 * @returns Response object
 */
export async function authenticatedGet(url: string): Promise<Response> {
  return authenticatedFetch(url, { method: 'GET' });
}

/**
 * Make an authenticated POST request
 *
 * @param url - API endpoint URL
 * @param body - Request body (will be JSON stringified)
 * @returns Response object
 */
export async function authenticatedPost(url: string, body: any): Promise<Response> {
  return authenticatedFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Make an authenticated PUT request
 *
 * @param url - API endpoint URL
 * @param body - Request body (will be JSON stringified)
 * @returns Response object
 */
export async function authenticatedPut(url: string, body: any): Promise<Response> {
  return authenticatedFetch(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Make an authenticated DELETE request
 *
 * @param url - API endpoint URL
 * @returns Response object
 */
export async function authenticatedDelete(url: string): Promise<Response> {
  return authenticatedFetch(url, { method: 'DELETE' });
}

/**
 * Make an authenticated PATCH request
 *
 * @param url - API endpoint URL
 * @param body - Request body (will be JSON stringified)
 * @returns Response object
 */
export async function authenticatedPatch(url: string, body: any): Promise<Response> {
  return authenticatedFetch(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * Admin-specific authenticated API requests
 * Uses 'adminToken' from localStorage instead of 'institutionToken'
 */

/**
 * Make an admin authenticated API request with JWT Bearer token
 *
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Response object
 * @throws Error if no admin token found
 */
export async function adminAuthenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem('adminToken');

  if (!token) {
    throw new Error('No admin authentication token found. Please log in.');
  }

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Make an admin authenticated GET request
 *
 * @param url - API endpoint URL
 * @returns Response object
 */
export async function adminAuthenticatedGet(url: string): Promise<Response> {
  return adminAuthenticatedFetch(url, { method: 'GET' });
}

/**
 * Make an admin authenticated POST request
 *
 * @param url - API endpoint URL
 * @param body - Request body (will be JSON stringified)
 * @returns Response object
 */
export async function adminAuthenticatedPost(url: string, body: any): Promise<Response> {
  return adminAuthenticatedFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
