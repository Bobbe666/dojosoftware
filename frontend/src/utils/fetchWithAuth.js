/**
 * Fetch-Wrapper mit automatischer Authorization-Header-Injection
 *
 * Verwendung: Ersetze fetch() mit fetchWithAuth() in allen Komponenten
 *
 * Beispiel:
 *   // Vorher:
 *   fetch(`${config.apiBaseUrl}/endpoint`)
 *
 *   // Nachher:
 *   fetchWithAuth(`${config.apiBaseUrl}/endpoint`)
 */

/**
 * Fetch mit automatischem Authorization-Header
 * @param {string} url - Die URL für den Request
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Response>} - Fetch Response
 */
export const fetchWithAuth = async (url, options = {}) => {
  // Hole Token aus localStorage (gleicher Key wie AuthContext)
  const token = localStorage.getItem('dojo_auth_token');

  // Merge headers mit Authorization
  const headers = {
    ...options.headers,
  };

  // Füge Authorization-Header hinzu, falls Token vorhanden
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Führe fetch mit erweiterten Headers aus
  return fetch(url, {
    ...options,
    headers,
  });
};

/**
 * Fetch mit automatischem Authorization-Header und JSON-Response
 * @param {string} url - Die URL für den Request
 * @param {object} options - Fetch options
 * @returns {Promise<any>} - Parsed JSON response
 */
export const fetchJsonWithAuth = async (url, options = {}) => {
  const response = await fetchWithAuth(url, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

export default fetchWithAuth;
