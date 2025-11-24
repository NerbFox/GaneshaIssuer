import { decodeJWT, validateJWTClaims, verifyJWT } from './jwt-es256';
import { hexToBytes } from './seedphrase-p256';

/**
 * Check if institution is authenticated (basic check - token existence only)
 * For security-critical operations, use checkInstitutionAuthAsync() instead
 *
 * @returns boolean indicating if institution has token and data
 */
export function checkInstitutionAuth(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const token = localStorage.getItem('institutionToken');
  const institution = localStorage.getItem('institutionData');

  return !!(token && institution);
}

/**
 * Check if institution is authenticated with JWT verification
 * This is more secure but async - use for protected routes
 * Verifies JWT using the public key stored in localStorage (no API call)
 *
 * @returns Promise<boolean> indicating if institution has valid JWT
 */
export async function checkInstitutionAuthAsync(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  const token = localStorage.getItem('institutionToken');
  const publicKeyHex = localStorage.getItem('institutionSigningPublicKey');
  const institution = localStorage.getItem('institutionData');

  if (!token || !publicKeyHex || !institution) {
    return false;
  }

  try {
    // Step 1: Decode JWT (without verification)
    const decoded = decodeJWT(token);

    // Step 2: Validate JWT claims (expiration, etc.)
    const claimsValidation = validateJWTClaims(decoded.payload);
    if (!claimsValidation.valid) {
      return false;
    }

    // Step 3: Verify JWT signature using local public key
    const publicKeyBytes = hexToBytes(publicKeyHex);
    const isValid = await verifyJWT(token, publicKeyBytes);

    return isValid;
  } catch (error) {
    console.error('JWT verification error:', error);
    return false;
  }
}

/**
 * Redirect to institution registration if not authenticated
 * Uses basic check for immediate redirect
 *
 * @param router - Next.js router instance
 * @returns boolean indicating if redirect happened
 */
export function redirectIfNotAuthenticated(router: { push: (url: string) => void }): boolean {
  if (!checkInstitutionAuth()) {
    router.push('/institution/register');
    return true;
  }
  return false;
}

/**
 * Redirect to login if JWT is invalid
 * Uses async verification for security-critical routes
 *
 * @param router - Next.js router instance
 * @returns Promise<boolean> indicating if redirect happened
 */
export async function redirectIfJWTInvalid(router: {
  push: (url: string) => void;
}): Promise<boolean> {
  const isValid = await checkInstitutionAuthAsync();

  if (!isValid) {
    router.push('/institution/login');
    return true;
  }

  return false;
}

/**
 * Logout institution and clear all auth data
 */
export function logoutInstitution(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Clear all institution-related data
  localStorage.removeItem('institutionToken');
  localStorage.removeItem('institutionDID');
  localStorage.removeItem('institutionSigningPublicKey');
  localStorage.removeItem('institutionData');

  // Clear any temporary data
  sessionStorage.removeItem('tempRegistrationMnemonic');
}
