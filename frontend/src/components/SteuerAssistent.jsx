/**
 * SteuerAssistent
 * ===============
 * Steuerlicher Assistent für Dojosoftware:
 *  - Tab 1: Umsatzsteuer-Voranmeldung (UStVA)
 *  - Tab 2: EÜR — Jahresabschluss
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  FileText,
  Download,
  Calculator,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle,
  AlertCircle,
  X,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ExternalLink
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';
import config from '../config/config';
import { fetchWithAuth } from '../utils/fetchWithAuth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmtEur = (val) => {
  const num = parseFloat(val) || 0;
  return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

const MONATE = [
  { val: 1, label: 'Januar' },
  { val: 2, label: 'Februar' },
  { val: 3, label: 'März' },
  { val: 4, label: 'April' },
  { val: 5, label: 'Mai' },
  { val: 6, label: 'Juni' },
  { val: 7, label: 'Juli' },
  { val: 8, label: 'August' },
  { val: 9, label: 'September' },
  { val: 10, label: 'Oktober' },
  { val: 11, label: 'November' },
  { val: 12, label: 'Dezember' },
];

const QUARTALE = [
  { val: 1, label: 'Q1 (Jan–März)' },
  { val: 2, label: 'Q2 (Apr–Jun)' },
  { val: 3, label: 'Q3 (Jul–Sep)' },
  { val: 4, label: 'Q4 (Okt–Dez)' },
];

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const card = {
  background: 'var(--bg-card)',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 10,
  padding: '20px 24px',
  marginBottom: 20,
};

const btnPrimary = {
  background: 'var(--gradient-gold, linear-gradient(135deg,#ffd700,#ffb700))',
  color: '#000',
  border: 'none',
  borderRadius: 8,
  padding: '10px 20px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
};

const btnSecondary = {
  background: 'var(--bg-secondary, rgba(255,255,255,.07))',
  color: 'var(--text-primary)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 8,
  padding: '10px 20px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
};

const selectStyle = {
  background: 'var(--bg-secondary, rgba(255,255,255,.07))',
  color: 'var(--text-primary)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  minWidth: 140,
};

const labelStyle = {
  fontSize: 12,
  color: 'var(--text-muted)',
  marginBottom: 4,
  display: 'block',
};

// ---------------------------------------------------------------------------
// ElsterManualModal
// ---------------------------------------------------------------------------
const ElsterManualModal = ({ kzData, onClose }) => (
  <div
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
    onClick={onClose}
  >
    <div
      style={{ ...card, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto', marginBottom: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Manuell in ELSTER eingeben</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <X size={20} />
        </button>
      </div>
      <ol style={{ color: 'var(--text-primary)', lineHeight: 1.8, paddingLeft: 20 }}>
        <li>Öffnen Sie <strong>mein.elster.de</strong></li>
        <li>Navigieren Sie zu <strong>Formulare &amp; Leistungen → Formulare</strong></li>
        <li>Wählen Sie <strong>Umsatzsteuer-Voranmeldung</strong></li>
        <li>Geben Sie folgende Kennziffern ein:</li>
      </ol>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)' }}>Kz</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)' }}>Bezeichnung</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)' }}>Betrag</th>
          </tr>
        </thead>
        <tbody>
          {kzData.filter(r => parseFloat(r.betrag) !== 0).map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--gradient-gold,#ffd700)' }}>{row.kz}</td>
              <td style={{ padding: '8px 12px', fontSize: 13 }}>{row.bezeichnung}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtEur(row.betrag)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <a
          href="https://mein.elster.de"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...btnPrimary, textDecoration: 'none' }}
        >
          <ExternalLink size={14} /> mein.elster.de öffnen
        </a>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// UStVA Tab
// ---------------------------------------------------------------------------
export const UStVATab = ({ dojoId }) => {
  const [jahr, setJahr] = useState(currentYear);
  const [zeitraumArt, setZeitraumArt] = useState('monatlich');
  const [zeitraum, setZeitraum] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showElsterModal, setShowElsterModal] = useState(false);
  const [xmlLoading, setXmlLoading] = useState(false);
  const [einreichenLoading, setEinreichenLoading] = useState(false);
  const [filingHistory, setFilingHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleBerechnen = useCallback(async () => {
    if (!dojoId) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({
        dojo_id: dojoId,
        jahr,
        zeitraum_art: zeitraumArt,
        zeitraum,
      });
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/ustVA?${params}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Serverfehler ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dojoId, jahr, zeitraumArt, zeitraum]);

  const handleXmlDownload = useCallback(async () => {
    if (!dojoId) return;
    setXmlLoading(true);
    try {
      const params = new URLSearchParams({
        dojo_id: dojoId,
        jahr,
        zeitraum_art: zeitraumArt,
        zeitraum,
      });
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/ustVA/xml?${params}`);
      if (!res.ok) throw new Error(`Serverfehler ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `UStVA_${jahr}_${zeitraumArt === 'monatlich' ? 'M' + String(zeitraum).padStart(2, '0') : 'Q' + zeitraum}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('XML-Download fehlgeschlagen: ' + err.message);
    } finally {
      setXmlLoading(false);
    }
  }, [dojoId, jahr, zeitraumArt, zeitraum]);

  const loadFilingHistory = useCallback(async () => {
    if (!dojoId) return;
    setHistoryLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/ustVA/abgaben?dojo_id=${dojoId}&jahr=${jahr}`);
      if (res.ok) setFilingHistory((await res.json()).abgaben || []);
    } catch (_) {}
    setHistoryLoading(false);
  }, [dojoId, jahr]);

  const handleEinreichen = useCallback(async () => {
    if (!data) return;
    setEinreichenLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/ustVA/einreichen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dojo_id: dojoId, jahr, zeitraum_art: zeitraumArt, zeitraum }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Fehler');
      alert('Meldung wurde als eingereicht markiert.');
      loadFilingHistory();
    } catch (err) {
      alert('Fehler: ' + err.message);
    } finally {
      setEinreichenLoading(false);
    }
  }, [data, dojoId, jahr, zeitraumArt, zeitraum, loadFilingHistory]);

  const handleKorrektur = useCallback(async (abgabeId) => {
    if (!window.confirm('Korrekturantrag für diese Meldung erstellen?')) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/ustVA/korrektur`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dojo_id: dojoId, korrektur_zu_id: abgabeId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Fehler');
      alert('Korrekturantrag erstellt. XML kann jetzt heruntergeladen werden.');
      loadFilingHistory();
    } catch (err) {
      alert('Fehler: ' + err.message);
    }
  }, [dojoId, loadFilingHistory]);

  const handleKorrekturXml = useCallback(async (abgabeId, dateiname) => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/ustVA/korrektur/xml?dojo_id=${dojoId}&abgabe_id=${abgabeId}`);
      if (!res.ok) throw new Error('Fehler beim Download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dateiname || `UStVA_Korrektur_${abgabeId}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download fehlgeschlagen: ' + err.message);
    }
  }, [dojoId]);

  // Build Kennziffern table from API data or empty defaults
  const kz = data?.kennziffern ?? {};
  const kzRows = data ? [
    { kz: '81', bezeichnung: 'Umsätze 19% (Netto)', betrag: kz.Kz81 ?? 0, bold: false },
    { kz: '35', bezeichnung: 'Steuer 19%', betrag: kz.Kz35 ?? 0, bold: false },
    { kz: '86', bezeichnung: 'Umsätze 7% (Netto)', betrag: kz.Kz86 ?? 0, bold: false },
    { kz: '36', bezeichnung: 'Steuer 7%', betrag: kz.Kz36 ?? 0, bold: false },
    { kz: '—', bezeichnung: 'Steuerfreie Umsätze', betrag: kz.Kz_steuerfreie ?? 0, bold: false },
    { kz: '66', bezeichnung: 'Abziehbare Vorsteuer', betrag: kz.Kz66 ?? 0, bold: false },
    { kz: '—', bezeichnung: 'Gesamt-Umsatzsteuer', betrag: kz.gesamtsteuer ?? 0, bold: true },
    { kz: '—', bezeichnung: 'Zahllast / Erstattung', betrag: kz.zahllast ?? 0, bold: true, colored: true },
  ] : [];

  const zahllast = kz.zahllast ?? 0;
  const istKleinunternehmer = data?.dojo?.ist_kleinunternehmer;

  return (
    <div>
      {/* Controls */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle}>Jahr</label>
          <select style={selectStyle} value={jahr} onChange={e => setJahr(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Zeitraum-Art</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {['monatlich', 'vierteljährlich'].map(art => (
              <button
                key={art}
                onClick={() => { setZeitraumArt(art); setZeitraum(art === 'monatlich' ? 1 : 1); }}
                style={{
                  ...btnSecondary,
                  background: zeitraumArt === art ? 'var(--gradient-gold,linear-gradient(135deg,#ffd700,#ffb700))' : undefined,
                  color: zeitraumArt === art ? '#000' : undefined,
                  fontWeight: zeitraumArt === art ? 700 : 600,
                  padding: '8px 14px',
                }}
              >
                {art === 'monatlich' ? 'Monatlich' : 'Vierteljährlich'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Zeitraum</label>
          <select
            style={selectStyle}
            value={zeitraum}
            onChange={e => setZeitraum(Number(e.target.value))}
          >
            {zeitraumArt === 'monatlich'
              ? MONATE.map(m => <option key={m.val} value={m.val}>{m.label}</option>)
              : QUARTALE.map(q => <option key={q.val} value={q.val}>{q.label}</option>)
            }
          </select>
        </div>
        <button style={btnPrimary} onClick={handleBerechnen} disabled={loading}>
          <Calculator size={16} />
          {loading ? 'Berechne…' : 'Berechnen'}
        </button>
      </div>

      {error && (
        <div style={{ ...card, background: 'rgba(239,68,68,.1)', borderColor: '#ef4444', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ color: '#ef4444' }}>{error}</span>
        </div>
      )}

      {data && (
        <>
          {/* Kleinunternehmer Hinweis */}
          {istKleinunternehmer && (
            <div style={{ ...card, background: 'rgba(16,185,129,.1)', borderColor: '#10b981', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <CheckCircle size={18} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ color: '#10b981' }}>Kleinunternehmerregelung (§19 UStG) — Keine Umsatzsteuer-Voranmeldung erforderlich.</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                  Sie müssen keine UStVA abgeben, solange Ihr Jahresumsatz unter der Grenze bleibt. Der XML-Download steht für eine freiwillige Abgabe oder das erste Jahr zur Verfügung.
                </div>
              </div>
            </div>
          )}

          {/* Kennziffern-Tabelle */}
          <div style={card}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Kennziffern-Übersicht</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255,255,255,.1)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', width: 50 }}>Kz</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Bezeichnung</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', width: 150 }}>Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {kzRows.map((row, i) => {
                    const isZahllast = row.colored;
                    const amtColor = isZahllast
                      ? (zahllast > 0 ? '#ef4444' : zahllast < 0 ? '#10b981' : 'var(--text-primary)')
                      : 'var(--text-primary)';
                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,.04)',
                          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)',
                          ...(row.bold ? { borderTop: '1px solid rgba(255,255,255,.1)' } : {}),
                        }}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13, color: 'var(--gradient-gold,#ffd700)' }}>{row.kz}</td>
                        <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: row.bold ? 700 : 400 }}>{row.bezeichnung}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: row.bold ? 700 : 400, color: amtColor }}>
                          {fmtEur(row.betrag)}
                          {isZahllast && zahllast > 0 && <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.7 }}>(Zahlung)</span>}
                          {isZahllast && zahllast < 0 && <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.7 }}>(Erstattung)</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <button style={btnPrimary} onClick={handleXmlDownload} disabled={xmlLoading}>
              <Download size={16} />
              {xmlLoading ? 'Wird erstellt…' : 'ELSTER XML herunterladen'}
            </button>
            <button style={btnSecondary} onClick={() => setShowElsterModal(true)}>
              <FileText size={16} />
              Manuell in ELSTER eingeben
            </button>
            <button
              style={{ ...btnSecondary, borderColor: '#10b981', color: '#10b981' }}
              onClick={handleEinreichen}
              disabled={einreichenLoading}
            >
              <CheckCircle size={16} />
              {einreichenLoading ? 'Wird gespeichert…' : 'Als eingereicht markieren'}
            </button>
            <button style={btnSecondary} onClick={loadFilingHistory} disabled={historyLoading} title="Einreichungshistorie laden">
              <FileText size={14} />
              {historyLoading ? '…' : 'Eingabe-Historie'}
            </button>
          </div>

          {/* Einreichungshistorie */}
          {filingHistory.length > 0 && (
            <div style={{ ...card, marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Einreichungshistorie {jahr}
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)' }}>Zeitraum</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)' }}>Zahllast</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)' }}>Eingereicht am</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)' }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {filingHistory.map((row, i) => {
                    const zeitraumLabel = row.zeitraum_art === 'monatlich'
                      ? ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][row.zeitraum_nr - 1]
                      : `Q${row.zeitraum_nr}`;
                    const statusColor = row.abgabe_status === 'korrektur' ? '#f59e0b' : '#10b981';
                    return (
                      <tr key={row.abgabe_id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                        <td style={{ padding: '8px 8px' }}>{zeitraumLabel} {row.jahr}{row.ist_korrektur ? ' (Korrektur)' : ''}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', color: row.zahllast > 0 ? '#ef4444' : '#10b981' }}>{fmtEur(row.zahllast)}</td>
                        <td style={{ padding: '8px 8px' }}><span style={{ background: statusColor + '22', color: statusColor, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{row.abgabe_status}</span></td>
                        <td style={{ padding: '8px 8px', color: 'var(--text-muted)' }}>{row.eingereicht_am ? new Date(row.eingereicht_am).toLocaleDateString('de-DE') : '—'}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                          {row.ist_korrektur ? (
                            <button style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12 }} onClick={() => handleKorrekturXml(row.abgabe_id, row.xml_dateiname)}>
                              <Download size={12} /> XML
                            </button>
                          ) : (
                            <button style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12, borderColor: '#f59e0b', color: '#f59e0b' }} onClick={() => handleKorrektur(row.abgabe_id)}>
                              Korrektur
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Details — collapsible */}
          {data.details && data.details.length > 0 && (
            <div style={card}>
              <button
                onClick={() => setShowDetails(v => !v)}
                style={{ ...btnSecondary, width: '100%', justifyContent: 'space-between' }}
              >
                <span>Einzelbuchungen anzeigen ({data.details.length})</span>
                {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showDetails && (
                <div style={{ marginTop: 16 }}>
                  {['19%', '7%', 'steuerfrei', 'vorsteuer'].map(gruppe => {
                    const rows = data.details.filter(d => d.gruppe === gruppe);
                    if (!rows.length) return null;
                    const gruppenLabels = {
                      '19%': 'Einnahmen 19% MwSt',
                      '7%': 'Einnahmen 7% MwSt',
                      steuerfrei: 'Steuerfreie Einnahmen',
                      vorsteuer: 'Vorsteuer (Ausgaben)',
                    };
                    return (
                      <div key={gruppe} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                          {gruppenLabels[gruppe]}
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Datum</th>
                              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Beschreibung</th>
                              <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Betrag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                                <td style={{ padding: '6px 8px', fontSize: 13 }}>{r.datum ? new Date(r.datum).toLocaleDateString('de-DE') : '—'}</td>
                                <td style={{ padding: '6px 8px', fontSize: 13 }}>{r.beschreibung || '—'}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{fmtEur(r.betrag)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ELSTER Manual Modal */}
      {showElsterModal && data && (
        <ElsterManualModal kzData={kzRows} onClose={() => setShowElsterModal(false)} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// EÜR Tab
// ---------------------------------------------------------------------------
const EuerTab = ({ dojoId }) => {
  const [jahr, setJahr] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [xmlLoading, setXmlLoading] = useState(false);

  const handleLaden = useCallback(async () => {
    if (!dojoId) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/euer/dojo/${dojoId}?jahr=${jahr}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Serverfehler ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dojoId, jahr]);

  const handlePdfDownload = useCallback(async () => {
    if (!dojoId) return;
    setPdfLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/euer/pdf/dojo/${dojoId}?jahr=${jahr}`);
      if (!res.ok) throw new Error(`Serverfehler ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EÜR_${jahr}_Dojo_${dojoId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF-Download fehlgeschlagen: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  }, [dojoId, jahr]);

  const handleXmlDownload = useCallback(async () => {
    if (!dojoId) return;
    setXmlLoading(true);
    try {
      const params = new URLSearchParams({ dojo_id: dojoId, jahr });
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/euer/xml?${params}`);
      if (res.status === 404) {
        alert('EÜR ELSTER XML ist noch nicht verfügbar (coming soon).');
        return;
      }
      if (!res.ok) throw new Error(`Serverfehler ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EÜR_ELSTER_${jahr}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('XML-Download fehlgeschlagen: ' + err.message);
    } finally {
      setXmlLoading(false);
    }
  }, [dojoId, jahr]);

  // Derive totals and monthly breakdown from API data
  const summary = data ? {
    einnahmen: data.zusammenfassung?.gesamtEinnahmen ?? 0,
    ausgaben: data.zusammenfassung?.gesamtAusgaben ?? 0,
    ueberschuss: data.zusammenfassung?.ueberschuss ?? 0,
    mwstZahllast: data.zusammenfassung?.mwstZahllast ?? 0,
  } : null;

  const monate = data?.monate ?? [];

  return (
    <div>
      {/* Controls */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle}>Jahr</label>
          <select style={selectStyle} value={jahr} onChange={e => setJahr(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button style={btnPrimary} onClick={handleLaden} disabled={loading}>
          <Calendar size={16} />
          {loading ? 'Lade…' : 'Laden'}
        </button>
      </div>

      {error && (
        <div style={{ ...card, background: 'rgba(239,68,68,.1)', borderColor: '#ef4444', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ color: '#ef4444' }}>{error}</span>
        </div>
      )}

      {data && summary && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Gesamteinnahmen', value: summary.einnahmen, icon: TrendingUp, color: '#10b981' },
              { label: 'Gesamtausgaben', value: summary.ausgaben, icon: TrendingDown, color: '#ef4444' },
              { label: 'Überschuss / Verlust', value: summary.ueberschuss, icon: DollarSign, color: summary.ueberschuss >= 0 ? '#ffd700' : '#ef4444' },
              { label: 'MwSt-Zahllast Gesamt', value: summary.mwstZahllast, icon: Calculator, color: '#3b82f6' },
            ].map((item, i) => (
              <div key={i} style={{ ...card, marginBottom: 0, borderLeft: `3px solid ${item.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: item.color, fontFamily: 'monospace' }}>{fmtEur(item.value)}</div>
                  </div>
                  <item.icon size={22} color={item.color} style={{ opacity: 0.6 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Monthly Table */}
          {monate.length > 0 && (
            <div style={card}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Monatsübersicht {jahr}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(255,255,255,.1)' }}>
                      {['Monat', 'Einnahmen', 'Ausgaben', 'Überschuss', 'MwSt'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Monat' ? 'left' : 'right', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monate.map((m, i) => {
                      const ueber = (m.einnahmen ?? 0) - (m.ausgaben ?? 0);
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                          <td style={{ padding: '10px 12px', fontSize: 14 }}>{MONATE.find(mo => mo.val === m.monat)?.label ?? m.monat}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: '#10b981' }}>{fmtEur(m.einnahmen)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: '#ef4444' }}>{fmtEur(m.ausgaben)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: ueber >= 0 ? '#ffd700' : '#ef4444', fontWeight: 600 }}>{fmtEur(ueber)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{fmtEur(m.mwst ?? 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 14 }}>Gesamt</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#10b981' }}>{fmtEur(summary.einnahmen)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#ef4444' }}>{fmtEur(summary.ausgaben)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: summary.ueberschuss >= 0 ? '#ffd700' : '#ef4444' }}>{fmtEur(summary.ueberschuss)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtEur(summary.mwstZahllast)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <button style={btnPrimary} onClick={handlePdfDownload} disabled={pdfLoading}>
              <FileText size={16} />
              {pdfLoading ? 'Wird erstellt…' : 'EÜR als PDF herunterladen'}
            </button>
            <button style={btnSecondary} onClick={handleXmlDownload} disabled={xmlLoading}>
              <Download size={16} />
              {xmlLoading ? 'Bitte warten…' : 'EÜR ELSTER XML'}
            </button>
            <a href="/dashboard/datev-export" style={{ ...btnSecondary, textDecoration: 'none' }}>
              <ExternalLink size={16} />
              DATEV Export
            </a>
          </div>

          {/* Hinweis Box */}
          <div style={{ ...card, background: 'rgba(59,130,246,.08)', borderColor: 'rgba(59,130,246,.3)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Info size={18} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Für Ihren Jahresabschluss:</strong> Leiten Sie dieses Dokument an Ihren Steuerberater weiter.
              Die <strong>DATEV-Export-Funktion</strong> ermöglicht den direkten Import in Steuerkanzlei-Software.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Gewerbesteuer Tab
// ---------------------------------------------------------------------------
const GewerbesteuerTab = ({ dojoId }) => {
  const [einstellungen, setEinstellungen] = useState({
    hebesatz: 400,
    gemeinde: '',
    gewerbesteuerpflichtig: true,
    hinzurechnungen_miete: 0,
    hinzurechnungen_leasing: 0,
    hinzurechnungen_zinsen: 0,
    kuerzungen_grundbesitz: 0,
  });
  const [einstellungenLoading, setEinstellungenLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [berechnung, setBerechnung] = useState(null);
  const [berechnungLoading, setBerechnungLoading] = useState(false);
  const [jahr, setJahr] = useState(currentYear);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadEinstellungen = useCallback(async () => {
    if (!dojoId) return;
    setEinstellungenLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/gewerbesteuer/einstellungen?dojo_id=${dojoId}`);
      if (res.ok) {
        const json = await res.json();
        setEinstellungen(prev => ({ ...prev, ...json }));
      }
    } catch (_) {}
    finally { setEinstellungenLoading(false); }
  }, [dojoId]);

  useEffect(() => { loadEinstellungen(); }, [loadEinstellungen]);

  const saveEinstellungen = async () => {
    if (!dojoId) return;
    setSaveLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/gewerbesteuer/einstellungen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dojo_id: dojoId, ...einstellungen }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Fehler ${res.status}`);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const berechnen = async () => {
    if (!dojoId) return;
    setBerechnungLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/gewerbesteuer/berechnung?dojo_id=${dojoId}&jahr=${jahr}`);
      if (!res.ok) throw new Error((await res.json()).error || `Fehler ${res.status}`);
      setBerechnung(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setBerechnungLoading(false);
    }
  };

  const upd = (field, value) => setEinstellungen(prev => ({ ...prev, [field]: value }));

  const numInput = (field, label, unit = '€') => (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          step="0.01"
          min="0"
          value={einstellungen[field] || 0}
          onChange={e => upd(field, parseFloat(e.target.value) || 0)}
          style={{ ...selectStyle, minWidth: 120 }}
        />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{unit}</span>
      </div>
    </div>
  );

  const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 14 };

  return (
    <div>
      {error && (
        <div style={{ ...card, background: 'rgba(239,68,68,.1)', borderColor: '#ef4444', color: '#ef4444', display: 'flex', gap: 10 }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}
      {saveSuccess && (
        <div style={{ ...card, background: 'rgba(16,185,129,.1)', borderColor: '#10b981', color: '#10b981', display: 'flex', gap: 10 }}>
          <CheckCircle size={16} style={{ flexShrink: 0 }} /> Einstellungen gespeichert.
        </div>
      )}

      {/* Hinweis Gemeinnützigkeit */}
      <div style={{ ...card, background: 'rgba(59,130,246,.08)', borderColor: 'rgba(59,130,246,.3)', display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
        <Info size={18} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Hinweis:</strong> Keine Gewerbesteuer bei gemeinnützigen Vereinen (§3 GewStG). Für eingetragene Vereine mit gemeinnützigem Status entfällt die Gewerbesteuerpflicht.
        </div>
      </div>

      {/* Einstellungen */}
      <div style={{ ...card, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: 16 }}>Einstellungen</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Gemeinde</label>
            <input
              value={einstellungen.gemeinde || ''}
              onChange={e => upd('gemeinde', e.target.value)}
              placeholder="z.B. München"
              style={{ ...selectStyle, width: '100%' }}
            />
          </div>
          {numInput('hebesatz', 'Hebesatz', '%')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 16 }}>
            <input
              type="checkbox"
              id="gst-pflichtig"
              checked={!!einstellungen.gewerbesteuerpflichtig}
              onChange={e => upd('gewerbesteuerpflichtig', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="gst-pflichtig" style={{ fontSize: 14, cursor: 'pointer', color: 'var(--text-primary)' }}>Gewerbesteuerpflichtig</label>
          </div>
        </div>

        <h4 style={{ margin: '20px 0 12px 0', fontSize: 14, color: 'var(--text-muted)' }}>Hinzurechnungen (§ 8 GewStG)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
          {numInput('hinzurechnungen_miete', 'Miete / Pacht')}
          {numInput('hinzurechnungen_leasing', 'Leasing')}
          {numInput('hinzurechnungen_zinsen', 'Zinsen')}
        </div>

        <h4 style={{ margin: '20px 0 12px 0', fontSize: 14, color: 'var(--text-muted)' }}>Kürzungen (§ 9 GewStG)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          {numInput('kuerzungen_grundbesitz', 'Grundbesitz-Kürzung')}
        </div>

        <button style={btnPrimary} onClick={saveEinstellungen} disabled={saveLoading || !dojoId}>
          {saveLoading ? 'Speichere...' : 'Einstellungen speichern'}
        </button>
      </div>

      {/* Berechnung */}
      <div style={card}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Jahr</label>
            <select style={selectStyle} value={jahr} onChange={e => setJahr(Number(e.target.value))}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button style={btnPrimary} onClick={berechnen} disabled={berechnungLoading || !dojoId}>
            <Calculator size={16} />
            {berechnungLoading ? 'Berechne...' : 'Berechnen'}
          </button>
        </div>

        {berechnung && (
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Gewerbesteuerberechnung {jahr}</h3>
            <div style={{ maxWidth: 480 }}>
              <div style={rowStyle}>
                <span>EBIT (Gewerbeertrag roh)</span>
                <span style={{ fontFamily: 'monospace' }}>{fmtEur(berechnung.ebit)}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ color: '#10b981' }}>+ Hinzurechnungen</span>
                <span style={{ fontFamily: 'monospace', color: '#10b981' }}>+{fmtEur(berechnung.hinzurechnungen_gesamt)}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ color: '#ef4444' }}>− Kürzungen</span>
                <span style={{ fontFamily: 'monospace', color: '#ef4444' }}>−{fmtEur(berechnung.kuerzungen_gesamt)}</span>
              </div>
              <div style={{ ...rowStyle, fontWeight: 600 }}>
                <span>= Gewerbeertrag nach Kürzungen</span>
                <span style={{ fontFamily: 'monospace' }}>{fmtEur(berechnung.gewerbeertrag_nach_kuerzungen)}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ color: '#ef4444' }}>− Freibetrag</span>
                <span style={{ fontFamily: 'monospace', color: '#ef4444' }}>−{fmtEur(berechnung.freibetrag ?? 24500)}</span>
              </div>
              <div style={rowStyle}>
                <span>= Steuermessbetrag (× 3,5%)</span>
                <span style={{ fontFamily: 'monospace' }}>{fmtEur(berechnung.steuermessbetrag)}</span>
              </div>
              <div style={rowStyle}>
                <span>× Hebesatz ({einstellungen.hebesatz}%)</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{einstellungen.hebesatz}%</span>
              </div>
              <div style={{ ...rowStyle, borderBottom: 'none', paddingTop: 14, marginTop: 6, borderTop: '2px solid rgba(255,255,255,.12)' }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>= Gewerbesteuer</span>
                <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: parseFloat(berechnung.gewerbesteuer || 0) > 0 ? '#ef4444' : '#10b981' }}>
                  {fmtEur(berechnung.gewerbesteuer)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ZM Tab (Zusammenfassende Meldung)
// ---------------------------------------------------------------------------
const ZMTab = ({ dojoId }) => {
  const [jahr, setJahr] = useState(currentYear);
  const [meldungen, setMeldungen] = useState([]);
  const [meldungenLoading, setMeldungenLoading] = useState(false);
  const [showNeueForm, setShowNeueForm] = useState(false);
  const [einreichenLoading, setEinreichenLoading] = useState({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [neueZM, setNeueZM] = useState({
    jahr: currentYear,
    quartal: 1,
    kunden: [],
  });
  const [neuerKunde, setNeuerKunde] = useState({ ust_id: '', land: '', betrag: '', art: 'lieferung' });

  const loadMeldungen = useCallback(async () => {
    if (!dojoId) return;
    setMeldungenLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/zm?dojo_id=${dojoId}&jahr=${jahr}`);
      if (res.ok) setMeldungen((await res.json()).meldungen || []);
    } catch (_) {}
    finally { setMeldungenLoading(false); }
  }, [dojoId, jahr]);

  useEffect(() => { loadMeldungen(); }, [loadMeldungen]);

  const saveZM = async () => {
    if (!dojoId) return;
    setSaveLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/zm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dojo_id: dojoId, ...neueZM }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Fehler ${res.status}`);
      setSuccess('ZM gespeichert.');
      setShowNeueForm(false);
      setNeueZM({ jahr: currentYear, quartal: 1, kunden: [] });
      loadMeldungen();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const einreichen = async (id) => {
    setEinreichenLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/steuer/zm/${id}/einreichen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dojo_id: dojoId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Fehler ${res.status}`);
      setSuccess('Als eingereicht markiert.');
      loadMeldungen();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setEinreichenLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const addKunde = () => {
    if (!neuerKunde.ust_id || !neuerKunde.betrag) return;
    setNeueZM(prev => ({ ...prev, kunden: [...prev.kunden, { ...neuerKunde }] }));
    setNeuerKunde({ ust_id: '', land: '', betrag: '', art: 'lieferung' });
  };

  const removeKunde = (i) => {
    setNeueZM(prev => ({ ...prev, kunden: prev.kunden.filter((_, idx) => idx !== i) }));
  };

  const statusBadge = (status) => {
    const map = {
      entwurf: { label: 'Entwurf', color: 'var(--text-muted)' },
      gespeichert: { label: 'Gespeichert', color: '#3b82f6' },
      eingereicht: { label: 'Eingereicht', color: '#10b981' },
    };
    const b = map[status] || map.entwurf;
    return <span style={{ background: b.color + '22', color: b.color, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{b.label}</span>;
  };

  return (
    <div>
      {/* Hinweis */}
      <div style={{ ...card, background: 'rgba(59,130,246,.08)', borderColor: 'rgba(59,130,246,.3)', display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
        <Info size={18} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Zusammenfassende Meldung (ZM)</strong> gem. §18a UStG — nur bei EU-B2B-Umsätzen (innergemeinschaftliche Lieferungen und sonstige Leistungen an andere EU-Unternehmer) erforderlich. Abgabe monatlich oder quartalsweise beim Bundeszentralamt für Steuern (BZSt).
        </div>
      </div>

      {error && (
        <div style={{ ...card, background: 'rgba(239,68,68,.1)', borderColor: '#ef4444', color: '#ef4444', display: 'flex', gap: 10, marginBottom: 16 }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', marginLeft: 'auto' }}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div style={{ ...card, background: 'rgba(16,185,129,.1)', borderColor: '#10b981', color: '#10b981', display: 'flex', gap: 10, marginBottom: 16 }}>
          <CheckCircle size={16} style={{ flexShrink: 0 }} /> {success}
        </div>
      )}

      {/* Controls */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Jahr</label>
          <select style={selectStyle} value={jahr} onChange={e => setJahr(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button style={btnPrimary} onClick={() => setShowNeueForm(true)}>
          <Calendar size={16} /> Neue ZM
        </button>
      </div>

      {/* Bestehende Meldungen */}
      <div style={card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>ZM-Meldungen {jahr}</h3>
        {meldungenLoading ? (
          <div style={{ color: 'var(--text-muted)' }}>Lade...</div>
        ) : meldungen.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Keine ZM-Meldungen für {jahr}.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255,255,255,.1)' }}>
                {['Zeitraum', 'Quartal', 'Status', 'Positionen', 'Gesamtbetrag', ''].map(h => (
                  <th key={h} style={{ textAlign: h === '' || h === 'Gesamtbetrag' ? 'right' : 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meldungen.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ padding: '9px 10px' }}>{m.jahr}</td>
                  <td style={{ padding: '9px 10px' }}>Q{m.quartal}</td>
                  <td style={{ padding: '9px 10px' }}>{statusBadge(m.status)}</td>
                  <td style={{ padding: '9px 10px' }}>{m.positionen_anzahl || (m.kunden || []).length}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmtEur(m.gesamtbetrag)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                    {m.status !== 'eingereicht' && (
                      <button
                        onClick={() => einreichen(m.id)}
                        disabled={einreichenLoading[m.id]}
                        style={{ ...btnSecondary, padding: '5px 12px', fontSize: 12 }}
                      >
                        <CheckCircle size={12} />
                        {einreichenLoading[m.id] ? '...' : 'Als eingereicht markieren'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Neue ZM Form */}
      {showNeueForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowNeueForm(false)}
        >
          <div
            style={{ ...card, maxWidth: 700, width: '100%', maxHeight: '85vh', overflowY: 'auto', marginBottom: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Neue ZM erstellen</h3>
              <button onClick={() => setShowNeueForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <div>
                <label style={labelStyle}>Jahr</label>
                <select style={selectStyle} value={neueZM.jahr} onChange={e => setNeueZM(prev => ({ ...prev, jahr: Number(e.target.value) }))}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Quartal</label>
                <select style={selectStyle} value={neueZM.quartal} onChange={e => setNeueZM(prev => ({ ...prev, quartal: Number(e.target.value) }))}>
                  {QUARTALE.map(q => <option key={q.val} value={q.val}>{q.label}</option>)}
                </select>
              </div>
            </div>

            <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>EU-Kunden hinzufügen</h4>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>USt-ID</label>
                <input value={neuerKunde.ust_id} onChange={e => setNeuerKunde(p => ({ ...p, ust_id: e.target.value }))} placeholder="DE123456789" style={selectStyle} />
              </div>
              <div>
                <label style={labelStyle}>Land (ISO)</label>
                <input value={neuerKunde.land} onChange={e => setNeuerKunde(p => ({ ...p, land: e.target.value }))} placeholder="DE, AT, FR..." style={{ ...selectStyle, width: 80 }} maxLength={2} />
              </div>
              <div>
                <label style={labelStyle}>Betrag (€)</label>
                <input type="number" step="0.01" value={neuerKunde.betrag} onChange={e => setNeuerKunde(p => ({ ...p, betrag: e.target.value }))} style={{ ...selectStyle, width: 120 }} />
              </div>
              <div>
                <label style={labelStyle}>Art</label>
                <select value={neuerKunde.art} onChange={e => setNeuerKunde(p => ({ ...p, art: e.target.value }))} style={selectStyle}>
                  <option value="lieferung">Lieferung</option>
                  <option value="sonstige_leistung">Sonstige Leistung</option>
                  <option value="dreiecksgeschaeft">Dreiecksgeschäft</option>
                </select>
              </div>
              <button onClick={addKunde} style={btnPrimary}>
                Hinzufügen
              </button>
            </div>

            {neueZM.kunden.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                    {['USt-ID', 'Land', 'Art', 'Betrag', ''].map(h => (
                      <th key={h} style={{ textAlign: h === 'Betrag' ? 'right' : 'left', padding: '6px 10px', color: 'var(--text-muted)', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {neueZM.kunden.map((k, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <td style={{ padding: '7px 10px' }}>{k.ust_id}</td>
                      <td style={{ padding: '7px 10px' }}>{k.land}</td>
                      <td style={{ padding: '7px 10px' }}>{k.art}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtEur(k.betrag)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                        <button onClick={() => removeKunde(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button style={btnSecondary} onClick={() => setShowNeueForm(false)}>Abbrechen</button>
              <button style={btnPrimary} onClick={saveZM} disabled={saveLoading || neueZM.kunden.length === 0}>
                {saveLoading ? 'Speichere...' : 'ZM speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const SteuerAssistent = () => {
  const { activeDojo } = useDojoContext();
  const [activeTab, setActiveTab] = useState('ustVA');

  const dojoId = activeDojo?.dojo_id || activeDojo?.id;

  const tabs = [
    { id: 'ustVA', label: 'Umsatzsteuer-Voranmeldung (UStVA)' },
    { id: 'euer', label: 'EÜR — Jahresabschluss' },
    { id: 'gewerbesteuer', label: 'Gewerbesteuer' },
    { id: 'zm', label: 'ZM (Zusammenfassende Meldung)' },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: 26, fontWeight: 700 }}>
          Steuer-Assistent
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
          Umsatzsteuer-Voranmeldung und Jahresabschluss für Ihr Dojo
        </p>
      </div>

      {/* No dojo selected warning */}
      {!dojoId && (
        <div style={{ ...card, background: 'rgba(239,68,68,.08)', borderColor: 'rgba(239,68,68,.3)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertCircle size={18} color="#ef4444" />
          <span style={{ color: '#ef4444', fontSize: 14 }}>Bitte wählen Sie zuerst ein Dojo aus.</span>
        </div>
      )}

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 0, flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #ffd700' : '2px solid transparent',
              color: activeTab === tab.id ? '#ffd700' : 'var(--text-muted)',
              padding: '10px 18px',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 700 : 400,
              fontSize: 14,
              transition: 'all .15s',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'ustVA' && <UStVATab dojoId={dojoId} />}
      {activeTab === 'euer' && <EuerTab dojoId={dojoId} />}
      {activeTab === 'gewerbesteuer' && <GewerbesteuerTab dojoId={dojoId} />}
      {activeTab === 'zm' && <ZMTab dojoId={dojoId} />}
    </div>
  );
};

export default SteuerAssistent;
