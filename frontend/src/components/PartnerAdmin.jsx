import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import axios from 'axios';
const PartnerDokumentEditor = lazy(() => import('./PartnerDokumentEditor'));
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Annotation,
} from 'react-simple-maps';
import { geoCentroid } from 'd3-geo';
import '../styles/PartnerAdmin.css';

const GEO_URL     = '/countries-110m.json';
const US_GEO_URL  = '/us-states-10m.json';
const DE_GEO_URL  = '/de-bundeslaender.json';

const codeToFlag = (code) =>
  code.toUpperCase().split('').map(c => String.fromCodePoint(c.codePointAt(0) + 127397)).join('');

const FIPS_TO_STATE = {
  '01':'US-AL','02':'US-AK','04':'US-AZ','05':'US-AR','06':'US-CA',
  '08':'US-CO','09':'US-CT','10':'US-DE','12':'US-FL','13':'US-GA',
  '15':'US-HI','16':'US-ID','17':'US-IL','18':'US-IN','19':'US-IA',
  '20':'US-KS','21':'US-KY','22':'US-LA','23':'US-ME','24':'US-MD',
  '25':'US-MA','26':'US-MI','27':'US-MN','28':'US-MS','29':'US-MO',
  '30':'US-MT','31':'US-NE','32':'US-NV','33':'US-NH','34':'US-NJ',
  '35':'US-NM','36':'US-NY','37':'US-NC','38':'US-ND','39':'US-OH',
  '40':'US-OK','41':'US-OR','42':'US-PA','44':'US-RI','45':'US-SC',
  '46':'US-SD','47':'US-TN','48':'US-TX','49':'US-UT','50':'US-VT',
  '51':'US-VA','53':'US-WA','54':'US-WV','55':'US-WI','56':'US-WY',
};

const NUMERIC_TO_ALPHA2 = {
  '4':'AF','8':'AL','12':'DZ','24':'AO','31':'AZ','32':'AR','36':'AU',
  '40':'AT','50':'BD','51':'AM','56':'BE','64':'BT','68':'BO','70':'BA',
  '72':'BW','76':'BR','84':'BZ','90':'SB','96':'BN','100':'BG','104':'MM',
  '108':'BI','112':'BY','116':'KH','120':'CM','124':'CA','140':'CF','144':'LK',
  '148':'TD','152':'CL','156':'CN','158':'TW','170':'CO','178':'CG','180':'CD',
  '188':'CR','191':'HR','192':'CU','196':'CY','203':'CZ','204':'BJ','208':'DK',
  '214':'DO','218':'EC','222':'SV','226':'GQ','231':'ET','232':'ER','233':'EE',
  '242':'FJ','246':'FI','250':'FR','262':'DJ','266':'GA','268':'GE','270':'GM',
  '275':'PS','276':'DE','288':'GH','300':'GR','320':'GT','324':'GN','328':'GY',
  '332':'HT','340':'HN','348':'HU','352':'IS','356':'IN','360':'ID','364':'IR',
  '368':'IQ','372':'IE','376':'IL','380':'IT','384':'CI','388':'JM','392':'JP',
  '398':'KZ','400':'JO','404':'KE','408':'KP','410':'KR','414':'KW','417':'KG',
  '418':'LA','422':'LB','426':'LS','428':'LV','430':'LR','434':'LY','440':'LT',
  '442':'LU','450':'MG','454':'MW','458':'MY','466':'ML','478':'MR','484':'MX',
  '496':'MN','498':'MD','499':'ME','504':'MA','508':'MZ','512':'OM','516':'NA',
  '524':'NP','528':'NL','548':'VU','554':'NZ','558':'NI','562':'NE','566':'NG',
  '578':'NO','586':'PK','591':'PA','598':'PG','600':'PY','604':'PE','608':'PH',
  '616':'PL','620':'PT','624':'GW','626':'TL','634':'QA','642':'RO','643':'RU',
  '646':'RW','682':'SA','686':'SN','688':'RS','694':'SL','703':'SK','704':'VN',
  '705':'SI','706':'SO','710':'ZA','716':'ZW','724':'ES','728':'SS','729':'SD',
  '740':'SR','748':'SZ','752':'SE','756':'CH','760':'SY','762':'TJ','764':'TH',
  '768':'TG','780':'TT','784':'AE','788':'TN','792':'TR','795':'TM','800':'UG',
  '804':'UA','807':'MK','818':'EG','826':'GB','834':'TZ','840':'US','854':'BF',
  '858':'UY','860':'UZ','862':'VE','887':'YE','894':'ZM',
};

