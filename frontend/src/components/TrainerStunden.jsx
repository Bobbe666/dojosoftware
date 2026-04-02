import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { DatenContext } from '@shared/DatenContext.jsx';

const MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

const STATUS_OPTS = [
  { value: 'geplant', label: '📅 Geplant', color: '#6366f1' },
  { value: 'bestaetigt', label: '✅ Bestätigt', color: '#22c55e' },
  { value: 'ausgefallen', label: '❌ Ausgefallen', color: '#ef4444' },
  { value: 'vertretung', label: '🔄 Vertretung', color: '#f97316' },
];

const EMPTY_FORM = {
  trainer_id: '',
  kurs_id: '',
  datum: new Date().toISOString().split('T')[0],
  stunden: '1.5',
  status: 'geplant',
  notiz: '',
};

const TrainerStunden = () => {
  const { trainer: trainerList = [], kurse = [] } = useContext(DatenContext);
  const now = new Date();
  const [monat, setMonat] = useState(now.getMonth() + 1);
  const [jahr, setJahr] = useState(now.getFullYear());
  const [view, setView] = useState('summary'); // 'summary' | 'list'
  const [summary, setSummary] = useState([]);
  const [stunden, setStunden] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [filterTrainer, setFilterTrainer] = useState('');

  useEffect(() => { ladeData(); }, [monat, jahr, view]);

  const ladeData = async () => {
    setLoading(true);
    try {
      if (view === 'summary') {
        const res = await axios.get('/trainer-stunden/summary', { params: { monat, jahr } });
        setSummary(res.data.summary || []);
      } else {
        const res = await axios.get('/trainer-stunden', { params: { monat, jahr, trainer_id: filterTrainer || undefined } });
        setStunden(res.data.stunden || []);
      }
    } catch { setMsg({ type: 'error', text: 'Fehler beim Laden.' }); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.trainer_id || !form.datum) { setMsg({ type: 'error', text: 'Trainer und Datum erforderlich.' }); return; }
    setSaving(true);
    try {
      await axios.post('/trainer-stunden', form);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setMsg({ type: 'success', text: 'Einheit gespeichert.' });
      ladeData();
      setTimeout(() => setMsg(null), 3000);
    } catch { setMsg({ type: 'error', text: 'Fehler beim Speichern.' }); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id, status) => {
    const entry = stunden.find(s => s.id === id);
    if (!entry) return;
    await axios.put(`/trainer-stunden/${id}`, { stunden: entry.stunden, status, notiz: entry.notiz }).catch(() => {});
    setStunden(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eintrag löschen?')) return;
    await axios.delete(`/trainer-stunden/${id}`).catch(() => {});
    setStunden(prev => prev.filter(s => s.id !== id));
  };

  const getStatusBadge = (status) => {
    const opt = STATUS_OPTS.find(o => o.value === status);
    return opt ? { label: opt.label, color: opt.color } : { label: status, color: '#666' };
  };

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', maxWidth: '900px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.3rem' }}>⏱️ Trainer-Stundennachweise</h2>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Trainingseinheiten erfassen und monatlich auswerten
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(!showForm); setMsg(null); }}>
          {showForm ? '✕ Schließen' : '+ Einheit erfassen'}
        </button>
      </div>

      {/* Filter-Leiste */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={monat} onChange={e => setMonat(Number(e.target.value))} style={selectStyle}>
          {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={jahr} onChange={e => setJahr(Number(e.target.value))} style={selectStyle}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '0', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          {['summary', 'list'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '0.35rem 0.8rem', border: 'none', cursor: 'pointer', fontSize: '0.83rem',
              background: view === v ? 'rgba(255,215,0,0.15)' : 'transparent',
              color: view === v ? 'var(--primary)' : 'var(--text-secondary)',
            }}>
              {v === 'summary' ? '📊 Übersicht' : '📋 Einzeln'}
            </button>
          ))}
        </div>
        {view === 'list' && (
          <select value={filterTrainer} onChange={e => { setFilterTrainer(e.target.value); ladeData(); }} style={selectStyle}>
            <option value="">Alle Trainer</option>
            {trainerList.map(t => <option key={t.trainer_id} value={t.trainer_id}>{t.vorname} {t.nachname}</option>)}
          </select>
        )}
      </div>

      {/* Meldungen */}
      {msg && (
        <div style={{ padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.88rem',
          background: msg.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          color: msg.type === 'success' ? '#4ade80' : '#f87171',
          border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {msg.text}
        </div>
      )}

      {/* Formular */}
      {showForm && (
        <div style={{ background: 'var(--surface-2, #1e2035)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.95rem' }}>Neue Trainingseinheit</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <label style={labelStyle}>
              Trainer *
              <select value={form.trainer_id} onChange={e => setForm(f => ({ ...f, trainer_id: e.target.value }))} style={inputStyle}>
                <option value="">— Trainer wählen —</option>
                {trainerList.map(t => <option key={t.trainer_id} value={t.trainer_id}>{t.vorname} {t.nachname}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Kurs (optional)
              <select value={form.kurs_id} onChange={e => setForm(f => ({ ...f, kurs_id: e.target.value }))} style={inputStyle}>
                <option value="">— Kurs wählen —</option>
                {kurse.map(k => <option key={k.kurs_id} value={k.kurs_id}>{k.gruppenname}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Datum *
              <input type="date" value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Stunden
              <input type="number" step="0.5" min="0.5" max="8" value={form.stunden}
                onChange={e => setForm(f => ({ ...f, stunden: e.target.value }))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Status
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Notiz
              <input type="text" placeholder="Optional..." value={form.notiz}
                onChange={e => setForm(f => ({ ...f, notiz: e.target.value }))} style={inputStyle} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-neutral btn-sm" onClick={() => setShowForm(false)}>Abbrechen</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Speichere...' : 'Speichern'}</button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Lade Daten...</div>}

      {/* Summary View */}
      {!loading && view === 'summary' && (
        <div>
          <h4 style={{ margin: '0 0 0.8rem', fontSize: '0.88rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {MONTHS[monat-1]} {jahr} — Übersicht
          </h4>
          {summary.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
              Keine Trainer gefunden.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {summary.map(t => (
                <div key={t.trainer_id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', alignItems: 'center', gap: '1rem',
                  background: 'var(--surface-2, #1e2035)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '0.8rem 1.2rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.vorname} {t.nachname}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {t.einheiten_gesamt} Einheiten geplant, {t.ausgefallen} ausgefallen
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>{parseFloat(t.stunden_gesamt || 0).toFixed(1)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Stunden</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#22c55e' }}>{t.einheiten_bestaetigt}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Bestätigt</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444' }}>{t.ausgefallen}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Ausgefallen</div>
                  </div>
                  <button className="btn btn-neutral btn-sm" style={{ fontSize: '0.75rem' }}
                    onClick={() => { setFilterTrainer(String(t.trainer_id)); setView('list'); }}>
                    Details →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {!loading && view === 'list' && (
        <div>
          <h4 style={{ margin: '0 0 0.8rem', fontSize: '0.88rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Einzelne Einheiten — {MONTHS[monat-1]} {jahr}
          </h4>
          {stunden.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
              Keine Einheiten für diesen Zeitraum.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {stunden.map(s => {
                const badge = getStatusBadge(s.status);
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap',
                    background: 'var(--surface-2, #1e2035)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '0.7rem 1rem' }}>
                    <div style={{ flex: '0 0 90px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {new Date(s.datum).toLocaleDateString('de-DE')}
                    </div>
                    <div style={{ flex: 1, minWidth: '120px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.vorname} {s.nachname}</div>
                      {s.kursname && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>🥋 {s.kursname}</div>}
                      {s.notiz && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{s.notiz}</div>}
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem', minWidth: '50px', textAlign: 'right' }}>
                      {parseFloat(s.stunden).toFixed(1)} h
                    </div>
                    <select value={s.status} onChange={e => handleStatusChange(s.id, e.target.value)}
                      style={{ ...selectStyle, fontSize: '0.78rem', color: badge.color, padding: '0.2rem 0.5rem' }}>
                      {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button className="btn btn-sm" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                      onClick={() => handleDelete(s.id)}>🗑</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const selectStyle = {
  background: 'var(--input-bg, #12142a)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px',
  padding: '0.35rem 0.6rem',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
};

const labelStyle = {
  display: 'flex', flexDirection: 'column', gap: '0.3rem',
  fontSize: '0.83rem', color: 'var(--text-secondary)',
};

const inputStyle = {
  background: 'var(--input-bg, #12142a)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px',
  padding: '0.45rem 0.6rem',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
};

export default TrainerStunden;
