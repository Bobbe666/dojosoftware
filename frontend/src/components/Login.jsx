import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Shield, Info, UserPlus, LogIn, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useDojoContext } from '../context/DojoContext';
import NeuesMitgliedAnlegen from './NeuesMitgliedAnlegen';
import LanguageSwitcher from './LanguageSwitcher';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/login.css';
import '../styles/Buttons.css';

const dojoLogo = '/dojo-logo.png';

const Login = () => {
  const { t } = useTranslation('auth');
  const [searchParams] = useSearchParams();
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

  // Prüfe URL-Parameter für Fehlermeldungen (z.B. nach Auto-Logout)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const expiredParam = searchParams.get('expired');

    if (errorParam === 'wrong_dojo') {
      setError(t('errors.accessDenied'));
    } else if (expiredParam === '1') {
      setError(t('errors.sessionExpired'));
    }
  }, [searchParams, t]);

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
      setError(t('errors.requiredField'));
      setLoading(false);
      return;
    }

    if (!formData.password.trim()) {
      setError(t('errors.requiredField'));
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
      console.error('Login-Fehler:', err);

      if (err.response?.status === 401) {
        setError(t('errors.invalidCredentials'));
      } else if (err.response?.status === 403) {
        // Kein Zugriff auf dieses Dojo
        const errorMsg = err.response?.data?.message || '';
        if (errorMsg.includes('keinen Zugriff') || errorMsg.includes('Zugriff verweigert')) {
          setError(t('errors.accessDenied'));
        } else {
          setError(t('errors.wrongDojo'));
        }
      } else if (err.response?.status === 400) {
        setError(t('errors.requiredField'));
      } else if (err.response?.status === 500) {
        setError(t('errors.serverError'));
      } else if (err.code === 'ERR_NETWORK') {
        setError(t('errors.networkError'));
      } else {
        setError(err.response?.data?.message || t('errors.serverError'));
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
          <p>{t('login.loading')}</p>
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
            <a href="/probetraining" onClick={(e) => { e.preventDefault(); navigate('/probetraining'); }} className="nav-link-highlight">Probetraining</a>
            <LanguageSwitcher compact={true} />
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
                <span>{t('login.title')}</span>
              </div>

              <form onSubmit={handleSubmit} className="login-form">
                {/* Email/Username Feld */}
                <div className="form-group">
                  <label className="form-label">
                    <div className="label-content">
                      <User size={16} className="label-icon" />
                      <span>E-Mail oder Benutzername</span>
                    </div>
                  </label>
                  <input
                    type="text"
                    name="loginField"
                    value={formData.loginField}
                    onChange={handleInputChange}
                    className={`form-input ${loginType === 'email' ? 'input-email' : 'input-username'}`}
                    placeholder="E-Mail oder Benutzername"
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
                      <span>{t('login.password')}</span>
                    </div>
                  </label>
                  <div className="password-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="form-input password-input"
                      placeholder={t('login.passwordPlaceholder')}
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
                      <span>{t('login.loading')}</span>
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      <span>{t('login.button')}</span>
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
                  {t('login.forgotPassword')}
                </button>
              </form>
            </div>

            {/* Register Card */}
            <div className="register-card">
              <div className="login-card-title">
                <UserPlus size={16} />
                <span>{t('register.title')}</span>
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
                  <span>{t('login.register')}</span>
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