const STATUS_COLOR = { occupied: '#ef4444', pending: '#f59e0b', free: '#22c55e' };

const BUNDESLAENDER = [
  { code: 'DE-BW', name: 'Baden-Württemberg' },
  { code: 'DE-BY', name: 'Bayern' },
  { code: 'DE-BE', name: 'Berlin' },
  { code: 'DE-BB', name: 'Brandenburg' },
  { code: 'DE-HB', name: 'Bremen' },
  { code: 'DE-HH', name: 'Hamburg' },
  { code: 'DE-HE', name: 'Hessen' },
  { code: 'DE-MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'DE-NI', name: 'Niedersachsen' },
  { code: 'DE-NW', name: 'Nordrhein-Westfalen' },
  { code: 'DE-RP', name: 'Rheinland-Pfalz' },
  { code: 'DE-SL', name: 'Saarland' },
  { code: 'DE-SN', name: 'Sachsen' },
  { code: 'DE-ST', name: 'Sachsen-Anhalt' },
  { code: 'DE-SH', name: 'Schleswig-Holstein' },
  { code: 'DE-TH', name: 'Thüringen' },
];

const CATEGORY_LABELS = { info: 'Informationen', contract: 'Verträge', application: 'Bewerbungsunterlagen', other: 'Sonstiges' };

function EditRepModal({ rep, onSave, onClose }) {
  const [form, setForm] = useState({
    status: rep.status || 'free',
    rep_name: rep.rep_name || '',
    rep_email: rep.rep_email || '',
    rep_website: rep.rep_website || '',
    notes: rep.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`/partner/admin/representatives/${rep.id}`, form);
      onSave({ ...rep, ...form });
    } catch (e) {
      alert('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div className="pa-modal" onClick={e => e.stopPropagation()}>
        <div className="pa-modal-head">
          <span className="pa-modal-flag">{rep.type === 'country' ? codeToFlag(rep.code) : '🗺'}</span>
          <div>
            <div className="pa-modal-title">{rep.name_de}</div>
            <div className="pa-modal-sub">{rep.name_en} · {rep.code}</div>
          </div>
          <button className="pa-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="pa-modal-body">
          <label className="pa-label">Status</label>
          <select className="pa-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="free">🟢 Verfügbar</option>
            <option value="pending">🟡 In Bearbeitung</option>
            <option value="occupied">🔴 Besetzt</option>
          </select>

          <label className="pa-label">Repräsentant Name</label>
          <input className="pa-input" value={form.rep_name} onChange={e => setForm(f => ({ ...f, rep_name: e.target.value }))} placeholder="Vollständiger Name" />

          <label className="pa-label">E-Mail</label>
          <input className="pa-input" type="email" value={form.rep_email} onChange={e => setForm(f => ({ ...f, rep_email: e.target.value }))} placeholder="email@beispiel.de" />

          <label className="pa-label">Website</label>
          <input className="pa-input" value={form.rep_website} onChange={e => setForm(f => ({ ...f, rep_website: e.target.value }))} placeholder="https://..." />

          <label className="pa-label">Notizen</label>
          <textarea className="pa-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
        </div>
        <div className="pa-modal-footer">
          <button className="pa-btn pa-btn--ghost" onClick={onClose}>Abbrechen</button>
          <button className="pa-btn pa-btn--primary" onClick={handleSave} disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  );
}

function UploadDocModal({ onUploaded, onClose }) {
  const [form, setForm] = useState({ name_de: '', name_en: '', description_de: '', description_en: '', category: 'info', is_public: '1' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const handleUpload = async () => {
    if (!file || !form.name_de || !form.name_en) { alert('Datei, Name DE und Name EN sind Pflichtfelder'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    try {
      await axios.post('/partner/admin/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onUploaded();
      onClose();
    } catch (e) {
      alert('Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div className="pa-modal" onClick={e => e.stopPropagation()}>
        <div className="pa-modal-head">
          <span className="pa-modal-flag">📄</span>
          <div><div className="pa-modal-title">Dokument hochladen</div></div>
          <button className="pa-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="pa-modal-body">
          <label className="pa-label">Datei (PDF/Word/Bild, max. 20 MB)</label>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0])} className="pa-file-input" />

          <label className="pa-label">Name (Deutsch) *</label>
          <input className="pa-input" value={form.name_de} onChange={e => setForm(f => ({ ...f, name_de: e.target.value }))} placeholder="z.B. Bewerbungsformular" />

          <label className="pa-label">Name (Englisch) *</label>
          <input className="pa-input" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} placeholder="e.g. Application Form" />

          <label className="pa-label">Beschreibung (DE)</label>
          <input className="pa-input" value={form.description_de} onChange={e => setForm(f => ({ ...f, description_de: e.target.value }))} />

          <label className="pa-label">Beschreibung (EN)</label>
          <input className="pa-input" value={form.description_en} onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))} />

          <div className="pa-row">
            <div>
              <label className="pa-label">Kategorie</label>
              <select className="pa-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="pa-label">Sichtbarkeit</label>
              <select className="pa-select" value={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.value }))}>
                <option value="1">Öffentlich</option>
                <option value="0">Intern</option>
              </select>
            </div>
          </div>
        </div>
        <div className="pa-modal-footer">
          <button className="pa-btn pa-btn--ghost" onClick={onClose}>Abbrechen</button>
          <button className="pa-btn pa-btn--primary" onClick={handleUpload} disabled={uploading}>{uploading ? 'Hochladen…' : 'Hochladen'}</button>
        </div>
      </div>
    </div>
  );
}

