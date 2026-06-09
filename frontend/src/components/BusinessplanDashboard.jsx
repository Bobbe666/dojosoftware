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
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

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
// Kostenarten ohne Personal (Personal hat eigenen Schritt)
const KOSTEN_KATEGORIEN = [
  ['material', 'Material/Wareneinsatz'], ['fremdleistung', 'Fremdleistungen'],
  ['raumkosten', 'Raumkosten'], ['versicherungen', 'Versicherungen/Beiträge'], ['kfz', 'Kfz-Kosten'],
  ['werbung', 'Werbe-/Reisekosten'], ['warenabgabe', 'Kosten der Warenabgabe'],
  ['reparatur', 'Reparatur/Instandhaltung'],
  ['sonstige_steuern', 'sonstige Steuern'], ['sonstige', 'sonstige Aufwendungen'],
];
const PERSONALARTEN = [
  ['sv_pflichtig', 'SV-pflichtig'], ['geringfuegig', 'Geringfügig (Minijob)'], ['sv_befreit', 'SV-befreit'],
];
const PRIVAT_KATEGORIEN = [
  ['lebenshaltung', 'Lebenshaltung'], ['sonderausgaben', 'Sonderausgaben (Versicherungen)'],
  ['einkommensteuer', 'Einkommensteuer'], ['sonstiges', 'Sonstiges'],
];
const ZIEL_STATUS = [
  ['offen', 'Offen'], ['laeuft', 'In Arbeit'], ['erreicht', 'Erreicht'], ['verfehlt', 'Verfehlt'],
];

const WIZARD_STEPS = [
  { key: 'start', label: 'Stammdaten', icon: '①' },
  { key: 'investition', label: 'Investition', icon: '②' },
  { key: 'finanzierung', label: 'Finanzierung', icon: '③' },
  { key: 'umsatz', label: 'Umsatz', icon: '④' },
  { key: 'kosten', label: 'Kosten', icon: '⑤' },
  { key: 'personal', label: 'Personal', icon: '⑥' },
  { key: 'privat', label: 'Privatentnahmen', icon: '⑦' },
  { key: 'dokument', label: 'Texte & PDF', icon: '⑧' },
  { key: 'auswertung', label: 'Auswertung', icon: '✓' },
];

