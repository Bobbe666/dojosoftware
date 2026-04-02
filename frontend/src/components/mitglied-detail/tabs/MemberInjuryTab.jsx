import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const SCHWERE_OPTIONS = [
  { value: 'leicht', label: '🟡 Leicht', color: '#eab308' },
  { value: 'mittel', label: '🟠 Mittel', color: '#f97316' },
  { value: 'schwer', label: '🔴 Schwer', color: '#ef4444' },
];

const KOERPERREGIONEN = [
  'Kopf / Gesicht', 'Schulter / Schlüsselbein', 'Arm / Ellbogen',
  'Handgelenk / Hand', 'Finger', 'Rippen / Brustkorb',
  'Rücken / Wirbelsäule', 'Hüfte / Becken', 'Oberschenkel',
  'Knie', 'Schienbein / Wade', 'Sprunggelenk / Fuß', 'Zehen', 'Sonstiges'
];

const EMPTY_FORM = {
  datum: new Date().toISOString().split('T')[0],
  art: '',
  koerperregion: '',
  schwere: 'leicht',
  notizen: '',
  wieder_trainierbar_ab: '',
};

/**
 * MemberInjuryTab — Verletzungsprotokoll eines Mitglieds
 * Props:
 * - mitgliedId: number
 * - isAdmin: boolean
 */
