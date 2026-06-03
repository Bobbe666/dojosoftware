// =============================================================================
// T-Shirt-Bestellvorlage  (eigenständig, analog zur Gi-Bestellvorlage)
// Speichert in gi_bestellungen (formdata._typ='tshirt'). Lieferant, Preise/
// Gesamtpreis und Datei-Upload (lokal als Base64, ins PDF eingebettet).
// =============================================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import '../styles/GiBestellvorlage.css';
import '../styles/TShirtBestellvorlage.css';

const SIZES_KIDS  = ['98/104', '110/116', '122/128', '134/146', '152/164'];
const SIZES_ADULT = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
const AUSSCHNITT  = ['Rundhals', 'V-Ausschnitt'];
const AERMEL      = ['Kurzarm', 'Langarm', 'Ärmellos'];
const PASSFORM    = ['Herren / Unisex', 'Damen (tailliert)', 'Kinder'];
const VEREDELUNG  = ['Druck', 'Stickerei', 'Flex/Flock'];
const POSITIONEN  = ['Brust links', 'Brust mittig', 'Rücken', 'Ärmel links', 'Ärmel rechts'];
const WAEHRUNGEN  = ['EUR', 'USD', 'CHF'];

const emptyMengen = (sizes) => sizes.reduce((a, s) => ({ ...a, [s]: '' }), {});

const EMPTY = {
  ausschnitt: 'Rundhals',
  aermel: 'Kurzarm',
  passform: 'Herren / Unisex',
  farbe: '',
  material: '',
  artikelNr: '',
  besteller: 'Kampfkunstschule Schreiner',
  ansprechpartnerBesteller: 'Sascha Schreiner',
  lieferantId: '',
  lieferantFreitext: '',
  ansprechpartnerLieferant: '',
  mengenKids: emptyMengen(SIZES_KIDS),
  mengenAdult: emptyMengen(SIZES_ADULT),
  preisKids: '',
  preisAdult: '',
  waehrung: 'EUR',
  veredelungen: [],            // [{ pos, art, beschreibung, breite, hoehe, datei:{name,dataUrl} }]
  mockupFront: '',             // eigenes Vorderseiten-Bild (dataUrl) — ersetzt die SVG-Skizze
  mockupBack: '',              // eigenes Rückseiten-Bild (dataUrl)
  dateien: [],                 // [{ name, dataUrl, isImage }]  Designvorlagen / Logos
  lieferdatum: '',
  bestelldatum: '',
  bemerkungen: '',
};

const sumMengen = (m) => Object.values(m || {}).reduce((s, v) => s + (parseInt(v) || 0), 0);
const curSym = (w) => (w === 'USD' ? '$' : w === 'CHF' ? 'CHF' : '€');
const fmt = (n) => Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const readFile = (file) => new Promise((resolve) => {
  const isImage = /\.(jpe?g|png|gif|webp|svg)$/i.test(file.name);
  const reader = new FileReader();
  reader.onload = (ev) => resolve({ name: file.name, dataUrl: ev.target.result, isImage });
  reader.onerror = () => resolve({ name: file.name, dataUrl: null, isImage: false });
  reader.readAsDataURL(file);
});

// --- Parametrische T-Shirt-SVG (reagiert auf Ausschnitt/Ärmel) ----------------
// Platzierungs-Anker je Position (viewBox 0 0 220 240, Körper x 60–160).
// view = auf welcher Ansicht (Vorder-/Rückseite) die Position liegt.
const PLACEMENT = {
  'Brust links':  { view: 'front', x: 70,  y: 74,  w: 26, h: 26 },
  'Brust mittig': { view: 'front', x: 88,  y: 92,  w: 44, h: 44 },
  'Ärmel links':  { view: 'front', x: 30,  y: 90,  w: 20, h: 18 },
  'Ärmel rechts': { view: 'front', x: 170, y: 90,  w: 20, h: 18 },
  'Rücken':       { view: 'back',  x: 80,  y: 78,  w: 60, h: 68 },
};

