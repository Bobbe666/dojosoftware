// =============================================================================
// MARKETING-JAHRESPLAN KOMPONENTE
// =============================================================================
// Jahresübersicht für Marketing-Aktionen mit Kalender und Planung
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
    'social_media': { label: 'Social Media', icon: Megaphone, color: '#3b82f6' },
    'email_kampagne': { label: 'E-Mail Kampagne', icon: Mail, color: '#8b5cf6' },
    'rabatt_aktion': { label: 'Rabatt-Aktion', icon: Gift, color: '#10b981' },
    'event': { label: 'Event/Veranstaltung', icon: Calendar, color: '#f59e0b' },
    'mitgliederwerbung': { label: 'Mitgliederwerbung', icon: Users, color: '#ec4899' },
    'sonstiges': { label: 'Sonstiges', icon: Star, color: '#6b7280' }
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
        loadAktionen();
    }, [selectedYear]);

    const loadAktionen = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch(
                `${config.apiBaseUrl}/marketing-jahresplan?jahr=${selectedYear}`,
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
            const url = editingAktion
                ? `${config.apiBaseUrl}/marketing-jahresplan/${editingAktion.id}`
                : `${config.apiBaseUrl}/marketing-jahresplan`;

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
                `${config.apiBaseUrl}/marketing-jahresplan/${id}`,
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
                `${config.apiBaseUrl}/marketing-jahresplan/${id}/status`,
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
        return aktionen.filter(a => {
            const startDate = new Date(a.start_datum);
            return startDate.getMonth() === month && startDate.getFullYear() === selectedYear;
        });
    };

    const getStatusBadge = (status) => {
        const config = {
            'geplant': { class: 'status-planned', text: 'Geplant', icon: Clock },
            'in_vorbereitung': { class: 'status-preparing', text: 'In Vorbereitung', icon: Edit3 },
            'aktiv': { class: 'status-active', text: 'Aktiv', icon: Target },
            'abgeschlossen': { class: 'status-completed', text: 'Abgeschlossen', icon: CheckCircle },
            'abgebrochen': { class: 'status-cancelled', text: 'Abgebrochen', icon: AlertCircle }
        };
        const c = config[status] || { class: '', text: status, icon: Clock };
        const Icon = c.icon;
        return (
            <span className={`jahresplan-status-badge ${c.class}`}>
                <Icon size={12} /> {c.text}
            </span>
        );
    };

    // ==========================================================================
    // RENDER
    // ==========================================================================

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner-large"></div>
                <p>Jahresplan wird geladen...</p>
            </div>
        );
    }

    return (
        <div className="marketing-jahresplan">
            {/* Message Banner */}
            {message.text && (
                <div className={`jahresplan-message ${message.type}`}>
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Header mit Jahresauswahl */}
            <div className="jahresplan-header">
                <button
                    className="btn btn-icon"
                    onClick={() => setSelectedYear(y => y - 1)}
                >
                    <ChevronLeft size={20} />
                </button>
                <h2>
                    <Calendar size={24} />
                    Marketing-Jahresplan {selectedYear}
                </h2>
                <button
                    className="btn btn-icon"
                    onClick={() => setSelectedYear(y => y + 1)}
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Statistik */}
            <div className="jahresplan-stats">
                <div className="stat-item">
                    <span className="stat-number">{aktionen.length}</span>
                    <span className="stat-label">Aktionen gesamt</span>
                </div>
                <div className="stat-item">
                    <span className="stat-number">{aktionen.filter(a => a.status === 'geplant').length}</span>
                    <span className="stat-label">Geplant</span>
                </div>
                <div className="stat-item">
                    <span className="stat-number">{aktionen.filter(a => a.status === 'aktiv').length}</span>
                    <span className="stat-label">Aktiv</span>
                </div>
                <div className="stat-item">
                    <span className="stat-number">{aktionen.filter(a => a.status === 'abgeschlossen').length}</span>
                    <span className="stat-label">Abgeschlossen</span>
                </div>
            </div>

            {/* Kalender-Grid */}
            <div className="jahresplan-grid">
                {MONATE.map((monat, index) => {
                    const monatsAktionen = getAktionenForMonth(index);
                    const isCurrentMonth = new Date().getMonth() === index && new Date().getFullYear() === selectedYear;

                    return (
                        <div
                            key={index}
                            className={`monat-card ${isCurrentMonth ? 'current-month' : ''}`}
                        >
                            <div className="monat-header">
                                <h3>{monat}</h3>
                                <button
                                    className="btn btn-icon btn-sm"
                                    onClick={() => openModal(index)}
                                    title="Neue Aktion"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            <div className="monat-content">
                                {monatsAktionen.length === 0 ? (
                                    <div className="monat-empty">
                                        <p>Keine Aktionen</p>
                                        <div className="vorschlaege">
                                            <span className="vorschlaege-label">Ideen:</span>
                                            {MARKETING_VORSCHLAEGE[index + 1]?.map((v, i) => (
                                                <button
                                                    key={i}
                                                    className="vorschlag-chip"
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
                                    <div className="aktionen-liste">
                                        {monatsAktionen.map(aktion => {
                                            const TypeIcon = AKTIONS_TYPEN[aktion.typ]?.icon || Star;
                                            const typeColor = AKTIONS_TYPEN[aktion.typ]?.color || '#6b7280';

                                            return (
                                                <div
                                                    key={aktion.id}
                                                    className="aktion-item"
                                                    style={{ borderLeftColor: typeColor }}
                                                >
                                                    <div className="aktion-icon" style={{ color: typeColor }}>
                                                        <TypeIcon size={16} />
                                                    </div>
                                                    <div className="aktion-info">
                                                        <strong>{aktion.titel}</strong>
                                                        <span className="aktion-datum">
                                                            {new Date(aktion.start_datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                                                        </span>
                                                        {getStatusBadge(aktion.status)}
                                                    </div>
                                                    <div className="aktion-actions">
                                                        <button
                                                            className="btn btn-icon btn-xs"
                                                            onClick={() => openModal(index, aktion)}
                                                            title="Bearbeiten"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button
                                                            className="btn btn-icon btn-xs btn-danger"
                                                            onClick={() => deleteAktion(aktion.id)}
                                                            title="Löschen"
                                                        >
                                                            <Trash2 size={14} />
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
            <div className="jahresplan-legende">
                <h4>Aktionstypen:</h4>
                <div className="legende-items">
                    {Object.entries(AKTIONS_TYPEN).map(([key, val]) => {
                        const Icon = val.icon;
                        return (
                            <span key={key} className="legende-item" style={{ color: val.color }}>
                                <Icon size={14} /> {val.label}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Modal für Aktion erstellen/bearbeiten */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content jahresplan-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                {editingAktion ? 'Aktion bearbeiten' : 'Neue Marketing-Aktion'}
                                {selectedMonth !== null && ` - ${MONATE[selectedMonth]}`}
                            </h2>
                            <button className="close-button" onClick={closeModal}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label>Titel *</label>
                                <input
                                    type="text"
                                    value={formData.titel}
                                    onChange={e => setFormData({ ...formData, titel: e.target.value })}
                                    placeholder="z.B. Oster-Rabattaktion"
                                    className="form-input"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Aktionstyp</label>
                                    <select
                                        value={formData.typ}
                                        onChange={e => setFormData({ ...formData, typ: e.target.value })}
                                        className="form-select"
                                    >
                                        {Object.entries(AKTIONS_TYPEN).map(([key, val]) => (
                                            <option key={key} value={key}>{val.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="form-select"
                                    >
                                        <option value="geplant">Geplant</option>
                                        <option value="in_vorbereitung">In Vorbereitung</option>
                                        <option value="aktiv">Aktiv</option>
                                        <option value="abgeschlossen">Abgeschlossen</option>
                                        <option value="abgebrochen">Abgebrochen</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Startdatum *</label>
                                    <input
                                        type="date"
                                        value={formData.start_datum}
                                        onChange={e => setFormData({ ...formData, start_datum: e.target.value })}
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Enddatum</label>
                                    <input
                                        type="date"
                                        value={formData.end_datum}
                                        onChange={e => setFormData({ ...formData, end_datum: e.target.value })}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Beschreibung</label>
                                <textarea
                                    value={formData.beschreibung}
                                    onChange={e => setFormData({ ...formData, beschreibung: e.target.value })}
                                    placeholder="Was soll bei dieser Aktion passieren?"
                                    rows={3}
                                    className="form-textarea"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Zielgruppe</label>
                                    <input
                                        type="text"
                                        value={formData.zielgruppe}
                                        onChange={e => setFormData({ ...formData, zielgruppe: e.target.value })}
                                        placeholder="z.B. Neukunden, Familien"
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Budget (EUR)</label>
                                    <input
                                        type="number"
                                        value={formData.budget}
                                        onChange={e => setFormData({ ...formData, budget: e.target.value })}
                                        placeholder="0"
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Notizen</label>
                                <textarea
                                    value={formData.notizen}
                                    onChange={e => setFormData({ ...formData, notizen: e.target.value })}
                                    placeholder="Zusätzliche Notizen..."
                                    rows={2}
                                    className="form-textarea"
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={closeModal}>
                                Abbrechen
                            </button>
                            <button className="btn btn-primary" onClick={saveAktion}>
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
