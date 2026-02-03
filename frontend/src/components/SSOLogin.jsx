import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import config from '../config/config';
import '../styles/login.css';

/**
 * SSO Login Komponente
 * Wird aufgerufen von tda-intl.com mit einem einmaligen SSO-Token
 * Validiert den Token und loggt den User automatisch ein
 */
const SSOLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setError('Kein SSO-Token gefunden');
      return;
    }

    performSSOLogin(token);
  }, [searchParams]);

  const performSSOLogin = async (ssoToken) => {
    try {
      setStatus('loading');

      const response = await fetch(`${config.apiBaseUrl}/auth/sso-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: ssoToken })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'SSO-Login fehlgeschlagen');
      }

      // Token und User-Daten speichern
      localStorage.setItem('token', data.token);
      localStorage.setItem('sessionToken', data.sessionToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Auth-Context aktualisieren
      if (login) {
        // Simuliere einen erfolgreichen Login
        window.dispatchEvent(new CustomEvent('sso-login-success', { detail: data }));
      }

      setStatus('success');

      // Kurze Verzögerung für visuelles Feedback, dann redirect
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);

    } catch (err) {
      console.error('SSO-Login-Fehler:', err);
      setStatus('error');
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src="/dojo-logo.png" alt="DojoSoftware" className="login-logo" />

        {status === 'loading' && (
          <div className="sso-status">
            <div className="sso-spinner"></div>
            <h2>Automatischer Login...</h2>
            <p>Sie werden eingeloggt und weitergeleitet.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="sso-status sso-success">
            <div className="sso-checkmark">✓</div>
            <h2>Login erfolgreich!</h2>
            <p>Sie werden zum Dashboard weitergeleitet...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="sso-status sso-error">
            <div className="sso-error-icon">✕</div>
            <h2>Login fehlgeschlagen</h2>
            <p>{error}</p>
            <button
              className="btn-primary"
              onClick={() => navigate('/login')}
              style={{ marginTop: '1rem' }}
            >
              Zum normalen Login
            </button>
          </div>
        )}
      </div>

      <style>{`
        .sso-status {
          text-align: center;
          padding: 2rem;
        }

        .sso-status h2 {
          margin: 1rem 0 0.5rem;
          color: var(--text-primary, #fff);
        }

        .sso-status p {
          color: var(--text-secondary, rgba(255,255,255,0.7));
        }

        .sso-spinner {
          width: 50px;
          height: 50px;
          border: 3px solid rgba(255,255,255,0.2);
          border-top-color: var(--primary-color, #ffd700);
          border-radius: 50%;
          margin: 0 auto;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .sso-checkmark {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #4caf50;
          color: white;
          font-size: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        }

        .sso-error-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #f44336;
          color: white;
          font-size: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        }

        .sso-success h2 {
          color: #4caf50;
        }

        .sso-error h2 {
          color: #f44336;
        }
      `}</style>
    </div>
  );
};

export default SSOLogin;
