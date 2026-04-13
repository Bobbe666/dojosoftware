/**
 * TrainerPersonal.jsx
 * ===================
 * Trainer-Personalverwaltung: Trainer aus der Kursverwaltung,
 * erweiterte Stammdaten, Kursverknüpfung und Dokumentenverwaltung
 * (Trainervereinbarung + Infoblatt) mit PDF-Generator.
 */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { DatenContext } from '@shared/DatenContext.jsx';
import '../styles/TrainerPersonal.css';

const MONATSNAMEN = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const STATUS_LABELS = { aktiv: 'Aktiv', inaktiv: 'Inaktiv', pausiert: 'Pausiert' };
const STATUS_CLASS  = { aktiv: 'tp-badge--aktiv', inaktiv: 'tp-badge--inaktiv', pausiert: 'tp-badge--pausiert' };
const DOK_STATUS    = { erstellt: 'Erstellt', versendet: 'Versendet', unterschrieben: 'Unterschrieben' };
const DOK_STATUS_CL = { erstellt: 'tp-dok-status--erstellt', versendet: 'tp-dok-status--versendet', unterschrieben: 'tp-dok-status--unterschrieben' };

function Field({ label, children }) {
  return (
    <div className="tp-field">
      <label className="tp-field-label">{label}</label>
      {children}
    </div>
  );
}

