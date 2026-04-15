// ============================================================================
// NATIONALKADER DASHBOARD
// Verwaltet Nationalkader und Nominierungen.
// Kandidaten-Daten kommen automatisch von events.tda-intl.org (Top-3-Ergebnisse).
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Shield, Users, Trophy, Plus, Trash2, RefreshCw, ChevronDown,
  ChevronRight, Check, X, AlertTriangle, Loader2, Medal,
  UserCheck, UserX, Info, Edit3, Save, ArrowLeft, Star,
  Filter, Search, Calendar, Building2
} from 'lucide-react';

const PLATZ_FARBEN = {
  1: { bg: '#FFD70022', border: '#FFD700', text: '#B8860B', label: '1. Platz', icon: '🥇' },
  2: { bg: '#C0C0C022', border: '#C0C0C0', text: '#808080', label: '2. Platz', icon: '🥈' },
  3: { bg: '#CD7F3222', border: '#CD7F32', text: '#8B4513', label: '3. Platz', icon: '🥉' },
};

const STATUS_CONFIG = {
  aktiv:    { color: 'var(--success)', bg: 'rgba(34,197,94,0.15)',   label: 'Aktiv'    },
  inaktiv:  { color: 'var(--warning)', bg: 'rgba(245,158,11,0.15)',  label: 'Inaktiv'  },
  gesperrt: { color: 'var(--error)',   bg: 'rgba(239,68,68,0.15)',   label: 'Gesperrt' },
};

// ─── Kleine Hilfkomponenten ───────────────────────────────────────────────────

const PlatzBadge = ({ platz }) => {
  const c = PLATZ_FARBEN[platz] || {};
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px',
      borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text
    }}>
      {c.icon} {c.label}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.inaktiv;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 600, background: c.bg, color: c.color
    }}>
      {c.label}
    </span>
  );
};

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

