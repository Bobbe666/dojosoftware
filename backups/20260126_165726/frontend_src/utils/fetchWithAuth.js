/**
 * Fetch-Wrapper mit automatischer Authorization-Header-Injection
 * ERWEITERT: Auto-Logout bei 401 & Token-Refresh bei Aktivität
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

import config from '../config';

// Konfiguration
const TOKEN_REFRESH_THRESHOLD = 30 * 60 * 1000; // 30 Minuten vor Ablauf refreshen
const TOKEN_KEY = 'dojo_auth_token';
let isRefreshing = false; // Verhindert mehrfache gleichzeitige Refreshs

// =====================================================================================
// TOKEN UTILITIES
// =====================================================================================

/**
 * Dekodiert ein JWT Token (ohne Verifizierung)
 */
export const decodeToken = (token) => {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    console.warn('⚠️ [Auth] Token konnte nicht dekodiert werden');
    return null;
  }
};

/**
 * Prüft ob ein Token noch gültig ist
 */
export const isTokenValid = (token) => {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp > now;
};

/**
 * Prüft ob ein Token bald abläuft (innerhalb von 30 Min)
 */
export const isTokenExpiringSoon = (token) => {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return false;
  const now = Date.now();
  const expiry = payload.exp * 1000;
  return (expiry - now) < TOKEN_REFRESH_THRESHOLD;
};

/**
 * Gibt die verbleibende Token-Zeit in Minuten zurück
 */
export const getTokenTimeRemaining = (token) => {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return 0;
  const now = Date.now();
  const expiry = payload.exp * 1000;
  return Math.max(0, Math.round((expiry - now) / 60000));
};

// =====================================================================================
// AUTH TOKEN MANAGEMENT
// =====================================================================================

/**
 * Holt den Auth-Token aus dem localStorage
 */
export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_KEY) || null;
};

/**
 * Speichert den Auth-Token im localStorage
 */
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

// =====================================================================================
// AUTO-LOGOUT
// =====================================================================================

/**
 * Automatischer Logout bei abgelaufenem Token
 * Wird aufgerufen wenn ein 401-Fehler auftritt
 */
export const handleAutoLogout = () => {
  console.log('🚪 [Auth] Token abgelaufen - Automatischer Logout...');

  // Alle Auth-Daten entfernen
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('dojo_user');
  localStorage.removeItem('dojo_id');
  localStorage.removeItem('user_role');

  // Optional: Event dispatchen für React-Komponenten
  window.dispatchEvent(new CustomEvent('auth:logout', {
    detail: { reason: 'token_expired' }
  }));

  // Zur Login-Seite weiterleiten
  window.location.href = '/login?expired=1';
};

// =====================================================================================
// TOKEN REFRESH (Sliding Session)
// =====================================================================================

/**
 * Erneuert den Token wenn er bald abläuft
 */
export const refreshTokenIfNeeded = async () => {
  if (isRefreshing) return; // Bereits am Refreshen

  const token = getAuthToken();
  if (!token || !isTokenValid(token)) return;

  // Nur refreshen wenn Token bald abläuft
  if (!isTokenExpiringSoon(token)) return;

  isRefreshing = true;
  const remaining = getTokenTimeRemaining(token);
  console.log(`🔄 [Auth] Token läuft in ${remaining} Min ab - Versuche Verlängerung...`);

  try {
    const API_BASE = config?.apiBaseUrl?.replace('/api', '') || '';
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.token) {
        // Neuen Token speichern
        setAuthToken(data.token);
        console.log('✅ [Auth] Token erfolgreich um 2 Stunden verlängert');
      }
    } else {
      console.warn('⚠️ [Auth] Token-Refresh fehlgeschlagen:', response.status);
    }
  } catch (error) {
    console.error('❌ [Auth] Token-Refresh Fehler:', error.message);
  } finally {
    isRefreshing = false;
  }
};

// =====================================================================================
// FETCH WITH AUTH
// =====================================================================================

/**
 * Fetch mit automatischem Authorization-Header, Auto-Refresh & Auto-Logout
 * @param {string} url - Die URL für den Request
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Response>} - Fetch Response
 */
export const fetchWithAuth = async (url, options = {}) => {
  // Token-Refresh prüfen BEVOR der Request gemacht wird
  await refreshTokenIfNeeded();

  // Hole Token (möglicherweise gerade refreshed)
  const token = getAuthToken();

  // Merge headers mit Authorization
  const headers = {
    ...options.headers,
  };

  // Füge Authorization-Header hinzu, falls Token vorhanden
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Führe fetch aus
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // 401 Unauthorized - Automatischer Logout
  if (response.status === 401) {
    console.error('❌ [Auth] 401 Unauthorized - Token abgelaufen oder ungültig');
    handleAutoLogout();
    throw new Error('Sitzung abgelaufen. Sie werden zur Anmeldung weitergeleitet.');
  }

  return response;
};

/**
 * Fetch mit automatischem Authorization-Header und JSON-Response
 * Erweitert mit Auto-Refresh und Auto-Logout
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

// =====================================================================================
// EXPORTS
// =====================================================================================

export default fetchWithAuth;
