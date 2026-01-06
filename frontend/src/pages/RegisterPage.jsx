import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import config from '../config';
import '../styles/themes.css';
import './RegisterPage.css';
import dojoLogo from '../assets/dojo-logo.png';
import PublicFooter from '../components/PublicFooter';

function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    dojoName: '',
    subdomain: '',
    ownerName: '',
    ownerEmail: '',
    phone: '',
    password: '',
    passwordConfirm: '',
    selectedPlan: location.state?.selectedPlan || 'starter',
    acceptTerms: false
  });

  const [errors, setErrors] = useState({});
  const [subdomainStatus, setSubdomainStatus] = useState({ checking: false, available: null, message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredData, setRegisteredData] = useState(null);

  let subdomainCheckTimeout = null;

  // Subdomain-Check mit Debounce
  useEffect(() => {
    if (formData.subdomain.length >= 3) {
      clearTimeout(subdomainCheckTimeout);
      subdomainCheckTimeout = setTimeout(() => {
        checkSubdomain(formData.subdomain);
      }, 500);
    } else {
      setSubdomainStatus({ checking: false, available: null, message: '' });
    }

    return () => clearTimeout(subdomainCheckTimeout);
  }, [formData.subdomain]);

  const checkSubdomain = async (subdomain) => {
    setSubdomainStatus({ checking: true, available: null, message: '' });

    try {
      const response = await axios.get(`${config.apiBaseUrl}/onboarding/check-subdomain/${subdomain}`);

      setSubdomainStatus({
        checking: false,
        available: response.data.available,
        message: response.data.available ? 'Verfügbar!' : (response.data.reason || 'Nicht verfügbar')
      });
    } catch (error) {
      console.error('Subdomain-Check Fehler:', error);
      
      // Detaillierte Fehlermeldung basierend auf der Antwort
      let errorMessage = 'Fehler bei der Prüfung';
      
      if (error.response) {
        // Server hat geantwortet mit Statuscode außerhalb 2xx
        if (error.response.data && error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.status === 404) {
          errorMessage = 'API-Endpoint nicht gefunden. Bitte Server-URL prüfen.';
        } else if (error.response.status === 500) {
          errorMessage = 'Serverfehler bei der Prüfung. Bitte später erneut versuchen.';
        }
      } else if (error.request) {
        // Request wurde gemacht, aber keine Antwort erhalten
        errorMessage = 'Keine Antwort vom Server. Bitte Verbindung prüfen.';
      } else {
        // Fehler beim Setup des Requests
        errorMessage = `Netzwerkfehler: ${error.message}`;
      }
      
      setSubdomainStatus({
        checking: false,
        available: false,
        message: errorMessage
      });
    }
  };

  const handleSubdomainChange = (e) => {
    let value = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-')
      .slice(0, 30);

    setFormData({ ...formData, subdomain: value });
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.dojoName || formData.dojoName.length < 3) {
      newErrors.dojoName = 'Dojo-Name muss mindestens 3 Zeichen haben';
    }

    if (!formData.subdomain || formData.subdomain.length < 3) {
      newErrors.subdomain = 'Subdomain muss mindestens 3 Zeichen haben';
    } else if (subdomainStatus.available === false) {
      newErrors.subdomain = subdomainStatus.message || 'Diese Subdomain ist nicht verfügbar';
    } else if (subdomainStatus.available === null || subdomainStatus.checking) {
      newErrors.subdomain = 'Bitte warte bis die Subdomain-Prüfung abgeschlossen ist';
    }

    if (!formData.ownerName || formData.ownerName.length < 2) {
      newErrors.ownerName = 'Bitte gib deinen Namen ein';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.ownerEmail || !emailRegex.test(formData.ownerEmail)) {
      newErrors.ownerEmail = 'Bitte gib eine gültige E-Mail-Adresse ein';
    }

    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'Passwort muss mindestens 8 Zeichen lang sein';
    }

    if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = 'Passwörter stimmen nicht überein';
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'Bitte akzeptiere die AGB und Datenschutzerklärung';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀 Submit gestartet');
    console.log('📋 Form Data:', formData);
    console.log('🔍 Subdomain Status:', subdomainStatus);

    if (!validate()) {
      console.log('❌ Validierung fehlgeschlagen, Errors:', errors);
      return;
    }

    console.log('✅ Validierung erfolgreich, sende Request...');
    setLoading(true);
    setErrors({});

    try {
      const payload = {
        dojo_name: formData.dojoName,
        subdomain: formData.subdomain,
        owner_name: formData.ownerName,
        owner_email: formData.ownerEmail,
        phone: formData.phone,
        password: formData.password,
        selected_plan: formData.selectedPlan
      };
      console.log('📤 Payload:', payload);

      const response = await axios.post(`${config.apiBaseUrl}/onboarding/register-dojo`, payload);
      console.log('📥 Response:', response.data);

      if (response.data.success) {
        console.log('✅ Registrierung erfolgreich!');
        setRegisteredData(response.data);
        setSuccess(true);
      }

    } catch (error) {
      console.error('❌ Registrierungsfehler:', error);
      console.error('📄 Error Response:', error.response?.data);
      setErrors({
        general: error.response?.data?.error || 'Registrierung fehlgeschlagen. Bitte versuche es erneut.'
      });
    } finally {
      setLoading(false);
    }
  };

  if (success && registeredData) {
    return (
      <div className="register-page">
        <div className="success-container">
          <div className="success-icon">🎉</div>
          <h1>Willkommen bei DojoSoftware!</h1>
          <p className="success-message">
            Dein Dojo <strong>{formData.dojoName}</strong> wurde erfolgreich registriert!
          </p>

          <div className="success-info">
            <div className="info-box">
              <h3><span className="section-icon">📧</span> E-Mail gesendet</h3>
              <p>Wir haben dir eine Bestätigungs-E-Mail an <strong>{formData.ownerEmail}</strong> geschickt.</p>
            </div>

            <div className="info-box">
              <h3><span className="section-icon">🌐</span> Dein Zugang</h3>
              <p className="subdomain-url">{formData.subdomain}.dojo.tda-intl.org</p>
            </div>

            <div className="info-box">
              <h3><span className="section-icon">⏱️</span> Trial-Phase</h3>
              <p>Du hast <strong>14 Tage</strong> kostenlosen Zugriff auf alle Features.</p>
              <p className="trial-date">Endet am: {new Date(registeredData.trial_ends_at).toLocaleDateString('de-DE')}</p>
            </div>
          </div>

          <div className="next-steps">
            <h3><span className="section-icon">🚀</span> Nächste Schritte</h3>
            <ol style={{ textAlign: 'left', margin: '1rem auto', maxWidth: '500px' }}>
              <li>Logge dich mit deiner E-Mail und deinem Passwort ein</li>
              <li>Vervollständige dein Dojo-Profil</li>
              <li>Lade deine ersten Mitglieder ein</li>
            </ol>
            <button
              className="cta-btn"
              onClick={() => {
                const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                window.location.href = isLocalhost ? '/login' : registeredData.login_url;
              }}
            >
              Jetzt zum Login und loslegen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="register-page">
      {/* Navigation */}
      <nav className="register-nav">
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
            <button className="nav-login-btn" onClick={() => navigate('/login')}>
              Login
            </button>
          </div>
        </div>
      </nav>

      <div className="register-container">
        {/* Header */}
        <div className="register-header">
          <h1>Registriere dein Dojo</h1>
          <p>14 Tage kostenlos testen - keine Kreditkarte erforderlich</p>
        </div>

        {/* Plan Selection Pills */}
        <div className="plan-pills">
          {['starter', 'professional', 'premium', 'enterprise'].map((plan) => (
            <button
              key={plan}
              className={`plan-pill ${formData.selectedPlan === plan ? 'active' : ''}`}
              onClick={() => setFormData({ ...formData, selectedPlan: plan })}
            >
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
              {plan === 'professional' && <span className="popular-tag">Beliebt</span>}
            </button>
          ))}
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="register-form">
          {errors.general && (
            <div className="error-banner">{errors.general}</div>
          )}

          {/* Dojo Information */}
          <section className="form-section">
            <h3><span className="section-icon">🥋</span> Dojo-Informationen</h3>

            <div className="form-group">
              <label>Dojo-Name *</label>
              <input
                type="text"
                value={formData.dojoName}
                onChange={(e) => setFormData({ ...formData, dojoName: e.target.value })}
                placeholder="z.B. Budokan Berlin"
                className={errors.dojoName ? 'error' : ''}
              />
              {errors.dojoName && <span className="error-text">{errors.dojoName}</span>}
            </div>

            <div className="form-group">
              <label>Subdomain * (Deine Zugangs-URL)</label>
              <div className="subdomain-input-group">
                <input
                  type="text"
                  value={formData.subdomain}
                  onChange={handleSubdomainChange}
                  placeholder="budokan-berlin"
                  className={errors.subdomain ? 'error' : ''}
                />
                <span className="subdomain-suffix">.dojo.tda-intl.org</span>
              </div>

              {subdomainStatus.checking && (
                <span className="subdomain-status checking">Prüfe Verfügbarkeit...</span>
              )}
              {!subdomainStatus.checking && subdomainStatus.available === true && (
                <span className="subdomain-status available">✓ {subdomainStatus.message}</span>
              )}
              {!subdomainStatus.checking && subdomainStatus.available === false && (
                <span className="subdomain-status unavailable">✗ {subdomainStatus.message}</span>
              )}
              {errors.subdomain && <span className="error-text">{errors.subdomain}</span>}

              <small className="help-text">
                Deine Mitglieder greifen über diese URL auf das System zu
              </small>
            </div>
          </section>

          {/* Admin Account */}
          <section className="form-section">
            <h3><span className="section-icon">👤</span> Administrator-Zugang</h3>

            <div className="form-group">
              <label>Dein Name *</label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                placeholder="Max Mustermann"
                className={errors.ownerName ? 'error' : ''}
              />
              {errors.ownerName && <span className="error-text">{errors.ownerName}</span>}
            </div>

            <div className="form-group">
              <label>E-Mail-Adresse *</label>
              <input
                type="email"
                value={formData.ownerEmail}
                onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                placeholder="max@budokan-berlin.de"
                className={errors.ownerEmail ? 'error' : ''}
              />
              {errors.ownerEmail && <span className="error-text">{errors.ownerEmail}</span>}
            </div>

            <div className="form-group">
              <label>Telefon (optional)</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+49 30 12345678"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Passwort *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mindestens 8 Zeichen"
                  className={errors.password ? 'error' : ''}
                />
                {errors.password && <span className="error-text">{errors.password}</span>}
              </div>

              <div className="form-group">
                <label>Passwort bestätigen *</label>
                <input
                  type="password"
                  value={formData.passwordConfirm}
                  onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                  placeholder="Passwort wiederholen"
                  className={errors.passwordConfirm ? 'error' : ''}
                />
                {errors.passwordConfirm && <span className="error-text">{errors.passwordConfirm}</span>}
              </div>
            </div>
          </section>

          {/* Terms */}
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
              />
              <span>
                Ich akzeptiere die <a href="/agb" target="_blank">AGB</a> und{' '}
                <a href="/datenschutz" target="_blank">Datenschutzerklärung</a>
              </span>
            </label>
            {errors.acceptTerms && <span className="error-text">{errors.acceptTerms}</span>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="submit-btn"
            disabled={loading || !subdomainStatus.available}
          >
            {loading ? 'Wird registriert...' : 'Dojo jetzt registrieren - 14 Tage gratis'}
          </button>

          <div className="security-notes">
            <div className="note"><span className="note-icon">🔒</span> Keine Kreditkarte erforderlich</div>
            <div className="note"><span className="note-icon">⏱️</span> Trial endet automatisch nach 14 Tagen</div>
            <div className="note"><span className="note-icon">🇩🇪</span> Daten auf deutschen Servern (DSGVO-konform)</div>
          </div>
        </form>

        {/* Footer */}
        <div className="register-footer">
          <p>Du hast bereits ein Dojo? <a href="/login">Hier anmelden</a></p>
        </div>
      </div>

      {/* Public Footer */}
      <PublicFooter />
    </div>
  );
}

export default RegisterPage;
