import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Tag, X, Check, Users } from 'lucide-react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config';
import '../styles/SonderaktionenTab.css';

const LEERE_FORM = {
  name: '', beschreibung: '',
  rabatt_typ: 'prozent',
  rabatt_prozent: '',
  rabatt_betrag_euro: '',
  gueltig_von: '', gueltig_bis: '',
  max_nutzungen: '',
  aktiv: true,
  ist_familien_rabatt: false,
};

export default function VergünstigungenTab() {
  const [rabatte, setRabatte] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(LEERE_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/tarife/rabatte`);
      if (res.ok) {
        const data = await res.json();
        setRabatte(data.data || []);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(LEERE_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      name: r.name || '',
      beschreibung: r.beschreibung || '',
      rabatt_typ: r.rabatt_typ || 'prozent',
      rabatt_prozent: r.rabatt_prozent != null ? String(r.rabatt_prozent) : '',
      rabatt_betrag_euro: r.rabatt_betrag_cents != null ? String(r.rabatt_betrag_cents / 100) : '',
      gueltig_von: r.gueltig_von ? r.gueltig_von.slice(0, 10) : '',
      gueltig_bis: r.gueltig_bis ? r.gueltig_bis.slice(0, 10) : '',
      max_nutzungen: r.max_nutzungen != null ? String(r.max_nutzungen) : '',
      aktiv: !!r.aktiv,
      ist_familien_rabatt: !!r.ist_familien_rabatt,
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name ist Pflichtfeld'); return; }
    if (form.rabatt_typ === 'prozent' && (!form.rabatt_prozent || isNaN(Number(form.rabatt_prozent)))) {
      setError('Rabatt in % ist Pflichtfeld'); return;
    }
    if (form.rabatt_typ === 'betrag' && (!form.rabatt_betrag_euro || isNaN(Number(form.rabatt_betrag_euro)))) {
      setError('Betrag in € ist Pflichtfeld'); return;
    }
    setSaving(true);
    setError('');

    const payload = {
      name: form.name,
      beschreibung: form.beschreibung || null,
      rabatt_typ: form.rabatt_typ,
      rabatt_prozent: form.rabatt_typ === 'prozent' ? Number(form.rabatt_prozent) : null,
      rabatt_betrag_cents: form.rabatt_typ === 'betrag' ? Math.round(Number(form.rabatt_betrag_euro) * 100) : null,
      gueltig_von: form.gueltig_von || null,
      gueltig_bis: form.gueltig_bis || null,
      max_nutzungen: form.max_nutzungen ? parseInt(form.max_nutzungen, 10) : null,
      aktiv: form.aktiv ? 1 : 0,
      ist_familien_rabatt: form.ist_familien_rabatt ? 1 : 0,
      familie_position_min: form.ist_familien_rabatt ? 2 : null,
      familie_position_max: null,
    };

    try {
      const url = editing
        ? `${config.apiBaseUrl}/tarife/rabatte/${editing.rabatt_id}`
        : `${config.apiBaseUrl}/tarife/rabatte`;
      const res = await fetchWithAuth(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowModal(false);
        load();
      } else {
        const d = await res.json();
        setError(d.error || 'Fehler beim Speichern');
      }
    } catch (e) { setError('Verbindungsfehler'); }
    setSaving(false);
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Vergünstigung "${r.name}" wirklich löschen?`)) return;
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/tarife/rabatte/${r.rabatt_id}`, { method: 'DELETE' });
      load();
    } catch (e) { /* ignore */ }
  };

  const wertLabel = (r) => {
    if (r.rabatt_typ === 'betrag' && r.rabatt_betrag_cents != null)
      return `${(r.rabatt_betrag_cents / 100).toFixed(2)} € Rabatt`;
    return `${r.rabatt_prozent || 0}% Rabatt`;
  };

  return (
    <div className="sa-wrap">
      <div className="sa-toolbar">
        <h2><Tag size={16} /> Vergünstigungen</h2>
        <div className="sa-toolbar-right">
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            <Plus size={14} /> Neue Vergünstigung
          </button>
        </div>
      </div>

      <div className="sa-info-box">
        <strong>💡 Vergünstigungen</strong> sind dauerhafte Rabatttypen (z.B. Familienrabatt, Schüler, Senioren).
        Vergünstigungen mit aktivem <strong>Familienrabatt</strong>-Flag werden beim Anlegen von Familienmitgliedern automatisch angewendet.
      </div>

      {loading ? (
        <div className="sa-empty"><div className="sa-empty-icon">⏳</div><div className="sa-empty-title">Laden…</div></div>
      ) : rabatte.length === 0 ? (
        <div className="sa-empty">
          <div className="sa-empty-icon">🏷️</div>
          <div className="sa-empty-title">Noch keine Vergünstigungen</div>
          <div className="sa-empty-sub">Erstelle z.B. einen Familienrabatt von 10 € pro weiteres Familienmitglied.</div>
        </div>
      ) : (
        <div className="sa-grid">
          {rabatte.map(r => (
            <div key={r.rabatt_id} className={`sa-card${!r.aktiv ? ' sa-card--inaktiv' : ''}`}>
              <div className="sa-card-header">
                <span className="sa-card-icon">{r.ist_familien_rabatt ? '👨‍👩‍👧' : '🏷️'}</span>
                <div className="sa-card-title">
                  <div className="sa-card-name">{r.name}</div>
                  {r.beschreibung && <div className="sa-card-desc">{r.beschreibung}</div>}
                </div>
                <div className="sa-wert">{wertLabel(r)}</div>
              </div>

              <div className="sa-badges">
                <span className={`sa-badge ${r.aktiv ? 'sa-badge--aktiv' : 'sa-badge--inaktiv'}`}>
                  {r.aktiv ? 'Aktiv' : 'Inaktiv'}
                </span>
                <span className={`sa-badge ${r.rabatt_typ === 'betrag' ? 'sa-badge--typ-rabatt_betrag' : 'sa-badge--typ-rabatt_prozent'}`}>
                  {r.rabatt_typ === 'betrag' ? '€ Festbetrag' : '% Prozent'}
                </span>
                {r.ist_familien_rabatt && (
                  <span className="sa-badge sa-badge--marketing"><Users size={10} /> Familienrabatt</span>
                )}
              </div>

              {(r.gueltig_von || r.gueltig_bis) && (
                <div className="sa-meta">
                  {r.gueltig_von && <span>ab {new Date(r.gueltig_von).toLocaleDateString('de-DE')}</span>}
                  {r.gueltig_bis && <span>bis {new Date(r.gueltig_bis).toLocaleDateString('de-DE')}</span>}
                </div>
              )}

              {r.max_nutzungen && (
                <div className="sa-progress-wrap">
                  {r.genutzt || 0} / {r.max_nutzungen} Nutzungen
                  <div className="sa-progress-bar">
                    <div className="sa-progress-fill" style={{ width: `${Math.min(100, ((r.genutzt || 0) / r.max_nutzungen) * 100)}%` }} />
                  </div>
                </div>
              )}

              <div className="sa-card-footer">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>
                  {r.ist_familien_rabatt ? '🔄 Wird automatisch angewendet' : ''}
                </span>
                <div className="sa-card-actions">
                  <button className="sa-btn-icon" onClick={() => openEdit(r)} title="Bearbeiten"><Pencil size={13} /></button>
                  <button className="sa-btn-icon danger" onClick={() => handleDelete(r)} title="Löschen"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="sa-modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="sa-modal">
            <div className="sa-modal-header">
              <h3>{editing ? 'Vergünstigung bearbeiten' : 'Neue Vergünstigung'}</h3>
              <button className="sa-btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-form-group">
                <label>Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="z.B. Familienrabatt, Schülerrabatt" />
              </div>
              <div className="sa-form-group">
                <label>Beschreibung</label>
                <textarea value={form.beschreibung} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))} placeholder="Interne Notiz" />
              </div>
              <div className="sa-form-row">
                <div className="sa-form-group">
                  <label>Rabatt-Art *</label>
                  <select value={form.rabatt_typ} onChange={e => setForm(p => ({ ...p, rabatt_typ: e.target.value }))}>
                    <option value="prozent">Prozent (%)</option>
                    <option value="betrag">Festbetrag (€)</option>
                  </select>
                </div>
                <div className="sa-form-group">
                  <label>{form.rabatt_typ === 'betrag' ? 'Betrag in € *' : 'Rabatt in % *'}</label>
                  {form.rabatt_typ === 'betrag' ? (
                    <input type="number" min="0" step="0.01" value={form.rabatt_betrag_euro}
                      onChange={e => setForm(p => ({ ...p, rabatt_betrag_euro: e.target.value }))} placeholder="10.00" />
                  ) : (
                    <input type="number" min="1" max="100" value={form.rabatt_prozent}
                      onChange={e => setForm(p => ({ ...p, rabatt_prozent: e.target.value }))} placeholder="10" />
                  )}
                </div>
              </div>
              <div className="sa-form-row">
                <div className="sa-form-group">
                  <label>Gültig ab</label>
                  <input type="date" value={form.gueltig_von} onChange={e => setForm(p => ({ ...p, gueltig_von: e.target.value }))} />
                </div>
                <div className="sa-form-group">
                  <label>Gültig bis</label>
                  <input type="date" value={form.gueltig_bis} onChange={e => setForm(p => ({ ...p, gueltig_bis: e.target.value }))} />
                </div>
              </div>
              <div className="sa-form-group">
                <label>Max. Nutzungen (leer = unbegrenzt)</label>
                <input type="number" min="1" value={form.max_nutzungen}
                  onChange={e => setForm(p => ({ ...p, max_nutzungen: e.target.value }))} placeholder="Unbegrenzt" />
              </div>
              <label className="sa-checkbox-row">
                <input type="checkbox" checked={form.ist_familien_rabatt}
                  onChange={e => setForm(p => ({ ...p, ist_familien_rabatt: e.target.checked }))} />
                Familienrabatt (wird beim Anlegen von Familienmitgliedern automatisch angewendet)
              </label>
              <label className="sa-checkbox-row">
                <input type="checkbox" checked={form.aktiv} onChange={e => setForm(p => ({ ...p, aktiv: e.target.checked }))} />
                Aktiv
              </label>
              {error && <div style={{ color: '#f87171', fontSize: '0.82rem' }}>{error}</div>}
            </div>
            <div className="sa-modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Abbrechen</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? '…' : <><Check size={14} /> Speichern</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
