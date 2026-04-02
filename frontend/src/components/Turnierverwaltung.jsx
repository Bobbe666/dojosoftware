import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TYP_OPTS = [
  { value: 'vereinsintern', label: 'Vereinsintern', color: '#8b5cf6' },
  { value: 'regional', label: 'Regional', color: '#3b82f6' },
  { value: 'national', label: 'National', color: '#f59e0b' },
  { value: 'international', label: 'International', color: '#ef4444' },
  { value: 'freundschaftskampf', label: 'Freundschaft', color: '#22c55e' },
];

const MEDAILLE_OPTS = ['keine', 'gold', 'silber', 'bronze'];
const MEDAILLE_EMOJI = { gold: '🥇', silber: '🥈', bronze: '🥉', keine: '—' };

const EMPTY_FORM = { name: '', datum: '', ort: '', beschreibung: '', typ: 'vereinsintern' };

const inputStyle = {
  background: 'var(--surface-2, #1e2035)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px', padding: '0.45rem 0.7rem', color: 'var(--text-primary)',
  fontSize: '0.9rem', width: '100%', boxSizing: 'border-box',
};

const Turnierverwaltung = () => {
  const [turniere, setTurniere] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [selectedTurnier, setSelectedTurnier] = useState(null);

  useEffect(() => { ladeTurniere(); }, []);

  const ladeTurniere = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/turniere');
      setTurniere(res.data.turniere || []);
    } catch { setMsg({ type: 'error', text: 'Fehler beim Laden.' }); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('/turniere', form);
      setShowForm(false);
      setForm(EMPTY_FORM);
      ladeTurniere();
      setMsg({ type: 'success', text: 'Turnier erstellt.' });
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Fehler beim Erstellen.' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Turnier wirklich löschen?')) return;
    try {
      await axios.delete(`/turniere/${id}`);
      setTurniere(prev => prev.filter(t => t.id !== id));
    } catch { setMsg({ type: 'error', text: 'Fehler beim Löschen.' }); }
  };

  const getTypColor = (typ) => TYP_OPTS.find(o => o.value === typ)?.color || '#666';
  const getTypLabel = (typ) => TYP_OPTS.find(o => o.value === typ)?.label || typ;

  if (selectedTurnier) {
    return (
      <TeilnahmenView
        turnier={selectedTurnier}
        onBack={() => { setSelectedTurnier(null); ladeTurniere(); }}
      />
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.2rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>🏆 Turnierverwaltung</h2>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Turniere verwalten, Ergebnisse eintragen & HOF-Vorschläge generieren
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Schließen' : '+ Neues Turnier'}
        </button>
      </div>

      {msg && (
        <div style={{ padding: '0.7rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.88rem',
          background: msg.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: msg.type === 'success' ? '#4ade80' : '#f87171',
          border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <div style={{ background: 'var(--surface-2, #1e2035)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.2rem', marginBottom: '1.2rem' }}>
          <h4 style={{ margin: '0 0 1rem', color: 'var(--primary)', fontSize: '0.95rem' }}>Neues Turnier anlegen</h4>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                Name *
                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Turniername" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                Datum *
                <input type="date" style={inputStyle} value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} required />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                Ort
                <input style={inputStyle} value={form.ort} onChange={e => setForm(f => ({ ...f, ort: e.target.value }))} placeholder="Veranstaltungsort" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                Typ
                <select style={inputStyle} value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))}>
                  {TYP_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.83rem', color: 'var(--text-secondary)', gridColumn: 'span 2' }}>
                Beschreibung
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} value={form.beschreibung} onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))} placeholder="Optional..." />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Erstelle...' : 'Erstellen'}</button>
              <button type="button" className="btn btn-neutral btn-sm" onClick={() => setShowForm(false)}>Abbrechen</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Lade Turniere...</div>
      ) : turniere.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏆</div>
          <div>Noch keine Turniere erfasst.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {turniere.map(t => (
            <div key={t.id} style={{ background: 'var(--surface-2, #1e2035)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem' }}>{t.name}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                  <span>📅 {new Date(t.datum).toLocaleDateString('de-DE')}</span>
                  {t.ort && <span>📍 {t.ort}</span>}
                  <span>👥 {t.teilnehmer_count || 0} Teilnehmer</span>
                </div>
              </div>
              <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                background: `${getTypColor(t.typ)}22`, color: getTypColor(t.typ), border: `1px solid ${getTypColor(t.typ)}44` }}>
                {getTypLabel(t.typ)}
              </span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="btn btn-primary btn-sm" style={{ fontSize: '0.8rem' }} onClick={() => setSelectedTurnier(t)}>
                  👥 Teilnahmen
                </button>
                <button className="btn btn-sm" style={{ fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                  onClick={() => handleDelete(t.id)}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TeilnahmenView = ({ turnier, onBack }) => {
  const [teilnahmen, setTeilnahmen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [selectedMitglied, setSelectedMitglied] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    Promise.all([
      axios.get(`/turniere/${turnier.id}/teilnahmen`).then(r => setTeilnahmen(r.data.teilnahmen || [])),
      axios.get('/mitglieder').then(r => setMitglieder(r.data || [])),
    ]).finally(() => setLoading(false));
  }, [turnier.id]);

  const addTeilnahme = async () => {
    if (!selectedMitglied) return;
    try {
      await axios.post(`/turniere/${turnier.id}/teilnahmen`, { mitglied_id: selectedMitglied });
      setSelectedMitglied('');
      const res = await axios.get(`/turniere/${turnier.id}/teilnahmen`);
      setTeilnahmen(res.data.teilnahmen || []);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Fehler.' });
    }
  };

  const updateErgebnis = async (id, field, value) => {
    const t = teilnahmen.find(x => x.id === id);
    if (!t) return;
    const updated = { platzierung: t.platzierung, medaille: t.medaille, punkte: t.punkte, notizen: t.notizen, hof_vorschlag: t.hof_vorschlag, [field]: value };
    try {
      await axios.put(`/turniere/teilnahmen/${id}`, updated);
      setTeilnahmen(prev => prev.map(x => x.id === id ? { ...x, [field]: value } : x));
      if (field === 'hof_vorschlag' && value) setMsg({ type: 'success', text: 'HOF-Vorschlag gespeichert und Benachrichtigung gesendet!' });
      setTimeout(() => setMsg(null), 4000);
    } catch { setMsg({ type: 'error', text: 'Fehler beim Aktualisieren.' }); }
  };

  const removeTeilnahme = async (id) => {
    if (!window.confirm('Teilnahme entfernen?')) return;
    await axios.delete(`/turniere/teilnahmen/${id}`).catch(() => {});
    setTeilnahmen(prev => prev.filter(t => t.id !== id));
  };

  const availableMitglieder = mitglieder.filter(m => !teilnahmen.find(t => t.mitglied_id === m.mitglied_id));

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#FFD700', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        ← Zurück zur Übersicht
      </button>
      <h2 style={{ fontSize: '1.3rem', marginBottom: '0.2rem' }}>🏆 {turnier.name}</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
        {new Date(turnier.datum).toLocaleDateString('de-DE')}{turnier.ort ? ` · ${turnier.ort}` : ''}
      </p>

      {msg && (
        <div style={{ padding: '0.7rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.88rem',
          background: msg.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: msg.type === 'success' ? '#4ade80' : '#f87171',
          border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {msg.text}
        </div>
      )}

      {/* Mitglied hinzufügen */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
        <select value={selectedMitglied} onChange={e => setSelectedMitglied(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}>
          <option value="">— Mitglied zur Teilnahme hinzufügen —</option>
          {availableMitglieder.map(m => <option key={m.mitglied_id} value={m.mitglied_id}>{m.vorname} {m.nachname}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={addTeilnahme} disabled={!selectedMitglied}>+ Hinzufügen</button>
      </div>

      {/* Teilnehmer-Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>Lade Teilnahmen...</div>
      ) : teilnahmen.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
          Noch keine Teilnehmer angemeldet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {teilnahmen.map(t => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap',
              background: 'var(--surface-2, #1e2035)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '0.8rem 1rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{t.vorname} {t.nachname}</div>
                {t.disziplin && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{t.disziplin}</div>}
              </div>
              {/* Platzierung */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Platz
                <input type="number" min="1" max="999" value={t.platzierung || ''} placeholder="—"
                  style={{ ...inputStyle, width: '56px', textAlign: 'center', padding: '0.3rem' }}
                  onChange={e => updateErgebnis(t.id, 'platzierung', e.target.value ? parseInt(e.target.value) : null)} />
              </label>
              {/* Medaille */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Medaille
                <select value={t.medaille || 'keine'} onChange={e => updateErgebnis(t.id, 'medaille', e.target.value)} style={{ ...inputStyle, padding: '0.3rem', width: '90px' }}>
                  {MEDAILLE_OPTS.map(m => <option key={m} value={m}>{MEDAILLE_EMOJI[m]} {m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </label>
              {/* HOF-Vorschlag */}
              <button
                style={{ padding: '0.3rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  background: t.hof_vorschlag ? 'rgba(255,215,0,0.2)' : 'transparent',
                  color: t.hof_vorschlag ? '#FFD700' : 'var(--text-secondary)',
                  border: `1px solid ${t.hof_vorschlag ? '#FFD700' : 'rgba(255,255,255,0.15)'}` }}
                onClick={() => updateErgebnis(t.id, 'hof_vorschlag', !t.hof_vorschlag)}>
                🌟 HOF
              </button>
              <button className="btn btn-sm" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                onClick={() => removeTeilnahme(t.id)}>🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Turnierverwaltung;
