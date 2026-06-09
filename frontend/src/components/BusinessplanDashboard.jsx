import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import { useSubscription } from '../context/SubscriptionContext';
import './BusinessplanDashboard.css';

// ── Formatierung ────────────────────────────────────────────────────────────────
const fmtEur = (n) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0)) + ' €';
const fmtNum = (n) => new Intl.NumberFormat('de-DE').format(Number(n) || 0);
const cls = (v) => (Number(v) || 0) < 0 ? 'neg' : '';

const INV_KATEGORIEN = [
  ['grundstuecke', 'Grundstücke'], ['gebaeude', 'Gebäude'], ['maschinen', 'Maschinen/Geräte'],
  ['einrichtung', 'Geschäfts-/Ladeneinrichtung'], ['fahrzeuge', 'Fahrzeuge'],
  ['warenausstattung', 'Warenerstausstattung'], ['sonstiges', 'Sonstiges'],
];
const FIN_ARTEN = [
  ['eigenkapital', 'Eigenkapital'], ['sacheinlage', 'Sacheinlagen'], ['foerdermittel', 'Fördermittel'],
  ['darlehen', 'Darlehen'], ['beteiligung', 'Beteiligungen'],
  ['betriebsmittelkredit', 'Betriebsmittelkredit'], ['kontokorrent', 'Kontokorrent-Kredit'],
];
const KOSTEN_KATEGORIEN = [
  ['material', 'Material/Wareneinsatz'], ['fremdleistung', 'Fremdleistungen'], ['personal', 'Personal'],
  ['raumkosten', 'Raumkosten'], ['versicherungen', 'Versicherungen/Beiträge'], ['kfz', 'Kfz-Kosten'],
  ['werbung', 'Werbe-/Reisekosten'], ['warenabgabe', 'Kosten der Warenabgabe'],
  ['reparatur', 'Reparatur/Instandhaltung'],
  ['sonstige_steuern', 'sonstige Steuern'], ['sonstige', 'sonstige Aufwendungen'],
];
const PRIVAT_KATEGORIEN = [
  ['lebenshaltung', 'Lebenshaltung'], ['sonderausgaben', 'Sonderausgaben'],
  ['einkommensteuer', 'Einkommensteuer'], ['sonstiges', 'Sonstiges'],
];
const ZIEL_STATUS = [
  ['offen', 'Offen'], ['laeuft', 'In Arbeit'], ['erreicht', 'Erreicht'], ['verfehlt', 'Verfehlt'],
];

