/**
 * API Health Check Component
 *
 * Überwacht die Backend-Verfügbarkeit und zeigt eine Wartungsmeldung,
 * wenn das Backend nicht erreichbar ist.
 *
 * Features:
 * - Automatische Health-Checks alle 10 Sekunden
 * - Wartungs-Overlay mit Auto-Reconnect Countdown
 * - Benachrichtigung wenn Verbindung wiederhergestellt
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff, CheckCircle } from 'lucide-react';
import axios from 'axios';
import config from '../config/config';

const ApiHealthCheck = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastError, setLastError] = useState(null);
  const [justReconnected, setJustReconnected] = useState(false);

  const checkIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const wasOfflineRef = useRef(false);

  // Health-Check durchführen
  const checkHealth = useCallback(async (isManualRetry = false) => {
    if (isChecking && !isManualRetry) return;

    setIsChecking(true);

    try {
      // Schneller Health-Check mit kurzem Timeout + Cache-Busting
      // Umgeht Service Worker Cache durch Cache-Control Header und Timestamp
      // WICHTIG: Relative URL verwenden, da axios.defaults.baseURL bereits gesetzt ist
      const response = await axios.get('/test', {
        timeout: 5000,
        validateStatus: (status) => status < 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        params: {
          _t: Date.now() // Cache-Buster
        }
      });

      if (response.status === 200) {
        // Verbindung wiederhergestellt
        if (wasOfflineRef.current) {
          setJustReconnected(true);
          setTimeout(() => setJustReconnected(false), 3000);
        }

        setIsOnline(true);
        setConsecutiveFailures(0);
        setLastError(null);
        setRetryCountdown(0);
        wasOfflineRef.current = false;
      }
    } catch (error) {
      console.warn('⚠️ [Health Check] Backend nicht erreichbar:', error.message);

      setConsecutiveFailures(prev => prev + 1);
      setLastError(getErrorMessage(error));

      // Nach 2 Fehlversuchen als offline markieren
      if (consecutiveFailures >= 1) {
        setIsOnline(false);
        wasOfflineRef.current = true;

        // Retry-Countdown starten (exponentielles Backoff)
        const retryDelay = Math.min(30, 5 * Math.pow(1.5, consecutiveFailures - 1));
        setRetryCountdown(Math.round(retryDelay));
      }
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, consecutiveFailures]);

  // Fehlermeldung formatieren
  const getErrorMessage = (error) => {
    if (error.code === 'ECONNABORTED') {
      return 'Zeitüberschreitung - Server antwortet nicht';
    }
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      return 'Netzwerkfehler - Server nicht erreichbar';
    }
    if (error.response?.status >= 500) {
      return `Serverfehler (${error.response.status})`;
    }
    return error.message || 'Verbindungsfehler';
  };

  // Manueller Retry
  const handleManualRetry = async () => {
    setRetryCountdown(0);
    await checkHealth(true);
  };

  // Initialer Check und Interval
  useEffect(() => {
    // Sofortiger Check beim Laden
    checkHealth();

    // Regelmäßige Checks alle 15 Sekunden
    checkIntervalRef.current = setInterval(() => {
      checkHealth();
    }, 15000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  // Countdown-Timer
  useEffect(() => {
    if (retryCountdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev <= 1) {
            checkHealth(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [retryCountdown > 0]);

  // Reconnection-Banner
  if (justReconnected) {
    return (
      <>
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <CheckCircle size={20} />
          <span style={{ fontWeight: 500 }}>
            Verbindung wiederhergestellt! Alles funktioniert wieder.
          </span>
        </div>
        <style>{`
          @keyframes slideDown {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
          }
        `}</style>
        {children}
      </>
    );
  }

  // Wartungs-Overlay
  if (!isOnline) {
    return (
      <>
        {/* Hintergrund-Overlay */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1e293b, #0f172a)',
            borderRadius: '20px',
            padding: '40px',
            maxWidth: '500px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            color: 'white'
          }}>
            {/* Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 24px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 2s infinite'
            }}>
              <WifiOff size={40} color="white" />
            </div>

            {/* Titel */}
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              marginBottom: '12px',
              color: '#f59e0b'
            }}>
              Kurze Wartungspause
            </h2>

            {/* Beschreibung */}
            <p style={{
              fontSize: '1rem',
              color: '#94a3b8',
              marginBottom: '24px',
              lineHeight: 1.6
            }}>
              Wir führen gerade Updates durch, um die Software noch besser zu machen.
              Das System ist gleich wieder verfügbar.
            </p>

            {/* Fehlerdetails (optional) */}
            {lastError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '24px',
                fontSize: '0.85rem',
                color: '#fca5a5'
              }}>
                <AlertTriangle size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                {lastError}
              </div>
            )}

            {/* Countdown */}
            {retryCountdown > 0 && (
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <p style={{
                  fontSize: '0.9rem',
                  color: '#60a5fa',
                  marginBottom: '8px'
                }}>
                  Automatische Verbindungsprüfung in
                </p>
                <div style={{
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  color: '#3b82f6',
                  fontFamily: 'monospace'
                }}>
                  {retryCountdown}s
                </div>
              </div>
            )}

            {/* Retry-Button */}
            <button
              onClick={handleManualRetry}
              disabled={isChecking}
              style={{
                background: isChecking
                  ? 'rgba(59, 130, 246, 0.3)'
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 28px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: isChecking ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.2s ease',
                boxShadow: isChecking ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.4)'
              }}
            >
              <RefreshCw
                size={18}
                style={{
                  animation: isChecking ? 'spin 1s linear infinite' : 'none'
                }}
              />
              {isChecking ? 'Prüfe Verbindung...' : 'Jetzt erneut versuchen'}
            </button>

            {/* Versuchs-Info */}
            {consecutiveFailures > 2 && (
              <p style={{
                marginTop: '20px',
                fontSize: '0.8rem',
                color: '#64748b'
              }}>
                Verbindungsversuche: {consecutiveFailures}
              </p>
            )}
          </div>
        </div>

        {/* CSS Animationen */}
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        {/* App im Hintergrund (ausgegraut) */}
        <div style={{ filter: 'blur(4px)', pointerEvents: 'none' }}>
          {children}
        </div>
      </>
    );
  }

  // Alles OK - normale App anzeigen
  return children;
};

export default ApiHealthCheck;
