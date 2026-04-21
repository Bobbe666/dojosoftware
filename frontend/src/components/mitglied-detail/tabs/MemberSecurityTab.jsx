import React, { useState } from 'react';
import axios from 'axios';
import '../../../styles/MemberSecurityTab.css';

const SECURITY_QUESTIONS = [
  { value: 'Wie lautet der Mädchen- oder Jungenname Ihrer Mutter?', label: 'Wie lautet der Mädchen- oder Jungenname Ihrer Mutter?' },
  { value: 'Wie heißt Ihr erstes Haustier?', label: 'Wie heißt Ihr erstes Haustier?' },
  { value: 'In welcher Stadt wurden Sie geboren?', label: 'In welcher Stadt wurden Sie geboren?' },
  { value: 'Wie lautet der Name Ihrer Grundschule?', label: 'Wie lautet der Name Ihrer Grundschule?' },
  { value: 'Wie lautet der zweite Vorname Ihres Vaters?', label: 'Wie lautet der zweite Vorname Ihres Vaters?' }
];

const passwordMeetsPolicy = (pwd) => {
  const hasDigit = /\d/.test(pwd);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_+\-=/\\\[\];'`~]/.test(pwd);
  return pwd && pwd.length >= 8 && hasDigit && hasSpecial;
};

const MemberSecurityTab = ({ CustomSelect, onError }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0].value);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleChangePassword = async () => {
    setMessage(null);
    if (!passwordMeetsPolicy(newPassword)) {
      setMessage({ type: 'error', text: 'Neues Passwort entspricht nicht der Richtlinie.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Die Passwörter stimmen nicht überein.' });
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post('/auth/change-password', { currentPassword, newPassword });
      setMessage({ type: 'success', text: res.data?.message || 'Passwort geändert.' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) {
      const errorMsg = e.response?.data?.message || 'Änderung fehlgeschlagen.';
      setMessage({ type: 'error', text: errorMsg });
      onError?.(errorMsg);
    } finally { setLoading(false); }
  };

  const handleSaveSecurity = async () => {
    setMessage(null);
    if (!securityAnswer.trim()) {
      setMessage({ type: 'error', text: 'Bitte eine Antwort auf die Sicherheitsfrage angeben.' });
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post('/auth/security', { securityQuestion, securityAnswer });
      setMessage({ type: 'success', text: res.data?.message || 'Sicherheitsfrage gespeichert.' });
    } catch (e) {
      const errorMsg = e.response?.data?.message || 'Speichern fehlgeschlagen.';
      setMessage({ type: 'error', text: errorMsg });
      onError?.(errorMsg);
    } finally { setLoading(false); }
  };

  const SelectComponent = CustomSelect || (({ value, onChange, options }) => (
    <select value={value} onChange={onChange} style={{ width: '100%', padding: '0.55rem 0.875rem', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.9rem' }}>
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  ));

  return (
    <div className="grid-container">
      <div className="field-group card mst-card">
        <h3>Passwort &amp; Sicherheitsfrage</h3>

        {/* Passwort-Bereich */}
        <div className="mst-form-grid">
          <div className="mst-field-group">
            <label>Aktuelles Passwort</label>
            <div className="mst-password-wrapper">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Aktuelles Passwort"
                disabled={loading}
              />
              <button type="button" className="password-toggle-btn"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                {showCurrentPassword ? '👁️' : '•••••••'}
              </button>
            </div>
          </div>

          <div className="mst-field-group">
            <label>Neues Passwort</label>
            <div className="mst-password-wrapper">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={!currentPassword ? 'Zuerst aktuelles Passwort eingeben' : 'Min. 8 Zeichen, 1 Zahl, 1 Sonderzeichen'}
                disabled={!currentPassword || loading}
              />
              <button type="button" className="password-toggle-btn"
                onClick={() => setShowNewPassword(!showNewPassword)}>
                {showNewPassword ? '👁️' : '•••••••'}
              </button>
            </div>
            {!currentPassword && (
              <small className="input-hint mitglied-detail-hint-warning">
                ℹ️ Zuerst aktuelles Passwort eingeben
              </small>
            )}
          </div>

          <div className="mst-field-group">
            <label>Passwort bestätigen</label>
            <div className="mst-password-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort wiederholen"
                disabled={!currentPassword || loading}
              />
              <button type="button" className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? '👁️' : '•••••••'}
              </button>
            </div>
          </div>

          <div className="mst-field-group mst-btn-align">
            <label style={{ visibility: 'hidden', userSelect: 'none' }}>—</label>
            <button
              className="mst-btn mst-btn-primary"
              onClick={handleChangePassword}
              disabled={!currentPassword || !newPassword || !confirmPassword || loading}
            >
              {loading ? '⏳' : '🔒'} Passwort ändern
            </button>
          </div>
        </div>

        <hr className="mst-divider" />

        {/* Sicherheitsfrage */}
        <div className="mst-form-grid">
          <div className="mst-field-group mst-field-full">
            <label>Sicherheitsfrage</label>
            <SelectComponent
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
              options={SECURITY_QUESTIONS}
            />
          </div>

          <div className="mst-field-group">
            <label>Antwort</label>
            <input
              type="text"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              placeholder="Antwort eingeben"
              disabled={loading}
            />
          </div>

          <div className="mst-field-group mst-btn-align">
            <label style={{ visibility: 'hidden', userSelect: 'none' }}>—</label>
            <button
              className="mst-btn mst-btn-secondary"
              onClick={handleSaveSecurity}
              disabled={loading}
            >
              {loading ? '⏳' : '💾'} Sicherheitsfrage speichern
            </button>
          </div>
        </div>

        {message && (
          <div className={`mst-message ${message.type}`}>
            <span className="mst-message-icon">{message.type === 'error' ? '❌' : '✅'}</span>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberSecurityTab;