const MemberInjuryTab = ({ mitgliedId, isAdmin }) => {
  const [verletzungen, setVerletzungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const loadVerletzungen = useCallback(async () => {
    if (!mitgliedId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`/verletzungen/${mitgliedId}`);
      setVerletzungen(res.data.verletzungen || []);
    } catch (err) {
      setError('Fehler beim Laden der Verletzungen.');
    } finally {
      setLoading(false);
    }
  }, [mitgliedId]);

  useEffect(() => {
    loadVerletzungen();
  }, [loadVerletzungen]);

  const handleSave = async () => {
    if (!form.art.trim()) {
      setError('Bitte Art der Verletzung angeben.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await axios.post('/verletzungen', { mitglied_id: mitgliedId, ...form });
      setSuccessMsg('Verletzung gespeichert.');
      setShowForm(false);
      setForm(EMPTY_FORM);
      loadVerletzungen();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError('Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkRecovered = async (v) => {
    if (!window.confirm(`Verletzung "${v.art}" als vollständig erholt markieren?`)) return;
    try {
      await axios.put(`/verletzungen/${v.id}`, {
        art: v.art,
        koerperregion: v.koerperregion,
        schwere: v.schwere,
        notizen: v.notizen,
        wieder_trainierbar_ab: v.wieder_trainierbar_ab,
        vollstaendig_erholt: true,
      });
      setSuccessMsg('Als erholt markiert.');
      loadVerletzungen();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('Fehler beim Aktualisieren.');
    }
  };

  const handleDelete = async (v) => {
    if (!window.confirm(`Verletzung "${v.art}" (${formatDate(v.datum)}) löschen?`)) return;
    try {
      await axios.delete(`/verletzungen/${v.id}`);
      setVerletzungen(prev => prev.filter(x => x.id !== v.id));
    } catch {
      setError('Fehler beim Löschen.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  const getSchwereColor = (schwere) =>
    SCHWERE_OPTIONS.find(s => s.value === schwere)?.color || '#666';

  const aktive = verletzungen.filter(v => !v.vollstaendig_erholt);
  const erholt = verletzungen.filter(v => v.vollstaendig_erholt);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

      {/* Header-Leiste */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>
            🩹 Verletzungsprotokoll
          </h3>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            {aktive.length > 0
              ? `${aktive.length} aktive Verletzung${aktive.length !== 1 ? 'en' : ''}`
              : 'Keine aktiven Verletzungen'}
          </p>
        </div>
        {isAdmin && !showForm && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setShowForm(true); setError(null); }}
          >
            + Verletzung erfassen
          </button>
        )}
      </div>

      {/* Meldungen */}
      {error && (
        <div style={{ padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.88rem' }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '0.6rem 1rem', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', color: '#4ade80', fontSize: '0.88rem' }}>
          {successMsg}
        </div>
      )}

      {/* Formular: Neue Verletzung */}
      {showForm && isAdmin && (
        <div style={{ background: 'var(--surface-2, #1e2035)', border: '1px solid var(--border-default, rgba(255,255,255,0.1))', borderRadius: '12px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.95rem' }}>Neue Verletzung erfassen</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <label style={labelStyle}>
              Datum *
              <input
                type="date"
                value={form.datum}
                onChange={e => setForm(f => ({ ...f, datum: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Schwere
              <select
                value={form.schwere}
                onChange={e => setForm(f => ({ ...f, schwere: e.target.value }))}
                style={inputStyle}
              >
                {SCHWERE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label style={labelStyle}>
            Art der Verletzung *
            <input
              type="text"
              placeholder="z.B. Zerrung, Prellung, Bänderriss..."
              value={form.art}
              onChange={e => setForm(f => ({ ...f, art: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <label style={labelStyle}>
              Körperregion
              <select
                value={form.koerperregion}
                onChange={e => setForm(f => ({ ...f, koerperregion: e.target.value }))}
                style={inputStyle}
              >
                <option value="">— Bitte wählen —</option>
                {KOERPERREGIONEN.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Wieder trainierbar ab
              <input
                type="date"
                value={form.wieder_trainierbar_ab}
                onChange={e => setForm(f => ({ ...f, wieder_trainierbar_ab: e.target.value }))}
                style={inputStyle}
              />
            </label>
          </div>

          <label style={labelStyle}>
            Notizen
            <textarea
              rows={3}
              placeholder="Behandlung, Arztbesuch, Besonderheiten..."
              value={form.notizen}
              onChange={e => setForm(f => ({ ...f, notizen: e.target.value }))}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-neutral btn-sm"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(null); }}
            >
              Abbrechen
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      {/* Lade-Spinner */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          Lade Verletzungsprotokoll...
        </div>
      )}

      {/* Keine Einträge */}
      {!loading && verletzungen.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)', background: 'var(--surface-2, #1e2035)', borderRadius: '12px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🩹</div>
          <div style={{ fontSize: '0.95rem' }}>Keine Verletzungen erfasst.</div>
          {isAdmin && <div style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>Über "+ Verletzung erfassen" Einträge hinzufügen.</div>}
        </div>
      )}

      {/* Aktive Verletzungen */}
      {aktive.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 0.6rem', color: '#ef4444', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Aktive Verletzungen
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {aktive.map(v => (
              <InjuryCard
                key={v.id}
                v={v}
                isAdmin={isAdmin}
                onRecover={handleMarkRecovered}
                onDelete={handleDelete}
                formatDate={formatDate}
                getSchwereColor={getSchwereColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Erholt / Archiv */}
      {erholt.length > 0 && (
        <div>
          <h4 style={{ margin: '0.4rem 0 0.6rem', color: 'var(--text-secondary)', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ✅ Erholt / Archiv ({erholt.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', opacity: 0.7 }}>
            {erholt.map(v => (
              <InjuryCard
                key={v.id}
                v={v}
                isAdmin={isAdmin}
                onRecover={null}
                onDelete={handleDelete}
                formatDate={formatDate}
                getSchwereColor={getSchwereColor}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const InjuryCard = ({ v, isAdmin, onRecover, onDelete, formatDate, getSchwereColor }) => (
  <div style={{
    background: 'var(--surface-2, #1e2035)',
    border: `1px solid ${v.vollstaendig_erholt ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.25)'}`,
    borderRadius: '10px',
    padding: '0.9rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  }}>
    {/* Kopfzeile */}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.97rem' }}>
          {v.art}
        </span>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          padding: '0.15rem 0.5rem',
          borderRadius: '20px',
          background: `${getSchwereColor(v.schwere)}22`,
          border: `1px solid ${getSchwereColor(v.schwere)}55`,
          color: getSchwereColor(v.schwere),
        }}>
          {v.schwere === 'leicht' ? '🟡 Leicht' : v.schwere === 'mittel' ? '🟠 Mittel' : '🔴 Schwer'}
        </span>
        {v.vollstaendig_erholt ? (
          <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>✅ Erholt</span>
        ) : null}
      </div>
      {isAdmin && (
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          {onRecover && (
            <button
              className="btn btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80' }}
              onClick={() => onRecover(v)}
              title="Als vollständig erholt markieren"
            >
              ✅ Erholt
            </button>
          )}
          <button
            className="btn btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
            onClick={() => onDelete(v)}
            title="Eintrag löschen"
          >
            🗑
          </button>
        </div>
      )}
    </div>

    {/* Detail-Zeile */}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
      <span>📅 {formatDate(v.datum)}</span>
      {v.koerperregion && <span>📍 {v.koerperregion}</span>}
      {v.wieder_trainierbar_ab && (
        <span>🏃 Trainierbar ab: {formatDate(v.wieder_trainierbar_ab)}</span>
      )}
    </div>

    {/* Notizen */}
    {v.notizen && (
      <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
        {v.notizen}
      </div>
    )}
  </div>
);

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  fontSize: '0.83rem',
  color: 'var(--text-secondary)',
};

const inputStyle = {
  background: 'var(--input-bg, #12142a)',
  border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
  borderRadius: '6px',
  padding: '0.45rem 0.6rem',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
};

export default MemberInjuryTab;
