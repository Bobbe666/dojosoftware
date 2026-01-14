import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Shield, Info, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDojoContext } from '../context/DojoContext';
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
  const { refreshDojos } = useDojoContext();
  const navigate = useNavigate();

  // Redirect wenn bereits eingeloggt - basierend auf Rolle
  const { user } = useAuth();
  if (isAuthenticated && !authLoading) {
    // Trainer zu Trainer-Dashboard weiterleiten
    const userRole = user?.rolle || user?.role;
    if ((userRole === 'eingeschraenkt' || userRole === 'trainer') && user?.username === 'TrainerloginTDA') {
      return <Navigate to="/trainer" replace />;
    }
    // Super-Admins ohne Dojo zur Multi-Dojo-Verwaltung
    if (userRole === 'super_admin' && !user?.dojo_id) {
      return <Navigate to="/dashboard/dojos" replace />;
    }
    // Alle anderen zu normalem Dashboard
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

      // Debug: Log userData to verify structure
      console.log('🔍 Login userData:', userData);
      console.log('🔍 Role check:', {
        role: userData.role,
        rolle: userData.rolle,
        username: userData.username
      });

      // 🔑 Lade Dojos nach erfolgreichem Login
      console.log('🔑 Login erfolgreich - lade Dojos neu');
      await refreshDojos();

      // Weiterleitung basierend auf Rolle (prüfe beide Eigenschaften für Kompatibilität)
      const userRole = userData.rolle || userData.role;
      if ((userRole === 'eingeschraenkt' || userRole === 'trainer') && userData.username === 'TrainerloginTDA') {
        console.log('✅ Redirecting to /trainer');
        navigate('/trainer', { replace: true });
      } else if (userRole === 'super_admin' && !userData.dojo_id) {
        // Super-Admins ohne Dojo-Zuordnung zur Multi-Dojo-Verwaltung
        console.log('✅ Redirecting super_admin to /dashboard/dojos');
        navigate('/dashboard/dojos', { replace: true });
      } else {
        console.log('✅ Redirecting to /dashboard');
        navigate('/dashboard', { replace: true });
      }

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
      {/* Navigation */}
      <nav className="login-nav">
        <div className="nav-container">
          <div className="nav-logo" onClick={() => navigate('/')}>
            <img src={dojoLogo} alt="DojoSoftware Logo" className="nav-logo-image" />
            <span className="logo-text">DojoSoftware</span>
          </div>
          <div className="nav-links">
            <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a>
            <a href="/#features">Features</a>
            <a href="/galerie">Galerie</a>
            <a href="/pricing">Preise</a>
            <a href="/#testimonials">Referenzen</a>
          </div>
        </div>
      </nav>

      {/* Main Split Layout */}
      <div className="login-split-layout">
        {/* Left Side - Logo Area */}
        <div className="login-branding">
          <div className="branding-content">
            <img src={dojoLogo} alt="Dojo Logo" className="branding-logo" />
            <h1 className="branding-title">DojoSoftware</h1>
            <p className="branding-subtitle">Die professionelle Lösung für Kampfsportschulen</p>
            <div className="branding-features">
              <div className="feature-item">
                <CheckCircle size={20} />
                <span>Mitgliederverwaltung</span>
              </div>
              <div className="feature-item">
                <CheckCircle size={20} />
                <span>Check-In System</span>
              </div>
              <div className="feature-item">
                <CheckCircle size={20} />
                <span>SEPA & Buchhaltung</span>
              </div>
              <div className="feature-item">
                <CheckCircle size={20} />
                <span>Prüfungswesen</span>
              </div>
              <div className="feature-item">
                <CheckCircle size={20} />
                <span>uvm...</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login & Register Cards */}
        <div className="login-forms-area">
          <div className="forms-container">
            {/* Login Card */}
            <div className="login-card">
              <div className="login-card-title">
                <LogIn size={16} />
                <span>Anmelden</span>
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
                      <LogIn size={18} />
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

            {/* Register Card */}
            <div className="register-card">
              <div className="login-card-title">
                <UserPlus size={16} />
                <span>Registrieren</span>
              </div>

              <div className="register-content">
                <p className="register-description">
                  Neu bei DojoSoftware? Registrieren Sie sich jetzt und starten Sie Ihre 14-tägige kostenlose Testphase.
                </p>

                <div className="register-benefits">
                  <div className="benefit-item">
                    <CheckCircle size={16} />
                    <span>14 Tage kostenlos testen</span>
                  </div>
                  <div className="benefit-item">
                    <CheckCircle size={16} />
                    <span>Keine Kreditkarte erforderlich</span>
                  </div>
                  <div className="benefit-item">
                    <CheckCircle size={16} />
                    <span>Vollständiger Funktionsumfang</span>
                  </div>
                  <div className="benefit-item">
                    <CheckCircle size={16} />
                    <span>Persönliche Einrichtungshilfe</span>
                  </div>
                  <div className="benefit-item">
                    <CheckCircle size={16} />
                    <span>uvm...</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="register-button"
                  onClick={() => setShowRegistrationModal(true)}
                  disabled={loading}
                >
                  <UserPlus size={18} />
                  <span>Jetzt registrieren</span>
                </button>

                <p className="register-note">
                  <Info size={14} />
                  <span>Vollständige Registrierung inkl. Vertragsdaten</span>
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="login-footer">
            <p className="version-info">
              DojoSoftware v2.0 | © 2024-2025
            </p>
            <div className="security-info">
              <Shield size={12} />
              <span>SSL-verschlüsselt | DSGVO-konform</span>
            </div>
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