function placementMarkup(v) {
  const def = PLACEMENT[v.pos];
  if (!def) return '';
  const b = v.placement || def;   // per-Position verschobener Anker
  if (v.datei && v.datei.isImage && v.datei.dataUrl) {
    return `<image href="${v.datei.dataUrl}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  const lbl = (v.art || 'Logo').slice(0, 5);
  return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="2" fill="rgba(201,162,39,0.10)" stroke="#c9a227" stroke-width="1" stroke-dasharray="3 2"/>` +
         `<text x="${b.x + b.w / 2}" y="${b.y + b.h / 2}" font-size="6.5" fill="#a8841a" text-anchor="middle" dominant-baseline="middle">${lbl}</text>`;
}

// Eine Ansicht (Vorder- oder Rückseite) mit eingearbeiteten Veredelungen.
// mockup (dataUrl) ersetzt — wenn vorhanden — die SVG-Zeichnung durch ein eigenes Bild.
function tshirtView({ ausschnitt, aermel, farbe, veredelungen = [], view = 'front', width = 200, mockup = '' }) {
  const fill = farbe || '#ffffff';
  const stroke = '#333';
  const sleeve = aermel === 'Langarm' ? 'long' : aermel === 'Ärmellos' ? 'none' : 'short';
  const leftSleeve = sleeve === 'none'
    ? 'M60,55 L60,80'
    : sleeve === 'long'
      ? 'M60,55 L18,95 L30,165 L60,150'
      : 'M60,55 L30,95 L52,108 L60,92';
  const rightSleeve = sleeve === 'none'
    ? 'M160,55 L160,80'
    : sleeve === 'long'
      ? 'M160,55 L202,95 L190,165 L160,150'
      : 'M160,55 L190,95 L168,108 L160,92';
  // Rückseite: flacher Halsausschnitt unabhängig vom Schnitt
  const neckSeg = view === 'back'
    ? 'Q110,54 132,44'
    : (ausschnitt === 'V-Ausschnitt' ? 'L110,72 L132,44' : 'Q110,62 132,44');
  const logos = (veredelungen || [])
    .filter((v) => PLACEMENT[v.pos] && PLACEMENT[v.pos].view === view)
    .map(placementMarkup).join('');
  const base = mockup
    ? `<image href="${mockup}" x="6" y="4" width="208" height="216" preserveAspectRatio="xMidYMid meet"/>`
    : `<path d="M60,55 Q88,40 88,44 ${neckSeg} Q132,40 160,55 L160,200 Q160,206 154,206 L66,206 Q60,206 60,200 Z"
             fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="${leftSleeve}" fill="${fill}" stroke="${stroke}" stroke-width="2.5" fill-rule="evenodd"/>
       <path d="${rightSleeve}" fill="${fill}" stroke="${stroke}" stroke-width="2.5" fill-rule="evenodd"/>
       <path d="M60,55 Q88,40 88,44 ${neckSeg} Q132,40 160,55" fill="none" stroke="${stroke}" stroke-width="2.5"/>`;
  return `
<svg viewBox="0 0 220 240" width="${width}" xmlns="http://www.w3.org/2000/svg">
  ${base}
  ${logos}
  <text x="110" y="232" font-size="9" fill="#888" text-anchor="middle">${view === 'back' ? 'Rückseite' : 'Vorderseite'}${mockup ? ' (eigene Vorlage)' : ''}</text>
</svg>`;
}

const VB_W = 220, VB_H = 240;
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Interaktive Vorschau (eine Ansicht) — Logo-Anker per Drag verschiebbar.
function TshirtPreviewSvg({ ausschnitt, aermel, farbe, veredelungen = [], view, width, mockup, draggable, onDrag }) {
  const svgRef = useRef(null);
  const sleeve = aermel === 'Langarm' ? 'long' : aermel === 'Ärmellos' ? 'none' : 'short';
  const leftSleeve = sleeve === 'none' ? 'M60,55 L60,80'
    : sleeve === 'long' ? 'M60,55 L18,95 L30,165 L60,150' : 'M60,55 L30,95 L52,108 L60,92';
  const rightSleeve = sleeve === 'none' ? 'M160,55 L160,80'
    : sleeve === 'long' ? 'M160,55 L202,95 L190,165 L160,150' : 'M160,55 L190,95 L168,108 L160,92';
  const neckSeg = view === 'back' ? 'Q110,54 132,44'
    : (ausschnitt === 'V-Ausschnitt' ? 'L110,72 L132,44' : 'Q110,62 132,44');
  const fill = farbe || '#ffffff';

  const toSvg = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (VB_W / r.width), y: (e.clientY - r.top) * (VB_H / r.height) };
  };
  const startDrag = (pos, b) => (e) => {
    if (!draggable) return;
    e.preventDefault();
    const s = toSvg(e);
    const off = { dx: s.x - b.x, dy: s.y - b.y, w: b.w, h: b.h };
    const move = (ev) => {
      const p = toSvg(ev);
      onDrag(pos, {
        x: clampN(p.x - off.dx, 0, VB_W - off.w),
        y: clampN(p.y - off.dy, 0, VB_H - 20 - off.h),
        w: off.w, h: off.h,
      });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const items = (veredelungen || []).filter((v) => PLACEMENT[v.pos] && PLACEMENT[v.pos].view === view);

  return (
    <svg ref={svgRef} viewBox="0 0 220 240" width={width} style={{ touchAction: 'none', userSelect: 'none' }}>
      {mockup
        ? <image href={mockup} x={6} y={4} width={208} height={216} preserveAspectRatio="xMidYMid meet" />
        : <>
            <path d={`M60,55 Q88,40 88,44 ${neckSeg} Q132,40 160,55 L160,200 Q160,206 154,206 L66,206 Q60,206 60,200 Z`}
              fill={fill} stroke="#333" strokeWidth={2.5} strokeLinejoin="round" />
            <path d={leftSleeve} fill={fill} stroke="#333" strokeWidth={2.5} fillRule="evenodd" />
            <path d={rightSleeve} fill={fill} stroke="#333" strokeWidth={2.5} fillRule="evenodd" />
            <path d={`M60,55 Q88,40 88,44 ${neckSeg} Q132,40 160,55`} fill="none" stroke="#333" strokeWidth={2.5} />
          </>}
      {items.map((v) => {
        const def = PLACEMENT[v.pos];
        const b = v.placement || def;
        const isImg = v.datei && v.datei.isImage && v.datei.dataUrl;
        return (
          <g key={v.pos} onPointerDown={startDrag(v.pos, b)} style={{ cursor: draggable ? 'move' : 'default' }}>
            {isImg
              ? <image href={v.datei.dataUrl} x={b.x} y={b.y} width={b.w} height={b.h} preserveAspectRatio="xMidYMid meet" />
              : <>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill="rgba(201,162,39,0.10)" stroke="#c9a227" strokeWidth={1} strokeDasharray="3 2" />
                  <text x={b.x + b.w / 2} y={b.y + b.h / 2} fontSize={6.5} fill="#a8841a" textAnchor="middle" dominantBaseline="middle">{(v.art || 'Logo').slice(0, 5)}</text>
                </>}
            {draggable && <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" stroke="#5b9bd5" strokeWidth={0.8} strokeDasharray="2 2" />}
          </g>
        );
      })}
      <text x={110} y={232} fontSize={9} fill="#888" textAnchor="middle">
        {view === 'back' ? 'Rückseite' : 'Vorderseite'}{mockup ? ' (eigene Vorlage)' : ''}
      </text>
    </svg>
  );
}

export default function TShirtBestellvorlage({
  vorlage = null,
  initEditingId = null,
  initFormdata = null,
  overrideDojoId = null,
  onClose,
}) {
  const { activeDojo } = useDojoContext();
  const dojoId = overrideDojoId || vorlage?.dojo_id || activeDojo?.id || null;

  const [form, setForm] = useState(() => {
    if (initFormdata) {
      return {
        ...EMPTY,
        ...initFormdata,
        mengenKids:  { ...EMPTY.mengenKids,  ...(initFormdata.mengenKids  || {}) },
        mengenAdult: { ...EMPTY.mengenAdult, ...(initFormdata.mengenAdult || {}) },
        veredelungen: Array.isArray(initFormdata.veredelungen) ? initFormdata.veredelungen : [],
        dateien: Array.isArray(initFormdata.dateien) ? initFormdata.dateien : [],
      };
    }
    return { ...EMPTY };
  });
  const [editingId, setEditingId] = useState(initEditingId);
  const [lieferanten, setLieferanten] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');
  const fileInputRef = useRef(null);
  const verFileRef = useRef(null);
  const verPosRef = useRef(null);
  const mockFrontRef = useRef(null);
  const mockBackRef = useRef(null);

  // --- Lieferanten laden (gleicher Endpoint wie Gi) --------------------------
  const loadLieferanten = useCallback(async () => {
    if (!dojoId) return;
    try {
      const res = await axios.get(`/lieferanten?dojo_id=${dojoId}`);
      setLieferanten(res.data?.data || []);
    } catch { /* still */ }
  }, [dojoId]);
  useEffect(() => { loadLieferanten(); }, [loadLieferanten]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));
  const setMenge = (kind, size, val) =>
    setForm((p) => ({ ...p, [kind]: { ...p[kind], [size]: val.replace(/[^0-9]/g, '') } }));

  const onLieferantChange = (e) => {
    const id = e.target.value;
    const lt = lieferanten.find((l) => String(l.lieferant_id) === id);
    setForm((p) => ({
      ...p,
      lieferantId: id,
      lieferantFreitext: lt ? lt.firmenname : p.lieferantFreitext,
      ansprechpartnerLieferant: lt ? (lt.ansprechpartner || '') : p.ansprechpartnerLieferant,
    }));
  };

  const posActive = (pos) => form.veredelungen.some((v) => v.pos === pos);
  const togglePos = (pos) =>
    setForm((p) => ({
      ...p,
      veredelungen: posActive(pos)
        ? p.veredelungen.filter((v) => v.pos !== pos)
        : [...p.veredelungen, { pos, art: 'Druck', beschreibung: '', breite: '', hoehe: '' }],
    }));
  const setVer = (pos, field, val) =>
    setForm((p) => ({
      ...p,
      veredelungen: p.veredelungen.map((v) => (v.pos === pos ? { ...v, [field]: val } : v)),
    }));

  // --- Datei-Upload (lokal, Base64) ------------------------------------------
  const onFilesPicked = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const parsed = await Promise.all(files.map(readFile));
    setForm((p) => ({ ...p, dateien: [...p.dateien, ...parsed] }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const removeDatei = (idx) =>
    setForm((p) => ({ ...p, dateien: p.dateien.filter((_, i) => i !== idx) }));

  const triggerVerFile = (pos) => { verPosRef.current = pos; verFileRef.current?.click(); };
  const onVerFilePicked = async (e) => {
    const file = e.target.files?.[0];
    const pos = verPosRef.current;
    if (!file || !pos) return;
    const parsed = await readFile(file);
    setForm((p) => ({
      ...p,
      veredelungen: p.veredelungen.map((v) => (v.pos === pos ? { ...v, datei: parsed } : v)),
    }));
    verPosRef.current = null;
    if (verFileRef.current) verFileRef.current.value = '';
  };
  const removeVerFile = (pos) =>
    setForm((p) => ({
      ...p,
      veredelungen: p.veredelungen.map((v) => (v.pos === pos ? { ...v, datei: null } : v)),
    }));

  // --- Eigenes Mockup-Bild (Vorder-/Rückseite) -------------------------------
  const onMockupPicked = (key) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const parsed = await readFile(file);
    setForm((p) => ({ ...p, [key]: parsed.dataUrl || '' }));
    e.target.value = '';
  };
  const removeMockup = (key) => setForm((p) => ({ ...p, [key]: '' }));

  // Drag-Anker: verschobene Position pro Veredelung speichern / zurücksetzen
  const setPlacement = (pos, box) =>
    setForm((p) => ({ ...p, veredelungen: p.veredelungen.map((v) => (v.pos === pos ? { ...v, placement: box } : v)) }));
  const resetPlacement = (pos) =>
    setForm((p) => ({ ...p, veredelungen: p.veredelungen.map((v) => (v.pos === pos ? { ...v, placement: null } : v)) }));

  const totalKids = sumMengen(form.mengenKids);
  const totalAdult = sumMengen(form.mengenAdult);
  const totalGesamt = totalKids + totalAdult;
  const summeKids = totalKids * parseFloat(form.preisKids || 0);
  const summeAdult = totalAdult * parseFloat(form.preisAdult || 0);
  const gesamtpreis = summeKids + summeAdult;
  const hasPreis = parseFloat(form.preisKids || 0) > 0 || parseFloat(form.preisAdult || 0) > 0;
  const sym = curSym(form.waehrung);

  const buildPayload = () => ({
    vorlage_id: vorlage?.vorlage_id || null,
    lieferant_id: form.lieferantId ? Number(form.lieferantId) : null,
    lieferant_name: form.lieferantFreitext || null,
    bestelldatum: form.bestelldatum || null,
    lieferdatum: form.lieferdatum || null,
    formdata: { ...form, _typ: 'tshirt' },
  });

  const handlePdf = async () => {
    const win = window.open('', '_blank');
    if (win) win.document.write('<html><body style="font-family:sans-serif;padding:2rem;color:#333;"><p>PDF wird erstellt…</p></body></html>');
    setGenerating(true);
    try {
      let neueId = editingId;
      if (dojoId) {
        try {
          if (editingId) await axios.put(`/gi-bestellungen/${editingId}?dojo_id=${dojoId}`, buildPayload());
          else {
            const res = await axios.post(`/gi-bestellungen?dojo_id=${dojoId}`, buildPayload());
            neueId = res.data?.bestellung_id;
            setEditingId(neueId);
          }
        } catch { /* PDF trotzdem */ }
      }
      const html = buildTShirtPdf(form, neueId);
      if (win) { win.document.open(); win.document.write(html); win.document.close(); }
    } catch (err) {
      if (win) win.close();
      alert('PDF-Erstellung fehlgeschlagen: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = async () => {
    if (!dojoId) { setMsg('Kein Dojo'); return; }
    setMsg('Speichert…');
    try {
      if (editingId) await axios.put(`/gi-bestellungen/${editingId}?dojo_id=${dojoId}`, buildPayload());
      else { const r = await axios.post(`/gi-bestellungen?dojo_id=${dojoId}`, buildPayload()); setEditingId(r.data?.bestellung_id); }
      setMsg('Gespeichert ✓');
      setTimeout(() => setMsg(''), 2500);
    } catch { setMsg('Fehler beim Speichern'); }
  };

  const Radio = ({ label, opts, value, onChange }) => (
    <div className="ts-radio-group">
      <div className="ts-radio-label">{label}</div>
      <div className="ts-radio-opts">
        {opts.map((o) => (
          <button key={o} type="button"
            className={`ts-radio ${value === o ? 'active' : ''}`}
            onClick={() => onChange(o)}>{o}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="gv-root ts-root">
      {/* Header */}
      <div className="gv-header">
        <div>
          {onClose && <button className="gv-btn-back" onClick={onClose}>← Zurück</button>}
          <div className="gv-title">{vorlage?.name || 'T-Shirt-Bestellung'}</div>
          <div className="gv-sub">{editingId ? `Bearbeitung #${String(editingId).padStart(4, '0')}` : 'Auswahl treffen → PDF generieren → drucken'}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexShrink: 0 }}>
          {msg && <span style={{ fontSize: '0.8rem', color: msg.includes('Fehler') || msg.includes('Kein') ? '#f87171' : '#86efac' }}>{msg}</span>}
          <button className="gv-btn-save" onClick={saveDraft}>💾 Zwischenspeichern</button>
          <button className="gv-btn-pdf" onClick={handlePdf} disabled={generating}>
            {generating ? 'Erstelle PDF…' : editingId ? 'PDF aktualisieren & drucken' : 'PDF generieren & drucken'}
          </button>
        </div>
      </div>

      <div className="gv-body">
        {/* Besteller / Lieferant */}
        <div className="gv-section-title">Besteller & Lieferant</div>
        <div className="ts-lief-grid">
          <label>Besteller
            <input className="gv-input" value={form.besteller} onChange={set('besteller')} />
          </label>
          <label>Ansprechpartner Besteller
            <input className="gv-input" value={form.ansprechpartnerBesteller} onChange={set('ansprechpartnerBesteller')} />
          </label>
          <label>Lieferant (aus Liste)
            <select className="gv-input" value={form.lieferantId} onChange={onLieferantChange}>
              <option value="">— wählen / Freitext —</option>
              {lieferanten.map((l) => <option key={l.lieferant_id} value={String(l.lieferant_id)}>{l.firmenname}</option>)}
            </select>
          </label>
          <label>Hersteller / Lieferant (Freitext)
            <input className="gv-input" value={form.lieferantFreitext} onChange={set('lieferantFreitext')} placeholder="Name des Herstellers" />
          </label>
          <label>Ansprechpartner Lieferant
            <input className="gv-input" value={form.ansprechpartnerLieferant} onChange={set('ansprechpartnerLieferant')} />
          </label>
        </div>

        <div className="ts-grid">
          {/* Linke Spalte: Auswahl */}
          <div className="ts-col">
            <div className="gv-section-title">Schnitt & Modell</div>
            <Radio label="Ausschnitt" opts={AUSSCHNITT} value={form.ausschnitt} onChange={set('ausschnitt')} />
            <Radio label="Ärmel"      opts={AERMEL}     value={form.aermel}     onChange={set('aermel')} />
            <Radio label="Passform"   opts={PASSFORM}   value={form.passform}   onChange={set('passform')} />

            <div className="ts-inline-fields">
              <label>Farbe
                <input className="gv-input" value={form.farbe} onChange={set('farbe')} placeholder="z. B. Schwarz / #000000" />
              </label>
              <label>Material
                <input className="gv-input" value={form.material} onChange={set('material')} placeholder="z. B. 100% Baumwolle, 180 g/m²" />
              </label>
              <label>Artikel-Nr.
                <input className="gv-input" value={form.artikelNr} onChange={set('artikelNr')} placeholder="optional" />
              </label>
            </div>

            <div className="gv-section-title" style={{ marginTop: '1rem' }}>Mengen — Kinder</div>
            <table className="ts-size-table">
              <thead><tr>{SIZES_KIDS.map((s) => <th key={s}>{s}</th>)}<th>Σ</th></tr></thead>
              <tbody><tr>
                {SIZES_KIDS.map((s) => (
                  <td key={s}><input value={form.mengenKids[s] || ''} onChange={(e) => setMenge('mengenKids', s, e.target.value)} /></td>
                ))}
                <td className="ts-sum">{totalKids}</td>
              </tr></tbody>
            </table>

            <div className="gv-section-title" style={{ marginTop: '0.75rem' }}>Mengen — Erwachsene</div>
            <table className="ts-size-table">
              <thead><tr>{SIZES_ADULT.map((s) => <th key={s}>{s}</th>)}<th>Σ</th></tr></thead>
              <tbody><tr>
                {SIZES_ADULT.map((s) => (
                  <td key={s}><input value={form.mengenAdult[s] || ''} onChange={(e) => setMenge('mengenAdult', s, e.target.value)} /></td>
                ))}
                <td className="ts-sum">{totalAdult}</td>
              </tr></tbody>
            </table>
            <div className="ts-total">Gesamt: <strong>{totalGesamt}</strong> Stück</div>

            {/* Preise */}
            <div className="gv-section-title" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Preise</span>
              <span style={{ display: 'flex', gap: '0.25rem' }}>
                {WAEHRUNGEN.map((w) => (
                  <button key={w} type="button" className={`ts-radio sm ${form.waehrung === w ? 'active' : ''}`}
                    onClick={() => setForm((p) => ({ ...p, waehrung: w }))}>{w}</button>
                ))}
              </span>
            </div>
            <div className="ts-preis-grid">
              <label>Stückpreis Kinder
                <div className="ts-preis-input">
                  <input className="gv-input" type="number" min="0" step="0.01" value={form.preisKids} onChange={set('preisKids')} placeholder="0.00" />
                  <span>{sym}</span>
                </div>
                {parseFloat(form.preisKids || 0) > 0 && totalKids > 0 && (
                  <span className="ts-preis-sum">= {fmt(summeKids)} {sym}</span>
                )}
              </label>
              <label>Stückpreis Erwachsene
                <div className="ts-preis-input">
                  <input className="gv-input" type="number" min="0" step="0.01" value={form.preisAdult} onChange={set('preisAdult')} placeholder="0.00" />
                  <span>{sym}</span>
                </div>
                {parseFloat(form.preisAdult || 0) > 0 && totalAdult > 0 && (
                  <span className="ts-preis-sum">= {fmt(summeAdult)} {sym}</span>
                )}
              </label>
            </div>
            {hasPreis && (
              <div className="ts-gesamtpreis">
                <span>Gesamtpreis</span>
                <strong>{fmt(gesamtpreis)} {sym}</strong>
                <span className="ts-gesamtpreis-hint">{totalGesamt} Stück gesamt</span>
              </div>
            )}
          </div>

          {/* Rechte Spalte: Vorschau + Veredelung + Dateien */}
          <div className="ts-col">
            <div className="gv-section-title">Vorschau · Logo-Anker ziehen zum Positionieren</div>
            <div className="ts-preview ts-preview-dual">
              <TshirtPreviewSvg ausschnitt={form.ausschnitt} aermel={form.aermel} farbe={form.farbe}
                veredelungen={form.veredelungen} view="front" width={165} mockup={form.mockupFront}
                draggable onDrag={setPlacement} />
              <TshirtPreviewSvg ausschnitt={form.ausschnitt} aermel={form.aermel} farbe={form.farbe}
                veredelungen={form.veredelungen} view="back" width={165} mockup={form.mockupBack}
                draggable onDrag={setPlacement} />
            </div>
            <div className="ts-preview-cap">{form.ausschnitt} · {form.aermel} · {form.passform} — Anker mit der Maus verschiebbar</div>

            {/* Eigene T-Shirt-Vorlage (ersetzt die Skizze) */}
            <div className="gv-section-title" style={{ marginTop: '0.9rem' }}>Eigene Vorlage (ersetzt die Skizze)</div>
            <input ref={mockFrontRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onMockupPicked('mockupFront')} />
            <input ref={mockBackRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onMockupPicked('mockupBack')} />
            <div className="ts-mockup-grid">
              <div className="ts-mockup-slot">
                <span className="ts-mockup-lbl">Vorderseite</span>
                {form.mockupFront
                  ? <><img src={form.mockupFront} alt="Vorderseite" className="ts-mockup-thumb" /><button type="button" className="ts-mockup-del" onClick={() => removeMockup('mockupFront')}>✕ Entfernen</button></>
                  : <button type="button" className="ts-upload-btn" onClick={() => mockFrontRef.current?.click()}>⬆ Bild hochladen</button>}
              </div>
              <div className="ts-mockup-slot">
                <span className="ts-mockup-lbl">Rückseite</span>
                {form.mockupBack
                  ? <><img src={form.mockupBack} alt="Rückseite" className="ts-mockup-thumb" /><button type="button" className="ts-mockup-del" onClick={() => removeMockup('mockupBack')}>✕ Entfernen</button></>
                  : <button type="button" className="ts-upload-btn" onClick={() => mockBackRef.current?.click()}>⬆ Bild hochladen</button>}
              </div>
            </div>
            <div className="ts-mockup-hint">PNG/JPG/SVG aus Photoshop oder KI. Die Logos werden weiterhin an ihrer Position darüber gelegt.</div>

            <div className="gv-section-title" style={{ marginTop: '1rem' }}>Veredelung (Druck / Stickerei / Flex)</div>
            <input ref={verFileRef} type="file" accept="image/*,.pdf,.ai,.eps,.svg" style={{ display: 'none' }} onChange={onVerFilePicked} />
            <div className="ts-ver-list">
              {POSITIONEN.map((pos) => {
                const ver = form.veredelungen.find((v) => v.pos === pos);
                return (
                  <div key={pos} className={`ts-ver-item ${ver ? 'active' : ''}`}>
                    <label className="ts-ver-head">
                      <input type="checkbox" checked={!!ver} onChange={() => togglePos(pos)} />
                      <span>{pos}</span>
                    </label>
                    {ver && (
                      <div className="ts-ver-detail">
                        <div className="ts-ver-art">
                          {VEREDELUNG.map((a) => (
                            <button key={a} type="button" className={`ts-radio sm ${ver.art === a ? 'active' : ''}`}
                              onClick={() => setVer(pos, 'art', a)}>{a}</button>
                          ))}
                        </div>
                        <input className="gv-input" placeholder="Motiv / Text / Logo-Beschreibung"
                          value={ver.beschreibung || ''} onChange={(e) => setVer(pos, 'beschreibung', e.target.value)} />
                        <div className="ts-ver-maße">
                          <input className="gv-input" placeholder="Breite mm" value={ver.breite || ''} onChange={(e) => setVer(pos, 'breite', e.target.value.replace(/[^0-9]/g, ''))} />
                          <input className="gv-input" placeholder="Höhe mm" value={ver.hoehe || ''} onChange={(e) => setVer(pos, 'hoehe', e.target.value.replace(/[^0-9]/g, ''))} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {ver.datei ? (
                            <span className="gv-pos-inline-file" title={ver.datei.name}>
                              📎 {ver.datei.name.length > 16 ? ver.datei.name.slice(0, 14) + '…' : ver.datei.name}
                              <button className="gv-pos-inline-del" onClick={() => removeVerFile(pos)} title="Entfernen">✕</button>
                            </span>
                          ) : (
                            <button type="button" className="ts-radio sm" onClick={() => triggerVerFile(pos)}>+ Logo / Datei</button>
                          )}
                          {ver.placement && (
                            <button type="button" className="ts-radio sm" onClick={() => resetPlacement(pos)} title="Anker auf Standardposition zurücksetzen">↺ Position</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Allgemeine Designdateien */}
            <div className="gv-section-title" style={{ marginTop: '1rem' }}>Designdateien / Druckvorlagen</div>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.ai,.eps,.svg" style={{ display: 'none' }} onChange={onFilesPicked} />
            <button type="button" className="ts-upload-btn" onClick={() => fileInputRef.current?.click()}>⬆ Dateien auswählen</button>
            {form.dateien.length > 0 && (
              <div className="ts-datei-list">
                {form.dateien.map((d, i) => (
                  <div key={i} className="ts-datei-item">
                    {d.isImage && d.dataUrl
                      ? <img src={d.dataUrl} alt={d.name} className="ts-datei-thumb" />
                      : <span className="ts-datei-icon">📄</span>}
                    <span className="ts-datei-name" title={d.name}>{d.name}</span>
                    <button type="button" className="gv-pos-inline-del" onClick={() => removeDatei(i)} title="Entfernen">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Termine + Bemerkungen */}
        <div className="ts-footer-fields">
          <label>Bestelldatum
            <input className="gv-input" type="date" value={form.bestelldatum} onChange={set('bestelldatum')} />
          </label>
          <label>Wunsch-Lieferdatum
            <input className="gv-input" type="date" value={form.lieferdatum} onChange={set('lieferdatum')} />
          </label>
        </div>
        <label style={{ display: 'block', marginTop: '0.6rem' }}>Bemerkungen
          <textarea className="gv-input" rows="3" value={form.bemerkungen} onChange={set('bemerkungen')}
            placeholder="Sonderwünsche, Veredelungs-Details, Lieferhinweise …" />
        </label>
      </div>
    </div>
  );
}

// --- PDF (eigenständige Druckansicht) ----------------------------------------
export function buildTShirtPdf(form, bestellungId = null) {
  const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const kidsCells = SIZES_KIDS.map((s) => `<td>${esc(form.mengenKids?.[s] || '')}</td>`).join('');
  const adultCells = SIZES_ADULT.map((s) => `<td>${esc(form.mengenAdult?.[s] || '')}</td>`).join('');
  const totalKids = sumMengen(form.mengenKids);
  const totalAdult = sumMengen(form.mengenAdult);
  const totalGesamt = totalKids + totalAdult;
  const sym = curSym(form.waehrung);
  const summeKids = totalKids * parseFloat(form.preisKids || 0);
  const summeAdult = totalAdult * parseFloat(form.preisAdult || 0);
  const gesamtpreis = summeKids + summeAdult;
  const hasPreis = parseFloat(form.preisKids || 0) > 0 || parseFloat(form.preisAdult || 0) > 0;

  const verRows = (form.veredelungen || []).map((v) => `
    <tr>
      <td>${esc(v.pos)}</td><td>${esc(v.art)}</td><td>${esc(v.beschreibung)}</td>
      <td style="text-align:center">${esc(v.breite ? v.breite + ' mm' : '—')}</td>
      <td style="text-align:center">${esc(v.hoehe ? v.hoehe + ' mm' : '—')}</td>
      <td style="text-align:center">${v.datei ? '📎 ' + esc(v.datei.name) : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="6" style="color:#999">— keine Veredelung —</td></tr>';

  // Bilder einbetten: Veredelungs-Logos + allgemeine Designdateien
  const verImgs = (form.veredelungen || []).filter((v) => v.datei?.isImage && v.datei?.dataUrl)
    .map((v) => `<figure><img src="${v.datei.dataUrl}"><figcaption>${esc(v.pos)}</figcaption></figure>`).join('');
  const dateiImgs = (form.dateien || []).filter((d) => d.isImage && d.dataUrl)
    .map((d) => `<figure><img src="${d.dataUrl}"><figcaption>${esc(d.name)}</figcaption></figure>`).join('');
  const dateiOther = (form.dateien || []).filter((d) => !d.isImage)
    .map((d) => `<li>📄 ${esc(d.name)}</li>`).join('');
  const hasImgs = verImgs || dateiImgs;

  const svgFront = tshirtView({ ausschnitt: form.ausschnitt, aermel: form.aermel, farbe: form.farbe, veredelungen: form.veredelungen, view: 'front', width: 120, mockup: form.mockupFront });
  const svgBack = tshirtView({ ausschnitt: form.ausschnitt, aermel: form.aermel, farbe: form.farbe, veredelungen: form.veredelungen, view: 'back', width: 120, mockup: form.mockupBack });
  const preisRows = hasPreis ? `
    <div class="st">Preise</div>
    <table class="opts">
      ${parseFloat(form.preisKids || 0) > 0 ? `<tr><td class="k">Stückpreis Kinder</td><td>${fmt(form.preisKids)} ${sym}  ×  ${totalKids}  =  <strong>${fmt(summeKids)} ${sym}</strong></td></tr>` : ''}
      ${parseFloat(form.preisAdult || 0) > 0 ? `<tr><td class="k">Stückpreis Erwachsene</td><td>${fmt(form.preisAdult)} ${sym}  ×  ${totalAdult}  =  <strong>${fmt(summeAdult)} ${sym}</strong></td></tr>` : ''}
      <tr style="background:#faf6e8;"><td class="k"><strong>Gesamtpreis (${totalGesamt} Stück)</strong></td><td style="font-size:12pt;color:#9a7b16;"><strong>${fmt(gesamtpreis)} ${sym}</strong></td></tr>
    </table>` : '';

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>T-Shirt-Bestellung</title>
<style>
  :root{--gold:#c9a227;--dark:#1a1a2e;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;font-size:10pt;color:var(--dark);background:#ddd;}
  .page{width:210mm;min-height:297mm;background:white;margin:8mm auto;padding:14mm 18mm;box-shadow:0 4px 20px rgba(0,0,0,.25);}
  .ph{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid var(--gold);padding-bottom:5mm;margin-bottom:7mm;}
  .ph h1{font-size:18pt;letter-spacing:1px;}
  .ph .meta{font-size:8pt;color:#666;text-align:right;}
  .st{background:var(--dark);color:#fff;font-size:8pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;margin:6mm 0 3mm;}
  table{width:100%;border-collapse:collapse;font-size:9pt;}
  th,td{border:1px solid #ccc;padding:3px 5px;}
  th{background:#f0f0f0;}
  .sz th,.sz td{text-align:center;}
  .row2{display:flex;gap:8mm;align-items:flex-start;}
  .opts td{padding:4px 6px;} .opts .k{color:#888;width:42%;}
  .imgs{display:flex;flex-wrap:wrap;gap:5mm;}
  .imgs figure{width:55mm;border:1px solid #ddd;border-radius:3px;padding:3mm;text-align:center;}
  .imgs img{max-width:100%;max-height:55mm;object-fit:contain;}
  .imgs figcaption{font-size:7.5pt;color:#777;margin-top:2mm;word-break:break-all;}
  .sig{margin-top:14mm;display:flex;gap:14mm;}
  .sig div{flex:1;border-top:1px solid #333;padding-top:2mm;font-size:8pt;color:#666;text-align:center;}
  @media print{ @page{size:A4;margin:14mm 18mm;} body{background:#fff;} .page{margin:0;box-shadow:none;min-height:0;break-after:page;page-break-after:always;} .page:last-child{break-after:auto;} table,tr,td,th,figure{break-inside:avoid;} }
</style></head><body>
<div class="page">
  <div class="ph">
    <div><h1>T-Shirt-Bestellung</h1><div style="font-size:9pt;color:#666;margin-top:1mm;">${esc(form.besteller) || 'Kampfkunstschule / TDA'}</div></div>
    <div class="meta">${bestellungId ? 'Bestell-Nr. #' + String(bestellungId).padStart(4, '0') + '<br>' : ''}${form.bestelldatum ? 'Datum: ' + esc(form.bestelldatum) + '<br>' : ''}${form.lieferdatum ? 'Lieferung bis: ' + esc(form.lieferdatum) : ''}</div>
  </div>

  <div class="row2">
    <div style="flex:0 0 250px;text-align:center;display:flex;gap:4mm;justify-content:center;">${svgFront}${svgBack}</div>
    <div style="flex:1;">
      <div class="st">Modell & Lieferant</div>
      <table class="opts">
        <tr><td class="k">Ausschnitt</td><td>${esc(form.ausschnitt)}</td></tr>
        <tr><td class="k">Ärmel</td><td>${esc(form.aermel)}</td></tr>
        <tr><td class="k">Passform</td><td>${esc(form.passform)}</td></tr>
        <tr><td class="k">Farbe</td><td>${esc(form.farbe) || '—'}</td></tr>
        <tr><td class="k">Material</td><td>${esc(form.material) || '—'}</td></tr>
        <tr><td class="k">Artikel-Nr.</td><td>${esc(form.artikelNr) || '—'}</td></tr>
        <tr><td class="k">Lieferant</td><td>${esc(form.lieferantFreitext) || '—'}${form.ansprechpartnerLieferant ? ' · ' + esc(form.ansprechpartnerLieferant) : ''}</td></tr>
        <tr><td class="k">Besteller</td><td>${esc(form.besteller) || '—'}${form.ansprechpartnerBesteller ? ' · ' + esc(form.ansprechpartnerBesteller) : ''}</td></tr>
      </table>
    </div>
  </div>

  <div class="st">Mengen — Kinder (Gesamt ${totalKids})</div>
  <table class="sz"><thead><tr>${SIZES_KIDS.map((s) => `<th>${s}</th>`).join('')}<th>Σ</th></tr></thead>
    <tbody><tr>${kidsCells}<td><strong>${totalKids}</strong></td></tr></tbody></table>

  <div class="st">Mengen — Erwachsene (Gesamt ${totalAdult})</div>
  <table class="sz"><thead><tr>${SIZES_ADULT.map((s) => `<th>${s}</th>`).join('')}<th>Σ</th></tr></thead>
    <tbody><tr>${adultCells}<td><strong>${totalAdult}</strong></td></tr></tbody></table>

  ${preisRows}

  <div class="st">Veredelung</div>
  <table><thead><tr><th>Position</th><th>Art</th><th>Motiv / Text</th><th>Breite</th><th>Höhe</th><th>Datei</th></tr></thead>
    <tbody>${verRows}</tbody></table>

  ${dateiOther ? `<div class="st">Weitere Dateien</div><ul style="font-size:9pt;padding-left:6mm;">${dateiOther}</ul>` : ''}

  ${form.bemerkungen ? `<div class="st">Bemerkungen</div><div style="border:1px solid #ccc;border-radius:3px;padding:4mm;font-size:9pt;white-space:pre-wrap;">${esc(form.bemerkungen)}</div>` : ''}

  <div class="sig"><div>Datum / Unterschrift Besteller</div><div>Bestätigung Lieferant</div></div>
</div>
${hasImgs ? `<div class="page"><div class="st">Designvorlagen / Logos</div><div class="imgs">${verImgs}${dateiImgs}</div></div>` : ''}
<script>window.onload=function(){setTimeout(function(){try{window.print()}catch(e){}},500)};</script>
</body></html>`;
}
