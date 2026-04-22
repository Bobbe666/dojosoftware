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
import '../styles/ApiHealthCheck.css';

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
      // WICHTIG: Verwende /auth/test (öffentlich) statt /test (benötigt Auth)
      const response = await axios.get('/auth/test', {
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
          setTimeout(() => setJustReconnected(false), 15000);
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

  // Server:maintenance Event von fetchWithAuth empfangen → sofort offline markieren
  useEffect(() => {
    const handleMaintenance = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
      setConsecutiveFailures(prev => Math.max(prev, 2));
      setRetryCountdown(5);
    };
    window.addEventListener('server:maintenance', handleMaintenance);
    return () => window.removeEventListener('server:maintenance', handleMaintenance);
  }, []);

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

  const kbdStyle = { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, padding: '1px 5px', fontSize: 11, fontFamily: 'monospace' };

  // Reconnection-Banner
  if (justReconnected) {
    return (
      <>
        <div className="ahc-reconnect-banner">
          <CheckCircle size={20} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="ahc-reconnect-text">
              ✅ Verbindung wiederhergestellt! Bitte <strong>Seite neu laden</strong> damit alles korrekt angezeigt wird.
            </span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>
              🖥 <strong>Safari:</strong> <kbd style={kbdStyle}>Opt ⌥ + Cmd ⌘ + R</kbd>
              &nbsp;·&nbsp;
              <strong>Chrome / Firefox / Edge (Mac):</strong> <kbd style={kbdStyle}>Cmd ⌘ + Shift + R</kbd>
              &nbsp;·&nbsp;
              <strong>Windows:</strong> <kbd style={kbdStyle}>Strg + Shift + R</kbd>
              &nbsp;·&nbsp;
              📱 <strong>Mobil:</strong> Seite schließen &amp; neu öffnen
            </span>
          </div>
        </div>

        {children}
      </>
    );
  }

  // Wartungs-Overlay
  if (!isOnline) {
    return (
      <>
        {/* Hintergrund-Overlay */}
        <div className="ahc-overlay">
          <div className="ahc-card">
            {/* Icon */}
            <div className="ahc-icon-wrap">
              🥋
            </div>

            {/* Titel */}
            <h2 className="ahc-title">
              Unser Server befindet sich gerade im Kampf mit den Updates!
            </h2>

            {/* Beschreibung */}
            <p className="ahc-subtitle">
              Wir sind gleich wieder für euch nach dieser Runde da!
            </p>

            {/* Fehlerdetails (optional) */}
            {lastError && (
              <div className="ahc-error-box">
                <AlertTriangle size={14} className="ahc-error-icon" />
                {lastError}
              </div>
            )}

            {/* Countdown */}
            {retryCountdown > 0 && (
              <div className="ahc-countdown-box">
                <p className="ahc-countdown-label">
                  Automatische Verbindungsprüfung in
                </p>
                <div className="ahc-countdown-number">
                  {retryCountdown}s
                </div>
              </div>
            )}

            {/* Retry-Button */}
            <button
              onClick={handleManualRetry}
              disabled={isChecking}
              className={`ahc-retry-btn ${isChecking ? 'ahc-retry-btn--checking' : 'ahc-retry-btn--idle'}`}
            >
              <RefreshCw size={18} className={isChecking ? 'ahc-spin' : ''} />
              {isChecking ? 'Prüfe Verbindung...' : 'Jetzt erneut versuchen'}
            </button>

            {/* Versuchs-Info */}
            {consecutiveFailures > 2 && (
              <p className="ahc-failures-text">
                Verbindungsversuche: {consecutiveFailures}
              </p>
            )}
          </div>
        </div>



        {/* App im Hintergrund (ausgegraut) */}
        <div className="ahc-blurred">
          {children}
        </div>
      </>
    );
  }

  // Alles OK - normale App anzeigen
  return children;
};

export default ApiHealthCheck;