export default function TrainerPersonal() {
  // Trainerliste aus DatenContext (dieselbe Quelle wie Kursverwaltung)
  const { trainer: trainerListe, ladeAlleDaten } = useContext(DatenContext);
  const navigate = useNavigate();

  const [selected, setSelected]           = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab]         = useState('stamm');
  const [search, setSearch]               = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [editMode, setEditMode]           = useState(false);
  const [editData, setEditData]           = useState({});
  const [saving, setSaving]               = useState(false);
  const [msg, setMsg]                     = useState('');

  // Vergütung
  const now = new Date();
  const [vergMonat, setVergMonat]   = useState(now.getMonth() + 1);
  const [vergJahr, setVergJahr]     = useState(now.getFullYear());
  const [vergData, setVergData]     = useState(null);
  const [vergLoading, setVergLoading] = useState(false);
  const [vergEdit, setVergEdit]     = useState(false);
  const [vergEditData, setVergEditData] = useState({});

  // Dokument-Generierung
  const [dokTyp, setDokTyp]     = useState('vereinbarung');
  const [dokParams, setDokParams] = useState({
    mitgliedsbeitrag_monatlich: '',
    sachleistungen_jahreswert: '',
    vertragsbeginn: '',
    wettbewerb_radius: '10',
  });
  const [generating, setGenerating] = useState(false);

  // Vergütungsdaten laden
  const ladeVerguetung = useCallback(async (id, monat, jahr) => {
    if (!id) return;
    setVergLoading(true);
    try {
      const res = await axios.get(`/trainer/${id}/verguetung`, {
        params: { monat, jahr }
      });
      setVergData(res.data);
    } catch {
      setVergData(null);
    } finally {
      setVergLoading(false);
    }
  }, []);

  // Trainer-Details laden (ohne /api prefix — axios baseURL ist schon /api)
  const ladeDetails = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const res = await axios.get(`/trainer/${id}`);
      setSelected(res.data);
      setEditData({
        vorname:           res.data.vorname || '',
        nachname:          res.data.nachname || '',
        email:             res.data.email || '',
        telefon:           res.data.telefon || '',
        anschrift:         res.data.anschrift || '',
        geburtsdatum:      res.data.geburtsdatum ? res.data.geburtsdatum.substring(0, 10) : '',
        graduierung:       res.data.graduierung || '',
        steuer_id:         res.data.steuer_id || '',
        einstellungsdatum: res.data.einstellungsdatum ? res.data.einstellungsdatum.substring(0, 10) : '',
        status:            res.data.status || 'aktiv',
        notizen:           res.data.notizen || '',
        stile:             res.data.stile || [],
      });
      setVergEditData({
        stundenlohn:       res.data.stundenlohn || '',
        grundverguetung:   res.data.grundverguetung || '',
        beschaeftigungsart: res.data.beschaeftigungsart || 'Freelancer',
        iban:              res.data.iban || '',
        bic:               res.data.bic || '',
        steuerklasse:      res.data.steuerklasse || '',
      });
      setEditMode(false);
      setVergEdit(false);
      setActiveTab('stamm');
      setMsg('');
    } catch (err) {
      setMsg('Fehler beim Laden der Trainerdaten.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSelect = (t) => {
    if (selected?.trainer_id === t.trainer_id) return;
    ladeDetails(t.trainer_id);
  };

  useEffect(() => {
    if (activeTab === 'verguetung' && selected?.trainer_id) {
      ladeVerguetung(selected.trainer_id, vergMonat, vergJahr);
    }
  }, [activeTab, selected?.trainer_id, vergMonat, vergJahr, ladeVerguetung]);

  // Speichern
  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      await axios.put(`/trainer/${selected.trainer_id}/details`, editData);
      setMsg('Gespeichert.');
      ladeAlleDaten();
      await ladeDetails(selected.trainer_id);
      setEditMode(false);
    } catch (err) {
      setMsg('Fehler beim Speichern: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  // PDF generieren
  const handleGeneratePdf = async () => {
    if (!selected) return;
    setGenerating(true);
    setMsg('');
    try {
      await axios.post(`/trainer/${selected.trainer_id}/dokument`, {
        typ: dokTyp,
        ...dokParams,
      });
      setMsg('PDF erstellt.');
      await ladeDetails(selected.trainer_id);
      setActiveTab('dokumente');
    } catch (err) {
      setMsg('Fehler: ' + (err.response?.data?.error || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleDokStatus = async (dokId, status) => {
    try {
      await axios.put(`/trainer/dokument/${dokId}/status`, { status });
      await ladeDetails(selected.trainer_id);
    } catch {}
  };

  const handleDokLoeschen = async (dokId) => {
    if (!window.confirm('Dokument wirklich löschen?')) return;
    try {
      await axios.delete(`/trainer/dokument/${dokId}`);
      await ladeDetails(selected.trainer_id);
    } catch {}
  };

  const handlePdfOpen = async (filename, trainerId) => {
    try {
      const res = await axios.get(`/trainer/${trainerId}/dokument/${filename}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setMsg({ type: 'error', text: 'PDF konnte nicht geöffnet werden.' });
    }
  };

  // Filter
  const filteredTrainer = (trainerListe || []).filter(t => {
    const name = `${t.vorname} ${t.nachname}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchStatus = !filterStatus || (t.status || 'aktiv') === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="tp-layout">

      {/* ─── LINKE SPALTE: Trainerliste ─────────────────────────── */}
      <aside className="tp-sidebar">
        <div className="tp-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="tp-btn tp-btn--ghost tp-btn--sm"
              onClick={() => navigate('/dashboard')}
              title="Zurück zum Dashboard"
            >
              ← Zurück
            </button>
            <h2 className="tp-sidebar-title">Personal</h2>
          </div>
          <span className="tp-sidebar-count">{filteredTrainer.length}</span>
        </div>

        <div className="tp-sidebar-filters">
          <input
            className="tp-search"
            type="text"
            placeholder="Trainer suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="tp-select-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Alle Status</option>
            <option value="aktiv">Aktiv</option>
            <option value="inaktiv">Inaktiv</option>
            <option value="pausiert">Pausiert</option>
          </select>
        </div>

        {!trainerListe ? (
          <div className="tp-loading">Lade Trainer…</div>
        ) : filteredTrainer.length === 0 ? (
          <div className="tp-empty">Keine Trainer gefunden.</div>
        ) : (
          <ul className="tp-list">
            {filteredTrainer.map(t => {
              const st = t.status || 'aktiv';
              const isActive = selected?.trainer_id === t.trainer_id;
              return (
                <li
                  key={t.trainer_id}
                  className={`tp-list-item${isActive ? ' tp-list-item--active' : ''}`}
                  onClick={() => handleSelect(t)}
                >
                  <div className="tp-list-avatar">
                    {t.vorname?.[0]}{t.nachname?.[0]}
                  </div>
                  <div className="tp-list-info">
                    <div className="tp-list-name">{t.vorname} {t.nachname}</div>
                    <div className="tp-list-meta">
                      {Array.isArray(t.stile) ? t.stile.slice(0, 2).join(', ') : (t.stile || '–')}
                    </div>
                  </div>
                  <span className={`tp-badge ${STATUS_CLASS[st]}`}>{STATUS_LABELS[st]}</span>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* ─── RECHTE SPALTE: Detail ──────────────────────────────── */}
      <main className="tp-detail">
        {!selected && !detailLoading && (
          <div className="tp-detail-empty">
            <div className="tp-detail-empty-icon">👤</div>
            <p>Trainer aus der Liste auswählen</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
              {filteredTrainer.length} Trainer verfügbar
            </p>
          </div>
        )}

        {detailLoading && (
          <div className="tp-detail-empty">
            <div className="tp-loading">Lade Details…</div>
          </div>
        )}

        {selected && !detailLoading && (
          <>
            <div className="tp-detail-header">
              <div className="tp-detail-avatar">
                {selected.vorname?.[0]}{selected.nachname?.[0]}
              </div>
              <div className="tp-detail-title">
                <h2>{selected.vorname} {selected.nachname}</h2>
                <div className="tp-detail-meta">
                  {selected.graduierung && <span>{selected.graduierung}. Dan</span>}
                  {selected.email && <span>{selected.email}</span>}
                  {selected.telefon && <span>{selected.telefon}</span>}
                </div>
              </div>
              <span className={`tp-badge tp-badge--lg ${STATUS_CLASS[selected.status || 'aktiv']}`}>
                {STATUS_LABELS[selected.status || 'aktiv']}
              </span>
            </div>

            {msg && (
              <div className={`tp-msg ${msg.startsWith('Fehler') ? 'tp-msg--error' : 'tp-msg--ok'}`}>
                {msg}
              </div>
            )}

            {/* Tabs */}
            <div className="tp-tabs">
              {[
                { id: 'stamm', label: 'Stammdaten' },
                { id: 'kurse', label: `Kurse (${selected.kurse?.length || 0})` },
                { id: 'verguetung', label: 'Vergütung' },
                { id: 'dokumente', label: `Dokumente (${selected.dokumente?.length || 0})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`tp-tab${activeTab === tab.id ? ' tp-tab--active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── TAB: Stammdaten ────────────────────────────────── */}
            {activeTab === 'stamm' && (
              <div className="tp-tab-content">
                <div className="tp-section-actions">
                  {!editMode ? (
                    <button className="tp-btn tp-btn--secondary" onClick={() => setEditMode(true)}>
                      Bearbeiten
                    </button>
                  ) : (
                    <>
                      <button className="tp-btn tp-btn--primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Speichern…' : 'Speichern'}
                      </button>
                      <button className="tp-btn tp-btn--ghost" onClick={() => { setEditMode(false); setMsg(''); }}>
                        Abbrechen
                      </button>
                    </>
                  )}
                </div>

                <div className="tp-form-grid">
                  {[
                    { field: 'vorname', label: 'Vorname', type: 'text' },
                    { field: 'nachname', label: 'Nachname', type: 'text' },
                    { field: 'email', label: 'E-Mail', type: 'email' },
                    { field: 'telefon', label: 'Telefon', type: 'tel' },
                    { field: 'anschrift', label: 'Anschrift (Straße, PLZ Ort)', type: 'text' },
                    { field: 'geburtsdatum', label: 'Geburtsdatum', type: 'date' },
                    { field: 'graduierung', label: 'Graduierung (Dan)', type: 'text', placeholder: 'z.B. 1' },
                    { field: 'steuer_id', label: 'Steuer-ID', type: 'text' },
                    { field: 'einstellungsdatum', label: 'Trainer seit', type: 'date' },
                  ].map(({ field, label, type, placeholder }) => (
                    <Field key={field} label={label}>
                      {editMode ? (
                        <input
                          className="tp-input"
                          type={type}
                          placeholder={placeholder}
                          value={editData[field] || ''}
                          onChange={e => setEditData(d => ({ ...d, [field]: e.target.value }))}
                        />
                      ) : (
                        <div className="tp-value">
                          {field === 'geburtsdatum' || field === 'einstellungsdatum'
                            ? (selected[field] ? new Date(selected[field]).toLocaleDateString('de-DE') : '–')
                            : field === 'graduierung'
                            ? (selected[field] ? `${selected[field]}. Dan` : '–')
                            : (selected[field] || '–')
                          }
                        </div>
                      )}
                    </Field>
                  ))}

                  <Field label="Status">
                    {editMode ? (
                      <select className="tp-input" value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}>
                        <option value="aktiv">Aktiv</option>
                        <option value="inaktiv">Inaktiv</option>
                        <option value="pausiert">Pausiert</option>
                      </select>
                    ) : (
                      <div className="tp-value">
                        <span className={`tp-badge ${STATUS_CLASS[selected.status || 'aktiv']}`}>
                          {STATUS_LABELS[selected.status || 'aktiv']}
                        </span>
                      </div>
                    )}
                  </Field>

                  <Field label="Stile / Kampfkünste">
                    <div className="tp-value tp-stile">
                      {(selected.stile || []).map(s => (
                        <span key={s} className="tp-stil-badge">{s}</span>
                      ))}
                      {(!selected.stile || selected.stile.length === 0) && <span style={{ opacity: 0.5 }}>–</span>}
                    </div>
                  </Field>

                  <Field label="Notizen">
                    {editMode ? (
                      <textarea
                        className="tp-input tp-textarea"
                        rows={3}
                        value={editData.notizen}
                        onChange={e => setEditData(d => ({ ...d, notizen: e.target.value }))}
                      />
                    ) : (
                      <div className="tp-value">{selected.notizen || '–'}</div>
                    )}
                  </Field>
                </div>
              </div>
            )}

            {/* ── TAB: Kurse ─────────────────────────────────────── */}
            {activeTab === 'kurse' && (
              <div className="tp-tab-content">
                {(!selected.kurse || selected.kurse.length === 0) ? (
                  <div className="tp-empty-state">
                    <p>Diesem Trainer sind noch keine Kurse zugeordnet.</p>
                    <p className="tp-hint">Kurse werden in der Kursverwaltung dem Trainer zugewiesen.</p>
                  </div>
                ) : (
                  <table className="tp-table">
                    <thead>
                      <tr>
                        <th>Kurs / Gruppe</th>
                        <th>Kampfkunst / Stil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.kurse.map(k => (
                        <tr key={k.kurs_id}>
                          <td>{k.gruppenname}</td>
                          <td>{k.stil || '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── TAB: Vergütung ─────────────────────────────────── */}
            {activeTab === 'verguetung' && (
              <div className="tp-tab-content">
                {/* Vergütungs-Einstellungen */}
                <div className="tp-verg-settings">
                  <div className="tp-section-actions">
                    <h3 className="tp-section-title">Vergütungseinstellungen</h3>
                    {!vergEdit ? (
                      <button className="tp-btn tp-btn--secondary" onClick={() => setVergEdit(true)}>
                        Bearbeiten
                      </button>
                    ) : (
                      <>
                        <button className="tp-btn tp-btn--primary" onClick={async () => {
                          try {
                            await axios.put(`/trainer/${selected.trainer_id}/details`, vergEditData);
                            setMsg('Vergütung gespeichert.');
                            await ladeDetails(selected.trainer_id);
                          } catch (e) {
                            setMsg('Fehler: ' + (e.response?.data?.error || e.message));
                          }
                        }}>Speichern</button>
                        <button className="tp-btn tp-btn--ghost" onClick={() => setVergEdit(false)}>Abbrechen</button>
                      </>
                    )}
                  </div>
                  <div className="tp-form-grid">
                    <Field label="Beschäftigungsart">
                      {vergEdit ? (
                        <select className="tp-input" value={vergEditData.beschaeftigungsart}
                          onChange={e => setVergEditData(d => ({ ...d, beschaeftigungsart: e.target.value }))}>
                          <option value="Freelancer">Freelancer</option>
                          <option value="Honorar">Honorar</option>
                          <option value="Angestellt">Angestellt</option>
                          <option value="Minijob">Minijob</option>
                          <option value="Ehrenamt">Ehrenamt</option>
                        </select>
                      ) : (
                        <div className="tp-value">{selected.beschaeftigungsart || 'Freelancer'}</div>
                      )}
                    </Field>
                    <Field label="Stundenlohn (€/h)">
                      {vergEdit ? (
                        <input className="tp-input" type="number" step="0.01" min="0" placeholder="18.50"
                          value={vergEditData.stundenlohn}
                          onChange={e => setVergEditData(d => ({ ...d, stundenlohn: e.target.value }))} />
                      ) : (
                        <div className="tp-value">
                          {selected.stundenlohn ? `€ ${parseFloat(selected.stundenlohn).toFixed(2)} / h` : '–'}
                        </div>
                      )}
                    </Field>
                    <Field label="Grundvergütung (€/Monat)">
                      {vergEdit ? (
                        <input className="tp-input" type="number" step="0.01" min="0" placeholder="500.00"
                          value={vergEditData.grundverguetung}
                          onChange={e => setVergEditData(d => ({ ...d, grundverguetung: e.target.value }))} />
                      ) : (
                        <div className="tp-value">
                          {selected.grundverguetung ? `€ ${parseFloat(selected.grundverguetung).toFixed(2)}` : '–'}
                        </div>
                      )}
                    </Field>
                    <Field label="IBAN">
                      {vergEdit ? (
                        <input className="tp-input" type="text" placeholder="DE12 3456 7890..."
                          value={vergEditData.iban}
                          onChange={e => setVergEditData(d => ({ ...d, iban: e.target.value }))} />
                      ) : (
                        <div className="tp-value">{selected.iban || '–'}</div>
                      )}
                    </Field>
                    <Field label="BIC">
                      {vergEdit ? (
                        <input className="tp-input" type="text" placeholder="COBADEFFXXX"
                          value={vergEditData.bic}
                          onChange={e => setVergEditData(d => ({ ...d, bic: e.target.value }))} />
                      ) : (
                        <div className="tp-value">{selected.bic || '–'}</div>
                      )}
                    </Field>
                    <Field label="Steuerklasse">
                      {vergEdit ? (
                        <select className="tp-input" value={vergEditData.steuerklasse}
                          onChange={e => setVergEditData(d => ({ ...d, steuerklasse: e.target.value }))}>
                          <option value="">–</option>
                          {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      ) : (
                        <div className="tp-value">{selected.steuerklasse || '–'}</div>
                      )}
                    </Field>
                  </div>
                </div>

                {/* Monats-Auswahl */}
                <div className="tp-verg-period">
                  <h3 className="tp-section-title">Stunden-Abrechnung</h3>
                  <div className="tp-verg-period-selectors">
                    <select className="tp-select-sm" value={vergMonat}
                      onChange={e => setVergMonat(parseInt(e.target.value))}>
                      {MONATSNAMEN.slice(1).map((name, i) => (
                        <option key={i+1} value={i+1}>{name}</option>
                      ))}
                    </select>
                    <select className="tp-select-sm" value={vergJahr}
                      onChange={e => setVergJahr(parseInt(e.target.value))}>
                      {[now.getFullYear() - 1, now.getFullYear()].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Monats-Zusammenfassung */}
                {vergLoading ? (
                  <div className="tp-loading">Lade Vergütungsdaten…</div>
                ) : vergData ? (
                  <>
                    <div className="tp-verg-summary">
                      <div className="tp-verg-card">
                        <div className="tp-verg-card-label">Einheiten</div>
                        <div className="tp-verg-card-value">{vergData.monatsStunden?.length || 0}</div>
                      </div>
                      <div className="tp-verg-card">
                        <div className="tp-verg-card-label">Gesamtstunden</div>
                        <div className="tp-verg-card-value">{vergData.totalMonat} h</div>
                      </div>
                      <div className="tp-verg-card tp-verg-card--highlight">
                        <div className="tp-verg-card-label">Berechneter Lohn</div>
                        <div className="tp-verg-card-value">€ {(vergData.lohnMonat || 0).toFixed(2)}</div>
                      </div>
                      {vergData.trainer?.grundverguetung > 0 && (
                        <div className="tp-verg-card">
                          <div className="tp-verg-card-label">Grundvergütung</div>
                          <div className="tp-verg-card-value">€ {parseFloat(vergData.trainer.grundverguetung).toFixed(2)}</div>
                        </div>
                      )}
                    </div>

                    {/* Stunden-Tabelle */}
                    {vergData.monatsStunden?.length > 0 ? (
                      <table className="tp-table">
                        <thead>
                          <tr>
                            <th>Datum</th>
                            <th>Kurs</th>
                            <th>Stunden</th>
                            <th>Status</th>
                            <th>Betrag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vergData.monatsStunden.map(s => (
                            <tr key={s.id}>
                              <td>{new Date(s.datum).toLocaleDateString('de-DE')}</td>
                              <td>{s.kursname}</td>
                              <td>{parseFloat(s.stunden).toFixed(1)} h</td>
                              <td>
                                <span className={`tp-badge ${s.status === 'bestaetigt' ? 'tp-badge--aktiv' : 'tp-badge--pausiert'}`}>
                                  {s.status}
                                </span>
                              </td>
                              <td>€ {(parseFloat(s.stunden) * parseFloat(vergData.trainer.stundenlohn || 0)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="tp-empty-state">
                        <p>Keine Stunden für {MONATSNAMEN[vergMonat]} {vergJahr} erfasst.</p>
                        <p className="tp-hint">Stunden werden über die Trainer-Stunden-Verwaltung erfasst.</p>
                      </div>
                    )}

                    {/* Jahresverlauf */}
                    {vergData.jahresVerlauf?.length > 0 && (
                      <div className="tp-verg-jahres">
                        <h4 className="tp-section-title">Jahresverlauf {vergJahr}</h4>
                        <table className="tp-table">
                          <thead>
                            <tr>
                              <th>Monat</th>
                              <th>Einheiten</th>
                              <th>Stunden</th>
                              <th>Lohn</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vergData.jahresVerlauf.map(row => (
                              <tr key={row.monat}
                                className={row.monat === vergMonat ? 'tp-row--highlight' : ''}>
                                <td>{MONATSNAMEN[row.monat]}</td>
                                <td>{row.anzahl_einheiten}</td>
                                <td>{parseFloat(row.total_stunden).toFixed(1)} h</td>
                                <td>€ {parseFloat(row.berechnet_lohn || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="tp-empty-state">
                    <p>Keine Vergütungsdaten verfügbar.</p>
                    <p className="tp-hint">Stundenlohn unter Vergütungseinstellungen eintragen.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: Dokumente ─────────────────────────────────── */}
            {activeTab === 'dokumente' && (
              <div className="tp-tab-content">

                {/* PDF Creator */}
                <div className="tp-pdf-creator">
                  <h3 className="tp-pdf-title">📄 PDF Creator</h3>
                  <div className="tp-pdf-form">
                    <div className="tp-pdf-typ">
                      <label>
                        <input type="radio" name="doktyp" value="vereinbarung"
                          checked={dokTyp === 'vereinbarung'} onChange={() => setDokTyp('vereinbarung')} />
                        <span>Trainervereinbarung (Freie Mitarbeit)</span>
                      </label>
                      <label>
                        <input type="radio" name="doktyp" value="infoblatt"
                          checked={dokTyp === 'infoblatt'} onChange={() => setDokTyp('infoblatt')} />
                        <span>Infoblatt Trainervereinbarung</span>
                      </label>
                    </div>

                    {dokTyp === 'vereinbarung' && (
                      <div className="tp-pdf-params">
                        <Field label="Mitgliedsbeitrag / Monat (€)">
                          <input className="tp-input" type="number" step="0.01" placeholder="z.B. 89.00"
                            value={dokParams.mitgliedsbeitrag_monatlich}
                            onChange={e => setDokParams(d => ({ ...d, mitgliedsbeitrag_monatlich: e.target.value }))} />
                        </Field>
                        <Field label="Sachleistungen Jahreswert (€)">
                          <input className="tp-input" type="number" step="0.01" placeholder="z.B. 1200.00"
                            value={dokParams.sachleistungen_jahreswert}
                            onChange={e => setDokParams(d => ({ ...d, sachleistungen_jahreswert: e.target.value }))} />
                        </Field>
                        <Field label="Vertragsbeginn">
                          <input className="tp-input" type="date" value={dokParams.vertragsbeginn}
                            onChange={e => setDokParams(d => ({ ...d, vertragsbeginn: e.target.value }))} />
                        </Field>
                        <Field label="Wettbewerbsradius (km)">
                          <input className="tp-input" type="number" value={dokParams.wettbewerb_radius}
                            onChange={e => setDokParams(d => ({ ...d, wettbewerb_radius: e.target.value }))} />
                        </Field>
                      </div>
                    )}

                    {/* Hinweise auf fehlende Felder */}
                    <div className="tp-pdf-hint">
                      {!selected.anschrift && <div className="tp-hint-warn">⚠ Anschrift fehlt — in Stammdaten eintragen</div>}
                      {!selected.geburtsdatum && <div className="tp-hint-warn">⚠ Geburtsdatum fehlt</div>}
                      {!selected.graduierung && <div className="tp-hint-warn">⚠ Graduierung fehlt</div>}
                    </div>

                    <button className="tp-btn tp-btn--primary" onClick={handleGeneratePdf} disabled={generating}>
                      {generating ? 'Generiere PDF…' : `PDF erstellen: ${dokTyp === 'vereinbarung' ? 'Trainervereinbarung' : 'Infoblatt'}`}
                    </button>
                  </div>
                </div>

                {/* Dokumente Liste */}
                {selected.dokumente?.length > 0 && (
                  <div className="tp-dok-list">
                    <h3 className="tp-dok-list-title">Gespeicherte Dokumente</h3>
                    {selected.dokumente.map(dok => (
                      <div key={dok.id} className="tp-dok-card">
                        <div className="tp-dok-icon">
                          {dok.dokument_typ === 'vereinbarung' ? '📄' : '📋'}
                        </div>
                        <div className="tp-dok-info">
                          <div className="tp-dok-name">
                            {dok.dokument_typ === 'vereinbarung' ? 'Trainervereinbarung' : 'Infoblatt'}
                          </div>
                          <div className="tp-dok-meta">
                            {new Date(dok.erstellt_am).toLocaleDateString('de-DE', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                            {dok.vertragsbeginn && ` · ab ${new Date(dok.vertragsbeginn).toLocaleDateString('de-DE')}`}
                            {dok.mitgliedsbeitrag_monatlich && ` · ${parseFloat(dok.mitgliedsbeitrag_monatlich).toFixed(2)} €/Monat`}
                          </div>
                        </div>
                        <div className="tp-dok-actions">
                          <span className={`tp-dok-status ${DOK_STATUS_CL[dok.status]}`}>{DOK_STATUS[dok.status]}</span>
                          <select className="tp-select-sm" value={dok.status}
                            onChange={e => handleDokStatus(dok.id, e.target.value)}>
                            <option value="erstellt">Erstellt</option>
                            <option value="versendet">Versendet</option>
                            <option value="unterschrieben">Unterschrieben</option>
                          </select>
                          {dok.pdf_dateiname && (
                            <button className="tp-btn tp-btn--sm tp-btn--secondary"
                              onClick={() => handlePdfOpen(dok.pdf_dateiname, selected.trainer_id)}>
                              PDF öffnen
                            </button>
                          )}
                          <button className="tp-btn tp-btn--sm tp-btn--danger"
                            onClick={() => handleDokLoeschen(dok.id)}>
                            Löschen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(!selected.dokumente || selected.dokumente.length === 0) && (
                  <div className="tp-empty-state" style={{ marginTop: '1.5rem' }}>
                    <p>Noch keine Dokumente erstellt.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
