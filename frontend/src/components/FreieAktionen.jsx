// =============================================================================
// FREIE AKTIONEN KOMPONENTE
// =============================================================================
// Liste aller Marketing-Aktionen mit voller CRUD und Jahresplan-Übernahme
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDojoContext } from '../context/DojoContext';
import config from '../config/config.js';
import {
    Plus, Edit3, Trash2, Calendar, Target, Gift, Mail,
    Megaphone, Users, Star, Clock, CheckCircle, AlertCircle,
    X, Filter, RefreshCw, ArrowRight
} from 'lucide-react';
import '../styles/FreieAktionen.css';

const AKTIONS_TYPEN = {
    'social_media':           { label: 'Social Media',           icon: Megaphone, color: 'var(--info)' },
    'email_kampagne':         { label: 'E-Mail Kampagne',        icon: Mail,      color: '#8b5cf6' },
    'rabatt_aktion':          { label: 'Rabatt-Aktion',          icon: Gift,      color: 'var(--success)' },
    'event':                  { label: 'Event/Veranstaltung',    icon: Calendar,  color: 'var(--warning)' },
    'mitgliederwerbung':      { label: 'Mitgliederwerbung',      icon: Users,     color: '#ec4899' },
    'freunde_werben_freunde': { label: 'Freunde werben Freunde', icon: Users,     color: 'var(--secondary)' },
    'sonstiges':              { label: 'Sonstiges',              icon: Star,      color: 'var(--text-muted)' },
};

const STATUS_CONFIG = {
    'geplant':         { label: 'Geplant',          color: 'var(--text-muted)', icon: Clock },
    'in_vorbereitung': { label: 'In Vorbereitung',  color: 'var(--warning)', icon: Edit3 },
    'aktiv':           { label: 'Aktiv',             color: 'var(--success)', icon: Target },
    'abgeschlossen':   { label: 'Abgeschlossen',     color: 'var(--info)', icon: CheckCircle },
    'abgebrochen':     { label: 'Abgebrochen',       color: 'var(--error)', icon: AlertCircle },
};

const EMPTY_FORM = {
    titel: '', beschreibung: '', typ: 'social_media',
    start_datum: '', end_datum: '', status: 'geplant',
    zielgruppe: '', budget: '', notizen: '',
};

