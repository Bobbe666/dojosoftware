import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import { useAuth } from '../context/AuthContext';
import '../styles/BestellvorlagenTab.css';

// ── Karate-Gi Größen ────────────────────────────────────────────────────────
const SIZES = {
  '128': [140, 150, 160, 165, 170, 175, 180, 185, 190, 195, 200],
  '188': [130, 140, 150, 160, 170, 180, 190, 200],
};
const EMPTY_MENGEN = (model) =>
  SIZES[model].reduce((acc, s) => ({ ...acc, [s]: '' }), {});

// ── Neue Produkttyp-Größen ──────────────────────────────────────────────────
const SIZES_BOXHANDSCHUHE  = ['6 oz', '8 oz', '10 oz', '12 oz', '14 oz', '16 oz'];
const SIZES_BANDAGEN       = ['2,5 m', '3 m', '4 m', '4,5 m', 'Einheitsgröße'];
const SIZES_STD            = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function getSizesForTyp(typ) {
  switch (typ) {
    case 'boxhandschuhe':    return SIZES_BOXHANDSCHUHE;
    case 'bandagen':         return SIZES_BANDAGEN;
    case 'fussschoner':
    case 'schienbeinschoner': return SIZES_STD;
    default:                 return null; // Gi und patches: eigene Logik
  }
}

function getPositionenForTyp(typ) {
  switch (typ) {
    case 'karate_gi':
      return ['Linkes Revers', 'Rechtes Revers', 'Rücken oben', 'Rücken Mitte',
              'Linker Ärmel', 'Rechter Ärmel', 'Hosenbein', 'Kragen'];
    case 'boxhandschuhe':
      return ['Handrücken', 'Seitenfläche', 'Handgelenk', 'Klettverschluss'];
    case 'bandagen':
      return ['Außenseite', 'Klettverschluss'];
    case 'fussschoner':
      return ['Ristbereich (Außen)', 'Seitenfläche', 'Klettverschluss'];
    case 'schienbeinschoner':
      return ['Schienbein (Vorderseite)', 'Seitenfläche', 'Klettverschluss'];
    case 'patches':
      return ['Mitte', 'Rand / Bordüre'];
    default:
      return [];
  }
}

// ── Optionen-Listen ─────────────────────────────────────────────────────────
const MATERIALIEN    = ['100% Baumwolle', 'Baumwolle/Polyester', 'Canvas', 'Synthetik'];
const WEBARTEN       = ['Single Weave', 'Double Weave', 'Kata', 'Kumite / Leicht'];
const GRAMMATUREN    = ['8 oz (~270 g/m²)', '10 oz (~340 g/m²)', '12 oz (~400 g/m²)', '14 oz (~470 g/m²)'];
const LABEL_LANG     = ['Deutsch', 'Englisch', 'Französisch', 'Japanisch'];
const LABEL_ART      = ['Gewebtes Etikett', 'Gedrucktes Etikett', 'Eingestickt'];
const LABEL_POS      = ['Nacken (innen)', 'Seitennaht', 'Hosenbund (innen)'];

const BOX_MATERIAL   = ['Echtleder', 'PU-Leder', 'Vinyl / Kunstleder'];
const BOX_VERSCHLUSS = ['Klettverschluss', 'Schnürung'];
const BOX_FUELLUNG   = ['EVA-Schaum', 'Memory-Schaum', 'Multi-Layer-Schaum'];
const BOX_FUTTER     = ['Satin', 'Mesh / Klimatisiert'];

const BAND_MATERIAL  = ['100% Baumwolle', 'Semi-elastisch (Baumwolle/Elasthan)', 'Vollstretch'];

const SCHUTZ_MATERIAL   = ['EVA-Schaum', 'Leder', 'PU-Leder', 'Hard-Shell (PP/ABS)'];
const SCHUTZ_VERSCHLUSS = ['Klettverschluss', 'Ärmel / Sleeve'];
const SCHIEN_TYP        = ['Mit Spannschutz', 'Ohne Spannschutz'];

const PATCH_FORM        = ['Kreis', 'Rechteck', 'Wappenschild', 'Oval', 'Freiform'];
const PATCH_TECHNIK     = ['Stickerei (gestickt)', 'Webdruck', 'Direktdruck', 'Sublimationsdruck'];
const PATCH_BEFESTIGUNG = ['Ohne (Aufnäher)', 'Bügelvlies (iron-on)', 'Klett / Velcro', 'Selbstklebend'];

// ── Typ-Metadaten ───────────────────────────────────────────────────────────
const TYP_META = {
  karate_gi:       { label: 'Karate-Gi',        icon: '🥋' },
  patches:         { label: 'Patches',           icon: '🔰' },
  boxhandschuhe:   { label: 'Boxhandschuhe',     icon: '🥊' },
  bandagen:        { label: 'Bandagen',          icon: '🩹' },
  fussschoner:     { label: 'Fußschoner',        icon: '🦶' },
  schienbeinschoner: { label: 'Schienbeinschoner', icon: '🦵' },
  allgemein:       { label: 'Allgemein',         icon: '📦' },
};

// ── Leere Spez-Defaults ─────────────────────────────────────────────────────
const EMPTY_SPEZ = {
  material: [], materialText: '', webart: [], grammatur: [],
  labelText: '', labelSprachen: ['Deutsch', 'Englisch'],
  labelArt: [], labelPosition: [], labelZusatz: '',
};

const EMPTY_FORM = {
  name: '', typ: 'karate_gi', lieferant_id: '', modell: '128',
  modell_name: '', artikel_nr_vorl: '', farbe: 'Weiß', wkf: false,
  stickerei_pos: [], stickerei_text: '', stickerei_farben: 'Gold, Schwarz',
  stickerei_datei: '', bemerkungen: '', artikel_ids: [],
  spezifikation: { ...EMPTY_SPEZ },
  mengenKids: EMPTY_MENGEN('128'),
  mengenAdult: EMPTY_MENGEN('128'),
  katKids: true, katAdult: true,
};

