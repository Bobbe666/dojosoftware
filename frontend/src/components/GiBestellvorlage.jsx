import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import '../styles/GiBestellvorlage.css';

const SIZES = {
  '188': [130, 140, 150, 160, 170, 180, 190, 200],
};

// Maßtabelle: vollständige Größenrange unabhängig vom Modell
const MASS_SIZES = [100, 110, 120, 130, 140, 150, 160, 165, 170, 175, 180, 185, 190, 195, 200, 205, 210];

const EMPTY_MENGEN = (model) =>
  SIZES[model].reduce((acc, s) => ({ ...acc, [s]: '' }), {});

const EMPTY_SPEZ = {
  material: [], materialText: '', webart: [],
  grammaturKids: [], grammaturAdult: [],
  waeschetikett: '',
  labelText: '', labelSprachen: ['Deutsch', 'Englisch'],
  labelArt: [], labelPosition: [], labelZusatz: '',
  massTabelle: {},
  stiche_cm: '', verstaerkungen: [],
  gurtschlaufen_anzahl: '', gurtschlaufen_breite: '', nahtBemerkung: '',
  verp_typ: '', verp_stueck_beutel: '1', verp_stueck_karton: '',
  verp_label: '', verp_ean: false, verp_bemerkung: '',
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
  model: '188', modelName: '', artikelNr: '',
  besteller: 'Kampfkunstschule Schreiner',
  lieferantId: '', lieferantFreitext: '',
  ansprechpartnerBesteller: 'Sascha Schreiner',
  ansprechpartnerLieferant: '',
  bestelldatum: new Date().toLocaleDateString('de-DE'),
  lieferdatum: '', projekt: '', farbe: 'Weiß', wkf: false,
  katKids: true, katAdult: true,
  mengenKids: EMPTY_MENGEN('188'), mengenAdult: EMPTY_MENGEN('188'),
  stickereiPos: [], stickereiSchriftzug: '',
  stickereiGarnfarben: 'Gold, Schwarz', stickereiBemerkung: '',
  bemerkungen: '', spezifikation: { ...EMPTY_SPEZ },
  schnittTyp: '', reversTyp: '', hosenbundTyp: '', schnittBemerkung: '',
  muster_benoetigt: false, muster_groesse: '', muster_deadline: '',
  muster_mitStickerei: false, muster_bemerkung: '',
  zeitplan_sample: '', zeitplan_prod: '', zeitplan_schiff: '',
  pantone_garn1: '', pantone_garn2: '', pantone_paspel: '', pantone_grundfarbe: '',
};

const POSITIONEN = [
  'Linkes Revers', 'Rechtes Revers', 'Rücken oben', 'Rücken Mitte',
  'Linker Ärmel', 'Rechter Ärmel', 'Hosenbein links', 'Hosenbein rechts', 'Kragen',
];
const MATERIALIEN  = ['100% Baumwolle', 'Baumwolle/Polyester', 'Canvas', 'Synthetik'];
const WEBARTEN     = ['Single Weave', 'Double Weave', 'Kata', 'Kumite / Leicht'];
const GRAMMATUREN  = ['8 oz (~270 g/m²)', '10 oz (~340 g/m²)', '12 oz (~400 g/m²)', '14 oz (~470 g/m²)'];
const LABEL_LANG   = ['Deutsch', 'Englisch', 'Französisch', 'Japanisch'];
const LABEL_ART    = ['Gewebtes Etikett', 'Gedrucktes Etikett', 'Eingestickt'];
const LABEL_POS    = ['Nacken (innen)', 'Seitennaht', 'Hosenbund (innen)'];

const SCHNITT_TYPEN   = ['Regular', 'Slim', 'Traditional', 'Competition-Cut'];
const REVERS_TYPEN    = ['Breit (Standard)', 'Schmal', 'Competition-Flap'];
const HOSENBUND_TYPEN = ['Kordel', 'Gummibund', 'Kordel + Gummi'];
const VERSTAERKUNGEN  = ['Seitenabschluss', 'Gürtelschlaufen', 'Knotenbereich', 'Kragen-Ansatz', 'Ärmel-Saum', 'Hosenbund'];
const VERP_TYPEN      = ['Gefaltet', 'Auf Hänger'];

const MASSPUNKTE = [
  { key: 'rL', num: '①', label: 'Rückenlänge Jacke',  hint: 'Mitte Nacken bis Jackenende' },
  { key: 'rB', num: '②', label: 'Rückenbreite',        hint: 'zwischen den Schulterblättern' },
  { key: 'sw', num: '③', label: 'Spannweite gesamt',   hint: 'Ärmel li + Rücken + Ärmel re' },
  { key: 'aL', num: '④', label: 'Ärmellänge',          hint: 'Schulter außen bis Ärmelsaum' },
  { key: 'sB', num: '⑤', label: 'Schulterbreite',      hint: 'Schulter außen – außen' },
  { key: 'hL', num: 'Ⓐ', label: 'Hosenlänge',          hint: 'Bund bis Hosenende' },
  { key: 'bB', num: 'Ⓑ', label: 'Bundbreite ½',        hint: 'halbe Bundweite flachgelegt' },
  { key: 'sM', num: 'Ⓒ', label: 'Saumbreite ½',        hint: 'halbe Saumweite flachgelegt' },
];

