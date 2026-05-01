import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import '../styles/Buttons.css';

const PasswordReset = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Schritt 1: E-Mail eingeben
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  // Schritt 2: Neues Passwort via Token
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordIsValid = (pwd) =>
    /\d/.test(pwd) && /[!@#$%^&*(),.?":{}|<>_+\-=/\\\[\];'`~]/.test(pwd) && pwd.length >= 8;

  // Schritt 1: E-Mail abschicken
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) return setError('Bitte E-Mail eingeben.');
    setLoading(true);
    try {
      await axios.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch {
      setError('Fehler beim Senden. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  // Schritt 2: Neues Passwort setzen
  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!passwordIsValid(newPassword))
      return setError('Passwort muss mind. 8 Zeichen, 1 Zahl und 1 Sonderzeichen enthalten.');
    if (newPassword !== confirmPassword)
      return setError('Passwörter stimmen nicht überein.');
    setLoading(true);
    try {
      await axios.post('/auth/reset-password-token', { token, newPassword });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Link ungültig oder abgelaufen.');
    } finally {
      setLoading(false);
    }
  };

  // Token im Link → direkt zu Schritt 2
  const hasToken = !!token;

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <Lock size={18} />
            <h1 className="title">Passwort zurücksetzen</h1>
          </div>
        </div>

        {/* ── Schritt 1: E-Mail ── */}
        {!hasToken && !sent && (
          <form onSubmit={handleRequestReset} className="login-form">
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link zum Zurücksetzen.
            </p>
            <div className="form-group">
              <label className="form-label">
                <div className="label-content">
                  <Mail size={16} className="label-icon" />
                  <span>E-Mail-Adresse</span>
                </div>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                className="form-input"
                placeholder="deine@email.de"
                required
                disabled={loading}
                autoFocus
              />
            </div>
            {error && (
              <div className="error-message" role="alert">
                <AlertCircle size={16} /><span>{error}</span>
              </div>
            )}
            <button type="submit" className="login-button btn btn-primary" disabled={loading}>
              {loading ? 'Sende…' : 'Reset-Link anfordern'}
            </button>
            <button type="button" className="link-button btn btn-link" onClick={() => navigate('/login')} style={{ marginTop: '0.75rem' }}>
              <ArrowLeft size={14} style={{ marginRight: 4 }} /> Zurück zum Login
            </button>
          </form>
        )}

        {/* ── E-Mail gesendet ── */}
        {!hasToken && sent && (
          <div className="login-form" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📬</div>
            <p style={{ color: '#4ade80', fontWeight: 600, marginBottom: '0.5rem' }}>Link wurde gesendet!</p>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
              Falls ein Konto mit dieser E-Mail existiert, erhältst du in wenigen Minuten einen Reset-Link. Bitte prüfe auch deinen Spam-Ordner.
            </p>
            <button type="button" className="link-button btn btn-link" onClick={() => navigate('/login')}>
              Zum Login
            </button>
          </div>
        )}

        {/* ── Schritt 2: Neues Passwort ── */}
        {hasToken && !done && (
          <form onSubmit={handleSetPassword} className="login-form">
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Gib dein neues Passwort ein.
            </p>
            <div className="form-group">
              <label className="form-label">
                <div className="label-content">
                  <Lock size={16} className="label-icon" />
                  <span>Neues Passwort</span>
                </div>
              </label>
              <div className="password-wrapper">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setError(''); }}
                  className="form-input password-input"
                  placeholder="Neues Passwort"
                  required
                  disabled={loading}
                  autoFocus
                />
                <button type="button" className="password-toggle" onClick={() => setShowNew(!showNew)} disabled={loading}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <small className="input-hint">Mind. 8 Zeichen, 1 Zahl, 1 Sonderzeichen.</small>
            </div>
            <div className="form-group">
              <label className="form-label">
                <div className="label-content">
                  <Lock size={16} className="label-icon" />
                  <span>Passwort bestätigen</span>
                </div>
              </label>
              <div className="password-wrapper">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                  className="form-input password-input"
                  placeholder="Passwort bestätigen"
                  required
                  disabled={loading}
                />
                <button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)} disabled={loading}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (
              <div className="error-message" role="alert">
                <AlertCircle size={16} /><span>{error}</span>
              </div>
            )}
            <button type="submit" className="login-button btn btn-primary" disabled={loading}>
              {loading ? 'Speichert…' : 'Passwort speichern'}
            </button>
          </form>
        )}

        {/* ── Fertig ── */}
        {done && (
          <div className="login-form" style={{ textAlign: 'center' }}>
            <CheckCircle size={48} style={{ color: '#4ade80', margin: '0 auto 1rem' }} />
            <p style={{ color: '#4ade80', fontWeight: 600 }}>Passwort erfolgreich geändert!</p>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Du wirst zum Login weitergeleitet…</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordReset;
