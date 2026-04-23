// =============================================================================
// MARKETING-JAHRESPLAN KOMPONENTE
// =============================================================================
// Jahresübersicht für Marketing-Aktionen mit Kalender und Planung
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/MarketingJahresplan.css';
import { useDojoContext } from '../context/DojoContext';
import config from '../config/config.js';
import {
    Calendar,
    Plus,
    Edit3,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Target,
    Gift,
    Mail,
    Megaphone,
    Users,
    Star,
    Clock,
    CheckCircle,
    AlertCircle,
    X
} from 'lucide-react';

// Aktionstypen mit Icons und Farben
const AKTIONS_TYPEN = {
    'social_media': { label: 'Social Media', icon: Megaphone, color: 'var(--info)' },
    'email_kampagne': { label: 'E-Mail Kampagne', icon: Mail, color: '#8b5cf6' },
    'rabatt_aktion': { label: 'Rabatt-Aktion', icon: Gift, color: 'var(--success)' },
    'event': { label: 'Event/Veranstaltung', icon: Calendar, color: 'var(--warning)' },
    'mitgliederwerbung': { label: 'Mitgliederwerbung', icon: Users, color: '#ec4899' },
    'freunde_werben_freunde': { label: 'Freunde werben Freunde', icon: Users, color: 'var(--secondary)' },
    'sonstiges': { label: 'Sonstiges', icon: Star, color: 'var(--text-muted)' }
};

// Vordefinierte Marketing-Ideen für jeden Monat
const MARKETING_VORSCHLAEGE = {
    1: ['Neujahrsaktion', 'Fitness-Vorsätze Kampagne', 'Winterspecial'],
    2: ['Valentinstag Partner-Training', 'Faschingsaktion', 'Freunde-werben-Freunde'],
    3: ['Frühlingserwachen', 'Oster-Countdown', 'Probetraining-Woche'],
    4: ['Oster-Aktion', 'Frühjahrs-Challenge', 'Outdoor-Training Start'],
    5: ['Muttertag Special', 'Sommervorbereitung', 'Pfingst-Aktion'],
    6: ['Sommerfest', 'Ferienprogramm', 'Gürtelprüfungs-Event'],
    7: ['Sommer-Camp', 'Ferienspecial', 'Outdoor-Training'],
    8: ['Back-to-School', 'Herbstvorbereitung', 'Schnupperwoche'],
    9: ['Schulstart-Aktion', 'Herbst-Challenge', 'Tag der offenen Tür'],
    10: ['Halloween-Event', 'Herbstfest', 'Mitglieder-Jubiläum'],
    11: ['Black Friday', 'Weihnachts-Countdown', 'Familienmonat'],
    12: ['Weihnachtsfeier', 'Jahresabschluss', 'Neujahrsvorbereitung']
};

