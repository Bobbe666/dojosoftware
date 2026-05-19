import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Tag, Clock, Zap, X, Check } from 'lucide-react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config';
import '../styles/SonderaktionenTab.css';

const TYP_LABELS = {
  rabatt_prozent:   { label: '% Rabatt',        icon: '🏷️' },
  rabatt_betrag:    { label: '€ Rabatt (fest)',  icon: '💶' },
  zahlungsaufschub: { label: 'Zahlungsaufschub', icon: '📅' },
};

const getStatusBadge = (aktion) => {
  const heute = new Date().toISOString().slice(0, 10);
  if (!aktion.aktiv) return { label: 'Inaktiv', cls: 'sa-badge--inaktiv' };
  if (aktion.gueltig_bis && aktion.gueltig_bis < heute) return { label: 'Abgelaufen', cls: 'sa-badge--abgelaufen' };
  if (aktion.gueltig_von && aktion.gueltig_von > heute) return { label: 'Noch nicht aktiv', cls: 'sa-badge--inaktiv' };
  return { label: 'Aktiv', cls: 'sa-badge--aktiv' };
};

const getCountdown = (bis) => {
  if (!bis) return null;
  const diff = Math.ceil((new Date(bis) - new Date()) / 86400000);
  if (diff < 0) return { text: 'Abgelaufen', expired: true };
  if (diff === 0) return { text: 'Läuft heute ab', expired: false };
  return { text: `Noch ${diff} Tag${diff !== 1 ? 'e' : ''}`, expired: false };
};

const LEERE_FORM = {
  name: '', beschreibung: '', typ: 'rabatt_prozent', wert: '',
  gueltig_von: '', gueltig_bis: '',
  aktiv: true, marketing_steuerbar: true,
  code: '', max_einloesungen: '',
};