// ── Editierbare Positions-Tabelle ─────────────────────────────────────────────────
// columns: [{ key, label, type:'text'|'number'|'select'|'checkbox', options, align, step }]
function LineItemTable({ columns, rows, onLocalChange, onSaveRow, onDelete, onAdd, footer }) {
  return (
    <>
      <table className="bp-table">
        <thead>
          <tr>
            {columns.map((c, ci) => (
              <th key={ci} className={c.align === 'right' ? 'r' : ''}>{c.label}</th>
            ))}
            <th style={{ width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length + 1} style={{ color: 'var(--text-secondary,#9a9ab0)', padding: '.8rem .5rem' }}>Noch keine Positionen.</td></tr>
          )}
          {rows.map((row, ri) => (
            <tr key={row.id}>
              {columns.map((c, ci) => (
                <td key={ci} className={c.align === 'right' ? 'r' : ''}>
                  {c.type === 'select' ? (
                    <select className="bp-input" value={row[c.key] ?? ''}
                      onChange={(e) => { onLocalChange(row.id, { [c.key]: e.target.value }); onSaveRow({ ...row, [c.key]: e.target.value }); }}>
                      {c.options.map((o, oi) => <option key={oi} value={o[0]}>{o[1]}</option>)}
                    </select>
                  ) : c.type === 'checkbox' ? (
                    <input type="checkbox" checked={!!row[c.key]}
                      onChange={(e) => { onLocalChange(row.id, { [c.key]: e.target.checked }); onSaveRow({ ...row, [c.key]: e.target.checked }); }} />
                  ) : (
                    <input
                      className={'bp-input' + (c.type === 'number' ? ' num' : '')}
                      type={c.type === 'number' ? 'number' : 'text'}
                      step={c.step || (c.type === 'number' ? '0.01' : undefined)}
                      value={row[c.key] ?? ''}
                      onChange={(e) => onLocalChange(row.id, { [c.key]: e.target.value })}
                      onBlur={() => onSaveRow(row)}
                    />
                  )}
                </td>
              ))}
              <td className="r">
                <button className="bp-icon-btn" title="Löschen" onClick={() => onDelete(row.id)}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
        {footer && <tfoot><tr>{footer}</tr></tfoot>}
      </table>
      <button className="bp-btn add" onClick={onAdd}>+ Position hinzufügen</button>
    </>
  );
}

export default function BusinessplanDashboard() {
  const { activeDojo } = useDojoContext();
  const { hasFeature } = useSubscription();

  // Konkrete Dojo-ID nur wenn ein echtes Dojo-Objekt aktiv ist (nicht 'super-admin'/'verband'/null).
  const dojoId = (activeDojo && typeof activeDojo === 'object') ? activeDojo.id : null;
  const withDojo = useCallback(
    (url) => (dojoId ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${dojoId}` : url),
    [dojoId]
  );

  const [plaene, setPlaene] = useState([]);
  const [planId, setPlanId] = useState(null);
  const [plan, setPlan] = useState(null);
  const [auswertung, setAuswertung] = useState(null);
  const [ziele, setZiele] = useState([]);
  const [view, setView] = useState('uebersicht');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showZiel, setShowZiel] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState(null);

  const istFeature = hasFeature('businessplan');

  // ── Laden ───────────────────────────────────────────────────────────────────
  const loadPlaene = useCallback(async () => {
    try {
      const res = await axios.get(withDojo('/businessplan/plaene'));
      setPlaene(res.data || []);
      if (res.data?.length && !planId) setPlanId(res.data[0].id);
      if (!res.data?.length) setPlanId(null);
      setError(null); // stehengebliebene Fehler aus früheren Versuchen löschen
    } catch (err) {
      setError(typeof err.response?.data?.error === 'string' ? err.response.data.error : 'Fehler beim Laden der Pläne');
    } finally {
      setLoading(false);
    }
  }, [withDojo, planId]);

  const loadPlan = useCallback(async () => {
    if (!planId) { setPlan(null); return; }
    try {
      const res = await axios.get(withDojo(`/businessplan/plaene/${planId}`));
      setPlan(res.data);
    } catch (err) { /* Plan evtl. gelöscht */ setPlan(null); }
  }, [withDojo, planId]);

  const loadAuswertung = useCallback(async () => {
    if (!planId) { setAuswertung(null); return; }
    try {
      const res = await axios.get(withDojo(`/businessplan/plaene/${planId}/auswertung`));
      setAuswertung(res.data);
    } catch (err) { setAuswertung(null); }
  }, [withDojo, planId]);

  const loadZiele = useCallback(async () => {
    if (!plan?.planungsjahr) return;
    try {
      const res = await axios.get(withDojo(`/businessplan/ziele?jahr=${plan.planungsjahr}`));
      setZiele(res.data || []);
    } catch (err) { setZiele([]); }
  }, [withDojo, plan?.planungsjahr]);

  useEffect(() => { if (istFeature && dojoId) loadPlaene(); }, [istFeature, dojoId, loadPlaene]);
  useEffect(() => { loadPlan(); loadAuswertung(); }, [loadPlan, loadAuswertung]);
  useEffect(() => { loadZiele(); }, [loadZiele]);

  // ── Positionen-Helfer ─────────────────────────────────────────────────────────
  const setLocalRow = (resource, id, patch) => {
    setPlan((p) => p ? { ...p, [resource]: p[resource].map((r) => r.id === id ? { ...r, ...patch } : r) } : p);
  };

  const saveRow = async (resource, row) => {
    try {
      await axios.put(withDojo(`/businessplan/${resource}/${row.id}`), row);
      loadAuswertung();
    } catch (err) { /* still editing */ }
  };

  const addRow = async (resource, defaults) => {
    try {
      await axios.post(withDojo(`/businessplan/plaene/${planId}/${resource}`), defaults);
      loadPlan();
    } catch (err) {
      setError(typeof err.response?.data?.error === 'string' ? err.response.data.error : 'Fehler beim Hinzufügen');
    }
  };

  const deleteRow = async (resource, id) => {
    try {
      await axios.delete(withDojo(`/businessplan/${resource}/${id}`));
      loadPlan(); loadAuswertung();
    } catch (err) { /* ignore */ }
  };

  // ── Plan-Stammdaten / Annahmen / Texte speichern ──────────────────────────────
  const savePlanPatch = async (patch) => {
    const next = { ...plan, ...patch };
    setPlan(next);
    try {
      await axios.put(withDojo(`/businessplan/plaene/${planId}`), {
        titel: next.titel, firmenname: next.firmenname, rechtsform: next.rechtsform,
        planungsjahr: next.planungsjahr, status: next.status,
        annahmen: next.annahmen, dokument_texte: next.dokument_texte,
      });
      loadAuswertung();
    } catch (err) { /* ignore */ }
  };

  const setAnnahme = (key, value) => savePlanPatch({ annahmen: { ...(plan.annahmen || {}), [key]: value } });
  const setText = (key, value) => setPlan((p) => ({ ...p, dokument_texte: { ...(p.dokument_texte || {}), [key]: value } }));
  const saveTexte = () => savePlanPatch({ dokument_texte: plan.dokument_texte || {} });

  // ── Plan anlegen ───────────────────────────────────────────────────────────────
  const createPlan = async (data) => {
    try {
      const res = await axios.post(withDojo('/businessplan/plaene'), data);
      setShowCreate(false);
      await loadPlaene();
      setPlanId(res.data.id);
      setView('finanzplanung');
    } catch (err) {
      setError(typeof err.response?.data?.error === 'string' ? err.response.data.error : 'Fehler beim Anlegen');
    }
  };

  const deletePlan = async () => {
    if (!window.confirm('Diesen Businessplan wirklich löschen? Alle Positionen gehen verloren.')) return;
    try {
      await axios.delete(withDojo(`/businessplan/plaene/${planId}`));
      setPlanId(null); setPlan(null);
      loadPlaene();
    } catch (err) { /* ignore */ }
  };

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await axios.get(withDojo(`/businessplan/plaene/${planId}/pdf`), { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Businessplan_${plan?.planungsjahr || ''}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('PDF-Generierung fehlgeschlagen.');
    } finally { setPdfBusy(false); }
  };

  // ── Ziele ───────────────────────────────────────────────────────────────────
  const createZiel = async (data) => {
    try {
      await axios.post(withDojo('/businessplan/ziele'), { ...data, jahr: plan.planungsjahr });
      setShowZiel(false); loadZiele();
    } catch (err) { setError('Fehler beim Anlegen des Ziels'); }
  };
  const updateZielStatus = async (z, status) => {
    try { await axios.put(withDojo(`/businessplan/ziele/${z.id}`), { ...z, status }); loadZiele(); } catch (err) {}
  };
  const deleteZiel = async (id) => {
    if (!window.confirm('Ziel löschen?')) return;
    try { await axios.delete(withDojo(`/businessplan/ziele/${id}`)); loadZiele(); } catch (err) {}
  };

  // ── Render: Feature-Gate ───────────────────────────────────────────────────────
  if (!istFeature) {
    return (
      <div className="bp-wrap">
        <div className="bp-upgrade">
          <div className="icon">📈</div>
          <h3>Businessplan & Finanzplanung</h3>
          <p>
            Vollständige Finanz- und Liquiditätsplanung (Investition, Rentabilität, 3-Jahres-Plan),
            ein generierbarer Businessplan als PDF für Bank/Förderung und ein strategisches Ziele-Board.
            Verfügbar im <strong>Enterprise-Plan</strong>.
          </p>
          <button className="bp-btn" onClick={() => { window.location.href = '/dashboard/plan'; }}>Jetzt upgraden →</button>
        </div>
      </div>
    );
  }

  // Businessplan braucht ein konkretes Dojo (Super-Admin: oben Dojo wählen)
  if (!dojoId) {
    return (
      <div className="bp-wrap">
        <div className="bp-header">
          <div>
            <h2>📈 Businessplan</h2>
            <div className="bp-sub">Finanz- & Liquiditätsplanung · Businessplan-PDF · Ziele-Board</div>
          </div>
        </div>
        <div className="bp-empty">
          <p>Bitte oben rechts ein <strong>konkretes Dojo</strong> auswählen, um den Businessplan zu nutzen.</p>
          <p className="bp-sub">Der Businessplan wird pro Dojo erstellt — in der Gesamt-/Super-Admin-Ansicht ist keine Planung möglich.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bp-wrap">
      <div className="bp-header">
        <div>
          <h2>📈 Businessplan</h2>
          <div className="bp-sub">Finanz- & Liquiditätsplanung · Businessplan-PDF · Ziele-Board</div>
        </div>
        <div className="bp-plan-select">
          {plaene.length > 0 && (
            <select value={planId || ''} onChange={(e) => setPlanId(Number(e.target.value))}>
              {plaene.map((p, i) => (
                <option key={p.id} value={p.id}>{p.titel} ({p.planungsjahr})</option>
              ))}
            </select>
          )}
          <button className="bp-btn" onClick={() => setShowCreate(true)}>+ Neuer Plan</button>
        </div>
      </div>

      {error && <div className="bp-balance warn" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>{error} (ausblenden)</div>}

      {loading ? (
        <div className="bp-empty">Lade …</div>
      ) : !plan ? (
        <div className="bp-empty">
          <p>Noch kein Businessplan vorhanden.</p>
          <button className="bp-btn" onClick={() => setShowCreate(true)}>Ersten Businessplan anlegen</button>
        </div>
      ) : (
        <>
          <div className="bp-nav">
            {[['uebersicht', '📊 Übersicht'], ['finanzplanung', '💶 Finanzplanung'],
              ['dokument', '📄 Dokument & PDF'], ['ziele', '🎯 Ziele-Board']].map((t, i) => (
              <button key={t[0]} className={view === t[0] ? 'active' : ''} onClick={() => setView(t[0])}>{t[1]}</button>
            ))}
          </div>

          <MissingHint plan={plan} auswertung={auswertung} onGoto={setView} />


          {view === 'uebersicht' && <UebersichtView auswertung={auswertung} />}

          {view === 'finanzplanung' && (
            <FinanzplanungView
              plan={plan} auswertung={auswertung}
              setAnnahme={setAnnahme}
              addRow={addRow} saveRow={saveRow} deleteRow={deleteRow} setLocalRow={setLocalRow}
            />
          )}

          {view === 'dokument' && (
            <DokumentView plan={plan} setText={setText} saveTexte={saveTexte} downloadPdf={downloadPdf} pdfBusy={pdfBusy} />
          )}

          {view === 'ziele' && (
            <ZieleView ziele={ziele} onAdd={() => setShowZiel(true)} onStatus={updateZielStatus} onDelete={deleteZiel} />
          )}

          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <button className="bp-btn ghost" onClick={deletePlan}>Plan löschen</button>
          </div>
        </>
      )}

      {showCreate && <CreatePlanModal onClose={() => setShowCreate(false)} onCreate={createPlan} withDojo={withDojo} />}
      {showZiel && <ZielModal onClose={() => setShowZiel(false)} onCreate={createZiel} />}
    </div>
  );
}

// ── Übersicht ─────────────────────────────────────────────────────────────────
function UebersichtView({ auswertung }) {
  if (!auswertung) return <div className="bp-empty">Keine Auswertung verfügbar.</div>;
  const k = auswertung.kennzahlen || {};
  const r = auswertung.rentabilitaet || {};
  const liq = auswertung.liquiditaet || [];
  const drei = auswertung.dreiJahresPlan || [];
  const mb = auswertung.mittelbilanz || {};
  const maxAbs = Math.max(1, ...liq.map((m) => Math.abs(m.saldo)));

  return (
    <>
      <div className="bp-kpis">
        <div className="bp-kpi"><div className="label">Umsatz / Jahr</div><div className="value">{fmtEur(k.umsatzJahr)}</div></div>
        <div className="bp-kpi"><div className="label">Betriebsergebnis</div><div className={'value ' + cls(k.betriebsergebnisJahr)}>{fmtEur(k.betriebsergebnisJahr)}</div></div>
        <div className="bp-kpi"><div className="label">Cash-flow</div><div className={'value ' + cls(k.cashflowJahr)}>{fmtEur(k.cashflowJahr)}</div></div>
        <div className="bp-kpi"><div className="label">Liquiditätsergebnis</div><div className={'value ' + cls(k.liquiditaetsergebnisJahr)}>{fmtEur(k.liquiditaetsergebnisJahr)}</div></div>
        <div className="bp-kpi"><div className="label">EK-Quote</div><div className="value">{mb.eigenkapitalquote || 0} %</div></div>
      </div>

      <div className="bp-grid2">
        <div className="bp-card">
          <h3>Rentabilitätsvorschau (Jahr 1)</h3>
          <table className="bp-table">
            <tbody>
              {[
                ['Umsatzerlöse', r.umsatzerloese], ['– Erlösschmälerung', -r.erloesschmaelerung],
                ['= Gesamtleistung', r.gesamtleistung, true],
                ['– Material/Wareneinsatz', -r.material], ['– Fremdleistungen', -r.fremdleistungen],
                ['= Rohertrag', r.rohertrag, true],
                ['+ sonstige betr. Erträge', r.sonstigeErtraege],
                ['– Personalaufwand', -r.personalaufwand], ['– Raumkosten', -r.raumkosten],
                ['– Versicherungen', -r.versicherungen], ['– Kfz-Kosten', -r.kfzKosten],
                ['– Werbe-/Reisekosten', -r.werbekosten], ['– Kosten Warenabgabe', -r.kostenWarenabgabe],
                ['– Reparatur/Instandh.', -r.reparaturkosten], ['– sonstige Steuern', -r.sonstigeSteuern],
                ['– sonstige Aufwendungen', -r.sonstigeAufwendungen], ['– Abschreibungen (AfA)', -r.abschreibungen],
                ['+ Zinserträge', r.zinsertraege], ['– Zinsaufwendungen', -r.zinsaufwendungen],
                ['+ neutrale Erträge', r.neutraleErtraege], ['– neutrale Aufwendungen', -r.neutraleAufwendungen],
                ['= Ergebnis vor Steuern', r.ergebnisVorSteuern, true],
                ['– Ergebnis-Steuern', -r.steuern],
                ['= Betriebsergebnis', r.betriebsergebnis, true],
                ['+ Abschreibungen', r.abschreibungen], ['= Cash-flow', r.cashflow, true],
                ['– Privatentnahmen', -r.privatentnahmen], ['+ Privateinlagen', r.privateinlagen],
                ['– Tilgung', -r.tilgung], ['= Liquiditätsergebnis', r.liquiditaetsergebnis, true],
              ].filter((row) => row[2] || Math.abs(Number(row[1]) || 0) > 0.005)
                .map((row, ri) => (
                  <tr key={ri} className={row[2] ? 'sum' : ''}>
                    <td>{row[0]}</td>
                    <td className={'r ' + cls(row[1])}>{fmtEur(row[1])}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="bp-card">
          <h3>Liquidität (12 Monate)</h3>
          <div className="bp-liq-bars">
            {liq.map((m, i) => (
              <div key={i} className={'bar' + (m.saldo < 0 ? ' neg' : '')}
                style={{ height: `${Math.max(2, Math.abs(m.saldo) / maxAbs * 88)}px` }}
                title={`${m.label}: ${fmtEur(m.saldo)}`} />
            ))}
          </div>
          <p className="bp-sub" style={{ marginTop: '.6rem' }}>
            Tiefster Saldo: <strong className={cls(k.tiefsterSaldo)}>{fmtEur(k.tiefsterSaldo)}</strong>
            {k.breakEvenMonat ? ` · positiv ab Monat ${k.breakEvenMonat}` : ''}
          </p>
        </div>
      </div>

      <div className="bp-card">
        <h3>3-Jahres-Planung</h3>
        <table className="bp-table">
          <thead><tr><th>Position</th>{drei.map((d, i) => <th key={i} className="r">{d.jahr}</th>)}</tr></thead>
          <tbody>
            {[['Umsatzerlöse', 'umsatzerloese'], ['Rohertrag', 'rohertrag'],
              ['Ergebnis vor Steuern', 'ergebnisVorSteuern'], ['Betriebsergebnis', 'betriebsergebnis'],
              ['Cash-flow', 'cashflow']].map((rowDef, ri) => (
              <tr key={ri} className={ri >= 2 ? 'sum' : ''}>
                <td>{rowDef[0]}</td>
                {drei.map((d, di) => <td key={di} className={'r ' + cls(d[rowDef[1]])}>{fmtEur(d[rowDef[1]])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Finanzplanung ───────────────────────────────────────────────────────────────
function FinanzplanungView({ plan, auswertung, setAnnahme, addRow, saveRow, deleteRow, setLocalRow }) {
  const a = plan.annahmen || {};
  const mb = auswertung?.mittelbilanz || {};
  const num = (v) => v === '' || v == null ? '' : v;

  const annahmenFelder = [
    ['sozialkostenProzent', 'Sozialkosten-Aufschlag %', 24],
    ['steuersatzProzent', 'Ergebnis-Steuersatz %', 30],
    ['erloesschmaelerungProzent', 'Erlösschmälerung %', 0],
    ['umsatzsteuerProzent', 'Umsatzsteuer %', 19],
    ['zahlungszielMonate', 'Zahlungsziel Kunden (Mon.)', 0],
    ['startLiquiditaet', 'Start-Liquidität €', 0],
    ['sonstigeErtraegeMonat', 'Sonst. betr. Erträge €/Mon.', 0],
    ['zinsertraegeJahr', 'Zinserträge €/Jahr', 0],
    ['neutraleErtraegeJahr', 'Neutrale Erträge €/Jahr', 0],
    ['neutraleAufwendungenJahr', 'Neutrale Aufwend. €/Jahr', 0],
    ['privateinlagenMonat', 'Privateinlagen €/Mon.', 0],
    ['umsatzWachstumJ2', 'Umsatzwachstum J2 %', 0],
    ['umsatzWachstumJ3', 'Umsatzwachstum J3 %', 0],
    ['kostenWachstumJ2', 'Kostenwachstum J2 %', 0],
    ['kostenWachstumJ3', 'Kostenwachstum J3 %', 0],
  ];

  return (
    <>
      <div className="bp-card">
        <h3>Planungsannahmen</h3>
        <div className="bp-annahmen">
          {annahmenFelder.map((f, i) => (
            <div className="bp-field" key={f[0]}>
              <label>{f[1]}</label>
              <input className="bp-input num" type="number" step="0.01"
                defaultValue={a[f[0]] ?? f[2]}
                onBlur={(e) => setAnnahme(f[0], e.target.value === '' ? f[2] : Number(e.target.value))} />
            </div>
          ))}
        </div>
      </div>

      <div className="bp-grid2">
        <div className="bp-card">
          <h3>Investitionen <span className="hint">Mittelverwendung</span></h3>
          <LineItemTable
            columns={[
              { key: 'kategorie', label: 'Kategorie', type: 'select', options: INV_KATEGORIEN },
              { key: 'bezeichnung', label: 'Bezeichnung', type: 'text' },
              { key: 'nutzungsdauer_jahre', label: 'ND (J.)', type: 'number', align: 'right', step: '1' },
              { key: 'betrag', label: 'Betrag €', type: 'number', align: 'right' },
            ]}
            rows={plan.investitionen || []}
            onLocalChange={(id, patch) => setLocalRow('investitionen', id, patch)}
            onSaveRow={(row) => saveRow('investitionen', row)}
            onDelete={(id) => deleteRow('investitionen', id)}
            onAdd={() => addRow('investitionen', { kategorie: 'einrichtung', bezeichnung: 'Neue Position', betrag: 0, nutzungsdauer_jahre: 5, anschaffung_monat: 1 })}
            footer={<><td colSpan={3}>Gesamt</td><td className="r">{fmtEur(mb.mittelverwendung)}</td><td></td></>}
          />
        </div>

        <div className="bp-card">
          <h3>Finanzierung <span className="hint">Mittelherkunft</span></h3>
          <LineItemTable
            columns={[
              { key: 'art', label: 'Art', type: 'select', options: FIN_ARTEN },
              { key: 'bezeichnung', label: 'Bezeichnung', type: 'text' },
              { key: 'zinssatz_prozent', label: 'Zins %', type: 'number', align: 'right' },
              { key: 'laufzeit_monate', label: 'Laufz. (M.)', type: 'number', align: 'right', step: '1' },
              { key: 'betrag', label: 'Betrag €', type: 'number', align: 'right' },
            ]}
            rows={plan.finanzierung || []}
            onLocalChange={(id, patch) => setLocalRow('finanzierung', id, patch)}
            onSaveRow={(row) => saveRow('finanzierung', row)}
            onDelete={(id) => deleteRow('finanzierung', id)}
            onAdd={() => addRow('finanzierung', { art: 'eigenkapital', bezeichnung: 'Neue Position', betrag: 0, zinssatz_prozent: 0, laufzeit_monate: 0 })}
            footer={<><td colSpan={4}>Gesamt</td><td className="r">{fmtEur(mb.mittelherkunft)}</td><td></td></>}
          />
        </div>
      </div>

      <div className={'bp-balance ' + (Math.abs(mb.differenz || 0) < 1 ? 'ok' : 'warn')}>
        {Math.abs(mb.differenz || 0) < 1
          ? `✓ Mittelverwendung und Mittelherkunft sind ausgeglichen · EK-Quote ${mb.eigenkapitalquote || 0} %`
          : `⚠ Differenz: ${fmtEur(mb.differenz)} (${(mb.differenz || 0) > 0 ? 'Überdeckung' : 'Unterdeckung – noch nicht voll finanziert'})`}
      </div>

      <div className="bp-card">
        <h3>Umsatzplanung <span className="hint">Menge × Preis je Einheit (monatlich)</span></h3>
        <LineItemTable
          columns={[
            { key: 'bezeichnung', label: 'Produkt / Leistung', type: 'text' },
            { key: 'einheit', label: 'Einheit', type: 'text' },
            { key: 'menge_monatlich', label: 'Menge/Mon.', type: 'number', align: 'right' },
            { key: 'preis_einheit', label: 'Preis/Einheit €', type: 'number', align: 'right' },
          ]}
          rows={plan.umsatz || []}
          onLocalChange={(id, patch) => setLocalRow('umsatz', id, patch)}
          onSaveRow={(row) => saveRow('umsatz', row)}
          onDelete={(id) => deleteRow('umsatz', id)}
          onAdd={() => addRow('umsatz', { bezeichnung: 'Mitgliedsbeiträge', einheit: 'Mitglied', menge_monatlich: 0, preis_einheit: 0 })}
          footer={<><td colSpan={3}>Umsatz / Monat</td><td className="r">{fmtEur(auswertung?.kennzahlen?.umsatzMonat)}</td><td></td></>}
        />
      </div>

      <div className="bp-card">
        <h3>Kostenplanung <span className="hint">monatliche Beträge je Kostenart</span></h3>
        <LineItemTable
          columns={[
            { key: 'kategorie', label: 'Kostenart', type: 'select', options: KOSTEN_KATEGORIEN },
            { key: 'bezeichnung', label: 'Bezeichnung', type: 'text' },
            { key: 'ist_brutto_personal', label: 'AN-Brutto', type: 'checkbox' },
            { key: 'betrag_monatlich', label: 'Betrag/Mon. €', type: 'number', align: 'right' },
          ]}
          rows={plan.kosten || []}
          onLocalChange={(id, patch) => setLocalRow('kosten', id, patch)}
          onSaveRow={(row) => saveRow('kosten', row)}
          onDelete={(id) => deleteRow('kosten', id)}
          onAdd={() => addRow('kosten', { kategorie: 'raumkosten', bezeichnung: 'Neue Kostenposition', betrag_monatlich: 0, ist_brutto_personal: false })}
        />
        <p className="bp-sub" style={{ marginTop: '.5rem' }}>„AN-Brutto" anhaken bei Personalpositionen → Sozialkosten-Aufschlag wird automatisch ergänzt.</p>
      </div>

      <div className="bp-card">
        <h3>Privatentnahmen <span className="hint">monatlich (für Einzelunternehmer/Liquidität)</span></h3>
        <LineItemTable
          columns={[
            { key: 'kategorie', label: 'Kategorie', type: 'select', options: PRIVAT_KATEGORIEN },
            { key: 'bezeichnung', label: 'Bezeichnung', type: 'text' },
            { key: 'betrag_monatlich', label: 'Betrag/Mon. €', type: 'number', align: 'right' },
          ]}
          rows={plan.privatentnahmen || []}
          onLocalChange={(id, patch) => setLocalRow('privatentnahmen', id, patch)}
          onSaveRow={(row) => saveRow('privatentnahmen', row)}
          onDelete={(id) => deleteRow('privatentnahmen', id)}
          onAdd={() => addRow('privatentnahmen', { kategorie: 'lebenshaltung', bezeichnung: 'Lebensunterhalt', betrag_monatlich: 0 })}
        />
      </div>
    </>
  );
}

// ── Dokument & PDF ───────────────────────────────────────────────────────────────
function DokumentView({ plan, setText, saveTexte, downloadPdf, pdfBusy }) {
  const t = plan.dokument_texte || {};
  const felder = [
    ['zusammenfassung', 'Zusammenfassung (Executive Summary)'],
    ['gruenderprofil', 'Gründer & Unternehmen'],
    ['markt', 'Markt & Wettbewerb'],
    ['angebot', 'Angebot & Leistungen'],
    ['marketing', 'Marketing & Vertrieb'],
    ['swot', 'Chancen & Risiken (SWOT)'],
    ['ziele', 'Ziele (Fließtext fürs Dokument)'],
  ];
  return (
    <>
      <div className="bp-card">
        <h3>Businessplan-Texte
          <button className="bp-btn" disabled={pdfBusy} onClick={downloadPdf}>
            {pdfBusy ? 'Erzeuge PDF …' : '⬇ Als PDF herunterladen'}
          </button>
        </h3>
        <p className="bp-sub" style={{ marginTop: '-.4rem', marginBottom: '1rem' }}>
          Die Finanzteile (Investition, Rentabilität, 3-Jahres-Plan, Liquidität) werden automatisch aus der Finanzplanung erzeugt.
        </p>
        {felder.map((f, i) => (
          <div className="bp-field" key={f[0]} style={{ marginBottom: '1rem' }}>
            <label>{f[1]}</label>
            <textarea className="bp-textarea" value={t[f[0]] || ''}
              onChange={(e) => setText(f[0], e.target.value)} onBlur={saveTexte} />
          </div>
        ))}
      </div>
    </>
  );
}

// ── Ziele-Board ─────────────────────────────────────────────────────────────────
function ZieleView({ ziele, onAdd, onStatus, onDelete }) {
  return (
    <>
      <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
        <button className="bp-btn" onClick={onAdd}>+ Neues Ziel</button>
      </div>
      {ziele.length === 0 ? (
        <div className="bp-empty">Noch keine Ziele für dieses Jahr. Lege strategische Jahresziele mit KPIs an.</div>
      ) : (
        <div className="bp-ziele">
          {ziele.map((z, zi) => {
            const pct = z.zielwert > 0 ? Math.min(100, Math.round((Number(z.istwert) || 0) / Number(z.zielwert) * 100)) : 0;
            const statusLabel = (ZIEL_STATUS.find((s) => s[0] === z.status) || ['', z.status])[1];
            return (
              <div className="bp-ziel" key={z.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
                  <h4>{z.titel}</h4>
                  <button className="bp-icon-btn" onClick={() => onDelete(z.id)}>🗑</button>
                </div>
                {z.beschreibung && <p className="bp-sub">{z.beschreibung}</p>}
                {z.kpi_name && (
                  <>
                    <div className="kpi-row">
                      <strong>{fmtNum(z.istwert)}</strong>
                      <span className="bp-sub">/ {fmtNum(z.zielwert)} {z.einheit} · {z.kpi_name}</span>
                    </div>
                    <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.6rem' }}>
                  <span className={'bp-status ' + z.status}>{statusLabel}</span>
                  <select className="bp-input" style={{ width: 'auto' }} value={z.status} onChange={(e) => onStatus(z, e.target.value)}>
                    {ZIEL_STATUS.map((s, si) => <option key={si} value={s[0]}>{s[1]}</option>)}
                  </select>
                </div>
                {z.meilensteine?.length > 0 && (
                  <ul className="bp-ms">
                    {z.meilensteine.map((m, mi) => (
                      <li key={m.id} className={m.erledigt ? 'done' : ''}>{m.erledigt ? '✓' : '○'} {m.titel}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── „Noch fehlend"-Hinweis ────────────────────────────────────────────────────────
// Zeigt an, welche Bereiche des Plans noch keine Werte enthalten.
function MissingHint({ plan, auswertung, onGoto }) {
  if (!plan) return null;
  const t = plan.dokument_texte || {};
  const items = [];

  if (!(plan.umsatz?.length))         items.push(['Umsatzpositionen erfassen', 'finanzplanung']);
  if (!(plan.kosten?.length))         items.push(['Kostenpositionen erfassen', 'finanzplanung']);
  if (!(plan.investitionen?.length))  items.push(['Investitionen erfassen (optional)', 'finanzplanung']);
  if (!(plan.finanzierung?.length))   items.push(['Finanzierung erfassen (Eigenkapital/Darlehen)', 'finanzplanung']);

  const mb = auswertung?.mittelbilanz;
  if (mb && Math.abs(mb.differenz || 0) >= 1 && (plan.investitionen?.length || plan.finanzierung?.length))
    items.push(['Mittelverwendung und -herkunft ausgleichen', 'finanzplanung']);

  const pflichtTexte = [['zusammenfassung', 'Zusammenfassung'], ['markt', 'Markt & Wettbewerb'], ['angebot', 'Angebot']];
  const fehlendeTexte = pflichtTexte.filter((f) => !(t[f[0]] || '').trim()).map((f) => f[1]);
  if (fehlendeTexte.length) items.push([`Texte ergänzen: ${fehlendeTexte.join(', ')}`, 'dokument']);

  if (items.length === 0) {
    return <div className="bp-balance ok" style={{ marginBottom: '1.25rem' }}>✓ Alle Kernbereiche enthalten Werte — der Plan ist vollständig ausgefüllt.</div>;
  }

  return (
    <div className="bp-card" style={{ borderColor: 'rgba(224,112,26,.4)' }}>
      <h3>⚠️ Noch auszufüllen <span className="hint">{items.length} offen</span></h3>
      <ul className="bp-ms">
        {items.map((it, i) => (
          <li key={i} style={{ cursor: 'pointer' }} onClick={() => onGoto(it[1])}>
            ○ <span style={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{it[0]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Modals ──────────────────────────────────────────────────────────────────────
function CreatePlanModal({ onClose, onCreate, withDojo }) {
  const [step, setStep] = useState('quelle'); // 'quelle' | 'details'
  const [ausIst, setAusIst] = useState(true);
  const [ist, setIst] = useState(null);
  const [istLoading, setIstLoading] = useState(true);
  const [titel, setTitel] = useState('');
  const [firmenname, setFirmenname] = useState('');
  const [rechtsform, setRechtsform] = useState('');
  const [jahr, setJahr] = useState(new Date().getFullYear());

  useEffect(() => {
    let aktiv = true;
    axios.get(withDojo('/businessplan/ist-kennzahlen'))
      .then((res) => { if (aktiv) setIst(res.data); })
      .catch(() => { if (aktiv) setIst(null); })
      .finally(() => { if (aktiv) setIstLoading(false); });
    return () => { aktiv = false; };
  }, [withDojo]);

  const hatIst = ist && ist.aktuelleMitglieder > 0;

  return createPortal(
    <div className="bp-modal-overlay" onClick={onClose}>
      <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
        {step === 'quelle' ? (
          <>
            <h3>Neuen Businessplan anlegen</h3>
            <p className="bp-sub" style={{ marginTop: '-.5rem', marginBottom: '1rem' }}>
              Wie soll der Plan starten?
            </p>

            <label className={'bp-choice' + (ausIst ? ' active' : '')} onClick={() => setAusIst(true)}
              style={choiceStyle(ausIst)}>
              <strong>📊 Aus vorhandenen Werten</strong>
              <div className="bp-sub">
                {istLoading ? 'Lade Ist-Daten …'
                  : hatIst ? `Übernimmt ${fmtNum(ist.aktuelleMitglieder)} aktive Mitglieder × Ø ${fmtEur(ist.durchschnittsbeitrag)} Beitrag als Umsatzbasis. Der Rest (Kosten, Investitionen, Finanzierung) wird manuell ergänzt.`
                  : 'Keine ausreichenden Ist-Daten vorhanden — bitte „komplett neu" wählen.'}
              </div>
            </label>

            <label className={'bp-choice' + (!ausIst ? ' active' : '')} onClick={() => setAusIst(false)}
              style={choiceStyle(!ausIst)}>
              <strong>📝 Komplett neu</strong>
              <div className="bp-sub">Leerer Plan — alle Werte werden selbst eingetragen.</div>
            </label>

            <div className="bp-modal-actions">
              <button className="bp-btn ghost" onClick={onClose}>Abbrechen</button>
              <button className="bp-btn" onClick={() => setStep('details')}>Weiter →</button>
            </div>
          </>
        ) : (
          <>
            <h3>Plan-Details</h3>
            {ausIst && hatIst && (
              <div className="bp-balance ok" style={{ marginBottom: '1rem' }}>
                ✓ Umsatzbasis aus Ist-Daten wird übernommen ({fmtNum(ist.aktuelleMitglieder)} Mitglieder)
              </div>
            )}
            <div className="bp-field"><label>Titel</label>
              <input className="bp-input" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={`Businessplan ${jahr}`} /></div>
            <div className="bp-field"><label>Firmenname (optional)</label>
              <input className="bp-input" value={firmenname} onChange={(e) => setFirmenname(e.target.value)} /></div>
            <div className="bp-field"><label>Rechtsform (optional)</label>
              <input className="bp-input" value={rechtsform} onChange={(e) => setRechtsform(e.target.value)} placeholder="z.B. Einzelunternehmen, GmbH" /></div>
            <div className="bp-field"><label>Planungsjahr</label>
              <input className="bp-input num" type="number" value={jahr} onChange={(e) => setJahr(Number(e.target.value))} /></div>
            <div className="bp-modal-actions">
              <button className="bp-btn ghost" onClick={() => setStep('quelle')}>← Zurück</button>
              <button className="bp-btn" onClick={() => onCreate({ titel, firmenname, rechtsform, planungsjahr: jahr, ausIst: ausIst && hatIst })}>Anlegen</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function choiceStyle(active) {
  return {
    display: 'block', padding: '.9rem 1rem', marginBottom: '.7rem', borderRadius: 10, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent,#e0701a)' : 'var(--border-color,#34344a)'}`,
    background: active ? 'rgba(224,112,26,.08)' : 'transparent',
  };
}

function ZielModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ titel: '', beschreibung: '', kpi_name: '', zielwert: '', einheit: '', status: 'offen' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return createPortal(
    <div className="bp-modal-overlay" onClick={onClose}>
      <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Neues Ziel</h3>
        <div className="bp-field"><label>Titel</label>
          <input className="bp-input" value={form.titel} onChange={(e) => set('titel', e.target.value)} /></div>
        <div className="bp-field"><label>Beschreibung</label>
          <textarea className="bp-textarea" style={{ minHeight: 70 }} value={form.beschreibung} onChange={(e) => set('beschreibung', e.target.value)} /></div>
        <div className="bp-annahmen">
          <div className="bp-field"><label>KPI-Name</label>
            <input className="bp-input" value={form.kpi_name} onChange={(e) => set('kpi_name', e.target.value)} placeholder="z.B. Mitglieder" /></div>
          <div className="bp-field"><label>Zielwert</label>
            <input className="bp-input num" type="number" value={form.zielwert} onChange={(e) => set('zielwert', e.target.value)} /></div>
          <div className="bp-field"><label>Einheit</label>
            <input className="bp-input" value={form.einheit} onChange={(e) => set('einheit', e.target.value)} placeholder="z.B. Stück, €" /></div>
        </div>
        <div className="bp-modal-actions">
          <button className="bp-btn ghost" onClick={onClose}>Abbrechen</button>
          <button className="bp-btn" disabled={!form.titel} onClick={() => onCreate(form)}>Anlegen</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
