import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Shield, Info, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NeuesMitgliedAnlegen from './NeuesMitgliedAnlegen';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/login.css';
import dojoLogo from '../assets/dojo-logo.png';
import '../styles/Buttons.css';

const Login = () => {
  const [formData, setFormData] = useState({
    loginField: '',  // Kann Email oder Username sein
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState('email'); // 'email' oder 'username'
  const [successMessage, setSuccessMessage] = useState('');
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect wenn bereits eingeloggt - basierend auf Rolle
  const { user } = useAuth();
  if (isAuthenticated && !authLoading) {
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

    // Error und Success-Messages zurücksetzen bei Eingabe
    if (error) setError('');
    if (successMessage) setSuccessMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    // Eingabe-Validierung
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
      // Login-Daten vorbereiten
      const loginData = {
        password: formData.password.trim()
      };

      // Email oder Username setzen
      if (loginType === 'email') {
        loginData.email = formData.loginField.trim().toLowerCase();
      } else {
        loginData.username = formData.loginField.trim();
      }

      const userData = await login(loginData);
      
      setSuccessMessage(`Willkommen zurück, ${userData.username}!`);

      // Weiterleitung zu Dashboard (funktioniert für Admin und Mitglieder)
      navigate('/dashboard', { replace: true });
      
    } catch (err) {
      console.error('? Login-Fehler:', err);
      
      if (err.response?.status === 401) {
        setError('Ungültige Anmeldedaten. Bitte prüfen Sie Username/Email und Passwort.');
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

  if (authLoading) {
    return (
      <div className="login-container">
        <div className="login-loading">
          <div className="loading-spinner"></div>
          <p>Lade Anmeldung...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="japanese-title">Tiger & Dragon Association - International</div>
          <div className="logo">
            <img src={dojoLogo} alt="Dojo Logo" className="logo-image" />
            <h1 className="title">DojoSoftware</h1>
          </div>
          <div className="security-badge">
            <Shield size={16} />
            <span>Sicher verschlüsselt</span>
          </div>
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
                  {loginType === 'email' ? 'E-Mail-Adresse' : 'Benutzername'}
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
            <small className="input-hint">
              <Info size={12} />
              Sie können sich mit E-Mail oder Benutzername anmelden
            </small>
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
            className={`login-button btn btn-primary btn-small ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="button-spinner"></div>
                <span>Anmelden...</span>
              </>
            ) : (
              <>
                <Shield size={16} />
                <span>Anmelden</span>
              </>
            )}
          </button>
        </form>

        {/* Passwort vergessen Link */}
        <div className="forgot-password">
          <button
            type="button"
            className="link-button btn btn-link btn-small"
            onClick={() => navigate('/password-reset')}
            disabled={loading}
          >
            Passwort vergessen? Passwort zurücksetzen
          </button>
        </div>

        {/* Registrierungsbutton */}
        <div className="registration-section">
          <div className="registration-divider">
            <span>oder</span>
          </div>
          <button
            type="button"
            className="registration-button btn btn-secondary"
            onClick={() => setShowRegistrationModal(true)}
            disabled={loading}
          >
            <UserPlus size={16} />
            <span>Neues Mitglied registrieren</span>
          </button>
          <p className="registration-info">
            <Info size={12} />
            Vollständige Registrierung inkl. Vertrag erforderlich
          </p>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p className="version-info">
            DojoSoftware v2.0 | © 2024-2025
          </p>
          <div className="security-info">
            <Shield size={12} />
            <span>JWT-Authentication | bcrypt-Verschlüsselung</span>
          </div>
        </div>
      </div>

      {/* Registrierungs-Modal */}
      {showRegistrationModal && (
        <NeuesMitgliedAnlegen 
          onClose={() => setShowRegistrationModal(false)}
          isRegistrationFlow={true}
          onRegistrationComplete={(success) => {
            if (success) {
              setShowRegistrationModal(false);
              setSuccessMessage('Registrierung erfolgreich abgeschlossen! Sie können sich jetzt anmelden.');
            }
          }}
        />
      )}
    </div>
  );
};

export default Login;