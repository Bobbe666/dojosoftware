import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/Login.css';

function ClubLogin({ onLogin }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', passwort: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [turniere, setTurniere] = useState([]);
  const [turniereLoading, setTurniereLoading] = useState(true);
  const [selectedTurnier, setSelectedTurnier] = useState(null);

  useEffect(() => {
    fetchTurniere();
  }, []);

  const fetchTurniere = async () => {
    try {
      const response = await fetch('/api/turniere/public');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setTurniere(Array.isArray(result.data) ? result.data : []);
        } else if (Array.isArray(result)) {
          setTurniere(result);
        }
      }
      setTurniereLoading(false);
    } catch (err) {
      console.error("Fehler beim Abrufen der Turniere:", err);
      setTurniereLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      console.log("🏢 Login für:", formData.email);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      console.log("📡 Login Response:", data);

      if (response.ok && data.success) {
        const userData = {
          success: true,
          token: data.token,
          refreshToken: data.refreshToken || null,
          user: {
            vereins_id: data.user?.vereins_id || data.id,
            name: data.user?.name || data.name,
            email: data.user?.email || formData.email,
            benutzername: data.user?.benutzername || data.benutzername,
            role: data.user?.role || 'verein',
            ort: data.user?.ort || data.ort,
            ansprechpartner: data.user?.ansprechpartner || data.ansprechpartner
          }
        };

        localStorage.setItem('token', data.token);
        localStorage.setItem('authToken', data.token);

        // Admin geht direkt zum Dashboard
        if (userData.user.role === 'admin') {
          localStorage.setItem('adminData', JSON.stringify(userData));
          localStorage.removeItem('clubData');
          localStorage.removeItem('clubId');
          console.log("✅ Admin-Login erfolgreich!");

          if (onLogin) {
            onLogin(userData);
          } else {
            navigate('/dashboard');
          }
        } else {
          // Verein/User
          localStorage.setItem('clubData', JSON.stringify(userData));
          localStorage.setItem('clubId', userData.user.vereins_id.toString());
          localStorage.removeItem('adminData');
          console.log("✅ Vereins-Login erfolgreich!");

          // Wenn Turnier ausgewählt wurde, zur Registration
          if (selectedTurnier) {
            navigate(`/registration?turnierId=${selectedTurnier.id}`);
          } else {
            setMessage('Bitte wählen Sie zuerst ein Turnier aus.');
          }
        }
      } else {
        setMessage(data.error || data.message || 'Login fehlgeschlagen.');
        console.error("❌ Login fehlgeschlagen:", data);
      }
    } catch (error) {
      setMessage(error.message);
      console.error("❌ Login-Fehler:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTurnierSelect = (turnier) => {
    setSelectedTurnier(turnier);
    setMessage('');
  };

  return (
    <div className="login-page-new">
      {/* Navigation */}
      <nav className="login-nav">
        <div className="login-nav-content">
          <div className="nav-logo">
            <img src="/logo.png" alt="TDA" />
            <span>TDA Tournament Center</span>
          </div>
          <div className="nav-links">
            <a href="https://events.tda-intl.org">Home</a>
            <a href="https://tda-intl.org">TDA Systems</a>
            <a href="https://tda-intl.org/kontakt">Kontakt</a>
          </div>
        </div>
      </nav>

      {/* Main Content - Zwei Spalten */}
      <div className="login-main">
        <div className="login-container-new">
          {/* Linke Spalte - Turnierübersicht */}
          <div className="tournaments-section-login">
            <div className="section-header">
              <h1>Kommende Turniere</h1>
              <p>Wählen Sie ein Turnier aus und melden Sie sich an</p>
            </div>

            {turniereLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Lade Turniere...</p>
              </div>
            ) : turniere.length === 0 ? (
              <div className="empty-state">
                <p>Aktuell sind keine Turniere verfügbar.</p>
              </div>
            ) : (
              <div className="tournaments-grid-login">
                {turniere.map(turnier => (
                  <div
                    key={turnier.id}
                    className={`tournament-card-login ${selectedTurnier?.id === turnier.id ? 'selected' : ''}`}
                    onClick={() => handleTurnierSelect(turnier)}
                  >
                    <div className="tournament-header">
                      <h3>{turnier.name}</h3>
                      {selectedTurnier?.id === turnier.id && (
                        <span className="selected-badge">Ausgewählt</span>
                      )}
                    </div>
                    <div className="tournament-details">
                      <div className="detail-item">
                        <span className="detail-icon">📅</span>
                        <span>{new Date(turnier.datum).toLocaleDateString('de-DE', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-icon">📍</span>
                        <span>{turnier.ort || 'Ort wird bekannt gegeben'}</span>
                      </div>
                      {turnier.anmeldeschluss && (
                        <div className="detail-item">
                          <span className="detail-icon">⏰</span>
                          <span>Anmeldeschluss: {new Date(turnier.anmeldeschluss).toLocaleDateString('de-DE')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rechte Spalte - Login */}
          <div className="login-section-new">
            <div className="login-box-styled">
              <div className="login-header">
                <div className="login-logo-small">
                  <img src="/logo.png" alt="Tournament Software" />
                </div>
                <h2>Login</h2>
                <p>Willkommen zurück</p>
              </div>

              {selectedTurnier && (
                <div className="selected-tournament-info">
                  <span className="info-label">Ausgewähltes Turnier:</span>
                  <span className="info-value">{selectedTurnier.name}</span>
                </div>
              )}

              {message && (
                <div className={`login-message ${message.includes('erfolgreich') ? 'success' : message.includes('wählen') ? 'info' : 'error'}`}>
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="login-form">
                <div className="input-group">
                  <label>Email oder Benutzername</label>
                  <input
                    type="text"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="ihre@email.de"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="input-group">
                  <label>Passwort</label>
                  <input
                    type="password"
                    name="passwort"
                    value={formData.passwort}
                    onChange={handleChange}
                    placeholder="Ihr Passwort"
                    required
                    disabled={loading}
                  />
                </div>

                <button type="submit" className="login-button" disabled={loading}>
                  {loading && <span className="login-spinner"></span>}
                  {loading ? 'Anmeldung läuft...' : 'Einloggen'}
                </button>
              </form>

              <div className="login-footer">
                <p>Noch kein Konto?</p>
                <button onClick={() => navigate('/register')} className="register-link">
                  Verein registrieren
                </button>
              </div>

              <div className="login-help">
                <p><strong>Hinweis:</strong></p>
                <p>• Als <strong>Verein</strong>: Wählen Sie ein Turnier aus und melden Sie sich an.</p>
                <p>• Als <strong>Administrator</strong>: Direkter Zugang zum Dashboard.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClubLogin;
