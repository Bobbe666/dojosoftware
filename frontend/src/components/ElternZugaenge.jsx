// ============================================================================
// ELTERN-ZUGÄNGE — Admin-Verwaltung für Eltern-Zugang
// Route: /dashboard/eltern-zugaenge
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/Buttons.css';
import '../styles/Dashboard.css';

const ElternZugaenge = () => {
  const { activeDojo } = useDojoContext();
  const [zugaenge, setZugaenge] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ eltern_email: '', eltern_name: '', mitglied_id: '' });
  const [copiedId, setCopiedId] = useState(null);

  const withDojo = (url) =>
    activeDojo?.id ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}` : url;

  useEffect(() => {
    ladeDaten();
    ladeMitglieder();
  }, [activeDojo]);

  const ladeDaten = async () => {
    setLoading(true);
    try {
      const res = await axios.get(withDojo('/eltern-zugang'));
      setZugaenge(res.data.zugaenge || []);
    } catch (err) {
      setError('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const ladeMitglieder = async () => {
    try {
      const res = await axios.get(withDojo('/mitglieder?limit=500'));
      setMitglieder(res.data.mitglieder || res.data || []);
    } catch {}
  };

  const erstellen = async (e) => {
    e.preventDefault();
    if (!form.eltern_email || !form.mitglied_id) {
      setError('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    try {
      const res = await axios.post(withDojo('/eltern-zugang'), form);
      setSuccess(`Zugang erstellt! Token: ${res.data.token}`);
      setForm({ eltern_email: '', eltern_name: '', mitglied_id: '' });
      setShowForm(false);
      ladeDaten();
      setTimeout(() => setSuccess(''), 8000);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Erstellen');
      setTimeout(() => setError(''), 4000);
    }
  };

  const loeschen = async (id) => {
    if (!window.confirm('Zugang wirklich löschen?')) return;
    try {
      await axios.delete(withDojo(`/eltern-zugang/${id}`));
      ladeDaten();
      setSuccess('Zugang gelöscht');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Fehler beim Löschen');
      setTimeout(() => setError(''), 3000);
    }
  };

  const resetToken = async (id) => {
    try {
      const res = await axios.post(withDojo(`/eltern-zugang/${id}/reset-token`));
      setSuccess(`Neuer Token: ${res.data.token}`);
      ladeDaten();
      setTimeout(() => setSuccess(''), 8000);
    } catch {
      setError('Fehler beim Erneuern');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getPortalLink = (token) =>
    `${window.location.origin}/eltern-portal?token=${token}`;

  const copyLink = (token, id) => {
    navigator.clipboard.writeText(getPortalLink(token));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  return (
    <div className="content-card">
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
            👨‍👩‍👧 Eltern-Zugänge
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Eltern-Zugangslinks für Kinder-Mitglieder verwalten
          </p>
        </div>
        <button className="btn btn-success" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Schließen' : '+ Neuer Zugang'}
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

      {/* Formular */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Neuen Eltern-Zugang erstellen</h3>
          <form onSubmit={erstellen}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label">E-Mail der Eltern *</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.eltern_email}
                  onChange={e => setForm({ ...form, eltern_email: e.target.value })}
                  placeholder="eltern@example.com"
                  required
                />
              </div>
              <div>
                <label className="form-label">Name der Eltern</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.eltern_name}
                  onChange={e => setForm({ ...form, eltern_name: e.target.value })}
                  placeholder="Familie Mustermann"
                />
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Kind (Mitglied) *</label>
              <select
                className="form-input"
                value={form.mitglied_id}
                onChange={e => setForm({ ...form, mitglied_id: e.target.value })}
                required
              >
                <option value="">— Mitglied auswählen —</option>
                {mitglieder.map(m => (
                  <option key={m.mitglied_id} value={m.mitglied_id}>
                    {m.vorname} {m.nachname}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-success">✓ Erstellen</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner" />
          <p>Lade Zugänge...</p>
        </div>
      ) : zugaenge.length === 0 ? (
        <div className="empty-state">
          <p>Noch keine Eltern-Zugänge erstellt.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Eltern</th>
                <th>E-Mail</th>
                <th>Erstellt</th>
                <th>Letzter Zugriff</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {zugaenge.map(z => (
                <tr key={z.id}>
                  <td>
                    <strong>{z.vorname} {z.nachname}</strong>
                  </td>
                  <td>{z.eltern_name || '—'}</td>
                  <td>{z.eltern_email}</td>
                  <td>{formatDate(z.erstellt_am)}</td>
                  <td>{formatDate(z.letzter_login)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        onClick={() => copyLink(z.token, z.id)}
                        title="Portal-Link kopieren"
                      >
                        {copiedId === z.id ? '✓ Kopiert' : '🔗 Link kopieren'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        onClick={() => resetToken(z.id)}
                        title="Token erneuern (invalidiert alten Link)"
                      >
                        🔄 Token neu
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        onClick={() => loeschen(z.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ElternZugaenge;