export default function GiBestellvorlage({ artikel = null, vorlage = null, onClose = null, initEditingId = null, initFormdata = null, overrideDojoId = null }) {
  const { activeDojo, dojos } = useDojoContext();
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
  const [editingBestellungId, setEditingBestellungId] = useState(initEditingId);
  const [dojoAuswahl, setDojoAuswahl] = useState(overrideDojoId || null); // für Super-Admin
  const [dojoAuswahlModal, setDojoAuswahlModal] = useState(false);
  const fileInputRef = useRef(null);
  const pendingLangRef = useRef('de');
  const [zeichnungSichtbar, setZeichnungSichtbar] = useState(true);
  const uploadTagRef = useRef(null);

  const fixUtf8 = (s) => { try { return decodeURIComponent(escape(s)); } catch { return s; } };

  const buildInitialForm = () => {
    if (initFormdata) {
      return {
        ...EMPTY,
        ...initFormdata,
        spezifikation: { ...EMPTY_SPEZ, ...(initFormdata.spezifikation || {}) },
        mengenKids:  initFormdata.mengenKids  ? { ...EMPTY_MENGEN(initFormdata.model || '188'), ...initFormdata.mengenKids }  : EMPTY_MENGEN(initFormdata.model || '188'),
        mengenAdult: initFormdata.mengenAdult ? { ...EMPTY_MENGEN(initFormdata.model || '188'), ...initFormdata.mengenAdult } : EMPTY_MENGEN(initFormdata.model || '188'),
      };
    }
    if (vorlage) {
      let stickereiPos = vorlage.stickerei_pos;
      if (typeof stickereiPos === 'string') {
        try { stickereiPos = JSON.parse(stickereiPos); } catch { stickereiPos = []; }
      }
      if (Array.isArray(stickereiPos)) stickereiPos = stickereiPos.map(fixUtf8);
      let spez = { ...EMPTY_SPEZ };
      if (vorlage.spezifikation) {
        try { spez = { ...EMPTY_SPEZ, ...JSON.parse(vorlage.spezifikation) }; } catch {}
      }
      return {
        ...EMPTY,
        modelName: vorlage.modell_name || '',
        artikelNr: vorlage.artikel_nr_vorl || '',
        model: vorlage.modell || '188',
        lieferantId: String(vorlage.lieferant_id || ''),
        farbe: vorlage.farbe || 'Weiß',
        wkf: !!vorlage.wkf,
        stickereiPos: Array.isArray(stickereiPos) ? stickereiPos : [],
        stickereiSchriftzug: vorlage.stickerei_text || '',
        stickereiGarnfarben: vorlage.stickerei_farben || 'Gold, Schwarz',
        stickereiBemerkung: vorlage.stickerei_datei || '',
        bemerkungen: vorlage.bemerkungen || '',
        mengenKids:  spez.mengenKids  ? { ...EMPTY_MENGEN(vorlage.modell || '188'), ...spez.mengenKids  } : EMPTY_MENGEN(vorlage.modell || '188'),
        mengenAdult: spez.mengenAdult ? { ...EMPTY_MENGEN(vorlage.modell || '188'), ...spez.mengenAdult } : EMPTY_MENGEN(vorlage.modell || '188'),
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

  const triggerUpload = (tag = null) => {
    uploadTagRef.current = tag;
    fileInputRef.current?.click();
  };

  const uploadDatei = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !vorlage?.vorlage_id) return;
    const tag = uploadTagRef.current;
    setUploadingFile(tag || true);
    try {
      const fd = new FormData();
      fd.append('datei', file);
      if (tag) fd.append('tag', tag);
      const res = await axios.post(
        `/bestellvorlagen/${vorlage.vorlage_id}/dateien?dojo_id=${dojoId}`,
        fd, { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (res.data?.datei) setDateien(prev => [...prev, res.data.datei]);
    } catch {}
    finally {
      setUploadingFile(false);
      uploadTagRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
    setForm(p => ({
      ...p, model,
      mengenKids:  migrate(p.mengenKids),
      mengenAdult: migrate(p.mengenAdult),
      // massTabelle bleibt erhalten — nutzt MASS_SIZES unabhängig vom Modell
    }));
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
  const setMassTabelle = (groesse, key, val) =>
    setForm(p => ({
      ...p,
      spezifikation: {
        ...p.spezifikation,
        massTabelle: {
          ...(p.spezifikation.massTabelle || {}),
          [groesse]: { ...(p.spezifikation.massTabelle?.[groesse] || {}), [key]: val },
        },
      },
    }));
  const totalFor   = (row) => Object.values(form[row]).reduce((s, v) => s + (parseInt(v) || 0), 0);
  const grandTotal = () => totalFor('mengenKids') + totalFor('mengenAdult');

  const generatePdf = async (forcedDojoId) => {
    const lang = pendingLangRef.current || 'de';
    const djId = forcedDojoId || dojoAuswahl || vorlage?.dojo_id || dojoId;
    if (!djId && dojos && dojos.length > 1) {
      setDojoAuswahlModal(true);
      return;
    }
    setGenerating(true);
    try {
      const origin = window.location.origin;

      // Bestellung in DB speichern oder überschreiben
      const effectiveDjId = djId;
      let neueBestellungId = editingBestellungId;
      if (effectiveDjId) {
        const payload = {
          vorlage_id:     vorlage?.vorlage_id || null,
          lieferant_id:   form.lieferantId ? Number(form.lieferantId) : null,
          lieferant_name: form.lieferantFreitext || null,
          bestelldatum:   form.bestelldatum || null,
          lieferdatum:    form.lieferdatum  || null,
          formdata:       { ...form, spezifikation: form.spezifikation, mengenKids: form.mengenKids, mengenAdult: form.mengenAdult },
        };
        try {
          if (editingBestellungId) {
            await axios.put(`/gi-bestellungen/${editingBestellungId}?dojo_id=${djId}`, payload);
          } else {
            const bRes = await axios.post(`/gi-bestellungen?dojo_id=${djId}`, payload);
            neueBestellungId = bRes.data?.bestellung_id;
          }
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
      const html = buildPdfHtml(form, origin, eingebetteteDateien, neueBestellungId, lang);
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

  const loadBestellungIntoForm = (b) => {
    try {
      const fd = typeof b.formdata === 'string' ? JSON.parse(b.formdata) : b.formdata;
      if (!fd) return;
      setForm({
        ...EMPTY,
        ...fd,
        spezifikation: { ...EMPTY_SPEZ, ...(fd.spezifikation || {}) },
        mengenKids:  fd.mengenKids  ? { ...EMPTY_MENGEN(fd.model || '188'), ...fd.mengenKids }  : EMPTY_MENGEN(fd.model || '188'),
        mengenAdult: fd.mengenAdult ? { ...EMPTY_MENGEN(fd.model || '188'), ...fd.mengenAdult } : EMPTY_MENGEN(fd.model || '188'),
      });
      setEditingBestellungId(b.bestellung_id);
      setHistorieSichtbar(false);
    } catch {}
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
          {editingBestellungId ? (
            <div className="gv-edit-banner">
              Bearbeitung von Bestellung #{String(editingBestellungId).padStart(4, '0')} — PDF überschreibt diese Bestellung
            </div>
          ) : (
            <div className="gv-sub">Vorauswahl treffen → PDF generieren → drucken</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexShrink: 0 }}>
          {saveMsg && (
            <span style={{ fontSize: '0.8rem', color: saveMsg.includes('Fehler') ? '#f87171' : '#86efac' }}>
              {saveMsg}
            </span>
          )}
          {editingBestellungId && (
            <button className="gv-btn-back" onClick={() => setEditingBestellungId(null)}>
              Bearbeitung abbrechen
            </button>
          )}
          {vorlage?.vorlage_id && (
            <button className="gv-btn-save" onClick={saveVorlage} disabled={saving}>
              {saving ? 'Speichert…' : 'Einstellungen speichern'}
            </button>
          )}
          <button className="gv-btn-pdf" onClick={() => { pendingLangRef.current = 'de'; generatePdf(); }} disabled={generating}>
            {generating ? 'Erstelle PDF…' : editingBestellungId ? 'PDF aktualisieren & drucken' : 'PDF generieren & drucken'}
          </button>
          <button className="gv-btn-pdf" style={{ background: 'rgba(212,175,55,0.15)', fontSize: '0.82rem' }}
            onClick={() => { pendingLangRef.current = 'en'; generatePdf(); }} disabled={generating}>
            PDF (EN)
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
                    <button className="gv-historie-edit" title="Bearbeiten"
                      onClick={() => loadBestellungIntoForm(b)}>✎</button>
                    <button className="gv-historie-del" title="Löschen" onClick={async () => {
                      const djId = vorlage?.dojo_id || dojoId;
                      try {
                        await axios.delete(`/gi-bestellungen/${b.bestellung_id}?dojo_id=${djId}`);
                        setBestellungen(prev => prev.filter(x => x.bestellung_id !== b.bestellung_id));
                        if (editingBestellungId === b.bestellung_id) setEditingBestellungId(null);
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
          <div className="gv-section-title">Modell</div>
          <div className="gv-model-row">
            <div className="gv-model-card active" style={{ cursor: 'default', maxWidth: '200px' }}>
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
          <div className="gv-grid4">
            {/* Zeile 1: Lieferant (2 Spalten) + Hersteller + Farbe */}
            <div className="gv-field gv-col-2">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
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
              <label className="gv-label">Farbe / Ausführung</label>
              <input className="gv-input" value={form.farbe} onChange={f('farbe')} />
            </div>
            {/* Zeile 2: 4 kleine Felder */}
            <div className="gv-field">
              <label className="gv-label">AP Lieferant</label>
              <input className="gv-input" value={form.ansprechpartnerLieferant} onChange={f('ansprechpartnerLieferant')}
                placeholder={selectedLt?.email ? selectedLt.email : 'Name / Abteilung'} />
            </div>
            <div className="gv-field">
              <label className="gv-label">AP Besteller</label>
              <input className="gv-input" value={form.ansprechpartnerBesteller} onChange={f('ansprechpartnerBesteller')} />
            </div>
            <div className="gv-field">
              <label className="gv-label">Bestelldatum</label>
              <input className="gv-input" value={form.bestelldatum} onChange={f('bestelldatum')} placeholder="TT.MM.JJJJ" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Gewünschtes Lieferdatum</label>
              <input className="gv-input" value={form.lieferdatum} onChange={f('lieferdatum')} placeholder="TT.MM.JJJJ" />
            </div>
            {/* Zeile 3: Projekt + WKF */}
            <div className="gv-field gv-col-3">
              <label className="gv-label">Projekt / Verwendungszweck</label>
              <input className="gv-input" value={form.projekt} onChange={f('projekt')} placeholder="z. B. Vereinsausstattung 2026" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.1rem' }}>
              <label className="gv-check-row" style={{ margin: 0 }}>
                <input type="checkbox" checked={form.wkf} onChange={fb('wkf')} />
                WKF-zugelassen
              </label>
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
        </div>

        {/* ── PRODUKTSPEZIFIKATION ── */}
        <div className="gv-section">
          <div className="gv-section-title">Produktspezifikation</div>
          <div className="gv-grid4">
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
              <label className="gv-label">Grammatur Kinder</label>
              <SpezChip options={GRAMMATUREN} field="grammaturKids" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Grammatur Erwachsene</label>
              <SpezChip options={GRAMMATUREN} field="grammaturAdult" />
            </div>
          </div>
        </div>

        {/* ── SCHNITT & PASSFORM ── */}
        <div className="gv-section">
          <div className="gv-section-title">Schnitt &amp; Passform</div>
          <div className="gv-grid3">
            <div className="gv-field">
              <label className="gv-label">Schnitttyp</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                {SCHNITT_TYPEN.map(opt => {
                  const active = form.schnittTyp === opt;
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
                      <input type="radio" style={{ display: 'none' }} checked={active} onChange={() => setForm(p => ({ ...p, schnittTyp: p.schnittTyp === opt ? '' : opt }))} />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="gv-field">
              <label className="gv-label">Revers-Typ</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                {REVERS_TYPEN.map(opt => {
                  const active = form.reversTyp === opt;
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
                      <input type="radio" style={{ display: 'none' }} checked={active} onChange={() => setForm(p => ({ ...p, reversTyp: p.reversTyp === opt ? '' : opt }))} />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="gv-field">
              <label className="gv-label">Hosenbund</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                {HOSENBUND_TYPEN.map(opt => {
                  const active = form.hosenbundTyp === opt;
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
                      <input type="radio" style={{ display: 'none' }} checked={active} onChange={() => setForm(p => ({ ...p, hosenbundTyp: p.hosenbundTyp === opt ? '' : opt }))} />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="gv-field" style={{ marginTop: '0.65rem' }}>
            <label className="gv-label">Schnitt-Bemerkung</label>
            <input className="gv-input" value={form.schnittBemerkung} onChange={f('schnittBemerkung')} placeholder="z. B. Besondere Passform-Anforderungen" />
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

        {/* ── MAßSPEZIFIKATION ── */}
        <div className="gv-section">
          <div className="gv-section-title-row">
            <span className="gv-section-title">Maßspezifikation für den Hersteller</span>
            <button className="gv-zeichnung-toggle" onClick={() => setZeichnungSichtbar(v => !v)}>
              {zeichnungSichtbar ? 'Zeichnung ▲' : 'Zeichnung zeigen ▼'}
            </button>
            {vorlage?.vorlage_id && (
              <button className="gv-btn-save" onClick={saveVorlage} disabled={saving} style={{ flexShrink: 0 }}>
                {saving ? 'Speichert…' : '💾 Maße speichern'}
              </button>
            )}
          </div>
          <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.3)', marginBottom: '0.65rem' }}>
            Alle Angaben in cm · Masspunkte-Referenz in der Zeichnung · ①=Rückenlänge · ②=Rückenbreite · ③=Spannweite · ④=Ärmellänge · ⑤=Schulterbreite · Ⓐ=Hosenlänge · Ⓑ=Bundbreite(½) · Ⓒ=Saumbreite(½)
          </div>
          <div className="gv-mass-layout">
            {zeichnungSichtbar && (
              <img
                className="gv-zeichnung-img"
                src={`/gi-charts/modell-${form.model}.jpg`}
                alt={`Maßzeichnung Modell ${form.model}`}
              />
            )}
            <div className="gv-mass-wrap">
              <table className="gv-mass-table">
                <thead>
                  <tr>
                    <th className="gv-mt-mp">Masspunkt</th>
                    {MASS_SIZES.map(s => <th key={s}>{s}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {MASSPUNKTE.map(mp => (
                    <tr key={mp.key}>
                      <td className="gv-mt-label">
                        <span className="gv-mt-num">{mp.num}</span>
                        <span className="gv-mt-name">{mp.label}</span>
                        <span className="gv-mt-hint">{mp.hint}</span>
                      </td>
                      {MASS_SIZES.map(s => (
                        <td key={s}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            className="gv-mt-input"
                            value={spez.massTabelle?.[s]?.[mp.key] || ''}
                            onChange={e => setMassTabelle(s, mp.key, e.target.value)}
                            placeholder="—"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── STICKEREI ── */}
        <div className="gv-section">
          <div className="gv-section-title">Stickerei & Branding</div>

          {/* Positions-Checkboxen */}
          <div className="gv-pos-grid">
            {POSITIONEN.map(pos => (
              <label key={pos} className={`gv-pos-item ${form.stickereiPos.includes(pos) ? 'active' : ''}`}>
                <input type="checkbox" checked={form.stickereiPos.includes(pos)} onChange={() => togglePos(pos)} />
                {pos}
              </label>
            ))}
          </div>

          {/* Allgemeine Stickerei-Felder */}
          <div className="gv-grid3" style={{ marginTop: '0.65rem' }}>
            <div className="gv-field">
              <label className="gv-label">Schriftzug / Text</label>
              <input className="gv-input" value={form.stickereiSchriftzug} onChange={f('stickereiSchriftzug')} placeholder="z. B. Kampfkunstschule Schreiner · TDA" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Garnfarben</label>
              <input className="gv-input" value={form.stickereiGarnfarben} onChange={f('stickereiGarnfarben')} />
            </div>
            <div className="gv-field">
              <label className="gv-label">Bemerkung / Referenz-Datei</label>
              <input className="gv-input" value={form.stickereiBemerkung} onChange={f('stickereiBemerkung')} placeholder="z. B. TDA_logo_v2.dst" />
            </div>
          </div>

          {/* Pantone-Codes */}
          <div className="gv-grid4" style={{ marginTop: '0.65rem' }}>
            <div className="gv-field">
              <label className="gv-label">Grundfarbe Pantone</label>
              <input className="gv-input" value={form.pantone_grundfarbe} onChange={f('pantone_grundfarbe')} placeholder="z. B. Pantone White / NTR" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Garn-Pantone 1</label>
              <input className="gv-input" value={form.pantone_garn1} onChange={f('pantone_garn1')} placeholder="z. B. Pantone 116 C – Gold" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Garn-Pantone 2</label>
              <input className="gv-input" value={form.pantone_garn2} onChange={f('pantone_garn2')} placeholder="z. B. Pantone Black C" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Paspel/Revers-Pantone</label>
              <input className="gv-input" value={form.pantone_paspel} onChange={f('pantone_paspel')} placeholder="z. B. Pantone 116 C" />
            </div>
          </div>

          {/* Datei je Position */}
          {form.stickereiPos.length > 0 && (
            <div className="gv-pos-upload-block">
              <div className="gv-pos-upload-head">Datei je Position</div>
              {/* Gemeinsamer file-input für alle Positions-Uploads */}
              <input ref={fileInputRef} type="file" style={{ display: 'none' }}
                accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.ai,.eps,.dst,.pes,.exp,.jef,.vp3"
                onChange={uploadDatei} />
              {form.stickereiPos.map(pos => {
                const posDatei = dateien.find(d => d.tag === pos);
                const uploading = uploadingFile === pos;
                return (
                  <div key={pos} className="gv-pos-upload-row">
                    <span className="gv-pos-upload-label">{pos}</span>
                    {posDatei ? (
                      <>
                        <span className="gv-pos-upload-file" title={posDatei.original_name}>
                          {posDatei.original_name}
                        </span>
                        <button className="gv-pos-upload-del" onClick={() => deleteDatei(posDatei.datei_id)} title="Löschen">✕</button>
                      </>
                    ) : vorlage?.vorlage_id ? (
                      <button className="gv-pos-upload-btn" onClick={() => triggerUpload(pos)} disabled={!!uploadingFile}>
                        {uploading ? 'Lädt…' : '+ Datei hochladen'}
                      </button>
                    ) : (
                      <span className="gv-pos-upload-hint">erst Vorlage speichern</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Wäscheetikett Innen Kragen */}
          <div className="gv-waetikett-block">
            <div className="gv-pos-upload-head">Wäscheetikett (Innen Kragen)</div>
            <div className="gv-waetikett-row">
              <div className="gv-field" style={{ flex: 1 }}>
                <label className="gv-label">Platzierung / Bemerkung</label>
                <input className="gv-input" value={spez.waeschetikett || ''} onChange={fSpez('waeschetikett')}
                  placeholder="z. B. Mitte Nacken, 2 cm unter Kragen" />
              </div>
              {vorlage?.vorlage_id ? (() => {
                const wtDatei = dateien.find(d => d.tag === '__waetikett__');
                const uploading = uploadingFile === '__waetikett__';
                return wtDatei ? (
                  <div className="gv-waetikett-file">
                    <span title={wtDatei.original_name}>{wtDatei.original_name}</span>
                    <button className="gv-pos-upload-del" onClick={() => deleteDatei(wtDatei.datei_id)}>✕</button>
                  </div>
                ) : (
                  <button className="gv-pos-upload-btn" style={{ marginTop: '1.1rem' }}
                    onClick={() => triggerUpload('__waetikett__')} disabled={!!uploadingFile}>
                    {uploading ? 'Lädt…' : '+ Etikett-Datei'}
                  </button>
                );
              })() : null}
            </div>
          </div>
        </div>

        {/* ── LOGOS & DATEIEN (allgemein, ohne Tag) ── */}
        <div className="gv-section">
          <div className="gv-section-title">Logos &amp; Allgemeine Dateien</div>
          {vorlage?.vorlage_id ? (
            <>
              {/* Gemeinsamer file-input wenn kein Stickerei-Pos ausgewählt (dann ist er oben) */}
              {form.stickereiPos.length === 0 && (
                <input ref={fileInputRef} type="file" style={{ display: 'none' }}
                  accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.ai,.eps,.dst,.pes,.exp,.jef,.vp3"
                  onChange={uploadDatei} />
              )}
              <div className="gv-upload-zone" onClick={() => triggerUpload(null)}>
                {uploadingFile === true
                  ? <span className="gv-upload-hint">Wird hochgeladen…</span>
                  : <span className="gv-upload-hint">+ Datei hochladen (Logos, Referenz-PDFs, allgemeine Dateien)</span>}
              </div>
              {dateien.filter(d => !d.tag).length > 0 && (
                <div className="gv-datei-list">
                  {dateien.filter(d => !d.tag).map(d => {
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

        {/* ── NAHT & VERARBEITUNG ── */}
        <div className="gv-section">
          <div className="gv-section-title">Naht &amp; Verarbeitung</div>
          <div className="gv-grid4">
            <div className="gv-field">
              <label className="gv-label">Stiche/cm</label>
              <input className="gv-input" type="number" min="0" value={spez.stiche_cm || ''} onChange={fSpez('stiche_cm')} placeholder="z. B. 5" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Gürtelschlaufen Anzahl</label>
              <input className="gv-input" type="number" min="0" value={spez.gurtschlaufen_anzahl || ''} onChange={fSpez('gurtschlaufen_anzahl')} placeholder="z. B. 7" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Gürtelschlaufen Breite cm</label>
              <input className="gv-input" value={spez.gurtschlaufen_breite || ''} onChange={fSpez('gurtschlaufen_breite')} placeholder="z. B. 4 cm" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Naht-Bemerkung</label>
              <input className="gv-input" value={spez.nahtBemerkung || ''} onChange={fSpez('nahtBemerkung')} placeholder="z. B. Doppelnaht an Schulter" />
            </div>
          </div>
          <div className="gv-field" style={{ marginTop: '0.65rem' }}>
            <label className="gv-label">Verstärkungspunkte</label>
            <SpezChip options={VERSTAERKUNGEN} field="verstaerkungen" />
          </div>
        </div>

        {/* ── MUSTER-ANFORDERUNGEN ── */}
        <div className="gv-section">
          <div className="gv-section-title">Muster-Anforderungen</div>
          <label className="gv-check-row">
            <input type="checkbox" checked={form.muster_benoetigt} onChange={fb('muster_benoetigt')} />
            PP-Sample / Muster benötigt
          </label>
          {form.muster_benoetigt && (
            <div className="gv-muster-details">
              <div className="gv-grid4">
                <div className="gv-field">
                  <label className="gv-label">Mustergröße</label>
                  <input className="gv-input" value={form.muster_groesse} onChange={f('muster_groesse')} placeholder="z. B. 170" />
                </div>
                <div className="gv-field">
                  <label className="gv-label">Muster bis (Deadline)</label>
                  <input className="gv-input" type="date" value={form.muster_deadline} onChange={f('muster_deadline')} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.1rem' }}>
                  <label className="gv-check-row" style={{ margin: 0 }}>
                    <input type="checkbox" checked={form.muster_mitStickerei} onChange={fb('muster_mitStickerei')} />
                    Mit Stickerei
                  </label>
                </div>
                <div className="gv-field">
                  <label className="gv-label">Muster-Bemerkung</label>
                  <input className="gv-input" value={form.muster_bemerkung} onChange={f('muster_bemerkung')} placeholder="z. B. Bitte mit allen Positionen" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── ZEITPLAN ── */}
        <div className="gv-section">
          <div className="gv-section-title">Zeitplan</div>
          <div className="gv-grid3">
            <div className="gv-field">
              <label className="gv-label">Sample-Freigabe bis</label>
              <input className="gv-input" type="date" value={form.zeitplan_sample} onChange={f('zeitplan_sample')} />
            </div>
            <div className="gv-field">
              <label className="gv-label">Produktionsstart</label>
              <input className="gv-input" type="date" value={form.zeitplan_prod} onChange={f('zeitplan_prod')} />
            </div>
            <div className="gv-field">
              <label className="gv-label">Schiffsbereitschaft</label>
              <input className="gv-input" type="date" value={form.zeitplan_schiff} onChange={f('zeitplan_schiff')} />
            </div>
          </div>
        </div>

        {/* ── VERPACKUNGSVORSCHRIFTEN ── */}
        <div className="gv-section">
          <div className="gv-section-title">Verpackungsvorschriften</div>
          <div className="gv-grid4">
            <div className="gv-field">
              <label className="gv-label">Verpackungstyp</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                {VERP_TYPEN.map(opt => {
                  const active = spez.verp_typ === opt;
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
                      <input type="radio" style={{ display: 'none' }} checked={active} onChange={() => setForm(p => ({ ...p, spezifikation: { ...p.spezifikation, verp_typ: p.spezifikation.verp_typ === opt ? '' : opt } }))} />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="gv-field">
              <label className="gv-label">Stück/Beutel</label>
              <input className="gv-input" type="number" min="1" value={spez.verp_stueck_beutel || ''} onChange={fSpez('verp_stueck_beutel')} />
            </div>
            <div className="gv-field">
              <label className="gv-label">Stück/Karton</label>
              <input className="gv-input" type="number" min="1" value={spez.verp_stueck_karton || ''} onChange={fSpez('verp_stueck_karton')} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.1rem' }}>
              <label className="gv-check-row" style={{ margin: 0 }}>
                <input type="checkbox" checked={!!spez.verp_ean} onChange={() => setForm(p => ({ ...p, spezifikation: { ...p.spezifikation, verp_ean: !p.spezifikation.verp_ean } }))} />
                EAN/Barcode erforderlich
              </label>
            </div>
          </div>
          <div className="gv-field" style={{ marginTop: '0.65rem' }}>
            <label className="gv-label">Label-Text auf Karton</label>
            <input className="gv-input" value={spez.verp_label || ''} onChange={fSpez('verp_label')} placeholder="z. B. KARATE-GI · Gr. XXX · Art. Nr. XXXX · Kampfkunstschule Schreiner" />
          </div>
          <div className="gv-field" style={{ marginTop: '0.5rem' }}>
            <label className="gv-label">Verpackungs-Bemerkung</label>
            <input className="gv-input" value={spez.verp_bemerkung || ''} onChange={fSpez('verp_bemerkung')} placeholder="z. B. Karton max. 20 kg" />
          </div>
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

      {/* ── DOJO-AUSWAHL MODAL (Super-Admin) ── */}
      {dojoAuswahlModal && (
        <div className="gv-lt-modal-backdrop" onClick={() => setDojoAuswahlModal(false)}>
          <div className="gv-lt-modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="gv-lt-modal-header">
              <span>Für welches Dojo?</span>
              <button className="gv-lt-modal-close" onClick={() => setDojoAuswahlModal(false)}>×</button>
            </div>
            <div className="gv-lt-modal-body" style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.55)', marginBottom: '0.75rem' }}>
                Bitte wähle das Dojo, unter dem diese Bestellung gespeichert werden soll.
              </p>
              <select
                className="gv-input"
                value={dojoAuswahl || ''}
                onChange={e => setDojoAuswahl(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Dojo wählen —</option>
                {(dojos || []).map(d => (
                  <option key={d.id} value={d.id}>{d.dojoname || d.name || `Dojo ${d.id}`}</option>
                ))}
              </select>
            </div>
            <div className="gv-lt-modal-footer">
              <button className="gv-btn-back" onClick={() => setDojoAuswahlModal(false)}>Abbrechen</button>
              <button className="gv-btn-pdf" disabled={!dojoAuswahl}
                onClick={() => { setDojoAuswahlModal(false); generatePdf(dojoAuswahl); }}>
                PDF generieren
              </button>
            </div>
          </div>
        </div>
      )}

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
export function buildPdfHtml(form, origin, eingebetteteDateien = [], bestellungId = null, lang = 'de') {
  const de = lang !== 'en';
  const T = {
    docTitle:       de ? 'Karate-Gi Bestellvorlage – Kampfkunstschule Schreiner' : 'Karate-Gi Order Form – Martial Arts School Schreiner',
    h1:             'Karate-Gi',
    sub:            de ? 'Bestellvorlage · Kampfkunstschule Schreiner' : 'Order Form · Martial Arts School Schreiner',
    nr:             de ? 'Nr.' : 'No.',
    datum:          de ? 'Datum:' : 'Date:',
    pageHeader:     de ? 'Karate-Gi Bestellvorlage – Kampfkunstschule Schreiner' : 'Karate-Gi Order Form – Martial Arts School Schreiner',
    tolerance:      de ? 'Toleranz ±1,5 cm' : 'Tolerance ±1.5 cm',
    selectedModel:  de ? '← Gewähltes Modell' : '← Selected Model',
    // Sections
    s1: de ? 'Modellauswahl' : 'Model Selection',
    s2: de ? 'Bestelldaten' : 'Order Details',
    s3: de ? 'Produktspezifikation' : 'Product Specification',
    s4: de ? 'Kategorie & Mengenbestellung' : 'Category & Quantity Order',
    s5: de ? 'Stickerei & Branding' : 'Embroidery & Branding',
    s6: de ? 'Pflegekennzeichnung (Care Label)' : 'Care Instructions (Care Label)',
    s7: de ? 'Bemerkungen' : 'Remarks',
    s8: de ? 'Freigabe & Unterschrift' : 'Approval & Signature',
    s9: de ? 'Maßtabellen & Größenübersicht' : 'Size Charts & Measurements',
    s9sub: de ? 'Beide Modelle – Referenz-Maßzeichnungen' : 'Both Models — Reference Size Drawings',
    // Fields
    modellbez:   de ? 'Modellbezeichnung' : 'Model Name',
    artikelNr:   de ? 'Artikel-Nr.' : 'Article No.',
    besteller:   de ? 'Besteller' : 'Purchaser',
    lieferant:   de ? 'Hersteller / Lieferant' : 'Manufacturer / Supplier',
    apBesteller: de ? 'Ansprechpartner Besteller' : 'Contact Person (Buyer)',
    apLieferant: de ? 'Ansprechpartner Lieferant' : 'Contact Person (Supplier)',
    bestelldat:  de ? 'Bestelldatum' : 'Order Date',
    lieferdat:   de ? 'Gewünschtes Lieferdatum' : 'Requested Delivery Date',
    projekt:     de ? 'Projekt / Verwendungszweck' : 'Project / Purpose',
    farbe:       de ? 'Farbe / Ausführung' : 'Colour / Finish',
    // Spec
    material:     de ? 'Material' : 'Material',
    cotton:       de ? '100% Baumwolle' : '100% Cotton',
    cottonPoly:   de ? 'Baumwolle/Polyester' : 'Cotton/Polyester',
    canvas:       'Canvas',
    synthetik:    de ? 'Synthetik' : 'Synthetic',
    webart:       de ? 'Webart' : 'Weave Type',
    gramKids:     de ? 'Grammatur Kinder' : 'Weight (Kids)',
    gramAdult:    de ? 'Grammatur Erwachsene' : 'Weight (Adults)',
    wkf:          de ? 'WKF-Zulassung' : 'WKF Approval',
    wkfApproved:  de ? 'WKF-zugelassen' : 'WKF approved',
    kataList:     de ? 'Kata-Liste' : 'Kata List',
    notRequired:  de ? 'Nicht erforderlich' : 'Not required',
    // Qty
    catLabel:     de ? 'Kategorie:' : 'Category:',
    kids:         de ? 'Kinder / Kids' : 'Kids',
    adults:       de ? 'Erwachsene' : 'Adults',
    catSize:      de ? 'Kategorie \\ Größe' : 'Category \\ Size',
    total:        de ? 'Gesamt' : 'Total',
    pcsTotal:     de ? 'Stück gesamt' : 'pieces total',
    // Embroidery
    embPos:       de ? 'Stickerei-Positionen:' : 'Embroidery Positions:',
    posLL:        de ? 'Linkes Revers (vorne links)' : 'Left Lapel (front left)',
    posRL:        de ? 'Rechtes Revers (vorne rechts)' : 'Right Lapel (front right)',
    posRO:        de ? 'Rücken — oberer Bereich' : 'Back — upper area',
    posRM:        de ? 'Rücken — Mitte / großes Motiv' : 'Back — centre / large motif',
    posLA:        de ? 'Linker Ärmel (außen)' : 'Left Sleeve (outside)',
    posRA:        de ? 'Rechter Ärmel (außen)' : 'Right Sleeve (outside)',
    posHB:        de ? 'Hosenbein (links/rechts)' : 'Trouser Leg (left/right)',
    posKr:        de ? 'Kragen / Nackenbereich' : 'Collar / Neck area',
    logoDesc:     de ? 'Logo / Motiv-Beschreibung' : 'Logo / Motif Description',
    embFile:      de ? 'Stickerei-Datei' : 'Embroidery File',
    embText:      de ? 'Schriftzug / Text' : 'Text / Lettering',
    threadCol:    de ? 'Garnfarben' : 'Thread Colours',
    embSize:      de ? 'Größe Stickerei (B × H)' : 'Embroidery Size (W × H)',
    font:         de ? 'Schriftart' : 'Font',
    fontLatin:    de ? 'Lateinisch / Block' : 'Latin / Block',
    fontKanji:    de ? 'Kanji / Japanisch' : 'Kanji / Japanese',
    fontItalic:   de ? 'Kursiv' : 'Italic',
    fontCustom:   'Custom',
    personal:     de ? 'Individualisierung je Stück' : 'Personalisation per piece',
    persName:     de ? 'Mitgliedsname' : 'Member Name',
    persBelt:     de ? 'Gurtgrad' : 'Belt Grade',
    persNum:      de ? 'Nummerierung' : 'Numbering',
    persNone:     de ? 'Keine' : 'None',
    piping:       de ? 'Einfassung / Revers-Farbe' : 'Piping / Lapel Colour',
    white:        de ? 'Weiß' : 'White',
    black:        de ? 'Schwarz' : 'Black',
    gold:         'Gold',
    sameColour:   de ? 'Wie Grundfarbe' : 'Same as base colour',
    embFiles:     de ? 'Bereitgestellte Logo- & Branding-Dateien:' : 'Provided Logo & Branding Files:',
    // Care
    careSymbols:  de ? 'Pflegesymbole (ISO 3758):' : 'Care Symbols (ISO 3758):',
    care30:       de ? 'Schonwäsche 30°C' : 'Gentle wash 30°C',
    careNoBleach: de ? 'Nicht bleichen' : 'Do not bleach',
    careNoDryer:  de ? 'Nicht im Trockner' : 'Do not tumble dry',
    careDryFlat:  de ? 'Liegend trocknen' : 'Dry flat',
    careIron:     de ? 'Bügeln max. 110°C' : 'Iron max. 110°C',
    careNoDry:    de ? 'Keine chem. Reinigung' : 'No dry cleaning',
    careNote:     de ? '<strong>Waschanleitung:</strong> Karate-Gi bei max. 30°C waschen. Kein Weichspüler. Nicht im Trockner. Liegend lufttrocknen. Weiße Gis alternativ bei 60°C. Bei Bedarf auf links bügeln.'
                     : '<strong>Care Instructions:</strong> Wash Karate-Gi at max. 30°C. No fabric softener. Do not tumble dry. Air dry flat. White Gis may be washed at 60°C. Iron inside out if needed.',
    labelSpec:    de ? 'Label-Spezifikation:' : 'Label Specification:',
    labelMat:     de ? 'Material (Label-Text)' : 'Material (Label Text)',
    labelLang:    de ? 'Label-Sprachen' : 'Label Languages',
    langDE:       de ? 'Deutsch' : 'German',
    langEN:       de ? 'Englisch' : 'English',
    langFR:       de ? 'Französisch' : 'French',
    langJA:       de ? 'Japanisch' : 'Japanese',
    labelType:    de ? 'Label-Art' : 'Label Type',
    labelWoven:   de ? 'Gewebtes Etikett' : 'Woven Label',
    labelPrinted: de ? 'Gedrucktes Etikett' : 'Printed Label',
    labelEmb:     de ? 'Eingestickt' : 'Embroidered',
    labelPos:     de ? 'Label-Position' : 'Label Position',
    labelNeck:    de ? 'Nacken (innen)' : 'Neck (inside)',
    labelSeam:    de ? 'Seitennaht' : 'Side seam',
    labelWaist:   de ? 'Hosenbund (innen)' : 'Waistband (inside)',
    labelExtra:   de ? 'Zusatztext auf Label' : 'Additional text on label',
    labelExtraHint: de ? 'z. B. Made exclusively for Kampfkunstschule Schreiner · TDA' : 'e.g. Made exclusively for Martial Arts School Schreiner · TDA',
    // Signature
    qty:         de ? 'Gesamtmenge' : 'Total Quantity',
    orderVal:    de ? 'Auftragswert (netto)' : 'Order Value (net)',
    payTerms:    de ? 'Zahlungsziel / Incoterms' : 'Payment Terms / Incoterms',
    pcs:         de ? 'Stück' : 'pcs',
    sigDate:     de ? 'Datum & Ort' : 'Date & Place',
    sigBuyer:    de ? 'Unterschrift Besteller' : "Buyer's Signature",
    sigBuyerSub: de ? 'Kampfkunstschule Schreiner' : 'Martial Arts School Schreiner',
    sigSupplier: de ? 'Bestätigung Lieferant' : 'Supplier Confirmation',
    sigStamp:    de ? 'Stempel + Unterschrift' : 'Stamp + Signature',
    // New sections
    s_schnitt:    de ? 'Schnitt & Passform' : 'Cut & Fit',
    s_schnittTyp: de ? 'Schnitttyp' : 'Cut Type',
    s_revers:     de ? 'Revers-Typ' : 'Lapel Type',
    s_hosenbund:  de ? 'Hosenbund' : 'Waistband',
    s_schnittBem: de ? 'Schnitt-Bemerkung' : 'Cut Notes',
    s_pantone:    de ? 'Pantone-Codes' : 'Pantone Codes',
    s_pGrund:     de ? 'Grundfarbe Pantone' : 'Base Colour Pantone',
    s_pGarn1:     de ? 'Garn-Pantone 1' : 'Thread Pantone 1',
    s_pGarn2:     de ? 'Garn-Pantone 2' : 'Thread Pantone 2',
    s_pPaspel:    de ? 'Paspel/Revers-Pantone' : 'Piping/Lapel Pantone',
    s_naht:       de ? 'Naht & Verarbeitung' : 'Seam & Construction',
    s_stiche:     de ? 'Stiche/cm' : 'Stitches/cm',
    s_verst:      de ? 'Verstärkungspunkte' : 'Reinforcement Points',
    s_gurtAnz:    de ? 'Gürtelschlaufen Anzahl' : 'Belt Loops Count',
    s_gurtBr:     de ? 'Gürtelschlaufen Breite' : 'Belt Loop Width',
    s_nahtBem:    de ? 'Naht-Bemerkung' : 'Seam Notes',
    s_muster:     de ? 'Muster-Anforderungen' : 'Sampling Requirements',
    s_musterBen:  de ? 'PP-Sample / Muster benötigt' : 'PP-Sample required',
    s_musterGr:   de ? 'Mustergröße' : 'Sample Size',
    s_musterDL:   de ? 'Muster bis' : 'Sample deadline',
    s_musterEmb:  de ? 'Mit Stickerei' : 'With embroidery',
    s_musterBem:  de ? 'Muster-Bemerkung' : 'Sample Notes',
    s_zeitplan:   de ? 'Zeitplan' : 'Timeline',
    s_zSample:    de ? 'Sample-Freigabe bis' : 'Sample approval by',
    s_zProd:      de ? 'Produktionsstart' : 'Production start',
    s_zSchiff:    de ? 'Schiffsbereitschaft' : 'Ready to ship',
    s_verp:       de ? 'Verpackungsvorschriften' : 'Packaging Specifications',
    s_verpTyp:    de ? 'Verpackungstyp' : 'Packaging Type',
    s_verpBeutel: de ? 'Stück/Beutel' : 'Pcs/bag',
    s_verpKarton: de ? 'Stück/Karton' : 'Pcs/carton',
    s_verpEan:    de ? 'EAN/Barcode erforderlich' : 'EAN/Barcode required',
    s_verpLabel:  de ? 'Label-Text auf Karton' : 'Carton label text',
    s_verpBem:    de ? 'Verpackungs-Bemerkung' : 'Packaging notes',
    // Misc
    printBtn:    de ? '🖨 PDF drucken' : '🖨 Print PDF',
    refPoints:   de ? 'Masspunkte: 1=Rückenlänge Jacke · 2=Rückenbreite · 3=Spannweite gesamt · 4=Ärmellänge · 5=Schulterbreite · A=Hosenlänge · B=Bundbreite (½) · C=Saumbreite (½)'
                    : 'Reference points: 1=Jacket back length · 2=Back width · 3=Total wingspan · 4=Sleeve length · 5=Shoulder width · A=Trouser length · B=Waistband width (½) · C=Hem width (½)',
    page:        (n, t) => de ? `Seite ${n} / ${t}` : `Page ${n} / ${t}`,
    // Mass spec
    s10:         de ? 'Maßspezifikation (in cm)' : 'Measurement Specification (cm)',
    s10note:     de ? 'Alle Angaben in cm · bitte vor Produktion vom Lieferanten bestätigen lassen'
                    : 'All values in cm · please have supplier confirm before production',
    mpLabel:     de ? 'Masspunkt' : 'Ref. Point',
    mpSizes:     de ? 'Größen (cm-Größe in dieser Spalte)' : 'Sizes (cm size in this column)',
  };

  const sizes = SIZES[form.model];
  const img128 = `${origin}/gi-charts/modell-128.jpg`;
  const img188 = `${origin}/gi-charts/modell-188.jpg`;

  const spez    = form.spezifikation || {};
  const matIn   = (v) => (spez.material      || []).includes(v) ? 'checked' : '';
  const webIn   = (v) => (spez.webart        || []).includes(v) ? 'checked' : '';
  const gramKIn = (v) => (spez.grammaturKids  || spez.grammatur || []).includes(v) ? 'checked' : '';
  const gramAIn = (v) => (spez.grammaturAdult || spez.grammatur || []).includes(v) ? 'checked' : '';
  const langIn  = (v) => (spez.labelSprachen || ['Deutsch','Englisch']).includes(v) ? 'checked' : '';
  const artIn   = (v) => (spez.labelArt      || []).includes(v) ? 'checked' : '';
  const posLIn  = (v) => (spez.labelPosition || []).includes(v) ? 'checked' : '';

  const checked    = (val) => val ? 'checked' : '';
  const posChecked = (pos) => form.stickereiPos.includes(pos) ? 'checked' : '';

  const qtyRow = (row, label) => {
    const isKids = row === 'kids';
    if ((isKids && !form.katKids) || (!isKids && !form.katAdult)) return '';
    const vals  = isKids ? form.mengenKids : form.mengenAdult;
    const total = Object.values(vals).reduce((s, v) => s + (parseInt(v) || 0), 0);
    const cells = sizes.map(s => `<td><input type="number" value="${parseInt(vals[s]) || ''}" style="width:100%;border:none;text-align:center;font-size:10pt;padding:3px 0;background:transparent;"></td>`).join('');
    return `<tr><td class="rl">${label}</td>${cells}<td class="sm" style="font-weight:700;background:#f0f0f0;">${total}</td></tr>`;
  };

  const grandTotal = Object.values(form.mengenKids).reduce((s,v)=>s+(parseInt(v)||0),0)
                   + Object.values(form.mengenAdult).reduce((s,v)=>s+(parseInt(v)||0),0);
  const thCells        = sizes.map(s => `<th>${s}</th>`).join('');
  const selectedLtInfo = form.lieferantFreitext || '—';

  return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="UTF-8">
<title>${T.docTitle}</title>
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
  <div><h1>${T.h1}</h1><div class="sub">${T.sub}</div></div>
  <div class="ph-r">
    <div class="onr">${T.nr}&nbsp;<strong>${bestellungId ? String(bestellungId).padStart(4, '0') : '____'}</strong></div><br>
    <span>${T.datum} ${form.bestelldatum}</span>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">1</span> ${T.s1}</div>
  <div class="mc-row">
    <div class="mc sel"><div class="mc-n">Modell 188</div><div class="mc-d">8 Größen · 130–200 cm</div></div>
    <div style="flex:2;padding:3mm;">
      <div class="f"><span class="lbl">${T.modellbez}</span><input class="val" type="text" value="${form.modelName}"></div>
      <div class="f" style="margin-top:3mm;"><span class="lbl">${T.artikelNr}</span><input class="val" type="text" value="${form.artikelNr}"></div>
    </div>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">2</span> ${T.s2}</div>
  <div class="fg2">
    <div class="f"><span class="lbl">${T.besteller}</span><input class="val" type="text" value="${form.besteller}"></div>
    <div class="f"><span class="lbl">${T.lieferant}</span><input class="val" type="text" value="${selectedLtInfo}"></div>
    <div class="f"><span class="lbl">${T.apBesteller}</span><input class="val" type="text" value="${form.ansprechpartnerBesteller}"></div>
    <div class="f"><span class="lbl">${T.apLieferant}</span><input class="val" type="text" value="${form.ansprechpartnerLieferant}"></div>
    <div class="f"><span class="lbl">${T.bestelldat}</span><input class="val" type="text" value="${form.bestelldatum}"></div>
    <div class="f"><span class="lbl">${T.lieferdat}</span><input class="val" type="text" value="${form.lieferdatum}"></div>
    <div class="f"><span class="lbl">${T.projekt}</span><input class="val" type="text" value="${form.projekt}"></div>
    <div class="f"><span class="lbl">${T.farbe}</span><input class="val" type="text" value="${form.farbe}"></div>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">3</span> ${T.s3}</div>
  <div class="fg2">
    <div class="f"><span class="lbl">${T.material}</span>
      <div class="tags">
        <label class="tag"><input type="checkbox" ${matIn('100% Baumwolle')}> ${T.cotton}</label>
        <label class="tag"><input type="checkbox" ${matIn('Baumwolle/Polyester')}> ${T.cottonPoly}</label>
        <label class="tag"><input type="checkbox" ${matIn('Canvas')}> ${T.canvas}</label>
        <label class="tag"><input type="checkbox" ${matIn('Synthetik')}> ${T.synthetik}</label>
      </div>
      <input class="val" type="text" value="${spez.materialText || ''}" placeholder="Exakte Zusammensetzung" style="margin-top:2mm;">
    </div>
    <div class="f"><span class="lbl">${T.webart}</span>
      <div class="tags">
        <label class="tag"><input type="checkbox" ${webIn('Single Weave')}> Single Weave</label>
        <label class="tag"><input type="checkbox" ${webIn('Double Weave')}> Double Weave</label>
        <label class="tag"><input type="checkbox" ${webIn('Kata')}> Kata</label>
        <label class="tag"><input type="checkbox" ${webIn('Kumite / Leicht')}> Kumite / Leicht</label>
      </div>
    </div>
    <div class="f"><span class="lbl">${T.gramKids}</span>
      <div class="tags">
        <label class="tag"><input type="checkbox" ${gramKIn('8 oz (~270 g/m²)')}> 8 oz (~270 g/m²)</label>
        <label class="tag"><input type="checkbox" ${gramKIn('10 oz (~340 g/m²)')}> 10 oz (~340 g/m²)</label>
        <label class="tag"><input type="checkbox" ${gramKIn('12 oz (~400 g/m²)')}> 12 oz (~400 g/m²)</label>
        <label class="tag"><input type="checkbox" ${gramKIn('14 oz (~470 g/m²)')}> 14 oz (~470 g/m²)</label>
      </div>
    </div>
    <div class="f"><span class="lbl">${T.gramAdult}</span>
      <div class="tags">
        <label class="tag"><input type="checkbox" ${gramAIn('8 oz (~270 g/m²)')}> 8 oz (~270 g/m²)</label>
        <label class="tag"><input type="checkbox" ${gramAIn('10 oz (~340 g/m²)')}> 10 oz (~340 g/m²)</label>
        <label class="tag"><input type="checkbox" ${gramAIn('12 oz (~400 g/m²)')}> 12 oz (~400 g/m²)</label>
        <label class="tag"><input type="checkbox" ${gramAIn('14 oz (~470 g/m²)')}> 14 oz (~470 g/m²)</label>
      </div>
    </div>
    <div class="f"><span class="lbl">${T.wkf}</span>
      <div class="tags">
        <label class="tag"><input type="checkbox" ${checked(form.wkf)}> ${T.wkfApproved}</label>
        <label class="tag"><input type="checkbox"> ${T.kataList}</label>
        <label class="tag"><input type="checkbox" ${checked(!form.wkf)}> ${T.notRequired}</label>
      </div>
    </div>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">4</span> ${T.s_schnitt}</div>
  <div class="fg3">
    <div class="f"><span class="lbl">${T.s_schnittTyp}</span>
      <div class="tags">
        ${SCHNITT_TYPEN.map(opt => `<label class="tag"><input type="checkbox" ${checked(form.schnittTyp === opt)}> ${opt}</label>`).join('')}
      </div>
    </div>
    <div class="f"><span class="lbl">${T.s_revers}</span>
      <div class="tags">
        ${REVERS_TYPEN.map(opt => `<label class="tag"><input type="checkbox" ${checked(form.reversTyp === opt)}> ${opt}</label>`).join('')}
      </div>
    </div>
    <div class="f"><span class="lbl">${T.s_hosenbund}</span>
      <div class="tags">
        ${HOSENBUND_TYPEN.map(opt => `<label class="tag"><input type="checkbox" ${checked(form.hosenbundTyp === opt)}> ${opt}</label>`).join('')}
      </div>
    </div>
  </div>
  <div class="f" style="margin-top:3mm;"><span class="lbl">${T.s_schnittBem}</span><input class="val" type="text" value="${form.schnittBemerkung || ''}"></div>
</div>
</div>

<!-- SEITE 2 -->
<div class="page">
<div class="ch"><span>${T.pageHeader}</span><span>${T.page(2,6)}</span></div>

<div class="sec">
  <div class="st"><span class="n">5</span> ${T.s4}</div>
  <div style="display:flex;gap:4mm;align-items:center;margin-bottom:4mm;flex-wrap:wrap;">
    <span style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;">${T.catLabel}</span>
    <label style="display:flex;align-items:center;gap:2mm;padding:3mm 6mm;border:1.5px solid ${form.katKids?'var(--gold)':'#ddd'};border-radius:4px;font-size:9.5pt;font-weight:600;background:${form.katKids?'#fffbf0':'white'};">
      <input type="checkbox" ${checked(form.katKids)}> ${T.kids}
    </label>
    <label style="display:flex;align-items:center;gap:2mm;padding:3mm 6mm;border:1.5px solid ${form.katAdult?'var(--gold)':'#ddd'};border-radius:4px;font-size:9.5pt;font-weight:600;background:${form.katAdult?'#fffbf0':'white'};">
      <input type="checkbox" ${checked(form.katAdult)}> ${T.adults}
    </label>
  </div>
  <div class="qt-wrap">
    <table class="qt">
      <thead><tr><th class="rh">${T.catSize}</th>${thCells}<th style="background:#2d3d2d;min-width:36px;">Σ</th></tr></thead>
      <tbody>${qtyRow('kids', T.kids)}${qtyRow('adult', T.adults)}</tbody>
      <tfoot><tr><td class="rl">${T.total}</td>
        <td colspan="${sizes.length}" style="text-align:right;padding-right:8px;">${grandTotal} ${T.pcsTotal}</td>
        <td>${grandTotal}</td>
      </tr></tfoot>
    </table>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">6</span> ${T.s5}</div>
  <span class="lbl" style="display:block;margin-bottom:2mm;">${T.embPos}</span>
  <div class="chk-grid">
    <label class="chk-item"><input type="checkbox" ${posChecked('Linkes Revers')}> ${T.posLL}</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Rechtes Revers')}> ${T.posRL}</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Rücken oben')}> ${T.posRO}</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Rücken Mitte')}> ${T.posRM}</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Linker Ärmel')}> ${T.posLA}</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Rechter Ärmel')}> ${T.posRA}</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Hosenbein')}> ${T.posHB}</label>
    <label class="chk-item"><input type="checkbox" ${posChecked('Kragen')}> ${T.posKr}</label>
  </div>
  <div class="fg2">
    <div class="f"><span class="lbl">${T.logoDesc}</span><input class="val" type="text" placeholder="z. B. TDA Vereinslogo, Yin-Yang, Kanji Karate"></div>
    <div class="f"><span class="lbl">${T.embFile}</span><input class="val" type="text" value="${form.stickereiBemerkung}" placeholder="z. B. TDA_logo_stickerei_v2.dst"></div>
    <div class="f"><span class="lbl">${T.embText}</span><input class="val" type="text" value="${form.stickereiSchriftzug}"></div>
    <div class="f"><span class="lbl">${T.threadCol}</span><input class="val" type="text" value="${form.stickereiGarnfarben}"></div>
    <div class="f"><span class="lbl">${T.embSize}</span><input class="val" type="text" placeholder="z. B. 8 × 6 cm (Revers)"></div>
    <div class="f"><span class="lbl">${T.font}</span>
      <div class="tags">
        <label class="tag"><input type="checkbox"> ${T.fontLatin}</label>
        <label class="tag"><input type="checkbox"> ${T.fontKanji}</label>
        <label class="tag"><input type="checkbox"> ${T.fontItalic}</label>
        <label class="tag"><input type="checkbox"> ${T.fontCustom}</label>
      </div>
    </div>
    <div class="f"><span class="lbl">${T.personal}</span>
      <div class="tags">
        <label class="tag"><input type="checkbox"> ${T.persName}</label>
        <label class="tag"><input type="checkbox"> ${T.persBelt}</label>
        <label class="tag"><input type="checkbox"> ${T.persNum}</label>
        <label class="tag"><input type="checkbox"> ${T.persNone}</label>
      </div>
    </div>
    <div class="f"><span class="lbl">${T.piping}</span>
      <div class="tags">
        <label class="tag"><input type="checkbox"> ${T.white}</label>
        <label class="tag"><input type="checkbox"> ${T.black}</label>
        <label class="tag"><input type="checkbox"> ${T.gold}</label>
        <label class="tag"><input type="checkbox"> ${T.sameColour}</label>
      </div>
    </div>
  </div>
  ${eingebetteteDateien.length > 0 ? `
  <div style="margin-top:5mm;">
    <span class="lbl" style="display:block;margin-bottom:3mm;">${T.embFiles}</span>
    <div style="display:flex;flex-wrap:wrap;gap:5mm;align-items:flex-start;">
      ${eingebetteteDateien.filter(d => d.dataUrl).map(d => `
        <div style="text-align:center;max-width:55mm;">
          <img src="${d.dataUrl}" style="max-width:55mm;max-height:40mm;border:1px solid #eee;border-radius:4px;object-fit:contain;" alt="${d.original_name}">
          <div style="font-size:6.5pt;color:#999;margin-top:2mm;word-break:break-all;">${d.original_name}</div>
        </div>
      `).join('')}
    </div>
  </div>` : ''}
  <div style="margin-top:5mm;">
    <span class="lbl" style="display:block;margin-bottom:3mm;">${T.s_pantone}</span>
    <div class="fg2">
      <div class="f"><span class="lbl">${T.s_pGrund}</span><input class="val" type="text" value="${form.pantone_grundfarbe || ''}" placeholder="z. B. Pantone White / NTR"></div>
      <div class="f"><span class="lbl">${T.s_pGarn1}</span><input class="val" type="text" value="${form.pantone_garn1 || ''}" placeholder="z. B. Pantone 116 C – Gold"></div>
      <div class="f"><span class="lbl">${T.s_pGarn2}</span><input class="val" type="text" value="${form.pantone_garn2 || ''}" placeholder="z. B. Pantone Black C"></div>
      <div class="f"><span class="lbl">${T.s_pPaspel}</span><input class="val" type="text" value="${form.pantone_paspel || ''}" placeholder="z. B. Pantone 116 C"></div>
    </div>
  </div>
</div>
</div>

<!-- SEITE 3 (NEU: Naht, Muster, Zeitplan, Verpackung) -->
<div class="page">
<div class="ch"><span>${T.pageHeader}</span><span>${T.page(3,6)}</span></div>

<div class="sec">
  <div class="st"><span class="n">7</span> ${T.s_naht}</div>
  <div class="fg2">
    <div class="f"><span class="lbl">${T.s_stiche}</span><input class="val" type="number" value="${spez.stiche_cm || ''}"></div>
    <div class="f"><span class="lbl">${T.s_nahtBem}</span><input class="val" type="text" value="${spez.nahtBemerkung || ''}"></div>
    <div class="f"><span class="lbl">${T.s_gurtAnz}</span><input class="val" type="number" value="${spez.gurtschlaufen_anzahl || ''}"></div>
    <div class="f"><span class="lbl">${T.s_gurtBr}</span><input class="val" type="text" value="${spez.gurtschlaufen_breite || ''}"></div>
  </div>
  <div class="f" style="margin-top:3mm;"><span class="lbl">${T.s_verst}</span>
    <div class="tags">
      ${VERSTAERKUNGEN.map(opt => `<label class="tag"><input type="checkbox" ${checked((spez.verstaerkungen||[]).includes(opt))}> ${opt}</label>`).join('')}
    </div>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">8</span> ${T.s_muster}</div>
  <label class="chk-item" style="display:inline-flex;margin-bottom:4mm;"><input type="checkbox" ${checked(form.muster_benoetigt)}> ${T.s_musterBen}</label>
  ${form.muster_benoetigt ? `
  <div class="fg2">
    <div class="f"><span class="lbl">${T.s_musterGr}</span><input class="val" type="text" value="${form.muster_groesse || ''}"></div>
    <div class="f"><span class="lbl">${T.s_musterDL}</span><input class="val" type="text" value="${form.muster_deadline || ''}"></div>
    <div class="f"><span class="lbl">${T.s_musterBem}</span><input class="val" type="text" value="${form.muster_bemerkung || ''}"></div>
    <div class="f" style="justify-content:flex-end;"><label class="chk-item"><input type="checkbox" ${checked(form.muster_mitStickerei)}> ${T.s_musterEmb}</label></div>
  </div>` : ''}
</div>

<div class="sec">
  <div class="st"><span class="n">9</span> ${T.s_zeitplan}</div>
  <div class="fg3">
    <div class="f"><span class="lbl">${T.s_zSample}</span><input class="val" type="text" value="${form.zeitplan_sample || ''}"></div>
    <div class="f"><span class="lbl">${T.s_zProd}</span><input class="val" type="text" value="${form.zeitplan_prod || ''}"></div>
    <div class="f"><span class="lbl">${T.s_zSchiff}</span><input class="val" type="text" value="${form.zeitplan_schiff || ''}"></div>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">10</span> ${T.s_verp}</div>
  <div class="fg2">
    <div class="f"><span class="lbl">${T.s_verpTyp}</span>
      <div class="tags">
        ${VERP_TYPEN.map(opt => `<label class="tag"><input type="checkbox" ${checked(spez.verp_typ === opt)}> ${opt}</label>`).join('')}
      </div>
    </div>
    <div class="f"><span class="lbl">${T.s_verpBeutel}</span><input class="val" type="number" value="${spez.verp_stueck_beutel || ''}"></div>
    <div class="f"><span class="lbl">${T.s_verpKarton}</span><input class="val" type="number" value="${spez.verp_stueck_karton || ''}"></div>
    <div class="f"><label class="chk-item"><input type="checkbox" ${checked(spez.verp_ean)}> ${T.s_verpEan}</label></div>
  </div>
  <div class="f" style="margin-top:3mm;"><span class="lbl">${T.s_verpLabel}</span><input class="val" type="text" value="${spez.verp_label || ''}" placeholder="z. B. KARATE-GI · Gr. XXX · Art. Nr. XXXX · Kampfkunstschule Schreiner"></div>
  <div class="f" style="margin-top:3mm;"><span class="lbl">${T.s_verpBem}</span><input class="val" type="text" value="${spez.verp_bemerkung || ''}"></div>
</div>
</div>

<!-- SEITE 4 (alt: Seite 3): Pflegekennzeichnung, Bemerkungen, Freigabe -->
<div class="page">
<div class="ch"><span>${T.pageHeader}</span><span>${T.page(4,6)}</span></div>

<div class="sec">
  <div class="st"><span class="n">11</span> ${T.s6}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm 10mm;">
    <div>
      <span class="lbl" style="display:block;margin-bottom:3mm;">${T.careSymbols}</span>
      <div class="care-row">
        <div class="ci"><svg viewBox="0 0 44 40" fill="none"><path d="M4 14 L8 36 L36 36 L40 14 Z" stroke="#1a1a2e" stroke-width="2.5" fill="white"/><text x="22" y="30" text-anchor="middle" font-size="11" font-weight="800" fill="#1a1a2e" font-family="sans-serif">30°</text><line x1="13" y1="24" x2="31" y2="24" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="3,2"/></svg><span>${T.care30}</span></div>
        <div class="ci"><svg viewBox="0 0 44 40" fill="none"><polygon points="22,4 40,36 4,36" stroke="#1a1a2e" stroke-width="2.5" fill="white"/><line x1="12" y1="16" x2="32" y2="32" stroke="#1a1a2e" stroke-width="2.5"/><line x1="32" y1="16" x2="12" y2="32" stroke="#1a1a2e" stroke-width="2.5"/></svg><span>${T.careNoBleach}</span></div>
        <div class="ci"><svg viewBox="0 0 44 44" fill="none"><rect x="4" y="4" width="36" height="36" rx="3" stroke="#1a1a2e" stroke-width="2.5" fill="white"/><circle cx="22" cy="22" r="11" stroke="#1a1a2e" stroke-width="1.5" fill="white"/><line x1="9" y1="9" x2="35" y2="35" stroke="#1a1a2e" stroke-width="2.5"/></svg><span>${T.careNoDryer}</span></div>
        <div class="ci"><svg viewBox="0 0 44 44" fill="none"><rect x="4" y="4" width="36" height="36" rx="3" stroke="#1a1a2e" stroke-width="2.5" fill="white"/><line x1="10" y1="22" x2="34" y2="22" stroke="#1a1a2e" stroke-width="3"/></svg><span>${T.careDryFlat}</span></div>
        <div class="ci"><svg viewBox="0 0 52 40" fill="none"><path d="M6 30 Q6 18 20 17 L40 17 Q46 17 46 23 L46 30 Z" stroke="#1a1a2e" stroke-width="2.5" fill="white"/><rect x="16" y="30" width="26" height="5" rx="1" stroke="#1a1a2e" stroke-width="1.5" fill="#eee"/><line x1="26" y1="17" x2="26" y2="10" stroke="#1a1a2e" stroke-width="2.5"/><line x1="26" y1="10" x2="16" y2="10" stroke="#1a1a2e" stroke-width="2.5"/><line x1="16" y1="10" x2="16" y2="15" stroke="#1a1a2e" stroke-width="2.5"/><circle cx="26" cy="24" r="2.5" fill="#1a1a2e"/></svg><span>${T.careIron}</span></div>
        <div class="ci"><svg viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="17" stroke="#1a1a2e" stroke-width="2.5" fill="white"/><text x="22" y="28" text-anchor="middle" font-size="15" font-weight="800" fill="#1a1a2e" font-family="serif">P</text><line x1="8" y1="8" x2="36" y2="36" stroke="#1a1a2e" stroke-width="2.5"/></svg><span>${T.careNoDry}</span></div>
      </div>
      <div class="ibox">${T.careNote}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4mm;">
      <span class="lbl" style="display:block;">${T.labelSpec}</span>
      <div class="f"><span class="lbl">${T.labelMat}</span><input class="val" type="text" value="${spez.labelText || ''}" placeholder="z. B. 100% Baumwolle / 100% Cotton"></div>
      <div class="f"><span class="lbl">${T.labelLang}</span>
        <div class="tags">
          <label class="tag"><input type="checkbox" ${langIn('Deutsch')}> ${T.langDE}</label>
          <label class="tag"><input type="checkbox" ${langIn('Englisch')}> ${T.langEN}</label>
          <label class="tag"><input type="checkbox" ${langIn('Französisch')}> ${T.langFR}</label>
          <label class="tag"><input type="checkbox" ${langIn('Japanisch')}> ${T.langJA}</label>
        </div>
      </div>
      <div class="f"><span class="lbl">${T.labelType}</span>
        <div class="tags">
          <label class="tag"><input type="checkbox" ${artIn('Gewebtes Etikett')}> ${T.labelWoven}</label>
          <label class="tag"><input type="checkbox" ${artIn('Gedrucktes Etikett')}> ${T.labelPrinted}</label>
          <label class="tag"><input type="checkbox" ${artIn('Eingestickt')}> ${T.labelEmb}</label>
        </div>
      </div>
      <div class="f"><span class="lbl">${T.labelPos}</span>
        <div class="tags">
          <label class="tag"><input type="checkbox" ${posLIn('Nacken (innen)')}> ${T.labelNeck}</label>
          <label class="tag"><input type="checkbox" ${posLIn('Seitennaht')}> ${T.labelSeam}</label>
          <label class="tag"><input type="checkbox" ${posLIn('Hosenbund (innen)')}> ${T.labelWaist}</label>
        </div>
      </div>
      <div class="f"><span class="lbl">${T.labelExtra}</span><input class="val" type="text" value="${spez.labelZusatz || ''}" placeholder="${T.labelExtraHint}"></div>
    </div>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">12</span> ${T.s7}</div>
  <textarea style="border:1px solid #ccc;border-radius:3px;padding:4px 6px;width:100%;font-size:9pt;font-family:inherit;resize:vertical;min-height:16mm;" rows="3">${form.bemerkungen}</textarea>
</div>

<div class="sec">
  <div class="st"><span class="n">13</span> ${T.s8}</div>
  <div class="fg3" style="margin-bottom:5mm;">
    <div class="f"><span class="lbl">${T.qty}</span><input class="val" type="text" value="${grandTotal} ${T.pcs}" style="font-weight:800;font-size:13pt;"></div>
    <div class="f"><span class="lbl">${T.orderVal}</span><input class="val" type="text" placeholder="€ ___________"></div>
    <div class="f"><span class="lbl">${T.payTerms}</span><input class="val" type="text" placeholder="z. B. 30 Tage / DAP"></div>
  </div>
  <div class="sig-row">
    <div><div class="sig-area"></div><div class="sig-cap">${T.sigDate}</div></div>
    <div><div class="sig-area"></div><div class="sig-cap">${T.sigBuyer}<br><small>${T.sigBuyerSub}</small></div></div>
    <div><div class="sig-area"></div><div class="sig-cap">${T.sigSupplier}<br><small>${T.sigStamp}</small></div></div>
  </div>
</div>
</div>

<!-- SEITE 5 (alt: Seite 4): Größentabellen -->
<div class="page">
<div class="ph">
  <div><h1 style="font-size:15pt;">${T.s9}</h1><div class="sub">${T.s9sub}</div></div>
  <div style="font-size:8pt;color:#999;text-align:right;">${T.page(5,6)}<br>${T.tolerance}</div>
</div>
<div class="chart-block">
  <div class="chart-label" style="border-color:var(--gold);">
    Modell 188 &nbsp;·&nbsp; 8 Größen (130–200 cm)
  </div>
  <img src="${img188}" alt="Größentabelle Modell 188">
</div>
<div style="font-size:7.5pt;color:#999;text-align:center;margin:3mm 0;font-style:italic;">
  ${T.refPoints}
</div>
</div>

<!-- SEITE 6 (alt: Seite 5) – MAßSPEZIFIKATION -->
<div class="page">
<div class="ph">
  <div><h1 style="font-size:15pt;">${T.s10}</h1><div class="sub">${T.s10note}</div></div>
  <div style="font-size:8pt;color:#999;text-align:right;">${T.page(6,6)}</div>
</div>
<style>
table.ms{width:100%;border-collapse:collapse;font-size:8pt;}
table.ms thead th{background:var(--dark);color:white;padding:4px 5px;text-align:center;font-size:7.5pt;white-space:nowrap;}
table.ms thead th.mp-hd{text-align:left;min-width:110px;background:#2d2d4e;padding-left:6px;}
table.ms tbody tr:nth-child(odd){background:#fafafa;}
table.ms tbody td{border:1px solid #e5e5e5;padding:2px 3px;text-align:center;}
table.ms tbody td.mp-cell{text-align:left;padding:3px 6px;background:#f6f6f6;}
table.ms tbody td.mp-cell .mp-num{font-weight:900;color:var(--gold);margin-right:3px;}
table.ms tbody td.mp-cell .mp-name{font-weight:700;}
table.ms tbody td.mp-cell .mp-hint{display:block;font-size:6.5pt;color:#aaa;margin-top:1px;}
table.ms tbody td.mp-val{background:white;}
table.ms tbody td.mp-val input{width:100%;border:none;text-align:center;font-size:9pt;background:transparent;padding:2px 0;}
</style>
<div style="overflow-x:auto;">
<table class="ms">
  <thead>
    <tr>
      <th class="mp-hd">${T.mpLabel}</th>
      ${MASS_SIZES.map(s => `<th>${s}</th>`).join('')}
    </tr>
  </thead>
  <tbody>
    ${MASSPUNKTE.map(mp => {
      const cells = MASS_SIZES.map(s => {
        const val = (form.spezifikation?.massTabelle?.[s]?.[mp.key]) || '';
        return `<td class="mp-val"><input type="number" value="${val}" style="width:100%;border:none;text-align:center;font-size:9pt;background:transparent;padding:2px 0;"></td>`;
      }).join('');
      return `<tr>
        <td class="mp-cell">
          <span class="mp-num">${mp.num}</span><span class="mp-name">${mp.label}</span>
          <span class="mp-hint">${mp.hint}</span>
        </td>${cells}
      </tr>`;
    }).join('')}
  </tbody>
</table>
</div>
<div style="font-size:7pt;color:#aaa;margin-top:5mm;border-top:1px solid #eee;padding-top:3mm;">
  ${T.refPoints}
</div>
</div>

<button class="print-btn" onclick="window.print()">${T.printBtn}</button>
</body></html>`;
}
