import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import '../styles/GiBestellvorlage.css';

const SIZES = {
  '128': [140, 150, 160, 165, 170, 175, 180, 185, 190, 195, 200],
  '188': [130, 140, 150, 160, 170, 180, 190, 200],
};

const EMPTY_MENGEN = (model) =>
  SIZES[model].reduce((acc, s) => ({ ...acc, [s]: '' }), {});

const EMPTY_SPEZ = {
  material: [], materialText: '', webart: [], grammatur: [],
  labelText: '', labelSprachen: ['Deutsch', 'Englisch'],
  labelArt: [], labelPosition: [], labelZusatz: '',
};

const LT_EMPTY = {
  firmenname: '', ansprechpartner: '', rechtsform: '', email: '',
  telefon: '', telefon_mobil: '', fax: '', website: '',
  strasse: '', hausnummer: '', plz: '', ort: '', land: 'Deutschland',
  ust_id: '', eori_nummer: '', handelsreg_nr: '', handelsreg_gericht: '',
  zolltarifnummer: '', ursprungsland: '',
  incoterms: '', transportweg: '', spediteur: '', zollagent: '',
  waehrung: 'EUR', zahlungsziel_tage: '', skonto_prozent: '', skonto_tage: '',
  mindestbestellwert_cent: '', lieferzeit_tage: '',
  bank_name: '', bank_iban: '', bank_bic: '', bank_kontoinhaber: '',
  swift_code: '', routing_number: '', account_number: '',
  bemerkungen: '',
};

const EMPTY = {
  model: '128', modelName: '', artikelNr: '',
  besteller: 'Kampfkunstschule Schreiner',
  lieferantId: '', lieferantFreitext: '',
  ansprechpartnerBesteller: 'Sascha Schreiner',
  ansprechpartnerLieferant: '',
  bestelldatum: new Date().toLocaleDateString('de-DE'),
  lieferdatum: '', projekt: '', farbe: 'Weiß', wkf: false,
  katKids: true, katAdult: true,
  mengenKids: EMPTY_MENGEN('128'), mengenAdult: EMPTY_MENGEN('128'),
  stickereiPos: [], stickereiSchriftzug: '',
  stickereiGarnfarben: 'Gold, Schwarz', stickereiBemerkung: '',
  bemerkungen: '', spezifikation: { ...EMPTY_SPEZ },
};

const POSITIONEN = [
  'Linkes Revers', 'Rechtes Revers', 'Rücken oben', 'Rücken Mitte',
  'Linker Ärmel', 'Rechter Ärmel', 'Hosenbein', 'Kragen',
];
const MATERIALIEN  = ['100% Baumwolle', 'Baumwolle/Polyester', 'Canvas', 'Synthetik'];
const WEBARTEN     = ['Single Weave', 'Double Weave', 'Kata', 'Kumite / Leicht'];
const GRAMMATUREN  = ['8 oz (~270 g/m²)', '10 oz (~340 g/m²)', '12 oz (~400 g/m²)', '14 oz (~470 g/m²)'];
const LABEL_LANG   = ['Deutsch', 'Englisch', 'Französisch', 'Japanisch'];
const LABEL_ART    = ['Gewebtes Etikett', 'Gedrucktes Etikett', 'Eingestickt'];
const LABEL_POS    = ['Nacken (innen)', 'Seitennaht', 'Hosenbund (innen)'];