// ── Komponente ───────────────────────────────────────────────────────────────
export default function BestellvorlagenTab() {
  const { activeDojo } = useDojoContext();
  const { user } = useAuth();
  const isSuperAdmin = (user?.role === 'admin' || user?.rolle === 'admin') && !user?.dojo_id;
  const dojoId = activeDojo?.id;

  const [mode, setMode]               = useState('list');
  const [vorlagen, setVorlagen]       = useState([]);
  const [artikel, setArtikel]         = useState([]);
  const [lieferanten, setLieferanten] = useState([]);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [selectedId, setSelectedId]   = useState(null);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [search, setSearch]           = useState('');
  const [dateien, setDateien]         = useState([]);
  const [uploadingFile, setUploadingFile] = useState(null); // null | 'general' | positionName
  const fileInputRef    = useRef(null);
  const posFileRef      = useRef(null);
  const posUploadPos    = useRef(null); // welche Position gerade uploaden wird

  // ── Laden ──────────────────────────────────────────────────────────────────
  const loadVorlagen = useCallback(async () => {
    if (!dojoId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/bestellvorlagen?dojo_id=${dojoId}`);
      setVorlagen(res.data?.data || []);
    } catch { setError('Vorlagen konnten nicht geladen werden.'); }
    finally { setLoading(false); }
  }, [dojoId]);

  const loadArtikel = useCallback(async () => {
    if (!dojoId) return;
    try { const res = await axios.get(`/artikel?dojo_id=${dojoId}`); setArtikel(res.data?.data || []); } catch {}
  }, [dojoId]);

  const loadLieferanten = useCallback(async () => {
    if (!dojoId && !isSuperAdmin) return;
    // alle=1: auch Lieferanten anderer Dojos sichtbar (für Bestellvorlagen-Kontext)
    const url = dojoId ? `/lieferanten?dojo_id=${dojoId}&alle=1` : '/lieferanten';
    try {
      const res = await axios.get(url);
      setLieferanten(res.data?.data || []);
    } catch (e) {
      console.error('Lieferanten laden fehlgeschlagen:', e?.response?.status, e?.message);
    }
  }, [dojoId, isSuperAdmin]);

  const loadDateien = useCallback(async (vorlagenId) => {
    if (!dojoId || !vorlagenId) return;
    try { const res = await axios.get(`/bestellvorlagen/${vorlagenId}/dateien?dojo_id=${dojoId}`); setDateien(res.data?.data || []); } catch {}
  }, [dojoId]);

  useEffect(() => { loadVorlagen(); }, [loadVorlagen]);
  useEffect(() => { loadArtikel(); loadLieferanten(); }, [loadArtikel, loadLieferanten]);

  // ── Hilfen ─────────────────────────────────────────────────────────────────
  const f    = (key)  => (e)  => setForm(p => ({ ...p, [key]: e.target.value }));
  const fb   = (key)  => (e)  => setForm(p => ({ ...p, [key]: e.target.checked }));
  const fSpez  = (key) => (e)  => setForm(p => ({ ...p, spezifikation: { ...p.spezifikation, [key]: e.target.value } }));
  const fbSpez = (key) => (e)  => setForm(p => ({ ...p, spezifikation: { ...p.spezifikation, [key]: e.target.checked } }));

  const toggleSpez = (key, val) =>
    setForm(p => {
      const arr = p.spezifikation[key] || [];
      return { ...p, spezifikation: { ...p.spezifikation, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] } };
    });

  const switchModell = (modell) => {
    const oldSizes = SIZES[form.modell];
    const newSizes = SIZES[modell];
    const migrate  = (old) => {
      const next = {};
      newSizes.forEach(s => { next[s] = oldSizes.includes(s) ? (old[s] || '') : ''; });
      return next;
    };
    setForm(p => ({ ...p, modell, mengenKids: migrate(p.mengenKids), mengenAdult: migrate(p.mengenAdult) }));
  };

  const handleTypChange = (e) => {
    const newTyp   = e.target.value;
    const newSizes = getSizesForTyp(newTyp);
    const newMengen = newSizes ? newSizes.reduce((acc, s) => ({ ...acc, [s]: '' }), {}) : {};
    setForm(p => ({
      ...p,
      typ: newTyp,
      stickerei_pos: [],
      spezifikation: { ...EMPTY_SPEZ, mengen: newMengen, ...(newTyp === 'patches' ? { durchmesser: 8, umfang: (Math.PI * 8).toFixed(1) } : {}) },
    }));
  };

  const togglePos     = (pos) => setForm(p => ({ ...p, stickerei_pos: p.stickerei_pos.includes(pos) ? p.stickerei_pos.filter(x => x !== pos) : [...p.stickerei_pos, pos] }));
  const toggleArtikel = (id) => {
    const art = artikel.find(a => a.artikel_id === id);
    setForm(p => {
      const isAdding = !p.artikel_ids.includes(id);
      const newIds   = isAdding ? [...p.artikel_ids, id] : p.artikel_ids.filter(x => x !== id);
      // Artikel-Nr. automatisch übernehmen wenn das Feld noch leer ist
      const autoNr   = isAdding && art?.artikel_nummer && !p.artikel_nr_vorl ? art.artikel_nummer : p.artikel_nr_vorl;
      return { ...p, artikel_ids: newIds, artikel_nr_vorl: autoNr };
    });
  };

  // Gi Mengen
  const setMenge   = (row, size, val) => setForm(p => ({ ...p, [row]: { ...p[row], [size]: val } }));
  const totalFor   = (row) => Object.values(form[row]).reduce((s, v) => s + (parseInt(v) || 0), 0);
  const grandTot   = () => totalFor('mengenKids') + totalFor('mengenAdult');

  // Generische Mengen (für alle Nicht-Gi-Typen)
  const setMengeGeneric = (size, val) =>
    setForm(p => ({ ...p, spezifikation: { ...p.spezifikation, mengen: { ...(p.spezifikation.mengen || {}), [size]: val } } }));
  const totalGeneric = () =>
    Object.values(form.spezifikation.mengen || {}).reduce((s, v) => s + (parseInt(v) || 0), 0);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const uploadDatei = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    setUploadingFile('general');
    try {
      const fd = new FormData();
      fd.append('datei', file);
      const res = await axios.post(`/bestellvorlagen/${selectedId}/dateien?dojo_id=${dojoId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.datei) setDateien(prev => [...prev, res.data.datei]);
    } catch { setError('Datei konnte nicht hochgeladen werden.'); }
    finally { setUploadingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const triggerPosUpload = (position) => {
    posUploadPos.current = position;
    posFileRef.current?.click();
  };

  const uploadDateiFuerPosition = async (e) => {
    const file = e.target.files?.[0];
    const position = posUploadPos.current;
    if (!file || !selectedId || !position) return;
    if (posFileRef.current) posFileRef.current.value = '';
    setUploadingFile(position);
    try {
      const fd = new FormData();
      fd.append('datei', file);
      fd.append('tag', position);
      const res = await axios.post(`/bestellvorlagen/${selectedId}/dateien?dojo_id=${dojoId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.datei) setDateien(prev => [...prev, res.data.datei]);
    } catch { setError('Datei konnte nicht hochgeladen werden.'); }
    finally { setUploadingFile(null); posUploadPos.current = null; }
  };

  const deleteDatei = async (dateiId) => {
    if (!selectedId) return;
    try {
      await axios.delete(`/bestellvorlagen/${selectedId}/dateien/${dateiId}?dojo_id=${dojoId}`);
      setDateien(prev => prev.filter(d => d.datei_id !== dateiId));
    } catch { setError('Datei konnte nicht gelöscht werden.'); }
  };

  const openNew = () => { setForm(EMPTY_FORM); setSelectedId(null); setDateien([]); setMode('new'); setError(''); };

  const openEdit = async (v) => {
    setError('');
    try {
      const res  = await axios.get(`/bestellvorlagen/${v.vorlage_id}?dojo_id=${dojoId}`);
      const data = res.data?.data || v;
      let pos = data.stickerei_pos;
      if (typeof pos === 'string') { try { pos = JSON.parse(pos); } catch { pos = []; } }

      let spezObj = { ...EMPTY_SPEZ };
      if (data.spezifikation) { try { spezObj = { ...EMPTY_SPEZ, ...JSON.parse(data.spezifikation) }; } catch {} }

      const typ   = data.typ || 'karate_gi';
      const model = data.modell || '128';

      // Gi-spezifische Mengen
      const mengenKids  = spezObj.mengenKids  ? { ...EMPTY_MENGEN(model), ...spezObj.mengenKids  } : EMPTY_MENGEN(model);
      const mengenAdult = spezObj.mengenAdult ? { ...EMPTY_MENGEN(model), ...spezObj.mengenAdult } : EMPTY_MENGEN(model);

      // Generische Mengen für Nicht-Gi-Typen
      const typSizes  = getSizesForTyp(typ);
      const defaultMengen = typSizes ? typSizes.reduce((acc, s) => ({ ...acc, [s]: '' }), {}) : {};
      if (!spezObj.mengen) spezObj.mengen = defaultMengen;
      else spezObj.mengen = { ...defaultMengen, ...spezObj.mengen };

      const { mengenKids: _k, mengenAdult: _a, ...cleanSpez } = spezObj;

      setForm({
        name: data.name || '', typ,
        lieferant_id:   String(data.lieferant_id || ''),
        modell:         model,
        modell_name:    data.modell_name || '',
        artikel_nr_vorl: data.artikel_nr_vorl || '',
        farbe:          data.farbe || 'Weiß',
        wkf:            !!data.wkf,
        stickerei_pos:  Array.isArray(pos) ? pos : [],
        stickerei_text: data.stickerei_text || '',
        stickerei_farben: data.stickerei_farben || 'Gold, Schwarz',
        stickerei_datei: data.stickerei_datei || '',
        bemerkungen:    data.bemerkungen || '',
        artikel_ids:    data.artikel_ids || [],
        spezifikation:  cleanSpez,
        mengenKids, mengenAdult,
        katKids: true, katAdult: true,
      });
      setSelectedId(v.vorlage_id);
      setMode('edit');
      await loadDateien(v.vorlage_id);
    } catch { setError('Vorlage konnte nicht geladen werden.'); }
  };

  const cancel = () => { setMode('list'); setSelectedId(null); setError(''); };

  const save = async () => {
    if (!form.name.trim()) { setError('Name ist Pflichtfeld.'); return; }
    setSaving(true); setError('');
    try {
      const isGi = form.typ === 'karate_gi';
      const spezPayload = isGi
        ? { ...form.spezifikation, mengenKids: form.mengenKids, mengenAdult: form.mengenAdult }
        : form.spezifikation;

      const payload = {
        name:           form.name,
        typ:            form.typ,
        lieferant_id:   form.lieferant_id ? Number(form.lieferant_id) : null,
        modell:         form.modell,
        modell_name:    form.modell_name,
        artikel_nr_vorl: form.artikel_nr_vorl,
        farbe:          form.farbe,
        wkf:            form.wkf ? 1 : 0,
        stickerei_pos:  form.stickerei_pos,
        stickerei_text: form.stickerei_text,
        stickerei_farben: form.stickerei_farben,
        stickerei_datei: form.stickerei_datei,
        bemerkungen:    form.bemerkungen,
        artikel_ids:    form.artikel_ids,
        spezifikation:  JSON.stringify(spezPayload),
      };
      if (mode === 'new') {
        await axios.post(`/bestellvorlagen?dojo_id=${dojoId}`, payload);
        setSuccess('Vorlage angelegt.');
      } else {
        await axios.put(`/bestellvorlagen/${selectedId}?dojo_id=${dojoId}`, payload);
        setSuccess('Gespeichert.');
      }
      await loadVorlagen();
      setMode('list');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.message || 'Fehler beim Speichern.'); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm('Vorlage wirklich deaktivieren?')) return;
    try { await axios.delete(`/bestellvorlagen/${id}?dojo_id=${dojoId}`); await loadVorlagen(); }
    catch { setError('Fehler beim Löschen.'); }
  };

  // ── Formular-Render ─────────────────────────────────────────────────────────
  if (mode === 'new' || mode === 'edit') {
    const spez      = form.spezifikation || {};
    const isGi      = form.typ === 'karate_gi';
    const isPatches = form.typ === 'patches';
    const typSizes  = getSizesForTyp(form.typ);
    const typPos    = getPositionenForTyp(form.typ);
    const sizes     = SIZES[form.modell]; // nur für Gi

    // Chip-Auswahl-Hilfselement
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

    // ── Typ-spezifischer Spezifikations-Block ────────────────────────────────
    const renderTypSpez = () => {
      if (isGi) return (
        <div className="bvt-section" style={{ marginBottom: '1rem' }}>
          <p className="bvt-section-label">Produktspezifikation</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem 1.25rem' }}>
            <div className="bvt-field">
              <label className="bvt-label">Material</label>
              <SpezChip options={MATERIALIEN} field="material" />
              <input className="bvt-input" style={{ marginTop: '0.4rem' }}
                value={spez.materialText || ''} onChange={fSpez('materialText')} placeholder="Exakte Zusammensetzung" />
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Webart</label>
              <SpezChip options={WEBARTEN} field="webart" />
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Grammatur</label>
              <SpezChip options={GRAMMATUREN} field="grammatur" />
            </div>
          </div>
        </div>
      );

      if (form.typ === 'boxhandschuhe') return (
        <div className="bvt-section" style={{ marginBottom: '1rem' }}>
          <p className="bvt-section-label">Produktspezifikation — Boxhandschuhe</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.25rem' }}>
            <div className="bvt-field">
              <label className="bvt-label">Material (Außenmaterial)</label>
              <SpezChip options={BOX_MATERIAL} field="material" />
              <input className="bvt-input" style={{ marginTop: '0.4rem' }}
                value={spez.materialText || ''} onChange={fSpez('materialText')} placeholder="Exakte Materialangabe / Spezifikation" />
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Verschluss</label>
              <SpezChip options={BOX_VERSCHLUSS} field="verschluss" />
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Polsterung / Füllung</label>
              <SpezChip options={BOX_FUELLUNG} field="fuellung" />
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Innenfutter</label>
              <SpezChip options={BOX_FUTTER} field="futter" />
            </div>
          </div>
          <label className="bvt-check-row" style={{ marginTop: '0.6rem' }}>
            <input type="checkbox" checked={!!spez.wkfApproved} onChange={fbSpez('wkfApproved')} />
            WKF / WAKO zugelassen
          </label>
        </div>
      );

      if (form.typ === 'bandagen') return (
        <div className="bvt-section" style={{ marginBottom: '1rem' }}>
          <p className="bvt-section-label">Produktspezifikation — Bandagen</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.25rem' }}>
            <div className="bvt-field">
              <label className="bvt-label">Material</label>
              <SpezChip options={BAND_MATERIAL} field="material" />
              <input className="bvt-input" style={{ marginTop: '0.4rem' }}
                value={spez.materialText || ''} onChange={fSpez('materialText')} placeholder="z. B. 100% Baumwolle, 350 g/m²" />
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Breite (cm)</label>
              <input className="bvt-input" type="number" min="1" max="20"
                value={spez.breite || ''} onChange={fSpez('breite')} placeholder="5 (Standard)" />
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.25rem', display: 'block' }}>Standard: 5 cm</span>
            </div>
          </div>
        </div>
      );

      if (form.typ === 'fussschoner') return (
        <div className="bvt-section" style={{ marginBottom: '1rem' }}>
          <p className="bvt-section-label">Produktspezifikation — Fußschoner</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.25rem' }}>
            <div className="bvt-field">
              <label className="bvt-label">Material</label>
              <SpezChip options={SCHUTZ_MATERIAL} field="material" />
              <input className="bvt-input" style={{ marginTop: '0.4rem' }}
                value={spez.materialText || ''} onChange={fSpez('materialText')} placeholder="Exakte Materialspezifikation" />
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Befestigung</label>
              <SpezChip options={SCHUTZ_VERSCHLUSS} field="verschluss" />
            </div>
          </div>
          <label className="bvt-check-row" style={{ marginTop: '0.6rem' }}>
            <input type="checkbox" checked={!!spez.wkfKumite} onChange={fbSpez('wkfKumite')} />
            WKF Kumite zugelassen
          </label>
        </div>
      );

      if (form.typ === 'schienbeinschoner') return (
        <div className="bvt-section" style={{ marginBottom: '1rem' }}>
          <p className="bvt-section-label">Produktspezifikation — Schienbeinschoner</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.25rem' }}>
            <div className="bvt-field">
              <label className="bvt-label">Ausführung</label>
              <SpezChip options={SCHIEN_TYP} field="shienTyp" />
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Material</label>
              <SpezChip options={SCHUTZ_MATERIAL} field="material" />
              <input className="bvt-input" style={{ marginTop: '0.4rem' }}
                value={spez.materialText || ''} onChange={fSpez('materialText')} placeholder="Exakte Materialspezifikation" />
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Befestigung</label>
              <SpezChip options={SCHUTZ_VERSCHLUSS} field="verschluss" />
            </div>
          </div>
          <label className="bvt-check-row" style={{ marginTop: '0.6rem' }}>
            <input type="checkbox" checked={!!spez.wkfKumite} onChange={fbSpez('wkfKumite')} />
            WKF Kumite zugelassen
          </label>
        </div>
      );

      if (form.typ === 'patches') return (
        <div className="bvt-section" style={{ marginBottom: '1rem' }}>
          <p className="bvt-section-label">Produktspezifikation — Patches</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.25rem' }}>
            <div className="bvt-field">
              <label className="bvt-label">Form</label>
              <SpezChip options={PATCH_FORM} field="patchForm" />
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Herstellungsverfahren</label>
              <SpezChip options={PATCH_TECHNIK} field="technik" />
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Befestigung</label>
              <SpezChip options={PATCH_BEFESTIGUNG} field="befestigung" />
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Maße</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '0.2rem' }}>Durchmesser (cm)</span>
                  <input className="bvt-input" type="number" min="0.5" step="0.5"
                    value={spez.durchmesser ?? 8}
                    onChange={e => {
                      const d = parseFloat(e.target.value) || '';
                      setForm(p => ({ ...p, spezifikation: { ...p.spezifikation, durchmesser: d, umfang: d ? (Math.PI * d).toFixed(1) : '' } }));
                    }}
                    placeholder="8" />
                </div>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '0.2rem' }}>Umfang (cm)</span>
                  <input className="bvt-input" type="number" min="0.5" step="0.1"
                    value={spez.umfang ?? (spez.durchmesser ? (Math.PI * spez.durchmesser).toFixed(1) : (Math.PI * 8).toFixed(1))}
                    onChange={fSpez('umfang')}
                    placeholder={(Math.PI * 8).toFixed(1)} />
                </div>
              </div>
            </div>
            <div className="bvt-field">
              <label className="bvt-label">Mindestbestellmenge</label>
              <input className="bvt-input" type="number" min="1"
                value={spez.mindestmenge || ''} onChange={fSpez('mindestmenge')} placeholder="z. B. 50" />
            </div>
          </div>
        </div>
      );

      return null;
    };

    // ── Mengenbestellung-Block ───────────────────────────────────────────────
    const renderMengen = () => {
      if (isGi) return (
        <div className="bvt-section" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Mengenbestellung</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.6rem', border: `1px solid ${form.katKids ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '20px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.katKids} onChange={fb('katKids')} style={{ accentColor: 'rgba(212,175,55,0.9)' }} />
              Kinder / Kids
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.6rem', border: `1px solid ${form.katAdult ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '20px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.katAdult} onChange={fb('katAdult')} style={{ accentColor: 'rgba(212,175,55,0.9)' }} />
              Erwachsene
            </label>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
              Gesamt: <strong style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem' }}>{grandTot()} Stück</strong>
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', padding: '0.35rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.07)', minWidth: 80 }}>Kategorie</th>
                  {sizes.map(s => <th key={s} style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', padding: '0.35rem 0.3rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.07)' }}>{s}</th>)}
                  <th style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', padding: '0.35rem 0.3rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.07)', minWidth: 36 }}>Σ</th>
                </tr>
              </thead>
              <tbody>
                {form.katKids && (
                  <tr>
                    <td style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 600, fontSize: '0.8rem', padding: '0.4rem 0.6rem', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>Kinder</td>
                    {sizes.map(s => (
                      <td key={s} style={{ border: '1px solid rgba(255,255,255,0.06)', padding: 0 }}>
                        <input type="number" min="0" value={form.mengenKids[s]} onChange={e => setMenge('mengenKids', s, e.target.value)}
                          style={{ width: '100%', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontSize: '0.9rem', padding: '0.4rem 0', outline: 'none', MozAppearance: 'textfield', minWidth: 36 }} />
                      </td>
                    ))}
                    <td style={{ fontWeight: 700, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', padding: '0.4rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>{totalFor('mengenKids')}</td>
                  </tr>
                )}
                {form.katAdult && (
                  <tr>
                    <td style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 600, fontSize: '0.8rem', padding: '0.4rem 0.6rem', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>Erwachsene</td>
                    {sizes.map(s => (
                      <td key={s} style={{ border: '1px solid rgba(255,255,255,0.06)', padding: 0 }}>
                        <input type="number" min="0" value={form.mengenAdult[s]} onChange={e => setMenge('mengenAdult', s, e.target.value)}
                          style={{ width: '100%', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontSize: '0.9rem', padding: '0.4rem 0', outline: 'none', MozAppearance: 'textfield', minWidth: 36 }} />
                      </td>
                    ))}
                    <td style={{ fontWeight: 700, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', padding: '0.4rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>{totalFor('mengenAdult')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );

      if (isPatches) return (
        <div className="bvt-section" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Bestellmenge</span>
          </div>
          <div className="bvt-field" style={{ maxWidth: 220 }}>
            <label className="bvt-label">Gesamtmenge (Stück)</label>
            <input className="bvt-input" type="number" min="1"
              value={spez.mengeGesamt || ''} onChange={fSpez('mengeGesamt')} placeholder="z. B. 100" />
          </div>
        </div>
      );

      if (typSizes) return (
        <div className="bvt-section" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Mengenbestellung</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
              Gesamt: <strong style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem' }}>{totalGeneric()} Stück</strong>
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  {typSizes.map(s => (
                    <th key={s} style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', padding: '0.35rem 0.75rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.07)', minWidth: 60 }}>{s}</th>
                  ))}
                  <th style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', padding: '0.35rem 0.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.07)', minWidth: 40 }}>Σ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {typSizes.map(s => (
                    <td key={s} style={{ border: '1px solid rgba(255,255,255,0.06)', padding: 0 }}>
                      <input type="number" min="0"
                        value={(spez.mengen || {})[s] || ''}
                        onChange={e => setMengeGeneric(s, e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontSize: '0.9rem', padding: '0.5rem 0', outline: 'none', MozAppearance: 'textfield', minWidth: 60 }} />
                    </td>
                  ))}
                  <td style={{ fontWeight: 700, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', padding: '0.5rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>{totalGeneric()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );

      return null;
    };

    // ── Logo / Aufdruck Positionen ───────────────────────────────────────────
    const logoLabel = isGi ? 'Stickerei' : (isPatches ? 'Druck / Stickerei' : 'Logo & Aufdruck');

    return (
      <div className="bvt-form-page">
        <div className="bvt-form-header">
          <div>
            <span className="bvt-form-title">{mode === 'new' ? 'Neue Bestellvorlage' : form.name}</span>
            <span className="bvt-form-sub">{mode === 'new' ? 'Vorlage erfassen' : 'Bearbeiten'}</span>
          </div>
          <div className="bvt-form-actions">
            <button className="bvt-btn bvt-btn--ghost" onClick={cancel}>Abbrechen</button>
            <button className="bvt-btn bvt-btn--primary" onClick={save} disabled={saving}>
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </div>

        {error && <div className="bvt-alert bvt-alert--err">{error}</div>}

        {/* ── 2-Spalten oben ─────────────────────────────────────────────── */}
        <div className="bvt-form-grid" style={{ marginBottom: '1rem' }}>
          {/* Linke Spalte */}
          <div className="bvt-form-col">
            <div className="bvt-section">
              <p className="bvt-section-label">Grunddaten</p>
              <div className="bvt-field">
                <label className="bvt-label">Name *</label>
                <input className="bvt-input" value={form.name} onChange={f('name')}
                  placeholder={isGi ? 'z. B. Vereins-Gi Hayashi WKF' : isPatches ? 'z. B. Vereins-Patch TDA' : `z. B. Vereins-${TYP_META[form.typ]?.label || ''}`} />
              </div>
              <div className="bvt-field">
                <label className="bvt-label">Typ</label>
                <select className="bvt-input" value={form.typ} onChange={handleTypChange}>
                  {Object.entries(TYP_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              <div className="bvt-field">
                <label className="bvt-label">Lieferant</label>
                <select className="bvt-input" value={form.lieferant_id} onChange={f('lieferant_id')}>
                  <option value="">— kein Lieferant —</option>
                  {lieferanten.map(l => <option key={l.lieferant_id} value={l.lieferant_id}>{l.firmenname}{l.dojo_name && !dojoId ? ` (${l.dojo_name})` : ''}</option>)}
                </select>
              </div>
              <div className="bvt-field">
                <label className="bvt-label">{isGi ? 'Artikel-Nr.' : 'Artikel-Nr. / Referenz'}</label>
                <input className="bvt-input" value={form.artikel_nr_vorl} onChange={f('artikel_nr_vorl')} placeholder="z. B. 0270" />
              </div>
              <div className="bvt-field">
                <label className="bvt-label">{isGi ? 'Farbe / Ausführung' : 'Farbe'}</label>
                <input className="bvt-input" value={form.farbe} onChange={f('farbe')} placeholder={isGi ? 'Weiß' : 'z. B. Rot/Schwarz'} />
              </div>
              {!isPatches && (
                <label className="bvt-check-row">
                  <input type="checkbox" checked={form.wkf} onChange={fb('wkf')} />
                  WKF-zugelassen / WKF Approved
                </label>
              )}
            </div>

            {/* Modell-Auswahl: nur für Gi */}
            {isGi && (
              <div className="bvt-section">
                <p className="bvt-section-label">Modell</p>
                <div className="bvt-model-row">
                  <div className={`bvt-model-card ${form.modell === '128' ? 'active' : ''}`} onClick={() => switchModell('128')}>
                    <div className="bvt-model-card__name">Modell 128</div>
                    <div className="bvt-model-card__detail">11 Größen · 140–200 cm</div>
                  </div>
                  <div className={`bvt-model-card ${form.modell === '188' ? 'active' : ''}`} onClick={() => switchModell('188')}>
                    <div className="bvt-model-card__name">Modell 188</div>
                    <div className="bvt-model-card__detail">8 Größen · 130–200 cm</div>
                  </div>
                </div>
                <div className="bvt-field">
                  <label className="bvt-label">Modellbezeichnung</label>
                  <input className="bvt-input" value={form.modell_name} onChange={f('modell_name')} placeholder="z. B. Hayashi Tenno WKF Approved" />
                </div>
              </div>
            )}

            {/* Produktbezeichnung für Nicht-Gi-Typen */}
            {!isGi && (
              <div className="bvt-section">
                <p className="bvt-section-label">Produktdaten</p>
                <div className="bvt-field">
                  <label className="bvt-label">Produktbezeichnung / Modell</label>
                  <input className="bvt-input" value={form.modell_name} onChange={f('modell_name')}
                    placeholder={
                      form.typ === 'boxhandschuhe' ? 'z. B. Hayashi Pro Bag Gloves' :
                      form.typ === 'bandagen' ? 'z. B. Hayashi Elastische Bandagen' :
                      form.typ === 'fussschoner' ? 'z. B. Hayashi Karate Fußschoner WKF' :
                      form.typ === 'schienbeinschoner' ? 'z. B. Hayashi Kumite Schienbeinschoner' :
                      form.typ === 'patches' ? 'z. B. Vereins-Patch rund, 8 cm' : 'Modellbezeichnung'
                    } />
                </div>
                <div className="bvt-field">
                  <label className="bvt-label">Bemerkungen</label>
                  <textarea className="bvt-textarea" rows="3" value={form.bemerkungen} onChange={f('bemerkungen')}
                    placeholder="Sonderwünsche, Verpackungsvorschriften, Hinweise …" />
                </div>
              </div>
            )}
          </div>

          {/* Rechte Spalte */}
          <div className="bvt-form-col">
            <div className="bvt-section">
              <p className="bvt-section-label">{logoLabel}</p>

              {typPos.length > 0 && (
                <div className="bvt-pos-grid" style={{ marginBottom: '0.65rem' }}>
                  {typPos.map(pos => (
                    <label key={pos} className={`bvt-pos-item ${form.stickerei_pos.includes(pos) ? 'active' : ''}`}>
                      <input type="checkbox" checked={form.stickerei_pos.includes(pos)} onChange={() => togglePos(pos)} style={{ display: 'none' }} />
                      {pos}
                      {mode === 'edit' && form.stickerei_pos.includes(pos) && dateien.filter(d => d.tag === pos).length > 0 && (
                        <span style={{ marginLeft: 4, fontSize: '0.65rem', background: 'rgba(212,175,55,0.2)', borderRadius: 8, padding: '0.05rem 0.3rem', color: '#c8a44a' }}>
                          {dateien.filter(d => d.tag === pos).length}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}

              {/* Per-Position Datei-Upload (nur im Edit-Modus) */}
              {mode === 'edit' && form.stickerei_pos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  {form.stickerei_pos.map(pos => {
                    const posFiles = dateien.filter(d => d.tag === pos);
                    return (
                      <div key={pos} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '0.4rem 0.6rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: posFiles.length ? '0.35rem' : 0 }}>
                          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', flex: 1 }}>{pos}</span>
                          <button onClick={() => triggerPosUpload(pos)} disabled={uploadingFile === pos}
                            style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 4, padding: '0.12rem 0.45rem', cursor: 'pointer', color: '#c8a44a', fontSize: '0.73rem', whiteSpace: 'nowrap' }}>
                            {uploadingFile === pos ? '⏳' : '+ Datei'}
                          </button>
                        </div>
                        {posFiles.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {posFiles.map(d => {
                              const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(d.original_name);
                              return (
                                <div key={d.datei_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '0.1rem 0.3rem 0.1rem 0.2rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>
                                  {isImg
                                    ? <img src={d.pfad} alt="" style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />
                                    : <span style={{ flexShrink: 0 }}>📎</span>}
                                  <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.original_name}</span>
                                  <button onClick={() => deleteDatei(d.datei_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '0.8rem', padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bvt-field">
                <label className="bvt-label">{isGi ? 'Schriftzug / Text' : 'Logo-Text / Schriftzug'}</label>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                  <input className="bvt-input" style={{ flex: 1 }} value={form.stickerei_text} onChange={f('stickerei_text')}
                    placeholder={isPatches ? 'z. B. TDA Deutschland' : 'z. B. Kampfkunstschule Schreiner · TDA'} />
                  {mode === 'edit' && (
                    <button onClick={() => triggerPosUpload('Logo-Text / Schriftzug')} title="Design-Datei für Schriftzug hochladen"
                      disabled={uploadingFile === 'Logo-Text / Schriftzug'}
                      style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 6, padding: '0.45rem 0.6rem', cursor: 'pointer', color: '#c8a44a', fontSize: '0.85rem', flexShrink: 0 }}>
                      {uploadingFile === 'Logo-Text / Schriftzug' ? '⏳' : '📎'}
                    </button>
                  )}
                </div>
                {mode === 'edit' && dateien.filter(d => d.tag === 'Logo-Text / Schriftzug').map(d => {
                  const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(d.original_name);
                  return (
                    <div key={d.datei_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.3rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '0.1rem 0.3rem 0.1rem 0.2rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>
                      {isImg ? <img src={d.pfad} alt="" style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: 2 }} /> : <span>📎</span>}
                      <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.original_name}</span>
                      <button onClick={() => deleteDatei(d.datei_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '0.8rem', padding: 0 }}>×</button>
                    </div>
                  );
                })}
              </div>
              <div className="bvt-field">
                <label className="bvt-label">{isGi ? 'Garnfarben' : 'Garn- / Druckfarben'}</label>
                <input className="bvt-input" value={form.stickerei_farben} onChange={f('stickerei_farben')} placeholder="z. B. Gold, Schwarz" />
              </div>

              {/* Gi-spezifisch: Bemerkungen */}
              {isGi && (
                <div className="bvt-field">
                  <label className="bvt-label">Bemerkungen</label>
                  <textarea className="bvt-textarea" rows="3" value={form.bemerkungen} onChange={f('bemerkungen')}
                    placeholder="Sonderwünsche, Verpackungsvorschriften …" />
                </div>
              )}
            </div>

            {/* Logos & Dateien */}
            <div className="bvt-section">
              <p className="bvt-section-label">
                {isPatches ? 'Design-Dateien & Vorlagen' : 'Logos & Dateien'}
              </p>
              {mode === 'edit' ? (
                <>
                  {/* Versteckter Input für Positions-Upload */}
                  <input ref={posFileRef} type="file" style={{ display: 'none' }}
                    accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.ai,.eps,.dst,.pes,.exp,.jef,.vp3"
                    onChange={uploadDateiFuerPosition} />
                  <div className="bvt-upload-zone" onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" style={{ display: 'none' }}
                      accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.ai,.eps,.dst,.pes,.exp,.jef,.vp3"
                      onChange={uploadDatei} />
                    {uploadingFile === 'general'
                      ? <span className="bvt-upload-hint">Wird hochgeladen…</span>
                      : <span className="bvt-upload-hint">
                          {isPatches
                            ? '+ Allgemeine Datei hochladen (Design, AI, EPS, Stickerei-Datei …)'
                            : '+ Allgemeine Datei hochladen (Logos, Stickerei-Dateien, PDFs …)'}
                        </span>}
                  </div>
                  {dateien.filter(d => !d.tag).length > 0 && (
                    <div className="bvt-datei-list">
                      {dateien.filter(d => !d.tag).map(d => {
                        const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(d.original_name);
                        return (
                          <div key={d.datei_id} className="bvt-datei-item">
                            {isImg
                              ? <img className="bvt-datei-thumb" src={d.pfad} alt={d.original_name} />
                              : <div className="bvt-datei-icon">📎</div>}
                            <div className="bvt-datei-info">
                              <div className="bvt-datei-name">{d.original_name}</div>
                              <div className="bvt-datei-size">
                                {d.groesse_bytes > 1024*1024 ? `${(d.groesse_bytes/1024/1024).toFixed(1)} MB` : `${Math.round(d.groesse_bytes/1024)} KB`}
                              </div>
                            </div>
                            <button className="bvt-datei-del" onClick={() => deleteDatei(d.datei_id)} title="Löschen">×</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="bvt-upload-hint" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
                  Vorlage erst speichern, dann Dateien hochladen.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Typ-spezifische Spezifikation (volle Breite) ───────────────── */}
        {renderTypSpez()}

        {/* ── Mengenbestellung (volle Breite) ───────────────────────────── */}
        {renderMengen()}

        {/* ── Pflegekennzeichnung / Label (volle Breite) — nicht für Patches ── */}
        {!isPatches && (
          <div className="bvt-section" style={{ marginBottom: '1rem' }}>
            <p className="bvt-section-label">Pflegekennzeichnung &amp; Label-Spezifikation</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.25rem' }}>
              <div className="bvt-field">
                <label className="bvt-label">Material-Text (Label)</label>
                <input className="bvt-input" value={spez.labelText || ''} onChange={fSpez('labelText')}
                  placeholder="z. B. 100% Baumwolle / 100% Cotton" />
              </div>
              <div className="bvt-field">
                <label className="bvt-label">Zusatztext auf Label</label>
                <input className="bvt-input" value={spez.labelZusatz || ''} onChange={fSpez('labelZusatz')}
                  placeholder="z. B. Made exclusively for KKS Schreiner" />
              </div>
              <div className="bvt-field">
                <label className="bvt-label">Label-Sprachen</label>
                <SpezChip options={LABEL_LANG} field="labelSprachen" />
              </div>
              <div className="bvt-field">
                <label className="bvt-label">Label-Art</label>
                <SpezChip options={LABEL_ART} field="labelArt" />
              </div>
              <div className="bvt-field">
                <label className="bvt-label">Label-Position</label>
                <SpezChip options={LABEL_POS} field="labelPosition" />
              </div>
            </div>
          </div>
        )}

        {/* ── Artikel-Zuordnung (volle Breite) ──────────────────────────── */}
        <div className="bvt-section">
          <p className="bvt-section-label">Artikel-Zuordnung</p>
          {artikel.length === 0 ? (
            <div className="bvt-empty" style={{ padding: '1rem' }}>Keine Artikel vorhanden.</div>
          ) : (
            <div className="bvt-artikel-grid">
              {artikel.map(a => {
                const selected = form.artikel_ids.includes(a.artikel_id);
                return (
                  <label key={a.artikel_id} className={`bvt-artikel-item ${selected ? 'selected' : ''}`} onClick={() => toggleArtikel(a.artikel_id)}>
                    <input type="checkbox" checked={selected} onChange={() => toggleArtikel(a.artikel_id)} onClick={e => e.stopPropagation()} />
                    <div>
                      <div className="bvt-artikel-name">{a.name}</div>
                      {a.artikel_nummer && <div className="bvt-artikel-nr">#{a.artikel_nummer}</div>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Listen-Ansicht ──────────────────────────────────────────────────────────
  const filtered = vorlagen.filter(v =>
    !search || v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.lieferant_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bvt-list-page">
      <div className="bvt-list-header">
        <input className="bvt-search" placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="bvt-btn bvt-btn--primary" onClick={openNew}>+ Neue Bestellvorlage</button>
      </div>

      {error   && <div className="bvt-alert bvt-alert--err">{error}</div>}
      {success && <div className="bvt-alert bvt-alert--ok">{success}</div>}

      {loading ? (
        <div className="bvt-loading">Lädt…</div>
      ) : filtered.length === 0 ? (
        <div className="bvt-empty">{vorlagen.length === 0 ? 'Noch keine Bestellvorlagen erfasst.' : 'Keine Treffer.'}</div>
      ) : (
        <div className="bvt-cards">
          {filtered.map(v => {
            const meta = TYP_META[v.typ] || { label: v.typ, icon: '📦' };
            return (
              <div key={v.vorlage_id} className="bvt-card">
                <div className="bvt-card__main">
                  <div className="bvt-card__name">{meta.icon} {v.name}</div>
                  <div className="bvt-card__sub">
                    {v.lieferant_name ? `Lieferant: ${v.lieferant_name}` : 'Kein Lieferant'}
                    {' · '}
                    {v.artikel_count === 1 ? '1 Artikel verknüpft' : `${v.artikel_count || 0} Artikel verknüpft`}
                  </div>
                  <div className="bvt-card__meta">
                    <span className={`bvt-badge ${v.typ === 'karate_gi' ? 'bvt-badge--gold' : ''}`}>{meta.label}</span>
                    {v.typ === 'karate_gi' && v.modell && <span className="bvt-badge">Modell {v.modell}</span>}
                    {v.wkf && <span className="bvt-badge bvt-badge--gold">WKF</span>}
                  </div>
                </div>
                <div className="bvt-card__actions">
                  <button className="bvt-btn bvt-btn--ghost bvt-btn--sm" onClick={() => openEdit(v)}>Bearbeiten</button>
                  <button className="bvt-btn bvt-btn--danger bvt-btn--sm" onClick={() => del(v.vorlage_id)}>Entfernen</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