export default function SonderaktionenTab({ nurMarketing = false }) {
  const [aktionen, setAktionen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(LEERE_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/sonder-aktionen`);
      if (res.ok) {
        const data = await res.json();
        const alle = data.aktionen || [];
        setAktionen(nurMarketing ? alle.filter(a => a.marketing_steuerbar) : alle);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  }, [nurMarketing]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(LEERE_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({
      name: a.name || '',
      beschreibung: a.beschreibung || '',
      typ: a.typ || 'rabatt_prozent',
      wert: a.wert != null ? String(a.wert) : '',
      gueltig_von: a.gueltig_von ? a.gueltig_von.slice(0, 10) : '',
      gueltig_bis: a.gueltig_bis ? a.gueltig_bis.slice(0, 10) : '',
      aktiv: !!a.aktiv,
      marketing_steuerbar: !!a.marketing_steuerbar,
      code: a.code || '',
      max_einloesungen: a.max_einloesungen != null ? String(a.max_einloesungen) : '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name ist Pflichtfeld'); return; }
    if (form.wert === '' || isNaN(Number(form.wert))) { setError('Wert muss eine Zahl sein'); return; }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      wert: Number(form.wert),
      max_einloesungen: form.max_einloesungen ? parseInt(form.max_einloesungen, 10) : null,
      gueltig_von: form.gueltig_von || null,
      gueltig_bis: form.gueltig_bis || null,
      code: form.code || null,
    };
    try {
      const url = editing
        ? `${config.apiBaseUrl}/sonder-aktionen/${editing.id}`
        : `${config.apiBaseUrl}/sonder-aktionen`;
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

  const handleToggle = async (a) => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/sonder-aktionen/${a.id}/toggle`, { method: 'PATCH' });
      if (res.ok) load();
    } catch (e) { /* ignore */ }
  };

  const handleDelete = async (a) => {
    if (!window.confirm(`Aktion "${a.name}" wirklich löschen?`)) return;
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/sonder-aktionen/${a.id}`, { method: 'DELETE' });
      load();
    } catch (e) { /* ignore */ }
  };

  const wertLabel = (a) => {
    if (a.typ === 'rabatt_prozent')   return `${a.wert}%`;
    if (a.typ === 'rabatt_betrag')    return `${Number(a.wert).toFixed(2)} €`;
    if (a.typ === 'zahlungsaufschub') return `${a.wert} Mon.`;
    return String(a.wert);
  };

  return (
    <div className="sa-wrap">
      <div className="sa-toolbar">
        <h2><Tag size={16} /> Sonderaktionen</h2>
        <div className="sa-toolbar-right">
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            <Plus size={14} /> Neue Aktion
          </button>
        </div>
      </div>

      {!nurMarketing && (
        <div className="sa-info-box">
          <strong>💡 Tipp:</strong> Sonderaktionen können direkt beim Vertragsabschluss angewendet werden.
          <br />Aktionen mit <strong>Marketing-Steuerung</strong> können auch in der MarketingZentrale ein/ausgeschaltet werden.
        </div>
      )}

      {loading ? (
        <div className="sa-empty"><div className="sa-empty-icon">⏳</div><div className="sa-empty-title">Laden…</div></div>
      ) : aktionen.length === 0 ? (
        <div className="sa-empty">
          <div className="sa-empty-icon">🏷️</div>
          <div className="sa-empty-title">Noch keine Sonderaktionen</div>
          <div className="sa-empty-sub">Erstelle deine erste Aktion z.B. "Vertragsabschluss heute – 3 Monate kostenlos"</div>
        </div>
      ) : (
        <div className="sa-grid">
          {aktionen.map(a => {
            const status = getStatusBadge(a);
            const countdown = getCountdown(a.gueltig_bis);
            const typInfo = TYP_LABELS[a.typ] || { label: a.typ, icon: '🏷️' };
            const einlPct = a.max_einloesungen ? Math.min(100, (a.einloesungen_count / a.max_einloesungen) * 100) : null;

            return (
              <div key={a.id} className={`sa-card${!a.aktiv ? ' sa-card--inaktiv' : ''}`}>
                <div className="sa-card-header">
                  <span className="sa-card-icon">{typInfo.icon}</span>
                  <div className="sa-card-title">
                    <div className="sa-card-name">{a.name}</div>
                    {a.beschreibung && <div className="sa-card-desc">{a.beschreibung}</div>}
                  </div>
                  <div className="sa-wert">{wertLabel(a)}</div>
                </div>

                <div className="sa-badges">
                  <span className={`sa-badge ${status.cls}`}>{status.label}</span>
                  <span className={`sa-badge sa-badge--typ-${a.typ}`}>{typInfo.label}</span>
                  {a.marketing_steuerbar && <span className="sa-badge sa-badge--marketing"><Zap size={10} /> Marketing</span>}
                  {a.code && <span className="sa-badge sa-badge--inaktiv">Code: {a.code}</span>}
                </div>

                <div className="sa-meta">
                  {a.gueltig_von && <span><Clock size={11} /> ab {new Date(a.gueltig_von).toLocaleDateString('de-DE')}</span>}
                  {countdown && (
                    <span className={`sa-countdown${countdown.expired ? ' expired' : ''}`}>
                      <Clock size={11} /> {countdown.text}
                    </span>
                  )}
                </div>

                {einlPct !== null && (
                  <div className="sa-progress-wrap">
                    {a.einloesungen_count} / {a.max_einloesungen} Einlösungen
                    <div className="sa-progress-bar"><div className="sa-progress-fill" style={{ width: `${einlPct}%` }} /></div>
                  </div>
                )}

                <div className="sa-card-footer">
                  <label className="sa-toggle" onClick={() => handleToggle(a)}>
                    <button className={`sa-toggle-switch${a.aktiv ? ' on' : ''}`} />
                    {a.aktiv ? 'Aktiv' : 'Inaktiv'}
                  </label>
                  <div className="sa-card-actions">
                    <button className="sa-btn-icon" onClick={() => openEdit(a)} title="Bearbeiten"><Pencil size={13} /></button>
                    <button className="sa-btn-icon danger" onClick={() => handleDelete(a)} title="Löschen"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="sa-modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="sa-modal">
            <div className="sa-modal-header">
              <h3>{editing ? 'Aktion bearbeiten' : 'Neue Sonderaktion'}</h3>
              <button className="sa-btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-form-group">
                <label>Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="z.B. Sommerkampagne 2026" />
              </div>
              <div className="sa-form-group">
                <label>Beschreibung</label>
                <textarea value={form.beschreibung} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))} placeholder="Optionale Beschreibung für interne Notizen" />
              </div>
              <div className="sa-form-row">
                <div className="sa-form-group">
                  <label>Typ *</label>
                  <select value={form.typ} onChange={e => setForm(p => ({ ...p, typ: e.target.value }))}>
                    <option value="rabatt_prozent">% Rabatt auf Monatsbeitrag</option>
                    <option value="rabatt_betrag">€ Rabatt (fester Betrag)</option>
                    <option value="zahlungsaufschub">Zahlungsaufschub (Monate)</option>
                  </select>
                </div>
                <div className="sa-form-group">
                  <label>
                    {form.typ === 'rabatt_prozent' && 'Rabatt in % *'}
                    {form.typ === 'rabatt_betrag' && 'Betrag in € *'}
                    {form.typ === 'zahlungsaufschub' && 'Aufschub in Monaten *'}
                  </label>
                  <input
                    type="number" min="0"
                    value={form.wert}
                    onChange={e => setForm(p => ({ ...p, wert: e.target.value }))}
                    placeholder={form.typ === 'rabatt_prozent' ? '10' : form.typ === 'rabatt_betrag' ? '10.00' : '3'}
                  />
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
              <div className="sa-form-row">
                <div className="sa-form-group">
                  <label>Promo-Code (optional)</label>
                  <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="z.B. SOMMER26" />
                </div>
                <div className="sa-form-group">
                  <label>Max. Einlösungen</label>
                  <input type="number" min="1" value={form.max_einloesungen} onChange={e => setForm(p => ({ ...p, max_einloesungen: e.target.value }))} placeholder="Unbegrenzt" />
                </div>
              </div>
              <label className="sa-checkbox-row">
                <input type="checkbox" checked={form.aktiv} onChange={e => setForm(p => ({ ...p, aktiv: e.target.checked }))} />
                Sofort aktiv schalten
              </label>
              <label className="sa-checkbox-row">
                <input type="checkbox" checked={form.marketing_steuerbar} onChange={e => setForm(p => ({ ...p, marketing_steuerbar: e.target.checked }))} />
                Über MarketingZentrale steuerbar
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
