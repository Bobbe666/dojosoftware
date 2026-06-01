// =============================================
// LOHN TAB - Lohnabrechnung
// Buchhaltung Sub-Tab
// =============================================

import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config';
import {
  Users, FileText, Download, Plus, Edit, Save, X,
  Calendar, BarChart3, ChevronDown, AlertCircle, CheckCircle, RefreshCw
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmtEur = (val) => {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(num);
};

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const MONATS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const STEUERKLASSEN = [1, 2, 3, 4, 5, 6];

// ---------------------------------------------------------------------------
// Abrechnungen Sub-Tab
// ---------------------------------------------------------------------------
const AbrechnungenTab = ({ token }) => {
  const [monat, setMonat] = useState(currentMonth);
  const [jahr, setJahr] = useState(currentYear);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [mitarbeiterLoading, setMitarbeiterLoading] = useState(false);
  const [bruttoInputs, setBruttoInputs] = useState({});
  const [vorschau, setVorschau] = useState({});
  const [berechnungLoading, setBerechnungLoading] = useState({});
  const [speichernLoading, setSpeichernLoading] = useState({});
  const [abrechnungen, setAbrechnungen] = useState([]);
  const [abrechnungenLoading, setAbrechnungenLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadMitarbeiter = useCallback(async () => {
    setMitarbeiterLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/lohnabrechnung/mitarbeiter`);
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const json = await res.json();
      setMitarbeiter(json.mitarbeiter || json || []);
    } catch (err) {
      setError('Fehler beim Laden der Mitarbeiter: ' + err.message);
    } finally {
      setMitarbeiterLoading(false);
    }
  }, []);

  const loadAbrechnungen = useCallback(async () => {
    setAbrechnungenLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/lohnabrechnung?monat=${monat}&jahr=${jahr}`);
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const json = await res.json();
      setAbrechnungen(json.abrechnungen || json || []);
    } catch (err) {
      setError('Fehler beim Laden der Abrechnungen: ' + err.message);
    } finally {
      setAbrechnungenLoading(false);
    }
  }, [monat, jahr]);

  useEffect(() => {
    loadMitarbeiter();
  }, [loadMitarbeiter]);

  useEffect(() => {
    loadAbrechnungen();
  }, [loadAbrechnungen]);

  const berechnen = async (mitarbeiterId) => {
    const brutto = parseFloat(bruttoInputs[mitarbeiterId] || '0');
    if (!brutto || brutto <= 0) {
      setError('Bitte Bruttolohn eingeben.');
      return;
    }
    setBerechnungLoading(prev => ({ ...prev, [mitarbeiterId]: true }));
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/lohnabrechnung/berechnen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitarbeiter_id: mitarbeiterId, brutto, monat, jahr }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Fehler ${res.status}`);
      const json = await res.json();
      setVorschau(prev => ({ ...prev, [mitarbeiterId]: json }));
    } catch (err) {
      setError('Berechnung fehlgeschlagen: ' + err.message);
    } finally {
      setBerechnungLoading(prev => ({ ...prev, [mitarbeiterId]: false }));
    }
  };

  const speichern = async (mitarbeiterId) => {
    const v = vorschau[mitarbeiterId];
    if (!v) return;
    setSpeichernLoading(prev => ({ ...prev, [mitarbeiterId]: true }));
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/lohnabrechnung`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitarbeiter_id: mitarbeiterId, monat, jahr, ...v }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Fehler ${res.status}`);
      setSuccess('Abrechnung gespeichert.');
      setVorschau(prev => { const n = { ...prev }; delete n[mitarbeiterId]; return n; });
      setBruttoInputs(prev => { const n = { ...prev }; delete n[mitarbeiterId]; return n; });
      loadAbrechnungen();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Speichern fehlgeschlagen: ' + err.message);
    } finally {
      setSpeichernLoading(prev => ({ ...prev, [mitarbeiterId]: false }));
    }
  };

  const downloadPdf = async (abrechnungId) => {
    setPdfLoading(prev => ({ ...prev, [abrechnungId]: true }));
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/lohnabrechnung/${abrechnungId}/pdf`);
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Lohnabrechnung_${abrechnungId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('PDF-Download fehlgeschlagen: ' + err.message);
    } finally {
      setPdfLoading(prev => ({ ...prev, [abrechnungId]: false }));
    }
  };

  return (
    <div>
      {error && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(239,68,68,.1)', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444' }}>
          <AlertCircle size={16} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(16,185,129,.1)', border: '1px solid #10b981', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#10b981' }}>
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {/* Monat / Jahr Selector */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Monat</label>
          <select
            value={monat}
            onChange={e => setMonat(Number(e.target.value))}
            style={{ background: 'var(--bg-secondary, rgba(255,255,255,.07))', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}
          >
            {MONATSNAMEN.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Jahr</label>
          <select
            value={jahr}
            onChange={e => setJahr(Number(e.target.value))}
            style={{ background: 'var(--bg-secondary, rgba(255,255,255,.07))', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Mitarbeiter + Brutto-Eingabe */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: 15, color: 'var(--text-primary)' }}>
          <Users size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Abrechnung erstellen — {MONATSNAMEN[monat - 1]} {jahr}
        </h4>
        {mitarbeiterLoading ? (
          <div style={{ color: 'var(--text-muted)', padding: '20px 0' }}>Lade Mitarbeiter...</div>
        ) : mitarbeiter.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '20px 0' }}>Keine Mitarbeiter angelegt.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mitarbeiter.map(ma => {
              const v = vorschau[ma.id || ma.mitarbeiter_id];
              const mid = ma.id || ma.mitarbeiter_id;
              return (
                <div key={mid} style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 600, minWidth: 180 }}>{ma.vorname} {ma.nachname}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 100 }}>StKl. {ma.steuerklasse || '—'}</div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bruttoInputs[mid] || ''}
                      onChange={e => setBruttoInputs(prev => ({ ...prev, [mid]: e.target.value }))}
                      placeholder="Brutto (€)"
                      style={{ background: 'var(--bg-secondary, rgba(255,255,255,.07))', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '7px 10px', fontSize: 14, width: 130 }}
                    />
                    <button
                      onClick={() => berechnen(mid)}
                      disabled={berechnungLoading[mid]}
                      style={{ background: 'var(--gradient-gold, linear-gradient(135deg,#ffd700,#ffb700))', color: '#000', border: 'none', borderRadius: 7, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                    >
                      {berechnungLoading[mid] ? 'Berechne...' : 'Berechnen'}
                    </button>
                  </div>

                  {v && (
                    <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(255,255,255,.04)', borderRadius: 7, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 10 }}>
                      {[
                        { label: 'Brutto', value: v.brutto, color: 'var(--text-primary)' },
                        { label: 'SV-Anteil AN', value: v.sv_an, color: '#ef4444' },
                        { label: 'Lohnsteuer', value: v.lohnsteuer, color: '#ef4444' },
                        { label: 'Netto', value: v.netto, color: '#10b981' },
                        { label: 'AG-Kosten gesamt', value: v.ag_kosten, color: '#f59e0b' },
                      ].map(item => (
                        <div key={item.label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{item.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: item.color }}>{fmtEur(item.value)}</div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          onClick={() => speichern(mid)}
                          disabled={speichernLoading[mid]}
                          style={{ background: '#10b981', color: 'var(--ds-text)', border: 'none', borderRadius: 7, padding: '8px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <Save size={14} />
                          {speichernLoading[mid] ? 'Speichere...' : 'Speichern'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gespeicherte Abrechnungen */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ margin: 0, fontSize: 15 }}>
            <FileText size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Gespeicherte Abrechnungen — {MONATSNAMEN[monat - 1]} {jahr}
          </h4>
          <button onClick={loadAbrechnungen} disabled={abrechnungenLoading} style={{ background: 'none', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <RefreshCw size={14} />
          </button>
        </div>
        {abrechnungenLoading ? (
          <div style={{ color: 'var(--text-muted)' }}>Lade...</div>
        ) : abrechnungen.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Keine Abrechnungen für diesen Monat.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,.1)' }}>
                  {['Mitarbeiter', 'Brutto', 'SV-AN', 'Lohnsteuer', 'Netto', 'AG-Kosten', 'PDF'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Mitarbeiter' ? 'left' : 'right', padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {abrechnungen.map((a, i) => (
                  <tr key={a.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <td style={{ padding: '9px 10px' }}>{a.vorname} {a.nachname}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtEur(a.brutto)}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#ef4444' }}>{fmtEur(a.sv_an)}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#ef4444' }}>{fmtEur(a.lohnsteuer)}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#10b981', fontWeight: 700 }}>{fmtEur(a.netto)}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#f59e0b' }}>{fmtEur(a.ag_kosten)}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                      <button
                        onClick={() => downloadPdf(a.id)}
                        disabled={pdfLoading[a.id]}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,.15)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                      >
                        <Download size={12} />
                        {pdfLoading[a.id] ? '...' : 'PDF'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Mitarbeiter Sub-Tab
// ---------------------------------------------------------------------------
const MitarbeiterTab = () => {
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState({});
  const [editValues, setEditValues] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadMitarbeiter = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/lohnabrechnung/mitarbeiter`);
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const json = await res.json();
      const list = json.mitarbeiter || json || [];
      setMitarbeiter(list);
      const initial = {};
      list.forEach(ma => {
        const mid = ma.id || ma.mitarbeiter_id;
        initial[mid] = {
          steuerklasse: ma.steuerklasse || '1',
          sv_nummer: ma.sv_nummer || '',
          krankenkasse: ma.krankenkasse || '',
          zusatzbeitrag: ma.zusatzbeitrag || '0',
          kinderfreibetrag: ma.kinderfreibetrag || '0',
          kirchensteuer_land: ma.kirchensteuer_land || '',
        };
      });
      setEditValues(initial);
    } catch (err) {
      setError('Fehler beim Laden: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMitarbeiter(); }, [loadMitarbeiter]);

  const save = async (mitarbeiterId) => {
    setSaveLoading(prev => ({ ...prev, [mitarbeiterId]: true }));
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/lohnabrechnung/mitarbeiter/${mitarbeiterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editValues[mitarbeiterId] || {}),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Fehler ${res.status}`);
      setSuccess('Gespeichert.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Fehler beim Speichern: ' + err.message);
    } finally {
      setSaveLoading(prev => ({ ...prev, [mitarbeiterId]: false }));
    }
  };

  const updateField = (mid, field, value) => {
    setEditValues(prev => ({ ...prev, [mid]: { ...prev[mid], [field]: value } }));
  };

  const inputStyle = { background: 'var(--bg-secondary, rgba(255,255,255,.07))', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '6px 10px', fontSize: 13, width: '100%' };
  const labelStyle = { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 };

  return (
    <div>
      {error && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(239,68,68,.1)', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444' }}>
          <AlertCircle size={16} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(16,185,129,.1)', border: '1px solid #10b981', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#10b981' }}>
          <CheckCircle size={16} /> {success}
        </div>
      )}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 20 }}>Lade Mitarbeiter...</div>
      ) : mitarbeiter.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: 20 }}>Keine Mitarbeiter gefunden.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mitarbeiter.map(ma => {
            const mid = ma.id || ma.mitarbeiter_id;
            const vals = editValues[mid] || {};
            return (
              <div key={mid} style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '18px 22px' }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, color: 'var(--text-primary)' }}>
                  {ma.vorname} {ma.nachname}
                  {ma.email && <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-muted)', marginLeft: 10 }}>{ma.email}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>Steuerklasse</label>
                    <select value={vals.steuerklasse || '1'} onChange={e => updateField(mid, 'steuerklasse', e.target.value)} style={inputStyle}>
                      {STEUERKLASSEN.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>SV-Nummer</label>
                    <input value={vals.sv_nummer || ''} onChange={e => updateField(mid, 'sv_nummer', e.target.value)} style={inputStyle} placeholder="12 345678 A 000" />
                  </div>
                  <div>
                    <label style={labelStyle}>Krankenkasse</label>
                    <input value={vals.krankenkasse || ''} onChange={e => updateField(mid, 'krankenkasse', e.target.value)} style={inputStyle} placeholder="z.B. AOK Bayern" />
                  </div>
                  <div>
                    <label style={labelStyle}>Zusatzbeitrag KV (%)</label>
                    <input type="number" step="0.01" min="0" max="5" value={vals.zusatzbeitrag || '0'} onChange={e => updateField(mid, 'zusatzbeitrag', e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Kinderfreibetrag</label>
                    <input type="number" step="0.5" min="0" value={vals.kinderfreibetrag || '0'} onChange={e => updateField(mid, 'kinderfreibetrag', e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Kirchensteuer-Land</label>
                    <input value={vals.kirchensteuer_land || ''} onChange={e => updateField(mid, 'kirchensteuer_land', e.target.value)} style={inputStyle} placeholder="z.B. BY, NW" />
                  </div>
                </div>
                <button
                  onClick={() => save(mid)}
                  disabled={saveLoading[mid]}
                  style={{ background: 'var(--gradient-gold, linear-gradient(135deg,#ffd700,#ffb700))', color: '#000', border: 'none', borderRadius: 7, padding: '8px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={14} />
                  {saveLoading[mid] ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Jahresübersicht Sub-Tab
// ---------------------------------------------------------------------------
const JahresuebersichtTab = () => {
  const [jahr, setJahr] = useState(currentYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const laden = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/lohnabrechnung/uebersicht/${jahr}`);
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError('Fehler beim Laden: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [jahr]);

  useEffect(() => { laden(); }, [laden]);

  const mitarbeiterListe = data?.mitarbeiter || [];
  const totals = data?.totals || {};

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Jahr</label>
          <select
            value={jahr}
            onChange={e => setJahr(Number(e.target.value))}
            style={{ background: 'var(--bg-secondary, rgba(255,255,255,.07))', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={laden} disabled={loading} style={{ background: 'var(--gradient-gold, linear-gradient(135deg,#ffd700,#ffb700))', color: '#000', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} />
          {loading ? 'Lade...' : 'Aktualisieren'}
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(239,68,68,.1)', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444' }}>
          <AlertCircle size={16} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 20 }}>Lade Jahresübersicht...</div>
      ) : mitarbeiterListe.length === 0 && !loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 20 }}>Keine Daten für {jahr}.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255,255,255,.1)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>Mitarbeiter</th>
                {MONATS_SHORT.map(m => (
                  <th key={m} style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: 'var(--text-muted)' }}>{m}</th>
                ))}
                <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>Brutto Gesamt</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>Netto Gesamt</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>AG-Kosten</th>
              </tr>
            </thead>
            <tbody>
              {mitarbeiterListe.map((ma, i) => (
                <tr key={ma.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                  <td style={{ padding: '9px 10px', fontWeight: 600 }}>{ma.vorname} {ma.nachname}</td>
                  {Array.from({ length: 12 }, (_, m) => {
                    const monatVal = ma.monate?.[m + 1];
                    return (
                      <td key={m} style={{ padding: '9px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: monatVal ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {monatVal ? fmtEur(monatVal.brutto) : '—'}
                      </td>
                    );
                  })}
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtEur(ma.gesamt_brutto)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#10b981' }}>{fmtEur(ma.gesamt_netto)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#f59e0b' }}>{fmtEur(ma.ag_kosten)}</td>
                </tr>
              ))}
            </tbody>
            {mitarbeiterListe.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', fontWeight: 700 }}>
                  <td style={{ padding: '10px 10px' }}>Gesamt</td>
                  {Array.from({ length: 12 }, (_, m) => (
                    <td key={m} style={{ padding: '10px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                      {totals?.monate?.[m + 1] ? fmtEur(totals.monate[m + 1].brutto) : '—'}
                    </td>
                  ))}
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtEur(totals.gesamt_brutto)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#10b981' }}>{fmtEur(totals.gesamt_netto)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#f59e0b' }}>{fmtEur(totals.ag_kosten)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main LohnTab Component
// ---------------------------------------------------------------------------
const LohnTab = ({ token }) => {
  const [activeSubTab, setActiveSubTab] = useState('abrechnungen');

  const subTabs = [
    { id: 'abrechnungen', label: 'Abrechnungen', icon: <FileText size={15} /> },
    { id: 'mitarbeiter', label: 'Mitarbeiter', icon: <Users size={15} /> },
    { id: 'jahresuebersicht', label: 'Jahresübersicht', icon: <BarChart3 size={15} /> },
  ];

  return (
    <div>
      {/* Sub-Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 0, flexWrap: 'wrap' }}>
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeSubTab === tab.id ? '2px solid #d4af37' : '2px solid transparent',
              color: activeSubTab === tab.id ? '#d4af37' : 'var(--text-muted)',
              padding: '10px 16px',
              cursor: 'pointer',
              fontWeight: activeSubTab === tab.id ? 700 : 400,
              fontSize: 14,
              transition: 'all .15s',
              marginBottom: -1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeSubTab === 'abrechnungen' && <AbrechnungenTab token={token} />}
      {activeSubTab === 'mitarbeiter' && <MitarbeiterTab />}
      {activeSubTab === 'jahresuebersicht' && <JahresuebersichtTab />}
    </div>
  );
};

export default LohnTab;
