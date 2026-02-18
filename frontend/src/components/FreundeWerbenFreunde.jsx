// =============================================================================
// FREUNDE WERBEN FREUNDE - REFERRAL KOMPONENTE
// =============================================================================
// Verwaltung des Referral-Systems mit Einstellungen, Codes und Prämien
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import config from '../config/config.js';
import {
    Users,
    Gift,
    Settings,
    Award,
    TrendingUp,
    Plus,
    Trash2,
    Edit3,
    Check,
    X,
    Copy,
    Euro,
    Calendar,
    UserPlus,
    CheckCircle,
    AlertCircle,
    Clock,
    CreditCard,
    Banknote,
    RefreshCw
} from 'lucide-react';

const FreundeWerbenFreunde = ({ marketingAktionId = null }) => {
    const { token } = useAuth();

    // Tabs
    const [activeTab, setActiveTab] = useState('uebersicht');

    // State
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState(null);
    const [staffel, setStaffel] = useState([]);
    const [werbungen, setWerbungen] = useState([]);
    const [praemien, setPraemien] = useState([]);
    const [statistiken, setStatistiken] = useState(null);
    const [codes, setCodes] = useState([]);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Modals
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showStaffelModal, setShowStaffelModal] = useState(false);
    const [editingStaffel, setEditingStaffel] = useState(null);

    // Form States
    const [settingsForm, setSettingsForm] = useState({
        aktiv: false,
        standard_praemie: 50,
        max_kostenlos_monate: 12,
        mitglieder_fuer_max: 15,
        auszahlungsmodus: 'mitglied_waehlt',
        mindest_vertragslaufzeit_monate: 1
    });

    const [staffelForm, setStaffelForm] = useState({
        min_vertragslaufzeit_monate: 12,
        praemie_betrag: 50,
        beschreibung: ''
    });

    // ==========================================================================
    // DATA LOADING
    // ==========================================================================

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Immer Settings laden
            await loadSettings();

            if (activeTab === 'uebersicht') {
                await loadStatistiken();
            } else if (activeTab === 'werbungen') {
                await loadWerbungen();
            } else if (activeTab === 'praemien') {
                await loadPraemien();
            } else if (activeTab === 'codes') {
                await loadCodes();
            } else if (activeTab === 'einstellungen') {
                await loadStaffel();
            }

        } catch (error) {
            console.error('Fehler beim Laden:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/referral/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSettings(data);
                setSettingsForm({
                    aktiv: data.aktiv || false,
                    standard_praemie: data.standard_praemie || 50,
                    max_kostenlos_monate: data.max_kostenlos_monate || 12,
                    mitglieder_fuer_max: data.mitglieder_fuer_max || 15,
                    auszahlungsmodus: data.auszahlungsmodus || 'mitglied_waehlt',
                    mindest_vertragslaufzeit_monate: data.mindest_vertragslaufzeit_monate || 1
                });
            }
        } catch (error) {
            console.error('Fehler beim Laden der Settings:', error);
        }
    };

    const loadStaffel = async () => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/referral/staffel`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setStaffel(data);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Staffel:', error);
        }
    };

    const loadStatistiken = async () => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/referral/statistiken`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setStatistiken(data);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Statistiken:', error);
        }
    };

    const loadWerbungen = async () => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/referral/werbungen`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setWerbungen(data);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Werbungen:', error);
        }
    };

    const loadPraemien = async () => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/referral/praemien`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setPraemien(data);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Prämien:', error);
        }
    };

    const loadCodes = async () => {
        try {
            let url = `${config.apiBaseUrl}/referral/codes`;
            if (marketingAktionId) {
                url += `?marketing_aktion_id=${marketingAktionId}`;
            }
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setCodes(data);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Codes:', error);
        }
    };

    // ==========================================================================
    // SAVE FUNCTIONS
    // ==========================================================================

    const saveSettings = async () => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/referral/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(settingsForm)
            });

            if (response.ok) {
                showMessage('success', 'Einstellungen gespeichert');
                setShowSettingsModal(false);
                loadSettings();
            } else {
                showMessage('error', 'Fehler beim Speichern');
            }
        } catch (error) {
            console.error('Fehler beim Speichern:', error);
            showMessage('error', 'Fehler beim Speichern');
        }
    };

    const saveStaffel = async () => {
        try {
            const url = editingStaffel
                ? `${config.apiBaseUrl}/referral/staffel/${editingStaffel.id}`
                : `${config.apiBaseUrl}/referral/staffel`;

            const response = await fetch(url, {
                method: editingStaffel ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(staffelForm)
            });

            if (response.ok) {
                showMessage('success', editingStaffel ? 'Staffelung aktualisiert' : 'Staffelung hinzugefügt');
                setShowStaffelModal(false);
                setEditingStaffel(null);
                setStaffelForm({ min_vertragslaufzeit_monate: 12, praemie_betrag: 50, beschreibung: '' });
                loadStaffel();
            } else {
                showMessage('error', 'Fehler beim Speichern');
            }
        } catch (error) {
            console.error('Fehler beim Speichern:', error);
            showMessage('error', 'Fehler beim Speichern');
        }
    };

    const deleteStaffel = async (id) => {
        if (!confirm('Staffelung wirklich löschen?')) return;

        try {
            const response = await fetch(`${config.apiBaseUrl}/referral/staffel/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                showMessage('success', 'Staffelung gelöscht');
                loadStaffel();
            }
        } catch (error) {
            console.error('Fehler beim Löschen:', error);
        }
    };

    const generateBulkCodes = async () => {
        if (!marketingAktionId) {
            showMessage('error', 'Bitte zuerst eine Marketing-Aktion auswählen');
            return;
        }

        try {
            const response = await fetch(`${config.apiBaseUrl}/referral/codes/generate-bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ marketing_aktion_id: marketingAktionId })
            });

            if (response.ok) {
                const data = await response.json();
                showMessage('success', `${data.generated} Codes generiert`);
                loadCodes();
            }
        } catch (error) {
            console.error('Fehler beim Generieren:', error);
            showMessage('error', 'Fehler beim Generieren der Codes');
        }
    };

    const auszahlenPraemie = async (id, typ) => {
        try {
            const response = await fetch(`${config.apiBaseUrl}/referral/praemien/${id}/auszahlen`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ typ })
            });

            if (response.ok) {
                showMessage('success', 'Prämie als ausgezahlt markiert');
                loadPraemien();
            }
        } catch (error) {
            console.error('Fehler beim Auszahlen:', error);
            showMessage('error', 'Fehler beim Auszahlen');
        }
    };

    // ==========================================================================
    // HELPERS
    // ==========================================================================

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showMessage('success', 'Code kopiert!');
    };

    const getStatusBadge = (status) => {
        const config = {
            'registriert': { class: 'status-pending', text: 'Registriert', icon: UserPlus },
            'vertrag_abgeschlossen': { class: 'status-info', text: 'Vertrag', icon: CheckCircle },
            'erste_zahlung': { class: 'status-info', text: 'Zahlung erfolgt', icon: CreditCard },
            'praemie_freigegeben': { class: 'status-success', text: 'Freigegeben', icon: Award },
            'praemie_ausgezahlt': { class: 'status-completed', text: 'Ausgezahlt', icon: Check },
            'storniert': { class: 'status-cancelled', text: 'Storniert', icon: X },
            'ausstehend': { class: 'status-pending', text: 'Ausstehend', icon: Clock },
            'freigegeben': { class: 'status-success', text: 'Freigegeben', icon: Award },
            'ausgezahlt': { class: 'status-completed', text: 'Ausgezahlt', icon: Check }
        };
        const c = config[status] || { class: '', text: status, icon: Clock };
        const Icon = c.icon;
        return (
            <span className={`referral-status-badge ${c.class}`}>
                <Icon size={12} /> {c.text}
            </span>
        );
    };

    // ==========================================================================
    // TABS
    // ==========================================================================

    const tabs = [
        { id: 'uebersicht', label: 'Übersicht', icon: TrendingUp },
        { id: 'werbungen', label: 'Werbungen', icon: Users },
        { id: 'praemien', label: 'Prämien', icon: Gift },
        { id: 'codes', label: 'Codes', icon: Award },
        { id: 'einstellungen', label: 'Einstellungen', icon: Settings }
    ];

    // ==========================================================================
    // RENDER
    // ==========================================================================

    if (loading && !settings) {
        return (
            <div className="loading-container">
                <div className="loading-spinner-large"></div>
                <p>Wird geladen...</p>
            </div>
        );
    }

    return (
        <div className="freunde-werben-freunde">
            {/* Message Banner */}
            {message.text && (
                <div className={`referral-message ${message.type}`}>
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Header */}
            <div className="referral-header">
                <div className="referral-title">
                    <Users size={24} />
                    <h2>Freunde werben Freunde</h2>
                    <span className={`status-indicator ${settings?.aktiv ? 'active' : 'inactive'}`}>
                        {settings?.aktiv ? 'Aktiv' : 'Inaktiv'}
                    </span>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowSettingsModal(true)}
                >
                    <Settings size={16} /> Einstellungen
                </button>
            </div>

            {/* Tabs */}
            <div className="referral-tabs">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            className={`referral-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="referral-content">
                {/* ÜBERSICHT */}
                {activeTab === 'uebersicht' && statistiken && (
                    <div className="referral-uebersicht">
                        {/* Stats Grid */}
                        <div className="referral-stats-grid">
                            <div className="referral-stat-card">
                                <div className="stat-icon"><Users size={24} /></div>
                                <div className="stat-value">{statistiken.gesamt?.werbungen || 0}</div>
                                <div className="stat-label">Werbungen gesamt</div>
                            </div>
                            <div className="referral-stat-card success">
                                <div className="stat-icon"><CheckCircle size={24} /></div>
                                <div className="stat-value">{statistiken.gesamt?.ausgezahlt || 0}</div>
                                <div className="stat-label">Ausgezahlt</div>
                            </div>
                            <div className="referral-stat-card warning">
                                <div className="stat-icon"><Clock size={24} /></div>
                                <div className="stat-value">{statistiken.gesamt?.freigegeben || 0}</div>
                                <div className="stat-label">Freigegeben</div>
                            </div>
                            <div className="referral-stat-card info">
                                <div className="stat-icon"><Award size={24} /></div>
                                <div className="stat-value">{statistiken.gesamt?.ausstehend || 0}</div>
                                <div className="stat-label">Ausstehend</div>
                            </div>
                        </div>

                        {/* Prämien Summen */}
                        <div className="referral-praemien-summen">
                            <div className="praemien-card">
                                <Euro size={20} />
                                <span className="amount">{parseFloat(statistiken.praemien?.ausgezahlt || 0).toFixed(2)} EUR</span>
                                <span className="label">Ausgezahlt</span>
                            </div>
                            <div className="praemien-card pending">
                                <Euro size={20} />
                                <span className="amount">{parseFloat(statistiken.praemien?.offen || 0).toFixed(2)} EUR</span>
                                <span className="label">Offen</span>
                            </div>
                        </div>

                        {/* Top Werber */}
                        {statistiken.top_werber?.length > 0 && (
                            <div className="top-werber-section">
                                <h3><Award size={18} /> Top Werber</h3>
                                <div className="top-werber-list">
                                    {statistiken.top_werber.map((w, i) => (
                                        <div key={w.werber_mitglied_id} className="top-werber-item">
                                            <span className="rang">#{i + 1}</span>
                                            <span className="name">{w.name}</span>
                                            <span className="count">{w.anzahl_werbungen} Werbungen</span>
                                            <span className="erfolg">{w.erfolgreiche} erfolgreich</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* WERBUNGEN */}
                {activeTab === 'werbungen' && (
                    <div className="referral-werbungen">
                        <div className="section-header">
                            <h3>Alle Werbungen</h3>
                            <button className="btn btn-icon" onClick={loadWerbungen}>
                                <RefreshCw size={16} />
                            </button>
                        </div>

                        {werbungen.length === 0 ? (
                            <div className="empty-state">
                                <Users size={48} />
                                <p>Noch keine Werbungen</p>
                            </div>
                        ) : (
                            <div className="werbungen-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Werber</th>
                                            <th>Geworbener</th>
                                            <th>Code</th>
                                            <th>Status</th>
                                            <th>Prämie</th>
                                            <th>Datum</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {werbungen.map(w => (
                                            <tr key={w.id}>
                                                <td>{w.werber_name}</td>
                                                <td>{w.geworbener_name || '-'}</td>
                                                <td><code>{w.referral_code}</code></td>
                                                <td>{getStatusBadge(w.status)}</td>
                                                <td>
                                                    {w.praemie_betrag ? `${parseFloat(w.praemie_betrag).toFixed(2)} EUR` : '-'}
                                                </td>
                                                <td>{new Date(w.erstellt_am).toLocaleDateString('de-DE')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* PRÄMIEN */}
                {activeTab === 'praemien' && (
                    <div className="referral-praemien">
                        <div className="section-header">
                            <h3>Prämien-Übersicht</h3>
                        </div>

                        {praemien.length === 0 ? (
                            <div className="empty-state">
                                <Gift size={48} />
                                <p>Noch keine Prämien</p>
                            </div>
                        ) : (
                            <div className="praemien-list">
                                {praemien.map(p => (
                                    <div key={p.id} className="praemie-card">
                                        <div className="praemie-info">
                                            <strong>{p.mitglied_name}</strong>
                                            <span>Hat geworben: {p.geworbener_name}</span>
                                            <div className="praemie-amount">
                                                <Euro size={16} />
                                                {parseFloat(p.betrag).toFixed(2)} EUR
                                            </div>
                                            {getStatusBadge(p.status)}
                                        </div>
                                        <div className="praemie-actions">
                                            {p.status === 'freigegeben' && (
                                                <>
                                                    <button
                                                        className="btn btn-sm btn-success"
                                                        onClick={() => auszahlenPraemie(p.id, 'gutschrift')}
                                                    >
                                                        <CreditCard size={14} /> Gutschrift
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => auszahlenPraemie(p.id, 'bar')}
                                                    >
                                                        <Banknote size={14} /> Bar
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* CODES */}
                {activeTab === 'codes' && (
                    <div className="referral-codes">
                        <div className="section-header">
                            <h3>Referral-Codes</h3>
                            <button className="btn btn-primary" onClick={generateBulkCodes}>
                                <Plus size={16} /> Codes für alle Mitglieder generieren
                            </button>
                        </div>

                        {codes.length === 0 ? (
                            <div className="empty-state">
                                <Award size={48} />
                                <p>Noch keine Codes</p>
                            </div>
                        ) : (
                            <div className="codes-grid">
                                {codes.map(c => (
                                    <div key={c.id} className={`code-card ${!c.aktiv ? 'inactive' : ''}`}>
                                        <div className="code-header">
                                            <span className="mitglied-name">{c.mitglied_name}</span>
                                            {c.aktion_titel && <span className="aktion">{c.aktion_titel}</span>}
                                        </div>
                                        <div className="code-value">
                                            <code>{c.code}</code>
                                            <button
                                                className="btn btn-icon btn-xs"
                                                onClick={() => copyToClipboard(c.code)}
                                            >
                                                <Copy size={14} />
                                            </button>
                                        </div>
                                        <div className="code-stats">
                                            <span>{c.aktuelle_verwendungen} Verwendungen</span>
                                            {c.gueltig_bis && (
                                                <span>bis {new Date(c.gueltig_bis).toLocaleDateString('de-DE')}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* EINSTELLUNGEN */}
                {activeTab === 'einstellungen' && (
                    <div className="referral-einstellungen">
                        {/* Haupt-Konfiguration */}
                        <div className="einstellungen-section">
                            <div className="section-header">
                                <h3 style={{ color: '#FFD700', textShadow: '0 2px 4px rgba(0,0,0,0.8)', WebkitTextStroke: '0', textTransform: 'none', letterSpacing: 'normal', background: 'none', WebkitBackgroundClip: 'unset', WebkitTextFillColor: '#FFD700' }}><Settings size={20} /> Grundeinstellungen</h3>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => setShowSettingsModal(true)}
                                >
                                    <Edit3 size={14} /> Bearbeiten
                                </button>
                            </div>

                            <div className="settings-cards">
                                {/* Status */}
                                <div className="settings-card highlight">
                                    <div className="settings-card-header">
                                        <span className="settings-card-icon">{settings?.aktiv ? <CheckCircle size={20} /> : <X size={20} />}</span>
                                        <span className="settings-card-title">Status</span>
                                    </div>
                                    <div className={`settings-card-value ${settings?.aktiv ? 'success' : 'muted'}`}>
                                        {settings?.aktiv ? 'Programm aktiv' : 'Programm inaktiv'}
                                    </div>
                                </div>

                                {/* Standard-Prämie */}
                                <div className="settings-card">
                                    <div className="settings-card-header">
                                        <span className="settings-card-icon"><Euro size={20} /></span>
                                        <span className="settings-card-title">Standard-Prämie</span>
                                    </div>
                                    <div className="settings-card-value">{settings?.standard_praemie || 50} EUR</div>
                                    <div className="settings-card-desc">Pro erfolgreicher Werbung</div>
                                </div>

                                {/* Auszahlungsmodus */}
                                <div className="settings-card">
                                    <div className="settings-card-header">
                                        <span className="settings-card-icon"><CreditCard size={20} /></span>
                                        <span className="settings-card-title">Auszahlung</span>
                                    </div>
                                    <div className="settings-card-value">
                                        {settings?.auszahlungsmodus === 'fest_gutschrift' && 'Gutschrift (fest)'}
                                        {settings?.auszahlungsmodus === 'fest_bar' && 'Bar (fest)'}
                                        {settings?.auszahlungsmodus === 'mitglied_waehlt' && 'Mitglied wählt'}
                                    </div>
                                    <div className="settings-card-desc">
                                        {settings?.auszahlungsmodus === 'mitglied_waehlt'
                                            ? 'Mitglied entscheidet: Gutschrift oder Bar'
                                            : 'Vom Admin festgelegt'}
                                    </div>
                                </div>

                                {/* Mind. Vertragslaufzeit */}
                                <div className="settings-card">
                                    <div className="settings-card-header">
                                        <span className="settings-card-icon"><Calendar size={20} /></span>
                                        <span className="settings-card-title">Mindest-Vertragslaufzeit</span>
                                    </div>
                                    <div className="settings-card-value">{settings?.mindest_vertragslaufzeit_monate || 1} Monat(e)</div>
                                    <div className="settings-card-desc">Geworbener muss mindestens so lange bleiben</div>
                                </div>
                            </div>

                            {/* Bonus-System Erklärung */}
                            <div className="bonus-system-info">
                                <h4><Award size={18} /> Bonus-System: Bis zu {settings?.max_kostenlos_monate || 12} Monate kostenlos</h4>
                                <p>
                                    Wer <strong>{settings?.mitglieder_fuer_max || 15} Mitglieder</strong> wirbt, erhält bis zu
                                    <strong> {settings?.max_kostenlos_monate || 12} Monate</strong> kostenloses Training.
                                </p>
                                <div className="bonus-scale">
                                    <div className="bonus-item">1 Werbung = {settings?.standard_praemie || 50} EUR</div>
                                    <div className="bonus-item">{Math.ceil((settings?.mitglieder_fuer_max || 15) / 2)} Werbungen = {Math.ceil((settings?.max_kostenlos_monate || 12) / 2)} Monate frei</div>
                                    <div className="bonus-item highlight">{settings?.mitglieder_fuer_max || 15} Werbungen = {settings?.max_kostenlos_monate || 12} Monate frei</div>
                                </div>
                            </div>
                        </div>

                        {/* Prämien-Staffelung nach Vertragslaufzeit */}
                        <div className="einstellungen-section">
                            <div className="section-header">
                                <h3 style={{ color: '#FFD700', textShadow: '0 2px 4px rgba(0,0,0,0.8)', WebkitTextStroke: '0', textTransform: 'none', letterSpacing: 'normal', background: 'none', WebkitBackgroundClip: 'unset', WebkitTextFillColor: '#FFD700' }}><TrendingUp size={20} /> Prämien-Staffelung nach Vertragslaufzeit</h3>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => {
                                        setEditingStaffel(null);
                                        setStaffelForm({ min_vertragslaufzeit_monate: 12, praemie_betrag: 50, beschreibung: '' });
                                        setShowStaffelModal(true);
                                    }}
                                >
                                    <Plus size={14} /> Staffelung hinzufügen
                                </button>
                            </div>

                            <p className="section-description">
                                Je länger der Vertrag des geworbenen Mitglieds, desto höher die Prämie für den Werber.
                            </p>

                            {staffel.length === 0 ? (
                                <div className="empty-staffel">
                                    <TrendingUp size={32} />
                                    <p>Keine Staffelung definiert</p>
                                    <span>Es wird immer die Standard-Prämie von {settings?.standard_praemie || 50} EUR verwendet.</span>
                                </div>
                            ) : (
                                <div className="staffel-list">
                                    {staffel.map(s => (
                                        <div key={s.id} className="staffel-item">
                                            <div className="staffel-info">
                                                <strong>Ab {s.min_vertragslaufzeit_monate} Monate Vertragslaufzeit</strong>
                                                <span className="praemie">{parseFloat(s.praemie_betrag).toFixed(2)} EUR Prämie</span>
                                                {s.beschreibung && <p className="staffel-desc">{s.beschreibung}</p>}
                                            </div>
                                            <div className="staffel-actions">
                                                <button
                                                    className="btn btn-icon btn-xs"
                                                    onClick={() => {
                                                        setEditingStaffel(s);
                                                        setStaffelForm({
                                                            min_vertragslaufzeit_monate: s.min_vertragslaufzeit_monate,
                                                            praemie_betrag: s.praemie_betrag,
                                                            beschreibung: s.beschreibung || ''
                                                        });
                                                        setShowStaffelModal(true);
                                                    }}
                                                    title="Bearbeiten"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-icon btn-xs btn-danger"
                                                    onClick={() => deleteStaffel(s.id)}
                                                    title="Löschen"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Info-Box: Ablauf */}
                        <div className="einstellungen-section info-section">
                            <h3 style={{ color: '#60a5fa', textShadow: '0 2px 4px rgba(0,0,0,0.8)', WebkitTextStroke: '0', textTransform: 'none', letterSpacing: 'normal', background: 'none', WebkitBackgroundClip: 'unset', WebkitTextFillColor: '#60a5fa' }}><AlertCircle size={20} /> So funktioniert die Auszahlung</h3>
                            <div className="process-steps">
                                <div className="process-step">
                                    <span className="step-number">1</span>
                                    <div className="step-content">
                                        <strong>Mitglied erhält Code</strong>
                                        <p>Jedes Mitglied kann Codes für Marketing-Aktionen erhalten</p>
                                    </div>
                                </div>
                                <div className="process-step">
                                    <span className="step-number">2</span>
                                    <div className="step-content">
                                        <strong>Freund registriert sich mit Code</strong>
                                        <p>Der Geworbene gibt den Code bei der Registrierung ein</p>
                                    </div>
                                </div>
                                <div className="process-step">
                                    <span className="step-number">3</span>
                                    <div className="step-content">
                                        <strong>Vertrag wird abgeschlossen</strong>
                                        <p>Der Geworbene schließt einen Vertrag ab</p>
                                    </div>
                                </div>
                                <div className="process-step">
                                    <span className="step-number">4</span>
                                    <div className="step-content">
                                        <strong>Erste Zahlung erfolgt</strong>
                                        <p>Prämie wird erst nach erfolgreicher erster Abbuchung freigegeben</p>
                                    </div>
                                </div>
                                <div className="process-step success">
                                    <span className="step-number"><Check size={16} /></span>
                                    <div className="step-content">
                                        <strong>Prämie auszahlbar</strong>
                                        <p>Als Gutschrift verrechnen oder bar auszahlen</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
                    <div className="modal-content referral-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2><Settings size={20} /> Referral-Einstellungen</h2>
                            <button className="close-button" onClick={() => setShowSettingsModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="toggle-label">
                                    <input
                                        type="checkbox"
                                        checked={settingsForm.aktiv}
                                        onChange={e => setSettingsForm({ ...settingsForm, aktiv: e.target.checked })}
                                    />
                                    <span>Freunde werben Freunde aktivieren</span>
                                </label>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Standard-Prämie (EUR)</label>
                                    <input
                                        type="number"
                                        value={settingsForm.standard_praemie}
                                        onChange={e => setSettingsForm({ ...settingsForm, standard_praemie: parseFloat(e.target.value) })}
                                        className="form-input"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Mind. Vertragslaufzeit (Monate)</label>
                                    <input
                                        type="number"
                                        value={settingsForm.mindest_vertragslaufzeit_monate}
                                        onChange={e => setSettingsForm({ ...settingsForm, mindest_vertragslaufzeit_monate: parseInt(e.target.value) })}
                                        className="form-input"
                                        min="1"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Max. kostenlose Monate</label>
                                    <input
                                        type="number"
                                        value={settingsForm.max_kostenlos_monate}
                                        onChange={e => setSettingsForm({ ...settingsForm, max_kostenlos_monate: parseInt(e.target.value) })}
                                        className="form-input"
                                        min="1"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Mitglieder für Maximum</label>
                                    <input
                                        type="number"
                                        value={settingsForm.mitglieder_fuer_max}
                                        onChange={e => setSettingsForm({ ...settingsForm, mitglieder_fuer_max: parseInt(e.target.value) })}
                                        className="form-input"
                                        min="1"
                                    />
                                    <small>Bei {settingsForm.mitglieder_fuer_max} geworbenen Mitgliedern = {settingsForm.max_kostenlos_monate} Monate kostenlos</small>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Auszahlungsmodus</label>
                                <select
                                    value={settingsForm.auszahlungsmodus}
                                    onChange={e => setSettingsForm({ ...settingsForm, auszahlungsmodus: e.target.value })}
                                    className="form-select"
                                >
                                    <option value="mitglied_waehlt">Mitglied wählt selbst</option>
                                    <option value="fest_gutschrift">Fest: Als Gutschrift verrechnen</option>
                                    <option value="fest_bar">Fest: Bar auszahlen</option>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>
                                Abbrechen
                            </button>
                            <button className="btn btn-primary" onClick={saveSettings}>
                                Speichern
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Staffel Modal */}
            {showStaffelModal && (
                <div className="modal-overlay" onClick={() => setShowStaffelModal(false)}>
                    <div className="modal-content referral-modal small" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingStaffel ? 'Staffelung bearbeiten' : 'Neue Staffelung'}</h2>
                            <button className="close-button" onClick={() => setShowStaffelModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Min. Vertragslaufzeit (Monate)</label>
                                <input
                                    type="number"
                                    value={staffelForm.min_vertragslaufzeit_monate}
                                    onChange={e => setStaffelForm({ ...staffelForm, min_vertragslaufzeit_monate: parseInt(e.target.value) })}
                                    className="form-input"
                                    min="1"
                                />
                            </div>
                            <div className="form-group">
                                <label>Prämie (EUR)</label>
                                <input
                                    type="number"
                                    value={staffelForm.praemie_betrag}
                                    onChange={e => setStaffelForm({ ...staffelForm, praemie_betrag: parseFloat(e.target.value) })}
                                    className="form-input"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <div className="form-group">
                                <label>Beschreibung (optional)</label>
                                <input
                                    type="text"
                                    value={staffelForm.beschreibung}
                                    onChange={e => setStaffelForm({ ...staffelForm, beschreibung: e.target.value })}
                                    className="form-input"
                                    placeholder="z.B. 24-Monats-Vertrag Bonus"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowStaffelModal(false)}>
                                Abbrechen
                            </button>
                            <button className="btn btn-primary" onClick={saveStaffel}>
                                {editingStaffel ? 'Speichern' : 'Hinzufügen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FreundeWerbenFreunde;