const FreieAktionen = ({ onSwitchToJahresplan }) => {
    const { token } = useAuth();
    const { activeDojo } = useDojoContext();

    const [aktionen, setAktionen] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Filter
    const [filterTyp, setFilterTyp] = useState('alle');
    const [filterStatus, setFilterStatus] = useState('alle');
    const [searchText, setSearchText] = useState('');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingAktion, setEditingAktion] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    // Jahresplan-Modal
    const [showJahresplanModal, setShowJahresplanModal] = useState(false);
    const [jahresplanAktion, setJahresplanAktion] = useState(null);

    const withDojo = (url) =>
        activeDojo?.id ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}` : url;

    // ==========================================================================
    // LADEN
    // ==========================================================================

    useEffect(() => {
        if (activeDojo === 'super-admin' || !activeDojo?.id) return;
        load();
    }, [activeDojo]);

    const load = async () => {
        try {
            setLoading(true);
            const res = await fetch(
                withDojo(`${config.apiBaseUrl}/marketing-jahresplan?all=true`),
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.ok) setAktionen(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // ==========================================================================
    // CRUD
    // ==========================================================================

    const save = async () => {
        if (!formData.titel.trim()) { showMsg('error', 'Bitte Titel eingeben'); return; }
        if (!formData.start_datum)  { showMsg('error', 'Bitte Startdatum wählen'); return; }
        setSaving(true);
        try {
            const url = editingAktion
                ? withDojo(`${config.apiBaseUrl}/marketing-jahresplan/${editingAktion.id}`)
                : withDojo(`${config.apiBaseUrl}/marketing-jahresplan`);
            const res = await fetch(url, {
                method: editingAktion ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(formData),
            });
            if (!res.ok) throw new Error();
            showMsg('success', editingAktion ? 'Aktion aktualisiert' : 'Aktion erstellt');
            closeModal();
            load();
        } catch {
            showMsg('error', 'Fehler beim Speichern');
        } finally {
            setSaving(false);
        }
    };

    const del = async (id) => {
        if (!confirm('Aktion wirklich löschen?')) return;
        try {
            await fetch(withDojo(`${config.apiBaseUrl}/marketing-jahresplan/${id}`), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            showMsg('success', 'Aktion gelöscht');
            load();
        } catch {
            showMsg('error', 'Fehler beim Löschen');
        }
    };

    const updateStatus = async (id, status) => {
        try {
            await fetch(withDojo(`${config.apiBaseUrl}/marketing-jahresplan/${id}/status`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status }),
            });
            load();
        } catch {
            showMsg('error', 'Fehler beim Status-Update');
        }
    };

    // ==========================================================================
    // JAHRESPLAN-ÜBERNAHME
    // ==========================================================================

    const openJahresplanModal = (aktion) => {
        setJahresplanAktion(aktion);
        setShowJahresplanModal(true);
    };

    const inJahresplanUebernehmen = () => {
        setShowJahresplanModal(false);
        if (onSwitchToJahresplan) onSwitchToJahresplan();
        showMsg('success', `"${jahresplanAktion.titel}" ist bereits im Jahresplan sichtbar!`);
    };

    // ==========================================================================
    // HELPERS
    // ==========================================================================

    const showMsg = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    };

    const openModal = (aktion = null) => {
        setEditingAktion(aktion);
        setFormData(aktion ? {
            titel: aktion.titel,
            beschreibung: aktion.beschreibung || '',
            typ: aktion.typ,
            start_datum: aktion.start_datum?.split('T')[0] || '',
            end_datum: aktion.end_datum?.split('T')[0] || '',
            status: aktion.status,
            zielgruppe: aktion.zielgruppe || '',
            budget: aktion.budget || '',
            notizen: aktion.notizen || '',
        } : { ...EMPTY_FORM });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingAktion(null);
        setFormData(EMPTY_FORM);
    };

    const formatDatum = (d) => d
        ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '–';

    const gefiltert = aktionen.filter(a => {
        if (filterTyp !== 'alle' && a.typ !== filterTyp) return false;
        if (filterStatus !== 'alle' && a.status !== filterStatus) return false;
        if (searchText && !a.titel.toLowerCase().includes(searchText.toLowerCase())) return false;
        return true;
    });

    // ==========================================================================
    // GUARD
    // ==========================================================================

    if (activeDojo === 'super-admin' || !activeDojo?.id) {
        return (
            <div className="fa-guard-center">
                <div className="fa-guard-emoji">🏢</div>
                <p>Bitte wähle ein Dojo aus.</p>
            </div>
        );
    }

    // ==========================================================================
    // RENDER
    // ==========================================================================

    return (
        <div className="freie-aktionen">
            {/* Message */}
            {message.text && (
                <div className={`referral-message ${message.type}`}>
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Header */}
            <div className="referral-header">
                <div className="referral-title">
                    <Target size={24} />
                    <h2>Freie Marketing-Aktionen</h2>
                    <span className="fa-count-badge">
                        {aktionen.length} Aktionen
                    </span>
                </div>
                <div className="u-flex-gap-sm">
                    <button className="btn btn-icon" onClick={load} title="Aktualisieren">
                        <RefreshCw size={16} />
                    </button>
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        <Plus size={16} /> Neue Aktion
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="jahresplan-stats">
                {Object.entries(STATUS_CONFIG).map(([key, s]) => {
                    const Icon = s.icon;
                    return (
                        <div key={key} className={`stat-item fa-stat-clickable${filterStatus === key ? ' fa-stat-clickable--active' : ''}`}
                            style={{ '--stat-color': s.color }}
                            onClick={() => setFilterStatus(filterStatus === key ? 'alle' : key)}>
                            <span className="stat-number">
                                {aktionen.filter(a => a.status === key).length}
                            </span>
                            <span className="stat-label">{s.label}</span>
                        </div>
                    );
                })}
            </div>

            {/* Filter */}
            <div className="fa-filter-row">
                <Filter size={16} className="fa-filter-icon" />
                <input
                    type="text"
                    placeholder="Suche..."
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    className="form-input fa-input-search"
                />
                <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)} className="form-select fa-select-typ">
                    <option value="alle">Alle Typen</option>
                    {Object.entries(AKTIONS_TYPEN).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="form-select fa-select-status">
                    <option value="alle">Alle Status</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                {(filterTyp !== 'alle' || filterStatus !== 'alle' || searchText) && (
                    <button className="btn btn-secondary btn-sm" onClick={() => { setFilterTyp('alle'); setFilterStatus('alle'); setSearchText(''); }}>
                        <X size={14} /> Reset
                    </button>
                )}
            </div>

            {/* Liste */}
            {loading ? (
                <div className="loading-container"><div className="loading-spinner-large"></div><p>Wird geladen...</p></div>
            ) : gefiltert.length === 0 ? (
                <div className="empty-state fa-empty-state">
                    <Target size={48} className="fa-empty-icon" />
                    <p className="u-text-muted">
                        {aktionen.length === 0 ? 'Noch keine Aktionen. Erstelle deine erste!' : 'Keine Aktionen für diesen Filter.'}
                    </p>
                    {aktionen.length === 0 && (
                        <button className="btn btn-primary fa-btn-first" onClick={() => openModal()}>
                            <Plus size={16} /> Erste Aktion erstellen
                        </button>
                    )}
                </div>
            ) : (
                <div className="freie-aktionen-liste">
                    {gefiltert.map(aktion => {
                        const T = AKTIONS_TYPEN[aktion.typ] || AKTIONS_TYPEN.sonstiges;
                        const S = STATUS_CONFIG[aktion.status] || STATUS_CONFIG.geplant;
                        const TypeIcon = T.icon;
                        const StatusIcon = S.icon;
                        return (
                            <div key={aktion.id} className="freie-aktion-card" style={{ '--typ-color': T.color }}>
                                {/* Kopfzeile */}
                                <div className="freie-aktion-header">
                                    <div className="fa-card-title-row">
                                        <TypeIcon size={18} className="fa-type-icon" />
                                        <strong className="fa-card-title">
                                            {aktion.titel}
                                        </strong>
                                    </div>
                                    <div className="fa-card-actions-right">
                                        <span className="jahresplan-status-badge fa-status-badge" style={{ '--s-color': S.color }}>
                                            <StatusIcon size={12} /> {S.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Meta-Info */}
                                <div className="freie-aktion-meta">
                                    <span><Calendar size={13} /> {formatDatum(aktion.start_datum)}{aktion.end_datum && ` – ${formatDatum(aktion.end_datum)}`}</span>
                                    <span className="fa-type-label">{T.label}</span>
                                    {aktion.zielgruppe && <span>👥 {aktion.zielgruppe}</span>}
                                    {aktion.budget && <span>💶 {parseFloat(aktion.budget).toFixed(2)} €</span>}
                                </div>

                                {/* Beschreibung */}
                                {aktion.beschreibung && (
                                    <p className="fa-card-desc">
                                        {aktion.beschreibung}
                                    </p>
                                )}

                                {/* Aktionen */}
                                <div className="freie-aktion-actions">
                                    <div className="fa-action-left">
                                        {/* Status-Schnellwechsel */}
                                        {aktion.status !== 'aktiv' && aktion.status !== 'abgeschlossen' && (
                                            <button className="btn btn-sm btn-success" onClick={() => updateStatus(aktion.id, 'aktiv')}>
                                                <Target size={13} /> Aktivieren
                                            </button>
                                        )}
                                        {aktion.status === 'aktiv' && (
                                            <button className="btn btn-sm fa-btn-abschliessen"
                                                onClick={() => updateStatus(aktion.id, 'abgeschlossen')}>
                                                <CheckCircle size={13} /> Abschließen
                                            </button>
                                        )}
                                        <button className="btn btn-sm btn-primary" onClick={() => openJahresplanModal(aktion)}>
                                            <ArrowRight size={13} /> Im Jahresplan
                                        </button>
                                    </div>
                                    <div className="fa-action-right">
                                        <button className="btn btn-icon btn-xs" onClick={() => openModal(aktion)} title="Bearbeiten">
                                            <Edit3 size={14} />
                                        </button>
                                        <button className="btn btn-icon btn-xs btn-danger" onClick={() => del(aktion.id)} title="Löschen">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Erstellen/Bearbeiten Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content jahresplan-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingAktion ? 'Aktion bearbeiten' : 'Neue Marketing-Aktion'}</h2>
                            <button className="close-button" onClick={closeModal}><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Titel *</label>
                                <input type="text" className="form-input" value={formData.titel}
                                    onChange={e => setFormData({ ...formData, titel: e.target.value })}
                                    placeholder="z.B. Sommerspecial 2026" />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Aktionstyp</label>
                                    <select className="form-select" value={formData.typ}
                                        onChange={e => setFormData({ ...formData, typ: e.target.value })}>
                                        {Object.entries(AKTIONS_TYPEN).map(([k, v]) => (
                                            <option key={k} value={k}>{v.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <select className="form-select" value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                            <option key={k} value={k}>{v.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Startdatum *</label>
                                    <input type="date" className="form-input" value={formData.start_datum}
                                        onChange={e => setFormData({ ...formData, start_datum: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Enddatum</label>
                                    <input type="date" className="form-input" value={formData.end_datum}
                                        onChange={e => setFormData({ ...formData, end_datum: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Beschreibung</label>
                                <textarea className="form-textarea" rows={3} value={formData.beschreibung}
                                    onChange={e => setFormData({ ...formData, beschreibung: e.target.value })}
                                    placeholder="Was soll bei dieser Aktion passieren?" />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Zielgruppe</label>
                                    <input type="text" className="form-input" value={formData.zielgruppe}
                                        onChange={e => setFormData({ ...formData, zielgruppe: e.target.value })}
                                        placeholder="z.B. Neukunden, Familien" />
                                </div>
                                <div className="form-group">
                                    <label>Budget (EUR)</label>
                                    <input type="number" className="form-input" value={formData.budget}
                                        onChange={e => setFormData({ ...formData, budget: e.target.value })}
                                        placeholder="0" min="0" step="0.01" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Notizen</label>
                                <textarea className="form-textarea" rows={2} value={formData.notizen}
                                    onChange={e => setFormData({ ...formData, notizen: e.target.value })}
                                    placeholder="Zusätzliche Notizen..." />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={closeModal}>Abbrechen</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving}>
                                {saving ? 'Speichert...' : (editingAktion ? 'Speichern' : 'Erstellen')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Jahresplan-Modal */}
            {showJahresplanModal && jahresplanAktion && (
                <div className="modal-overlay" onClick={() => setShowJahresplanModal(false)}>
                    <div className="modal-content fa-modal-narrow" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Im Jahresplan anzeigen</h2>
                            <button className="close-button" onClick={() => setShowJahresplanModal(false)}><X size={24} /></button>
                        </div>
                        <div className="modal-body fa-modal-body-center">
                            <div className="u-emoji-xl">📅</div>
                            <p className="fa-modal-text">
                                <strong className="u-text-accent">{jahresplanAktion.titel}</strong>
                            </p>
                            <p className="fa-modal-subtext">
                                ist ab dem {formatDatum(jahresplanAktion.start_datum)} im Jahresplan sichtbar — im Monat{' '}
                                <strong className="u-text-primary">
                                    {new Date(jahresplanAktion.start_datum).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                                </strong>.
                            </p>
                            <button className="btn btn-primary fa-btn-full" onClick={inJahresplanUebernehmen}>
                                <ArrowRight size={16} /> Zum Jahresplan wechseln
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FreieAktionen;
