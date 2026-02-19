// =============================================================================
// BUDDY-GRUPPEN VERWALTUNG - ADMIN INTERFACE
// =============================================================================
// Dashboard-Komponente für die Verwaltung von Buddy-Gruppen und Einladungen
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import config from '../config/config.js';
import MarketingAktionen from './MarketingAktionen';
import MarketingJahresplan from './MarketingJahresplan';
import FreundeWerbenFreunde from './FreundeWerbenFreunde';
import { Users, Calendar, CalendarDays, Gift } from 'lucide-react';
import '../styles/Dashboard.css';
import '../styles/MarketingAktionen.css';
import '../styles/BuddyVerwaltung.css';

const BuddyVerwaltung = () => {
    const { token } = useAuth();

    // Tab State - Jahresplan ist der erste Tab
    const [activeTab, setActiveTab] = useState('jahresplan');

    // State Management
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Filter und Suche
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('alle');

    // Modal States
    const [showGroupDetails, setShowGroupDetails] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);

    // Buddy-Gruppen laden
    useEffect(() => {
        loadBuddyGroups();
    }, []);

    const loadBuddyGroups = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch(`${config.apiBaseUrl}/buddy/groups`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Fehler beim Laden der Buddy-Gruppen');
            }

            const data = await response.json();
            setGroups(data);

        } catch (err) {
            console.error('Fehler beim Laden der Buddy-Gruppen:', err);
            setError('Fehler beim Laden der Daten');
        } finally {
            setLoading(false);
        }
    };

    // Einzelne Gruppe mit Details laden
    const loadGroupDetails = async (groupId) => {
        try {
            setActionLoading(true);

            const response = await fetch(`/buddy/groups/${groupId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Fehler beim Laden der Gruppendetails');
            }

            const data = await response.json();
            setSelectedGroup(data);
            setShowGroupDetails(true);

        } catch (err) {
            console.error('Fehler beim Laden der Gruppendetails:', err);
            setError('Fehler beim Laden der Gruppendetails');
        } finally {
            setActionLoading(false);
        }
    };

    // Einladungs-Emails versenden
    const sendInvitations = async (groupId, invitationIds) => {
        try {
            setActionLoading(true);

            const response = await fetch(`${config.apiBaseUrl}/buddy/send-invitations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    groupId,
                    invitationIds
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Fehler beim Versenden der Einladungen');
            }

            // Erfolgsmeldung anzeigen
            alert(`✅ ${data.sent} Einladungen versendet, ${data.failed} fehlgeschlagen`);

            // Gruppendetails neu laden
            if (selectedGroup && selectedGroup.id === groupId) {
                await loadGroupDetails(groupId);
            }

            // Gruppenliste neu laden
            await loadBuddyGroups();

        } catch (err) {
            console.error('Fehler beim Versenden der Einladungen:', err);
            alert(`❌ Fehler: ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    // Erinnerungen versenden
    const sendReminders = async (groupId) => {
        try {
            setActionLoading(true);

            const response = await fetch(`/buddy/groups/${groupId}/resend-invitations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Fehler beim Versenden der Erinnerungen');
            }

            alert(`🔔 ${data.remindersSent} Erinnerungen versendet`);

            // Gruppendetails neu laden
            if (selectedGroup && selectedGroup.id === groupId) {
                await loadGroupDetails(groupId);
            }

        } catch (err) {
            console.error('Fehler beim Versenden der Erinnerungen:', err);
            alert(`❌ Fehler: ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    // Einladung löschen
    const deleteInvitation = async (invitationId, reason = 'Von Admin gelöscht') => {
        if (!confirm('Möchtest du diese Einladung wirklich löschen?')) {
            return;
        }

        try {
            setActionLoading(true);

            const response = await fetch(`/buddy/invitations/${invitationId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ reason })
            });

            if (!response.ok) {
                throw new Error('Fehler beim Löschen der Einladung');
            }

            alert('✅ Einladung gelöscht');

            // Gruppendetails neu laden
            if (selectedGroup) {
                await loadGroupDetails(selectedGroup.id);
            }

            // Gruppenliste neu laden
            await loadBuddyGroups();

        } catch (err) {
            console.error('Fehler beim Löschen der Einladung:', err);
            alert(`❌ Fehler: ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    // Gefilterte Gruppen
    const filteredGroups = groups.filter(group => {
        const matchesSearch = !searchTerm ||
            group.gruppe_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            group.id.toString().includes(searchTerm);

        const matchesStatus = statusFilter === 'alle' || group.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Status-Badge
    const getStatusBadge = (status) => {
        const statusConfig = {
            'aktiv': { class: 'status-active', text: 'Aktiv' },
            'inaktiv': { class: 'status-inactive', text: 'Inaktiv' },
            'geloescht': { class: 'status-deleted', text: 'Gelöscht' }
        };

        const config = statusConfig[status] || { class: 'status-unknown', text: status };
        return <span className={`status-badge ${config.class}`}>{config.text}</span>;
    };

    // Einladungsstatus-Badge
    const getInvitationStatusBadge = (status) => {
        const statusConfig = {
            'eingeladen': { class: 'invitation-pending', text: 'Eingeladen' },
            'email_gesendet': { class: 'invitation-sent', text: 'Email gesendet' },
            'registriert': { class: 'invitation-registered', text: 'Registriert' },
            'aktiviert': { class: 'invitation-active', text: 'Aktiviert' },
            'abgelehnt': { class: 'invitation-declined', text: 'Abgelehnt' },
            'abgelaufen': { class: 'invitation-expired', text: 'Abgelaufen' }
        };

        const config = statusConfig[status] || { class: 'invitation-unknown', text: status };
        return <span className={`invitation-badge ${config.class}`}>{config.text}</span>;
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner-large"></div>
                <p>Buddy-Gruppen werden geladen...</p>
            </div>
        );
    }

    return (
        <div className="buddy-verwaltung">
            {/* Header */}
            <div className="page-header">
                <h1 style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem',
                    position: 'relative',
                    backgroundImage: 'none !important',
                    WebkitBackgroundClip: 'unset !important',
                    WebkitTextFillColor: 'unset !important',
                    backgroundClip: 'unset !important',
                    color: 'transparent'
                }}>
                    <span style={{ 
                        fontSize: '1.8rem',
                        filter: 'drop-shadow(0 2px 8px rgba(255, 215, 0, 0.3))',
                        position: 'relative',
                        zIndex: 1000,
                        lineHeight: 1,
                        display: 'inline-block',
                        flexShrink: 0,
                        textShadow: 'none',
                        WebkitTextFillColor: 'unset',
                        backgroundImage: 'none',
                        WebkitBackgroundClip: 'unset',
                        backgroundClip: 'unset'
                    }}>👥</span>
                    <span style={{ 
                        WebkitFontSmoothing: 'antialiased',
                        MozOsxFontSmoothing: 'grayscale',
                        color: '#FFD700',
                        WebkitTextFillColor: '#FFD700',
                        backgroundImage: 'none',
                        WebkitBackgroundClip: 'unset',
                        backgroundClip: 'unset',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                        position: 'relative',
                        zIndex: 1
                    }}>Buddy-Gruppen Verwaltung</span>
                </h1>
                <p>Verwalte Freunde-Gruppen, Einladungen und Marketing-Aktionen</p>
            </div>

            {/* Tabs - Jahresplan zuerst */}
            <div className="buddy-tabs">
                <button
                    className={`buddy-tab ${activeTab === 'jahresplan' ? 'active' : ''}`}
                    onClick={() => setActiveTab('jahresplan')}
                >
                    <CalendarDays size={18} />
                    Jahresplan
                </button>
                <button
                    className={`buddy-tab ${activeTab === 'referral' ? 'active' : ''}`}
                    onClick={() => setActiveTab('referral')}
                >
                    <Gift size={18} />
                    Freunde werben
                </button>
                <button
                    className={`buddy-tab ${activeTab === 'aktionen' ? 'active' : ''}`}
                    onClick={() => setActiveTab('aktionen')}
                >
                    <Calendar size={18} />
                    Social Media
                </button>
                <button
                    className={`buddy-tab ${activeTab === 'gruppen' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gruppen')}
                >
                    <Users size={18} />
                    Buddy-Gruppen
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'jahresplan' ? (
                <MarketingJahresplan />
            ) : activeTab === 'referral' ? (
                <FreundeWerbenFreunde />
            ) : activeTab === 'aktionen' ? (
                <MarketingAktionen />
            ) : (
                <>

            {/* Filter und Suche */}
            <div className="filter-section">
                <div className="filter-row">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="Gruppe suchen (Name oder ID)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <div className="filter-controls">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="alle">Alle Status</option>
                            <option value="aktiv">Aktiv</option>
                            <option value="inaktiv">Inaktiv</option>
                            <option value="geloescht">Gelöscht</option>
                        </select>

                        <button
                            onClick={loadBuddyGroups}
                            className="logout-button"
                            disabled={loading}
                        >
                            🔄 Aktualisieren
                        </button>
                    </div>
                </div>
            </div>

            {/* Fehleranzeige */}
            {error && (
                <div className="error-message">
                    <strong>Fehler:</strong> {error}
                </div>
            )}

            {/* Statistiken */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-content">
                        <div className="stat-number">{groups.length}</div>
                        <div className="stat-label">Gesamt Gruppen</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                        <div className="stat-number">
                            {groups.filter(g => g.status === 'aktiv').length}
                        </div>
                        <div className="stat-label">Aktive Gruppen</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">📧</div>
                    <div className="stat-content">
                        <div className="stat-number">
                            {groups.reduce((sum, g) => sum + (g.pending_einladungen || 0), 0)}
                        </div>
                        <div className="stat-label">Offene Einladungen</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">🎯</div>
                    <div className="stat-content">
                        <div className="stat-number">
                            {groups.reduce((sum, g) => sum + (g.aktive_mitglieder || 0), 0)}
                        </div>
                        <div className="stat-label">Aktive Mitglieder</div>
                    </div>
                </div>
            </div>

            {/* Gruppen-Liste */}
            <div className="groups-section">
                <h2>📋 Buddy-Gruppen ({filteredGroups.length})</h2>

                {filteredGroups.length === 0 ? (
                    <div className="empty-state">
                        <p>Keine Buddy-Gruppen gefunden.</p>
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="btn btn-secondary"
                            >
                                Filter zurücksetzen
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="groups-grid">
                        {filteredGroups.map(group => (
                            <div key={group.id} className="group-card">
                                <div className="group-header">
                                    <h3>{group.gruppe_name || `Gruppe #${group.id}`}</h3>
                                    {getStatusBadge(group.status)}
                                </div>

                                <div className="group-info">
                                    <div className="info-row">
                                        <span>ID:</span>
                                        <span>#{group.id}</span>
                                    </div>
                                    <div className="info-row">
                                        <span>Erstellt:</span>
                                        <span>{new Date(group.erstellt_am).toLocaleDateString('de-DE')}</span>
                                    </div>
                                    <div className="info-row">
                                        <span>Mitglieder:</span>
                                        <span>{group.aktive_mitglieder || 0}/{group.max_mitglieder}</span>
                                    </div>
                                    <div className="info-row">
                                        <span>Einladungen:</span>
                                        <span>
                                            {group.gesamt_einladungen || 0} gesamt,
                                            {' '}{group.pending_einladungen || 0} offen
                                        </span>
                                    </div>
                                </div>

                                <div className="group-actions">
                                    <button
                                        onClick={() => loadGroupDetails(group.id)}
                                        className="btn btn-primary btn-sm"
                                        disabled={actionLoading}
                                    >
                                        📄 Details
                                    </button>

                                    {group.pending_einladungen > 0 && (
                                        <button
                                            onClick={() => sendReminders(group.id)}
                                            className="btn btn-secondary btn-sm"
                                            disabled={actionLoading}
                                        >
                                            🔔 Erinnerung
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Gruppen-Details Modal */}
            {showGroupDetails && selectedGroup && (
                <div className="modal-overlay" onClick={() => setShowGroupDetails(false)}>
                    <div className="modal-content group-details-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                📋 Gruppe: {selectedGroup.gruppe_name || `#${selectedGroup.id}`}
                            </h2>
                            <button
                                onClick={() => setShowGroupDetails(false)}
                                className="close-button"
                            >
                                ×
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Gruppen-Informationen */}
                            <div className="group-details-section">
                                <h3>ℹ️ Gruppen-Informationen</h3>
                                <div className="details-grid">
                                    <div className="detail-item">
                                        <strong>ID:</strong>
                                        <span>#{selectedGroup.id}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Name:</strong>
                                        <span>{selectedGroup.gruppe_name || 'Kein Name'}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Status:</strong>
                                        {getStatusBadge(selectedGroup.status)}
                                    </div>
                                    <div className="detail-item">
                                        <strong>Erstellt:</strong>
                                        <span>{new Date(selectedGroup.erstellt_am).toLocaleString('de-DE')}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Max. Mitglieder:</strong>
                                        <span>{selectedGroup.max_mitglieder}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Aktuelle Mitglieder:</strong>
                                        <span>{selectedGroup.aktuelle_mitglieder}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Einladungen */}
                            <div className="invitations-section">
                                <div className="section-header">
                                    <h3>📧 Einladungen ({selectedGroup.einladungen?.length || 0})</h3>
                                    {selectedGroup.einladungen?.some(inv => inv.status === 'eingeladen') && (
                                        <button
                                            onClick={() => {
                                                const pendingIds = selectedGroup.einladungen
                                                    .filter(inv => inv.status === 'eingeladen')
                                                    .map(inv => inv.id);
                                                sendInvitations(selectedGroup.id, pendingIds);
                                            }}
                                            className="btn btn-primary btn-sm"
                                            disabled={actionLoading}
                                        >
                                            📤 Alle Einladungen versenden
                                        </button>
                                    )}
                                </div>

                                {selectedGroup.einladungen?.length === 0 ? (
                                    <p>Keine Einladungen vorhanden.</p>
                                ) : (
                                    <div className="invitations-list">
                                        {selectedGroup.einladungen.map(invitation => (
                                            <div key={invitation.id} className="invitation-item">
                                                <div className="invitation-info">
                                                    <div className="invitation-header">
                                                        <strong>{invitation.freund_name}</strong>
                                                        {getInvitationStatusBadge(invitation.status)}
                                                    </div>
                                                    <div className="invitation-details">
                                                        <div>📧 {invitation.freund_email}</div>
                                                        {invitation.freund_telefon && (
                                                            <div>📞 {invitation.freund_telefon}</div>
                                                        )}
                                                        <div>
                                                            📅 Erstellt: {new Date(invitation.erstellt_am).toLocaleDateString('de-DE')}
                                                        </div>
                                                        {invitation.einladung_gesendet_am && (
                                                            <div>
                                                                📤 Versendet: {new Date(invitation.einladung_gesendet_am).toLocaleDateString('de-DE')}
                                                            </div>
                                                        )}
                                                        <div>
                                                            ⏰ Gültig bis: {new Date(invitation.token_gueltig_bis).toLocaleDateString('de-DE')}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="invitation-actions">
                                                    {invitation.status === 'eingeladen' && (
                                                        <button
                                                            onClick={() => sendInvitations(selectedGroup.id, [invitation.id])}
                                                            className="btn btn-primary btn-xs"
                                                            disabled={actionLoading}
                                                        >
                                                            📤 Versenden
                                                        </button>
                                                    )}

                                                    {['eingeladen', 'email_gesendet'].includes(invitation.status) && (
                                                        <button
                                                            onClick={() => deleteInvitation(invitation.id)}
                                                            className="btn btn-danger btn-xs"
                                                            disabled={actionLoading}
                                                        >
                                                            🗑️ Löschen
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Gemeinsame Aktivitäten */}
                            {selectedGroup.aktivitaeten && selectedGroup.aktivitaeten.length > 0 && (
                                <div className="activities-section">
                                    <div className="section-header">
                                        <h3>📈 Gemeinsame Aktivitäten ({selectedGroup.aktivitaeten.length})</h3>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const response = await fetch(`${config.apiBaseUrl}/buddy/groups/${selectedGroup.id}/aktivitaeten?limit=50`, {
                                                        headers: {
                                                            'Authorization': `Bearer ${token}`
                                                        }
                                                    });
                                                    if (response.ok) {
                                                        const data = await response.json();
                                                        setSelectedGroup({ ...selectedGroup, aktivitaeten: data.aktivitaeten });
                                                    }
                                                } catch (err) {
                                                    console.error('Fehler beim Laden aller Aktivitäten:', err);
                                                }
                                            }}
                                            className="btn btn-secondary btn-sm"
                                        >
                                            Alle anzeigen
                                        </button>
                                    </div>
                                    <div className="activities-list">
                                        {selectedGroup.aktivitaeten.slice(0, 15).map(activity => {
                                            const getActivityIcon = (typ) => {
                                                const iconMap = {
                                                    'einladung_versendet': '📧',
                                                    'einladung_angenommen': '✅',
                                                    'einladung_abgelehnt': '❌',
                                                    'einladung_abgelaufen': '⏰',
                                                    'mitglied_registriert': '👤',
                                                    'mitglied_aktiviert': '🎉',
                                                    'gemeinsames_training': '🥋',
                                                    'pruefung_erfolgreich': '🏆',
                                                    'gruppen_erstellt': '👥'
                                                };
                                                return iconMap[activity.aktivitaet_typ] || '📋';
                                            };

                                            const getActivityColor = (typ) => {
                                                if (typ.includes('erfolgreich') || typ.includes('aktiviert') || typ.includes('angenommen')) {
                                                    return '#10b981';
                                                } else if (typ.includes('abgelehnt') || typ.includes('abgelaufen')) {
                                                    return '#ef4444';
                                                } else if (typ.includes('versendet') || typ.includes('registriert')) {
                                                    return '#3b82f6';
                                                }
                                                return '#94a3b8';
                                            };

                                            return (
                                                <div key={activity.id} className="activity-item-enhanced">
                                                    <div className="activity-icon-wrapper" style={{ backgroundColor: `${getActivityColor(activity.aktivitaet_typ)}20`, borderColor: getActivityColor(activity.aktivitaet_typ) }}>
                                                        <span className="activity-icon">{getActivityIcon(activity.aktivitaet_typ)}</span>
                                                    </div>
                                                    <div className="activity-content-enhanced">
                                                        <div className="activity-header-enhanced">
                                                            <strong className="activity-type">
                                                                {activity.aktivitaet_typ.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                            </strong>
                                                            <span className="activity-time-enhanced">
                                                                {new Date(activity.erstellt_am).toLocaleString('de-DE', {
                                                                    day: '2-digit',
                                                                    month: '2-digit',
                                                                    year: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </span>
                                                        </div>
                                                        {activity.beschreibung && (
                                                            <p className="activity-description-enhanced">{activity.beschreibung}</p>
                                                        )}
                                                        {(activity.freund_name || activity.mitglied_vorname) && (
                                                            <div className="activity-participant">
                                                                {activity.freund_name && (
                                                                    <span>👤 {activity.freund_name}</span>
                                                                )}
                                                                {activity.mitglied_vorname && (
                                                                    <span>👤 {activity.mitglied_vorname} {activity.mitglied_nachname}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {selectedGroup.aktivitaeten.length > 15 && (
                                        <div className="activities-footer">
                                            <p>... und {selectedGroup.aktivitaeten.length - 15} weitere Aktivitäten</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button
                                onClick={() => setShowGroupDetails(false)}
                                className="btn btn-secondary"
                            >
                                Schließen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Loading Overlay */}
            {actionLoading && (
                <div className="action-loading-overlay">
                    <div className="loading-spinner-large"></div>
                    <p>Aktion wird ausgeführt...</p>
                </div>
            )}
                </>
            )}
        </div>
    );
};

export default BuddyVerwaltung;