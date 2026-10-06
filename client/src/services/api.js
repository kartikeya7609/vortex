export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// Remove tokens left by the earlier localStorage-based session implementation.
if (typeof localStorage !== 'undefined') localStorage.removeItem('aarohan_token');

/**
 * API fetch wrapper that uses the HttpOnly server session cookie.
 */
export const apiFetch = async (url, options = {}) => {
  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
};
