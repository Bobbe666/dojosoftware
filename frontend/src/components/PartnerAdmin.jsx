import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import '../styles/PartnerAdmin.css';

const GEO_URL = '/countries-110m.json';

const codeToFlag = (code) =>
  code.toUpperCase().split('').map(c => String.fromCodePoint(c.codePointAt(0) + 127397)).join('');

const NUMERIC_TO_ALPHA2 = {
  '276': 'DE', '40': 'AT', '756': 'CH', '380': 'IT', '250': 'FR',
  '724': 'ES', '620': 'PT', '528': 'NL', '56': 'BE', '616': 'PL',
  '203': 'CZ', '703': 'SK', '348': 'HU', '191': 'HR', '642': 'RO',
  '100': 'BG', '300': 'GR', '792': 'TR', '804': 'UA', '826': 'GB',
  '372': 'IE', '208': 'DK', '752': 'SE', '578': 'NO', '246': 'FI',
  '840': 'US', '124': 'CA', '484': 'MX', '76': 'BR', '32': 'AR',
  '36': 'AU', '554': 'NZ', '392': 'JP', '410': 'KR', '156': 'CN',
  '356': 'IN', '710': 'ZA',
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
  reps.filter(r => r.type === 'country').forEach(r => { countryMap[r.code] = r; });
  const bundeslandMap = {};
  reps.filter(r => r.type === 'bundesland').forEach(r => { bundeslandMap[r.code] = r; });

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
    free: reps.filter(r => r.type === 'country' && r.status === 'free').length,
    occupied: reps.filter(r => r.type === 'country' && r.status === 'occupied').length,
    pending: reps.filter(r => r.type === 'country' && r.status === 'pending').length,
    blFree: reps.filter(r => r.type === 'bundesland' && r.status === 'free').length,
    blOccupied: reps.filter(r => r.type === 'bundesland' && r.status === 'occupied').length,
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
        <div className="pa-stat"><span className="pa-stat-num">{docs.length}</span><span className="pa-stat-lbl">Dokumente</span></div>
      </div>

      {/* Tab bar */}
      <div className="pa-tabs">
        {[
          { id: 'map',   label: '🗺 Weltkarte' },
          { id: 'list',  label: '📋 Liste' },
          { id: 'bl',    label: '🇩🇪 Bundesländer' },
          { id: 'docs',  label: '📄 Dokumente' },
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

      {/* ── BUNDESLAENDER TAB ────────────────────────────────────── */}
      {tab === 'bl' && (
        <div>
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
        </div>
      )}

      {/* ── DOCS TAB ──────────────────────────────────────────────── */}
      {tab === 'docs' && (
        <div>
          <div className="pa-docs-toolbar">
            <button className="pa-btn pa-btn--primary" onClick={() => setShowUpload(true)}>+ Dokument hochladen</button>
          </div>
          {docs.length === 0 ? (
            <div className="pa-empty">Noch keine Dokumente hochgeladen.</div>
          ) : (
            <div className="pa-docs-list">
              {docs.map(doc => (
                <div key={doc.id} className="pa-doc-row">
                  <span className="pa-doc-icon">📄</span>
                  <div className="pa-doc-info">
                    <span className="pa-doc-name">{doc.name_de}</span>
                    <span className="pa-doc-meta">{doc.name_en} · {CATEGORY_LABELS[doc.category] || doc.category} · {doc.is_public ? 'Öffentlich' : 'Intern'}</span>
                    {doc.file_size && <span className="pa-doc-size">{doc.file_size < 1048576 ? `${Math.round(doc.file_size / 1024)} KB` : `${(doc.file_size / 1048576).toFixed(1)} MB`}</span>}
                  </div>
                  <a href={`/api/partner/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer" className="pa-btn pa-btn--ghost pa-btn--sm">↓ Download</a>
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

      {/* Flash */}
      {flash && <div className="pa-flash">{flash}</div>}
    </div>
  );
}
