/**
 * Check if institution is authenticated in registration flow
 *
 * @returns boolean indicating if institution has valid token and data
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
 * Redirect to institution registration if not authenticated
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