const MarketingJahresplan = () => {
    const { token } = useAuth();
    const { activeDojo } = useDojoContext();

    // State
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [aktionen, setAktionen] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [editingAktion, setEditingAktion] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Form State
    const [formData, setFormData] = useState({
        titel: '',
        beschreibung: '',
        typ: 'social_media',
        start_datum: '',
        end_datum: '',
        status: 'geplant',
        zielgruppe: '',
        budget: '',
        notizen: ''
    });

    // Monate
    const MONATE = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

    // ==========================================================================
    // DATA LOADING
    // ==========================================================================

    useEffect(() => {
        if (activeDojo === 'super-admin' || !activeDojo?.id) return;
        loadAktionen();
    }, [selectedYear, activeDojo]);

    const withDojo = (url) => activeDojo?.id ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}` : url;

    const loadAktionen = async () => {
        if (activeDojo === 'super-admin' || !activeDojo?.id) return;
        try {
            setLoading(true);
            setError('');

            const response = await fetch(
                withDojo(`${config.apiBaseUrl}/marketing-jahresplan?jahr=${selectedYear}`),
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 404) {
                    setAktionen([]);
                    return;
                }
                throw new Error('Fehler beim Laden der Aktionen');
            }

            const data = await response.json();
            setAktionen(data);

        } catch (err) {
            console.error('Fehler beim Laden:', err);
            setAktionen([]);
        } finally {
            setLoading(false);
        }
    };

    // ==========================================================================
    // CRUD OPERATIONS
    // ==========================================================================

    const saveAktion = async () => {
        if (!formData.titel.trim()) {
            showMessage('error', 'Bitte gib einen Titel ein');
            return;
        }

        if (!formData.start_datum) {
            showMessage('error', 'Bitte wähle ein Startdatum');
            return;
        }

        try {
            const url = withDojo(editingAktion
                ? `${config.apiBaseUrl}/marketing-jahresplan/${editingAktion.id}`
                : `${config.apiBaseUrl}/marketing-jahresplan`);

            const response = await fetch(url, {
                method: editingAktion ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error('Fehler beim Speichern');
            }

            showMessage('success', editingAktion ? 'Aktion aktualisiert' : 'Aktion erstellt');
            closeModal();
            loadAktionen();

        } catch (err) {
            console.error('Fehler beim Speichern:', err);
            showMessage('error', 'Fehler beim Speichern der Aktion');
        }
    };

    const deleteAktion = async (id) => {
        if (!confirm('Möchtest du diese Aktion wirklich löschen?')) return;

        try {
            const response = await fetch(
                withDojo(`${config.apiBaseUrl}/marketing-jahresplan/${id}`),
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Fehler beim Löschen');
            }

            showMessage('success', 'Aktion gelöscht');
            loadAktionen();

        } catch (err) {
            console.error('Fehler beim Löschen:', err);
            showMessage('error', 'Fehler beim Löschen der Aktion');
        }
    };

    const updateStatus = async (id, newStatus) => {
        try {
            const response = await fetch(
                withDojo(`${config.apiBaseUrl}/marketing-jahresplan/${id}/status`),
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status: newStatus })
                }
            );

            if (!response.ok) {
                throw new Error('Fehler beim Aktualisieren');
            }

            loadAktionen();

        } catch (err) {
            console.error('Fehler beim Status-Update:', err);
            showMessage('error', 'Fehler beim Aktualisieren des Status');
        }
    };

    // ==========================================================================
    // HELPERS
    // ==========================================================================

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    };

    const openModal = (month, aktion = null) => {
        setSelectedMonth(month);
        setEditingAktion(aktion);

        if (aktion) {
            setFormData({
                titel: aktion.titel,
                beschreibung: aktion.beschreibung || '',
                typ: aktion.typ,
                start_datum: aktion.start_datum?.split('T')[0] || '',
                end_datum: aktion.end_datum?.split('T')[0] || '',
                status: aktion.status,
                zielgruppe: aktion.zielgruppe || '',
                budget: aktion.budget || '',
                notizen: aktion.notizen || ''
            });
        } else {
            // Neues Datum im ausgewählten Monat
            const startDate = new Date(selectedYear, month, 1);
            setFormData({
                titel: '',
                beschreibung: '',
                typ: 'social_media',
                start_datum: startDate.toISOString().split('T')[0],
                end_datum: '',
                status: 'geplant',
                zielgruppe: '',
                budget: '',
                notizen: ''
            });
        }

        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedMonth(null);
        setEditingAktion(null);
        setFormData({
            titel: '',
            beschreibung: '',
            typ: 'social_media',
            start_datum: '',
            end_datum: '',
            status: 'geplant',
            zielgruppe: '',
            budget: '',
            notizen: ''
        });
    };

    const getAktionenForMonth = (month) => {
        const monthStart = new Date(selectedYear, month, 1);
        const monthEnd = new Date(selectedYear, month + 1, 0); // last day of month
        return aktionen.filter(a => {
            const startDate = new Date(a.start_datum);
            const endDate = a.end_datum ? new Date(a.end_datum) : startDate;
            // show if campaign overlaps with this month
            return startDate <= monthEnd && endDate >= monthStart;
        });
    };

    const getStatusBadge = (status) => {
        const cfg = {
            'geplant':        { mod: 'planned',    text: 'Geplant',          icon: Clock },
            'in_vorbereitung':{ mod: 'preparing',  text: 'In Vorbereitung',  icon: Edit3 },
            'aktiv':          { mod: 'active',      text: 'Aktiv',            icon: Target },
            'abgeschlossen':  { mod: 'completed',   text: 'Abgeschlossen',    icon: CheckCircle },
            'abgebrochen':    { mod: 'cancelled',   text: 'Abgebrochen',      icon: AlertCircle }
        };
        const c = cfg[status] || { mod: 'planned', text: status, icon: Clock };
        const Icon = c.icon;
        return (
            <span className={`mj-status-badge mj-status-badge--${c.mod}`}>
                <Icon size={12} /> {c.text}
            </span>
        );
    };

    // ==========================================================================
    // RENDER
    // ==========================================================================

    if (activeDojo === 'super-admin' || !activeDojo?.id) {
        return (
            <div className="mj-empty-state">
                <div className="mj-empty-icon">🏢</div>
                <p>Bitte wähle ein Dojo aus, um den Marketing-Jahresplan zu sehen.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="mj-loading">
                <div className="mj-loading-spinner"></div>
                <p>Jahresplan wird geladen...</p>
            </div>
        );
    }

    return (
        <div className="mj-root">
            {/* Message Banner */}
            {message.text && (
                <div className={`mj-message mj-message--${message.type}`}>
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Header mit Jahresauswahl */}
            <div className="mj-header">
                <button className="mj-nav-btn" onClick={() => setSelectedYear(y => y - 1)}>
                    <ChevronLeft size={20} />
                </button>
                <h2 className="mj-title">
                    <Calendar size={22} />
                    Marketing-Jahresplan {selectedYear}
                </h2>
                <button className="mj-nav-btn" onClick={() => setSelectedYear(y => y + 1)}>
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Statistik */}
            <div className="mj-stats">
                <div className="mj-stat-item">
                    <span className="mj-stat-number">{aktionen.length}</span>
                    <span className="mj-stat-label">Aktionen gesamt</span>
                </div>
                <div className="mj-stat-item">
                    <span className="mj-stat-number">{aktionen.filter(a => a.status === 'geplant').length}</span>
                    <span className="mj-stat-label">Geplant</span>
                </div>
                <div className="mj-stat-item">
                    <span className="mj-stat-number">{aktionen.filter(a => a.status === 'aktiv').length}</span>
                    <span className="mj-stat-label">Aktiv</span>
                </div>
                <div className="mj-stat-item">
                    <span className="mj-stat-number">{aktionen.filter(a => a.status === 'abgeschlossen').length}</span>
                    <span className="mj-stat-label">Abgeschlossen</span>
                </div>
            </div>

            {/* Kalender-Grid */}
            <div className="mj-grid">
                {MONATE.map((monat, index) => {
                    const monatsAktionen = getAktionenForMonth(index);
                    const isCurrentMonth = new Date().getMonth() === index && new Date().getFullYear() === selectedYear;

                    return (
                        <div
                            key={index}
                            className={`mj-month-card${isCurrentMonth ? ' mj-month-card--current' : ''}`}
                        >
                            <div className="mj-month-header">
                                <h3>{monat}</h3>
                                <button
                                    className="mj-add-btn"
                                    onClick={() => openModal(index)}
                                    title="Neue Aktion"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>

                            <div className="mj-month-content">
                                {monatsAktionen.length === 0 ? (
                                    <div className="mj-month-empty">
                                        <p>Keine Aktionen</p>
                                        <div className="mj-suggestions">
                                            <span className="mj-suggestions-label">Ideen:</span>
                                            {MARKETING_VORSCHLAEGE[index + 1]?.map((v, i) => (
                                                <button
                                                    key={i}
                                                    className="mj-suggestion-chip"
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, titel: v }));
                                                        openModal(index);
                                                    }}
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mj-actions-list">
                                        {monatsAktionen.map(aktion => {
                                            const TypeIcon = AKTIONS_TYPEN[aktion.typ]?.icon || Star;
                                            const typeColor = AKTIONS_TYPEN[aktion.typ]?.color || '#6b7280';

                                            return (
                                                <div
                                                    key={aktion.id}
                                                    className="mj-action-item"
                                                    style={{ '--typ-color': typeColor }}
                                                >
                                                    <div className="mj-action-icon">
                                                        <TypeIcon size={14} />
                                                    </div>
                                                    <div className="mj-action-info">
                                                        <strong>{aktion.titel}</strong>
                                                        <span className="mj-action-date">
                                                            {new Date(aktion.start_datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                                                        </span>
                                                        {getStatusBadge(aktion.status)}
                                                    </div>
                                                    <div className="mj-action-btns">
                                                        <button
                                                            className="mj-icon-btn"
                                                            onClick={() => openModal(index, aktion)}
                                                            title="Bearbeiten"
                                                        >
                                                            <Edit3 size={13} />
                                                        </button>
                                                        <button
                                                            className="mj-icon-btn mj-icon-btn--danger"
                                                            onClick={() => deleteAktion(aktion.id)}
                                                            title="Löschen"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legende */}
            <div className="mj-legend">
                <h4>Aktionstypen:</h4>
                <div className="mj-legend-items">
                    {Object.entries(AKTIONS_TYPEN).map(([key, val]) => {
                        const Icon = val.icon;
                        return (
                            <span key={key} className="mj-legend-item" style={{ '--legende-color': val.color }}>
                                <Icon size={13} /> {val.label}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Modal für Aktion erstellen/bearbeiten */}
            {showModal && (
                <div className="mj-overlay" onClick={closeModal}>
                    <div className="mj-modal" onClick={e => e.stopPropagation()}>
                        <div className="mj-modal-header">
                            <h2>
                                {editingAktion ? 'Aktion bearbeiten' : 'Neue Marketing-Aktion'}
                                {selectedMonth !== null && ` — ${MONATE[selectedMonth]}`}
                            </h2>
                            <button className="mj-close-btn" onClick={closeModal}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mj-modal-body">
                            <div className="mj-field">
                                <label>Titel *</label>
                                <input
                                    type="text"
                                    value={formData.titel}
                                    onChange={e => setFormData({ ...formData, titel: e.target.value })}
                                    placeholder="z.B. Oster-Rabattaktion"
                                    className="mj-input"
                                />
                            </div>

                            <div className="mj-form-row">
                                <div className="mj-field">
                                    <label>Aktionstyp</label>
                                    <select
                                        value={formData.typ}
                                        onChange={e => setFormData({ ...formData, typ: e.target.value })}
                                        className="mj-select"
                                    >
                                        {Object.entries(AKTIONS_TYPEN).map(([key, val]) => (
                                            <option key={key} value={key}>{val.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mj-field">
                                    <label>Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="mj-select"
                                    >
                                        <option value="geplant">Geplant</option>
                                        <option value="in_vorbereitung">In Vorbereitung</option>
                                        <option value="aktiv">Aktiv</option>
                                        <option value="abgeschlossen">Abgeschlossen</option>
                                        <option value="abgebrochen">Abgebrochen</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mj-form-row">
                                <div className="mj-field">
                                    <label>Startdatum *</label>
                                    <input
                                        type="date"
                                        value={formData.start_datum}
                                        onChange={e => setFormData({ ...formData, start_datum: e.target.value })}
                                        className="mj-input"
                                    />
                                </div>

                                <div className="mj-field">
                                    <label>Enddatum</label>
                                    <input
                                        type="date"
                                        value={formData.end_datum}
                                        onChange={e => setFormData({ ...formData, end_datum: e.target.value })}
                                        className="mj-input"
                                    />
                                </div>
                            </div>

                            <div className="mj-field">
                                <label>Beschreibung</label>
                                <textarea
                                    value={formData.beschreibung}
                                    onChange={e => setFormData({ ...formData, beschreibung: e.target.value })}
                                    placeholder="Was soll bei dieser Aktion passieren?"
                                    rows={3}
                                    className="mj-textarea"
                                />
                            </div>

                            <div className="mj-form-row">
                                <div className="mj-field">
                                    <label>Zielgruppe</label>
                                    <input
                                        type="text"
                                        value={formData.zielgruppe}
                                        onChange={e => setFormData({ ...formData, zielgruppe: e.target.value })}
                                        placeholder="z.B. Neukunden, Familien"
                                        className="mj-input"
                                    />
                                </div>

                                <div className="mj-field">
                                    <label>Budget (EUR)</label>
                                    <input
                                        type="number"
                                        value={formData.budget}
                                        onChange={e => setFormData({ ...formData, budget: e.target.value })}
                                        placeholder="0"
                                        className="mj-input"
                                    />
                                </div>
                            </div>

                            <div className="mj-field">
                                <label>Notizen</label>
                                <textarea
                                    value={formData.notizen}
                                    onChange={e => setFormData({ ...formData, notizen: e.target.value })}
                                    placeholder="Zusätzliche Notizen..."
                                    rows={2}
                                    className="mj-textarea"
                                />
                            </div>
                        </div>

                        <div className="mj-modal-footer">
                            <button className="mj-btn-cancel" onClick={closeModal}>
                                Abbrechen
                            </button>
                            <button className="mj-btn-save" onClick={saveAktion}>
                                {editingAktion ? 'Speichern' : 'Erstellen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketingJahresplan;
