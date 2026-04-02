import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const ROLLEN = [
  { key: 'admin',      label: '👨‍💼 Admin' },
  { key: 'supervisor', label: '👔 Supervisor' },
  { key: 'trainer',    label: '🥋 Trainer' },
  { key: 'verkauf',    label: '💰 Verkauf' },
];

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.82)',
    zIndex: 99999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
  },
  box: {
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    width: '100%', maxWidth: '440px',
    color: '#fff',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  title: { margin: 0, fontSize: '1.1rem', fontWeight: 700 },
  close: {
    background: 'none', border: 'none', color: '#aaa',
    fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, padding: '0 4px',
  },
  body: { padding: '1.25rem' },
  group: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.82rem', color: '#aaa', marginBottom: '0.35rem' },
  input: {
    width: '100%', padding: '0.55rem 0.75rem',
    background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px', color: '#fff', fontSize: '0.95rem',
    boxSizing: 'border-box', outline: 'none',
  },
  error: {
    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: '6px', padding: '0.6rem 0.75rem',
    color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1rem',
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
    padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  btnCancel: {
    padding: '0.5rem 1.1rem', borderRadius: '6px', cursor: 'pointer',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
    color: '#ccc', fontSize: '0.9rem',
  },
  btnCreate: {
    padding: '0.5rem 1.2rem', borderRadius: '6px', cursor: 'pointer',
    background: '#6366f1', border: 'none',
    color: '#fff', fontSize: '0.9rem', fontWeight: 600,
  },
};

export default function CreateUserModal({ rolle, onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', role: rolle || 'trainer' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleCreate = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Bitte alle Felder ausfüllen.');
      return;
    }
    if (form.password.length < 12) {
      setError('Passwort muss mindestens 12 Zeichen lang sein.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fehler beim Erstellen'); return; }
      onCreated(data);
    } catch (err) {
      setError(err.message || 'Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div style={s.overlay} onClick={onClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.title}>Neuen Benutzer erstellen</h2>
          <button style={s.close} onClick={onClose}>×</button>
        </div>
        <div style={s.body}>
          {error && <div style={s.error}>{error}</div>}
          <div style={s.group}>
            <label style={s.label}>Benutzername</label>
            <input style={s.input} type="text" value={form.username} onChange={set('username')} placeholder="benutzername" autoComplete="off" />
          </div>
          <div style={s.group}>
            <label style={s.label}>E-Mail</label>
            <input style={s.input} type="email" value={form.email} onChange={set('email')} placeholder="email@dojo.de" autoComplete="off" />
          </div>
          <div style={s.group}>
            <label style={s.label}>Passwort</label>
            <input style={s.input} type="password" value={form.password} onChange={set('password')} placeholder="Mindestens 12 Zeichen" autoComplete="new-password" />
          </div>
          <div style={s.group}>
            <label style={s.label}>Rolle</label>
            <select style={s.input} value={form.role} onChange={set('role')}>
              {ROLLEN.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            💬 Msg-App Zugang wird automatisch aktiviert. Rolle bestimmt die Rechte.
          </div>
        </div>
        <div style={s.footer}>
          <button style={s.btnCancel} onClick={onClose}>Abbrechen</button>
          <button style={s.btnCreate} onClick={handleCreate} disabled={saving}>
            {saving ? 'Erstellen…' : 'Benutzer erstellen'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
