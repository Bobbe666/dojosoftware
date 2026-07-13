import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import '../styles/GiBestellvorlage.css';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const SIZES = {
  '188': [130, 140, 150, 160, 170, 180, 190, 200],
};

const SIZES_KIDS  = [100, 110, 120, 130, 140, 150, 160];
const SIZES_ADULT = [160, 170, 175, 180, 185, 190, 195, 200, 205, 210];

// Maßtabelle: vollständige Größenrange unabhängig vom Modell
const MASS_SIZES = [100, 110, 120, 130, 140, 150, 160, 165, 170, 175, 180, 185, 190, 195, 200, 205, 210];
const LOGO_SIZES_KIDS  = MASS_SIZES.filter(s => s <= 160);
const LOGO_SIZES_ADULT = MASS_SIZES.filter(s => s >= 160);

const EMPTY_MENGEN = (model) =>
  (SIZES[model] || SIZES['188']).reduce((acc, s) => ({ ...acc, [s]: '' }), {});

const EMPTY_MENGEN_KIDS  = () => SIZES_KIDS.reduce((acc, s)  => ({ ...acc, [s]: '' }), {});
const EMPTY_MENGEN_ADULT = () => SIZES_ADULT.reduce((acc, s) => ({ ...acc, [s]: '' }), {});

const fixUtf8 = (s) => { try { return decodeURIComponent(escape(s)); } catch { return s; } };

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
  besteller: '',
  lieferantId: '', lieferantFreitext: '',
  ansprechpartnerBesteller: '',
  ansprechpartnerLieferant: '',
  bestelldatum: new Date().toLocaleDateString('de-DE'),
  lieferdatum: '', projekt: '', farbe: 'Weiß', wkf: false,
  katKids: true, katAdult: true,
  mengenKids: EMPTY_MENGEN_KIDS(), mengenAdult: EMPTY_MENGEN_ADULT(),
  stickereiPos: [], stickereiSchriftzug: '',
  stickereiGarnfarben: 'Gold, Schwarz', stickereiBemerkung: '',
  bemerkungen: '', spezifikation: { ...EMPTY_SPEZ },
  schnittTyp: '', reversTyp: '', hosenbundTyp: '', schnittBemerkung: '',
  muster_benoetigt: false, muster_groesse: '', muster_deadline: '',
  muster_mitStickerei: false, muster_bemerkung: '',
  zeitplan_sample: '', zeitplan_prod: '', zeitplan_schiff: '',
  pantone_garn1: '', pantone_garn2: '', pantone_paspel: '', pantone_grundfarbe: '',
  preisKids: '', preisAdult: '', waehrung: 'EUR',
  care_label_image: '',
  zeichnung_image: '',
  stickereiPosDateien: {},
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
  { key: 'rL', num: '1', label: 'Rückenlänge Jacke',   hint: 'Mitte Nacken bis Jackenende' },
  { key: 'rB', num: '2', label: 'Rückenbreite',         hint: 'zwischen den Schulterblättern' },
  { key: 'sw', num: '3', label: 'Spannweite gesamt',    hint: 'Ärmel li + Rücken + Ärmel re' },
  { key: 'aL', num: '4', label: 'Ärmellänge',           hint: 'Schulter außen bis Ärmelsaum' },
  { key: 'sB', num: '5', label: 'Schulterbreite',       hint: 'Schulter außen – außen' },
  { key: 'rv', num: '6', label: 'Revers-/Schosslänge',  hint: 'diagonale Länge des Revers' },
  { key: 'hL', num: 'A', label: 'Hosenlänge',           hint: 'Bund bis Hosenende' },
  { key: 'bB', num: 'B', label: 'Bundbreite ½',         hint: 'halbe Bundweite flachgelegt' },
  { key: 'sM', num: 'C', label: 'Saumbreite ½',         hint: 'halbe Saumweite flachgelegt' },
  { key: 'iL', num: 'D', label: 'Innenbeinlänge',       hint: 'Schritt bis Hosenende' },
];

// Stickereimaße — getrennt Kinder (100–160) und Erwachsene (160–210)
const MASSPUNKTE_LOGO = [
  { key: 'lBK', num: 'E', label: 'Logo Breite (Kinder)',      hint: 'max. Breite Stickerei auf Kids-Gi', forKids: true },
  { key: 'lHK', num: 'F', label: 'Logo Höhe (Kinder)',        hint: 'max. Höhe Stickerei auf Kids-Gi',  forKids: true },
  { key: 'tHK', num: 'G', label: 'Schrifthöhe (Kinder)',      hint: 'Höhe der Schriftzeichen auf Kids-Gi', forKids: true },
  { key: 'lBA', num: 'H', label: 'Logo Breite (Erwachsene)',  hint: 'max. Breite Stickerei auf Adult-Gi', forKids: false },
  { key: 'lHA', num: 'I', label: 'Logo Höhe (Erwachsene)',    hint: 'max. Höhe Stickerei auf Adult-Gi',  forKids: false },
  { key: 'tHA', num: 'J', label: 'Schrifthöhe (Erwachsene)',  hint: 'Höhe der Schriftzeichen auf Adult-Gi', forKids: false },
];

