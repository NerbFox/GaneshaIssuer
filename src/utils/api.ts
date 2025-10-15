/**
 * Get API URL dynamically
 * This ensures the API URL is read at runtime, not build time
 */
export const getApiUrl = (): string => {
  // Check if running in browser
  if (typeof window !== 'undefined') {
    // Try to get from window object first (can be set by server)
    const windowApiUrl = (window as any).__API_URL__;
    if (windowApiUrl) {
      return windowApiUrl;
    }
  }
  
  // Fall back to environment variable
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (!apiUrl) {
    console.error('API URL is not defined! Please set NEXT_PUBLIC_API_URL');
    return '';
  }
  
  return apiUrl;
};
