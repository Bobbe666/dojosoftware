// =============================================================================
// BUDDY-GRUPPEN & EINLADUNGSSYSTEM - API ROUTES
// =============================================================================
// Backend-API für das Buddy-Gruppen System mit Email-Einladungen
// =============================================================================

const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// =============================================================================
// EMAIL CONFIGURATION
// =============================================================================

// Email-Transporter (Gmail, SMTP, etc. - konfigurierbar)
const createEmailTransporter = () => {
    // Für Entwicklung: Ethereal Email (Test-Provider)
    // Für Produktion: Gmail, SendGrid, Amazon SES, etc.

    if (process.env.NODE_ENV === 'production') {
        // Produktions-Email-Provider
        return nodemailer.createTransporter({
            service: 'gmail', // oder 'sendgrid', 'ses', etc.
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    } else {
        // Entwicklungs-Email-Provider (Ethereal für Tests)
        return nodemailer.createTransporter({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: {
                user: process.env.ETHEREAL_USER || 'ethereal.user@ethereal.email',
                pass: process.env.ETHEREAL_PASS || 'ethereal-password'
            }
        });
    }
};

// =============================================================================
// HILFSFUNKTIONEN
// =============================================================================

// Sicheren Token generieren
const generateInvitationToken = (groupId, email) => {
    const data = `${groupId}_${email}_${Date.now()}_${Math.random()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
};

// Einladungs-Email-Template
const createInvitationEmailTemplate = (invitationData) => {
    const { freund_name, gruppe_name, einladungs_token, ersteller_name } = invitationData;

    const einladungsLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/registration/buddy-invite/${einladungs_token}`;

    return {
        subject: `🥋 Einladung zur Buddy-Gruppe "${gruppe_name || 'Kampfkunst-Freunde'}"`,

        html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
                .benefits { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .benefits ul { list-style: none; padding: 0; }
                .benefits li { padding: 8px 0; border-bottom: 1px solid #eee; }
                .benefits li:before { content: "✓"; color: #667eea; font-weight: bold; margin-right: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🥋 Buddy-Gruppen Einladung</h1>
                    <p>Du wurdest zu einer Kampfkunst-Gruppe eingeladen!</p>
                </div>

                <div class="content">
                    <h2>Hallo ${freund_name}!</h2>

                    <p><strong>${ersteller_name || 'Ein Freund'}</strong> hat dich zur Buddy-Gruppe
                    <strong>"${gruppe_name || 'Kampfkunst-Freunde'}"</strong> eingeladen.</p>

                    <div class="benefits">
                        <h3>Vorteile einer Buddy-Mitgliedschaft:</h3>
                        <ul>
                            <li>Gemeinsames Training mit Freunden</li>
                            <li>Gegenseitige Motivation und Unterstützung</li>
                            <li>Gruppenrabatte bei Veranstaltungen</li>
                            <li>Spezielle Buddy-Workshops und Events</li>
                            <li>Teamgeist und Kameradschaft</li>
                        </ul>
                    </div>

                    <p>Klicke auf den Button unten, um deine Registrierung zu starten:</p>

                    <div style="text-align: center;">
                        <a href="${einladungsLink}" class="button">
                            Jetzt registrieren
                        </a>
                    </div>

                    <p><strong>Wichtig:</strong> Diese Einladung ist 30 Tage gültig. Nach Ablauf wird der Link automatisch deaktiviert.</p>

                    <hr>

                    <p><small>
                        Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
                        <a href="${einladungsLink}">${einladungsLink}</a>
                    </small></p>
                </div>

                <div class="footer">
                    <p>Diese Email wurde automatisch generiert. Bei Fragen wende dich an unser Team.</p>
                    <p>© ${new Date().getFullYear()} DojoSoftware - Kampfkunst-Verwaltung</p>
                </div>
            </div>
        </body>
        </html>
        `,

        text: `
Hallo ${freund_name}!

${ersteller_name || 'Ein Freund'} hat dich zur Buddy-Gruppe "${gruppe_name || 'Kampfkunst-Freunde'}" eingeladen.

Vorteile einer Buddy-Mitgliedschaft:
✓ Gemeinsames Training mit Freunden
✓ Gegenseitige Motivation und Unterstützung
✓ Gruppenrabatte bei Veranstaltungen
✓ Spezielle Buddy-Workshops und Events
✓ Teamgeist und Kameradschaft

Registriere dich hier: ${einladungsLink}

Diese Einladung ist 30 Tage gültig.

Bei Fragen wende dich an unser Team.
© ${new Date().getFullYear()} DojoSoftware
        `
    };
};

// Promise-Wrapper für db.query (da req.db kein Promise-Interface hat)
const queryAsync = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};

// =============================================================================
// API ROUTES
// =============================================================================

// GET /api/buddy/groups - Alle Buddy-Gruppen abrufen (Admin)
router.get('/groups', async (req, res) => {
    try {
        const query = `
            SELECT
                bg.*,
                COUNT(be.id) as gesamt_einladungen,
                SUM(CASE WHEN be.status = 'aktiviert' THEN 1 ELSE 0 END) as aktive_mitglieder,
                SUM(CASE WHEN be.status IN ('eingeladen', 'email_gesendet') THEN 1 ELSE 0 END) as pending_einladungen
            FROM buddy_gruppen bg
            LEFT JOIN buddy_einladungen be ON bg.id = be.buddy_gruppe_id
            WHERE bg.status != 'geloescht'
            GROUP BY bg.id
            ORDER BY bg.erstellt_am DESC
        `;

        const groups = await queryAsync(req.db, query);
        res.json(groups);
    } catch (error) {
        console.error('Fehler beim Abrufen der Buddy-Gruppen:', error);
        res.status(500).json({ error: 'Serverfehler beim Abrufen der Gruppen' });
    }
});

// GET /api/buddy/groups/:id - Einzelne Buddy-Gruppe mit Details
router.get('/groups/:id', async (req, res) => {
    try {
        const groupId = req.params.id;

        // Gruppen-Details abrufen
        const groupResult = await queryAsync(req.db,
            'SELECT * FROM buddy_gruppen WHERE id = ? AND status != "geloescht"',
            [groupId]
        );

        if (groupResult.length === 0) {
            return res.status(404).json({ error: 'Buddy-Gruppe nicht gefunden' });
        }

        // Einladungen abrufen
        const invitations = await queryAsync(req.db, `
            SELECT
                be.*,
                bel.gesendet_am as letzte_email,
                bel.status as email_status
            FROM buddy_einladungen be
            LEFT JOIN (
                SELECT buddy_einladung_id, MAX(gesendet_am) as gesendet_am, status
                FROM buddy_email_log
                WHERE email_typ = 'einladung'
                GROUP BY buddy_einladung_id
            ) bel ON be.id = bel.buddy_einladung_id
            WHERE be.buddy_gruppe_id = ?
            ORDER BY be.erstellt_am ASC
        `, [groupId]);

        // Aktivitäten abrufen
        const activities = await queryAsync(req.db, `
            SELECT * FROM buddy_aktivitaeten
            WHERE buddy_gruppe_id = ?
            ORDER BY erstellt_am DESC
            LIMIT 20
        `, [groupId]);

        const group = groupResult[0];
        group.einladungen = invitations;
        group.aktivitaeten = activities;

        res.json(group);
    } catch (error) {
        console.error('Fehler beim Abrufen der Buddy-Gruppe:', error);
        res.status(500).json({ error: 'Serverfehler beim Abrufen der Gruppe' });
    }
});

// POST /api/buddy/send-invitations - Einladungs-Emails versenden
router.post('/send-invitations', async (req, res) => {
    try {
        const { groupId, invitationIds } = req.body;

        if (!groupId || !invitationIds || !Array.isArray(invitationIds)) {
            return res.status(400).json({ error: 'Ungültige Parameter' });
        }

        // Einladungen abrufen
        const placeholders = invitationIds.map(() => '?').join(',');
        const [invitations] = await req.db.execute(`
            SELECT
                be.*,
                bg.gruppe_name,
                r.vorname as ersteller_name
            FROM buddy_einladungen be
            JOIN buddy_gruppen bg ON be.buddy_gruppe_id = bg.id
            LEFT JOIN registrierungen r ON bg.ersteller_registrierung_id = r.id
            WHERE be.id IN (${placeholders})
              AND be.buddy_gruppe_id = ?
              AND be.status IN ('eingeladen', 'email_gesendet')
              AND be.token_gueltig_bis > NOW()
        `, [...invitationIds, groupId]);

        if (invitations.length === 0) {
            return res.status(404).json({ error: 'Keine gültigen Einladungen gefunden' });
        }

        const emailTransporter = createEmailTransporter();
        const sentEmails = [];
        const failedEmails = [];

        // Emails versenden
        for (const invitation of invitations) {
            try {
                const emailTemplate = createInvitationEmailTemplate(invitation);

                const mailOptions = {
                    from: process.env.EMAIL_FROM || 'noreply@dojosoftware.com',
                    to: invitation.freund_email,
                    subject: emailTemplate.subject,
                    html: emailTemplate.html,
                    text: emailTemplate.text
                };

                const emailResult = await emailTransporter.sendMail(mailOptions);

                // Email-Log eintragen
                await req.db.execute(`
                    INSERT INTO buddy_email_log (
                        buddy_einladung_id,
                        email_typ,
                        empfaenger_email,
                        betreff,
                        status,
                        gesendet_am,
                        provider_message_id
                    ) VALUES (?, 'einladung', ?, ?, 'gesendet', NOW(), ?)
                `, [
                    invitation.id,
                    invitation.freund_email,
                    emailTemplate.subject,
                    emailResult.messageId
                ]);

                // Einladungsstatus aktualisieren
                await req.db.execute(`
                    UPDATE buddy_einladungen
                    SET status = 'email_gesendet', einladung_gesendet_am = NOW()
                    WHERE id = ?
                `, [invitation.id]);

                // Aktivität protokollieren
                await req.db.execute(`
                    INSERT INTO buddy_aktivitaeten (
                        buddy_gruppe_id,
                        buddy_einladung_id,
                        aktivitaet_typ,
                        beschreibung
                    ) VALUES (?, ?, 'email_gesendet', ?)
                `, [
                    invitation.buddy_gruppe_id,
                    invitation.id,
                    `Einladungs-Email an ${invitation.freund_name} (${invitation.freund_email}) versendet`
                ]);

                sentEmails.push({
                    id: invitation.id,
                    name: invitation.freund_name,
                    email: invitation.freund_email
                });

            } catch (emailError) {
                console.error(`Fehler beim Versenden der Email an ${invitation.freund_email}:`, emailError);

                // Fehler-Log eintragen
                await req.db.execute(`
                    INSERT INTO buddy_email_log (
                        buddy_einladung_id,
                        email_typ,
                        empfaenger_email,
                        betreff,
                        status,
                        fehler_nachricht
                    ) VALUES (?, 'einladung', ?, ?, 'fehler', ?)
                `, [
                    invitation.id,
                    invitation.freund_email,
                    'Einladung zur Buddy-Gruppe',
                    emailError.message
                ]);

                failedEmails.push({
                    id: invitation.id,
                    name: invitation.freund_name,
                    email: invitation.freund_email,
                    error: emailError.message
                });
            }
        }

        res.json({
            success: true,
            sent: sentEmails.length,
            failed: failedEmails.length,
            sentEmails,
            failedEmails
        });

    } catch (error) {
        console.error('Fehler beim Versenden der Einladungen:', error);
        res.status(500).json({ error: 'Serverfehler beim Versenden der Einladungen' });
    }
});

// GET /api/buddy/invitation/:token - Einladung über Token abrufen (für Registrierung)
router.get('/invitation/:token', async (req, res) => {
    try {
        const token = req.params.token;

        const [invitations] = await req.db.execute(`
            SELECT
                be.*,
                bg.gruppe_name,
                bg.max_mitglieder,
                bg.aktuelle_mitglieder,
                r.vorname as ersteller_name,
                r.email as ersteller_email
            FROM buddy_einladungen be
            JOIN buddy_gruppen bg ON be.buddy_gruppe_id = bg.id
            LEFT JOIN registrierungen r ON bg.ersteller_registrierung_id = r.id
            WHERE be.einladungs_token = ?
              AND be.status IN ('eingeladen', 'email_gesendet')
              AND be.token_gueltig_bis > NOW()
              AND bg.status = 'aktiv'
        `, [token]);

        if (invitations.length === 0) {
            return res.status(404).json({
                error: 'Einladung nicht gefunden oder abgelaufen',
                code: 'INVITATION_NOT_FOUND'
            });
        }

        const invitation = invitations[0];

        // Aktivität protokollieren (Link geöffnet)
        await req.db.execute(`
            INSERT INTO buddy_aktivitaeten (
                buddy_gruppe_id,
                buddy_einladung_id,
                aktivitaet_typ,
                beschreibung,
                benutzer_ip
            ) VALUES (?, ?, 'link_geoeffnet', ?, ?)
        `, [
            invitation.buddy_gruppe_id,
            invitation.id,
            `Einladungslink von ${invitation.freund_name} geöffnet`,
            req.ip || 'unbekannt'
        ]);

        res.json({
            invitation: {
                id: invitation.id,
                gruppe_name: invitation.gruppe_name,
                freund_name: invitation.freund_name,
                freund_email: invitation.freund_email,
                ersteller_name: invitation.ersteller_name,
                erstellt_am: invitation.erstellt_am,
                token_gueltig_bis: invitation.token_gueltig_bis
            }
        });

    } catch (error) {
        console.error('Fehler beim Abrufen der Einladung:', error);
        res.status(500).json({ error: 'Serverfehler beim Abrufen der Einladung' });
    }
});

// POST /api/buddy/invitation/:token/register - Registrierung über Buddy-Einladung starten
router.post('/invitation/:token/register', async (req, res) => {
    try {
        const token = req.params.token;
        const registrationData = req.body;

        // Einladung validieren
        const [invitations] = await req.db.execute(`
            SELECT * FROM buddy_einladungen
            WHERE einladungs_token = ?
              AND status IN ('eingeladen', 'email_gesendet')
              AND token_gueltig_bis > NOW()
        `, [token]);

        if (invitations.length === 0) {
            return res.status(404).json({
                error: 'Einladung nicht gefunden oder abgelaufen',
                code: 'INVITATION_EXPIRED'
            });
        }

        const invitation = invitations[0];

        // Standard-Registrierung durchführen (ohne Buddy-Daten, da diese bereits gesetzt sind)
        const registrationResponse = await fetch(`${req.protocol}://${req.get('host')}/api/registrierung`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...registrationData,
                buddy_invitation_token: token // Token für spätere Verknüpfung
            })
        });

        if (!registrationResponse.ok) {
            throw new Error('Registrierung fehlgeschlagen');
        }

        const registrationResult = await registrationResponse.json();

        // Einladung mit Registrierung verknüpfen
        await req.db.execute(`
            UPDATE buddy_einladungen
            SET status = 'registriert',
                registriert_am = NOW(),
                registrierung_id = ?
            WHERE id = ?
        `, [registrationResult.id, invitation.id]);

        // Aktivität protokollieren
        await req.db.execute(`
            INSERT INTO buddy_aktivitaeten (
                buddy_gruppe_id,
                buddy_einladung_id,
                aktivitaet_typ,
                beschreibung
            ) VALUES (?, ?, 'registrierung_abgeschlossen', ?)
        `, [
            invitation.buddy_gruppe_id,
            invitation.id,
            `${invitation.freund_name} hat sich über Buddy-Einladung registriert`
        ]);

        res.json({
            success: true,
            registrationId: registrationResult.id,
            buddyGroupId: invitation.buddy_gruppe_id
        });

    } catch (error) {
        console.error('Fehler bei Buddy-Registrierung:', error);
        res.status(500).json({ error: 'Serverfehler bei der Registrierung' });
    }
});