export default function GiBestellvorlage({ artikel = null, vorlage = null, onClose = null, initEditingId = null, initFormdata = null, overrideDojoId = null }) {
  const { activeDojo, dojos } = useDojoContext();
  const [lieferanten, setLieferanten] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftMsg, setDraftMsg] = useState('');
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
  const localUploadRef = useRef(null);
  const localUploadPosRef = useRef(null);
  const pendingLangRef = useRef('de');
  const [zeichnungSichtbar, setZeichnungSichtbar] = useState(true);
  const uploadTagRef = useRef(null);

  const buildInitialForm = () => {
    if (initFormdata) {
      return {
        ...EMPTY,
        ...initFormdata,
        spezifikation: { ...EMPTY_SPEZ, ...(initFormdata.spezifikation || {}) },
        mengenKids:  initFormdata.mengenKids  ? { ...EMPTY_MENGEN_KIDS(), ...initFormdata.mengenKids }  : EMPTY_MENGEN_KIDS(),
        mengenAdult: initFormdata.mengenAdult ? { ...EMPTY_MENGEN_ADULT(), ...initFormdata.mengenAdult } : EMPTY_MENGEN_ADULT(),
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
        mengenKids:  spez.mengenKids  ? { ...EMPTY_MENGEN_KIDS(), ...spez.mengenKids  } : EMPTY_MENGEN_KIDS(),
        mengenAdult: spez.mengenAdult ? { ...EMPTY_MENGEN_ADULT(), ...spez.mengenAdult } : EMPTY_MENGEN_ADULT(),
        preisKids:  spez.preisKids  || '',
        preisAdult: spez.preisAdult || '',
        waehrung:   spez.waehrung   || 'EUR',
        spezifikation: spez,
      };
    }
    if (artikel) {
      return { ...EMPTY, modelName: artikel.name || '', artikelNr: artikel.artikel_nummer || String(artikel.artikel_id || '') };
    }
    return { ...EMPTY };
  };

  const [form, setForm] = useState(buildInitialForm);
  const [fillKids, setFillKids]   = useState('');
  const [fillAdult, setFillAdult] = useState('');

  // Bestell-Specs vom Artikel laden (wenn Artikel-Prop ohne Vorlage übergeben)
  useEffect(() => {
    if (!artikel || vorlage || initFormdata) return;
    const aid = artikel.artikel_id;
    if (!aid) return;
    fetchWithAuth(`${config.apiBaseUrl}/artikel/${aid}/bestell-specs`)
      .then(r => r.json())
      .then(d => {
        if (!d.success || !d.data) return;
        const s = d.data;
        setForm(prev => ({
          ...prev,
          modelName:          s.modell_bezeichnung || prev.modelName,
          artikelNr:          s.artikel_nr_lieferant || prev.artikelNr,
          lieferantId:        s.lieferant_id ? String(s.lieferant_id) : prev.lieferantId,
          farbe:              s.farbe || prev.farbe,
          wkf:                s.wkf != null ? !!s.wkf : prev.wkf,
          stickereiPos:       s.stickerei_specs?.positionen || prev.stickereiPos,
          stickereiSchriftzug: s.stickerei_specs?.text || prev.stickereiSchriftzug,
          stickereiGarnfarben: s.stickerei_specs?.garnfarben || prev.stickereiGarnfarben,
          stickereiBemerkung: s.stickerei_specs?.bemerkung || prev.stickereiBemerkung,
          bemerkungen:        s.bemerkungen || prev.bemerkungen,
          spezifikation: {
            ...prev.spezifikation,
            material:    s.material_specs?.material   || prev.spezifikation?.material,
            webart:      s.material_specs?.webart     || prev.spezifikation?.webart,
            grammaturKids:  s.material_specs?.grammatur || prev.spezifikation?.grammaturKids,
            grammaturAdult: s.material_specs?.grammatur || prev.spezifikation?.grammaturAdult,
            materialText:   s.material_specs?.materialText || prev.spezifikation?.materialText,
            labelText:       s.label_specs?.labelText    || prev.spezifikation?.labelText,
            labelArt:        s.label_specs?.labelArt     || prev.spezifikation?.labelArt,
            labelPosition:   s.label_specs?.labelPosition || prev.spezifikation?.labelPosition,
            labelSprachen:   s.label_specs?.labelSprachen || prev.spezifikation?.labelSprachen,
            labelZusatz:     s.label_specs?.labelZusatz  || prev.spezifikation?.labelZusatz,
            verp_typ:        s.verpackung_specs?.typ      || prev.spezifikation?.verp_typ,
            verp_stueck_beutel: s.verpackung_specs?.stueck_beutel || prev.spezifikation?.verp_stueck_beutel,
            verp_stueck_karton: s.verpackung_specs?.stueck_karton || prev.spezifikation?.verp_stueck_karton,
          },
        }));
      })
      .catch(() => {});
  }, [artikel?.artikel_id]); // eslint-disable-line

  // WICHTIG: Fallback-Kette wie in TShirtBestellvorlage — beim Super-Admin ist
  // activeDojo der String 'super-admin' (→ .id undefined), dann wurden Vorlagen-
  // Dateien/Logos nie geladen und Uploads schlugen still mit 400 fehl.
  const dojoId = overrideDojoId || vorlage?.dojo_id || activeDojo?.id || null;

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
    if (lieferanten.length > 0 && form.lieferantId && !form.lieferantFreitext) {
      const lt = lieferanten.find(l => String(l.lieferant_id) === String(form.lieferantId));
      if (lt) setForm(p => ({
        ...p,
        lieferantFreitext: lt.firmenname,
        ansprechpartnerLieferant: p.ansprechpartnerLieferant || lt.ansprechpartner || '',
      }));
    }
  }, [lieferanten]); // eslint-disable-line

  useEffect(() => {
    if (vorlage?.vorlage_id && dojoId) {
      axios.get(`/bestellvorlagen/${vorlage.vorlage_id}/dateien?dojo_id=${dojoId}`)
        .then(res => setDateien(res.data?.data || []))
        .catch(err => console.error('Vorlagen-Dateien konnten nicht geladen werden:', err));
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
    } catch (err) {
      console.error('Datei-Upload fehlgeschlagen:', err);
      alert('Datei-Upload fehlgeschlagen: ' + (err.response?.data?.message || err.message));
    }
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

  const triggerLocalUpload = (pos) => {
    localUploadPosRef.current = pos;
    localUploadRef.current?.click();
  };

  const handleLocalUpload = (e) => {
    const file = e.target.files?.[0];
    const pos = localUploadPosRef.current;
    if (!file || !pos) return;
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
    if (isImage) {
      const reader = new FileReader();
      reader.onload = ev => setForm(p => ({
        ...p,
        stickereiPosDateien: { ...p.stickereiPosDateien, [pos]: { name: file.name, dataUrl: ev.target.result } },
      }));
      reader.readAsDataURL(file);
    } else {
      setForm(p => ({
        ...p,
        stickereiPosDateien: { ...p.stickereiPosDateien, [pos]: { name: file.name, dataUrl: null } },
      }));
    }
    localUploadPosRef.current = null;
    if (localUploadRef.current) localUploadRef.current.value = '';
  };

  const deleteLocalPosDatei = (pos) => {
    setForm(p => {
      const pd = { ...(p.stickereiPosDateien || {}) };
      delete pd[pos];
      return { ...p, stickereiPosDateien: pd };
    });
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
    const oldSizes = SIZES[form.model] || SIZES['188'];
    const newSizes = SIZES[model] || SIZES['188'];
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

  const berechneProportional = () => {
    const massTab = form.spezifikation?.massTabelle || {};
    // Referenzgröße = Größe mit den meisten ausgefüllten Werten
    let refSize = null, maxFilled = 0;
    for (const s of MASS_SIZES) {
      const filled = MASSPUNKTE.filter(mp => parseFloat(massTab[s]?.[mp.key]) > 0).length;
      if (filled > maxFilled) { maxFilled = filled; refSize = s; }
    }
    if (!refSize || maxFilled === 0) return;
    const refRow = massTab[refSize] || {};
    const newTab = { ...massTab };
    for (const s of MASS_SIZES) {
      if (s === refSize) continue;
      const ratio = s / refSize;
      const row = { ...(newTab[s] || {}) };
      for (const mp of MASSPUNKTE) {
        const ref = parseFloat(refRow[mp.key]);
        if (ref > 0) row[mp.key] = String(Math.round(ref * ratio * 10) / 10);
      }
      newTab[s] = row;
    }
    setForm(p => ({ ...p, spezifikation: { ...p.spezifikation, massTabelle: newTab } }));
  };

  // Stickereimaße proportional hochrechnen — separat für Kinder und Erwachsene
  const berechneProportionalLogo = (forKids) => {
    const sizes = forKids ? LOGO_SIZES_KIDS : LOGO_SIZES_ADULT;
    const keys  = MASSPUNKTE_LOGO.filter(mp => mp.forKids === forKids).map(mp => mp.key);
    const massTab = form.spezifikation?.massTabelle || {};
    let refSize = null, maxFilled = 0;
    for (const s of sizes) {
      const filled = keys.filter(k => parseFloat(massTab[s]?.[k]) > 0).length;
      if (filled > maxFilled) { maxFilled = filled; refSize = s; }
    }
    if (!refSize || maxFilled === 0) return;
    const refRow = massTab[refSize] || {};
    const newTab = { ...massTab };
    for (const s of sizes) {
      if (s === refSize) continue;
      const ratio = s / refSize;
      const row = { ...(newTab[s] || {}) };
      for (const k of keys) {
        const ref = parseFloat(refRow[k]);
        if (ref > 0) row[k] = String(Math.round(ref * ratio * 10) / 10);
      }
      newTab[s] = row;
    }
    setForm(p => ({ ...p, spezifikation: { ...p.spezifikation, massTabelle: newTab } }));
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
  const fillAllSizes  = (row, sizes, val) => {
    const n = parseInt(val);
    setForm(p => ({ ...p, [row]: Object.fromEntries(sizes.map(s => [s, n > 0 ? String(n) : ''])) }));
  };
  const clearAllSizes = (row, sizes) => setForm(p => ({ ...p, [row]: Object.fromEntries(sizes.map(s => [s, ''])) }));
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

  // Öffnet Fenster SYNCHRON (kein Popup-Blocker), füllt es dann async mit HTML
  const handlePdfClick = (lang = 'de') => {
    const djId = dojoAuswahl || vorlage?.dojo_id || dojoId;
    if (!djId && dojos && dojos.length > 1) {
      pendingLangRef.current = lang;
      setDojoAuswahlModal(true);
      return;
    }
    // Fenster JETZT synchron öffnen (User-Geste → kein Popup-Blocker)
    const win = window.open('', '_blank');
    if (!win) {
      alert('Popup wurde blockiert – bitte Popup-Blocker für diese Seite deaktivieren.');
      return;
    }
    win.document.write('<html><body style="font-family:sans-serif;padding:2rem;color:#333;"><p>PDF wird erstellt…</p></body></html>');
    generatePdf(lang, win);
  };

  const generatePdf = async (lang = 'de', printWin = null, forcedDojoId = null) => {
    const djId = forcedDojoId || dojoAuswahl || vorlage?.dojo_id || dojoId;
    setGenerating(true);
    try {
      const origin = window.location.origin;
      let neueBestellungId = editingBestellungId;
      if (djId) {
        const payload = {
          vorlage_id:     vorlage?.vorlage_id || null,
          lieferant_id:   form.lieferantId ? Number(form.lieferantId) : null,
          lieferant_name: form.lieferantFreitext || null,
          bestelldatum:   form.bestelldatum || null,
          lieferdatum:    form.lieferdatum  || null,
          formdata:       { ...form },
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

      if (printWin) {
        // HTML ins bereits geöffnete Fenster schreiben
        // Drucken übernimmt print-helper.js im neuen Fenster (CSP-sicher)
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
      }
    } catch (err) {
      console.error('PDF-Fehler:', err);
      if (printWin) printWin.close();
      alert('PDF-Erstellung fehlgeschlagen: ' + err.message);
    } finally {
      setGenerating(false);
    }
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
        stickereiPos: Array.isArray(fd.stickereiPos) ? fd.stickereiPos.map(fixUtf8) : [],
        mengenKids:  fd.mengenKids  ? { ...EMPTY_MENGEN_KIDS(),  ...fd.mengenKids  } : EMPTY_MENGEN_KIDS(),
        mengenAdult: fd.mengenAdult ? { ...EMPTY_MENGEN_ADULT(), ...fd.mengenAdult } : EMPTY_MENGEN_ADULT(),
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
        spezifikation: JSON.stringify({ ...form.spezifikation, mengenKids: form.mengenKids, mengenAdult: form.mengenAdult, preisKids: form.preisKids, preisAdult: form.preisAdult, waehrung: form.waehrung }),
        artikel_ids: vorlage.artikel_ids || [],
      });
      setSaveMsg('Gespeichert ✓');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch { setSaveMsg('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const saveDraft = async () => {
    const djId = vorlage?.dojo_id || dojoAuswahl || activeDojo?.id;
    if (!djId) { setDraftMsg('Kein Dojo ausgewählt'); setTimeout(() => setDraftMsg(''), 3000); return; }
    setDraftSaving(true); setDraftMsg('');
    try {
      const payload = {
        vorlage_id:     vorlage?.vorlage_id || null,
        lieferant_id:   form.lieferantId ? Number(form.lieferantId) : null,
        lieferant_name: form.lieferantFreitext || null,
        bestelldatum:   form.bestelldatum || null,
        lieferdatum:    form.lieferdatum  || null,
        formdata:       { ...form },
      };
      if (editingBestellungId) {
        await axios.put(`/gi-bestellungen/${editingBestellungId}?dojo_id=${djId}`, payload);
      } else {
        const bRes = await axios.post(`/gi-bestellungen?dojo_id=${djId}`, payload);
        setEditingBestellungId(bRes.data?.bestellung_id || null);
      }
      await loadBestellungen();
      setDraftMsg('Gespeichert ✓');
      setTimeout(() => setDraftMsg(''), 3000);
    } catch { setDraftMsg('Fehler beim Speichern'); setTimeout(() => setDraftMsg(''), 3000); }
    finally { setDraftSaving(false); }
  };

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

  const InfoBtn = ({ text }) => (
    <span className="gv-info-btn" data-tip={text}>ⓘ</span>
  );

  return (
    <div className="gv-page">

      {/* PDF OVERLAY */}
      {/* PDF-Overlay entfernt — Druck läuft über neues Fenster */}

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
          <span style={{ fontSize: '0.7rem', opacity: 0.45, fontFamily: 'monospace', flexShrink: 0 }}>v13.05-B</span>
          {draftMsg && (
            <span style={{ fontSize: '0.8rem', color: draftMsg.includes('Fehler') || draftMsg.includes('Kein') ? '#f87171' : '#86efac' }}>
              {draftMsg}
            </span>
          )}
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
          <button className="gv-btn-save" onClick={saveDraft} disabled={draftSaving}>
            {draftSaving ? 'Speichert…' : '💾 Zwischenspeichern'}
          </button>
          {vorlage?.vorlage_id && (
            <button className="gv-btn-save" onClick={saveVorlage} disabled={saving}>
              {saving ? 'Speichert…' : 'Einstellungen speichern'}
            </button>
          )}
          <button className="gv-btn-pdf" onClick={() => handlePdfClick('de')} disabled={generating}>
            {generating ? 'Erstelle PDF…' : editingBestellungId ? 'PDF aktualisieren & drucken' : 'PDF generieren & drucken'}
          </button>
          <button className="gv-btn-pdf" style={{ background: 'rgba(212,175,55,0.15)', fontSize: '0.82rem' }}
            onClick={() => handlePdfClick('en')} disabled={generating}>
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
              <div className="gv-model-name">Modell Shoryu</div>
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
            {/* Produktbild — statisch aus public, optional per Upload überschreibbar */}
            {(() => {
              const custom = dateien.find(d => d.tag === '__produktbild__');
              const imgSrc = custom ? custom.pfad : '/gi-charts/produkt-vorschau.jpg';
              const uploading = uploadingFile === '__produktbild__';
              return (
                <div className="gv-produkt-preview-wrap">
                  <div className="gv-produkt-img-box">
                    <img src={imgSrc} alt="Produktbild" className="gv-produkt-img" />
                    {custom && (
                      <button className="gv-produkt-del" onClick={() => deleteDatei(custom.datei_id)} title="Entfernen">×</button>
                    )}
                  </div>
                  {vorlage?.vorlage_id && (
                    <button className="gv-produkt-add-btn" onClick={() => !uploading && triggerUpload('__produktbild__')} disabled={!!uploadingFile} title={custom ? 'Bild ersetzen' : 'Eigenes Bild hochladen'}>
                      {uploading ? '…' : '↑'}
                    </button>
                  )}
                </div>
              );
            })()}
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
              <label className="gv-label">Material <InfoBtn text="Grundmaterial des Gi. 100% Baumwolle = traditionell, Canvas = robuster. Exakte Zusammensetzung im Textfeld angeben." /></label>
              <SpezChip options={MATERIALIEN} field="material" />
              <input className="gv-input" style={{ marginTop: '0.4rem' }}
                value={spez.materialText || ''} onChange={fSpez('materialText')} placeholder="Exakte Zusammensetzung" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Webart <InfoBtn text="Single Weave: leicht & luftig, ideal für Kumite. Double Weave: schwer & stabil. Kata: verstärkte Schultern. Kumite/Leicht: max. Beweglichkeit." /></label>
              <SpezChip options={WEBARTEN} field="webart" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Grammatur Kinder <InfoBtn text="Empfohlen 8–10 oz für Kinder: leichter, flexibler, geringerer Verschleiß." /></label>
              <SpezChip options={GRAMMATUREN} field="grammaturKids" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Grammatur Erwachsene <InfoBtn text="Empfohlen 10–14 oz für Erwachsene: robuster, langlebiger. 14 oz für Wettkampf/WKF." /></label>
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
            <div className="gv-currency-toggle">
              {['EUR', 'USD'].map(c => (
                <button key={c} className={`gv-currency-btn${form.waehrung === c ? ' active' : ''}`}
                  onClick={() => setForm(p => ({ ...p, waehrung: c }))}>
                  {c === 'EUR' ? '€ EUR' : '$ USD'}
                </button>
              ))}
            </div>
          </div>
          {/* Kinder-Tabelle */}
          {form.katKids && (
            <div className="gv-qty-group">
              <div className="gv-qty-group-header">
                <span className="gv-qty-group-label">Kinder / Kids</span>
                <div className="gv-fill-bar">
                  <span className="gv-fill-label">Alle auf:</span>
                  <input
                    type="number" min="0" className="gv-fill-input"
                    value={fillKids} onChange={e => setFillKids(e.target.value)}
                    placeholder="Stück"
                    onKeyDown={e => e.key === 'Enter' && fillAllSizes('mengenKids', SIZES_KIDS, fillKids)}
                  />
                  <button className="gv-fill-btn" onClick={() => fillAllSizes('mengenKids', SIZES_KIDS, fillKids)} disabled={!fillKids}>
                    Übernehmen
                  </button>
                  <button className="gv-fill-clear" onClick={() => { clearAllSizes('mengenKids', SIZES_KIDS); setFillKids(''); }}>
                    Leeren
                  </button>
                </div>
                <span className="gv-qty-group-sum">{totalFor('mengenKids')} Stück</span>
              </div>
              <div className="gv-qty-wrap">
                <table className="gv-qty-table">
                  <thead>
                    <tr>
                      <th className="gv-qt-rh">Größe</th>
                      {SIZES_KIDS.map(s => <th key={s}>{s}</th>)}
                      <th className="gv-qt-sum">Σ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="gv-qt-rl-empty"></td>
                      {SIZES_KIDS.map(s => (
                        <td key={s}><input type="number" min="0" value={form.mengenKids[s] || ''} onChange={e => setMenge('mengenKids', s, e.target.value)} /></td>
                      ))}
                      <td className="gv-qt-sum-cell">{totalFor('mengenKids')}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="gv-qt-price-lbl">Stückpreis</td>
                      <td colSpan={SIZES_KIDS.length} className="gv-qt-price-inp">
                        <div className="gv-qt-price-inner">
                          <input type="number" min="0" step="0.01" value={form.preisKids} onChange={f('preisKids')} placeholder="0.00" />
                          <span className="gv-qt-price-sym">{form.waehrung === 'USD' ? '$' : '€'}</span>
                          {form.preisKids > 0 && totalFor('mengenKids') > 0 && (
                            <span className="gv-qt-price-sum">= {(totalFor('mengenKids') * parseFloat(form.preisKids)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {form.waehrung === 'USD' ? '$' : '€'}</span>
                          )}
                        </div>
                      </td>
                      <td className="gv-qt-sum-cell"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          {/* Erwachsene-Tabelle */}
          {form.katAdult && (
            <div className="gv-qty-group">
              <div className="gv-qty-group-header">
                <span className="gv-qty-group-label">Erwachsene</span>
                <div className="gv-fill-bar">
                  <span className="gv-fill-label">Alle auf:</span>
                  <input
                    type="number" min="0" className="gv-fill-input"
                    value={fillAdult} onChange={e => setFillAdult(e.target.value)}
                    placeholder="Stück"
                    onKeyDown={e => e.key === 'Enter' && fillAllSizes('mengenAdult', SIZES_ADULT, fillAdult)}
                  />
                  <button className="gv-fill-btn" onClick={() => fillAllSizes('mengenAdult', SIZES_ADULT, fillAdult)} disabled={!fillAdult}>
                    Übernehmen
                  </button>
                  <button className="gv-fill-clear" onClick={() => { clearAllSizes('mengenAdult', SIZES_ADULT); setFillAdult(''); }}>
                    Leeren
                  </button>
                </div>
                <span className="gv-qty-group-sum">{totalFor('mengenAdult')} Stück</span>
              </div>
              <div className="gv-qty-wrap">
                <table className="gv-qty-table">
                  <thead>
                    <tr>
                      <th className="gv-qt-rh">Größe</th>
                      {SIZES_ADULT.map(s => <th key={s}>{s}</th>)}
                      <th className="gv-qt-sum">Σ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="gv-qt-rl-empty"></td>
                      {SIZES_ADULT.map(s => (
                        <td key={s}><input type="number" min="0" value={form.mengenAdult[s] || ''} onChange={e => setMenge('mengenAdult', s, e.target.value)} /></td>
                      ))}
                      <td className="gv-qt-sum-cell">{totalFor('mengenAdult')}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="gv-qt-price-lbl">Stückpreis</td>
                      <td colSpan={SIZES_ADULT.length} className="gv-qt-price-inp">
                        <div className="gv-qt-price-inner">
                          <input type="number" min="0" step="0.01" value={form.preisAdult} onChange={f('preisAdult')} placeholder="0.00" />
                          <span className="gv-qt-price-sym">{form.waehrung === 'USD' ? '$' : '€'}</span>
                          {form.preisAdult > 0 && totalFor('mengenAdult') > 0 && (
                            <span className="gv-qt-price-sum">= {(totalFor('mengenAdult') * parseFloat(form.preisAdult)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {form.waehrung === 'USD' ? '$' : '€'}</span>
                          )}
                        </div>
                      </td>
                      <td className="gv-qt-sum-cell"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          {/* Gesamtpreis */}
          {(form.preisKids > 0 || form.preisAdult > 0) && (
            <div className="gv-qty-total-bar">
              <span className="gv-qty-total-label">Gesamtpreis</span>
              <span className="gv-qty-total-val">
                {((totalFor('mengenKids') * parseFloat(form.preisKids || 0)) +
                  (totalFor('mengenAdult') * parseFloat(form.preisAdult || 0)))
                  .toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {form.waehrung === 'USD' ? '$' : '€'}
              </span>
              <span className="gv-qty-total-hint">{grandTotal()} Stück gesamt</span>
            </div>
          )}
        </div>

        {/* ── MAßSPEZIFIKATION ── */}
        <div className="gv-section">
          <div className="gv-section-title-row">
            <span className="gv-section-title">Maßspezifikation für den Hersteller</span>
            <button className="gv-zeichnung-toggle" onClick={() => setZeichnungSichtbar(v => !v)}>
              {zeichnungSichtbar ? 'Zeichnung ▲' : 'Zeichnung zeigen ▼'}
            </button>
            <label style={{ cursor: 'pointer', fontSize: '0.77rem', color: 'rgba(212,175,55,0.75)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '4px', padding: '3px 10px', flexShrink: 0 }}
              title="Eigene Maßzeichnung hochladen (PNG/JPG)">
              📐 Zeichnung hochladen
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => setForm(p => ({ ...p, zeichnung_image: ev.target.result }));
                reader.readAsDataURL(file);
              }} />
            </label>
            {form.zeichnung_image && (
              <button onClick={() => setForm(p => ({ ...p, zeichnung_image: '' }))}
                style={{ fontSize: '0.72rem', color: 'rgba(255,100,100,0.7)', background: 'none', border: '1px solid rgba(255,100,100,0.3)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}>
                ✕ Zeichnung entfernen
              </button>
            )}
            <button className="gv-btn-proportional" onClick={berechneProportional}
              title="Körpermaße proportional zur Referenzgröße berechnen">
              ↕ Maße hochrechnen
            </button>
            <button className="gv-btn-proportional" onClick={() => berechneProportionalLogo(true)}
              title="Stickereimaße Kinder proportional hochrechnen (Größen 100–160)">
              ↕ Logo Kinder
            </button>
            <button className="gv-btn-proportional" onClick={() => berechneProportionalLogo(false)}
              title="Stickereimaße Erwachsene proportional hochrechnen (Größen 160–210)">
              ↕ Logo Erwachsene
            </button>
            {vorlage?.vorlage_id && (
              <button className="gv-btn-save" onClick={saveVorlage} disabled={saving} style={{ flexShrink: 0 }}>
                {saving ? 'Speichert…' : '💾 Maße speichern'}
              </button>
            )}
            {saveMsg && (
              <span style={{ fontSize: '0.8rem', flexShrink: 0, color: saveMsg.includes('Fehler') ? '#f87171' : '#86efac' }}>
                {saveMsg}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--ds-text-faint)', marginBottom: '0.65rem' }}>
            Alle Angaben in cm · 1=Rückenlänge · 2=Rückenbreite · 3=Spannweite · 4=Ärmellänge · 5=Schulterbreite · 6=Revers · A=Hosenlänge · B=Bundbreite(½) · C=Saumbreite(½) · D=Innenbeinlänge
          </div>
          <div className="gv-mass-layout">
            {zeichnungSichtbar && (
              <img
                className="gv-zeichnung-img"
                src={form.zeichnung_image || '/gi-charts/skizze-gi.png'}
                alt="Maßzeichnung"
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
                            type="number" min="0" step="0.5" className="gv-mt-input"
                            value={spez.massTabelle?.[s]?.[mp.key] || ''}
                            onChange={e => setMassTabelle(s, mp.key, e.target.value)}
                            placeholder="—"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="gv-mt-separator">
                    <td colSpan={MASS_SIZES.length + 1}>Stickereimaße / Embroidery Dimensions (cm)</td>
                  </tr>
                  {MASSPUNKTE_LOGO.map(mp => (
                    <tr key={mp.key} className={mp.forKids ? 'gv-mt-logo-kids' : 'gv-mt-logo-adult'}>
                      <td className="gv-mt-label">
                        <span className="gv-mt-num">{mp.num}</span>
                        <span className="gv-mt-name">{mp.label}</span>
                        <span className="gv-mt-hint">{mp.hint}</span>
                      </td>
                      {MASS_SIZES.map(s => {
                        const inRange = mp.forKids ? s <= 160 : s >= 160;
                        return (
                          <td key={s} className={!inRange ? 'gv-mt-outofrange' : ''}>
                            {inRange ? (
                              <input
                                type="number" min="0" step="0.1" className="gv-mt-input"
                                value={spez.massTabelle?.[s]?.[mp.key] || ''}
                                onChange={e => setMassTabelle(s, mp.key, e.target.value)}
                                placeholder="—"
                              />
                            ) : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── STICKEREI ── */}
        <div className="gv-section">
          <div className="gv-section-title-row">
            <span className="gv-section-title">Stickerei & Branding</span>
            {form.stickereiPos.length > 0 && (
              <span className="gv-stickerei-badge">{form.stickereiPos.length} Position{form.stickereiPos.length !== 1 ? 'en' : ''} aktiv</span>
            )}
          </div>

          {/* Gemeinsamer file-input (Server-Upload via Vorlage) */}
          <input ref={fileInputRef} type="file" style={{ display: 'none' }}
            accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.ai,.eps,.dst,.pes,.exp,.jef,.vp3"
            onChange={uploadDatei} />
          {/* Lokaler file-input (Base64 im Form-State) */}
          <input ref={localUploadRef} type="file" style={{ display: 'none' }}
            accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.ai,.eps,.dst,.pes,.exp,.jef,.vp3"
            onChange={handleLocalUpload} />

          {/* Positionen — Jacke */}
          <div className="gv-pos-cat-label">Jacke</div>
          <div className="gv-pos-grid">
            {POSITIONEN.filter(p => !p.startsWith('Hosenbein')).map(pos => {
              const serverDatei = dateien.find(d => d.tag === pos);
              const localDatei  = (form.stickereiPosDateien || {})[pos];
              const isActive    = form.stickereiPos.includes(pos);
              const uploading   = uploadingFile === pos;
              return (
                <div key={pos} className={`gv-pos-item ${isActive ? 'active' : ''}`}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', flex: 1, minWidth: 0 }}>
                    <input type="checkbox" checked={isActive} onChange={() => togglePos(pos)} />
                    <span style={{ flex: 1 }}>{pos}</span>
                  </label>
                  {isActive && (serverDatei ? (
                    <span className="gv-pos-inline-file" title={serverDatei.original_name}>
                      📎 {serverDatei.original_name.length > 14 ? serverDatei.original_name.slice(0, 12) + '…' : serverDatei.original_name}
                      <button className="gv-pos-inline-del" onClick={() => deleteDatei(serverDatei.datei_id)} title="Löschen">✕</button>
                    </span>
                  ) : localDatei ? (
                    <span className="gv-pos-inline-file" title={localDatei.name}>
                      📎 {localDatei.name.length > 14 ? localDatei.name.slice(0, 12) + '…' : localDatei.name}
                      <button className="gv-pos-inline-del" onClick={() => deleteLocalPosDatei(pos)} title="Löschen">✕</button>
                    </span>
                  ) : (
                    <button className="gv-pos-inline-upload"
                      onClick={() => vorlage?.vorlage_id ? triggerUpload(pos) : triggerLocalUpload(pos)}
                      disabled={!!uploadingFile}>
                      {uploading ? '⏳' : '+ Datei'}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Positionen — Hose */}
          <div className="gv-pos-cat-label" style={{ marginTop: '0.55rem' }}>Hose</div>
          <div className="gv-pos-grid">
            {POSITIONEN.filter(p => p.startsWith('Hosenbein')).map(pos => {
              const serverDatei = dateien.find(d => d.tag === pos);
              const localDatei  = (form.stickereiPosDateien || {})[pos];
              const isActive    = form.stickereiPos.includes(pos);
              const uploading   = uploadingFile === pos;
              return (
                <div key={pos} className={`gv-pos-item ${isActive ? 'active' : ''}`}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', flex: 1, minWidth: 0 }}>
                    <input type="checkbox" checked={isActive} onChange={() => togglePos(pos)} />
                    <span style={{ flex: 1 }}>{pos}</span>
                  </label>
                  {isActive && (serverDatei ? (
                    <span className="gv-pos-inline-file" title={serverDatei.original_name}>
                      📎 {serverDatei.original_name.length > 14 ? serverDatei.original_name.slice(0, 12) + '…' : serverDatei.original_name}
                      <button className="gv-pos-inline-del" onClick={() => deleteDatei(serverDatei.datei_id)} title="Löschen">✕</button>
                    </span>
                  ) : localDatei ? (
                    <span className="gv-pos-inline-file" title={localDatei.name}>
                      📎 {localDatei.name.length > 14 ? localDatei.name.slice(0, 12) + '…' : localDatei.name}
                      <button className="gv-pos-inline-del" onClick={() => deleteLocalPosDatei(pos)} title="Löschen">✕</button>
                    </span>
                  ) : (
                    <button className="gv-pos-inline-upload"
                      onClick={() => vorlage?.vorlage_id ? triggerUpload(pos) : triggerLocalUpload(pos)}
                      disabled={!!uploadingFile}>
                      {uploading ? '⏳' : '+ Datei'}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Branding-Details */}
          <div className="gv-stick-divider">Branding-Details</div>
          <div className="gv-grid3">
            <div className="gv-field">
              <label className="gv-label">Schriftzug / Text</label>
              <input className="gv-input" value={form.stickereiSchriftzug} onChange={f('stickereiSchriftzug')} placeholder="z. B. Kampfkunstschule Schreiner · TDA" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Garnfarben</label>
              <input className="gv-input" value={form.stickereiGarnfarben} onChange={f('stickereiGarnfarben')} />
            </div>
            <div className="gv-field">
              <label className="gv-label">Referenz-Datei</label>
              <input className="gv-input" value={form.stickereiBemerkung} onChange={f('stickereiBemerkung')} placeholder="z. B. TDA_logo_v2.dst" />
            </div>
          </div>

          {/* Pantone-Codes */}
          <div className="gv-stick-divider">Pantone-Codes</div>
          <div className="gv-grid4">
            <div className="gv-field">
              <label className="gv-label">Grundfarbe</label>
              <input className="gv-input" value={form.pantone_grundfarbe} onChange={f('pantone_grundfarbe')} placeholder="z. B. White / NTR" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Garn-Pantone 1</label>
              <input className="gv-input" value={form.pantone_garn1} onChange={f('pantone_garn1')} placeholder="z. B. 116 C – Gold" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Garn-Pantone 2</label>
              <input className="gv-input" value={form.pantone_garn2} onChange={f('pantone_garn2')} placeholder="z. B. Black C" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Paspel / Revers</label>
              <input className="gv-input" value={form.pantone_paspel} onChange={f('pantone_paspel')} placeholder="z. B. 116 C" />
            </div>
          </div>

          {/* Wäscheetikett */}
          <div className="gv-stick-divider">Wäscheetikett (Innen Kragen)</div>
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

        {/* ── LOGOS & DATEIEN (allgemein, ohne Tag) ── */}
        <div className="gv-section">
          <div className="gv-section-title">Logos &amp; Allgemeine Dateien</div>
          {vorlage?.vorlage_id ? (
            <>
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
                <div style={{ fontSize: '0.75rem', color: 'var(--ds-text-faint)', marginTop: '0.25rem' }}>
                  Noch keine Dateien hinterlegt. Dateien werden im PDF eingebettet.
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--ds-text-faint)' }}>
              Dateien können nur über eine gespeicherte Vorlage hochgeladen werden.
            </div>
          )}
        </div>

        {/* ── NAHT & VERARBEITUNG ── */}
        <div className="gv-section">
          <div className="gv-section-title">Naht &amp; Verarbeitung</div>
          <div className="gv-grid4">
            <div className="gv-field">
              <label className="gv-label">Stiche/cm <InfoBtn text="Standard: 5 Stiche/cm. Mehr Stiche = dichter Nahtbild, höhere Reißfestigkeit." /></label>
              <input className="gv-input" type="number" min="0" value={spez.stiche_cm || ''} onChange={fSpez('stiche_cm')} placeholder="z. B. 5" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Gürtelschlaufen Anzahl <InfoBtn text="Standard: 7 Schlaufen. WKF/Kata-Stile: oft 5 Schlaufen. Hosenbund je nach Stil." /></label>
              <input className="gv-input" type="number" min="0" value={spez.gurtschlaufen_anzahl || ''} onChange={fSpez('gurtschlaufen_anzahl')} placeholder="z. B. 7" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Gürtelschlaufen Breite cm <InfoBtn text="Empfohlen 3,5–4 cm Breite. Muss zur Gürtelbreite passen." /></label>
              <input className="gv-input" value={spez.gurtschlaufen_breite || ''} onChange={fSpez('gurtschlaufen_breite')} placeholder="z. B. 4 cm" />
            </div>
            <div className="gv-field">
              <label className="gv-label">Naht-Bemerkung</label>
              <input className="gv-input" value={spez.nahtBemerkung || ''} onChange={fSpez('nahtBemerkung')} placeholder="z. B. Doppelnaht an Schulter" />
            </div>
          </div>
          <div className="gv-field" style={{ marginTop: '0.65rem' }}>
            <label className="gv-label">Verstärkungspunkte <InfoBtn text="Kritische Belastungsstellen. Kragen-Ansatz und Seitenabschluss sind Mindestanforderung." /></label>
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
          {vorlage?.vorlage_id && (() => {
            const verpDatei = dateien.find(d => d.tag === '__verpackung__');
            const uploading = uploadingFile === '__verpackung__';
            return (
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="gv-label" style={{ fontSize: '0.73rem' }}>Referenz-Datei (z. B. Verpackungszeichnung):</span>
                {verpDatei ? (
                  <span className="gv-pos-inline-file" title={verpDatei.original_name}>
                    📎 {verpDatei.original_name}
                    <button className="gv-pos-inline-del" onClick={() => deleteDatei(verpDatei.datei_id)}>✕</button>
                  </span>
                ) : (
                  <button className="gv-pos-upload-btn" onClick={() => triggerUpload('__verpackung__')} disabled={!!uploadingFile}>
                    {uploading ? 'Lädt…' : '+ Datei hochladen'}
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        {/* ── PFLEGEKENNZEICHNUNG & LABEL ── */}
        <div className="gv-section">
          <div className="gv-section-title">Pflegekennzeichnung & Label-Spezifikation</div>
          <div className="gv-grid2">
            <div className="gv-field" style={{ gridColumn: '1 / -1' }}>
              <label className="gv-label">Pflegesymbol-Grafik (Upload)</label>
              <input
                type="file"
                accept="image/*"
                className="gv-input"
                style={{ padding: '4px' }}
                onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => setForm(p => ({ ...p, care_label_image: ev.target.result }));
                  reader.readAsDataURL(file);
                }}
              />
              {form.care_label_image && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <img src={form.care_label_image} style={{ maxHeight: '60px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)' }} alt="Pflegesymbol-Vorschau" />
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, care_label_image: '' }))}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '4px', color: 'var(--ds-text-secondary)', padding: '3px 10px', cursor: 'pointer', fontSize: '0.78rem' }}
                  >Entfernen</button>
                </div>
              )}
            </div>
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
              <p style={{ fontSize: '0.83rem', color: 'var(--ds-text-muted)', marginBottom: '0.75rem' }}>
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
                onClick={() => { setDojoAuswahlModal(false); handlePdfClick('de'); }}>
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
  // Bilingual PDF: alle Labels immer auf Deutsch und Englisch
  const T = {
    docTitle:       'Karate-Gi Bestellvorlage – Kampfkunstschule Schreiner',
    h1:             'Karate-Gi',
    sub:            'Bestellvorlage · Kampfkunstschule Schreiner  ·  Order Form · Martial Arts School Schreiner',
    nr:             'Nr. / No.',
    datum:          'Datum / Date:',
    pageHeader:     'Karate-Gi Bestellvorlage / Order Form – Kampfkunstschule Schreiner',
    tolerance:      'Toleranz ±1,5 cm / Tolerance ±1.5 cm',
    selectedModel:  '← Gewähltes Modell / Selected Model',
    // Sections
    s1: 'Modellauswahl / Model Selection',
    s2: 'Bestelldaten / Order Details',
    s3: 'Produktspezifikation / Product Specification',
    s4: 'Kategorie &amp; Mengenbestellung / Category &amp; Quantity Order',
    s5: 'Stickerei &amp; Branding / Embroidery &amp; Branding',
    s6: 'Pflegekennzeichnung / Care Instructions',
    s7: 'Bemerkungen / Remarks',
    s8: 'Freigabe &amp; Unterschrift / Approval &amp; Signature',
    s9: 'Maßtabellen &amp; Größenübersicht / Size Charts &amp; Measurements',
    s9sub: 'Modell Shoryu – Referenz-Maßzeichnungen / Reference Size Drawings',
    // Fields
    modellbez:   'Modellbezeichnung / Model Name',
    artikelNr:   'Artikel-Nr. / Article No.',
    besteller:   'Besteller / Purchaser',
    lieferant:   'Hersteller / Lieferant  ·  Manufacturer / Supplier',
    apBesteller: 'Ansprechpartner Besteller / Contact Person (Buyer)',
    apLieferant: 'Ansprechpartner Lieferant / Contact Person (Supplier)',
    bestelldat:  'Bestelldatum / Order Date',
    lieferdat:   'Gewünschtes Lieferdatum / Requested Delivery Date',
    projekt:     'Projekt / Verwendungszweck  ·  Project / Purpose',
    farbe:       'Farbe / Ausführung  ·  Colour / Finish',
    // Spec
    material:     'Material',
    cotton:       '100% Baumwolle / 100% Cotton',
    cottonPoly:   'Baumwolle/Polyester / Cotton/Polyester',
    canvas:       'Canvas',
    synthetik:    'Synthetik / Synthetic',
    webart:       'Webart / Weave Type',
    gramKids:     'Grammatur Kinder / Weight (Kids)',
    gramAdult:    'Grammatur Erwachsene / Weight (Adults)',
    notRequired:  'Nicht erforderlich / Not required',
    // Qty
    catLabel:     'Kategorie / Category:',
    kids:         'Kinder / Kids',
    adults:       'Erwachsene / Adults',
    catSize:      'Kategorie \\ Größe / Category \\ Size',
    total:        'Gesamt / Total',
    pcsTotal:     'Stück gesamt / pieces total',
    // Embroidery
    embPos:       'Stickerei-Positionen / Embroidery Positions:',
    posLL:        'Linkes Revers / Left Lapel',
    posRL:        'Rechtes Revers / Right Lapel',
    posRO:        'Rücken oben / Back – upper',
    posRM:        'Rücken Mitte / Back – centre',
    posLA:        'Linker Ärmel / Left Sleeve',
    posRA:        'Rechter Ärmel / Right Sleeve',
    posHB:        'Hosenbein / Trouser Leg',
    posKr:        'Kragen / Collar',
    logoDesc:     'Logo / Motiv-Beschreibung  ·  Motif Description',
    embFile:      'Stickerei-Datei / Embroidery File',
    embText:      'Schriftzug / Text  ·  Lettering',
    threadCol:    'Garnfarben / Thread Colours',
    embSize:      'Größe Stickerei (B×H) / Embroidery Size (W×H)',
    font:         'Schriftart / Font',
    fontLatin:    'Lateinisch / Latin · Block',
    fontKanji:    'Kanji / Japanisch',
    fontItalic:   'Kursiv / Italic',
    fontCustom:   'Custom',
    personal:     'Individualisierung je Stück / Personalisation per piece',
    persName:     'Mitgliedsname / Member Name',
    persBelt:     'Gurtgrad / Belt Grade',
    persNum:      'Nummerierung / Numbering',
    persNone:     'Keine / None',
    piping:       'Einfassung / Revers-Farbe  ·  Piping / Lapel Colour',
    white:        'Weiß / White',
    black:        'Schwarz / Black',
    gold:         'Gold',
    sameColour:   'Wie Grundfarbe / Same as base colour',
    embFiles:     'Bereitgestellte Logo- &amp; Branding-Dateien / Provided Logo &amp; Branding Files:',
    // Care
    careSymbols:  'Pflegesymbole (ISO 3758) / Care Symbols (ISO 3758):',
    care30:       'Schonwäsche 30°C / Gentle wash 30°C',
    careNoBleach: 'Nicht bleichen / Do not bleach',
    careNoDryer:  'Nicht im Trockner / No tumble dry',
    careDryFlat:  'Liegend trocknen / Dry flat',
    careIron:     'Bügeln max. 110°C / Iron max. 110°C',
    careNoDry:    'Keine chem. Reinigung / No dry cleaning',
    careNote:     '<strong>Waschanleitung / Care Instructions:</strong> Max. 30°C, kein Weichspüler, nicht im Trockner, liegend lufttrocknen. Weiße Gis alternativ 60°C. / Max. 30°C, no fabric softener, do not tumble dry, air dry flat. White Gis may be washed at 60°C.',
    labelSpec:    'Label-Spezifikation / Label Specification:',
    labelMat:     'Material (Label-Text) / Material (Label Text)',
    labelLang:    'Label-Sprachen / Label Languages',
    langDE:       'Deutsch / German',
    langEN:       'Englisch / English',
    langFR:       'Französisch / French',
    langJA:       'Japanisch / Japanese',
    labelType:    'Label-Art / Label Type',
    labelWoven:   'Gewebtes Etikett / Woven Label',
    labelPrinted: 'Gedrucktes Etikett / Printed Label',
    labelEmb:     'Eingestickt / Embroidered',
    labelPos:     'Label-Position / Label Position',
    labelNeck:    'Nacken (innen) / Neck (inside)',
    labelSeam:    'Seitennaht / Side seam',
    labelWaist:   'Hosenbund (innen) / Waistband (inside)',
    labelExtra:   'Zusatztext auf Label / Additional text on label',
    labelExtraHint: 'z. B. Made exclusively for Kampfkunstschule Schreiner · TDA',
    // Signature
    qty:         'Gesamtmenge / Total Quantity',
    orderVal:    'Auftragswert (netto) / Order Value (net)',
    payTerms:    'Zahlungsziel / Incoterms  ·  Payment Terms / Incoterms',
    pcs:         'Stück / pcs',
    sigDate:     'Datum &amp; Ort / Date &amp; Place',
    sigBuyer:    'Unterschrift Besteller / Buyer\'s Signature',
    sigBuyerSub: 'Kampfkunstschule Schreiner',
    sigSupplier: 'Bestätigung Lieferant / Supplier Confirmation',
    sigStamp:    'Stempel + Unterschrift / Stamp + Signature',
    // Sections 4+
    s_schnitt:    'Schnitt &amp; Passform / Cut &amp; Fit',
    s_schnittTyp: 'Schnitttyp / Cut Type',
    s_revers:     'Revers-Typ / Lapel Type',
    s_hosenbund:  'Hosenbund / Waistband Type',
    s_schnittBem: 'Schnitt-Bemerkung / Cut Notes',
    s_pantone:    'Pantone-Codes / Pantone Codes',
    s_pGrund:     'Grundfarbe Pantone / Base Colour Pantone',
    s_pGarn1:     'Garn-Pantone 1 / Thread Pantone 1',
    s_pGarn2:     'Garn-Pantone 2 / Thread Pantone 2',
    s_pPaspel:    'Paspel/Revers-Pantone / Piping/Lapel Pantone',
    s_naht:       'Naht &amp; Verarbeitung / Seam &amp; Construction',
    s_stiche:     'Stiche/cm / Stitches/cm',
    s_verst:      'Verstärkungspunkte / Reinforcement Points',
    s_gurtAnz:    'Gürtelschlaufen Anzahl / Belt Loops Count',
    s_gurtBr:     'Gürtelschlaufen Breite / Belt Loop Width',
    s_nahtBem:    'Naht-Bemerkung / Seam Notes',
    s_muster:     'Muster-Anforderungen / Sampling Requirements',
    s_musterBen:  'PP-Sample / Muster benötigt / PP-Sample required',
    s_musterGr:   'Mustergröße / Sample Size',
    s_musterDL:   'Muster bis / Sample deadline',
    s_musterEmb:  'Mit Stickerei / With embroidery',
    s_musterBem:  'Muster-Bemerkung / Sample Notes',
    s_zeitplan:   'Zeitplan / Timeline',
    s_zSample:    'Sample-Freigabe bis / Sample approval by',
    s_zProd:      'Produktionsstart / Production start',
    s_zSchiff:    'Schiffsbereitschaft / Ready to ship',
    s_verp:       'Verpackungsvorschriften / Packaging Specifications',
    s_verpTyp:    'Verpackungstyp / Packaging Type',
    s_verpBeutel: 'Stück/Beutel / Pcs per bag',
    s_verpKarton: 'Stück/Karton / Pcs per carton',
    s_verpEan:    'EAN/Barcode erforderlich / EAN/Barcode required',
    s_verpLabel:  'Label-Text auf Karton / Carton label text',
    s_verpBem:    'Verpackungs-Bemerkung / Packaging notes',
    // Misc
    printBtn:    '🖨 PDF drucken / Print PDF',
    refPoints:   '1=Rückenlänge/Back length · 2=Rückenbreite/Back width · 3=Spannweite/Wingspan · 4=Ärmellänge/Sleeve length · 5=Schulterbreite/Shoulder width · 6=Revers/Lapel · A=Hosenlänge/Trouser length · B=Bundbreite½/Waistband½ · C=Saumbreite½/Hem½ · D=Innenbeinlänge/Inseam',
    page:        (n, t) => `Seite ${n} / ${t}  ·  Page ${n} / ${t}`,
    // Mass spec
    s10:         'Maßspezifikation / Measurement Specification (cm)',
    s10note:     'Alle Angaben in cm · bitte vor Produktion bestätigen / All values in cm · please confirm before production',
    mpLabel:     'Masspunkt / Ref. Point',
    mpSizes:     'Größen / Sizes',
  };

  // Bilingual option labels for arrays used directly in the PDF
  const OPT_BI = {
    'Breit (Standard)': 'Breit / Wide (Standard)', 'Schmal': 'Schmal / Narrow',
    'Competition-Flap': 'Competition-Flap',
    'Kordel': 'Kordel / Drawstring', 'Gummibund': 'Gummibund / Elastic',
    'Kordel + Gummi': 'Kordel + Gummi / Drawstring + Elastic',
    'Gefaltet': 'Gefaltet / Folded', 'Auf Hänger': 'Auf Hänger / On hanger',
    'Seitenabschluss': 'Seitenabschluss / Side finishing',
    'Gürtelschlaufen': 'Gürtelschlaufen / Belt loops',
    'Knotenbereich': 'Knotenbereich / Knot area',
    'Kragen-Ansatz': 'Kragen-Ansatz / Collar junction',
    'Ärmel-Saum': 'Ärmel-Saum / Sleeve hem',
    'Hosenbund': 'Hosenbund / Waistband',
  };
  const optBi = (opt) => OPT_BI[opt] || opt;

  const POS_LABEL = {
    'Linkes Revers':'Linkes Revers / Left Lapel','Rechtes Revers':'Rechtes Revers / Right Lapel',
    'Rücken oben':'Rücken oben / Back – upper','Rücken Mitte':'Rücken Mitte / Back – centre',
    'Linker Ärmel':'Linker Ärmel / Left Sleeve','Rechter Ärmel':'Rechter Ärmel / Right Sleeve',
    'Hosenbein links':'Hosenbein links / Left Leg','Hosenbein rechts':'Hosenbein rechts / Right Leg',
    'Kragen':'Kragen / Collar',
  };

  // Bilingual measurement point labels for the PDF table
  const MP_EN = {
    rL: 'Back length (jacket)', rB: 'Back width', sw: 'Wingspan total',
    aL: 'Sleeve length', sB: 'Shoulder width', rv: 'Lapel/skirt length',
    hL: 'Trouser length', bB: 'Waistband ½', sM: 'Hem width ½', iL: 'Inseam',
  };

  const img188 = form.zeichnung_image || `${origin}/gi-charts/skizze-gi.png`;

  // Helpers: leere Felder im PDF weglassen
  const fval = (lbl, val, opts = '') =>
    val ? `<div class="f" ${opts}><span class="lbl">${lbl}</span><input class="val" type="text" value="${String(val).replace(/"/g, '&quot;')}"></div>` : '';
  // Nur gewählte Tags anzeigen; Feld weglassen wenn nichts gewählt
  const ftags = (lbl, arr, toLbl = x => x) => {
    const sel = Array.isArray(arr) ? arr.filter(Boolean) : [];
    if (!sel.length) return '';
    return `<div class="f"><span class="lbl">${lbl}</span><div class="tags">${
      sel.map(opt => `<label class="tag" style="border-color:var(--gold);background:#fffbf0;font-weight:600;color:#1a1a2e;"><input type="checkbox" checked> ${toLbl(opt)}</label>`).join('')
    }</div></div>`;
  };
  // Einzelauswahl-Tag
  const ftag1 = (lbl, val, toLbl = x => x) =>
    val ? `<div class="f"><span class="lbl">${lbl}</span><div class="tags"><label class="tag" style="border-color:var(--gold);background:#fffbf0;font-weight:600;color:#1a1a2e;"><input type="checkbox" checked> ${toLbl(val)}</label></div></div>` : '';
  // Immer sichtbar; befüllt = goldene Unterlinie, leer = gestrichelt + gedimmt
  const fshow = (lbl, val, opts = '') =>
    `<div class="f" ${opts}><span class="lbl" style="${val ? '' : 'opacity:0.45;'}">${lbl}</span><input class="val" type="text" value="${val ? String(val).replace(/"/g, '&quot;') : ''}" placeholder="—" style="${val ? 'border-bottom-color:#c9a227;' : 'border-bottom:1px dashed #ccc;color:#aaa;'}"></div>`;
  // Alle Optionen immer zeigen; gewählte = gold, rest = gedimmt
  const allTags = (lbl, allOpts, selArr, toLbl = x => x) =>
    `<div class="f"><span class="lbl">${lbl}</span><div class="tags">${allOpts.map(o => {
      const s = (selArr||[]).includes(o);
      return `<label class="tag" style="${s ? 'border-color:var(--gold);background:#fffbf0;font-weight:600;color:#1a1a2e;' : 'opacity:0.3;'}"><input type="checkbox" ${s ? 'checked' : ''}> ${toLbl(o)}</label>`;
    }).join('')}</div></div>`;
  // Einzelauswahl-Version
  const allTag1 = (lbl, allOpts, val, toLbl = x => x) =>
    `<div class="f"><span class="lbl">${lbl}</span><div class="tags">${allOpts.map(o => {
      const s = val === o;
      return `<label class="tag" style="${s ? 'border-color:var(--gold);background:#fffbf0;font-weight:600;color:#1a1a2e;' : 'opacity:0.3;'}"><input type="checkbox" ${s ? 'checked' : ''}> ${toLbl(o)}</label>`;
    }).join('')}</div></div>`;

  const spez    = form.spezifikation || {};
  const stickereiPosFixed = (form.stickereiPos || []).map(fixUtf8);
  const posChecked = (pos) => stickereiPosFixed.includes(pos) ? 'checked' : '';

  const matIn   = (v) => (spez.material      || []).includes(v) ? 'checked' : '';
  const webIn   = (v) => (spez.webart        || []).includes(v) ? 'checked' : '';
  const gramKIn = (v) => (spez.grammaturKids  || spez.grammatur || []).includes(v) ? 'checked' : '';
  const gramAIn = (v) => (spez.grammaturAdult || spez.grammatur || []).includes(v) ? 'checked' : '';
  const langIn  = (v) => (spez.labelSprachen || ['Deutsch','Englisch']).includes(v) ? 'checked' : '';
  const artIn   = (v) => (spez.labelArt      || []).includes(v) ? 'checked' : '';
  const posLIn  = (v) => (spez.labelPosition || []).includes(v) ? 'checked' : '';

  const checked    = (val) => val ? 'checked' : '';

  const kidsTotal  = Object.values(form.mengenKids).reduce((s,v)=>s+(parseInt(v)||0),0);
  const adultTotal = Object.values(form.mengenAdult).reduce((s,v)=>s+(parseInt(v)||0),0);
  const grandTotal = kidsTotal + adultTotal;
  const currSym    = form.waehrung === 'USD' ? '$' : '€';
  const fmtPrice   = (n) => parseFloat(n||0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const kidsPriceRow = form.preisKids > 0 ? `
  <div style="display:flex;align-items:center;gap:6mm;margin-top:2mm;margin-bottom:4mm;font-size:9pt;">
    <span style="color:#999;font-weight:600;text-transform:uppercase;letter-spacing:.07em;font-size:7.5pt;">Stückpreis Kinder</span>
    <span style="font-weight:700;">${fmtPrice(form.preisKids)} ${currSym}</span>
    ${kidsTotal > 0 ? `<span style="color:#888;">= <strong>${fmtPrice(kidsTotal * parseFloat(form.preisKids))} ${currSym}</strong></span>` : ''}
  </div>` : '';

  const adultPriceRow = form.preisAdult > 0 ? `
  <div style="display:flex;align-items:center;gap:6mm;margin-top:2mm;margin-bottom:4mm;font-size:9pt;">
    <span style="color:#999;font-weight:600;text-transform:uppercase;letter-spacing:.07em;font-size:7.5pt;">Stückpreis Erwachsene</span>
    <span style="font-weight:700;">${fmtPrice(form.preisAdult)} ${currSym}</span>
    ${adultTotal > 0 ? `<span style="color:#888;">= <strong>${fmtPrice(adultTotal * parseFloat(form.preisAdult))} ${currSym}</strong></span>` : ''}
  </div>` : '';

  const gesamtpreisRow = (form.preisKids > 0 || form.preisAdult > 0) ? `
  <div style="display:flex;align-items:center;gap:8mm;padding:3mm 5mm;background:#fffbf0;border:1.5px solid #c9a227;border-radius:4px;margin-top:2mm;font-size:9.5pt;">
    <span style="font-weight:800;color:#1a1a2e;">Gesamtpreis</span>
    <span style="font-weight:800;font-size:11pt;color:#c9a227;">${fmtPrice((kidsTotal * parseFloat(form.preisKids||0)) + (adultTotal * parseFloat(form.preisAdult||0)))} ${currSym}</span>
    <span style="color:#888;font-size:8.5pt;">${grandTotal} Stück gesamt</span>
  </div>` : '';

  const kidsRow = !form.katKids ? '' : `
  <table class="qt" style="margin-bottom:2mm;">
    <thead><tr><th class="rh">${T.kids}</th>${SIZES_KIDS.map(s=>`<th>${s}</th>`).join('')}<th style="background:#2d3d2d;min-width:36px;">Σ</th></tr></thead>
    <tbody><tr><td class="rl">${T.kids}</td>${SIZES_KIDS.map(s=>`<td><input type="number" value="${parseInt(form.mengenKids[s])||''}" style="width:100%;border:none;text-align:center;font-size:10pt;padding:3px 0;background:transparent;"></td>`).join('')}<td class="sm" style="font-weight:700;background:#f0f0f0;">${kidsTotal}</td></tr></tbody>
  </table>${kidsPriceRow}`;

  const adultRow = !form.katAdult ? '' : `
  <table class="qt" style="margin-bottom:2mm;">
    <thead><tr><th class="rh">${T.adults}</th>${SIZES_ADULT.map(s=>`<th>${s}</th>`).join('')}<th style="background:#2d3d2d;min-width:36px;">Σ</th></tr></thead>
    <tbody><tr><td class="rl">${T.adults}</td>${SIZES_ADULT.map(s=>`<td><input type="number" value="${parseInt(form.mengenAdult[s])||''}" style="width:100%;border:none;text-align:center;font-size:10pt;padding:3px 0;background:transparent;"></td>`).join('')}<td class="sm" style="font-weight:700;background:#f0f0f0;">${adultTotal}</td></tr></tbody>
  </table>${adultPriceRow}`;

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
  @page{size:A4;margin:14mm 18mm;}
  body{background:white;}
  .page{margin:0;padding:0;width:auto;min-height:0;box-shadow:none;break-after:page;page-break-after:always;}
  .page:last-child{break-after:auto;page-break-after:auto;}
  .sec{break-inside:avoid;page-break-inside:avoid;}
  .qt-wrap{break-inside:avoid;page-break-inside:avoid;}
  .ms-wrap{break-before:page;page-break-before:always;}
  input,select,textarea{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .print-btn{display:none!important;}
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button{display:none;}
  table.ms{font-size:6pt;}
  table.ms thead th{padding:2px 1px;}
  table.ms tbody td{padding:1px;}
}
.print-btn{position:fixed;bottom:20px;right:20px;background:var(--gold);color:var(--dark);border:none;padding:12px 28px;font-size:12pt;font-weight:800;border-radius:6px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.35);z-index:999;}
</style></head><body>
<button class="print-btn" id="print-trigger">${T.printBtn}</button>

<!-- SEITE 1 -->
<div class="page">
<div class="ph">
  <div><h1>${T.h1}</h1><div class="sub">${T.sub}</div></div>
  <div class="ph-r">
    <div class="onr">${T.nr}&nbsp;<strong>${bestellungId ? String(bestellungId).padStart(4, '0') : '____'}</strong></div><br>
    <span>${T.datum} ${form.bestelldatum}</span>
  </div>
</div>

${(() => {
  const pb = eingebetteteDateien.find(d => d.tag === '__produktbild__' && d.dataUrl);
  const pbSrc = pb ? pb.dataUrl : `${origin}/gi-charts/produkt-vorschau.jpg`;
  return `
<div class="sec">
  <div class="st"><span class="n">1</span> ${T.s1}</div>
  <div style="display:flex;gap:6mm;align-items:flex-start;">
    <div style="flex:1;min-width:0;">
      <div class="mc-row" style="align-items:flex-start;margin-bottom:4mm;">
        <div class="mc sel"><div class="mc-n">Modell Shoryu</div><div class="mc-d">8 Größen / 8 Sizes · 130–200 cm</div></div>
      </div>
      <div class="f"><span class="lbl">${T.modellbez}</span><input class="val" type="text" value="${form.modelName}"></div>
      <div class="f" style="margin-top:3mm;"><span class="lbl">${T.artikelNr}</span><input class="val" type="text" value="${form.artikelNr}"></div>
    </div>
    <div style="flex-shrink:0;text-align:center;">
      <img src="${pbSrc}" style="max-height:140mm;max-width:95mm;border-radius:6px;border:1px solid #ddd;object-fit:contain;" alt="Produktbild">
    </div>
  </div>
</div>`;
})()}

<div class="sec">
  <div class="st"><span class="n">2</span> ${T.s2}</div>
  <div class="fg2">
    <div class="f"><span class="lbl">${T.besteller}</span><input class="val" type="text" value="${form.besteller}"></div>
    <div class="f"><span class="lbl">${T.lieferant}</span><input class="val" type="text" value="${selectedLtInfo}"></div>
    ${fshow(T.apBesteller, form.ansprechpartnerBesteller)}
    ${fshow(T.apLieferant, form.ansprechpartnerLieferant)}
    <div class="f"><span class="lbl">${T.bestelldat}</span><input class="val" type="text" value="${form.bestelldatum}" style="border-bottom-color:#c9a227;"></div>
    ${fshow(T.lieferdat, form.lieferdatum)}
    <div class="f"><span class="lbl">${T.farbe}</span><input class="val" type="text" value="${form.farbe}" style="border-bottom-color:#c9a227;"></div>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">3</span> ${T.s3}</div>
  <div class="fg2">
    ${allTags(T.material, ['100% Baumwolle','Baumwolle/Polyester','Canvas','Synthetik'], spez.material||[], m => ({'100% Baumwolle':T.cotton,'Baumwolle/Polyester':T.cottonPoly,'Canvas':T.canvas,'Synthetik':T.synthetik}[m]||m))}
    ${allTags(T.webart, ['Single Weave','Double Weave','Kata','Kumite / Leicht'], spez.webart||[])}
    ${allTags(T.gramKids, ['8 oz (~270 g/m²)','10 oz (~340 g/m²)','12 oz (~400 g/m²)','14 oz (~470 g/m²)'], spez.grammaturKids||spez.grammatur||[])}
    ${allTags(T.gramAdult, ['8 oz (~270 g/m²)','10 oz (~340 g/m²)','12 oz (~400 g/m²)','14 oz (~470 g/m²)'], spez.grammaturAdult||spez.grammatur||[])}
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">4</span> ${T.s_schnitt}</div>
  <div class="fg3">
    ${allTag1(T.s_schnittTyp, ['Regular','Slim','Traditional','Competition-Cut'], form.schnittTyp, optBi)}
    ${allTag1(T.s_revers, ['Breit (Standard)','Schmal','Competition-Flap'], form.reversTyp, optBi)}
    ${allTag1(T.s_hosenbund, ['Kordel','Gummibund','Kordel + Gummi'], form.hosenbundTyp, optBi)}
  </div>
  ${fshow(T.s_schnittBem, form.schnittBemerkung, 'style="margin-top:3mm;"')}
</div>
</div>

<!-- SEITE 2 -->
<div class="page">

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
  <div class="qt-wrap">${kidsRow}${adultRow}${gesamtpreisRow}
    <div style="text-align:right;font-size:9pt;color:#666;margin-top:3mm;">${grandTotal} ${T.pcsTotal}</div>
  </div>
</div>

<div class="sec">
  <div class="st"><span class="n">6</span> ${T.s5}</div>
  <span class="lbl" style="display:block;margin-bottom:2mm;">${T.embPos}</span>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-bottom:5mm;">
    ${['Linkes Revers','Rechtes Revers','Rücken oben','Rücken Mitte','Linker Ärmel','Rechter Ärmel','Hosenbein links','Hosenbein rechts','Kragen'].map(pos => {
      const isActive = stickereiPosFixed.includes(pos);
      const localFile = (form.stickereiPosDateien || {})[pos];
      const serverFile = eingebetteteDateien.find(d => d.tag === pos && d.dataUrl);
      const imgSrc = localFile?.dataUrl || serverFile?.dataUrl || null;
      const lbl = POS_LABEL[pos] || pos;
      return `<div style="border:${isActive ? '1.5px solid #c9a227;background:#fffbf0;' : '1px dashed #ddd;opacity:0.38;'}border-radius:4px;padding:2.5mm 3mm;display:flex;align-items:center;gap:3mm;min-height:10mm;break-inside:avoid;">
        <input type="checkbox" ${isActive ? 'checked' : ''} style="flex-shrink:0;">
        <span style="flex:1;font-weight:${isActive ? '700' : '400'};font-size:8.5pt;color:${isActive ? '#1a1a2e' : '#999'};">${lbl}</span>
        ${imgSrc ? `<img src="${imgSrc}" style="max-height:20mm;max-width:30mm;object-fit:contain;border:1px solid #e8d080;border-radius:2px;background:white;flex-shrink:0;">` : (isActive ? `<span style="font-size:7pt;color:#c9a227;opacity:0.6;">kein Logo</span>` : '')}
      </div>`;
    }).join('')}
  </div>
  <div class="fg2">
    ${fshow(T.embFile, form.stickereiBemerkung)}
    ${fshow(T.embText, form.stickereiSchriftzug)}
    ${fshow(T.threadCol, form.stickereiGarnfarben)}
  </div>
  <div style="margin-top:4mm;">
    <span class="lbl" style="display:block;margin-bottom:3mm;">${T.s_pantone}</span>
    <div class="fg2">
      ${fshow(T.s_pGrund, form.pantone_grundfarbe)}
      ${fshow(T.s_pGarn1, form.pantone_garn1)}
      ${fshow(T.s_pGarn2, form.pantone_garn2)}
      ${fshow(T.s_pPaspel, form.pantone_paspel)}
    </div>
  </div>
</div>
</div>

<!-- SEITE 3 (NEU: Naht, Muster, Zeitplan, Verpackung) -->
<div class="page">

<div class="sec">
  <div class="st"><span class="n">7</span> ${T.s_naht}</div>
  <div class="fg2">
    ${fshow(T.s_stiche, spez.stiche_cm)}
    ${fshow(T.s_nahtBem, spez.nahtBemerkung)}
    ${fshow(T.s_gurtAnz, spez.gurtschlaufen_anzahl)}
    ${fshow(T.s_gurtBr, spez.gurtschlaufen_breite)}
  </div>
  ${allTags(T.s_verst, ['Seitenabschluss','Gürtelschlaufen','Knotenbereich','Kragen-Ansatz','Ärmel-Saum','Hosenbund'], spez.verstaerkungen||[], optBi)}
</div>

<div class="sec">
  <div class="st"><span class="n">8</span> ${T.s_muster}</div>
  <label class="chk-item" style="display:inline-flex;margin-bottom:4mm;${form.muster_benoetigt ? 'border-color:var(--gold);background:#fffbf0;' : 'opacity:0.5;'}"><input type="checkbox" ${checked(form.muster_benoetigt)}> ${T.s_musterBen}</label>
  ${form.muster_benoetigt ? `<div class="fg2">
    ${fshow(T.s_musterGr, form.muster_groesse)}
    ${fshow(T.s_musterDL, form.muster_deadline)}
    ${fshow(T.s_musterBem, form.muster_bemerkung)}
    ${form.muster_mitStickerei ? `<div class="f" style="justify-content:flex-end;"><label class="chk-item" style="border-color:var(--gold);background:#fffbf0;"><input type="checkbox" checked> ${T.s_musterEmb}</label></div>` : ''}
  </div>` : ''}
</div>

<div class="sec">
  <div class="st"><span class="n">10</span> ${T.s_verp}</div>
  <div class="fg2">
    ${allTag1(T.s_verpTyp, ['Gefaltet','Auf Hänger'], spez.verp_typ, optBi)}
    ${fshow(T.s_verpBeutel, spez.verp_stueck_beutel)}
    ${fshow(T.s_verpKarton, spez.verp_stueck_karton)}
    <label class="chk-item" style="${spez.verp_ean ? 'border-color:var(--gold);background:#fffbf0;' : 'opacity:0.5;'}"><input type="checkbox" ${checked(spez.verp_ean)}> ${T.s_verpEan}</label>
  </div>
  ${fshow(T.s_verpLabel, spez.verp_label, 'style="margin-top:3mm;"')}
  ${fshow(T.s_verpBem, spez.verp_bemerkung, 'style="margin-top:3mm;"')}
</div>
</div>

<!-- SEITE 4 (alt: Seite 3): Pflegekennzeichnung, Bemerkungen, Freigabe -->
<div class="page">

<div class="sec">
  <div class="st"><span class="n">11</span> ${T.s6}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm 10mm;">
    <div>
      <span class="lbl" style="display:block;margin-bottom:3mm;">Pflegesymbole / Care Symbols:</span>
      ${form.care_label_image
        ? `<img src="${form.care_label_image}" style="max-height:44mm;max-width:100%;object-fit:contain;display:block;margin:3mm 0 4mm;">`
        : `<div style="border:1.5px dashed #ccc;border-radius:4px;padding:6mm 4mm;text-align:center;color:#bbb;font-size:8pt;margin:3mm 0 4mm;min-height:20mm;display:flex;align-items:center;justify-content:center;">Pflegesymbol-Grafik / Care Symbol Image<br><span style="font-size:7pt;margin-top:2px;display:block;">(Upload im Formular)</span></div>`
      }
      <div class="ibox">${T.careNote}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4mm;">
      <span class="lbl" style="display:block;">${T.labelSpec}</span>
      ${fshow(T.labelMat, spez.labelText)}
      ${allTags(T.labelLang, ['Deutsch','Englisch','Französisch','Japanisch'], spez.labelSprachen||['Deutsch','Englisch'], v => ({'Deutsch':T.langDE,'Englisch':T.langEN,'Französisch':T.langFR,'Japanisch':T.langJA}[v]||v))}
      ${allTags(T.labelType, ['Gewebtes Etikett','Gedrucktes Etikett','Eingestickt'], spez.labelArt||[], v => ({'Gewebtes Etikett':T.labelWoven,'Gedrucktes Etikett':T.labelPrinted,'Eingestickt':T.labelEmb}[v]||v))}
      ${allTags(T.labelPos, ['Nacken (innen)','Seitennaht','Hosenbund (innen)'], spez.labelPosition||[], v => ({'Nacken (innen)':T.labelNeck,'Seitennaht':T.labelSeam,'Hosenbund (innen)':T.labelWaist}[v]||v))}
      ${fshow(T.labelExtra, spez.labelZusatz)}
    </div>
  </div>
</div>

${form.bemerkungen ? `
<div class="sec">
  <div class="st"><span class="n">12</span> ${T.s7}</div>
  <textarea style="border:1px solid #ccc;border-radius:3px;padding:4px 6px;width:100%;font-size:9pt;font-family:inherit;resize:vertical;min-height:16mm;" rows="3">${form.bemerkungen}</textarea>
</div>` : ''}

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

<!-- SEITE 5: Größentabellen + Maßspezifikation (kombiniert) -->
<div class="page ms-wrap">
<div class="ph">
  <div><h1 style="font-size:15pt;">${T.s9}</h1><div class="sub">${T.s9sub}</div></div>
  <div style="font-size:8pt;color:#999;text-align:right;">${T.page(5,5)}<br>${T.tolerance}</div>
</div>
<div class="chart-block" style="margin-bottom:4mm;">
  <div class="chart-label" style="border-color:var(--gold);">
    Modell Shoryu &nbsp;·&nbsp; 8 Größen / 8 Sizes (130–200 cm)
  </div>
  <img src="${img188}" alt="Größentabelle Modell Shoryu" style="max-height:95mm;">
</div>
<div class="st" style="margin-bottom:3mm;"><span class="n">✦</span> ${T.s10}</div>
<div style="font-size:7pt;color:#777;margin-bottom:3mm;">${T.s10note}</div>
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
          <span class="mp-hint">${MP_EN[mp.key] || ''}</span>
        </td>${cells}
      </tr>`;
    }).join('')}
    <tr><td colspan="${MASS_SIZES.length + 1}" style="background:#1a1a2e;color:#c9a227;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.12em;padding:4px 6px;border-top:2px solid #c9a227;">Stickereimaße / Embroidery Dimensions (cm)</td></tr>
    ${MASSPUNKTE_LOGO.map(mp => {
      const cells = MASS_SIZES.map(s => {
        const inRange = mp.forKids ? s <= 160 : s >= 160;
        if (!inRange) return `<td style="background:#f9f9f9;"></td>`;
        const val = (form.spezifikation?.massTabelle?.[s]?.[mp.key]) || '';
        const bg = mp.forKids ? '#eef6ff' : '#fffbf0';
        return `<td class="mp-val" style="background:${bg};"><input type="number" value="${val}" style="width:100%;border:none;text-align:center;font-size:9pt;background:transparent;padding:2px 0;"></td>`;
      }).join('');
      const logoEN = { lBK:'Logo width (kids)', lHK:'Logo height (kids)', tHK:'Text height (kids)',
                       lBA:'Logo width (adults)', lHA:'Logo height (adults)', tHA:'Text height (adults)' };
      return `<tr>
        <td class="mp-cell" style="background:${mp.forKids ? '#eef6ff' : '#fffbf0'};">
          <span class="mp-num">${mp.num}</span><span class="mp-name">${mp.label}</span>
          <span class="mp-hint">${logoEN[mp.key] || ''}</span>
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

${(() => {
  const brandingDateien = eingebetteteDateien.filter(d => d.tag !== '__produktbild__' && d.dataUrl);
  if (brandingDateien.length === 0) return '';
  return `
<!-- ANHANG: Logo & Branding -->
<div class="page">
<div class="ph">
  <div><h1 style="font-size:15pt;">Logo &amp; Branding</h1><div class="sub">Bereitgestellte Dateien / Provided Files — Anhang / Appendix</div></div>
  <div style="font-size:8pt;color:#999;text-align:right;">Anhang / Appendix</div>
</div>
<div style="display:grid;grid-template-columns:${brandingDateien.length === 1 ? '1fr' : '1fr 1fr'};gap:10mm;">
  ${brandingDateien.map(d => `
    <div style="text-align:center;border:1px solid #eee;border-radius:6px;padding:5mm;">
      <img src="${d.dataUrl}" style="max-width:100%;max-height:110mm;object-fit:contain;" alt="${d.original_name}">
      <div style="font-size:7pt;color:#888;margin-top:3mm;word-break:break-all;">${d.original_name}</div>
    </div>
  `).join('')}
</div>
</div>`;
})()}

<script src="${origin}/print-helper.js"></script>
</body></html>`;
}