const NationalkaderDashboard = () => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [view, setView] = useState('kader-liste');   // kader-liste | kader-detail | kandidaten | kader-form
  const [kaderListe, setKaderListe] = useState([]);
  const [selectedKader, setSelectedKader] = useState(null);
  const [nominierungen, setNominierungen] = useState([]);
  const [kandidaten, setKandidaten] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [kandidatenLoading, setKandidatenLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('aktiv');
  const [editNom, setEditNom] = useState(null);    // Nominierung im Edit-Modus
  const [editNomData, setEditNomData] = useState({ status: 'aktiv', notiz: '' });

  // Kader-Formular
  const [kaderForm, setKaderForm] = useState({
    bezeichnung: '', saison: new Date().getFullYear().toString(), sportart: '', beschreibung: ''
  });
  const [editingKader, setEditingKader] = useState(null);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // ── Daten laden ──────────────────────────────────────────────────────────────

  const loadKader = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/nationalkader', { headers });
      setKaderListe(res.data.kader || []);
    } catch (err) {
      setError('Fehler beim Laden der Kader');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadNominierungen = useCallback(async (kaderId) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/nationalkader/${kaderId}/nominierungen`, { headers });
      setNominierungen(res.data.nominierungen || []);
    } catch (err) {
      setError('Fehler beim Laden der Nominierungen');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadKandidaten = useCallback(async () => {
    setKandidatenLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/nationalkader/kandidaten', { headers });
      setKandidaten(res.data.kandidaten || []);
    } catch (err) {
      setError('Fehler beim Laden der Kandidaten von TDA-Events');
    } finally {
      setKandidatenLoading(false);
    }
  }, [token]);

  useEffect(() => { loadKader(); }, [loadKader]);

  useEffect(() => {
    if (view === 'kandidaten' && kandidaten.length === 0) {
      loadKandidaten();
    }
  }, [view]);

  // ── Kader CRUD ───────────────────────────────────────────────────────────────

  const handleKaderSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingKader) {
        await axios.put(`/api/nationalkader/${editingKader.id}`, kaderForm, { headers });
        showSuccess('Kader gespeichert');
      } else {
        await axios.post('/api/nationalkader', kaderForm, { headers });
        showSuccess('Kader erstellt');
      }
      setKaderForm({ bezeichnung: '', saison: new Date().getFullYear().toString(), sportart: '', beschreibung: '' });
      setEditingKader(null);
      setView('kader-liste');
      loadKader();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Speichern');
    }
  };

  const handleKaderEdit = (kader) => {
    setEditingKader(kader);
    setKaderForm({
      bezeichnung: kader.bezeichnung,
      saison: kader.saison,
      sportart: kader.sportart || '',
      beschreibung: kader.beschreibung || ''
    });
    setView('kader-form');
  };

  const handleKaderDelete = async (kader) => {
    if (!confirm(`Kader "${kader.bezeichnung}" wirklich löschen? Alle Nominierungen werden ebenfalls gelöscht.`)) return;
    try {
      await axios.delete(`/api/nationalkader/${kader.id}`, { headers });
      showSuccess('Kader gelöscht');
      loadKader();
      if (selectedKader?.id === kader.id) {
        setSelectedKader(null);
        setView('kader-liste');
      }
    } catch (err) {
      setError('Fehler beim Löschen');
    }
  };

  const handleKaderOpen = (kader) => {
    setSelectedKader(kader);
    setView('kader-detail');
    loadNominierungen(kader.id);
  };

  // ── Auto-Sync ────────────────────────────────────────────────────────────────

  const handleAutoSync = async () => {
    if (!selectedKader) return;
    setSyncLoading(true);
    setError('');
    try {
      const res = await axios.post(`/api/nationalkader/${selectedKader.id}/auto-sync`, {}, { headers });
      showSuccess(res.data.message);
      loadNominierungen(selectedKader.id);
      loadKader();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Synchronisieren');
    } finally {
      setSyncLoading(false);
    }
  };

  // ── Kandidat manuell nominieren ──────────────────────────────────────────────

  const handleNominieren = async (kandidat, ergebnis) => {
    if (!selectedKader) return;
    const pseudoId = Math.abs(
      `${kandidat.vorname}${kandidat.nachname}${kandidat.verein_name}`.split('').reduce(
        (h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0
      )
    );
    try {
      await axios.post(`/api/nationalkader/${selectedKader.id}/nominieren`, {
        events_wettkaempfer_id: pseudoId,
        vorname: kandidat.vorname,
        nachname: kandidat.nachname,
        verein_name: kandidat.verein_name,
        events_turnier_id: ergebnis.turnier_id,
        turnier_name: ergebnis.turnier_name,
        turnier_datum: ergebnis.turnier_datum,
        division_name: ergebnis.division_name,
        division_code: ergebnis.division_code,
        platzierung: ergebnis.platzierung,
      }, { headers });
      showSuccess(`${kandidat.vorname} ${kandidat.nachname} nominiert`);
      setView('kader-detail');
      loadNominierungen(selectedKader.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Nominieren');
    }
  };

  // ── Nominierung bearbeiten ───────────────────────────────────────────────────

  const handleNomSave = async () => {
    try {
      await axios.put(`/api/nationalkader/nominierungen/${editNom.id}`, editNomData, { headers });
      showSuccess('Gespeichert');
      setEditNom(null);
      loadNominierungen(selectedKader.id);
    } catch (err) {
      setError('Fehler beim Speichern');
    }
  };

  const handleNomDelete = async (nom) => {
    if (!confirm(`Nominierung von ${nom.vorname} ${nom.nachname} entfernen?`)) return;
    try {
      await axios.delete(`/api/nationalkader/nominierungen/${nom.id}`, { headers });
      showSuccess('Nominierung entfernt');
      loadNominierungen(selectedKader.id);
      loadKader();
    } catch (err) {
      setError('Fehler beim Entfernen');
    }
  };

  // ── Filterte Nominierungen ───────────────────────────────────────────────────

  const filteredNominierungen = nominierungen.filter(n => {
    const matchSearch = !searchTerm || (
      `${n.vorname} ${n.nachname} ${n.verein_name} ${n.division_name}`.toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
    const matchStatus = !statusFilter || n.status === statusFilter || statusFilter === 'alle';
    return matchSearch && matchStatus;
  });

  // ─── VIEWS ───────────────────────────────────────────────────────────────────

  // View: Kader-Liste
  const KaderListeView = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={20} /> Nationalkader
        </h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={() => { setView('kandidaten'); }}>
            <Star size={16} /> Kandidaten (TDA-Events)
          </button>
          <button className="btn-primary" onClick={() => { setEditingKader(null); setKaderForm({ bezeichnung: '', saison: new Date().getFullYear().toString(), sportart: '', beschreibung: '' }); setView('kader-form'); }}>
            <Plus size={16} /> Neuer Kader
          </button>
        </div>
      </div>

      {kaderListe.length === 0 ? (
        <div className="empty-state large">
          <Shield size={48} />
          <h4>Noch kein Kader angelegt</h4>
          <p>Erstellen Sie Ihren ersten Nationalkader und nominieren Sie Athleten aus TDA-Events-Ergebnissen.</p>
          <button className="btn-primary" onClick={() => setView('kader-form')}>
            <Plus size={16} /> Ersten Kader erstellen
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {kaderListe.map(kader => (
            <div key={kader.id} className="verband-panel" style={{ cursor: 'default', padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(var(--primary-rgb,218,165,32),0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Shield size={22} style={{ color: 'var(--primary, #DAA520)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 16 }}>{kader.bezeichnung}</strong>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 12 }}>
                      {kader.saison}
                    </span>
                    {kader.sportart && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 12 }}>
                        {kader.sportart}
                      </span>
                    )}
                    {!kader.aktiv && <StatusBadge status="inaktiv" />}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
                    <span><Users size={13} style={{ verticalAlign: 'middle' }} /> {kader.nominierungen_aktiv || 0} aktive Athleten</span>
                    {kader.beschreibung && <span style={{ opacity: 0.8 }}>{kader.beschreibung.substring(0, 60)}{kader.beschreibung.length > 60 ? '…' : ''}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" style={{ padding: '6px 14px' }} onClick={() => handleKaderOpen(kader)}>
                    <ChevronRight size={16} /> Öffnen
                  </button>
                  <button className="btn-icon" title="Bearbeiten" onClick={() => handleKaderEdit(kader)}>
                    <Edit3 size={16} />
                  </button>
                  <button className="btn-icon btn-icon-danger" title="Löschen" onClick={() => handleKaderDelete(kader)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // View: Kader-Detail (Nominierungsliste)
  const KaderDetailView = () => {
    const gruppiertNachDivision = filteredNominierungen.reduce((acc, n) => {
      const key = n.division_name || 'Ohne Kategorie';
      if (!acc[key]) acc[key] = [];
      acc[key].push(n);
      return acc;
    }, {});

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button className="btn-icon" onClick={() => { setView('kader-liste'); setSelectedKader(null); }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={20} /> {selectedKader?.bezeichnung}
            </h3>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Saison {selectedKader?.saison}{selectedKader?.sportart ? ` · ${selectedKader.sportart}` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn-secondary"
              onClick={() => { setView('kandidaten'); if (kandidaten.length === 0) loadKandidaten(); }}
            >
              <Star size={16} /> Kandidaten
            </button>
            <button
              className="btn-primary"
              onClick={handleAutoSync}
              disabled={syncLoading}
            >
              {syncLoading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
              Auto-Sync
            </button>
          </div>
        </div>

        {/* Filter-Leiste */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Name, Verein, Kategorie..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 14 }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 14 }}
          >
            <option value="alle">Alle Status</option>
            <option value="aktiv">Aktiv</option>
            <option value="inaktiv">Inaktiv</option>
            <option value="gesperrt">Gesperrt</option>
          </select>
        </div>

        {/* Stats-Zeile */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[1, 2, 3].map(p => {
            const count = nominierungen.filter(n => n.platzierung === p && n.status === 'aktiv').length;
            const c = PLATZ_FARBEN[p];
            return (
              <div key={p} style={{ padding: '10px 18px', borderRadius: 10, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.text }}>{count}</div>
                  <div style={{ fontSize: 11, color: c.text, opacity: 0.8 }}>Athleten {c.label}</div>
                </div>
              </div>
            );
          })}
          <div style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} style={{ color: 'var(--text-muted)' }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{nominierungen.filter(n => n.status === 'aktiv').length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gesamt aktiv</div>
            </div>
          </div>
        </div>

        {/* Nominierungsliste */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={32} className="spin" /></div>
        ) : filteredNominierungen.length === 0 ? (
          <div className="empty-state large">
            <Users size={48} />
            <h4>Keine Nominierungen</h4>
            <p>Nutzen Sie "Auto-Sync" um alle Top-3-Athleten aus TDA-Events-Turnieren zu importieren, oder wählen Sie Kandidaten manuell aus.</p>
          </div>
        ) : (
          Object.entries(gruppiertNachDivision).sort(([a], [b]) => a.localeCompare(b)).map(([division, noms]) => (
            <div key={division} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                <Trophy size={15} style={{ color: 'var(--primary, #DAA520)' }} />
                <strong style={{ fontSize: 14 }}>{division}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{noms.length} Athlet{noms.length !== 1 ? 'en' : ''}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {noms.sort((a, b) => a.platzierung - b.platzierung || a.nachname.localeCompare(b.nachname)).map(nom => (
                  <div key={nom.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 8, background: 'var(--bg-secondary)',
                    border: editNom?.id === nom.id ? '1px solid var(--primary, #DAA520)' : '1px solid var(--border)',
                    opacity: nom.status === 'gesperrt' ? 0.5 : 1
                  }}>
                    <PlatzBadge platz={nom.platzierung} />
                    <div style={{ flex: 1 }}>
                      {editNom?.id === nom.id ? (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                          <select
                            value={editNomData.status}
                            onChange={e => setEditNomData(p => ({ ...p, status: e.target.value }))}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                          >
                            <option value="aktiv">Aktiv</option>
                            <option value="inaktiv">Inaktiv</option>
                            <option value="gesperrt">Gesperrt</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Notiz..."
                            value={editNomData.notiz}
                            onChange={e => setEditNomData(p => ({ ...p, notiz: e.target.value }))}
                            style={{ flex: 1, minWidth: 150, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                          />
                        </div>
                      ) : (
                        <>
                          <span style={{ fontWeight: 600 }}>{nom.vorname} {nom.nachname}</span>
                          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                            <Building2 size={12} style={{ verticalAlign: 'middle' }} /> {nom.verein_name}
                          </span>
                          {nom.turnier_name && (
                            <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                              <Calendar size={12} style={{ verticalAlign: 'middle' }} /> {nom.turnier_name}
                              {nom.turnier_datum ? ` (${new Date(nom.turnier_datum).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' })})` : ''}
                            </span>
                          )}
                          {nom.notiz && <span style={{ marginLeft: 10, fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>· {nom.notiz}</span>}
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <StatusBadge status={nom.status} />
                      <span style={{
                        fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg)',
                        padding: '1px 8px', borderRadius: 10, border: '1px solid var(--border)'
                      }}>
                        {nom.nominierungsart === 'automatisch' ? '⚡ auto' : '✋ manuell'}
                      </span>
                      {editNom?.id === nom.id ? (
                        <>
                          <button className="btn-icon" title="Speichern" onClick={handleNomSave}><Save size={15} /></button>
                          <button className="btn-icon" title="Abbrechen" onClick={() => setEditNom(null)}><X size={15} /></button>
                        </>
                      ) : (
                        <>
                          <button className="btn-icon" title="Bearbeiten" onClick={() => { setEditNom(nom); setEditNomData({ status: nom.status, notiz: nom.notiz || '' }); }}><Edit3 size={15} /></button>
                          <button className="btn-icon btn-icon-danger" title="Entfernen" onClick={() => handleNomDelete(nom)}><Trash2 size={15} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  // View: Kandidaten von TDA-Events
  const KandidatenView = () => {
    const [kandidatSearch, setKandidatSearch] = useState('');
    const [platzFilter, setPlatzFilter] = useState(0);

    const gefiltert = kandidaten.filter(k => {
      const matchSearch = !kandidatSearch || `${k.vorname} ${k.nachname} ${k.verein_name}`.toLowerCase().includes(kandidatSearch.toLowerCase());
      const matchPlatz = !platzFilter || k.ergebnisse.some(e => e.platzierung <= platzFilter);
      return matchSearch && matchPlatz;
    });

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button className="btn-icon" onClick={() => setView(selectedKader ? 'kader-detail' : 'kader-liste')}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={20} /> Top-3-Kandidaten aus TDA-Events
            </h3>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Athleten mit Top-3-Platzierungen bei TDA-Turnieren
            </span>
          </div>
          <button className="btn-secondary" onClick={loadKandidaten} disabled={kandidatenLoading}>
            {kandidatenLoading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Aktualisieren
          </button>
        </div>

        {selectedKader && (
          <div style={{ background: 'rgba(var(--primary-rgb,218,165,32),0.1)', border: '1px solid var(--primary, #DAA520)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={16} style={{ color: 'var(--primary, #DAA520)', flexShrink: 0 }} />
            Kader aktiv: <strong>{selectedKader.bezeichnung}</strong> — Klicken Sie auf "Nominieren" um Athleten direkt in diesen Kader zu übernehmen.
          </div>
        )}

        {/* Filter */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Name oder Verein..."
              value={kandidatSearch}
              onChange={e => setKandidatSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 14 }}
            />
          </div>
          <select
            value={platzFilter}
            onChange={e => setPlatzFilter(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 14 }}
          >
            <option value={0}>Alle Plätze</option>
            <option value={1}>Nur Platz 1</option>
            <option value={2}>Platz 1–2</option>
            <option value={3}>Platz 1–3</option>
          </select>
        </div>

        {kandidatenLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Loader2 size={36} className="spin" style={{ color: 'var(--primary, #DAA520)' }} />
            <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Lade Ergebnisse von events.tda-intl.org…</p>
          </div>
        ) : gefiltert.length === 0 ? (
          <div className="empty-state large">
            <Trophy size={48} />
            <h4>Keine Kandidaten gefunden</h4>
            <p>Entweder gibt es keine abgeschlossenen Turniere oder Ihre Suchfilter schließen alle Athleten aus.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {gefiltert.map((k, idx) => (
              <div key={idx} className="verband-panel" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 16, color: 'var(--primary, #DAA520)'
                  }}>
                    {k.vorname[0]}{k.nachname[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 15 }}>{k.vorname} {k.nachname}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Building2 size={12} /> {k.verein_name}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                        {k.ergebnisse.length} Ergebnis{k.ergebnisse.length !== 1 ? 'se' : ''}
                      </span>
                    </div>
                    {/* Ergebnisse */}
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {k.ergebnisse.map((e, eIdx) => (
                        <div key={eIdx} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                          borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', flexWrap: 'wrap'
                        }}>
                          <PlatzBadge platz={e.platzierung} />
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{e.division_name}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {e.division_type === 'bracket' ? '⚔️ Kampf' : '🎯 Formen'}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={12} /> {e.turnier_name}
                            {e.turnier_datum ? ` · ${new Date(e.turnier_datum).toLocaleDateString('de-DE', { year: 'numeric', month: 'short' })}` : ''}
                          </span>
                          {selectedKader && (
                            <button
                              className="btn-primary"
                              style={{ padding: '3px 12px', fontSize: 12 }}
                              onClick={() => handleNominieren(k, e)}
                            >
                              <UserCheck size={13} /> Nominieren
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // View: Kader-Formular
  const KaderFormView = () => (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-icon" onClick={() => setView('kader-liste')}>
          <ArrowLeft size={18} />
        </button>
        <h3 style={{ margin: 0 }}>
          {editingKader ? 'Kader bearbeiten' : 'Neuen Kader anlegen'}
        </h3>
      </div>
      <form onSubmit={handleKaderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Bezeichnung *</label>
          <input
            type="text"
            required
            placeholder="z.B. Nationalkader 2025"
            value={kaderForm.bezeichnung}
            onChange={e => setKaderForm(p => ({ ...p, bezeichnung: e.target.value }))}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Saison *</label>
          <input
            type="text"
            required
            placeholder="z.B. 2025 oder 2025/2026"
            value={kaderForm.saison}
            onChange={e => setKaderForm(p => ({ ...p, saison: e.target.value }))}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Sportart</label>
          <select
            value={kaderForm.sportart}
            onChange={e => setKaderForm(p => ({ ...p, sportart: e.target.value }))}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 14 }}
          >
            <option value="">Alle / Gemischt</option>
            <option value="Karate">Karate</option>
            <option value="Taekwondo">Taekwondo</option>
            <option value="Kickboxing">Kickboxing</option>
            <option value="Hapkido">Hapkido</option>
            <option value="Selbstverteidigung">Selbstverteidigung</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Beschreibung</label>
          <textarea
            rows={3}
            placeholder="Kurze Beschreibung des Kaders (optional)"
            value={kaderForm.beschreibung}
            onChange={e => setKaderForm(p => ({ ...p, beschreibung: e.target.value }))}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 14, resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn-primary">
            <Save size={16} /> {editingKader ? 'Speichern' : 'Erstellen'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setView('kader-liste')}>
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div className="nationalkader-wrapper">
      {/* Flash-Messages */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 8, marginBottom: 16, color: 'var(--error, #ef4444)', fontSize: 14
        }}>
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={15} /></button>
        </div>
      )}
      {successMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.4)',
          borderRadius: 8, marginBottom: 16, color: 'var(--success, #22c55e)', fontSize: 14
        }}>
          <Check size={16} /> {successMsg}
        </div>
      )}

      {view === 'kader-liste'   && <KaderListeView />}
      {view === 'kader-detail'  && <KaderDetailView />}
      {view === 'kandidaten'    && <KandidatenView />}
      {view === 'kader-form'    && <KaderFormView />}
    </div>
  );
};

export default NationalkaderDashboard;
