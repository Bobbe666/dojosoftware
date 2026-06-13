import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft, HelpCircle, User } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import '../styles/Buttons.css';

// Muss zur Liste in MemberSecurityTab.jsx passen
const SECURITY_QUESTIONS = [
  'Wie lautet der Mädchen- oder Jungenname Ihrer Mutter?',
  'Wie heißt Ihr erstes Haustier?',
  'In welcher Stadt wurden Sie geboren?',
  'Wie lautet der Name Ihrer Grundschule?',
  'Wie lautet der zweite Vorname Ihres Vaters?',
];

const PasswordReset = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Methode: per E-Mail-Link ODER per Sicherheitsfrage (E-Mail-unabhängig)
  const [method, setMethod] = useState('email');

  // Schritt 1: E-Mail eingeben
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  // Sicherheitsfrage-Variante
  const [loginField, setLoginField] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');

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

  // Sicherheitsfrage-Reset (ohne E-Mail)
  const handleSecurityReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!loginField.trim()) return setError('Bitte E-Mail oder Benutzername eingeben.');
    if (!securityAnswer.trim()) return setError('Bitte die Antwort eingeben.');
    if (!passwordIsValid(newPassword))
      return setError('Passwort muss mind. 8 Zeichen, 1 Zahl und 1 Sonderzeichen enthalten.');
    if (newPassword !== confirmPassword)
      return setError('Passwörter stimmen nicht überein.');
    setLoading(true);
    try {
      await axios.post('/auth/reset-password', {
        loginField: loginField.trim(),
        securityQuestion,
        securityAnswer: securityAnswer.trim(),
        newPassword,
      });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Angaben ungültig. Bitte prüfe Login, Frage und Antwort.');
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

        {/* ── Methoden-Umschalter ── */}
        {!hasToken && !sent && !done && (
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem' }}>
            <button type="button" onClick={() => { setMethod('email'); setError(''); }}
              className="btn" style={{ flex: 1, padding: '0.6rem', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.12)', background: method === 'email' ? '#f97316' : 'rgba(255,255,255,0.06)', color: method === 'email' ? '#fff' : '#94a3b8' }}>
              <Mail size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />Per E-Mail
            </button>
            <button type="button" onClick={() => { setMethod('security'); setError(''); }}
              className="btn" style={{ flex: 1, padding: '0.6rem', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.12)', background: method === 'security' ? '#f97316' : 'rgba(255,255,255,0.06)', color: method === 'security' ? '#fff' : '#94a3b8' }}>
              <HelpCircle size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />Sicherheitsfrage
            </button>
          </div>
        )}

        {/* ── Schritt 1: E-Mail ── */}
        {!hasToken && !sent && method === 'email' && (
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

        {/* ── Schritt 1 (Variante): Sicherheitsfrage ── */}
        {!hasToken && !sent && !done && method === 'security' && (
          <form onSubmit={handleSecurityReset} className="login-form">
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Setze dein Passwort über deine Sicherheitsfrage zurück — ohne E-Mail.
            </p>
            <div className="form-group">
              <label className="form-label"><div className="label-content"><User size={16} className="label-icon" /><span>E-Mail oder Benutzername</span></div></label>
              <input type="text" value={loginField} onChange={e => { setLoginField(e.target.value); setError(''); }}
                className="form-input" placeholder="E-Mail oder Benutzername" required disabled={loading} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label"><div className="label-content"><HelpCircle size={16} className="label-icon" /><span>Sicherheitsfrage</span></div></label>
              <select value={securityQuestion} onChange={e => { setSecurityQuestion(e.target.value); setError(''); }}
                className="form-input" disabled={loading}>
                {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label"><div className="label-content"><Lock size={16} className="label-icon" /><span>Deine Antwort</span></div></label>
              <input type="text" value={securityAnswer} onChange={e => { setSecurityAnswer(e.target.value); setError(''); }}
                className="form-input" placeholder="Antwort" required disabled={loading} autoComplete="off" />
            </div>
            <div className="form-group">
              <label className="form-label"><div className="label-content"><Lock size={16} className="label-icon" /><span>Neues Passwort</span></div></label>
              <div className="password-wrapper">
                <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => { setNewPassword(e.target.value); setError(''); }}
                  className="form-input password-input" placeholder="Neues Passwort" required disabled={loading} />
                <button type="button" className="password-toggle" onClick={() => setShowNew(!showNew)} disabled={loading}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <small className="input-hint">Mind. 8 Zeichen, 1 Zahl, 1 Sonderzeichen.</small>
            </div>
            <div className="form-group">
              <label className="form-label"><div className="label-content"><Lock size={16} className="label-icon" /><span>Passwort bestätigen</span></div></label>
              <div className="password-wrapper">
                <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                  className="form-input password-input" placeholder="Passwort bestätigen" required disabled={loading} />
                <button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)} disabled={loading}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (<div className="error-message" role="alert"><AlertCircle size={16} /><span>{error}</span></div>)}
            <button type="submit" className="login-button btn btn-primary" disabled={loading}>
              {loading ? 'Speichert…' : 'Passwort zurücksetzen'}
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
