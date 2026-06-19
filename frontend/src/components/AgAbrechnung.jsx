import React, { useState, useEffect, useCallback } from 'react';
import config from '../config/config';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const WOCHENTAGE = { 1: 'Montag', 2: 'Dienstag', 3: 'Mittwoch', 4: 'Donnerstag', 5: 'Freitag', 6: 'Samstag', 7: 'Sonntag' };
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const deDate = (ds) => { const d = new Date(ds); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };

export default function AgAbrechnung() {
  const [configs, setConfigs] = useState([]);
  const [laeufe, setLaeufe] = useState([]);
  const [msg, setMsg] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ dojo_id: '', mitglied_id: '', bezeichnung: 'Karatestunden AG', wochentag: 2, stunden_pro_tag: 3, preis_pro_stunde: 30.67, mwst_satz: 19, gueltig_ab: '', gueltig_bis: '', auto_versand: false });
  const heute = new Date();
  const [selConfig, setSelConfig] = useState('');
  const [jahr, setJahr] = useState(heute.getMonth() === 0 ? heute.getFullYear() - 1 : heute.getFullYear());
  const [monat, setMonat] = useState(heute.getMonth() === 0 ? 12 : heute.getMonth()); // Vormonat

  const load = useCallback(async () => {
    try {
      const [c, l] = await Promise.all([
        fetchWithAuth(`${config.apiBaseUrl}/ag-abrechnung/configs`).then(r => r.json()),
        fetchWithAuth(`${config.apiBaseUrl}/ag-abrechnung/laeufe`).then(r => r.json()),
      ]);
      setConfigs(c.configs || []);
      setLaeufe(l.laeufe || []);
      if (!selConfig && c.configs && c.configs.length) setSelConfig(String(c.configs[0].id));
    } catch (e) { setMsg({ t: 'err', m: e.message }); }
  }, [selConfig]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const flash = (t, m) => { setMsg({ t, m }); setTimeout(() => setMsg(null), 5000); };

  const saveConfig = async () => {
    try {
      const r = await fetchWithAuth(`${config.apiBaseUrl}/ag-abrechnung/configs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, mitglied_id: form.mitglied_id || null, dojo_id: form.dojo_id || undefined }),
      }).then(r => r.json());
      if (r.success) { flash('ok', 'Konfiguration gespeichert.'); setShowForm(false); load(); }
      else flash('err', r.error || 'Fehler');
    } catch (e) { flash('err', e.message); }
  };

  const entwurfErzeugen = async () => {
    if (!selConfig) return;
    try {
      const r = await fetchWithAuth(`${config.apiBaseUrl}/ag-abrechnung/entwurf`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: Number(selConfig), jahr: Number(jahr), monat: Number(monat) }),
      }).then(r => r.json());
      if (r.success) { flash('ok', `Entwurf erstellt: ${r.lauf.anzahl_tage} Unterrichtstage.`); load(); }
      else flash('err', r.error || 'Fehler');
    } catch (e) { flash('err', e.message); }
  };

  const toggleTag = async (lauf, ds) => {
    const tage = Array.isArray(lauf.tage) ? lauf.tage : JSON.parse(lauf.tage || '[]');
    const neu = tage.includes(ds) ? tage.filter(x => x !== ds) : [...tage, ds].sort();
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/ag-abrechnung/lauf/${lauf.id}/tage`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tage: neu }),
      });
      setLaeufe(ls => ls.map(l => l.id === lauf.id ? { ...l, tage: neu, anzahl_tage: neu.length } : l));
    } catch (e) { flash('err', e.message); }
  };

  const bestaetigen = async (lauf) => {
    if (!window.confirm(`Rechnung für ${MONATE[lauf.monat - 1]} ${lauf.jahr} erstellen (${lauf.anzahl_tage} Tage)?`)) return;
    try {
      const r = await fetchWithAuth(`${config.apiBaseUrl}/ag-abrechnung/lauf/${lauf.id}/bestaetigen`, { method: 'POST' }).then(r => r.json());
      if (r.success) { flash('ok', `Rechnung ${r.rechnungsnummer} erstellt (${r.brutto} € brutto).`); load(); }
      else flash('err', r.error || 'Fehler');
    } catch (e) { flash('err', e.message); }
  };

  const cfgById = (id) => configs.find(c => c.id === id) || {};
  const entwuerfe = laeufe.filter(l => l.status === 'entwurf');
  const erledigt = laeufe.filter(l => l.status !== 'entwurf');
  const tageOf = (l) => Array.isArray(l.tage) ? l.tage : JSON.parse(l.tage || '[]');

  return (
    <div style={{ padding: '0.5rem 0' }}>
      <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.9rem', marginTop: 0 }}>
        Automatische Monatsabrechnung für AG-Kurse: Unterrichtstage = fester Wochentag minus bayerische Schulferien & Feiertage.
        Am Monatsanfang wird automatisch ein Entwurf für den Vormonat erzeugt; hier prüfst du die Tage und erstellst die Rechnung.
      </p>
      {msg && <div style={{ padding: '0.6rem 1rem', borderRadius: 8, margin: '0.5rem 0', background: msg.t === 'ok' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)', color: msg.t === 'ok' ? '#15803d' : '#b91c1c' }}>{msg.m}</div>}

      {/* Entwurf erzeugen */}
      <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '1rem', margin: '0.75rem 0' }}>
        <h3 style={{ marginTop: 0 }}>Monats-Entwurf erstellen</h3>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ fontSize: '.85rem' }}>AG-Konfiguration<br />
            <select value={selConfig} onChange={e => setSelConfig(e.target.value)} style={{ padding: '.4rem', minWidth: 220 }}>
              {configs.map(c => <option key={c.id} value={c.id}>{c.bezeichnung} — {c.empfaenger_name?.trim() || 'Dojo ' + c.dojo_id}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '.85rem' }}>Monat<br />
            <select value={monat} onChange={e => setMonat(e.target.value)} style={{ padding: '.4rem' }}>
              {MONATE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '.85rem' }}>Jahr<br />
            <input type="number" value={jahr} onChange={e => setJahr(e.target.value)} style={{ padding: '.4rem', width: 90 }} />
          </label>
          <button className="btn btn-primary" onClick={entwurfErzeugen}>Entwurf erzeugen</button>
        </div>
      </div>

      {/* Offene Entwürfe */}
      <h3>Offene Entwürfe ({entwuerfe.length})</h3>
      {entwuerfe.length === 0 && <p style={{ color: '#94a3b8' }}>Keine offenen Entwürfe.</p>}
      {entwuerfe.map(l => {
        const c = cfgById(l.config_id);
        const tage = tageOf(l);
        const netto = (l.anzahl_tage * (c.stunden_pro_tag || 0) * (c.preis_pro_stunde || 0)).toFixed(2);
        return (
          <div key={l.id} style={{ background: 'var(--bg-card,#fff)', border: '1px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <strong>{l.bezeichnung} — {l.empfaenger_name?.trim() || 'Dojo ' + l.dojo_id}</strong>
              <span>{MONATE[l.monat - 1]} {l.jahr} · {l.anzahl_tage} Tage · {netto} € netto</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.6rem 0' }}>
              {tage.map(ds => (
                <label key={ds} style={{ fontSize: '.8rem', background: 'rgba(99,102,241,.08)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked readOnly={false} onChange={() => toggleTag(l, ds)} style={{ marginRight: 4 }} />
                  {deDate(ds)}
                </label>
              ))}
              {tage.length === 0 && <span style={{ color: '#b91c1c' }}>Keine Unterrichtstage in diesem Monat.</span>}
            </div>
            <button className="btn btn-primary btn-sm" disabled={tage.length === 0} onClick={() => bestaetigen(l)}>✓ Rechnung erstellen</button>
          </div>
        );
      })}

      {/* Konfigurationen */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>AG-Konfigurationen ({configs.length})</h3>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(v => !v)}>{showForm ? 'Schließen' : '+ Neue Konfiguration'}</button>
      </div>
      {showForm && (
        <div style={{ background: 'var(--bg-card,#fff)', border: '1px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '1rem', margin: '0.6rem 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0.6rem' }}>
          {[['dojo_id', 'Dojo-ID', 'number'], ['mitglied_id', 'Empfänger Mitglied-ID', 'number'], ['bezeichnung', 'Bezeichnung', 'text'], ['stunden_pro_tag', 'Std./Tag', 'number'], ['preis_pro_stunde', 'Preis/Std. (€)', 'number'], ['mwst_satz', 'MwSt %', 'number'], ['gueltig_ab', 'Gültig ab', 'date'], ['gueltig_bis', 'Gültig bis', 'date']].map(([k, label, type]) => (
            <label key={k} style={{ fontSize: '.8rem' }}>{label}<br />
              <input type={type} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={{ padding: '.4rem', width: '100%' }} />
            </label>
          ))}
          <label style={{ fontSize: '.8rem' }}>Wochentag<br />
            <select value={form.wochentag} onChange={e => setForm(f => ({ ...f, wochentag: e.target.value }))} style={{ padding: '.4rem', width: '100%' }}>
              {Object.entries(WOCHENTAGE).map(([n, l]) => <option key={n} value={n}>{l}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: 6, marginTop: 18 }}>
            <input type="checkbox" checked={form.auto_versand} onChange={e => setForm(f => ({ ...f, auto_versand: e.target.checked }))} />
            Auto-Rechnung (ohne Bestätigung)
          </label>
          <div style={{ gridColumn: '1/-1' }}><button className="btn btn-primary" onClick={saveConfig}>Speichern</button></div>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem', marginTop: '0.5rem' }}>
        <thead><tr style={{ textAlign: 'left', color: '#94a3b8' }}>
          <th style={{ padding: '6px 8px' }}>Bezeichnung</th><th>Empfänger</th><th>Wochentag</th><th>Std./Tag</th><th>Preis/Std.</th><th>Aktiv</th><th>Auto</th>
        </tr></thead>
        <tbody>
          {configs.map(c => (
            <tr key={c.id} style={{ borderTop: '1px solid rgba(0,0,0,.06)' }}>
              <td style={{ padding: '6px 8px' }}>{c.bezeichnung}</td>
              <td>{c.empfaenger_name?.trim() || '—'} (Dojo {c.dojo_id})</td>
              <td>{WOCHENTAGE[c.wochentag]}</td>
              <td>{c.stunden_pro_tag}</td>
              <td>{Number(c.preis_pro_stunde).toFixed(2)} €</td>
              <td>{c.aktiv ? '✓' : '—'}</td>
              <td>{c.auto_versand ? '⚡' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {erledigt.length > 0 && (
        <>
          <h3 style={{ marginTop: '1.5rem' }}>Berechnete Monate</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
            <tbody>
              {erledigt.map(l => (
                <tr key={l.id} style={{ borderTop: '1px solid rgba(0,0,0,.06)' }}>
                  <td style={{ padding: '6px 8px' }}>{l.bezeichnung}</td>
                  <td>{MONATE[l.monat - 1]} {l.jahr}</td>
                  <td>{l.anzahl_tage} Tage</td>
                  <td>{l.status}{l.rechnung_id ? ` · Rechnung #${l.rechnung_id}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
