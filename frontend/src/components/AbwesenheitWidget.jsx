import React, { useState, useEffect } from 'react';
import { CalendarX, X, Plus, Check, AlertCircle, Loader } from 'lucide-react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import '../styles/AbwesenheitWidget.css';

const ART_LABELS = {
  krank: { label: 'Krank', emoji: '🤒', color: '#ef4444' },
  abwesend: { label: 'Abwesend', emoji: '✈️', color: '#f59e0b' },
  urlaub: { label: 'Urlaub', emoji: '🏖️', color: '#3b82f6' },
  sonstiges: { label: 'Sonstiges', emoji: '📝', color: '#8b5cf6' },
};

const fmtDate = (d) => {
  if (!d) return '';
  const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  return new Date(s + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const dt = new Date(d + 'T00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
const endOfWeek = (d) => { const dt = new Date(d + 'T00:00'); const day = dt.getDay(); const diff = day === 0 ? 0 : 7 - day; dt.setDate(dt.getDate() + diff); return dt.toISOString().slice(0, 10); };
const nextMonday = (d) => { const dt = new Date(d + 'T00:00'); const day = dt.getDay(); dt.setDate(dt.getDate() + (day === 1 ? 7 : (8 - day) % 7)); return dt.toISOString().slice(0, 10); };

export default function AbwesenheitWidget() {
  const [abwesenheiten, setAbwesenheiten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ datum: todayStr(), datum_bis: '', art: 'abwesend', notiz: '' });
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${config.apiBaseUrl}/abwesenheiten/meine`);
      if (res.ok) {
        const data = await res.json();
        setAbwesenheiten(data.abwesenheiten || []);
      }
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const isTodayAbsent = abwesenheiten.some(a => {
    const today = todayStr();
    return today >= a.datum && today <= (a.datum_bis || a.datum);
  });

  const setQuick = (type) => {
    const today = todayStr();
    if (type === 'today') setForm(f => ({ ...f, datum: today, datum_bis: '', art: f.art }));
    else if (type === 'week') setForm(f => ({ ...f, datum: today, datum_bis: endOfWeek(today), art: f.art }));
    else if (type === 'nextweek') { const mon = nextMonday(today); setForm(f => ({ ...f, datum: mon, datum_bis: addDays(endOfWeek(mon), 0), art: f.art })); }
  };

  const handleSave = async () => {
    if (!form.datum || !form.art) { setError('Bitte Datum und Art angeben'); return; }
    if (form.datum_bis && form.datum_bis < form.datum) { setError('Enddatum muss nach Startdatum liegen'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/abwesenheiten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datum: form.datum, datum_bis: form.datum_bis || undefined, art: form.art, notiz: form.notiz || undefined })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Fehler');
      setShowForm(false);
      setForm({ datum: todayStr(), datum_bis: '', art: 'abwesend', notiz: '' });
      await load();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/abwesenheiten/${id}`, { method: 'DELETE' });
      if (res.ok) await load();
    } catch (_) {}
    setDeletingId(null);
  };

  return (
    <div className="abw-widget">
      <div className="abw-header">
        <div className="abw-header-left">
          <CalendarX size={18} className="abw-header-icon" />
          <div>
            <h3 className="abw-title">Abwesenheit melden</h3>
            <p className="abw-subtitle">Informiere uns wenn du nicht trainieren kannst</p>
          </div>
        </div>
        {isTodayAbsent
          ? <span className="abw-today-badge abw-today-badge--active"><Check size={13} /> Heute abgemeldet</span>
          : <button className="abw-add-btn" onClick={() => setShowForm(v => !v)}>
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? 'Abbrechen' : 'Jetzt melden'}
            </button>
        }
      </div>

      {showForm && (
        <div className="abw-form">
          <div className="abw-quick-btns">
            <button className="abw-quick" onClick={() => setQuick('today')}>Heute</button>
            <button className="abw-quick" onClick={() => setQuick('week')}>Diese Woche</button>
            <button className="abw-quick" onClick={() => setQuick('nextweek')}>Nächste Woche</button>
          </div>

          <div className="abw-form-row">
            <div className="abw-form-field">
              <label>Von</label>
              <input type="date" value={form.datum} min={todayStr()} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
            </div>
            <div className="abw-form-field">
              <label>Bis (optional)</label>
              <input type="date" value={form.datum_bis} min={form.datum} onChange={e => setForm(f => ({ ...f, datum_bis: e.target.value }))} />
            </div>
          </div>

          <div className="abw-art-selector">
            {Object.entries(ART_LABELS).map(([key, { label, emoji }]) => (
              <button
                key={key}
                className={`abw-art-btn ${form.art === key ? 'abw-art-btn--active' : ''}`}
                onClick={() => setForm(f => ({ ...f, art: key }))}
              >
                {emoji} {label}
              </button>
            ))}
          </div>

          <textarea
            className="abw-notiz"
            placeholder="Kurze Notiz (optional) – z.B. 'Knie verletzt, komme Montag wieder'"
            value={form.notiz}
            onChange={e => setForm(f => ({ ...f, notiz: e.target.value }))}
            rows={2}
          />

          {error && (
            <div className="abw-error"><AlertCircle size={14} />{error}</div>
          )}

          <button className="abw-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? <Loader size={16} className="abw-spin" /> : <Check size={16} />}
            {saving ? 'Speichern…' : 'Abmeldung bestätigen'}
          </button>
        </div>
      )}

      {!loading && abwesenheiten.length > 0 && (
        <div className="abw-list">
          <p className="abw-list-label">Deine gemeldeten Abwesenheiten:</p>
          {abwesenheiten.map(a => {
            const meta = ART_LABELS[a.art] || ART_LABELS.sonstiges;
            const today = todayStr();
            const isActive = today >= a.datum && today <= (a.datum_bis || a.datum);
            return (
              <div key={a.id} className={`abw-item ${isActive ? 'abw-item--active' : ''}`}>
                <span className="abw-item-emoji">{meta.emoji}</span>
                <div className="abw-item-info">
                  <span className="abw-item-label" style={{ color: meta.color }}>{meta.label}</span>
                  <span className="abw-item-dates">
                    {fmtDate(a.datum)}{a.datum_bis && a.datum_bis !== a.datum ? ` – ${fmtDate(a.datum_bis)}` : ''}
                  </span>
                  {a.notiz && <span className="abw-item-notiz">{a.notiz}</span>}
                </div>
                {isActive && <span className="abw-active-dot" title="Heute aktiv" />}
                <button
                  className="abw-delete-btn"
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  title="Stornieren"
                >
                  {deletingId === a.id ? <Loader size={12} className="abw-spin" /> : <X size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !isTodayAbsent && abwesenheiten.length === 0 && !showForm && (
        <p className="abw-empty">Keine Abmeldungen geplant – wir freuen uns auf dich! 🥋</p>
      )}
    </div>
  );
}
