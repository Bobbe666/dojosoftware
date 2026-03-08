/**
 * RuecklastschriftVerwaltung
 * ===========================
 * Admin-Oberfläche für den kompletten Rücklastschrift-Workflow:
 * Mahnung 1 → Mahnung 2 → Mahnbescheid PDF + Rechnung stellen
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, RefreshCw, FileText, Mail, RotateCcw,
  Check, X, Plus, ChevronDown, Loader, Download, Receipt
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext.jsx';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/RuecklastschriftVerwaltung.css';

// ── Konstanten ────────────────────────────────────────────────────────────────

const SEPA_CODES = [
  { code: 'AM04', label: 'AM04 — Deckung nicht ausreichend' },
  { code: 'MD01', label: 'MD01 — Kein gültiges Mandat' },
  { code: 'MD06', label: 'MD06 — Widerspruch durch Zahler' },
  { code: 'AC01', label: 'AC01 — IBAN ungültig' },
  { code: 'AC04', label: 'AC04 — Konto geschlossen' },
  { code: 'AC06', label: 'AC06 — Konto gesperrt' },
  { code: 'MS02', label: 'MS02 — Unbekannter Grund' },
  { code: 'TECH', label: 'TECH — Technischer Fehler' },
];

const MAHNSTUFE_LABELS = {
  offen: { label: 'Offen', color: 'var(--text-muted)', bg: '#6b728015' },
  mahnung_1: { label: 'Mahnung 1', color: 'var(--warning)', bg: '#f59e0b15' },
  mahnung_2: { label: 'Mahnung 2', color: 'var(--error)', bg: '#ef444415' },
  mahnbescheid: { label: 'Mahnbescheid', color: '#7c3aed', bg: '#7c3aed15' },
};

const STATUS_LABELS = {
  offen: { label: 'Offen', color: 'var(--warning)' },
  in_bearbeitung: { label: 'In Bearbeitung', color: 'var(--info)' },
  erledigt: { label: 'Erledigt', color: 'var(--success)' },
  storniert: { label: 'Storniert', color: 'var(--text-muted)' },
};

function formatBetrag(b) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(parseFloat(b || 0));
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE');
}

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso)) / (1000 * 60 * 60 * 24));
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function MahnstufeBadge({ mahnstufe }) {
  const info = MAHNSTUFE_LABELS[mahnstufe] || MAHNSTUFE_LABELS.offen;
  return (
    <span className="rlv-mahnstufe-badge" style={{ '--badge-bg': info.bg, '--badge-color': info.color }}>
      {info.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const info = STATUS_LABELS[status] || STATUS_LABELS.offen;
  return (
    <span className="rlv-status-text" style={{ '--status-color': info.color }}>
      {info.label}
    </span>
  );
}

// ── Neu-Anlegen-Modal ─────────────────────────────────────────────────────────

function NeuAnlegenModal({ dojoId, onClose, onCreated }) {
  const [form, setForm] = useState({ mitglied_id: '', betrag: '', beschreibung: '', rueckgabe_code: '', datum: new Date().toISOString().slice(0, 10) });
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const withDojo = (url) => dojoId ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${dojoId}` : url;

  useEffect(() => {
    fetchWithAuth(withDojo('/api/mitglieder'))
      .then(r => r.json())
      .then(data => setMitglieder(Array.isArray(data) ? data : (data.mitglieder || [])))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const resp = await fetchWithAuth(withDojo('/api/ruecklastschriften'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mitglied_id: form.mitglied_id || null,
          betrag: parseFloat(form.betrag),
          beschreibung: form.beschreibung,
          rueckgabe_code: form.rueckgabe_code || null,
          datum: form.datum
        })
      });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error || 'Fehler'); return; }
      onCreated();
      onClose();
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rv-modal-overlay">
      <div className="rv-modal-box">
        <div className="rv-modal-header">
          <h3 className="rv-modal-title">
            Rücklastschrift anlegen
          </h3>
          <button onClick={onClose} className="rv-modal-close-btn">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="rv-modal-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rv-form">
          <div>
            <label className="rv-label">Mitglied (optional)</label>
            <select
              value={form.mitglied_id}
              onChange={e => setForm(f => ({ ...f, mitglied_id: e.target.value }))}
              className="rv-select"
            >
              <option value="">— Kein Mitglied zugewiesen —</option>
              {mitglieder.map(m => (
                <option key={m.mitglied_id} value={m.mitglied_id}>
                  {m.vorname} {m.nachname} ({m.mitgliedsnummer || m.mitglied_id})
                </option>
              ))}
            </select>
          </div>

          <div className="rv-form-grid-2">
            <div>
              <label className="rv-label">Betrag (EUR) *</label>
              <input
                type="number" step="0.01" min="0.01" required
                value={form.betrag}
                onChange={e => setForm(f => ({ ...f, betrag: e.target.value }))}
                className="rv-input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="rv-label">Datum</label>
              <input
                type="date"
                value={form.datum}
                onChange={e => setForm(f => ({ ...f, datum: e.target.value }))}
                className="rv-input"
              />
            </div>
          </div>

          <div>
            <label className="rv-label">SEPA-Rückgabegrund</label>
            <select
              value={form.rueckgabe_code}
              onChange={e => setForm(f => ({ ...f, rueckgabe_code: e.target.value }))}
              className="rv-select"
            >
              <option value="">— Bitte wählen —</option>
              {SEPA_CODES.map(sc => (
                <option key={sc.code} value={sc.code}>{sc.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="rv-label">Beschreibung / Verwendungszweck *</label>
            <input
              type="text" required
              value={form.beschreibung}
              onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
              className="rv-input"
              placeholder="z.B. Monatsbeitrag Oktober 2025"
            />
          </div>

          <div className="rv-form-footer">
            <button type="button" onClick={onClose} className="rv-btn-cancel">
              Abbrechen
            </button>
            <button type="submit" disabled={loading} className="rv-btn-submit">
              {loading ? <Loader size={14} className="rlv-loader-inline" /> : <Plus size={14} />}
              Anlegen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function RuecklastschriftVerwaltung() {
  const { activeDojo } = useDojoContext();
  const navigate = useNavigate();

  const [daten, setDaten] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null); // { msg, type }
  const [showNeuModal, setShowNeuModal] = useState(false);
  const [aktionLoading, setAktionLoading] = useState({}); // id → true
  const [filterStatus, setFilterStatus] = useState(''); // '' = alle

  const dojoId = typeof activeDojo === 'object' ? activeDojo?.id : null;

  const withDojo = (url) => {
    if (!dojoId) return url;
    return `${url}${url.includes('?') ? '&' : '?'}dojo_id=${dojoId}`;
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const laden = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = filterStatus
        ? withDojo(`/api/ruecklastschriften?status=${filterStatus}`)
        : withDojo('/api/ruecklastschriften');
      const resp = await fetchWithAuth(url);
      const data = await resp.json();
      if (!resp.ok) { setError(data.error || 'Fehler'); return; }
      setDaten(data.ruecklastschriften || []);
      setStats(data.stats || {});
    } catch (err) {
      setError('Netzwerkfehler: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [dojoId, filterStatus]);

  useEffect(() => { laden(); }, [laden]);

  // ── Aktionen ──────────────────────────────────────────────────────────────

  const doAktion = async (id, endpoint, method = 'POST', body = null) => {
    setAktionLoading(prev => ({ ...prev, [id]: true }));
    try {
      const resp = await fetchWithAuth(withDojo(`/api/ruecklastschriften/${id}/${endpoint}`), {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await resp.json();
      if (!resp.ok) { showToast(data.error || 'Fehler', 'error'); return false; }
      return data;
    } catch (err) {
      showToast('Netzwerkfehler', 'error');
      return false;
    } finally {
      setAktionLoading(prev => ({ ...prev, [id]: false }));
      await laden();
    }
  };

  const sendMahnung = async (id) => {
    const result = await doAktion(id, 'mahnung');
    if (result) showToast(`${result.stufe} erfolgreich gesendet`);
  };

  const nochmalAbbuchen = async (id) => {
    const result = await doAktion(id, 'nochmal-abbuchen');
    if (result) showToast('Neuer Lastschriftversuch vorbereitet');
  };

  const rechnungStellen = async (id) => {
    if (!window.confirm('Rechnung für Restlaufzeit erstellen? Dies ist erst nach 2 Mahnungen möglich.')) return;
    const result = await doAktion(id, 'rechnung-stellen');
    if (result) showToast('Rechnung erstellt');
  };

  const statusSetzen = async (id, status) => {
    const result = await doAktion(id, 'status', 'PUT', { status });
    if (result) showToast(`Status auf "${status}" gesetzt`);
  };

  const mahnbescheidPdf = async (id) => {
    try {
      const resp = await fetchWithAuth(withDojo(`/api/ruecklastschriften/${id}/mahnbescheid-pdf`));
      if (!resp.ok) {
        const data = await resp.json();
        showToast(data.error || 'PDF Fehler', 'error');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Mahnbescheid-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('Fehler beim PDF-Download', 'error');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const tage = stats.aelteste ? daysSince(stats.aelteste) : null;

  return (
    <div className="rv-page">

      {/* Header */}
      <div className="rv-header-row">
        <div>
          <h1 className="rv-header-title">
            Rücklastschrift-Verwaltung
          </h1>
          <p className="rv-header-sub">
            Mahnungs-Workflow für zurückgegebene Lastschriften
          </p>
        </div>
        <div className="rv-header-actions">
          <button
            onClick={laden}
            className="rv-btn-secondary"
          >
            <RefreshCw size={14} />
            Aktualisieren
          </button>
          <button
            onClick={() => setShowNeuModal(true)}
            className="rv-btn-primary"
          >
            <Plus size={14} />
            Neue Rücklastschrift
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`rlv-toast${toast.type === 'error' ? ' rlv-toast--error' : ' rlv-toast--ok'}`}>
          {toast.msg}
        </div>
      )}

      {/* KPI-Karten */}
      <div className="rv-kpi-grid">
        {[
          { label: 'Offen / In Bearbeitung', value: stats.offen ?? '—', color: 'var(--error)' },
          { label: 'Offener Betrag', value: formatBetrag(stats.offener_betrag), color: 'var(--warning)' },
          { label: 'Gesamt erfasst', value: stats.gesamt ?? '—', color: 'var(--text-muted)' },
          { label: 'Älteste Forderung', value: tage !== null ? `${tage} Tage` : '—', color: tage > 30 ? '#ef4444' : '#6b7280' },
        ].map(kpi => (
          <div key={kpi.label} className="rv-kpi-card">
            <div className="rv-kpi-label">{kpi.label}</div>
            <div className="rlv-kpi-value" style={{ '--kpi-color': kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="rv-filter-bar">
        {[
          { key: '', label: 'Alle' },
          { key: 'offen', label: 'Offen' },
          { key: 'in_bearbeitung', label: 'In Bearbeitung' },
          { key: 'erledigt', label: 'Erledigt' },
          { key: 'storniert', label: 'Storniert' },
        ].map(f => (
          <button
            key={f.key}
            className={`rlv-filter-btn${filterStatus === f.key ? ' rlv-filter-btn--active' : ''}`}
            onClick={() => setFilterStatus(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Fehler */}
      {error && (
        <div className="rv-error-banner">
          {error}
        </div>
      )}

      {/* Tabelle */}
      {loading ? (
        <div className="rv-center-state">
          <Loader size={24} className="rlv-loader-center" />
          <div>Lade Rücklastschriften…</div>
        </div>
      ) : daten.length === 0 ? (
        <div className="rv-center-state">
          <AlertTriangle size={40} className="rlv-empty-icon" />
          <div className="rv-center-state-title">Keine Rücklastschriften gefunden</div>
          <div className="rv-center-state-sub">Lege eine neue an oder ändere den Filter</div>
        </div>
      ) : (
        <div className="rv-table-wrapper">
          <table className="rv-table">
            <thead>
              <tr className="rv-thead-row">
                {['Mitglied', 'Datum', 'Betrag', 'Mahnstufe', 'Status', 'Massnahme / Aktionen'].map(h => (
                  <th key={h} className="rv-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daten.map(rls => {
                const loading = aktionLoading[rls.id];
                const kannMahnungSenden = rls.status !== 'erledigt' && rls.status !== 'storniert' && !rls.mahnbescheid_datum;
                const kannMahnbescheid = !!rls.mahnung_2_datum;
                const kannRechnung = !!rls.mahnung_2_datum && rls.mitglied_id;

                return (
                  <tr
                    key={rls.id}
                    className="rv-tr"
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.03))'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Mitglied */}
                    <td className="rv-td">
                      {rls.vorname ? (
                        <div>
                          <div className="rv-member-name">
                            {rls.vorname} {rls.nachname}
                          </div>
                          <div className="rv-text-muted-sm">
                            {rls.email} · #{rls.mitgliedsnummer || rls.mitglied_id}
                          </div>
                        </div>
                      ) : (
                        <span className="rv-member-unassigned">Kein Mitglied zugewiesen</span>
                      )}
                    </td>

                    {/* Datum */}
                    <td className="rv-td-date">
                      {formatDate(rls.erstellt_am)}
                      {rls.rueckgabe_code && (
                        <div className="rv-text-muted-date">
                          Code: {rls.rueckgabe_code}
                        </div>
                      )}
                    </td>

                    {/* Betrag */}
                    <td className="rv-td-amount">
                      {formatBetrag(rls.betrag)}
                    </td>

                    {/* Mahnstufe */}
                    <td className="rv-td">
                      <MahnstufeBadge mahnstufe={rls.mahnstufe} />
                      <div className="rv-text-muted-xs">
                        {rls.mahnung_1_datum && <div>M1: {formatDate(rls.mahnung_1_datum)}</div>}
                        {rls.mahnung_2_datum && <div>M2: {formatDate(rls.mahnung_2_datum)}</div>}
                        {rls.mahnbescheid_datum && <div>MB: {formatDate(rls.mahnbescheid_datum)}</div>}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="rv-td">
                      <StatusBadge status={rls.status} />
                    </td>

                    {/* Aktionen */}
                    <td className="rv-td">
                      <div className="rv-action-row">

                        {/* Mahnung senden */}
                        {kannMahnungSenden && (
                          <button
                            onClick={() => sendMahnung(rls.id)}
                            disabled={loading}
                            title={`${!rls.mahnung_1_datum ? 'Mahnung 1' : 'Mahnung 2'} senden`}
                            className="rv-action-btn rv-action-btn-warning"
                          >
                            <Mail size={12} />
                            {!rls.mahnung_1_datum ? 'Mahnung 1' : 'Mahnung 2'}
                          </button>
                        )}

                        {/* Nochmal abbuchen */}
                        {(rls.status === 'offen' || rls.status === 'in_bearbeitung') && rls.mitglied_id && (
                          <button
                            onClick={() => nochmalAbbuchen(rls.id)}
                            disabled={loading}
                            title="Neuen Lastschriftversuch vorbereiten"
                            className="rv-action-btn rv-action-btn-info"
                          >
                            <RotateCcw size={12} />
                            Nochmal abbuchen
                          </button>
                        )}

                        {/* Rechnung stellen (nur nach 2 Mahnungen) */}
                        {kannRechnung && (
                          <button
                            onClick={() => rechnungStellen(rls.id)}
                            disabled={loading}
                            title="Rechnung für Restlaufzeit erstellen"
                            className="rv-action-btn rv-action-btn-success"
                          >
                            <Receipt size={12} />
                            Rechnung stellen
                          </button>
                        )}

                        {/* Mahnbescheid PDF (nur nach 2 Mahnungen) */}
                        {kannMahnbescheid && (
                          <button
                            onClick={() => mahnbescheidPdf(rls.id)}
                            disabled={loading}
                            title="Formelles Inkassoschreiben als PDF herunterladen"
                            className="rv-action-btn rv-action-btn-purple"
                          >
                            <Download size={12} />
                            Mahnbescheid PDF
                          </button>
                        )}

                        {/* Erledigt */}
                        {(rls.status === 'offen' || rls.status === 'in_bearbeitung') && (
                          <button
                            onClick={() => statusSetzen(rls.id, 'erledigt')}
                            disabled={loading}
                            title="Als erledigt markieren (Zahlung eingegangen)"
                            className="rv-action-btn rv-action-btn-success"
                          >
                            <Check size={12} />
                            Erledigt
                          </button>
                        )}

                        {/* Abschreiben */}
                        {(rls.status === 'offen' || rls.status === 'in_bearbeitung') && (
                          <button
                            onClick={() => statusSetzen(rls.id, 'storniert')}
                            disabled={loading}
                            title="Abschreiben (uneinbringlich)"
                            className="rv-action-btn rv-action-btn-muted"
                          >
                            <X size={12} />
                            Abschreiben
                          </button>
                        )}

                        {loading && (
                          <Loader size={14} className="rlv-loader-action" />
                        )}
                      </div>

                      {/* Beschreibung */}
                      {rls.beschreibung && (
                        <div className="rv-desc-cell" title={rls.beschreibung}>
                          {rls.beschreibung}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Neu-Modal */}
      {showNeuModal && (
        <NeuAnlegenModal
          dojoId={dojoId}
          onClose={() => setShowNeuModal(false)}
          onCreated={laden}
        />
      )}

      {/* Spin-Animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
