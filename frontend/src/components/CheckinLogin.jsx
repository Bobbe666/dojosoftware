import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Lock, Mail, User, Eye, EyeOff, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDojoContext } from '../context/DojoContext';
import { CURRENT_VERSION } from '../version.js';
import dojoLogo from '../assets/dojo-logo.png';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/login.css';
import '../styles/Buttons.css';

const CheckinLogin = () => {
  const [formData, setFormData] = useState({ loginField: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState('email');
  const [successMessage, setSuccessMessage] = useState('');

  const { login, isAuthenticated, loading: authLoading, user } = useAuth();
  const { refreshDojos } = useDojoContext();
  const navigate = useNavigate();

  // Bereits eingeloggt → direkt zum Checkin
  if (isAuthenticated && !authLoading) {
    const userRole = user?.rolle || user?.role;
    if (userRole === 'mitglied' || userRole === 'member') {
      return <Navigate to="/member/dashboard" replace />;
    }
    return <Navigate to="/dashboard/checkin" replace />;
  }

  const detectLoginType = (value) => {
    setLoginType(value.includes('@') ? 'email' : 'username');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'loginField') detectLoginType(value);
    if (error) setError('');
    if (successMessage) setSuccessMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.loginField.trim()) {
      setError('Bitte E-Mail oder Benutzername eingeben');
      setLoading(false);
      return;
    }
    if (!formData.password.trim()) {
      setError('Bitte Passwort eingeben');
      setLoading(false);
      return;
    }

    try {
      const loginData = { password: formData.password.trim() };
      if (loginType === 'email') {
        loginData.email = formData.loginField.trim().toLowerCase();
      } else {
        loginData.username = formData.loginField.trim();
      }

      const userData = await login(loginData);
      setSuccessMessage(`Willkommen, ${userData.vorname || userData.username}!`);
      await refreshDojos();
      navigate('/dashboard/checkin', { replace: true });

    } catch (err) {
      if (err.response?.status === 401) {
        setError('Ungültige Anmeldedaten.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Keine Verbindung zum Server.');
      } else {
        setError(err.response?.data?.message || 'Anmeldefehler aufgetreten.');
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
          <p>Lade...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container club-member-login">
      <div className="login-split-layout">
        {/* Linke Seite - Branding */}
        <div className="login-branding club-branding">
          <div className="branding-content">
            <img src={dojoLogo} alt="Dojo Logo" className="branding-logo club-logo-large" />
            <h1 className="branding-title">Check-In System</h1>
            <p className="branding-subtitle">Trainer-Anmeldung</p>
          </div>
        </div>

        {/* Rechte Seite - Login-Formular */}
        <div className="login-forms-area">
          <div className="forms-container">
            <div className="login-card">
              <div className="login-card-title">
                <Lock size={16} />
                <span>Trainer-Login</span>
              </div>

              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label className="form-label">
                    <div className="label-content">
                      {loginType === 'email' ? (
                        <Mail size={16} className="label-icon" />
                      ) : (
                        <User size={16} className="label-icon" />
                      )}
                      <span>{loginType === 'email' ? 'E-Mail' : 'Benutzername'}</span>
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

                {error && (
                  <div className="error-message" role="alert">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="success-message" role="alert">
                    <CheckCircle size={16} />
                    <span>{successMessage}</span>
                  </div>
                )}

                <button type="submit" className="login-button" disabled={loading}>
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
              </form>
            </div>
          </div>

          <div className="login-footer">
            <p className="version-info">DojoSoftware v{CURRENT_VERSION} | Check-In</p>
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

export default CheckinLogin;
