import React, { useState } from 'react';
import axios from 'axios';

// Security Questions (könnte auch aus Config kommen)
const SECURITY_QUESTIONS = [
  { value: 'Wie lautet der Mädchen- oder Jungenname Ihrer Mutter?', label: 'Wie lautet der Mädchen- oder Jungenname Ihrer Mutter?' },
  { value: 'Wie heißt Ihr erstes Haustier?', label: 'Wie heißt Ihr erstes Haustier?' },
  { value: 'In welcher Stadt wurden Sie geboren?', label: 'In welcher Stadt wurden Sie geboren?' },
  { value: 'Wie lautet der Name Ihrer Grundschule?', label: 'Wie lautet der Name Ihrer Grundschule?' },
  { value: 'Wie lautet der zweite Vorname Ihres Vaters?', label: 'Wie lautet der zweite Vorname Ihres Vaters?' }
];

/**
 * Prüft, ob ein Passwort die Sicherheitsrichtlinien erfüllt
 * - Mindestens 8 Zeichen
 * - Mindestens 1 Ziffer
 * - Mindestens 1 Sonderzeichen
 */
const passwordMeetsPolicy = (pwd) => {
  const hasDigit = /\d/.test(pwd);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_+\-=/\\\[\];'`~]/.test(pwd);
  return pwd && pwd.length >= 8 && hasDigit && hasSpecial;
};

/**
 * MemberSecurityTab - Passwort und Sicherheitsfrage verwalten
 *
 * Diese Komponente wird sowohl von Admin als auch Member genutzt.
 * Der isAdmin-Prop wird hier nicht benötigt, da beide dieselbe
 * Funktionalität haben (eigenes Passwort ändern).
 *
 * Props:
 * - CustomSelect: Die CustomSelect-Komponente aus dem Parent
 * - onError: Optional - Callback für Fehlerbehandlung
 */
const MemberSecurityTab = ({ CustomSelect, onError }) => {
  // Passwort-State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sicherheitsfrage-State
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0].value);
  const [securityAnswer, setSecurityAnswer] = useState('');

  // UI-State
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  /**
   * Passwort ändern
   */
  const handleChangePassword = async () => {
    setMessage(null);

    // Validierung
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
      // Felder zurücksetzen
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      const errorMsg = e.response?.data?.message || 'Änderung fehlgeschlagen.';
      setMessage({ type: 'error', text: errorMsg });
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sicherheitsfrage speichern
   */
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
    } finally {
      setLoading(false);
    }
  };

  // Select-Komponente (Fallback auf natives select wenn CustomSelect nicht verfügbar)
  const SelectComponent = CustomSelect || (({ value, onChange, options }) => (
    <select
      className="mitglied-detail-input"
      value={value}
      onChange={onChange}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  ));

  return (
    <div className="grid-container">
      <div className="field-group card mitglied-detail-card" style={{
        borderRadius: '16px',
        padding: '2rem'
      }}>
        <h3>Passwort & Sicherheitsfrage</h3>

        {/* Aktuelles Passwort */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label>Aktuelles Passwort:</label>
          <div className="password-wrapper" style={{ position: 'relative' }}>
            <input
              className="mitglied-detail-input"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Aktuelles Passwort"
              disabled={loading}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              {showCurrentPassword ? '👁️' : '•••••••'}
            </button>
          </div>
        </div>

        {/* Neues Passwort */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label>Neues Passwort:</label>
          <div className="password-wrapper" style={{ position: 'relative' }}>
            <input
              className={`mitglied-detail-input ${!currentPassword ? 'disabled' : ''}`}
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Neues Passwort"
              disabled={!currentPassword || loading}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? '👁️' : '•••••••'}
            </button>
          </div>
          {!currentPassword && (
            <small className="input-hint mitglied-detail-hint-warning">
              ℹ️ Bitte zuerst das aktuelle Passwort eingeben
            </small>
          )}
          {currentPassword && (
            <small className="input-hint">Mind. 8 Zeichen, mindestens 1 Zahl und 1 Sonderzeichen.</small>
          )}
        </div>

        {/* Neues Passwort bestätigen */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label>Neues Passwort bestätigen:</label>
          <div className="password-wrapper" style={{ position: 'relative' }}>
            <input
              className={`mitglied-detail-input ${!currentPassword ? 'disabled' : ''}`}
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort bestätigen"
              disabled={!currentPassword || loading}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? '👁️' : '•••••••'}
            </button>
          </div>
        </div>

        {/* Sicherheitsfrage */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label>Sicherheitsfrage:</label>
          <SelectComponent
            value={securityQuestion}
            onChange={(e) => setSecurityQuestion(e.target.value)}
            options={SECURITY_QUESTIONS}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label>Antwort auf Sicherheitsfrage:</label>
          <input
            className="mitglied-detail-input"
            type="text"
            value={securityAnswer}
            onChange={(e) => setSecurityAnswer(e.target.value)}
            placeholder="Antwort"
            disabled={loading}
          />
        </div>

        {/* ACTION BUTTONS */}
        <div className="mitglied-detail-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button
            className={`mitglied-detail-btn mitglied-detail-btn-primary ${(!currentPassword || !newPassword || !confirmPassword || loading) ? 'disabled' : ''}`}
            onClick={handleChangePassword}
            disabled={!currentPassword || !newPassword || !confirmPassword || loading}
          >
            {loading ? '⏳' : '🔒'} Passwort Ändern
          </button>

          <button
            className={`mitglied-detail-btn mitglied-detail-btn-secondary ${loading ? 'disabled' : ''}`}
            onClick={handleSaveSecurity}
            disabled={loading}
          >
            👁️ Sicherheitsfrage speichern
          </button>
        </div>

        {/* SUCCESS/ERROR MESSAGES */}
        {message && (
          <div className={`mitglied-detail-message ${message.type === 'error' ? 'error' : 'success'}`} style={{
            marginTop: '1.25rem',
            padding: '1rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.95rem'
          }}>
            <span style={{ fontSize: '1.2rem' }}>
              {message.type === 'error' ? '❌' : '✅'}
            </span>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberSecurityTab;