// POST /api/buddy/groups/:id/resend-invitations - Erinnerungs-Emails versenden
router.post('/groups/:id/resend-invitations', async (req, res) => {
    try {
        const groupId = req.params.id;

        // Einladungen finden, die eine Erinnerung benötigen
        const [pendingInvitations] = await req.db.execute(`
            SELECT
                be.*,
                bg.gruppe_name,
                r.vorname as ersteller_name
            FROM buddy_einladungen be
            JOIN buddy_gruppen bg ON be.buddy_gruppe_id = bg.id
            LEFT JOIN registrierungen r ON bg.ersteller_registrierung_id = r.id
            WHERE be.buddy_gruppe_id = ?
              AND be.status = 'email_gesendet'
              AND be.einladung_gesendet_am < DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND be.token_gueltig_bis > NOW()
        `, [groupId]);

        if (pendingInvitations.length === 0) {
            return res.json({ message: 'Keine Erinnerungen erforderlich' });
        }

        const emailTransporter = createEmailTransporter();
        let sentCount = 0;

        for (const invitation of pendingInvitations) {
            try {
                const emailTemplate = createInvitationEmailTemplate({
                    ...invitation,
                    isReminder: true
                });

                emailTemplate.subject = `Erinnerung: ${emailTemplate.subject}`;

                const mailOptions = {
                    from: process.env.EMAIL_FROM || 'noreply@dojosoftware.com',
                    to: invitation.freund_email,
                    subject: emailTemplate.subject,
                    html: emailTemplate.html,
                    text: emailTemplate.text
                };

                await emailTransporter.sendMail(mailOptions);

                // Email-Log eintragen
                await req.db.execute(`
                    INSERT INTO buddy_email_log (
                        buddy_einladung_id,
                        email_typ,
                        empfaenger_email,
                        betreff,
                        status,
                        gesendet_am
                    ) VALUES (?, 'erinnerung', ?, ?, 'gesendet', NOW())
                `, [invitation.id, invitation.freund_email, emailTemplate.subject]);

                sentCount++;

            } catch (emailError) {
                console.error(`Fehler beim Versenden der Erinnerung an ${invitation.freund_email}:`, emailError);
            }
        }

        res.json({
            success: true,
            remindersSent: sentCount,
            totalPending: pendingInvitations.length
        });

    } catch (error) {
        console.error('Fehler beim Versenden der Erinnerungen:', error);
        res.status(500).json({ error: 'Serverfehler beim Versenden der Erinnerungen' });
    }
});