// ── Editierbare Positions-Tabelle mit optionaler Monats-Eingabe ───────────────────
function PositionTable({ columns, rows, monthField, constField, onLocalChange, onSaveRow, onDelete, onAdd }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const istProMonat = (row) => Array.isArray(row[monthField]);
  const setProMonat = (row, on) => {
    const val = on ? Array(12).fill(Number(row[constField]) || 0) : null;
    onLocalChange(row.id, { [monthField]: val });
    onSaveRow({ ...row, [monthField]: val });
    if (on) setExpanded((e) => ({ ...e, [row.id]: true }));
  };
  const setMonthVal = (row, mi, value) => {
    const arr = Array.isArray(row[monthField]) ? [...row[monthField]] : Array(12).fill(0);
    arr[mi] = value;
    onLocalChange(row.id, { [monthField]: arr });
  };

  return (
    <>
      <div className="bp-tablewrap">
        <table className="bp-table">
          <thead>
            <tr>
              {columns.map((c, ci) => <th key={ci} className={c.align === 'right' ? 'r' : ''}>{c.label}</th>)}
              {monthField && <th style={{ width: 40 }} title="Monatsgenaue Eingage"></th>}
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + (monthField ? 2 : 1)} className="bp-td-empty">Noch keine Positionen.</td></tr>
            )}
            {rows.map((row) => (
              <React.Fragment key={row.id}>
                <tr>
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
                      ) : (c.key === constField && istProMonat(row)) ? (
                        <input className="bp-input num" type="text" disabled title="Monatswerte aktiv – Durchschnitt; zum Bearbeiten 📅 öffnen"
                          value={'Ø ' + fmtNum(Math.round(row[monthField].reduce((s, v) => s + (Number(v) || 0), 0) / 12))} />
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
                  {monthField && (
                    <td className="r">
                      <button className={'bp-cal-btn' + (istProMonat(row) ? ' on' : '')}
                        title={istProMonat(row) ? 'Monatswerte aktiv — klicken zum Aufklappen' : 'Pro Monat eingeben'}
                        onClick={() => istProMonat(row) ? toggle(row.id) : setProMonat(row, true)}>📅</button>
                    </td>
                  )}
                  <td className="r">
                    <button className="bp-icon-btn" title="Löschen" onClick={() => onDelete(row.id)}>🗑</button>
                  </td>
                </tr>
                {monthField && istProMonat(row) && expanded[row.id] && (
                  <tr className="bp-monthrow">
                    <td colSpan={columns.length + 2}>
                      <div className="bp-months">
                        {MONATE.map((mname, mi) => (
                          <label key={mi} className="bp-month">
                            <span>{mname}</span>
                            <input className="bp-input num" type="number" step="0.01"
                              value={row[monthField][mi] ?? ''}
                              onChange={(e) => setMonthVal(row, mi, e.target.value)}
                              onBlur={() => onSaveRow(row)} />
                          </label>
                        ))}
                        <button className="bp-btn ghost sm" onClick={() => setProMonat(row, false)}>↩ Konstant</button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <button className="bp-btn add" onClick={onAdd}>+ Position hinzufügen</button>
    </>
  );
}

export default function BusinessplanDashboard() {
  const { activeDojo, dojos } = useDojoContext();
  const { hasFeature } = useSubscription();

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
  const [step, setStep] = useState('start');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showZiel, setShowZiel] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [error, setError] = useState(null);

  const istFeature = hasFeature('businessplan');

  // ── Laden ───────────────────────────────────────────────────────────────────
  const loadPlaene = useCallback(async () => {
    try {
      const res = await axios.get(withDojo('/businessplan/plaene'));
      setPlaene(res.data || []);
      if (res.data?.length && !planId) setPlanId(res.data[0].id);
      if (!res.data?.length) setPlanId(null);
      setError(null);
    } catch (err) {
      setError(typeof err.response?.data?.error === 'string' ? err.response.data.error : 'Fehler beim Laden der Pläne');
    } finally { setLoading(false); }
  }, [withDojo, planId]);

  const loadPlan = useCallback(async () => {
    if (!planId) { setPlan(null); return; }
    try {
      const res = await axios.get(withDojo(`/businessplan/plaene/${planId}`));
      setPlan(res.data);
    } catch (err) { setPlan(null); }
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
  const setLocalRow = (resource, id, patch) =>
    setPlan((p) => p ? { ...p, [resource]: p[resource].map((r) => r.id === id ? { ...r, ...patch } : r) } : p);

  const saveRow = async (resource, row) => {
    try { await axios.put(withDojo(`/businessplan/${resource}/${row.id}`), row); loadAuswertung(); } catch (err) {}
  };
  const addRow = async (resource, defaults) => {
    try { await axios.post(withDojo(`/businessplan/plaene/${planId}/${resource}`), defaults); loadPlan(); }
    catch (err) { setError(typeof err.response?.data?.error === 'string' ? err.response.data.error : 'Fehler beim Hinzufügen'); }
  };
  const deleteRow = async (resource, id) => {
    try { await axios.delete(withDojo(`/businessplan/${resource}/${id}`)); loadPlan(); loadAuswertung(); } catch (err) {}
  };

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
    } catch (err) {}
  };
  const setAnnahme = (key, value) => savePlanPatch({ annahmen: { ...(plan.annahmen || {}), [key]: value } });
  const setText = (key, value) => setPlan((p) => ({ ...p, dokument_texte: { ...(p.dokument_texte || {}), [key]: value } }));
  const saveTexte = () => savePlanPatch({ dokument_texte: plan.dokument_texte || {} });

  const createPlan = async (data) => {
    try {
      const res = await axios.post(withDojo('/businessplan/plaene'), data);
      setShowCreate(false);
      await loadPlaene();
      setPlanId(res.data.id);
      setStep('start');
    } catch (err) { setError(typeof err.response?.data?.error === 'string' ? err.response.data.error : 'Fehler beim Anlegen'); }
  };
  const deletePlan = async () => {
    if (!window.confirm('Diesen Businessplan wirklich löschen?')) return;
    try { await axios.delete(withDojo(`/businessplan/plaene/${planId}`)); setPlanId(null); setPlan(null); loadPlaene(); } catch (err) {}
  };
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await axios.get(withDojo(`/businessplan/plaene/${planId}/pdf`), { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `Businessplan_${plan?.planungsjahr || ''}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (err) { setError('PDF-Generierung fehlgeschlagen.'); } finally { setPdfBusy(false); }
  };

  const syncBuchhaltung = async () => {
    setSyncBusy(true);
    try {
      const r = await axios.post(withDojo(`/businessplan/plaene/${planId}/sync`));
      await loadPlan(); await loadAuswertung();
      setError(null);
      window.alert(`Aktualisiert: ${r.data.umsatz} Einnahme- und ${r.data.kosten} Kostenpositionen aus der Buchhaltung übernommen.`);
    } catch (e) {
      setError(typeof e.response?.data?.error === 'string' ? e.response.data.error : 'Aktualisieren fehlgeschlagen');
    } finally { setSyncBusy(false); }
  };

  const createZiel = async (data) => {
    try { await axios.post(withDojo('/businessplan/ziele'), { ...data, jahr: plan.planungsjahr }); setShowZiel(false); loadZiele(); }
    catch (err) { setError('Fehler beim Anlegen des Ziels'); }
  };
  const updateZielStatus = async (z, status) => {
    try { await axios.put(withDojo(`/businessplan/ziele/${z.id}`), { ...z, status }); loadZiele(); } catch (err) {}
  };
  const deleteZiel = async (id) => {
    if (!window.confirm('Ziel löschen?')) return;
    try { await axios.delete(withDojo(`/businessplan/ziele/${id}`)); loadZiele(); } catch (err) {}
  };

  // ── Gates ───────────────────────────────────────────────────────────────────
  if (!istFeature) {
    return (
      <div className="bp-wrap"><div className="bp-upgrade">
        <div className="icon">📈</div>
        <h3>Businessplan & Finanzplanung</h3>
        <p>Vollständige Finanz- und Liquiditätsplanung, generierbarer Businessplan als PDF und strategisches Ziele-Board. Verfügbar im <strong>Enterprise-Plan</strong>.</p>
        <button className="bp-btn" onClick={() => { window.location.href = '/dashboard/plan'; }}>Jetzt upgraden →</button>
      </div></div>
    );
  }
  if (!dojoId) {
    return (
      <div className="bp-wrap">
        <div className="bp-head"><div><h2>📈 Businessplan</h2></div></div>
        <div className="bp-empty">
          <p>Bitte oben rechts ein <strong>konkretes Dojo</strong> auswählen.</p>
          <p className="bp-sub">Der Businessplan wird pro Dojo erstellt.</p>
        </div>
      </div>
    );
  }

  const stepIdx = WIZARD_STEPS.findIndex((s) => s.key === step);
  const gotoStep = (k) => setStep(k);
  const next = () => stepIdx < WIZARD_STEPS.length - 1 && setStep(WIZARD_STEPS[stepIdx + 1].key);
  const prev = () => stepIdx > 0 && setStep(WIZARD_STEPS[stepIdx - 1].key);

  return (
    <div className="bp-wrap">
      <div className="bp-head">
        <div>
          <h2>📈 Businessplan</h2>
          <div className="bp-sub">Finanz- & Liquiditätsplanung · geführter Assistent</div>
        </div>
        <div className="bp-plan-select">
          {plaene.length > 0 && (
            <select value={planId || ''} onChange={(e) => setPlanId(Number(e.target.value))}>
              {plaene.map((p) => <option key={p.id} value={p.id}>{p.titel} ({p.planungsjahr})</option>)}
            </select>
          )}
          {plan?.annahmen?.datenquelle?.dojoId && (
            <button className="bp-btn ghost" disabled={syncBusy} onClick={syncBuchhaltung}
              title="Einnahmen & Kosten erneut aus der Buchhaltung übernehmen">
              {syncBusy ? '🔄 …' : '🔄 Aus Buchhaltung aktualisieren'}
            </button>
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
          {/* Wizard-Fortschritt */}
          <div className="bp-stepper">
            {WIZARD_STEPS.map((s, i) => (
              <button key={s.key} className={'bp-stepitem' + (s.key === step ? ' active' : '') + (i < stepIdx ? ' done' : '')}
                onClick={() => gotoStep(s.key)}>
                <span className="dot">{i < stepIdx ? '✓' : s.icon}</span>
                <span className="lbl">{s.label}</span>
              </button>
            ))}
          </div>

          <div className="bp-step">
            {step === 'start' && <StartStep plan={plan} setAnnahme={setAnnahme} savePlanPatch={savePlanPatch} />}
            {step === 'investition' && (
              <StepCard title="Investitionen & AfA" hint="Was wird angeschafft? AfA-Satz % oder Nutzungsdauer (Jahre) bestimmt die Abschreibung.">
                <PositionTable
                  columns={[
                    { key: 'kategorie', label: 'Kategorie', type: 'select', options: INV_KATEGORIEN },
                    { key: 'bezeichnung', label: 'Bezeichnung', type: 'text' },
                    { key: 'betrag', label: 'Betrag €', type: 'number', align: 'right' },
                    { key: 'nutzungsdauer_jahre', label: 'ND (J.)', type: 'number', align: 'right', step: '1' },
                    { key: 'afa_satz_prozent', label: 'AfA %', type: 'number', align: 'right' },
                    { key: 'anschaffung_monat', label: 'Monat', type: 'number', align: 'right', step: '1' },
                  ]}
                  rows={plan.investitionen || []}
                  onLocalChange={(id, p) => setLocalRow('investitionen', id, p)}
                  onSaveRow={(r) => saveRow('investitionen', r)}
                  onDelete={(id) => deleteRow('investitionen', id)}
                  onAdd={() => addRow('investitionen', { kategorie: 'einrichtung', bezeichnung: 'Neue Position', betrag: 0, nutzungsdauer_jahre: 5, anschaffung_monat: 1 })}
                />
                <Summe label="Gesamtinvestition" value={auswertung?.mittelbilanz?.mittelverwendung} />
              </StepCard>
            )}
            {step === 'finanzierung' && (
              <StepCard title="Finanzierung & Kapitaldienst" hint="Woher kommt das Geld? Bei Darlehen: Zins %, Laufzeit, tilgungsfreie Monate und Auszahlmonat.">
                <PositionTable
                  columns={[
                    { key: 'art', label: 'Art', type: 'select', options: FIN_ARTEN },
                    { key: 'bezeichnung', label: 'Bezeichnung', type: 'text' },
                    { key: 'betrag', label: 'Betrag €', type: 'number', align: 'right' },
                    { key: 'zinssatz_prozent', label: 'Zins %', type: 'number', align: 'right' },
                    { key: 'laufzeit_monate', label: 'Laufz.(M)', type: 'number', align: 'right', step: '1' },
                    { key: 'tilgungsfrei_monate', label: 'tilg.frei', type: 'number', align: 'right', step: '1' },
                    { key: 'auszahlung_monat', label: 'Auszahl.M', type: 'number', align: 'right', step: '1' },
                  ]}
                  rows={plan.finanzierung || []}
                  onLocalChange={(id, p) => setLocalRow('finanzierung', id, p)}
                  onSaveRow={(r) => saveRow('finanzierung', r)}
                  onDelete={(id) => deleteRow('finanzierung', id)}
                  onAdd={() => addRow('finanzierung', { art: 'eigenkapital', bezeichnung: 'Neue Position', betrag: 0 })}
                />
                <Mittelbilanz mb={auswertung?.mittelbilanz} />
              </StepCard>
            )}
            {step === 'umsatz' && (
              <StepCard title="Umsatzplanung" hint="Menge × Preis je Einheit. Mit 📅 die Menge je Einzelmonat eingeben (Saisonalität, Hochlauf).">
                <PositionTable
                  monthField="mengen_monate" constField="menge_monatlich"
                  columns={[
                    { key: 'bezeichnung', label: 'Produkt / Leistung', type: 'text' },
                    { key: 'einheit', label: 'Einheit', type: 'text' },
                    { key: 'menge_monatlich', label: 'Menge/Mon.', type: 'number', align: 'right' },
                    { key: 'preis_einheit', label: 'Preis/Einheit €', type: 'number', align: 'right' },
                  ]}
                  rows={plan.umsatz || []}
                  onLocalChange={(id, p) => setLocalRow('umsatz', id, p)}
                  onSaveRow={(r) => saveRow('umsatz', r)}
                  onDelete={(id) => deleteRow('umsatz', id)}
                  onAdd={() => addRow('umsatz', { bezeichnung: 'Mitgliedsbeiträge', einheit: 'Mitglied', menge_monatlich: 0, preis_einheit: 0 })}
                />
                <Summe label="Umsatz / Monat (Ø)" value={auswertung?.kennzahlen?.umsatzMonat} />
              </StepCard>
            )}
            {step === 'kosten' && (
              <StepCard title="Kostenplanung" hint="Laufende Betriebskosten je Kostenart. Mit 📅 Beträge je Einzelmonat.">
                <PositionTable
                  monthField="betraege_monate" constField="betrag_monatlich"
                  columns={[
                    { key: 'kategorie', label: 'Kostenart', type: 'select', options: KOSTEN_KATEGORIEN },
                    { key: 'bezeichnung', label: 'Bezeichnung', type: 'text' },
                    { key: 'betrag_monatlich', label: 'Betrag/Mon. €', type: 'number', align: 'right' },
                  ]}
                  rows={(plan.kosten || []).filter((k) => k.kategorie !== 'personal')}
                  onLocalChange={(id, p) => setLocalRow('kosten', id, p)}
                  onSaveRow={(r) => saveRow('kosten', r)}
                  onDelete={(id) => deleteRow('kosten', id)}
                  onAdd={() => addRow('kosten', { kategorie: 'raumkosten', bezeichnung: 'Neue Kostenposition', betrag_monatlich: 0 })}
                />
              </StepCard>
            )}
            {step === 'personal' && (
              <StepCard title="Personalplanung" hint="Mitarbeiter mit Funktion und Art. Häkchen Brutto = Sozialkosten-Aufschlag je Art wird ergänzt (Sätze in Stammdaten).">
                <PositionTable
                  monthField="betraege_monate" constField="betrag_monatlich"
                  columns={[
                    { key: 'bezeichnung', label: 'Mitarbeiter', type: 'text' },
                    { key: 'funktion', label: 'Funktion', type: 'text' },
                    { key: 'personalart', label: 'Art', type: 'select', options: [['', '—'], ...PERSONALARTEN] },
                    { key: 'ist_brutto_personal', label: 'Brutto', type: 'checkbox' },
                    { key: 'betrag_monatlich', label: 'Lohn/Mon. €', type: 'number', align: 'right' },
                  ]}
                  rows={(plan.kosten || []).filter((k) => k.kategorie === 'personal')}
                  onLocalChange={(id, p) => setLocalRow('kosten', id, p)}
                  onSaveRow={(r) => saveRow('kosten', r)}
                  onDelete={(id) => deleteRow('kosten', id)}
                  onAdd={() => addRow('kosten', { kategorie: 'personal', bezeichnung: 'Neuer Mitarbeiter', betrag_monatlich: 0, ist_brutto_personal: true, personalart: 'sv_pflichtig' })}
                />
              </StepCard>
            )}
            {step === 'privat' && (
              <StepCard title="Privatentnahmen" hint="Lebenshaltung, Versicherungen, Einkommensteuer (für Einzelunternehmer). Mit 📅 je Monat.">
                <PositionTable
                  monthField="betraege_monate" constField="betrag_monatlich"
                  columns={[
                    { key: 'kategorie', label: 'Kategorie', type: 'select', options: PRIVAT_KATEGORIEN },
                    { key: 'bezeichnung', label: 'Bezeichnung', type: 'text' },
                    { key: 'betrag_monatlich', label: 'Betrag/Mon. €', type: 'number', align: 'right' },
                  ]}
                  rows={plan.privatentnahmen || []}
                  onLocalChange={(id, p) => setLocalRow('privatentnahmen', id, p)}
                  onSaveRow={(r) => saveRow('privatentnahmen', r)}
                  onDelete={(id) => deleteRow('privatentnahmen', id)}
                  onAdd={() => addRow('privatentnahmen', { kategorie: 'lebenshaltung', bezeichnung: 'Lebensunterhalt', betrag_monatlich: 0 })}
                />
              </StepCard>
            )}
            {step === 'dokument' && (
              <DokumentStep plan={plan} setText={setText} saveTexte={saveTexte} downloadPdf={downloadPdf} pdfBusy={pdfBusy} />
            )}
            {step === 'auswertung' && (
              <AuswertungStep auswertung={auswertung} ziele={ziele}
                onAddZiel={() => setShowZiel(true)} onZielStatus={updateZielStatus} onDeleteZiel={deleteZiel}
                downloadPdf={downloadPdf} pdfBusy={pdfBusy} />
            )}
          </div>

          {/* Wizard-Navigation */}
          <div className="bp-nav-bar">
            <button className="bp-btn ghost" onClick={prev} disabled={stepIdx === 0}>← Zurück</button>
            <div className="bp-nav-mid">
              <button className="bp-btn ghost danger" onClick={deletePlan}>Plan löschen</button>
            </div>
            {stepIdx < WIZARD_STEPS.length - 1
              ? <button className="bp-btn" onClick={next}>Weiter →</button>
              : <button className="bp-btn" disabled={pdfBusy} onClick={downloadPdf}>{pdfBusy ? 'Erzeuge PDF …' : '⬇ Businessplan-PDF'}</button>}
          </div>
        </>
      )}

      {showCreate && <CreatePlanModal onClose={() => setShowCreate(false)} onCreate={createPlan} withDojo={withDojo} dojos={dojos || []} dojoId={dojoId} />}
      {showZiel && <ZielModal onClose={() => setShowZiel(false)} onCreate={createZiel} />}
    </div>
  );
}

// ── Kleine Bausteine ──────────────────────────────────────────────────────────
function StepCard({ title, hint, children }) {
  return (
    <div className="bp-card">
      <h3>{title}</h3>
      {hint && <p className="bp-hint">{hint}</p>}
      {children}
    </div>
  );
}
function Summe({ label, value }) {
  return <div className="bp-summe"><span>{label}</span><strong>{fmtEur(value)}</strong></div>;
}
function Mittelbilanz({ mb }) {
  if (!mb) return null;
  const ok = Math.abs(mb.differenz || 0) < 1;
  return (
    <div className={'bp-balance ' + (ok ? 'ok' : 'warn')} style={{ marginTop: '.75rem' }}>
      {ok
        ? `✓ Mittelverwendung (${fmtEur(mb.mittelverwendung)}) = Mittelherkunft (${fmtEur(mb.mittelherkunft)}) · EK-Quote ${mb.eigenkapitalquote || 0} %`
        : `⚠ Differenz: ${fmtEur(mb.differenz)} (${(mb.differenz || 0) > 0 ? 'Überdeckung' : 'Unterdeckung – noch nicht voll finanziert'}) · EK-Quote ${mb.eigenkapitalquote || 0} %`}
    </div>
  );
}

// ── Schritt 1: Stammdaten + Annahmen ──────────────────────────────────────────
function StartStep({ plan, setAnnahme, savePlanPatch }) {
  const a = plan.annahmen || {};
  const felder = [
    ['sozialSvPflichtigProzent', 'Sozialkosten SV-pflichtig %', 24],
    ['sozialGeringfuegigProzent', 'Sozialkosten geringfügig %', 28],
    ['sozialBefreitProzent', 'Sozialkosten SV-befreit %', 0],
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
      <StepCard title="Stammdaten" hint="Eckdaten des Vorhabens.">
        <div className="bp-annahmen">
          <div className="bp-field"><label>Titel</label>
            <input className="bp-input" defaultValue={plan.titel || ''} onBlur={(e) => savePlanPatch({ titel: e.target.value })} /></div>
          <div className="bp-field"><label>Firmenname</label>
            <input className="bp-input" defaultValue={plan.firmenname || ''} onBlur={(e) => savePlanPatch({ firmenname: e.target.value })} /></div>
          <div className="bp-field"><label>Rechtsform</label>
            <input className="bp-input" defaultValue={plan.rechtsform || ''} placeholder="z.B. Einzelunternehmen" onBlur={(e) => savePlanPatch({ rechtsform: e.target.value })} /></div>
          <div className="bp-field"><label>Planungsjahr</label>
            <input className="bp-input num" type="number" defaultValue={plan.planungsjahr} onBlur={(e) => savePlanPatch({ planungsjahr: Number(e.target.value) })} /></div>
        </div>
      </StepCard>
      <StepCard title="Planungsannahmen" hint="Sätze & Parameter für Rentabilität und Liquidität.">
        <div className="bp-annahmen">
          {felder.map((f) => (
            <div className="bp-field" key={f[0]}>
              <label>{f[1]}</label>
              <input className="bp-input num" type="number" step="0.01" defaultValue={a[f[0]] ?? f[2]}
                onBlur={(e) => setAnnahme(f[0], e.target.value === '' ? f[2] : Number(e.target.value))} />
            </div>
          ))}
        </div>
      </StepCard>
    </>
  );
}

// ── Schritt: Dokument-Texte ───────────────────────────────────────────────────
function DokumentStep({ plan, setText, saveTexte, downloadPdf, pdfBusy }) {
  const t = plan.dokument_texte || {};
  const felder = [
    ['zusammenfassung', 'Zusammenfassung (Executive Summary)'],
    ['gruenderprofil', 'Gründer & Unternehmen'],
    ['markt', 'Markt & Wettbewerb'],
    ['angebot', 'Angebot & Leistungen'],
    ['marketing', 'Marketing & Vertrieb'],
    ['swot', 'Chancen & Risiken (SWOT)'],
    ['ziele', 'Ziele (Fließtext)'],
  ];
  return (
    <StepCard title="Businessplan-Texte" hint="Die Finanzteile werden automatisch aus deinen Eingaben erzeugt.">
      <div style={{ textAlign: 'right', marginBottom: '.75rem' }}>
        <button className="bp-btn" disabled={pdfBusy} onClick={downloadPdf}>{pdfBusy ? 'Erzeuge PDF …' : '⬇ Als PDF herunterladen'}</button>
      </div>
      {felder.map((f) => (
        <div className="bp-field" key={f[0]} style={{ marginBottom: '1rem' }}>
          <label>{f[1]}</label>
          <textarea className="bp-textarea" value={t[f[0]] || ''} onChange={(e) => setText(f[0], e.target.value)} onBlur={saveTexte} />
        </div>
      ))}
    </StepCard>
  );
}

// ── Schritt: Auswertung ───────────────────────────────────────────────────────
function AuswertungStep({ auswertung, ziele, onAddZiel, onZielStatus, onDeleteZiel, downloadPdf, pdfBusy }) {
  if (!auswertung) return <div className="bp-empty">Keine Auswertung verfügbar.</div>;
  const k = auswertung.kennzahlen || {};
  const r = auswertung.rentabilitaet || {};
  const liq = auswertung.liquiditaet || [];
  const drei = auswertung.dreiJahresPlan || [];

  const renta = [
    ['Umsatzerlöse', r.umsatzerloese], ['– Erlösschmälerung', -r.erloesschmaelerung],
    ['= Gesamtleistung', r.gesamtleistung, true],
    ['– Material/Wareneinsatz', -r.material], ['– Fremdleistungen', -r.fremdleistungen],
    ['= Rohertrag', r.rohertrag, true], ['+ sonstige betr. Erträge', r.sonstigeErtraege],
    ['– Personalaufwand', -r.personalaufwand], ['– Raumkosten', -r.raumkosten],
    ['– Versicherungen', -r.versicherungen], ['– Kfz-Kosten', -r.kfzKosten],
    ['– Werbe-/Reisekosten', -r.werbekosten], ['– Kosten Warenabgabe', -r.kostenWarenabgabe],
    ['– Reparatur/Instandh.', -r.reparaturkosten], ['– sonstige Steuern', -r.sonstigeSteuern],
    ['– sonstige Aufwendungen', -r.sonstigeAufwendungen], ['– Abschreibungen (AfA)', -r.abschreibungen],
    ['+ Zinserträge', r.zinsertraege], ['– Zinsaufwendungen', -r.zinsaufwendungen],
    ['+ neutrale Erträge', r.neutraleErtraege], ['– neutrale Aufwendungen', -r.neutraleAufwendungen],
    ['= Ergebnis vor Steuern', r.ergebnisVorSteuern, true], ['– Ergebnis-Steuern', -r.steuern],
    ['= Betriebsergebnis', r.betriebsergebnis, true], ['+ Abschreibungen', r.abschreibungen],
    ['= Cash-flow', r.cashflow, true], ['– Privatentnahmen', -r.privatentnahmen],
    ['+ Privateinlagen', r.privateinlagen], ['– Tilgung', -r.tilgung],
    ['= Liquiditätsergebnis', r.liquiditaetsergebnis, true],
  ].filter((row) => row[2] || Math.abs(Number(row[1]) || 0) > 0.005);

  return (
    <>
      <div className="bp-kpis">
        {k.mitgliederStart != null && (
          <div className="bp-kpi"><div className="label">Mitglieder Start → Ende</div><div className="value">{fmtNum(k.mitgliederStart)} → {fmtNum(k.mitgliederEnde)}</div></div>
        )}
        <div className="bp-kpi"><div className="label">Umsatz / Jahr</div><div className="value">{fmtEur(k.umsatzJahr)}</div></div>
        <div className="bp-kpi"><div className="label">Betriebsergebnis</div><div className={'value ' + cls(k.betriebsergebnisJahr)}>{fmtEur(k.betriebsergebnisJahr)}</div></div>
        <div className="bp-kpi"><div className="label">Cash-flow</div><div className={'value ' + cls(k.cashflowJahr)}>{fmtEur(k.cashflowJahr)}</div></div>
        <div className="bp-kpi"><div className="label">Tiefster Saldo</div><div className={'value ' + cls(k.tiefsterSaldo)}>{fmtEur(k.tiefsterSaldo)}</div></div>
      </div>

      {Array.isArray(auswertung.mitgliederVerlauf) && (
        <div className="bp-card">
          <h3>Mitgliederentwicklung {drei[0]?.jahr || ''}</h3>
          <MemberBars data={auswertung.mitgliederVerlauf} />
          {Array.isArray(auswertung.mitgliederGruppen) && auswertung.mitgliederGruppen.length > 0 && (
            <div className="bp-tablewrap" style={{ marginTop: '1rem' }}>
              <table className="bp-table compact">
                <thead><tr><th>Tarifgruppe</th>{MONATE.map((m, i) => <th key={i} className="r">{m}</th>)}</tr></thead>
                <tbody>
                  {auswertung.mitgliederGruppen.map((g, gi) => (
                    <tr key={gi}>
                      <td>{g.bezeichnung}</td>
                      {g.verlauf.map((v, vi) => <td key={vi} className="r">{fmtNum(v)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="bp-card">
        <h3>Liquiditätsverlauf {drei[0]?.jahr || ''}</h3>
        <LiquidityChart data={liq} />
      </div>

      <div className="bp-grid2">
        <div className="bp-card">
          <h3>Rentabilitätsvorschau</h3>
          <table className="bp-table compact">
            <tbody>
              {renta.map((row, ri) => (
                <tr key={ri} className={row[2] ? 'sum' : ''}>
                  <td>{row[0]}</td><td className={'r ' + cls(row[1])}>{fmtEur(row[1])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bp-card">
          <h3>3-Jahres-Planung</h3>
          <table className="bp-table">
            <thead><tr><th>Position</th>{drei.map((d, i) => <th key={i} className="r">{d.jahr}</th>)}</tr></thead>
            <tbody>
              {[['Umsatzerlöse', 'umsatzerloese'], ['Rohertrag', 'rohertrag'], ['Ergebnis v. St.', 'ergebnisVorSteuern'],
                ['Betriebsergebnis', 'betriebsergebnis'], ['Cash-flow', 'cashflow']].map((rd, ri) => (
                <tr key={ri} className={ri >= 3 ? 'sum' : ''}>
                  <td>{rd[0]}</td>{drei.map((d, di) => <td key={di} className={'r ' + cls(d[rd[1]])}>{fmtEur(d[rd[1]])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <button className="bp-btn" disabled={pdfBusy} onClick={downloadPdf}>{pdfBusy ? 'Erzeuge PDF …' : '⬇ Businessplan-PDF'}</button>
          </div>
        </div>
      </div>

      <div className="bp-card">
        <h3>🎯 Ziele-Board <button className="bp-btn sm" onClick={onAddZiel}>+ Ziel</button></h3>
        {ziele.length === 0 ? (
          <p className="bp-sub">Noch keine Ziele. Lege strategische Jahresziele mit KPIs an.</p>
        ) : (
          <div className="bp-ziele">
            {ziele.map((z) => {
              const pct = z.zielwert > 0 ? Math.min(100, Math.round((Number(z.istwert) || 0) / Number(z.zielwert) * 100)) : 0;
              const stLabel = (ZIEL_STATUS.find((s) => s[0] === z.status) || ['', z.status])[1];
              return (
                <div className="bp-ziel" key={z.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
                    <h4>{z.titel}</h4>
                    <button className="bp-icon-btn" onClick={() => onDeleteZiel(z.id)}>🗑</button>
                  </div>
                  {z.beschreibung && <p className="bp-sub">{z.beschreibung}</p>}
                  {z.kpi_name && (<>
                    <div className="kpi-row"><strong>{fmtNum(z.istwert)}</strong><span className="bp-sub">/ {fmtNum(z.zielwert)} {z.einheit} · {z.kpi_name}</span></div>
                    <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                  </>)}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.6rem' }}>
                    <span className={'bp-status ' + z.status}>{stLabel}</span>
                    <select className="bp-input" style={{ width: 'auto' }} value={z.status} onChange={(e) => onZielStatus(z, e.target.value)}>
                      {ZIEL_STATUS.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── SVG-Liquiditätskurve ──────────────────────────────────────────────────────
function LiquidityChart({ data }) {
  if (!data || !data.length) return <p className="bp-sub">Keine Daten.</p>;
  const W = 720, H = 180, padX = 8, padY = 16;
  const sal = data.map((d) => d.saldo);
  const min = Math.min(0, ...sal), max = Math.max(0, ...sal);
  const span = (max - min) || 1;
  const x = (i) => padX + (i * (W - 2 * padX)) / (data.length - 1 || 1);
  const y = (v) => padY + (H - 2 * padY) * (1 - (v - min) / span);
  const pts = data.map((d, i) => `${x(i)},${y(d.saldo)}`).join(' ');
  const zeroY = y(0);
  return (
    <div className="bp-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 180 }}>
        <line x1={padX} y1={zeroY} x2={W - padX} y2={zeroY} className="bp-chart-zero" />
        <polyline points={pts} className="bp-chart-line" fill="none" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.saldo)} r="3" className={d.saldo < 0 ? 'bp-chart-dot neg' : 'bp-chart-dot'}>
            <title>{d.label}: {fmtEur(d.saldo)}</title>
          </circle>
        ))}
      </svg>
      <div className="bp-chart-x">{data.map((d, i) => <span key={i}>{d.label}</span>)}</div>
    </div>
  );
}

// ── Mitglieder-Balken ─────────────────────────────────────────────────────────
function MemberBars({ data }) {
  if (!data || !data.length) return <p className="bp-sub">Keine Daten.</p>;
  const max = Math.max(1, ...data);
  return (
    <div className="bp-membars">
      {data.map((v, i) => (
        <div className="bp-membar" key={i} title={`${MONATE[i]}: ${fmtNum(v)} Mitglieder`}>
          <span className="num">{fmtNum(v)}</span>
          <div className="bar" style={{ height: `${Math.max(4, (v / max) * 90)}px` }} />
          <span className="mon">{MONATE[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Modals ──────────────────────────────────────────────────────────────────────
function CreatePlanModal({ onClose, onCreate, withDojo, dojos, dojoId }) {
  const [stp, setStp] = useState('quelle');
  const [quelle, setQuelle] = useState('euer');      // 'euer' | 'bwa' | 'manuell'
  const [orgId, setOrgId] = useState(dojoId);
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

  const ausBuch = quelle === 'euer' || quelle === 'bwa';
  const mehrereOrgs = (dojos || []).length > 1;
  const choiceStyle = (active) => ({
    display: 'block', padding: '.85rem 1rem', marginBottom: '.6rem', borderRadius: 10, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent,#e0701a)' : 'var(--border-color,#34344a)'}`,
    background: active ? 'rgba(224,112,26,.08)' : 'transparent',
  });

  return createPortal(
    <div className="bp-modal-overlay" onClick={onClose}>
      <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
        {stp === 'quelle' ? (<>
          <h3>Neuen Businessplan anlegen</h3>
          <p className="bp-sub" style={{ marginTop: '-.5rem', marginBottom: '1rem' }}>Woraus sollen die Daten kommen?</p>

          <label style={choiceStyle(quelle === 'euer')} onClick={() => setQuelle('euer')}>
            <strong>📒 Aus EÜR (Zufluss/Ist)</strong>
            <div className="bp-sub">Tatsächlich gezahlte Beiträge je Zahlungsmonat (Kassensicht) + Ausgaben nach Kategorie — monatsgenau.</div>
          </label>
          <label style={choiceStyle(quelle === 'bwa')} onClick={() => setQuelle('bwa')}>
            <strong>📈 Aus BWA (periodengerecht)</strong>
            <div className="bp-sub">Mitgliederbestand je Tarifgruppe (Schüler/Erwachsene/Kinder × Laufzeit) aus den Vertragslaufzeiten — zeigt die echte monatliche Entwicklung.</div>
          </label>
          <label style={choiceStyle(quelle === 'manuell')} onClick={() => setQuelle('manuell')}>
            <strong>📝 Selbst eingeben</strong>
            <div className="bp-sub">Leerer Plan — alle Werte selbst eintragen.</div>
          </label>

          {ausBuch && mehrereOrgs && (
            <div className="bp-field" style={{ marginTop: '.4rem' }}>
              <label>Organisation (Datenquelle)</label>
              <select className="bp-input" value={orgId || ''} onChange={(e) => setOrgId(Number(e.target.value))}>
                {dojos.map((d) => <option key={d.id} value={d.id}>{d.dojoname}</option>)}
              </select>
            </div>
          )}
          {ausBuch && (
            <p className="bp-sub" style={{ marginTop: '.4rem' }}>
              {istLoading ? 'Lade Vorschau …' : ist && ist.aktuelleMitglieder > 0
                ? `Aktuell ${fmtNum(ist.aktuelleMitglieder)} Mitglieder · Ø ${fmtEur(ist.durchschnittsbeitrag)} Beitrag. Ausgaben werden übernommen, sobald sie in der Buchhaltung erfasst sind — danach „🔄 Aktualisieren".`
                : 'Hinweis: Noch keine erfassten Ausgaben werden importiert.'}
            </p>
          )}

          <div className="bp-modal-actions">
            <button className="bp-btn ghost" onClick={onClose}>Abbrechen</button>
            <button className="bp-btn" onClick={() => setStp('details')}>Weiter →</button>
          </div>
        </>) : (<>
          <h3>Plan-Details</h3>
          {ausBuch && <div className="bp-balance ok" style={{ marginBottom: '1rem' }}>✓ Vorbefüllung aus {quelle === 'bwa' ? 'BWA' : 'EÜR'}{mehrereOrgs ? ' · ' + (dojos.find((d) => d.id === orgId)?.dojoname || '') : ''}</div>}
          <div className="bp-field"><label>Titel</label><input className="bp-input" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={`Businessplan ${jahr}`} /></div>
          <div className="bp-field"><label>Firmenname (optional)</label><input className="bp-input" value={firmenname} onChange={(e) => setFirmenname(e.target.value)} /></div>
          <div className="bp-field"><label>Rechtsform (optional)</label><input className="bp-input" value={rechtsform} onChange={(e) => setRechtsform(e.target.value)} placeholder="z.B. Einzelunternehmen, GmbH" /></div>
          <div className="bp-field"><label>Planungsjahr</label><input className="bp-input num" type="number" value={jahr} onChange={(e) => setJahr(Number(e.target.value))} /></div>
          <div className="bp-modal-actions">
            <button className="bp-btn ghost" onClick={() => setStp('quelle')}>← Zurück</button>
            <button className="bp-btn" onClick={() => onCreate({ titel, firmenname, rechtsform, planungsjahr: jahr, quelle, quelleDojoId: ausBuch ? orgId : undefined })}>Anlegen</button>
          </div>
        </>)}
      </div>
    </div>,
    document.body
  );
}

function ZielModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ titel: '', beschreibung: '', kpi_name: '', zielwert: '', einheit: '', status: 'offen' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return createPortal(
    <div className="bp-modal-overlay" onClick={onClose}>
      <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Neues Ziel</h3>
        <div className="bp-field"><label>Titel</label><input className="bp-input" value={form.titel} onChange={(e) => set('titel', e.target.value)} /></div>
        <div className="bp-field"><label>Beschreibung</label><textarea className="bp-textarea" style={{ minHeight: 70 }} value={form.beschreibung} onChange={(e) => set('beschreibung', e.target.value)} /></div>
        <div className="bp-annahmen">
          <div className="bp-field"><label>KPI-Name</label><input className="bp-input" value={form.kpi_name} onChange={(e) => set('kpi_name', e.target.value)} placeholder="z.B. Mitglieder" /></div>
          <div className="bp-field"><label>Zielwert</label><input className="bp-input num" type="number" value={form.zielwert} onChange={(e) => set('zielwert', e.target.value)} /></div>
          <div className="bp-field"><label>Einheit</label><input className="bp-input" value={form.einheit} onChange={(e) => set('einheit', e.target.value)} placeholder="z.B. Stück, €" /></div>
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