export default function GiBestellvorlage({ artikel = null, vorlage = null, onClose = null }) {
  const { activeDojo } = useDojoContext();
  const [lieferanten, setLieferanten] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [ltModal, setLtModal] = useState(false);
  const [ltForm, setLtForm] = useState({ ...LT_EMPTY });
  const [ltSaving, setLtSaving] = useState(false);
  const [ltError, setLtError] = useState('');
  const [dateien, setDateien] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [bestellungen, setBestellungen] = useState([]);
  const [historieSichtbar, setHistorieSichtbar] = useState(false);
  const fileInputRef = useRef(null);

  const buildInitialForm = () => {
    if (vorlage) {
      let stickereiPos = vorlage.stickerei_pos;
      if (typeof stickereiPos === 'string') {
        try { stickereiPos = JSON.parse(stickereiPos); } catch { stickereiPos = []; }
      }
      let spez = { ...EMPTY_SPEZ };
      if (vorlage.spezifikation) {
        try { spez = { ...EMPTY_SPEZ, ...JSON.parse(vorlage.spezifikation) }; } catch {}
      }
      return {
        ...EMPTY,
        modelName: vorlage.modell_name || '',
        artikelNr: vorlage.artikel_nr_vorl || '',
        model: vorlage.modell || '128',
        lieferantId: String(vorlage.lieferant_id || ''),
        farbe: vorlage.farbe || 'Weiß',
        wkf: !!vorlage.wkf,
        stickereiPos: Array.isArray(stickereiPos) ? stickereiPos : [],
        stickereiSchriftzug: vorlage.stickerei_text || '',
        stickereiGarnfarben: vorlage.stickerei_farben || 'Gold, Schwarz',
        stickereiBemerkung: vorlage.stickerei_datei || '',
        bemerkungen: vorlage.bemerkungen || '',
        mengenKids:  spez.mengenKids  ? { ...EMPTY_MENGEN(vorlage.modell || '128'), ...spez.mengenKids  } : EMPTY_MENGEN(vorlage.modell || '128'),
        mengenAdult: spez.mengenAdult ? { ...EMPTY_MENGEN(vorlage.modell || '128'), ...spez.mengenAdult } : EMPTY_MENGEN(vorlage.modell || '128'),
        spezifikation: spez,
      };
    }
    if (artikel) {
      return { ...EMPTY, modelName: artikel.name || '', artikelNr: artikel.artikel_nummer || String(artikel.artikel_id || '') };
    }
    return { ...EMPTY };
  };

  const [form, setForm] = useState(buildInitialForm);

  const dojoId = activeDojo?.id;

  const loadLieferanten = useCallback(async (overrideId) => {
    const id = overrideId || dojoId;
    if (!id) return;
    try {
      const res = await axios.get(`/lieferanten?dojo_id=${id}`);
      setLieferanten(res.data?.data || []);
    } catch {}
  }, [dojoId]);

  useEffect(() => { loadLieferanten(vorlage?.dojo_id || undefined); }, [loadLieferanten, vorlage?.dojo_id]);

  useEffect(() => {
    if (vorlage?.vorlage_id && dojoId) {
      axios.get(`/bestellvorlagen/${vorlage.vorlage_id}/dateien?dojo_id=${dojoId}`)
        .then(res => setDateien(res.data?.data || []))
        .catch(() => {});
    }
  }, [vorlage?.vorlage_id, dojoId]);

  const loadBestellungen = async () => {
    const djId = vorlage?.dojo_id || dojoId;
    if (!djId || !vorlage?.vorlage_id) return;
    try {
      const res = await axios.get(`/gi-bestellungen?vorlage_id=${vorlage.vorlage_id}&dojo_id=${djId}`);
      setBestellungen(res.data?.data || []);
    } catch {}
  };

  useEffect(() => { loadBestellungen(); }, [vorlage?.vorlage_id, dojoId]); // eslint-disable-line

  const uploadDatei = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !vorlage?.vorlage_id) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('datei', file);
      const res = await axios.post(
        `/bestellvorlagen/${vorlage.vorlage_id}/dateien?dojo_id=${dojoId}`,
        fd, { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (res.data?.datei) setDateien(prev => [...prev, res.data.datei]);
    } catch {}
    finally { setUploadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const deleteDatei = async (dateiId) => {
    if (!vorlage?.vorlage_id) return;
    try {
      await axios.delete(`/bestellvorlagen/${vorlage.vorlage_id}/dateien/${dateiId}?dojo_id=${dojoId}`);
      setDateien(prev => prev.filter(d => d.datei_id !== dateiId));
    } catch {}
  };

  const f   = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));
  const fb  = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.checked }));
  const ltF = (key) => (e) => setLtForm(p => ({ ...p, [key]: e.target.value }));

  const fSpez = (key) => (e) =>
    setForm(p => ({ ...p, spezifikation: { ...p.spezifikation, [key]: e.target.value } }));

  const toggleSpez = (key, val) =>
    setForm(p => {
      const arr = p.spezifikation[key] || [];
      return {
        ...p,
        spezifikation: {
          ...p.spezifikation,
          [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val],
        },
      };
    });

  const switchModel = (model) => {
    const oldSizes = SIZES[form.model];
    const newSizes = SIZES[model];
    const migrate  = (old) => {
      const next = {};
      newSizes.forEach(s => { next[s] = oldSizes.includes(s) ? (old[s] || '') : ''; });
      return next;
    };
    setForm(p => ({ ...p, model, mengenKids: migrate(p.mengenKids), mengenAdult: migrate(p.mengenAdult) }));
  };

  const onLieferantChange = (e) => {
    const id = e.target.value;
    const lt = lieferanten.find(l => String(l.lieferant_id) === id);
    setForm(p => ({
      ...p,
      lieferantId: id,
      lieferantFreitext: lt ? lt.firmenname : '',
      ansprechpartnerLieferant: lt ? (lt.ansprechpartner || '') : '',
    }));
  };

  const togglePos  = (pos) => setForm(p => ({
    ...p,
    stickereiPos: p.stickereiPos.includes(pos)
      ? p.stickereiPos.filter(x => x !== pos)
      : [...p.stickereiPos, pos],
  }));

  const setMenge   = (row, size, val) => setForm(p => ({ ...p, [row]: { ...p[row], [size]: val } }));
  const totalFor   = (row) => Object.values(form[row]).reduce((s, v) => s + (parseInt(v) || 0), 0);
  const grandTotal = () => totalFor('mengenKids') + totalFor('mengenAdult');

  const generatePdf = async () => {
    setGenerating(true);
    try {
      const origin = window.location.origin;
      const djId = vorlage?.dojo_id || dojoId;

      // Bestellung in DB speichern
      let neueBestellungId = null;
      if (djId) {
        try {
          const bRes = await axios.post(`/gi-bestellungen?dojo_id=${djId}`, {
            vorlage_id:    vorlage?.vorlage_id || null,
            lieferant_id:  form.lieferantId ? Number(form.lieferantId) : null,
            lieferant_name: form.lieferantFreitext || null,
            bestelldatum:  form.bestelldatum || null,
            lieferdatum:   form.lieferdatum  || null,
            formdata:      { ...form, spezifikation: form.spezifikation, mengenKids: form.mengenKids, mengenAdult: form.mengenAdult },
          });
          neueBestellungId = bRes.data?.bestellung_id;
          await loadBestellungen();
        } catch {}
      }

      let eingebetteteDateien = [];
      if (vorlage?.vorlage_id && dojoId) {
        try {
          const res = await axios.get(`/bestellvorlagen/${vorlage.vorlage_id}/dateien?dojo_id=${dojoId}`);
          const bilder = (res.data?.data || []).filter(d => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(d.original_name));
          eingebetteteDateien = await Promise.all(bilder.map(async (d) => {
            try {
              const blob = await (await fetch(`${origin}${d.pfad}`)).blob();
              const b64  = await new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.readAsDataURL(blob); });
              return { ...d, dataUrl: b64 };
            } catch { return { ...d, dataUrl: null }; }
          }));
        } catch {}
      }
      const html = buildPdfHtml(form, origin, eingebetteteDateien, neueBestellungId);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, '_blank');
      if (win) {
        setTimeout(() => { win.focus(); URL.revokeObjectURL(url); }, 2000);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `bestellvorlage_${form.name || 'vorlage'}.html`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } finally { setGenerating(false); }
  };

  const saveLieferant = async () => {
    if (!ltForm.firmenname.trim()) { setLtError('Firmenname ist Pflichtfeld.'); return; }
    setLtSaving(true); setLtError('');
    const djId = vorlage?.dojo_id || activeDojo?.id;
    try {
      const NUMERIC = ['zahlungsziel_tage', 'skonto_prozent', 'skonto_tage', 'mindestbestellwert_cent', 'lieferzeit_tage'];
      const payload = { ...ltForm };
      NUMERIC.forEach(k => { payload[k] = payload[k] !== '' && payload[k] !== undefined ? Number(payload[k]) : null; });
      const res = await axios.post(`/lieferanten?dojo_id=${djId}`, payload);
      const newLt = res.data?.data;
      const newId = newLt?.lieferant_id;
      setLieferanten(prev => newLt ? [...prev.filter(l => l.lieferant_id !== newId), newLt] : prev);
      if (newId) {
        setForm(p => ({ ...p, lieferantId: String(newId), lieferantFreitext: ltForm.firmenname, ansprechpartnerLieferant: ltForm.ansprechpartner || '' }));
      }
      setLtModal(false);
      setLtForm({ ...LT_EMPTY });
    } catch { setLtError('Fehler beim Speichern.'); }
    finally { setLtSaving(false); }
  };

  const saveVorlage = async () => {
    if (!vorlage?.vorlage_id) return;
    setSaving(true); setSaveMsg('');
    const djId = vorlage.dojo_id || activeDojo?.id;
    try {
      await axios.put(`/bestellvorlagen/${vorlage.vorlage_id}?dojo_id=${djId}`, {
        name: vorlage.name,
        typ: vorlage.typ || 'karate_gi',
        lieferant_id: form.lieferantId ? Number(form.lieferantId) : null,
        modell: form.model,
        modell_name: form.modelName,
        artikel_nr_vorl: form.artikelNr,
        farbe: form.farbe,
        wkf: form.wkf ? 1 : 0,
        stickerei_pos: form.stickereiPos,
        stickerei_text: form.stickereiSchriftzug,
        stickerei_farben: form.stickereiGarnfarben,
        stickerei_datei: form.stickereiBemerkung,
        bemerkungen: form.bemerkungen,
        spezifikation: JSON.stringify({ ...form.spezifikation, mengenKids: form.mengenKids, mengenAdult: form.mengenAdult }),
        artikel_ids: vorlage.artikel_ids || [],
      });
      setSaveMsg('Gespeichert ✓');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch { setSaveMsg('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const sizes      = SIZES[form.model];
  const selectedLt = lieferanten.find(l => String(l.lieferant_id) === form.lieferantId);
  const spez       = form.spezifikation || {};

  const SpezChip = ({ options, field }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
      {options.map(opt => {
        const active = (spez[field] || []).includes(opt);
        return (
          <label key={opt} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.2rem 0.55rem',
            border: `1px solid ${active ? 'rgba(212,175,55,0.6)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '20px', fontSize: '0.77rem',
            color: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)',
            background: active ? 'rgba(212,175,55,0.08)' : 'transparent',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <input type="checkbox" style={{ display: 'none' }} checked={active} onChange={() => toggleSpez(field, opt)} />
            {opt}
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="gv-page">

      {/* HEADER */}
      <div className="gv-header">
        <div>
          {onClose && <button className="gv-btn-back" onClick={onClose}>← Zurück zu Artikel</button>}
          <div className="gv-title">
            {vorlage ? vorlage.name : artikel ? `Bestellvorlage: ${artikel.name}` : 'Karate-Gi Bestellvorlage'}
          </div>
          <div className="gv-sub">Vorauswahl treffen → PDF generieren → drucken</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexShrink: 0 }}>
          {saveMsg && (
            <span style={{ fontSize: '0.8rem', color: saveMsg.includes('Fehler') ? '#f87171' : '#86efac' }}>
              {saveMsg}
            </span>
          )}
          {vorlage?.vorlage_id && (
            <button className="gv-btn-save" onClick={saveVorlage} disabled={saving}>
              {saving ? 'Speichert…' : 'Einstellungen speichern'}
            </button>
          )}
          <button className="gv-btn-pdf" onClick={generatePdf} disabled={generating}>
            {generating ? 'Erstelle PDF…' : 'PDF generieren & drucken'}
          </button>
        </div>
        {bestellungen.length > 0 && (
          <div className="gv-historie-bar">
            <button className="gv-historie-toggle" onClick={() => setHistorieSichtbar(v => !v)}>
              {bestellungen.length} gespeicherte Bestellung{bestellungen.length !== 1 ? 'en' : ''}
              {historieSichtbar ? ' ▲' : ' ▼'}
            </button>
            {historieSichtbar && (
              <div className="gv-historie-list">
                {bestellungen.map(b => (
                  <div key={b.bestellung_id} className="gv-historie-row">
                    <span className="gv-historie-nr">#{String(b.bestellung_id).padStart(4, '0')}</span>
                    <span className="gv-historie-datum">{b.erstellt_am ? new Date(b.erstellt_am).toLocaleDateString('de-DE') : '—'}</span>
                    <span className="gv-historie-lt">{b.lieferant_name || b.lieferant_firmenname || '—'}</span>
                    <select
                      className="gv-historie-status"
                      value={b.status}
                      onChange={async (e) => {
                        const djId = vorlage?.dojo_id || dojoId;
                        try {
                          await axios.patch(`/gi-bestellungen/${b.bestellung_id}/status?dojo_id=${djId}`, { status: e.target.value });
                          setBestellungen(prev => prev.map(x => x.bestellung_id === b.bestellung_id ? { ...x, status: e.target.value } : x));
                        } catch {}
                      }}
                    >
                      <option value="bestellt">Bestellt</option>
                      <option value="bestaetigt">Bestätigt</option>
                      <option value="geliefert">Geliefert</option>
                      <option value="storniert">Storniert</option>
                    </select>
                    <button className="gv-historie-del" title="Löschen" onClick={async () => {
                      const djId = vorlage?.dojo_id || dojoId;
                      try {
                        await axios.delete(`/gi-bestellungen/${b.bestellung_id}?dojo_id=${djId}`);
                        setBestellungen(prev => prev.filter(x => x.bestellung_id !== b.bestellung_id));
                      } catch {}
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="gv-body">

        {/* ── MODELL ── */}
        <div className="gv-section">
          <div className="gv-section-title">Modellauswahl</div>
          <div className="gv-model-row">
            <div className={`gv-model-card ${form.model === '128' ? 'active' : ''}`} onClick={() => switchModel('128')}>
              <div className="gv-model-name">Modell 128</div>
              <div className="gv-model-detail">11 Größen · 140–200 cm</div>
              <div className="gv-model-hint">Feinere Abstufung</div>
            </div>
            <div className={`gv-model-card ${form.model === '188' ? 'active' : ''}`} onClick={() => switchModel('188')}>
              <div className="gv-model-name">Modell 188</div>
              <div className="gv-model-detail">8 Größen · 130–200 cm</div>
              <div className="gv-model-hint">inkl. Kindergröße 130 cm</div>
            </div>
            <div className="gv-model-fields">
              <div className="gv-field">
                <label className="gv-label">Modellbezeichnung</label>
                <input className="gv-input" value={form.modelName} onChange={f('modelName')} placeholder="z. B. Hayashi Tenno WKF Approved" />
              </div>
              <div className="gv-field">
                <label className="gv-label">Artikel-Nr.</label>
                <input className="gv-input" value={form.artikelNr} onChange={f('artikelNr')} placeholder="z. B. 0270" />
              </div>
            </div>
          </div>
        </div>

        {/* ── BESTELLDATEN ── */}
        <div className="gv-section">
          <div className="gv-section-title">Bestelldaten</div>
          <div className="gv-grid2">
            <div className="gv-field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <label className="gv-label" style={{ margin: 0 }}>Lieferant (aus Liste)</label>
                <button className="gv-btn-lt-new" onClick={() => { setLtModal(true); setLtError(''); }}>+ Neu anlegen</button>
              </div>
              <select className="gv-input" value={form.lieferantId} onChange={onLieferantChange}>
                <option value="">— manuell eingeben —</option>
                {lieferanten.map(l => <option key={l.lieferant_id} value={String(l.lieferant_id)}>{l.firmenname}</option>)}
              </select>
            </div>
            <div className="gv-field">
              <label className="gv-label">Hersteller / Lieferant</label>
              <input className="gv-input" value={form.lieferantFreitext} onChange={f('lieferantFreitext')} placeholder="Name des Herstellers" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Ansprechpartner Lieferant</label>
              <input className="gv-input" value={form.ansprechpartnerLieferant} onChange={f('ansprechpartnerLieferant')}
                placeholder={selectedLt?.email ? `E-Mail: ${selectedLt.email}` : 'Name / Abteilung'} />
            </div>
            <div className="gv-field">
              <label className="gv-label">Ansprechpartner Besteller</label>
              <input className="gv-input" value={form.ansprechpartnerBesteller} onChange={f('ansprechpartnerBesteller')} />
            </div>
            <div className="gv-field">
              <label className="gv-label">Bestelldatum</label>
              <input className="gv-input" value={form.bestelldatum} onChange={f('bestelldatum')} />
            </div>
            <div className="gv-field">
              <label className="gv-label">Gewünschtes Lieferdatum</label>
              <input className="gv-input" value={form.lieferdatum} onChange={f('lieferdatum')} placeholder="TT.MM.JJJJ" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Projekt / Verwendungszweck</label>
              <input className="gv-input" value={form.projekt} onChange={f('projekt')} placeholder="z. B. Vereinsausstattung 2026" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Farbe / Ausführung</label>
              <input className="gv-input" value={form.farbe} onChange={f('farbe')} />
            </div>
          </div>
          {selectedLt && (
            <div className="gv-lt-info">
              {selectedLt.email    && <span>✉ {selectedLt.email}</span>}
              {selectedLt.telefon  && <span>📞 {selectedLt.telefon}</span>}
              {selectedLt.website  && <span>🔗 {selectedLt.website}</span>}
              {selectedLt.ust_id   && <span>VAT: {selectedLt.ust_id}</span>}
              {selectedLt.eori_nummer && <span>EORI: {selectedLt.eori_nummer}</span>}
              {selectedLt.waehrung && selectedLt.waehrung !== 'EUR' && <span className="gv-lt-warn">⚠ {selectedLt.waehrung}</span>}
            </div>
          )}
          <label className="gv-check-row">
            <input type="checkbox" checked={form.wkf} onChange={fb('wkf')} />
            WKF-zugelassen / WKF Approved
          </label>
        </div>

        {/* ── PRODUKTSPEZIFIKATION ── */}
        <div className="gv-section">
          <div className="gv-section-title">Produktspezifikation</div>
          <div className="gv-grid2">
            <div className="gv-field">
              <label className="gv-label">Material</label>
              <SpezChip options={MATERIALIEN} field="material" />
              <input className="gv-input" style={{ marginTop: '0.4rem' }}
                value={spez.materialText || ''} onChange={fSpez('materialText')} placeholder="Exakte Zusammensetzung" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Webart</label>
              <SpezChip options={WEBARTEN} field="webart" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Grammatur</label>
              <SpezChip options={GRAMMATUREN} field="grammatur" />
            </div>
          </div>
        </div>

        {/* ── MENGEN ── */}
        <div className="gv-section">
          <div className="gv-section-title-row">
            <span className="gv-section-title">Mengenbestellung</span>
            <div className="gv-cat-checks">
              <label className="gv-cat-opt"><input type="checkbox" checked={form.katKids} onChange={fb('katKids')} />Kinder / Kids</label>
              <label className="gv-cat-opt"><input type="checkbox" checked={form.katAdult} onChange={fb('katAdult')} />Erwachsene</label>
            </div>
            <span className="gv-total-display">Gesamt: <strong>{grandTotal()} Stück</strong></span>
          </div>
          <div className="gv-qty-wrap">
            <table className="gv-qty-table">
              <thead>
                <tr>
                  <th className="gv-qt-rh">Kategorie</th>
                  {sizes.map(s => <th key={s}>{s}</th>)}
                  <th className="gv-qt-sum">Σ</th>
                </tr>
              </thead>
              <tbody>
                {form.katKids && (
                  <tr>
                    <td className="gv-qt-rl">Kinder</td>
                    {sizes.map(s => (
                      <td key={s}><input type="number" min="0" value={form.mengenKids[s]} onChange={e => setMenge('mengenKids', s, e.target.value)} /></td>
                    ))}
                    <td className="gv-qt-sum-cell">{totalFor('mengenKids')}</td>
                  </tr>
                )}
                {form.katAdult && (
                  <tr>
                    <td className="gv-qt-rl">Erwachsene</td>
                    {sizes.map(s => (
                      <td key={s}><input type="number" min="0" value={form.mengenAdult[s]} onChange={e => setMenge('mengenAdult', s, e.target.value)} /></td>
                    ))}
                    <td className="gv-qt-sum-cell">{totalFor('mengenAdult')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── STICKEREI ── */}
        <div className="gv-section">
          <div className="gv-section-title">Stickerei & Branding</div>
          <div className="gv-pos-grid">
            {POSITIONEN.map(pos => (
              <label key={pos} className={`gv-pos-item ${form.stickereiPos.includes(pos) ? 'active' : ''}`}>
                <input type="checkbox" checked={form.stickereiPos.includes(pos)} onChange={() => togglePos(pos)} />
                {pos}
              </label>
            ))}
          </div>
          <div className="gv-grid3" style={{ marginTop: '0.75rem' }}>
            <div className="gv-field">
              <label className="gv-label">Schriftzug / Text</label>
              <input className="gv-input" value={form.stickereiSchriftzug} onChange={f('stickereiSchriftzug')} placeholder="z. B. Kampfkunstschule Schreiner · TDA" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Garnfarben</label>
              <input className="gv-input" value={form.stickereiGarnfarben} onChange={f('stickereiGarnfarben')} />
            </div>
            <div className="gv-field">
              <label className="gv-label">Stickerei-Datei</label>
              <input className="gv-input" value={form.stickereiBemerkung} onChange={f('stickereiBemerkung')} placeholder="z. B. TDA_logo_v2.dst" />
            </div>
          </div>
        </div>

        {/* ── LOGOS & DATEIEN ── */}
        <div className="gv-section">
          <div className="gv-section-title">Logos &amp; Branding-Dateien</div>
          {vorlage?.vorlage_id ? (
            <>
              <div className="gv-upload-zone" onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" style={{ display: 'none' }}
                  accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.ai,.eps,.dst,.pes,.exp,.jef,.vp3"
                  onChange={uploadDatei} />
                {uploadingFile
                  ? <span className="gv-upload-hint">Wird hochgeladen…</span>
                  : <span className="gv-upload-hint">+ Datei hochladen (Logos, Stickerei-Dateien, PDFs …)</span>}
              </div>
              {dateien.length > 0 && (
                <div className="gv-datei-list">
                  {dateien.map(d => {
                    const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(d.original_name);
                    return (
                      <div key={d.datei_id} className="gv-datei-item">
                        {isImg
                          ? <img className="gv-datei-thumb" src={d.pfad} alt={d.original_name} />
                          : <div className="gv-datei-icon">📎</div>}
                        <div className="gv-datei-info">
                          <div className="gv-datei-name">{d.original_name}</div>
                          <div className="gv-datei-size">
                            {d.groesse_bytes > 1024*1024 ? `${(d.groesse_bytes/1024/1024).toFixed(1)} MB` : `${Math.round(d.groesse_bytes/1024)} KB`}
                          </div>
                        </div>
                        <button className="gv-datei-del" onClick={() => deleteDatei(d.datei_id)} title="Löschen">×</button>
                      </div>
                    );
                  })}
                </div>
              )}
              {dateien.length === 0 && !uploadingFile && (
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.25rem' }}>
                  Noch keine Dateien hinterlegt. Dateien werden im PDF eingebettet.
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
              Dateien können nur über eine gespeicherte Vorlage hochgeladen werden.
            </div>
          )}
        </div>

        {/* ── PFLEGEKENNZEICHNUNG & LABEL ── */}
        <div className="gv-section">
          <div className="gv-section-title">Pflegekennzeichnung & Label-Spezifikation</div>
          <div className="gv-grid2">
            <div className="gv-field">
              <label className="gv-label">Material-Text (Label)</label>
              <input className="gv-input" value={spez.labelText || ''} onChange={fSpez('labelText')} placeholder="z. B. 100% Baumwolle / 100% Cotton" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Zusatztext auf Label</label>
              <input className="gv-input" value={spez.labelZusatz || ''} onChange={fSpez('labelZusatz')} placeholder="z. B. Made exclusively for KKS Schreiner" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Label-Sprachen</label>
              <SpezChip options={LABEL_LANG} field="labelSprachen" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Label-Art</label>
              <SpezChip options={LABEL_ART} field="labelArt" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Label-Position</label>
              <SpezChip options={LABEL_POS} field="labelPosition" />
            </div>
          </div>
        </div>

        {/* ── BEMERKUNGEN ── */}
        <div className="gv-section">
          <div className="gv-section-title">Bemerkungen</div>
          <textarea className="gv-textarea" rows="3" value={form.bemerkungen} onChange={f('bemerkungen')}
            placeholder="Sonderwünsche, Verpackungsvorschriften, Lieferbedingungen …" />
        </div>

      </div>{/* /gv-body */}

      {/* ── LIEFERANT VOLLERFASSUNG MODAL ── */}
      {ltModal && (
        <div className="gv-lt-modal-backdrop" onClick={() => setLtModal(false)}>
          <div className="gv-lt-modal" onClick={e => e.stopPropagation()}>

            <div className="gv-lt-modal-header">
              <span>Lieferant anlegen</span>
              <button className="gv-lt-modal-close" onClick={() => setLtModal(false)}>×</button>
            </div>

            <div className="gv-lt-modal-body">
              {ltError && <div className="gv-lt-modal-err">{ltError}</div>}

              <div className="gv-lt-section-label">Grunddaten</div>
              <div className="gv-grid2" style={{ gap: '0.5rem 1rem', marginBottom: '0.75rem' }}>
                <div className="gv-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="gv-label">Firmenname *</label>
                  <input className="gv-input" value={ltForm.firmenname} onChange={ltF('firmenname')} placeholder="z. B. Hayashi GmbH" autoFocus />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Rechtsform</label>
                  <input className="gv-input" value={ltForm.rechtsform} onChange={ltF('rechtsform')} placeholder="GmbH, AG, Ltd. …" />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Ansprechpartner</label>
                  <input className="gv-input" value={ltForm.ansprechpartner} onChange={ltF('ansprechpartner')} placeholder="Name / Abteilung" />
                </div>
                <div className="gv-field">
                  <label className="gv-label">E-Mail</label>
                  <input className="gv-input" type="email" value={ltForm.email} onChange={ltF('email')} placeholder="bestellung@lieferant.de" />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Telefon</label>
                  <input className="gv-input" value={ltForm.telefon} onChange={ltF('telefon')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Mobil</label>
                  <input className="gv-input" value={ltForm.telefon_mobil} onChange={ltF('telefon_mobil')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Fax</label>
                  <input className="gv-input" value={ltForm.fax} onChange={ltF('fax')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Website</label>
                  <input className="gv-input" value={ltForm.website} onChange={ltF('website')} placeholder="www.lieferant.de" />
                </div>
              </div>

              <div className="gv-lt-section-label">Adresse</div>
              <div className="gv-grid2" style={{ gap: '0.5rem 1rem', marginBottom: '0.75rem' }}>
                <div className="gv-field">
                  <label className="gv-label">Straße</label>
                  <input className="gv-input" value={ltForm.strasse} onChange={ltF('strasse')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Hausnummer</label>
                  <input className="gv-input" value={ltForm.hausnummer} onChange={ltF('hausnummer')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">PLZ</label>
                  <input className="gv-input" value={ltForm.plz} onChange={ltF('plz')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Ort</label>
                  <input className="gv-input" value={ltForm.ort} onChange={ltF('ort')} />
                </div>
                <div className="gv-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="gv-label">Land</label>
                  <select className="gv-input" value={ltForm.land} onChange={ltF('land')}>
                    <option>Deutschland</option><option>Österreich</option><option>Schweiz</option>
                    <option>Japan</option><option>China</option><option>USA</option><option>Sonstige</option>
                  </select>
                </div>
              </div>

              <div className="gv-lt-section-label">Steuern & Zoll</div>
              <div className="gv-grid2" style={{ gap: '0.5rem 1rem', marginBottom: '0.75rem' }}>
                <div className="gv-field">
                  <label className="gv-label">USt-ID</label>
                  <input className="gv-input" value={ltForm.ust_id} onChange={ltF('ust_id')} placeholder="DE123456789" />
                </div>
                <div className="gv-field">
                  <label className="gv-label">EORI-Nummer</label>
                  <input className="gv-input" value={ltForm.eori_nummer} onChange={ltF('eori_nummer')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Handelsreg.-Nr.</label>
                  <input className="gv-input" value={ltForm.handelsreg_nr} onChange={ltF('handelsreg_nr')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Handelsreg.-Gericht</label>
                  <input className="gv-input" value={ltForm.handelsreg_gericht} onChange={ltF('handelsreg_gericht')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Zolltarifnummer</label>
                  <input className="gv-input" value={ltForm.zolltarifnummer} onChange={ltF('zolltarifnummer')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Ursprungsland</label>
                  <input className="gv-input" value={ltForm.ursprungsland} onChange={ltF('ursprungsland')} />
                </div>
              </div>

              <div className="gv-lt-section-label">Logistik</div>
              <div className="gv-grid2" style={{ gap: '0.5rem 1rem', marginBottom: '0.75rem' }}>
                <div className="gv-field">
                  <label className="gv-label">Incoterms</label>
                  <input className="gv-input" value={ltForm.incoterms} onChange={ltF('incoterms')} placeholder="z. B. DAP, FOB, EXW" />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Transportweg</label>
                  <input className="gv-input" value={ltForm.transportweg} onChange={ltF('transportweg')} placeholder="Luft, See, Straße …" />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Spediteur</label>
                  <input className="gv-input" value={ltForm.spediteur} onChange={ltF('spediteur')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Zollagent</label>
                  <input className="gv-input" value={ltForm.zollagent} onChange={ltF('zollagent')} />
                </div>
              </div>

              <div className="gv-lt-section-label">Konditionen</div>
              <div className="gv-grid3" style={{ gap: '0.5rem 0.75rem', marginBottom: '0.75rem' }}>
                <div className="gv-field">
                  <label className="gv-label">Währung</label>
                  <select className="gv-input" value={ltForm.waehrung} onChange={ltF('waehrung')}>
                    <option>EUR</option><option>USD</option><option>JPY</option>
                    <option>CNY</option><option>GBP</option><option>CHF</option>
                  </select>
                </div>
                <div className="gv-field">
                  <label className="gv-label">Zahlungsziel (Tage)</label>
                  <input className="gv-input" type="number" value={ltForm.zahlungsziel_tage} onChange={ltF('zahlungsziel_tage')} placeholder="30" />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Lieferzeit (Tage)</label>
                  <input className="gv-input" type="number" value={ltForm.lieferzeit_tage} onChange={ltF('lieferzeit_tage')} placeholder="14" />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Skonto (%)</label>
                  <input className="gv-input" type="number" step="0.1" value={ltForm.skonto_prozent} onChange={ltF('skonto_prozent')} placeholder="2.0" />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Skonto (Tage)</label>
                  <input className="gv-input" type="number" value={ltForm.skonto_tage} onChange={ltF('skonto_tage')} placeholder="14" />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Mindestbestellwert (Cent)</label>
                  <input className="gv-input" type="number" value={ltForm.mindestbestellwert_cent} onChange={ltF('mindestbestellwert_cent')} placeholder="50000" />
                </div>
              </div>

              <div className="gv-lt-section-label">Bankdaten</div>
              <div className="gv-grid2" style={{ gap: '0.5rem 1rem', marginBottom: '0.75rem' }}>
                <div className="gv-field">
                  <label className="gv-label">Bank</label>
                  <input className="gv-input" value={ltForm.bank_name} onChange={ltF('bank_name')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Kontoinhaber</label>
                  <input className="gv-input" value={ltForm.bank_kontoinhaber} onChange={ltF('bank_kontoinhaber')} />
                </div>
                <div className="gv-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="gv-label">IBAN</label>
                  <input className="gv-input" value={ltForm.bank_iban} onChange={ltF('bank_iban')} placeholder="DE…" />
                </div>
                <div className="gv-field">
                  <label className="gv-label">BIC / SWIFT</label>
                  <input className="gv-input" value={ltForm.bank_bic} onChange={ltF('bank_bic')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Routing Number</label>
                  <input className="gv-input" value={ltForm.routing_number} onChange={ltF('routing_number')} />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Account Number</label>
                  <input className="gv-input" value={ltForm.account_number} onChange={ltF('account_number')} />
                </div>
              </div>

              <div className="gv-lt-section-label">Bemerkungen</div>
              <div className="gv-field">
                <textarea className="gv-textarea" rows="3" value={ltForm.bemerkungen}
                  onChange={ltF('bemerkungen')} placeholder="Interne Notizen zum Lieferanten …" />
              </div>
            </div>

            <div className="gv-lt-modal-footer">
              <button className="gv-btn-back" onClick={() => setLtModal(false)}>Abbrechen</button>
              <button className="gv-btn-pdf" onClick={saveLieferant} disabled={ltSaving}>
                {ltSaving ? 'Speichert…' : 'Lieferant anlegen'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  PDF-HTML-GENERATOR
// ═══════════════════════════════════════════════════════
function buildPdfHtml(form, origin, eingebetteteDateien = [], bestellungId = null) {
  const sizes = SIZES[form.model];
  const img128 = `${origin}/gi-charts/modell-128.jpg`;
  const img188 = `${origin}/gi-charts/modell-188.jpg`;

  const spez    = form.spezifikation || {};
  const matIn   = (v) => (spez.material      || []).includes(v) ? 'checked' : '';
  const webIn   = (v) => (spez.webart        || []).includes(v) ? 'checked' : '';
  const gramIn  = (v) => (spez.grammatur     || []).includes(v) ? 'checked' : '';
  const langIn  = (v) => (spez.labelSprachen || ['Deutsch','Englisch']).includes(v) ? 'checked' : '';
  const artIn   = (v) => (spez.labelArt      || []).includes(v) ? 'checked' : '';
  const posLIn  = (v) => (spez.labelPosition || []).includes(v) ? 'checked' : '';

  const checked    = (val) => val ? 'checked' : '';
  const posChecked = (pos) => form.stickereiPos.includes(pos) ? 'checked' : '';

  const qtyRow = (row, label) => {
    if ((label === 'Kinder / Kids' && !form.katKids) || (label === 'Erwachsene' && !form.katAdult)) return '';
    const vals  = row === 'kids' ? form.mengenKids : form.mengenAdult;
    const total = Object.values(vals).reduce((s, v) => s + (parseInt(v) || 0), 0);
    const cells = sizes.map(s => `<td><input type="number" value="${parseInt(vals[s]) || ''}" style="width:100%;border:none;text-align:center;font-size:10pt;padding:3px 0;background:transparent;"></td>`).join('');
    return `<tr><td class="rl">${label}</td>${cells}<td class="sm" style="font-weight:700;background:#f0f0f0;">${total}</td></tr>`;
  };

  const grandTotal = Object.values(form.mengenKids).reduce((s,v)=>s+(parseInt(v)||0),0)
                   + Object.values(form.mengenAdult).reduce((s,v)=>s+(parseInt(v)||0),0);
  const thCells        = sizes.map(s => `<th>${s}</th>`).join('');
  const selectedLtInfo = form.lieferantFreitext || '—';

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8">
<title>Karate-Gi Bestellvorlage – Kampfkunstschule Schreiner</title>
<style>
:root{--gold:#c9a227;--dark:#1a1a2e;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;font-size:10pt;color:var(--dark);background:#ddd;}
.page{width:210mm;min-height:297mm;background:white;margin:8mm auto;padding:14mm 18mm;box-shadow:0 4px 20px rgba(0,0,0,.25);}
.ph{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:5mm;border-bottom:3px solid var(--gold);margin-bottom:7mm;}
.ph h1{font-size:20pt;font-weight:900;text-transform:uppercase;letter-spacing:2px;}
.ph .sub{font-size:8pt;text-transform:uppercase;letter-spacing:.15em;color:var(--gold);margin-top:2px;}
.ph-r{text-align:right;font-size:8pt;color:#777;}
.ph-r .onr{border:2px solid var(--gold);padding:3px 10px;font-weight:700;font-size:10pt;margin-bottom:4px;display:inline-block;}
.ch{display:flex;justify-content:space-between;align-items:center;padding-bottom:3mm;border-bottom:2px solid var(--gold);margin-bottom:6mm;font-size:8pt;color:#888;text-transform:uppercase;letter-spacing:.1em;}
.st{background:var(--dark);color:white;font-size:7pt;font-weight:700;letter-spacing:.15em;text-transform:uppercase;padding:3px 8px;margin-bottom:4mm;display:flex;align-items:center;gap:6px;}
.st .n{background:var(--gold);color:var(--dark);font-weight:900;font-size:8pt;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border-radius:2px;flex-shrink:0;}
.sec{margin-bottom:7mm;}
.fg2{display:grid;grid-template-columns:1fr 1fr;gap:4mm 8mm;}
.fg3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm 6mm;}
.f{display:flex;flex-direction:column;gap:1.5mm;}
.lbl{font-size:7pt;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#999;}
.val{border:none;border-bottom:1.5px solid #ccc;padding:2px 0;font-size:10pt;background:transparent;width:100%;font-family:inherit;}
.mc-row{display:flex;gap:4mm;margin-bottom:4mm;}
.mc{flex:1;border:2px solid #e0e0e0;border-radius:5px;padding:3mm;text-align:center;}
.mc.sel{border-color:var(--gold);background:#fffdf4;}
.mc-n{font-weight:800;font-size:12pt;}
.mc-d{font-size:8pt;color:#999;margin-top:1mm;}
.qt-wrap{overflow-x:auto;}
table.qt{width:100%;border-collapse:collapse;font-size:8.5pt;}
table.qt thead th{background:var(--dark);color:white;padding:4px;text-align:center;font-size:8pt;}
table.qt thead th.rh{text-align:left;padding-left:6px;min-width:90px;background:#2d2d4e;}
table.qt tbody td{border:1px solid #e5e5e5;text-align:center;padding:1px;}
table.qt tbody td.rl{background:#f6f6f6;font-weight:600;text-align:left;padding:4px 6px;}
table.qt tbody td.sm{padding:4px;}
table.qt tfoot td{background:var(--dark);color:white;font-weight:700;padding:4px 6px;}
table.qt tfoot td.rl{background:var(--gold);color:var(--dark);}
.care-row{display:flex;gap:7mm;margin:3mm 0 4mm;}
.ci{display:flex;flex-direction:column;align-items:center;gap:1.5mm;}
.ci svg{width:34px;height:34px;}
.ci span{font-size:6.5pt;color:#666;text-align:center;max-width:48px;line-height:1.3;}
.chk-grid{display:grid;grid-template-columns:1fr 1fr;gap:2mm;margin-bottom:4mm;}
.chk-item{display:flex;align-items:center;gap:2mm;padding:2.5mm 4mm;border:1px solid #e5e5e5;border-radius:3px;font-size:8.5pt;}
.chk-item:has(input:checked){border-color:var(--gold);background:#fffbf0;}
.tags{display:flex;flex-wrap:wrap;gap:2mm;margin-top:1.5mm;}
.tag{display:inline-flex;align-items:center;gap:2mm;padding:2px 8px;border:1.5px solid #ddd;border-radius:20px;font-size:8pt;color:#666;}
.tag:has(input:checked){border-color:var(--gold);background:#fffbf0;color:var(--dark);font-weight:600;}
.sig-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10mm;margin-top:6mm;}
.sig-area{height:16mm;border-bottom:1.5px solid #aaa;}
.sig-cap{font-size:7pt;color:#999;text-align:center;margin-top:2mm;}
.chart-block{margin-bottom:8mm;text-align:center;}
.chart-label{font-size:10pt;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:3mm;padding-bottom:2mm;border-bottom:2px solid var(--gold);}
.chart-block img{max-width:100%;max-height:120mm;border:1px solid #eee;}
.ibox{background:#fffbf0;border:1px solid #e8d080;border-radius:4px;padding:3mm 4mm;font-size:8pt;color:#7a5f00;margin:3mm 0;}
@media print{
  body{background:white;}
  .page{margin:0;padding:14mm 18mm;box-shadow:none;page-break-after:always;}
  .page:last-child{page-break-after:avoid;}
  input,select,textarea{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
}
.print-btn{position:fixed;bottom:20px;right:20px;background:var(--gold);color:var(--dark);border:none;padding:12px 28px;font-size:12pt;font-weight:800;border-radius:6px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.35);z-index:999;}
</style></head><body>

<!-- SEITE 1 -->
<div class="page">
<div class="ph">
  <div><h1>Karate-Gi</h1><div class="sub">Bestellvorlage · Kampfkunstschule Schreiner</div></div>
  <div class="ph-r">
    <div class="onr">Nr.&nbsp;<strong>${bestellungId ? String(bestellungId).padStart(4, '0') : '____'}</strong></div><br>
    <span>Datum: ${form.bestelldatum}</span>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">1</span> Modellauswahl</div>
  <div class="mc-row">
    <div class="mc ${form.model==='128'?'sel':''}"><div class="mc-n">Modell 128</div><div class="mc-d">11 Größen · 140–200 cm</div></div>
    <div class="mc ${form.model==='188'?'sel':''}"><div class="mc-n">Modell 188</div><div class="mc-d">8 Größen · 130–200 cm</div></div>
    <div style="flex:2;padding:3mm;">
      <div class="f"><span class="lbl">Modellbezeichnung</span><input class="val" type="text" value="${form.modelName}"></div>
      <div class="f" style="margin-top:3mm;"><span class="lbl">Artikel-Nr.</span><input class="val" type="text" value="${form.artikelNr}"></div>
    </div>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">2</span> Bestelldaten</div>
  <div class="fg2">
    <div class="f"><span class="lbl">Besteller</span><input class="val" type="text" value="${form.besteller}"></div>
    <div class="f"><span class="lbl">Hersteller / Lieferant</span><input class="val" type="text" value="${selectedLtInfo}"></div>
    <div class="f"><span class="lbl">Ansprechpartner Besteller</span><input class="val" type="text" value="${form.ansprechpartnerBesteller}"></div>
    <div class="f"><span class="lbl">Ansprechpartner Lieferant</span><input class="val" type="text" value="${form.ansprechpartnerLieferant}"></div>
    <div class="f"><span class="lbl">Bestelldatum</span><input class="val" type="text" value="${form.bestelldatum}"></div>
    <div class="f"><span class="lbl">Gewünschtes Lieferdatum</span><input class="val" type="text" value="${form.lieferdatum}"></div>
    <div class="f"><span class="lbl">Projekt / Verwendungszweck</span><input class="val" type="text" value="${form.projekt}"></div>
    <div class="f"><span class="lbl">Farbe / Ausführung</span><input class="val" type="text" value="${form.farbe}"></div>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">3</span> Produktspezifikation</div>
  <div class="fg2">
    <div class="f"><span class="lbl">Material</span>
      <div class="tags">
        <label class="tag"><input type="checkbox" ${matIn('100% Baumwolle')}> 100% Baumwolle</label>
        <label class="tag"><input type="checkbox" ${matIn('Baumwolle/Polyester')}> Baumwolle/Polyester</label>
        <label class="tag"><input type="checkbox" ${matIn('Canvas')}> Canvas</label>
        <label class="tag"><input type="checkbox" ${matIn('Synthetik')}> Synthetik</label>
      </div>
      <input class="val" type="text" value="${spez.materialText || ''}" placeholder="Exakte Zusammensetzung" style="margin-top:2mm;">
    </div>
    <div class="f"><span class="lbl">Webart</span>
      <div class="tags">
        <label class="tag"><input type="checkbox" ${webIn('Single Weave')}> Single Weave</label>
        <label class="tag"><input type="checkbox" ${webIn('Double Weave')}> Double Weave</label>
        <label class="tag"><input type="checkbox" ${webIn('Kata')}> Kata</label>
        <label class="tag"><input type="checkbox" ${webIn('Kumite / Leicht')}> Kumite / Leicht</label>
      </div>
    </div>
    <div class="f"><span class="lbl">Grammatur</span>
      <div class="tags">
        <label class="tag"><input type="checkbox" ${gramIn('8 oz (~270 g/m²)')}> 8 oz (~270 g/m²)</label>
        <label class="tag"><input type="checkbox" ${gramIn('10 oz (~340 g/m²)')}> 10 oz (~340 g/m²)</label>
        <label class="tag"><input type="checkbox" ${gramIn('12 oz (~400 g/m²)')}> 12 oz (~400 g/m²)</label>
        <label class="tag"><input type="checkbox" ${gramIn('14 oz (~470 g/m²)')}> 14 oz (~470 g/m²)</label>
      </div>
    </div>
    <div class="f"><span class="lbl">WKF-Zulassung</span>
      <div class="tags">
        <label class="tag"><input type="checkbox" ${checked(form.wkf)}> WKF-zugelassen</label>
        <label class="tag"><input type="checkbox"> Kata-Liste</label>
        <label class="tag"><input type="checkbox" ${checked(!form.wkf)}> Nicht erforderlich</label>
      </div>
    </div>
  </div>
</div>
</div>

<!-- SEITE 2 -->
<div class="page">
<div class="ch"><span>Karate-Gi Bestellvorlage – Kampfkunstschule Schreiner</span><span>Seite 2 / 4</span></div>

<div class="sec">
  <div class="st"><span class="n">4</span> Kategorie &amp; Mengenbestellung</div>
  <div style="display:flex;gap:4mm;align-items:center;margin-bottom:4mm;flex-wrap:wrap;">
    <span style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;">Kategorie:</span>
    <label style="display:flex;align-items:center;gap:2mm;padding:3mm 6mm;border:1.5px solid ${form.katKids?'var(--gold)':'#ddd'};border-radius:4px;font-size:9.5pt;font-weight:600;background:${form.katKids?'#fffbf0':'white'};">
      <input type="checkbox" ${checked(form.katKids)}> Kinder / Kids
    </label>
    <label style="display:flex;align-items:center;gap:2mm;padding:3mm 6mm;border:1.5px solid ${form.katAdult?'var(--gold)':'#ddd'};border-radius:4px;font-size:9.5pt;font-weight:600;background:${form.katAdult?'#fffbf0':'white'};">
      <input type="checkbox" ${checked(form.katAdult)}> Erwachsene
    </label>
  </div>
  <div class="qt-wrap">
    <table class="qt">
      <thead><tr><th class="rh">Kategorie \\ Größe</th>${thCells}<th style="background:#2d3d2d;min-width:36px;">Σ</th></tr></thead>
      <tbody>${qtyRow('kids','Kinder / Kids')}${qtyRow('adult','Erwachsene')}</tbody>
      <tfoot><tr><td class="rl">Gesamt</td>
        <td colspan="${sizes.length}" style="text-align:right;padding-right:8px;">${grandTotal} Stück gesamt</td>
        <td>${grandTotal}</td>
      </tr></tfoot>
    </table>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">5</span> Stickerei &amp; Branding</div>
  <span class="lbl" style="display:block;margin-bottom:2mm;">Stickerei-Positionen:</span>
  <div class="chk-grid">
    <label class="chk-item"><input type="checkbox" ${posChecked('Linkes Revers')}> Linkes Revers (vorne links)</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Rechtes Revers')}> Rechtes Revers (vorne rechts)</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Rücken oben')}> Rücken — oberer Bereich</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Rücken Mitte')}> Rücken — Mitte / großes Motiv</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Linker Ärmel')}> Linker Ärmel (außen)</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Rechter Ärmel')}> Rechter Ärmel (außen)</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Hosenbein')}> Hosenbein (links/rechts)</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Kragen')}> Kragen / Nackenbereich</label>
  </div>
  <div class="fg2">
    <div class="f"><span class="lbl">Logo / Motiv-Beschreibung</span><input class="val" type="text" placeholder="z. B. TDA Vereinslogo, Yin-Yang, Kanji Karate"></div>
    <div class="f"><span class="lbl">Stickerei-Datei</span><input class="val" type="text" value="${form.stickereiBemerkung}" placeholder="z. B. TDA_logo_stickerei_v2.dst"></div>
    <div class="f"><span class="lbl">Schriftzug / Text</span><input class="val" type="text" value="${form.stickereiSchriftzug}"></div>
    <div class="f"><span class="lbl">Garnfarben</span><input class="val" type="text" value="${form.stickereiGarnfarben}"></div>
    <div class="f"><span class="lbl">Größe Stickerei (B × H)</span><input class="val" type="text" placeholder="z. B. 8 × 6 cm (Revers)"></div>
    <div class="f"><span class="lbl">Schriftart</span>
      <div class="tags">
        <label class="tag"><input type="checkbox"> Lateinisch / Block</label>
        <label class="tag"><input type="checkbox"> Kanji / Japanisch</label>
        <label class="tag"><input type="checkbox"> Kursiv</label>
        <label class="tag"><input type="checkbox"> Custom</label>
      </div>
    </div>
    <div class="f"><span class="lbl">Individualisierung je Stück</span>
      <div class="tags">
        <label class="tag"><input type="checkbox"> Mitgliedsname</label>
        <label class="tag"><input type="checkbox"> Gurtgrad</label>
        <label class="tag"><input type="checkbox"> Nummerierung</label>
        <label class="tag"><input type="checkbox"> Keine</label>
      </div>
    </div>
    <div class="f"><span class="lbl">Einfassung / Revers-Farbe</span>
      <div class="tags">
        <label class="tag"><input type="checkbox"> Weiß</label>
        <label class="tag"><input type="checkbox"> Schwarz</label>
        <label class="tag"><input type="checkbox"> Gold</label>
        <label class="tag"><input type="checkbox"> Wie Grundfarbe</label>
      </div>
    </div>
  </div>
  ${eingebetteteDateien.length > 0 ? `
  <div style="margin-top:5mm;">
    <span class="lbl" style="display:block;margin-bottom:3mm;">Bereitgestellte Logo- &amp; Branding-Dateien:</span>
    <div style="display:flex;flex-wrap:wrap;gap:5mm;align-items:flex-start;">
      ${eingebetteteDateien.filter(d => d.dataUrl).map(d => `
        <div style="text-align:center;max-width:55mm;">
          <img src="${d.dataUrl}" style="max-width:55mm;max-height:40mm;border:1px solid #eee;border-radius:4px;object-fit:contain;" alt="${d.original_name}">
          <div style="font-size:6.5pt;color:#999;margin-top:2mm;word-break:break-all;">${d.original_name}</div>
        </div>
      `).join('')}
    </div>
  </div>` : ''}
</div>
</div>

<!-- SEITE 3 -->
<div class="page">
<div class="ch"><span>Karate-Gi Bestellvorlage – Kampfkunstschule Schreiner</span><span>Seite 3 / 4</span></div>

<div class="sec">
  <div class="st"><span class="n">6</span> Pflegekennzeichnung (Care Label)</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm 10mm;">
    <div>
      <span class="lbl" style="display:block;margin-bottom:3mm;">Pflegesymbole (ISO 3758):</span>
      <div class="care-row">
        <div class="ci"><svg viewBox="0 0 44 40" fill="none"><path d="M4 14 L8 36 L36 36 L40 14 Z" stroke="#1a1a2e" stroke-width="2.5" fill="white"/><text x="22" y="30" text-anchor="middle" font-size="11" font-weight="800" fill="#1a1a2e" font-family="sans-serif">30°</text><line x1="13" y1="24" x2="31" y2="24" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="3,2"/></svg><span>Schonwäsche 30°C</span></div>
        <div class="ci"><svg viewBox="0 0 44 40" fill="none"><polygon points="22,4 40,36 4,36" stroke="#1a1a2e" stroke-width="2.5" fill="white"/><line x1="12" y1="16" x2="32" y2="32" stroke="#1a1a2e" stroke-width="2.5"/><line x1="32" y1="16" x2="12" y2="32" stroke="#1a1a2e" stroke-width="2.5"/></svg><span>Nicht bleichen</span></div>
        <div class="ci"><svg viewBox="0 0 44 44" fill="none"><rect x="4" y="4" width="36" height="36" rx="3" stroke="#1a1a2e" stroke-width="2.5" fill="white"/><circle cx="22" cy="22" r="11" stroke="#1a1a2e" stroke-width="1.5" fill="white"/><line x1="9" y1="9" x2="35" y2="35" stroke="#1a1a2e" stroke-width="2.5"/></svg><span>Nicht im Trockner</span></div>
        <div class="ci"><svg viewBox="0 0 44 44" fill="none"><rect x="4" y="4" width="36" height="36" rx="3" stroke="#1a1a2e" stroke-width="2.5" fill="white"/><line x1="10" y1="22" x2="34" y2="22" stroke="#1a1a2e" stroke-width="3"/></svg><span>Liegend trocknen</span></div>
        <div class="ci"><svg viewBox="0 0 52 40" fill="none"><path d="M6 30 Q6 18 20 17 L40 17 Q46 17 46 23 L46 30 Z" stroke="#1a1a2e" stroke-width="2.5" fill="white"/><rect x="16" y="30" width="26" height="5" rx="1" stroke="#1a1a2e" stroke-width="1.5" fill="#eee"/><line x1="26" y1="17" x2="26" y2="10" stroke="#1a1a2e" stroke-width="2.5"/><line x1="26" y1="10" x2="16" y2="10" stroke="#1a1a2e" stroke-width="2.5"/><line x1="16" y1="10" x2="16" y2="15" stroke="#1a1a2e" stroke-width="2.5"/><circle cx="26" cy="24" r="2.5" fill="#1a1a2e"/></svg><span>Bügeln max. 110°C</span></div>
        <div class="ci"><svg viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="17" stroke="#1a1a2e" stroke-width="2.5" fill="white"/><text x="22" y="28" text-anchor="middle" font-size="15" font-weight="800" fill="#1a1a2e" font-family="serif">P</text><line x1="8" y1="8" x2="36" y2="36" stroke="#1a1a2e" stroke-width="2.5"/></svg><span>Keine chem. Reinigung</span></div>
      </div>
      <div class="ibox"><strong>Waschanleitung:</strong> Karate-Gi bei max. 30°C waschen. Kein Weichspüler. Nicht im Trockner. Liegend lufttrocknen. Weiße Gis alternativ bei 60°C. Bei Bedarf auf links bügeln.</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4mm;">
      <span class="lbl" style="display:block;">Label-Spezifikation:</span>
      <div class="f"><span class="lbl">Material (Label-Text)</span><input class="val" type="text" value="${spez.labelText || ''}" placeholder="z. B. 100% Baumwolle / 100% Cotton"></div>
      <div class="f"><span class="lbl">Label-Sprachen</span>
        <div class="tags">
          <label class="tag"><input type="checkbox" ${langIn('Deutsch')}> Deutsch</label>
          <label class="tag"><input type="checkbox" ${langIn('Englisch')}> Englisch</label>
          <label class="tag"><input type="checkbox" ${langIn('Französisch')}> Französisch</label>
          <label class="tag"><input type="checkbox" ${langIn('Japanisch')}> Japanisch</label>
        </div>
      </div>
      <div class="f"><span class="lbl">Label-Art</span>
        <div class="tags">
          <label class="tag"><input type="checkbox" ${artIn('Gewebtes Etikett')}> Gewebtes Etikett</label>
          <label class="tag"><input type="checkbox" ${artIn('Gedrucktes Etikett')}> Gedrucktes Etikett</label>
          <label class="tag"><input type="checkbox" ${artIn('Eingestickt')}> Eingestickt</label>
        </div>
      </div>
      <div class="f"><span class="lbl">Label-Position</span>
        <div class="tags">
          <label class="tag"><input type="checkbox" ${posLIn('Nacken (innen)')}> Nacken (innen)</label>
          <label class="tag"><input type="checkbox" ${posLIn('Seitennaht')}> Seitennaht</label>
          <label class="tag"><input type="checkbox" ${posLIn('Hosenbund (innen)')}> Hosenbund (innen)</label>
        </div>
      </div>
      <div class="f"><span class="lbl">Zusatztext auf Label</span><input class="val" type="text" value="${spez.labelZusatz || ''}" placeholder="z. B. Made exclusively for Kampfkunstschule Schreiner · TDA"></div>
    </div>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">7</span> Bemerkungen</div>
  <textarea style="border:1px solid #ccc;border-radius:3px;padding:4px 6px;width:100%;font-size:9pt;font-family:inherit;resize:vertical;min-height:16mm;" rows="3">${form.bemerkungen}</textarea>
</div>

<div class="sec">
  <div class="st"><span class="n">8</span> Freigabe &amp; Unterschrift</div>
  <div class="fg3" style="margin-bottom:5mm;">
    <div class="f"><span class="lbl">Gesamtmenge</span><input class="val" type="text" value="${grandTotal} Stück" style="font-weight:800;font-size:13pt;"></div>
    <div class="f"><span class="lbl">Auftragswert (netto)</span><input class="val" type="text" placeholder="€ ___________"></div>
    <div class="f"><span class="lbl">Zahlungsziel / Incoterms</span><input class="val" type="text" placeholder="z. B. 30 Tage / DAP"></div>
  </div>
  <div class="sig-row">
    <div><div class="sig-area"></div><div class="sig-cap">Datum &amp; Ort</div></div>
    <div><div class="sig-area"></div><div class="sig-cap">Unterschrift Besteller<br><small>Kampfkunstschule Schreiner</small></div></div>
    <div><div class="sig-area"></div><div class="sig-cap">Bestätigung Lieferant<br><small>Stempel + Unterschrift</small></div></div>
  </div>
</div>
</div>

<!-- SEITE 4 -->
<div class="page">
<div class="ph">
  <div><h1 style="font-size:15pt;">Maßtabellen &amp; Größenübersicht</h1><div class="sub">Beide Modelle – Referenz-Maßzeichnungen</div></div>
  <div style="font-size:8pt;color:#999;text-align:right;">Seite 4 / 4<br>Toleranz ±1,5 cm</div>
</div>
<div class="chart-block">
  <div class="chart-label" style="${form.model==='128'?'border-color:var(--gold);':'border-color:#ddd;color:#999;'}">
    Modell 128 &nbsp;·&nbsp; 11 Größen (140–200 cm) ${form.model==='128'?' ← Gewähltes Modell':''}
  </div>
  <img src="${img128}" alt="Größentabelle Modell 128">
</div>
<div class="chart-block">
  <div class="chart-label" style="${form.model==='188'?'border-color:var(--gold);':'border-color:#ddd;color:#999;'}">
    Modell 188 &nbsp;·&nbsp; 8 Größen (130–200 cm) ${form.model==='188'?' ← Gewähltes Modell':''}
  </div>
  <img src="${img188}" alt="Größentabelle Modell 188">
</div>
<div style="font-size:7.5pt;color:#999;text-align:center;margin:3mm 0;font-style:italic;">
  Masspunkte: 1=Rückenlänge Jacke · 2=Rückenbreite · 3=Spannweite gesamt · 4=Ärmellänge · 5=Schulterbreite · A=Hosenlänge · B=Bundbreite (½) · C=Saumbreite (½)
</div>
</div>

<button class="print-btn" onclick="window.print()">&#128438; PDF drucken</button>
</body></html>`;
}
