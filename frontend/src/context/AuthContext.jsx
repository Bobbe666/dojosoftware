import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import config from '../config/config.js';

// AuthContext erstellen
const AuthContext = createContext(null);

// AuthProvider Komponente
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionExpiry, setSessionExpiry] = useState(null);

  // localStorage Keys
  const TOKEN_KEY = 'dojo_auth_token';
  const USER_KEY = 'dojo_user';
  const EXPIRY_KEY = 'dojo_session_expiry';

  // Debug-Funktion
  const debugLog = useCallback((message, data = null) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 AuthContext: ${message}`, data || '');
    }
  }, []);

  // Token aus JWT dekodieren
  const decodeToken = useCallback((token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (error) {
      debugLog('Fehler beim Dekodieren des Tokens', error);
      return null;
    }
  }, [debugLog]);

  // Token-Gültigkeit prüfen
  const isTokenValid = useCallback((token) => {
    if (!token) return false;
    
    try {
      const payload = decodeToken(token);
      if (!payload) return false;
      
      const currentTime = Math.floor(Date.now() / 1000);
      const isValid = payload.exp > currentTime;
      
      debugLog('Token-Validierung', {
        valid: isValid,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        currentTime: new Date(currentTime * 1000).toISOString()
      });
      
      return isValid;
    } catch (error) {
      debugLog('Fehler bei Token-Validierung', error);
      return false;
    }
  }, [decodeToken, debugLog]);

  // Session bereinigen
  const clearSession = useCallback(() => {
    debugLog('Session wird bereinigt');
    
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    
    // Axios default headers entfernen
    delete axios.defaults.headers.common['Authorization'];
    
    setToken(null);
    setUser(null);
    setSessionExpiry(null);
    setError(null);
  }, [debugLog]);

  // Session speichern
  const saveSession = useCallback((tokenData, userData) => {
    debugLog('Session wird gespeichert', {
      username: userData.username,
      role: userData.role
    });
    
    // Token dekodieren für Expiry-Zeit
    const payload = decodeToken(tokenData);
    const expiryTime = payload ? payload.exp * 1000 : Date.now() + (8 * 60 * 60 * 1000); // 8h fallback
    
    // In localStorage speichern
    localStorage.setItem(TOKEN_KEY, tokenData);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    localStorage.setItem(EXPIRY_KEY, expiryTime.toString());
    
    // Axios default headers setzen
    axios.defaults.headers.common['Authorization'] = `Bearer ${tokenData}`;
    
    // State aktualisieren
    setToken(tokenData);
    setUser(userData);
    setSessionExpiry(expiryTime);
    setError(null);
  }, [decodeToken, debugLog]);

  // Token-Validierung beim Backend
  const validateTokenWithBackend = useCallback(async (token) => {
    try {
      const response = await axios.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      debugLog('Backend-Token-Validierung erfolgreich', response.data.user);
      return response.data;
    } catch (error) {
      debugLog('Backend-Token-Validierung fehlgeschlagen', error.response?.status);
      return null;
    }
  }, [debugLog]);

  // Session beim App-Start initialisieren
  useEffect(() => {
    const initializeAuth = async () => {
      debugLog('AuthContext wird initialisiert');

      // 🔧 DEVELOPMENT MODE: Fake Admin Session
      const isDevelopment = import.meta.env.MODE === 'development';
      if (isDevelopment) {
        debugLog('Development Mode: Fake Admin-Session wird erstellt');
        const fakeUser = {
          id: 1,
          username: 'dev-admin',
          email: 'dev@admin.local',
          role: 'admin',
          vorname: 'Dev',
          nachname: 'Admin'
        };

        // Erstelle ein fake JWT-Token mit admin role
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({
          id: 1,
          username: 'dev-admin',
          role: 'admin',
          email: 'dev@admin.local',
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 Stunden gültig
        }));
        const signature = 'fake-signature';
        const fakeToken = `${header}.${payload}.${signature}`;

        setUser(fakeUser);
        setToken(fakeToken);
        setLoading(false);

        debugLog('AuthContext State Update', {
          hasUser: true,
          hasToken: true,
          isAuthenticated: true,
          loading: false,
          error: false,
          role: 'admin'
        });
        return;
      }

      try {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        const savedUser = localStorage.getItem(USER_KEY);
        const savedExpiry = localStorage.getItem(EXPIRY_KEY);

        if (!savedToken || !savedUser) {
          debugLog('Keine gespeicherte Session gefunden');
          setLoading(false);
          return;
        }

        // Token-Gültigkeit prüfen
        if (!isTokenValid(savedToken)) {
          debugLog('Gespeicherter Token ist abgelaufen');
          clearSession();
          setLoading(false);
          return;
        }

        // User-Daten parsen
        const userData = JSON.parse(savedUser);
        
        debugLog('Gespeicherte Session gefunden', {
          username: userData.username,
          role: userData.role,
          expiry: savedExpiry ? new Date(parseInt(savedExpiry)).toISOString() : 'unbekannt'
        });

        // Backend-Validierung (optional, aber empfohlen)
        const backendValidation = await validateTokenWithBackend(savedToken);
        
        if (backendValidation && backendValidation.tokenValid) {
          // Session wiederherstellen
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
          setToken(savedToken);
          setUser(userData);
          setSessionExpiry(savedExpiry ? parseInt(savedExpiry) : null);
          
          debugLog('Session erfolgreich wiederhergestellt', userData.username);
        } else {
          debugLog('Backend-Validierung fehlgeschlagen - Session gelöscht');
          clearSession();
        }
        
      } catch (error) {
        debugLog('Fehler beim Initialisieren der Session', error);
        clearSession();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [isTokenValid, clearSession, validateTokenWithBackend, debugLog]);

  // Session-Expiry-Timer
  useEffect(() => {
    if (!sessionExpiry) return;

    const checkExpiry = () => {
      const now = Date.now();
      const timeToExpiry = sessionExpiry - now;
      
      if (timeToExpiry <= 0) {
        debugLog('Session abgelaufen - automatischer Logout');
        logout();
      } else if (timeToExpiry <= 5 * 60 * 1000) { // 5 Minuten vor Ablauf
        debugLog('Session läuft bald ab', {
          minutesLeft: Math.floor(timeToExpiry / 1000 / 60)
        });
        // Hier könnte eine Warnung angezeigt oder die Session erneuert werden
      }
    };

    const interval = setInterval(checkExpiry, 60000); // Jede Minute prüfen
    return () => clearInterval(interval);
  }, [sessionExpiry]);

  // Login-Funktion
  const login = useCallback(async (credentials) => {
    setError(null);
    setLoading(true);
    
    try {
      debugLog('Login-Versuch gestartet', {
        hasEmail: !!credentials.email,
        hasUsername: !!credentials.username,
        apiUrl: `${config.apiBaseUrl}/api/auth/login`
      });

      // API-Request
      const response = await axios.post('/auth/login', credentials, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 Sekunden Timeout
      });
      
      const { token: newToken, user: userData, message } = response.data;

      // Response-Validierung
      if (!newToken || !userData) {
        throw new Error('Unvollständige Server-Antwort');
      }

      debugLog('Login erfolgreich', {
        username: userData.username,
        email: userData.email,
        role: userData.role,
        message
      });

      // Session speichern
      saveSession(newToken, userData);

      return userData;

    } catch (error) {
      debugLog('Login-Fehler', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        code: error.code
      });
      
      let errorMessage = 'Login fehlgeschlagen';
      
      if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Verbindung zum Server fehlgeschlagen';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Anfrage-Timeout - Server antwortet nicht';
      } else if (error.response?.status === 401) {
        errorMessage = error.response.data?.message || 'Ungültige Anmeldedaten';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Ungültige Eingabedaten';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server-Fehler - bitte versuchen Sie es später erneut';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [debugLog, saveSession]);

  // Logout-Funktion
  const logout = useCallback(async (silent = false) => {
    if (!silent) {
      debugLog('Logout gestartet');
    }
    
    try {
      // Backend über Logout informieren (falls Token noch gültig)
      if (token && isTokenValid(token)) {
        await axios.post('/auth/logout', {}, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        });
        debugLog('Backend-Logout erfolgreich');
      }
    } catch (error) {
      // Logout-Fehler sind nicht kritisch
      debugLog('Backend-Logout fehlgeschlagen (nicht kritisch)', error.response?.status);
    } finally {
      clearSession();
      if (!silent) {
        debugLog('Logout abgeschlossen');
      }
    }
  }, [token, isTokenValid, clearSession, debugLog]);

  // User-Daten aktualisieren
  const updateUser = useCallback((updates) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...updates };
    
    debugLog('User-Daten aktualisiert', {
      username: updatedUser.username,
      updates: Object.keys(updates)
    });
    
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, [user, debugLog]);

  // Session erneuern (falls Backend das unterstützt)
  const refreshSession = useCallback(async () => {
    if (!token) return false;

    try {
      debugLog('Session-Erneuerung gestartet');

      const response = await axios.post('/auth/refresh', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const { token: newToken, user: userData } = response.data;
      
      if (newToken && userData) {
        saveSession(newToken, userData);
        debugLog('Session erfolgreich erneuert');
        return true;
      }
      
      return false;
    } catch (error) {
      debugLog('Session-Erneuerung fehlgeschlagen', error.response?.status);
      return false;
    }
  }, [token, saveSession, debugLog]);

  // Auth-Status für Debugging
  const getAuthStatus = useCallback(() => {
    return {
      isAuthenticated: !!token && !!user,
      user: user,
      role: user?.role,
      tokenExists: !!token,
      tokenValid: token ? isTokenValid(token) : false,
      loading,
      error,
      sessionExpiry: sessionExpiry ? new Date(sessionExpiry).toISOString() : null,
      timeToExpiry: sessionExpiry ? Math.max(0, sessionExpiry - Date.now()) : null
    };
  }, [user, token, loading, error, sessionExpiry, isTokenValid]);

  // Rollen-Prüfung
  const hasRole = useCallback((requiredRole) => {
    return user?.role === requiredRole;
  }, [user]);

  const isAdmin = useCallback(() => {
    return hasRole('admin');
  }, [hasRole]);

  // Context-Wert
  const contextValue = {
    // State
    user,
    token,
    loading,
    error,
    sessionExpiry,
    
    // Computed
    isAuthenticated: !!token && !!user && isTokenValid(token),
    isAdmin: isAdmin(),
    
    // Actions
    login,
    logout,
    updateUser,
    refreshSession,
    changePassword: async ({ currentPassword, newPassword }) => {
      if (!token) throw new Error('Nicht authentifiziert');
      const response = await axios.post('/auth/change-password', { currentPassword, newPassword }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    resetPassword: async ({ loginField, securityQuestion, securityAnswer, newPassword }) => {
      const response = await axios.post('/auth/reset-password', { loginField, securityQuestion, securityAnswer, newPassword });
      return response.data;
    },
    saveSecurityQuestion: async ({ securityQuestion, securityAnswer }) => {
      if (!token) throw new Error('Nicht authentifiziert');
      const response = await axios.post('/auth/security', { securityQuestion, securityAnswer }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    },
    
    // Utilities
    hasRole,
    getAuthStatus,
    clearError: () => setError(null)
  };

  // Debug-Output bei State-Änderungen
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      debugLog('AuthContext State Update', {
        hasUser: !!user,
        hasToken: !!token,
        isAuthenticated: !!token && !!user,
        loading,
        error: !!error
      });
    }
  }, [user, token, loading, error, debugLog]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// useAuth Hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  }
  
  return context;
};

// HOC für geschützte Komponenten
export const withAuth = (Component) => {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, loading } = useAuth();
    
    if (loading) {
      return (
        <div className="auth-loading">
          <div className="loading-spinner"></div>
          <p>Authentifizierung wird geprüft...</p>
        </div>
      );
    }
    
    if (!isAuthenticated) {
      return (
        <div className="auth-required">
          <p>Sie müssen angemeldet sein, um diese Seite zu sehen.</p>
        </div>
      );
    }
    
    return <Component {...props} />;
  };
};

// Rollen-basierter HOC
export const withRole = (requiredRole) => (Component) => {
  return function RoleProtectedComponent(props) {
    const { hasRole, loading, isAuthenticated } = useAuth();
    
    if (loading) {
      return (
        <div className="auth-loading">
          <div className="loading-spinner"></div>
          <p>Berechtigung wird geprüft...</p>
        </div>
      );
    }
    
    if (!isAuthenticated) {
      return (
        <div className="auth-required">
          <p>Sie müssen angemeldet sein.</p>
        </div>
      );
    }
    
    if (!hasRole(requiredRole)) {
      return (
        <div className="role-required">
          <p>Sie haben nicht die erforderlichen Berechtigungen für diese Seite.</p>
          <p>Erforderliche Rolle: {requiredRole}</p>
        </div>
      );
    }
    
    return <Component {...props} />;
  };
};

export default AuthContext;