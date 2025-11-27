import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, HelpCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Buttons.css';

const COMMON_QUESTIONS = [
  'Wie lautet der Mädchen- oder Jungenname Ihrer Mutter?',
  'Wie heißt Ihr erstes Haustier?',
  'In welcher Stadt wurden Sie geboren?',
  'Wie lautet der Name Ihrer Grundschule?',
  'Wie lautet der zweite Vorname Ihres Vaters?'
];

const PasswordReset = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    loginField: '',
    securityQuestion: COMMON_QUESTIONS[0],
    securityAnswer: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const passwordIsValid = (pwd) => {
    // mindestens eine Zahl und ein Sonderzeichen
    const hasDigit = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>_+\-=/\\\[\];'`~]/.test(pwd);
    return hasDigit && hasSpecial && pwd.length >= 8;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.loginField.trim()) {
      setError('Bitte E-Mail oder Benutzername eingeben.');
      return;
    }
    if (!passwordIsValid(form.newPassword)) {
      setError('Neues Passwort muss mind. 8 Zeichen, 1 Zahl und 1 Sonderzeichen enthalten.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    if (!form.securityAnswer.trim()) {
      setError('Bitte die Antwort auf die Sicherheitsfrage eingeben.');
      return;
    }

    try {
      setLoading(true);
      await axios.post('/auth/reset-password', {
        loginField: form.loginField.trim(),
        securityQuestion: form.securityQuestion,
        securityAnswer: form.securityAnswer.trim(),
        newPassword: form.newPassword
      });
      setSuccess('Passwort erfolgreich zurückgesetzt. Sie können sich nun anmelden.');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const msg = err.response?.data?.message || 'Zurücksetzen fehlgeschlagen.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <HelpCircle size={18} />
            <h1 className="title">Passwort zurücksetzen</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">
              <div className="label-content">
                <Mail size={16} className="label-icon" />
                <span>E-Mail oder Benutzername</span>
              </div>
            </label>
            <input
              type="text"
              name="loginField"
              value={form.loginField}
              onChange={handleChange}
              className="form-input"
              placeholder="z.B. admin@dojo.local oder superadmin"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <div className="label-content">
                <HelpCircle size={16} className="label-icon" />
                <span>Sicherheitsfrage</span>
              </div>
            </label>
            <select
              name="securityQuestion"
              value={form.securityQuestion}
              onChange={handleChange}
              className="form-input"
              disabled={loading}
            >
              {COMMON_QUESTIONS.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              <div className="label-content">
                <HelpCircle size={16} className="label-icon" />
                <span>Antwort auf Sicherheitsfrage</span>
              </div>
            </label>
            <input
              type="text"
              name="securityAnswer"
              value={form.securityAnswer}
              onChange={handleChange}
              className="form-input"
              placeholder="Antwort"
              required
              disabled={loading}
            />
          </div>

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
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                className="form-input password-input"
                placeholder="Neues Passwort"
                required
                disabled={loading}
              />
              <button type="button" className="password-toggle" onClick={() => setShowNew(!showNew)} disabled={loading}>
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <small className="input-hint">Mind. 8 Zeichen, mindestens 1 Zahl und 1 Sonderzeichen.</small>
          </div>

          <div className="form-group">
            <label className="form-label">
              <div className="label-content">
                <Lock size={16} className="label-icon" />
                <span>Neues Passwort bestätigen</span>
              </div>
            </label>
            <div className="password-wrapper">
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
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
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="success-message" role="alert">
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}

          <button type="submit" className={`login-button btn btn-primary ${loading ? 'loading' : ''}`} disabled={loading}>
            {loading ? 'Zurücksetzen…' : 'Passwort zurücksetzen'}
          </button>

          <button type="button" className="link-button btn btn-link" onClick={() => navigate('/login')} disabled={loading} style={{ marginTop: '0.75rem' }}>
            Zurück zum Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordReset;