// DELETE /api/buddy/invitations/:id - Einladung löschen/ablehnen
router.delete('/invitations/:id', async (req, res) => {
    try {
        const invitationId = req.params.id;
        const { reason } = req.body;

        await req.db.execute(`
            UPDATE buddy_einladungen
            SET status = 'abgelehnt',
                ablehnungsgrund = ?
            WHERE id = ?
        `, [reason || 'Von Admin gelöscht', invitationId]);

        res.json({ success: true });

    } catch (error) {
        console.error('Fehler beim Löschen der Einladung:', error);
        res.status(500).json({ error: 'Serverfehler beim Löschen der Einladung' });
    }
});

// =============================================================================
// GEMEINSAME AKTIVITÄTEN
// =============================================================================

// GET /api/buddy/groups/:id/aktivitaeten - Gemeinsame Aktivitäten einer Gruppe
router.get('/groups/:id/aktivitaeten', async (req, res) => {
    try {
        const groupId = req.params.id;
        const { limit = 20, offset = 0 } = req.query;

        // Prüfe ob Gruppe existiert
        const [group] = await queryAsync(req.db, `
            SELECT id, gruppe_name FROM buddy_gruppen
            WHERE id = ? AND status != 'geloescht'
        `, [groupId]);

        if (!group) {
            return res.status(404).json({ error: 'Buddy-Gruppe nicht gefunden' });
        }

        // Lade Aktivitäten mit Details
        const aktivitaeten = await queryAsync(req.db, `
            SELECT
                ba.*,
                be.freund_name,
                be.freund_email,
                m.vorname as mitglied_vorname,
                m.nachname as mitglied_nachname
            FROM buddy_aktivitaeten ba
            LEFT JOIN buddy_einladungen be ON ba.buddy_einladung_id = be.id
            LEFT JOIN mitglieder m ON be.mitglied_id = m.mitglied_id
            WHERE ba.buddy_gruppe_id = ?
            ORDER BY ba.erstellt_am DESC
            LIMIT ? OFFSET ?
        `, [groupId, parseInt(limit), parseInt(offset)]);

        // Gesamtanzahl für Pagination
        const [countResult] = await queryAsync(req.db, `
            SELECT COUNT(*) as total FROM buddy_aktivitaeten
            WHERE buddy_gruppe_id = ?
        `, [groupId]);

        res.json({
            gruppe: {
                id: group.id,
                name: group.gruppe_name
            },
            aktivitaeten: aktivitaeten,
            total: countResult[0].total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Fehler beim Abrufen der Aktivitäten:', error);
        res.status(500).json({ error: 'Serverfehler beim Abrufen der Aktivitäten' });
    }
});

// GET /api/buddy/member/:memberId/gruppen - Buddy-Gruppen eines Mitglieds
router.get('/member/:memberId/gruppen', async (req, res) => {
    try {
        const memberId = req.params.memberId;

        // Finde alle Gruppen, in denen das Mitglied aktiv ist
        const gruppen = await queryAsync(req.db, `
            SELECT DISTINCT
                bg.*,
                COUNT(DISTINCT be2.id) as gesamt_einladungen,
                SUM(CASE WHEN be2.status = 'aktiviert' THEN 1 ELSE 0 END) as aktive_mitglieder,
                SUM(CASE WHEN be2.status IN ('eingeladen', 'email_gesendet') THEN 1 ELSE 0 END) as pending_einladungen
            FROM buddy_gruppen bg
            JOIN buddy_einladungen be ON bg.id = be.buddy_gruppe_id
            LEFT JOIN buddy_einladungen be2 ON bg.id = be2.buddy_gruppe_id
            WHERE be.mitglied_id = ?
              AND be.status = 'aktiviert'
              AND bg.status = 'aktiv'
            GROUP BY bg.id
            ORDER BY bg.erstellt_am DESC
        `, [memberId]);

        res.json(gruppen);
    } catch (error) {
        console.error('Fehler beim Abrufen der Mitglieds-Gruppen:', error);
        res.status(500).json({ error: 'Serverfehler beim Abrufen der Gruppen' });
    }
});

// =============================================================================
// AUTOMATISCHE AUFGABEN (Cron-Jobs)
// =============================================================================

// Automatische Bereinigung (sollte als Cron-Job alle 24h laufen)
router.post('/cleanup', async (req, res) => {
    try {
        // Abgelaufene Einladungen markieren
        const [expiredResult] = await req.db.execute(`
            UPDATE buddy_einladungen
            SET status = 'abgelaufen'
            WHERE status IN ('eingeladen', 'email_gesendet')
              AND token_gueltig_bis < NOW()
        `);

        // Aktivitäten für abgelaufene Einladungen protokollieren
        await req.db.execute(`
            INSERT INTO buddy_aktivitaeten (buddy_gruppe_id, buddy_einladung_id, aktivitaet_typ, beschreibung)
            SELECT
                bi.buddy_gruppe_id,
                bi.id,
                'einladung_abgelaufen',
                CONCAT('Einladung für ', bi.freund_name, ' automatisch abgelaufen')
            FROM buddy_einladungen bi
            WHERE bi.status = 'abgelaufen'
              AND bi.id NOT IN (
                  SELECT DISTINCT COALESCE(buddy_einladung_id, 0)
                  FROM buddy_aktivitaeten
                  WHERE aktivitaet_typ = 'einladung_abgelaufen'
              )
        `);

        res.json({
            success: true,
            expiredInvitations: expiredResult.affectedRows
        });

    } catch (error) {
        console.error('Fehler bei der automatischen Bereinigung:', error);
        res.status(500).json({ error: 'Serverfehler bei der Bereinigung' });
    }
});

module.exports = router;

// =============================================================================
// VERWENDUNG IN DER HAUPTANWENDUNG:
// =============================================================================
//
// 1. In server.js einbinden:
//    const buddyRoutes = require('./routes/buddy');
//    app.use('/api/buddy', buddyRoutes);
//
// 2. Umgebungsvariablen setzen:
//    EMAIL_USER=your-email@gmail.com
//    EMAIL_PASS=your-app-password
//    EMAIL_FROM=noreply@yourdomain.com
//    FRONTEND_URL=http://localhost:3000
//
// 3. Cron-Job für Bereinigung einrichten:
//    0 2 * * * curl -X POST http://localhost:3001/api/buddy/cleanup
//
// =============================================================================
// NACHREGISTRIERUNG: Einladung mit Mitglied verknüpfen und Werber setzen
// =============================================================================

// POST /api/buddy/link-member
// Body: { invitationToken, mitglied_id }
// Wirkung: Setzt buddy_einladungen.mitglied_id und markiert Status 'aktiviert'.
//          Optional: setzt mitglieder.geworben_von_mitglied_id anhand der Gruppe/Ersteller.
router.post('/link-member', async (req, res) => {
    const db = req.db;
    try {
        const { invitationToken, mitglied_id } = req.body;
        if (!invitationToken || !mitglied_id) {
            return res.status(400).json({ error: 'invitationToken und mitglied_id erforderlich' });
        }

        // Einladung + Gruppe + Ersteller laden
        const [rows] = await db.execute(`
            SELECT be.*, bg.ersteller_registrierung_id
            FROM buddy_einladungen be
            JOIN buddy_gruppen bg ON be.buddy_gruppe_id = bg.id
            WHERE be.einladungs_token = ?
        `, [invitationToken]);

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Einladung nicht gefunden' });
        }
        const invitation = rows[0];

        // Einladung mit Mitglied verknüpfen
        await db.execute(`
            UPDATE buddy_einladungen
            SET mitglied_id = ?, status = 'aktiviert'
            WHERE id = ?
        `, [mitglied_id, invitation.id]);

        // Optional: Werber ermitteln (aus ersteller_registrierung_id -> Mitglied)
        if (invitation.ersteller_registrierung_id) {
            const [werber] = await db.execute(`
                SELECT m.mitglied_id
                FROM mitglieder m
                JOIN registrierungen r ON r.email = m.email
                WHERE r.id = ?
                LIMIT 1
            `, [invitation.ersteller_registrierung_id]);

            if (werber && werber.length > 0) {
                await db.execute(`
                    UPDATE mitglieder
                    SET geworben_von_mitglied_id = ?
                    WHERE mitglied_id = ?
                `, [werber[0].mitglied_id, mitglied_id]);
            }
        }

        // Aktivität protokollieren
        await db.execute(`
            INSERT INTO buddy_aktivitaeten (buddy_gruppe_id, buddy_einladung_id, aktivitaet_typ, beschreibung)
            VALUES (?, ?, 'mitglied_verknuepft', ?)
        `, [invitation.buddy_gruppe_id, invitation.id, `Mitglied ${mitglied_id} mit Einladung verknüpft`]);

        res.json({ success: true });
    } catch (error) {
        console.error('Fehler bei /api/buddy/link-member:', error);
        res.status(500).json({ error: 'Serverfehler beim Verknüpfen' });
    }
});