// =============================================================================
// BUDDY-EINLADUNG REGISTRIERUNG - FRONTEND KOMPONENTE
// =============================================================================
// Spezielle Registrierungsseite für Freunde, die über Buddy-Einladungslink kommen
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PublicRegistration from './PublicRegistration';

const BuddyInviteRegistration = () => {
    const { token } = useParams();
    const navigate = useNavigate();

    // State Management
    const [invitation, setInvitation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [registrationStarted, setRegistrationStarted] = useState(false);

    // Einladung über Token laden
    useEffect(() => {
        const loadInvitation = async () => {
            try {
                setLoading(true);
                setError('');

                const response = await fetch(`/buddy/invitation/${token}`);
                const data = await response.json();

                if (!response.ok) {
                    if (data.code === 'INVITATION_NOT_FOUND') {
                        setError('Diese Einladung ist nicht mehr gültig oder bereits abgelaufen.');
                    } else {
                        setError(data.error || 'Fehler beim Laden der Einladung');
                    }
                    return;
                }

                setInvitation(data.invitation);

            } catch (err) {
                console.error('Fehler beim Laden der Einladung:', err);
                setError('Verbindungsfehler. Bitte versuche es später erneut.');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            loadInvitation();
        } else {
            setError('Ungültiger Einladungslink');
            setLoading(false);
        }
    }, [token]);

    // Registrierung starten
    const handleStartRegistration = () => {
        setRegistrationStarted(true);
    };

    // Registrierung abgeschlossen
    const handleRegistrationComplete = async (registrationData) => {
        try {
            // Registrierung mit Buddy-Token verknüpfen
            const response = await fetch(`/buddy/invitation/${token}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registrationData)
            });

            if (response.ok) {
                // Erfolgreich registriert - zur Bestätigungsseite
                navigate('/registration-success?source=buddy', { replace: true });
            } else {
                throw new Error('Fehler bei der Buddy-Registrierung');
            }

        } catch (err) {
            console.error('Fehler bei Buddy-Registrierung:', err);
            setError('Fehler bei der Registrierung. Bitte versuche es erneut.');
            setRegistrationStarted(false);
        }
    };

    // Loading State
    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner-large"></div>
                <p>Einladung wird geladen...</p>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="error-container">
                <div className="error-content">
                    <h2>❌ Einladung nicht verfügbar</h2>
                    <p>{error}</p>
                    <div className="error-actions">
                        <button
                            onClick={() => navigate('/home')}
                            className="btn btn-primary"
                        >
                            Zur Startseite
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="btn btn-secondary"
                        >
                            Erneut versuchen
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Registrierung bereits gestartet - Zeige Registrierungsformular
    if (registrationStarted) {
        return (
            <PublicRegistration
                invitationData={{
                    token,
                    buddyGroup: invitation.gruppe_name,
                    inviterName: invitation.ersteller_name,
                    prefilledData: {
                        vorname: invitation.freund_name?.split(' ')[0] || '',
                        nachname: invitation.freund_name?.split(' ').slice(1).join(' ') || '',
                        email: invitation.freund_email
                    }
                }}
                onComplete={handleRegistrationComplete}
                onCancel={() => setRegistrationStarted(false)}
            />
        );
    }

    // Einladungsdetails anzeigen
    return (
        <div className="buddy-invite-page">
            {/* Header */}
            <div className="buddy-invite-header">
                <div className="container">
                    <h1>🥋 Buddy-Gruppen Einladung</h1>
                    <p>Du wurdest zu einer Kampfkunst-Gruppe eingeladen!</p>
                </div>
            </div>

            {/* Einladungsdetails */}
            <div className="container">
                <div className="buddy-invite-content">

                    {/* Willkommensnachricht */}
                    <div className="welcome-section">
                        <h2>Hallo {invitation.freund_name}!</h2>
                        <p>
                            <strong>{invitation.ersteller_name || 'Ein Freund'}</strong> hat dich zur
                            Buddy-Gruppe <strong>"{invitation.gruppe_name || 'Kampfkunst-Freunde'}"</strong> eingeladen.
                        </p>
                    </div>

                    {/* Buddy-Vorteile */}
                    <div className="buddy-benefits">
                        <h3>🎯 Vorteile einer Buddy-Mitgliedschaft</h3>
                        <div className="benefits-grid">
                            <div className="benefit-item">
                                <div className="benefit-icon">👥</div>
                                <h4>Gemeinsames Training</h4>
                                <p>Trainiere zusammen mit deinen Freunden und motiviert euch gegenseitig</p>
                            </div>

                            <div className="benefit-item">
                                <div className="benefit-icon">🚀</div>
                                <h4>Gegenseitige Motivation</h4>
                                <p>Erreiche deine Ziele schneller durch Unterstützung der Gruppe</p>
                            </div>

                            <div className="benefit-item">
                                <div className="benefit-icon">🎉</div>
                                <h4>Spezielle Events</h4>
                                <p>Exklusive Buddy-Workshops, Veranstaltungen und Gruppenrabatte</p>
                            </div>

                            <div className="benefit-item">
                                <div className="benefit-icon">🏆</div>
                                <h4>Teamgeist</h4>
                                <p>Entwickle Kameradschaft und feiere gemeinsame Erfolge</p>
                            </div>
                        </div>
                    </div>

                    {/* Einladungsinfo */}
                    <div className="invitation-info">
                        <h3>📋 Einladungsdetails</h3>
                        <div className="info-grid">
                            <div className="info-item">
                                <strong>Gruppe:</strong>
                                <span>{invitation.gruppe_name || 'Kampfkunst-Freunde'}</span>
                            </div>
                            <div className="info-item">
                                <strong>Eingeladen von:</strong>
                                <span>{invitation.ersteller_name || 'Freund'}</span>
                            </div>
                            <div className="info-item">
                                <strong>Deine Email:</strong>
                                <span>{invitation.freund_email}</span>
                            </div>
                            <div className="info-item">
                                <strong>Gültig bis:</strong>
                                <span>{new Date(invitation.token_gueltig_bis).toLocaleDateString('de-DE')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Registrierungs-Aktionen */}
                    <div className="registration-actions">
                        <h3>🚀 Bereit zum Beitreten?</h3>
                        <p>Starte jetzt deine Registrierung und werde Teil der Gruppe!</p>

                        <div className="action-buttons">
                            <button
                                onClick={handleStartRegistration}
                                className="btn btn-primary btn-large"
                            >
                                ✨ Jetzt registrieren
                            </button>

                            <button
                                onClick={() => navigate('/home')}
                                className="btn btn-secondary"
                            >
                                📖 Mehr erfahren
                            </button>
                        </div>

                        <div className="registration-note">
                            <p>
                                <strong>Hinweis:</strong> Die Registrierung ist komplett kostenlos und unverbindlich.
                                Du kannst alle Details eingeben und entscheidest am Ende, ob du beitreten möchtest.
                            </p>
                        </div>
                    </div>

                    {/* Sicherheitshinweis */}
                    <div className="security-notice">
                        <h4>🔒 Deine Daten sind sicher</h4>
                        <ul>
                            <li>Alle Daten werden DSGVO-konform behandelt</li>
                            <li>Keine Weitergabe an Dritte</li>
                            <li>Jederzeit widerrufbar</li>
                            <li>Sichere SSL-Verschlüsselung</li>
                        </ul>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BuddyInviteRegistration;

// =============================================================================
// CSS STYLES (zu PublicRegistration.css hinzufügen)
// =============================================================================
/*

.buddy-invite-page {
    min-height: 100vh;
    background: var(--background-color);
    color: var(--text-color);
}

.buddy-invite-header {
    background: linear-gradient(135deg,
        rgba(var(--primary-color-rgb), 0.1),
        rgba(var(--secondary-color-rgb), 0.1));
    padding: 4rem 0 2rem;
    text-align: center;
    border-bottom: 2px solid var(--border-color);
}

.buddy-invite-header h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.buddy-invite-content {
    max-width: 800px;
    margin: 0 auto;
    padding: 3rem 2rem;
}

.welcome-section {
    text-align: center;
    margin-bottom: 3rem;
    padding: 2rem;
    background: rgba(var(--primary-color-rgb), 0.05);
    border-radius: 12px;
    border: 2px solid rgba(var(--primary-color-rgb), 0.1);
}

.welcome-section h2 {
    color: var(--primary-color);
    margin-bottom: 1rem;
    font-size: 2rem;
}

.buddy-benefits {
    margin-bottom: 3rem;
}

.buddy-benefits h3 {
    text-align: center;
    color: var(--primary-color);
    margin-bottom: 2rem;
    font-size: 1.8rem;
}

.benefits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.benefit-item {
    background: var(--background-secondary);
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
    border: 2px solid var(--border-color);
    transition: all 0.3s ease;
}

.benefit-item:hover {
    transform: translateY(-2px);
    border-color: var(--primary-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.benefit-icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
}

.benefit-item h4 {
    color: var(--primary-color);
    margin-bottom: 0.5rem;
    font-size: 1.2rem;
}

.benefit-item p {
    color: var(--text-muted);
    font-size: 0.9rem;
    line-height: 1.4;
}

.invitation-info {
    background: var(--background-secondary);
    padding: 2rem;
    border-radius: 12px;
    margin-bottom: 3rem;
    border: 2px solid var(--border-color);
}

.invitation-info h3 {
    color: var(--primary-color);
    margin-bottom: 1.5rem;
    font-size: 1.5rem;
}

.info-grid {
    display: grid;
    gap: 1rem;
}

.info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-color);
}

.info-item:last-child {
    border-bottom: none;
}

.info-item strong {
    color: var(--text-color);
    font-weight: 600;
}

.info-item span {
    color: var(--text-muted);
    text-align: right;
}

.registration-actions {
    text-align: center;
    margin-bottom: 3rem;
}

.registration-actions h3 {
    color: var(--primary-color);
    margin-bottom: 1rem;
    font-size: 1.8rem;
}

.registration-actions p {
    color: var(--text-muted);
    margin-bottom: 2rem;
    font-size: 1.1rem;
}

.action-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 2rem;
}

.registration-note {
    background: rgba(var(--secondary-color-rgb), 0.1);
    padding: 1.5rem;
    border-radius: 8px;
    border: 2px solid rgba(var(--secondary-color-rgb), 0.2);
    margin-top: 2rem;
}

.registration-note p {
    margin: 0;
    color: var(--text-color);
    font-size: 0.9rem;
    line-height: 1.5;
}

.security-notice {
    background: var(--background-secondary);
    padding: 1.5rem;
    border-radius: 8px;
    border: 2px solid var(--border-color);
}

.security-notice h4 {
    color: var(--primary-color);
    margin-bottom: 1rem;
}

.security-notice ul {
    margin: 0;
    padding-left: 1.5rem;
    color: var(--text-muted);
}

.security-notice li {
    margin-bottom: 0.5rem;
    line-height: 1.4;
}

.loading-container,
.error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    text-align: center;
    padding: 2rem;
}

.error-content {
    max-width: 500px;
    background: var(--background-secondary);
    padding: 2rem;
    border-radius: 12px;
    border: 2px solid var(--border-color);
}

.error-content h2 {
    color: var(--text-color);
    margin-bottom: 1rem;
}

.error-content p {
    color: var(--text-muted);
    margin-bottom: 2rem;
    line-height: 1.5;
}

.error-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
}

@media (max-width: 768px) {
    .buddy-invite-header h1 {
        font-size: 2rem;
    }

    .benefits-grid {
        grid-template-columns: 1fr;
    }

    .action-buttons {
        flex-direction: column;
        align-items: center;
    }

    .action-buttons .btn {
        width: 100%;
        max-width: 300px;
    }

    .info-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.25rem;
    }

    .info-item span {
        text-align: left;
    }
}

*/