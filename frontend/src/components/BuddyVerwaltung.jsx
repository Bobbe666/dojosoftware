// =============================================================================
// BUDDY-GRUPPEN VERWALTUNG - ADMIN INTERFACE
// =============================================================================
// Dashboard-Komponente für die Verwaltung von Buddy-Gruppen und Einladungen
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const BuddyVerwaltung = () => {
    const { token } = useAuth();

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

            const response = await fetch('/api/buddy/groups', {
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

            const response = await fetch(`/api/buddy/groups/${groupId}`, {
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

            const response = await fetch('/api/buddy/send-invitations', {
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

            const response = await fetch(`/api/buddy/groups/${groupId}/resend-invitations`, {
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

            const response = await fetch(`/api/buddy/invitations/${invitationId}`, {
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
                <h1>👥 Buddy-Gruppen Verwaltung</h1>
                <p>Verwalte Freunde-Gruppen und Einladungen</p>
            </div>

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
                            className="btn btn-secondary"
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

                            {/* Aktivitäten */}
                            {selectedGroup.aktivitaeten?.length > 0 && (
                                <div className="activities-section">
                                    <h3>📈 Letzte Aktivitäten</h3>
                                    <div className="activities-list">
                                        {selectedGroup.aktivitaeten.slice(0, 10).map(activity => (
                                            <div key={activity.id} className="activity-item">
                                                <div className="activity-time">
                                                    {new Date(activity.erstellt_am).toLocaleString('de-DE')}
                                                </div>
                                                <div className="activity-description">
                                                    <strong>{activity.aktivitaet_typ.replace('_', ' ')}</strong>
                                                    {activity.beschreibung && (
                                                        <span>: {activity.beschreibung}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
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
        </div>
    );
};

export default BuddyVerwaltung;