export default function PartnerAdmin() {
  const [tab, setTab] = useState('map');
  const [reps, setReps] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editRep, setEditRep] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [showDocEditor, setShowDocEditor] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [flash, setFlash] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, dRes] = await Promise.all([
        axios.get('/partner/admin/representatives'),
        axios.get('/partner/admin/documents'),
      ]);
      if (rRes.data?.success) setReps(rRes.data.representatives);
      if (dRes.data?.success) setDocs(dRes.data.documents);
    } catch (e) {
      console.error('PartnerAdmin load:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(null), 2000); };

  const countryMap = {};
  const bundeslandMap = {};
  const usStateMap = {};
  reps.forEach(r => {
    if (r.type === 'country')    countryMap[r.code]    = r;
    if (r.type === 'bundesland') bundeslandMap[r.code] = r;
    if (r.type === 'us_state')   usStateMap[r.code]    = r;
  });

  const getCountryColor = (geo) => {
    const numId = String(geo.id);
    const alpha2 = NUMERIC_TO_ALPHA2[numId] || NUMERIC_TO_ALPHA2[numId.padStart(3, '0')];
    if (!alpha2) return 'rgba(255,255,255,0.07)';
    const rep = countryMap[alpha2];
    if (!rep) return 'rgba(255,255,255,0.07)';
    return STATUS_COLOR[rep.status] || 'rgba(255,255,255,0.07)';
  };

  const handleMapClick = (geo) => {
    const numId = String(geo.id);
    const alpha2 = NUMERIC_TO_ALPHA2[numId] || NUMERIC_TO_ALPHA2[numId.padStart(3, '0')];
    const rep = alpha2 ? countryMap[alpha2] : null;
    if (rep) setEditRep(rep);
  };

  const handleCountryHover = (geo, evt) => {
    const numId = String(geo.id);
    const alpha2 = NUMERIC_TO_ALPHA2[numId] || NUMERIC_TO_ALPHA2[numId.padStart(3, '0')];
    const rep = alpha2 ? countryMap[alpha2] : null;
    if (!rep) { setTooltip(null); return; }
    setTooltip({ name: rep.name_de, status: rep.status, rep, x: evt.clientX, y: evt.clientY });
  };

  const handleRepSave = (updated) => {
    setReps(prev => prev.map(r => r.id === updated.id ? updated : r));
    setEditRep(null);
    showFlash(`✓ ${updated.name_de} gespeichert`);
  };

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`Dokument "${doc.name_de}" wirklich löschen?`)) return;
    setDeleting(doc.id);
    try {
      await axios.delete(`/partner/admin/documents/${doc.id}`);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      showFlash('✓ Dokument gelöscht');
    } catch { alert('Löschen fehlgeschlagen'); }
    finally { setDeleting(null); }
  };

  const filteredReps = reps.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    free:      reps.filter(r => r.type === 'country'    && r.status === 'free').length,
    occupied:  reps.filter(r => r.type === 'country'    && r.status === 'occupied').length,
    pending:   reps.filter(r => r.type === 'country'    && r.status === 'pending').length,
    blFree:    reps.filter(r => r.type === 'bundesland' && r.status === 'free').length,
    blOccupied:reps.filter(r => r.type === 'bundesland' && r.status === 'occupied').length,
    usFree:    reps.filter(r => r.type === 'us_state'   && r.status === 'free').length,
    usOccupied:reps.filter(r => r.type === 'us_state'   && r.status === 'occupied').length,
  };

  if (loading) return <div className="pa-loading"><div className="pa-spinner" />Lade Partner-Daten…</div>;

  return (
    <div className="pa-root">
      {/* Stats row */}
      <div className="pa-stats">
        <div className="pa-stat"><span className="pa-stat-num pa-stat--green">{stats.free}</span><span className="pa-stat-lbl">Länder frei</span></div>
        <div className="pa-stat"><span className="pa-stat-num pa-stat--red">{stats.occupied}</span><span className="pa-stat-lbl">Länder besetzt</span></div>
        {stats.pending > 0 && <div className="pa-stat"><span className="pa-stat-num pa-stat--gold">{stats.pending}</span><span className="pa-stat-lbl">In Bearbeitung</span></div>}
        <div className="pa-stat"><span className="pa-stat-num pa-stat--green">{stats.blFree}</span><span className="pa-stat-lbl">Bundesländer frei</span></div>
        <div className="pa-stat"><span className="pa-stat-num pa-stat--red">{stats.blOccupied}</span><span className="pa-stat-lbl">Bundesländer besetzt</span></div>
        <div className="pa-stat"><span className="pa-stat-num pa-stat--green">{stats.usFree}</span><span className="pa-stat-lbl">US-States frei</span></div>
        <div className="pa-stat"><span className="pa-stat-num pa-stat--red">{stats.usOccupied}</span><span className="pa-stat-lbl">US-States besetzt</span></div>
        <div className="pa-stat"><span className="pa-stat-num">{docs.length}</span><span className="pa-stat-lbl">Dokumente</span></div>
      </div>

      {/* Tab bar */}
      <div className="pa-tabs">
        {[
          { id: 'map',      label: '🗺 Weltkarte' },
          { id: 'list',     label: '📋 Liste' },
          { id: 'us_states',label: '🇺🇸 US-Bundesstaaten' },
          { id: 'bl',       label: '🇩🇪 Bundesländer' },
          { id: 'docs',     label: '📄 Dokumente' },
        ].map(t => (
          <button key={t.id} className={`pa-tab${tab === t.id ? ' pa-tab--active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ── MAP TAB ──────────────────────────────────────────────── */}
      {tab === 'map' && (
        <div>
          <p className="pa-map-hint">Klicke auf ein Land um es zu bearbeiten. Grün = frei, Rot = besetzt, Gelb = in Bearbeitung.</p>
          <div className="pa-legend">
            {[['#22c55e','Frei'],['#ef4444','Besetzt'],['#f59e0b','In Bearbeitung'],['rgba(255,255,255,0.15)','Nicht erfasst']].map(([c,l]) => (
              <span key={l} className="pa-legend-item"><span className="pa-legend-dot" style={{ background: c }} />{l}</span>
            ))}
          </div>
          <div className="pa-map-wrap">
            <ComposableMap projectionConfig={{ scale: 147 }} style={{ width: '100%', height: 'auto' }}>
              <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={8}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const color = getCountryColor(geo);
                      const numId = String(geo.id);
                      const alpha2 = NUMERIC_TO_ALPHA2[numId] || NUMERIC_TO_ALPHA2[numId.padStart(3, '0')];
                      const rep = alpha2 ? countryMap[alpha2] : null;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={color}
                          stroke="rgba(255,255,255,0.08)"
                          strokeWidth={0.5}
                          style={{
                            default: { outline: 'none', fillOpacity: rep ? 0.85 : 0.25 },
                            hover: { outline: 'none', fillOpacity: 1, cursor: rep ? 'pointer' : 'default' },
                            pressed: { outline: 'none' },
                          }}
                          onClick={() => handleMapClick(geo)}
                          onMouseEnter={(evt) => handleCountryHover(geo, evt)}
                          onMouseLeave={() => setTooltip(null)}
                          onMouseMove={(evt) => tooltip && setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : null)}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          </div>
          {tooltip && (
            <div className="pa-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}>
              <span className="pa-tooltip-name">{tooltip.name}</span>
              <span className={`pa-tooltip-status pa-tooltip-status--${tooltip.status}`}>
                {tooltip.status === 'occupied' ? 'Besetzt' : tooltip.status === 'pending' ? 'In Bearbeitung' : 'Verfügbar'}
              </span>
              {tooltip.rep?.rep_name && <span className="pa-tooltip-rep">{tooltip.rep.rep_name}</span>}
            </div>
          )}
        </div>
      )}

      {/* ── LIST TAB ──────────────────────────────────────────────── */}
      {tab === 'list' && (
        <div>
          <div className="pa-filters">
            <select className="pa-select-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">Alle Typen</option>
              <option value="country">Länder</option>
              <option value="bundesland">Bundesländer</option>
            </select>
            <select className="pa-select-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">Alle Status</option>
              <option value="free">Frei</option>
              <option value="occupied">Besetzt</option>
              <option value="pending">In Bearbeitung</option>
            </select>
            <span className="pa-filter-count">{filteredReps.length} Einträge</span>
          </div>
          <div className="pa-rep-grid">
            {filteredReps.map(rep => (
              <div key={rep.id} className={`pa-rep-card pa-rep-card--${rep.status}`} onClick={() => setEditRep(rep)}>
                <span className="pa-rep-flag">{rep.type === 'country' ? codeToFlag(rep.code) : '🗺'}</span>
                <div className="pa-rep-info">
                  <span className="pa-rep-name">{rep.name_de}</span>
                  {rep.rep_name && <span className="pa-rep-person">{rep.rep_name}</span>}
                  {rep.rep_email && <span className="pa-rep-email">{rep.rep_email}</span>}
                </div>
                <span className={`pa-rep-badge pa-rep-badge--${rep.status}`}>
                  {rep.status === 'occupied' ? 'Besetzt' : rep.status === 'pending' ? 'Ausstehend' : 'Frei'}
                </span>
                <span className="pa-rep-edit-hint">✏</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── US STATES TAB ────────────────────────────────────────── */}
      {tab === 'us_states' && (
        <div>
          <p className="pa-map-hint">Klicke auf einen Bundesstaat um ihn zu bearbeiten.</p>
          <div className="pa-map-wrap pa-map-wrap--us">
            <ComposableMap projection="geoAlbersUsa" style={{ width: '100%', height: 'auto' }}>
              <Geographies geography={US_GEO_URL}>
                {({ geographies }) => geographies.map((geo) => {
                  const code  = FIPS_TO_STATE[geo.id];
                  const rep   = code ? usStateMap[code] : null;
                  const fill  = rep ? STATUS_COLOR[rep.status] : 'rgba(255,255,255,0.18)';
                  const abbr  = code ? code.replace('US-', '') : '';
                  const centroid = geoCentroid(geo);
                  return (
                    <g key={geo.rsmKey}>
                      <Geography
                        geography={geo}
                        fill={fill}
                        stroke="rgba(0,0,0,0.3)"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: 'none', fillOpacity: 1 },
                          hover:   { outline: 'none', fillOpacity: 0.75, cursor: rep ? 'pointer' : 'default' },
                          pressed: { outline: 'none' },
                        }}
                        onClick={() => rep && setEditRep(rep)}
                        onMouseEnter={(evt) => rep && setTooltip({ name: rep.name_de, status: rep.status, rep, x: evt.clientX, y: evt.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                        onMouseMove={(evt) => setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : null)}
                      />
                      {abbr && (
                        <Annotation subject={centroid} dx={0} dy={0} connectorProps={{}}>
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            style={{ fontSize: 7, fontWeight: 700, fill: '#000', pointerEvents: 'none', userSelect: 'none' }}
                          >{abbr}</text>
                        </Annotation>
                      )}
                    </g>
                  );
                })}
              </Geographies>
            </ComposableMap>
          </div>
          <div className="pa-rep-grid">
            {Object.values(usStateMap).sort((a, b) => a.sort_order - b.sort_order).map(rep => (
              <div key={rep.id} className={`pa-rep-card pa-rep-card--${rep.status}`} onClick={() => setEditRep(rep)}>
                <div className="pa-rep-info">
                  <span className="pa-rep-name">{rep.name_de}</span>
                  {rep.rep_name && <span className="pa-rep-person">{rep.rep_name}</span>}
                </div>
                <span className={`pa-rep-badge pa-rep-badge--${rep.status}`}>
                  {rep.status === 'occupied' ? 'Besetzt' : rep.status === 'pending' ? 'Ausstehend' : 'Frei'}
                </span>
                <span className="pa-rep-edit-hint">✏</span>
              </div>
            ))}
          </div>
          {tooltip && (
            <div className="pa-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}>
              <span className="pa-tooltip-name">{tooltip.name}</span>
              <span className={`pa-tooltip-status pa-tooltip-status--${tooltip.status}`}>
                {tooltip.status === 'occupied' ? 'Besetzt' : tooltip.status === 'pending' ? 'In Bearbeitung' : 'Verfügbar'}
              </span>
              {tooltip.rep?.rep_name && <span className="pa-tooltip-rep">{tooltip.rep.rep_name}</span>}
            </div>
          )}
        </div>
      )}

      {/* ── BUNDESLAENDER TAB ────────────────────────────────────── */}
      {tab === 'bl' && (
        <div>
          <p className="pa-map-hint">Klicke auf ein Bundesland um es zu bearbeiten.</p>
          <div className="pa-map-wrap pa-map-wrap--de">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 2600, center: [10.45, 51.15] }}
              style={{ width: '100%', height: 'auto' }}
            >
              <Geographies geography={DE_GEO_URL}>
                {({ geographies }) => geographies.map((geo) => {
                  const code     = geo.properties?.id;
                  const rep      = code ? bundeslandMap[code] : null;
                  const fill     = rep ? STATUS_COLOR[rep.status] : 'rgba(255,255,255,0.18)';
                  const abbr     = code ? code.replace('DE-', '') : '';
                  const centroid = geoCentroid(geo);
                  return (
                    <g key={geo.rsmKey}>
                      <Geography
                        geography={geo}
                        fill={fill}
                        stroke="rgba(0,0,0,0.35)"
                        strokeWidth={0.8}
                        style={{
                          default: { outline: 'none', fillOpacity: 1 },
                          hover:   { outline: 'none', fillOpacity: 0.75, cursor: rep ? 'pointer' : 'default' },
                          pressed: { outline: 'none' },
                        }}
                        onClick={() => rep && setEditRep(rep)}
                        onMouseEnter={(evt) => rep && setTooltip({ name: rep.name_de, status: rep.status, rep, x: evt.clientX, y: evt.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                        onMouseMove={(evt) => setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : null)}
                      />
                      {abbr && (
                        <Annotation subject={centroid} dx={0} dy={0} connectorProps={{}}>
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            style={{ fontSize: 9, fontWeight: 700, fill: '#000', pointerEvents: 'none', userSelect: 'none' }}
                          >{abbr}</text>
                        </Annotation>
                      )}
                    </g>
                  );
                })}
              </Geographies>
            </ComposableMap>
          </div>
          <div className="pa-rep-grid">
            {BUNDESLAENDER.map(bl => {
              const rep = bundeslandMap[bl.code];
              const status = rep?.status || 'free';
              return (
                <div key={bl.code} className={`pa-rep-card pa-rep-card--${status}`} onClick={() => rep && setEditRep(rep)} style={{ cursor: rep ? 'pointer' : 'default' }}>
                  <span className="pa-rep-flag">🗺</span>
                  <div className="pa-rep-info">
                    <span className="pa-rep-name">{bl.name}</span>
                    {rep?.rep_name && <span className="pa-rep-person">{rep.rep_name}</span>}
                  </div>
                  <span className={`pa-rep-badge pa-rep-badge--${status}`}>
                    {status === 'occupied' ? 'Besetzt' : status === 'pending' ? 'Ausstehend' : 'Frei'}
                  </span>
                  {rep && <span className="pa-rep-edit-hint">✏</span>}
                </div>
              );
            })}
          </div>
          {tooltip && (
            <div className="pa-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}>
              <span className="pa-tooltip-name">{tooltip.name}</span>
              <span className={`pa-tooltip-status pa-tooltip-status--${tooltip.status}`}>
                {tooltip.status === 'occupied' ? 'Besetzt' : tooltip.status === 'pending' ? 'In Bearbeitung' : 'Verfügbar'}
              </span>
              {tooltip.rep?.rep_name && <span className="pa-tooltip-rep">{tooltip.rep.rep_name}</span>}
            </div>
          )}
        </div>
      )}

      {/* ── DOCS TAB ──────────────────────────────────────────────── */}
      {tab === 'docs' && (
        <div>
          <div className="pa-docs-toolbar" style={{ display: 'flex', gap: 8 }}>
            <button className="pa-btn pa-btn--primary" onClick={() => { setEditDoc(null); setShowDocEditor(true); }}>✏️ Dokument erstellen</button>
            <button className="pa-btn pa-btn--ghost" onClick={() => setShowUpload(true)}>↑ Datei hochladen</button>
          </div>
          {docs.length === 0 ? (
            <div className="pa-empty">Noch keine Dokumente vorhanden.</div>
          ) : (
            <div className="pa-docs-list">
              {docs.map(doc => (
                <div key={doc.id} className="pa-doc-row">
                  <span className="pa-doc-icon">{doc.source === 'editor' ? '🖊️' : '📄'}</span>
                  <div className="pa-doc-info">
                    <span className="pa-doc-name">{doc.name_de}</span>
                    <span className="pa-doc-meta">
                      {doc.name_en} · {CATEGORY_LABELS[doc.category] || doc.category} · {doc.is_public ? 'Öffentlich' : 'Intern'}
                      {doc.source === 'editor' && <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'var(--color-gold, #ffd700)' }}>● Editor</span>}
                    </span>
                    {doc.file_size > 0 && <span className="pa-doc-size">{doc.file_size < 1048576 ? `${Math.round(doc.file_size / 1024)} KB` : `${(doc.file_size / 1048576).toFixed(1)} MB`}</span>}
                  </div>
                  {doc.source === 'editor' ? (
                    <>
                      <button className="pa-btn pa-btn--ghost pa-btn--sm" onClick={() => { setEditDoc(doc); setShowDocEditor(true); }}>✏️ Bearbeiten</button>
                      <button className="pa-btn pa-btn--ghost pa-btn--sm" onClick={async () => {
                        try {
                          const res = await axios.get(`/partner/admin/documents/${doc.id}/pdf`, { responseType: 'blob' });
                          const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                          const a = document.createElement('a'); a.href = url; a.download = `${doc.name_de}.pdf`; a.click();
                          URL.revokeObjectURL(url);
                        } catch { alert('PDF-Fehler'); }
                      }}>↓ PDF</button>
                    </>
                  ) : (
                    <a href={`/api/partner/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer" className="pa-btn pa-btn--ghost pa-btn--sm">↓ Download</a>
                  )}
                  <button className="pa-btn pa-btn--danger pa-btn--sm" onClick={() => handleDeleteDoc(doc)} disabled={deleting === doc.id}>
                    {deleting === doc.id ? '…' : '🗑'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {editRep && <EditRepModal rep={editRep} onSave={handleRepSave} onClose={() => setEditRep(null)} />}
      {showUpload && <UploadDocModal onUploaded={load} onClose={() => setShowUpload(false)} />}
      {showDocEditor && (
        <Suspense fallback={null}>
          <PartnerDokumentEditor
            doc={editDoc}
            onSaved={load}
            onClose={() => { setShowDocEditor(false); setEditDoc(null); }}
          />
        </Suspense>
      )}

      {/* Flash */}
      {flash && <div className="pa-flash">{flash}</div>}
    </div>
  );
}
