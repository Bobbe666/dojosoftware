import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Shield, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDojoContext } from '../context/DojoContext';
import config from '../config/config.js';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/login.css';
import '../styles/Buttons.css';

const defaultLogo = '/dojo-logo.png';

const ClubMemberLogin = () => {
  const [formData, setFormData] = useState({
    loginField: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState('email');
  const [successMessage, setSuccessMessage] = useState('');
  const [dojoData, setDojoData] = useState(null);
  const [loadingDojo, setLoadingDojo] = useState(false);

  const { login, isAuthenticated, loading: authLoading, user } = useAuth();
  const { refreshDojos } = useDojoContext();
  const navigate = useNavigate();

  // Subdomain aus Hostname extrahieren
  const getSubdomain = () => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    // z.B. dojo-3.dojo.tda-intl.org -> dojo-3
    if (parts.length >= 3 && parts[1] === 'dojo') {
      return parts[0];
    }
    return null;
  };

  const subdomain = getSubdomain();

  // Dojo-Daten laden
  useEffect(() => {
    const loadDojoData = async () => {
      if (!subdomain) return;

      try {
        setLoadingDojo(true);
        const response = await fetch(`${config.apiBaseUrl}/public/dojo/${subdomain}`);
        const result = await response.json();

        if (result.success && result.data) {
          setDojoData(result.data);
        }
      } catch (err) {
        console.error('Fehler beim Laden der Dojo-Daten:', err);
      } finally {
        setLoadingDojo(false);
      }
    };

    loadDojoData();
  }, [subdomain]);

  // Redirect wenn bereits eingeloggt
  if (isAuthenticated && !authLoading) {
    const userRole = user?.rolle || user?.role;
    if (userRole === 'mitglied') {
      return <Navigate to="/member/profile" replace />;
    }
    if ((userRole === 'eingeschraenkt' || userRole === 'trainer') && user?.username === 'TrainerloginTDA') {
      return <Navigate to="/trainer" replace />;
    }
    if (userRole === 'super_admin' && !user?.dojo_id) {
      return <Navigate to="/dashboard/dojos" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  // Automatische Erkennung ob Email oder Username
  const detectLoginType = (value) => {
    if (value.includes('@')) {
      setLoginType('email');
    } else {
      setLoginType('username');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'loginField') {
      detectLoginType(value);
    }

    if (error) setError('');
    if (successMessage) setSuccessMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (!formData.loginField.trim()) {
      setError('Bitte geben Sie Ihren Benutzernamen oder Ihre E-Mail-Adresse ein');
      setLoading(false);
      return;
    }

    if (!formData.password.trim()) {
      setError('Bitte geben Sie Ihr Passwort ein');
      setLoading(false);
      return;
    }

    try {
      const loginData = {
        password: formData.password.trim()
      };

      if (loginType === 'email') {
        loginData.email = formData.loginField.trim().toLowerCase();
      } else {
        loginData.username = formData.loginField.trim();
      }

      const userData = await login(loginData);

      setSuccessMessage(`Willkommen zurück, ${userData.vorname || userData.username}!`);

      await refreshDojos();

      const userRole = userData.rolle || userData.role;
      if (userRole === 'mitglied') {
        navigate('/member/profile', { replace: true });
      } else if ((userRole === 'eingeschraenkt' || userRole === 'trainer') && userData.username === 'TrainerloginTDA') {
        navigate('/trainer', { replace: true });
      } else if (userRole === 'super_admin' && !userData.dojo_id) {
        navigate('/dashboard/dojos', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }

    } catch (err) {
      console.error('Login-Fehler:', err);

      if (err.response?.status === 401) {
        setError('Ungültige Anmeldedaten. Bitte prüfen Sie Ihre E-Mail-Adresse und Passwort.');
      } else if (err.response?.status === 400) {
        setError('Bitte füllen Sie alle Felder korrekt aus.');
      } else if (err.response?.status === 500) {
        setError('Server-Fehler. Bitte versuchen Sie es später erneut.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Verbindung zum Server fehlgeschlagen. Prüfen Sie Ihre Internetverbindung.');
      } else {
        setError(err.response?.data?.message || 'Ein unbekannter Fehler ist aufgetreten.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loadingDojo) {
    return (
      <div className="login-container">
        <div className="login-loading">
          <div className="loading-spinner"></div>
          <p>Lade Anmeldung...</p>
        </div>
      </div>
    );
  }

  const clubName = dojoData?.dojoname || 'Dojo';
  const clubLogo = dojoData?.logo_url || '/logo-kampfkunstschule-schreiner.png';

  return (
    <div className="login-container club-member-login">
      {/* Split Layout - Logo links, Login rechts */}
      <div className="login-split-layout">
        {/* Linke Seite - Großes Club-Logo */}
        <div className="login-branding club-branding">
          <div className="branding-content">
            <img src={clubLogo} alt={clubName} className="branding-logo club-logo-large" />
            <h1 className="branding-title">{clubName}</h1>
            <p className="branding-subtitle">Willkommen bei {clubName}</p>
          </div>
        </div>

        {/* Rechte Seite - Login-Formular */}
        <div className="login-forms-area">
          <div className="forms-container">
            <div className="login-card">
              <div className="login-card-title">
                <Lock size={16} />
                <span>Mitglieder-Login</span>
              </div>

              <form onSubmit={handleSubmit} className="login-form">
                {/* Email/Username Feld */}
                <div className="form-group">
                  <label className="form-label">
                    <div className="label-content">
                      {loginType === 'email' ? (
                        <Mail size={16} className="label-icon" />
                      ) : (
                        <User size={16} className="label-icon" />
                      )}
                      <span>
                        {loginType === 'email' ? 'E-Mail' : 'Benutzername'}
                      </span>
                    </div>
                  </label>
                  <input
                    type="text"
                    name="loginField"
                    value={formData.loginField}
                    onChange={handleInputChange}
                    className={`form-input ${loginType === 'email' ? 'input-email' : 'input-username'}`}
                    placeholder={loginType === 'email' ? 'ihre-email@beispiel.de' : 'ihr-benutzername'}
                    required
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>

                {/* Passwort Feld */}
                <div className="form-group">
                  <label className="form-label">
                    <div className="label-content">
                      <Lock size={16} className="label-icon" />
                      <span>Passwort</span>
                    </div>
                  </label>
                  <div className="password-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="form-input password-input"
                      placeholder="Ihr Passwort"
                      required
                      autoComplete="current-password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      disabled={loading}
                      aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="error-message" role="alert">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Success Message */}
                {successMessage && (
                  <div className="success-message" role="alert">
                    <CheckCircle size={16} />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Login Button */}
                <button
                  type="submit"
                  className="login-button"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="button-spinner"></div>
                      <span>Anmelden...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={18} />
                      <span>Anmelden</span>
                    </>
                  )}
                </button>

                {/* Passwort vergessen Link */}
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={() => navigate('/password-reset')}
                  disabled={loading}
                >
                  Passwort vergessen?
                </button>
              </form>
            </div>
          </div>

          {/* Footer */}
          <div className="login-footer">
            <p className="version-info">
              DojoSoftware © 2024-2025
            </p>
            <div className="security-info">
              <Shield size={12} />
              <span>SSL-verschlüsselt | DSGVO-konform</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClubMemberLogin;
