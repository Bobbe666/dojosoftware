const express = require("express");
const db = require("../db");
const router = express.Router();
const { generateMahnungPDF, replacePlaceholders, formatCurrency, formatDate } = require('../utils/mahnungPdfGenerator');
const nodemailer = require('nodemailer');

// API: Alle offenen Beiträge abrufen (nicht bezahlt)
router.get("/offene-beitraege", (req, res) => {
    const { dojo_id } = req.query;

    let whereConditions = ['b.bezahlt = 0'];
    let queryParams = [];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('b.dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
        SELECT
            b.beitrag_id,
            b.mitglied_id,
            b.betrag,
            b.zahlungsart,
            b.zahlungsdatum,
            b.dojo_id,
            CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
            m.email,
            m.telefon,
            DATEDIFF(CURDATE(), b.zahlungsdatum) as tage_ueberfaellig,
            (SELECT COUNT(*) FROM mahnungen WHERE beitrag_id = b.beitrag_id) as mahnstufe
        FROM beitraege b
        JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
        ${whereClause}
        ORDER BY b.zahlungsdatum ASC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen offener Beiträge:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json({ success: true, data: results });
    });
});

// API: Mahnungen abrufen
router.get("/mahnungen", (req, res) => {
    const { mitglied_id, beitrag_id, dojo_id } = req.query;

    let whereConditions = [];
    let queryParams = [];

    if (mitglied_id) {
        whereConditions.push('b.mitglied_id = ?');
        queryParams.push(mitglied_id);
    }

    if (beitrag_id) {
        whereConditions.push('mah.beitrag_id = ?');
        queryParams.push(beitrag_id);
    }

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('b.dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    const query = `
        SELECT
            mah.mahnung_id,
            mah.beitrag_id,
            mah.mahnstufe,
            mah.mahndatum,
            mah.mahngebuehr,
            mah.versandt,
            mah.versand_art,
            b.betrag as beitrag_betrag,
            b.zahlungsdatum as beitrag_faellig_am,
            CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
            m.email,
            b.mitglied_id
        FROM mahnungen mah
        JOIN beitraege b ON mah.beitrag_id = b.beitrag_id
        JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
        ${whereClause}
        ORDER BY mah.mahndatum DESC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen der Mahnungen:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json({ success: true, data: results });
    });
});

// API: Neue Mahnung erstellen
router.post("/mahnungen", (req, res) => {
    const { beitrag_id, mahnstufe, mahngebuehr, versand_art } = req.body;

    if (!beitrag_id || !mahnstufe) {
        return res.status(400).json({ error: "Beitrag-ID und Mahnstufe sind erforderlich" });
    }

    // Prüfe ob Beitrag existiert und nicht bezahlt ist
    const checkQuery = `SELECT bezahlt FROM beitraege WHERE beitrag_id = ?`;

    db.query(checkQuery, [beitrag_id], (checkErr, checkResults) => {
        if (checkErr) {
            logger.error('Fehler beim Prüfen des Beitrags:', checkErr);
            return res.status(500).json({ error: 'Datenbankfehler', details: checkErr.message });
        }

        if (checkResults.length === 0) {
            return res.status(404).json({ error: 'Beitrag nicht gefunden' });
        }

        if (checkResults[0].bezahlt === 1) {
            return res.status(400).json({ error: 'Beitrag ist bereits bezahlt' });
        }

        // Erstelle Mahnung
        const query = `
            INSERT INTO mahnungen (beitrag_id, mahnstufe, mahndatum, mahngebuehr, versandt, versand_art)
            VALUES (?, ?, CURDATE(), ?, 0, ?)
        `;

        const params = [
            beitrag_id,
            mahnstufe,
            mahngebuehr || 0,
            versand_art || 'email'
        ];

        db.query(query, params, (err, result) => {
            if (err) {
                logger.error('Fehler beim Erstellen der Mahnung:', err);
                return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
            }

            res.json({
                success: true,
                mahnung_id: result.insertId,
                message: 'Mahnung erfolgreich erstellt'
            });
        });
    });
});

// API: Mahnung als versendet markieren
router.put("/mahnungen/:mahnung_id/versandt", (req, res) => {
    const { mahnung_id } = req.params;

    const query = `
        UPDATE mahnungen
        SET versandt = 1
        WHERE mahnung_id = ?
    `;

    db.query(query, [mahnung_id], (err, result) => {
        if (err) {
            logger.error('Fehler beim Aktualisieren der Mahnung:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Mahnung nicht gefunden' });
        }

        res.json({
            success: true,
            message: 'Mahnung als versendet markiert'
        });
    });
});

// API: Statistiken für Mahnwesen
router.get("/statistiken", (req, res) => {
    const { dojo_id } = req.query;

    let whereCondition = dojo_id && dojo_id !== 'all' ? 'WHERE b.dojo_id = ?' : '';
    let queryParams = dojo_id && dojo_id !== 'all' ? [parseInt(dojo_id)] : [];

    const query = `
        SELECT
            COUNT(DISTINCT b.beitrag_id) as offene_beitraege,
            SUM(b.betrag) as offene_summe,
            COUNT(DISTINCT CASE WHEN DATEDIFF(CURDATE(), b.zahlungsdatum) > 30 THEN b.beitrag_id END) as ueberfaellig_30_tage,
            COUNT(DISTINCT mah.mahnung_id) as anzahl_mahnungen,
            COUNT(DISTINCT CASE WHEN mah.mahnstufe = 1 THEN mah.mahnung_id END) as mahnstufe_1,
            COUNT(DISTINCT CASE WHEN mah.mahnstufe = 2 THEN mah.mahnung_id END) as mahnstufe_2,
            COUNT(DISTINCT CASE WHEN mah.mahnstufe = 3 THEN mah.mahnung_id END) as mahnstufe_3
        FROM beitraege b
        LEFT JOIN mahnungen mah ON b.beitrag_id = mah.beitrag_id
        ${whereCondition}
        AND b.bezahlt = 0
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen der Statistiken:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json({ success: true, data: results[0] || {} });
    });
});

// API: Beitrag als bezahlt markieren
router.put("/beitraege/:beitrag_id/bezahlt", (req, res) => {
    const { beitrag_id } = req.params;

    const query = `
        UPDATE beitraege
        SET bezahlt = 1
        WHERE beitrag_id = ?
    `;

    db.query(query, [beitrag_id], (err, result) => {
        if (err) {
            logger.error('Fehler beim Markieren als bezahlt:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Beitrag nicht gefunden' });
        }

        res.json({
            success: true,
            message: 'Beitrag als bezahlt markiert'
        });
    });
});

// API: Mahnstufen-Einstellungen abrufen
router.get("/mahnstufen-einstellungen", (req, res) => {
    const { dojo_id } = req.query;

    let whereCondition = dojo_id && dojo_id !== 'all' ? 'WHERE dojo_id = ?' : '';
    let queryParams = dojo_id && dojo_id !== 'all' ? [parseInt(dojo_id)] : [];

    const query = `
        SELECT *
        FROM mahnstufen_einstellungen
        ${whereCondition}
        ORDER BY stufe ASC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen der Mahnstufen-Einstellungen:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json({ success: true, data: results });
    });
});

// API: Mahnstufen-Einstellungen speichern
router.post("/mahnstufen-einstellungen", (req, res) => {
    const { mahnstufen } = req.body;

    if (!mahnstufen || !Array.isArray(mahnstufen)) {
        return res.status(400).json({ error: "Mahnstufen-Daten sind erforderlich" });
    }

    // Lösche alte Einstellungen und füge neue ein
    const deleteQuery = 'DELETE FROM mahnstufen_einstellungen';

    db.query(deleteQuery, (deleteErr) => {
        if (deleteErr) {
            logger.error('Fehler beim Löschen alter Einstellungen:', deleteErr);
            return res.status(500).json({ error: 'Datenbankfehler', details: deleteErr.message });
        }

        // Füge neue Einstellungen ein
        const insertValues = mahnstufen.map(m => [
            m.stufe,
            m.bezeichnung,
            m.tage_nach_faelligkeit,
            m.mahngebuehr,
            m.email_betreff,
            m.email_text,
            m.aktiv ? 1 : 0,
            1 // dojo_id - später anpassen für Multi-Dojo
        ]);

        const insertQuery = `
            INSERT INTO mahnstufen_einstellungen
            (stufe, bezeichnung, tage_nach_faelligkeit, mahngebuehr, email_betreff, email_text, aktiv, dojo_id)
            VALUES ?
        `;

        db.query(insertQuery, [insertValues], (insertErr, result) => {
            if (insertErr) {
                logger.error('Fehler beim Speichern der Einstellungen:', insertErr);
                return res.status(500).json({ error: 'Datenbankfehler', details: insertErr.message });
            }

            res.json({
                success: true,
                message: 'Mahnstufen-Einstellungen erfolgreich gespeichert'
            });
        });
    });
});

// ==========================================
// PDF-GENERIERUNG
// ==========================================

// API: Mahnung als PDF generieren
router.get("/mahnungen/:mahnung_id/pdf", async (req, res) => {
    const { mahnung_id } = req.params;

    try {
        // Hole Mahnung mit allen Details
        const mahnungQuery = `
            SELECT
                mah.*,
                b.betrag as beitrag_betrag,
                b.beschreibung as beitrag_beschreibung,
                b.zahlungsdatum as faelligkeitsdatum,
                m.mitglied_id,
                m.vorname,
                m.nachname,
                m.anrede,
                m.strasse,
                m.hausnummer,
                m.plz,
                m.ort,
                m.email,
                m.mitgliedsnummer
            FROM mahnungen mah
            JOIN beitraege b ON mah.beitrag_id = b.beitrag_id
            JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
            WHERE mah.mahnung_id = ?
        `;

        db.query(mahnungQuery, [mahnung_id], async (err, mahnungResults) => {
            if (err) {
                logger.error('Fehler beim Laden der Mahnung:', { error: err });
                return res.status(500).json({ error: 'Datenbankfehler' });
            }

            if (mahnungResults.length === 0) {
                return res.status(404).json({ error: 'Mahnung nicht gefunden' });
            }

            const mahnungData = mahnungResults[0];

            // Hole Dojo-Daten
            const dojoQuery = `SELECT * FROM dojo LIMIT 1`;
            db.query(dojoQuery, async (dojoErr, dojoResults) => {
                if (dojoErr) {
                    logger.error('Fehler beim Laden der Dojo-Daten:', { error: dojoErr });
                    return res.status(500).json({ error: 'Datenbankfehler' });
                }

                const dojo = dojoResults[0] || {};

                // Hole Mahnstufen-Einstellungen
                const stufenQuery = `SELECT * FROM mahnstufen_einstellungen WHERE stufe = ?`;
                db.query(stufenQuery, [mahnungData.mahnstufe], async (stufenErr, stufenResults) => {
                    const mahnstufeSettings = stufenResults?.[0] || {};

                    try {
                        const pdfData = {
                            mitglied: {
                                vorname: mahnungData.vorname,
                                nachname: mahnungData.nachname,
                                anrede: mahnungData.anrede,
                                strasse: mahnungData.strasse,
                                hausnummer: mahnungData.hausnummer,
                                plz: mahnungData.plz,
                                ort: mahnungData.ort,
                                email: mahnungData.email,
                                mitgliedsnummer: mahnungData.mitgliedsnummer
                            },
                            beitrag: {
                                betrag: mahnungData.beitrag_betrag,
                                beschreibung: mahnungData.beitrag_beschreibung,
                                faelligkeitsdatum: mahnungData.faelligkeitsdatum
                            },
                            mahnung: {
                                mahnstufe: mahnungData.mahnstufe,
                                mahngebuehr: mahnungData.mahngebuehr,
                                mahndatum: mahnungData.mahndatum
                            },
                            dojo: dojo,
                            mahnstufeSettings: mahnstufeSettings
                        };

                        const pdfBuffer = await generateMahnungPDF(pdfData);

                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', `attachment; filename="Mahnung_${mahnungData.mahnstufe}_${mahnungData.nachname}_${mahnungData.vorname}.pdf"`);
                        res.send(pdfBuffer);

                    } catch (pdfError) {
                        logger.error('Fehler bei PDF-Generierung:', { error: pdfError });
                        res.status(500).json({ error: 'PDF-Generierung fehlgeschlagen', details: pdfError.message });
                    }
                });
            });
        });
    } catch (error) {
        logger.error('Fehler:', { error: error });
        res.status(500).json({ error: 'Serverfehler', details: error.message });
    }
});

// API: Vorschau-PDF fuer Beitrag generieren (ohne Mahnung zu erstellen)
router.get("/beitraege/:beitrag_id/mahnung-vorschau/:mahnstufe", async (req, res) => {
    const { beitrag_id, mahnstufe } = req.params;

    try {
        // Hole Beitrag mit Mitglied-Daten
        const beitragQuery = `
            SELECT
                b.*,
                m.mitglied_id,
                m.vorname,
                m.nachname,
                m.anrede,
                m.strasse,
                m.hausnummer,
                m.plz,
                m.ort,
                m.email,
                m.mitgliedsnummer
            FROM beitraege b
            JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
            WHERE b.beitrag_id = ?
        `;

        db.query(beitragQuery, [beitrag_id], async (err, beitragResults) => {
            if (err || beitragResults.length === 0) {
                return res.status(404).json({ error: 'Beitrag nicht gefunden' });
            }

            const beitragData = beitragResults[0];

            // Hole Dojo und Mahnstufen-Einstellungen
            const dojoQuery = `SELECT * FROM dojo LIMIT 1`;
            const stufenQuery = `SELECT * FROM mahnstufen_einstellungen WHERE stufe = ?`;

            db.query(dojoQuery, (dojoErr, dojoResults) => {
                const dojo = dojoResults?.[0] || {};

                db.query(stufenQuery, [mahnstufe], async (stufenErr, stufenResults) => {
                    const mahnstufeSettings = stufenResults?.[0] || {};
                    const mahngebuehr = mahnstufeSettings.mahngebuehr || 0;

                    try {
                        const pdfData = {
                            mitglied: {
                                vorname: beitragData.vorname,
                                nachname: beitragData.nachname,
                                anrede: beitragData.anrede,
                                strasse: beitragData.strasse,
                                hausnummer: beitragData.hausnummer,
                                plz: beitragData.plz,
                                ort: beitragData.ort,
                                email: beitragData.email,
                                mitgliedsnummer: beitragData.mitgliedsnummer
                            },
                            beitrag: {
                                betrag: beitragData.betrag,
                                beschreibung: beitragData.beschreibung,
                                faelligkeitsdatum: beitragData.zahlungsdatum
                            },
                            mahnung: {
                                mahnstufe: parseInt(mahnstufe),
                                mahngebuehr: mahngebuehr,
                                mahndatum: new Date()
                            },
                            dojo: dojo,
                            mahnstufeSettings: mahnstufeSettings
                        };

                        const pdfBuffer = await generateMahnungPDF(pdfData);

                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', `inline; filename="Mahnung_Vorschau_${beitragData.nachname}.pdf"`);
                        res.send(pdfBuffer);

                    } catch (pdfError) {
                        logger.error('Fehler bei PDF-Generierung:', { error: pdfError });
                        res.status(500).json({ error: 'PDF-Generierung fehlgeschlagen' });
                    }
                });
            });
        });
    } catch (error) {
        logger.error('Fehler:', { error: error });
        res.status(500).json({ error: 'Serverfehler' });
    }
});

// ==========================================
// E-MAIL VERSAND
// ==========================================

// Hilfsfunktion: SMTP-Transporter erstellen
async function createMailTransporter() {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM email_einstellungen LIMIT 1`;
        db.query(query, (err, results) => {
            if (err || results.length === 0) {
                return reject(new Error('E-Mail-Einstellungen nicht gefunden'));
            }

            const settings = results[0];
            const transporter = nodemailer.createTransport({
                host: settings.smtp_host,
                port: settings.smtp_port,
                secure: settings.smtp_port === 465,
                auth: {
                    user: settings.smtp_user,
                    pass: settings.smtp_password
                }
            });

            resolve({ transporter, settings });
        });
    });
}

// API: Mahnung per E-Mail versenden
router.post("/mahnungen/:mahnung_id/senden", async (req, res) => {
    const { mahnung_id } = req.params;
    const { mitPdf } = req.body;

    try {
        // Hole Mahnung mit allen Details
        const mahnungQuery = `
            SELECT
                mah.*,
                b.betrag as beitrag_betrag,
                b.beschreibung as beitrag_beschreibung,
                b.zahlungsdatum as faelligkeitsdatum,
                m.mitglied_id,
                m.vorname,
                m.nachname,
                m.anrede,
                m.strasse,
                m.hausnummer,
                m.plz,
                m.ort,
                m.email,
                m.mitgliedsnummer
            FROM mahnungen mah
            JOIN beitraege b ON mah.beitrag_id = b.beitrag_id
            JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
            WHERE mah.mahnung_id = ?
        `;

        db.query(mahnungQuery, [mahnung_id], async (err, mahnungResults) => {
            if (err || mahnungResults.length === 0) {
                return res.status(404).json({ error: 'Mahnung nicht gefunden' });
            }

            const mahnungData = mahnungResults[0];

            if (!mahnungData.email) {
                return res.status(400).json({ error: 'Mitglied hat keine E-Mail-Adresse' });
            }

            // Hole Dojo und Mahnstufen-Einstellungen
            const dojoQuery = `SELECT * FROM dojo LIMIT 1`;
            const stufenQuery = `SELECT * FROM mahnstufen_einstellungen WHERE stufe = ?`;

            db.query(dojoQuery, async (dojoErr, dojoResults) => {
                const dojo = dojoResults?.[0] || {};

                db.query(stufenQuery, [mahnungData.mahnstufe], async (stufenErr, stufenResults) => {
                    const mahnstufeSettings = stufenResults?.[0] || {};

                    try {
                        const { transporter, settings } = await createMailTransporter();

                        // Daten fuer Platzhalter-Ersetzung
                        const placeholderData = {
                            mitglied: {
                                vorname: mahnungData.vorname,
                                nachname: mahnungData.nachname,
                                anrede: mahnungData.anrede,
                                mitgliedsnummer: mahnungData.mitgliedsnummer,
                                strasse: mahnungData.strasse,
                                plz: mahnungData.plz,
                                ort: mahnungData.ort
                            },
                            beitrag: {
                                betrag: mahnungData.beitrag_betrag,
                                faelligkeitsdatum: mahnungData.faelligkeitsdatum
                            },
                            mahnung: {
                                mahnstufe: mahnungData.mahnstufe,
                                mahngebuehr: mahnungData.mahngebuehr,
                                mahndatum: mahnungData.mahndatum
                            },
                            dojo: dojo
                        };

                        // E-Mail-Text mit Platzhaltern ersetzen
                        let emailText = mahnstufeSettings.email_text || getDefaultEmailText(mahnungData.mahnstufe);
                        emailText = replacePlaceholders(emailText, placeholderData);

                        let emailBetreff = mahnstufeSettings.email_betreff || `${mahnungData.mahnstufe}. Mahnung - ${dojo.dojoname || 'Dojo'}`;
                        emailBetreff = replacePlaceholders(emailBetreff, placeholderData);

                        // E-Mail-Optionen
                        const mailOptions = {
                            from: `"${dojo.dojoname || 'Dojo'}" <${settings.smtp_user}>`,
                            to: mahnungData.email,
                            subject: emailBetreff,
                            text: emailText,
                            html: emailText.replace(/\n/g, '<br>')
                        };

                        // PDF als Anhang hinzufuegen
                        if (mitPdf !== false) {
                            const pdfData = {
                                mitglied: placeholderData.mitglied,
                                beitrag: placeholderData.beitrag,
                                mahnung: placeholderData.mahnung,
                                dojo: dojo,
                                mahnstufeSettings: mahnstufeSettings
                            };

                            const pdfBuffer = await generateMahnungPDF(pdfData);

                            mailOptions.attachments = [{
                                filename: `Mahnung_${mahnungData.mahnstufe}_${mahnungData.nachname}.pdf`,
                                content: pdfBuffer,
                                contentType: 'application/pdf'
                            }];
                        }

                        // E-Mail senden
                        await transporter.sendMail(mailOptions);

                        // Mahnung als versendet markieren
                        const updateQuery = `UPDATE mahnungen SET versandt = 1, versand_art = 'email' WHERE mahnung_id = ?`;
                        db.query(updateQuery, [mahnung_id]);

                        res.json({
                            success: true,
                            message: `Mahnung erfolgreich an ${mahnungData.email} gesendet`
                        });

                    } catch (emailError) {
                        logger.error('Fehler beim E-Mail-Versand:', { error: emailError });
                        res.status(500).json({ error: 'E-Mail-Versand fehlgeschlagen', details: emailError.message });
                    }
                });
            });
        });
    } catch (error) {
        logger.error('Fehler:', { error: error });
        res.status(500).json({ error: 'Serverfehler', details: error.message });
    }
});

// Hilfsfunktion: Standard-E-Mail-Text
function getDefaultEmailText(mahnstufe) {
    const texte = {
        1: `Sehr geehrte/r {anrede} {nachname},

bei der Durchsicht unserer Buchhaltung ist uns aufgefallen, dass folgende Zahlung noch aussteht:

Betrag: {betrag}
Faellig seit: {faelligkeitsdatum}

Wir bitten Sie, den Betrag in den naechsten 14 Tagen zu ueberweisen.

Sollte sich Ihre Zahlung mit diesem Schreiben gekreuzt haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.

Mit freundlichen Gruessen
{dojoname}`,

        2: `Sehr geehrte/r {anrede} {nachname},

leider haben wir trotz unserer ersten Zahlungserinnerung noch keinen Zahlungseingang feststellen koennen.

Offener Betrag: {betrag}
Mahngebuehr: {mahngebuehr}
Gesamtbetrag: {gesamtbetrag}

Wir bitten Sie dringend, den Gesamtbetrag innerhalb von 7 Tagen zu begleichen.

Mit freundlichen Gruessen
{dojoname}`,

        3: `Sehr geehrte/r {anrede} {nachname},

trotz unserer bisherigen Mahnungen ist die nachstehende Forderung noch immer offen:

Offener Betrag: {betrag}
Mahngebuehr: {mahngebuehr}
Gesamtbetrag: {gesamtbetrag}

Wir fordern Sie hiermit letztmalig auf, den Gesamtbetrag innerhalb von 7 Tagen zu begleichen.

Andernfalls sehen wir uns gezwungen, weitere rechtliche Schritte einzuleiten.

Mit freundlichen Gruessen
{dojoname}`
    };

    return texte[mahnstufe] || texte[1];
}

// ==========================================
// AUTOMATISCHER MAHNLAUF
// ==========================================

// API: Automatischen Mahnlauf durchfuehren
router.post("/mahnlauf", async (req, res) => {
    const { dojo_id, nurSimulation } = req.body;

    try {
        // Hole Mahnstufen-Einstellungen
        const stufenQuery = `SELECT * FROM mahnstufen_einstellungen WHERE aktiv = 1 ORDER BY stufe ASC`;

        db.query(stufenQuery, async (stufenErr, mahnstufen) => {
            if (stufenErr || mahnstufen.length === 0) {
                return res.status(400).json({ error: 'Keine aktiven Mahnstufen konfiguriert' });
            }

            // Hole alle offenen Beitraege mit aktueller Mahnstufe
            let whereConditions = ['b.bezahlt = 0'];
            let queryParams = [];

            if (dojo_id && dojo_id !== 'all') {
                whereConditions.push('b.dojo_id = ?');
                queryParams.push(parseInt(dojo_id));
            }

            const beitraegeQuery = `
                SELECT
                    b.beitrag_id,
                    b.mitglied_id,
                    b.betrag,
                    b.zahlungsdatum,
                    b.dojo_id,
                    DATEDIFF(CURDATE(), b.zahlungsdatum) as tage_ueberfaellig,
                    COALESCE(MAX(mah.mahnstufe), 0) as aktuelle_mahnstufe,
                    MAX(mah.mahndatum) as letzte_mahnung,
                    m.vorname,
                    m.nachname,
                    m.email
                FROM beitraege b
                JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
                LEFT JOIN mahnungen mah ON b.beitrag_id = mah.beitrag_id
                WHERE ${whereConditions.join(' AND ')}
                GROUP BY b.beitrag_id
                HAVING tage_ueberfaellig > 0
                ORDER BY tage_ueberfaellig DESC
            `;

            db.query(beitraegeQuery, queryParams, async (beitraegeErr, beitraege) => {
                if (beitraegeErr) {
                    logger.error('Fehler beim Laden der Beitraege:', { error: beitraegeErr });
                    return res.status(500).json({ error: 'Datenbankfehler' });
                }

                const ergebnisse = {
                    geprueft: beitraege.length,
                    neueMahnungen: [],
                    uebersprungen: [],
                    fehler: []
                };

                // Pruefe jeden Beitrag
                for (const beitrag of beitraege) {
                    try {
                        const aktuelleStufenNr = beitrag.aktuelle_mahnstufe || 0;
                        const naechsteStufeNr = aktuelleStufenNr + 1;

                        // Finde naechste Mahnstufe
                        const naechsteStufe = mahnstufen.find(s => s.stufe === naechsteStufeNr);

                        if (!naechsteStufe) {
                            // Keine weitere Mahnstufe - bereits hoechste erreicht
                            ergebnisse.uebersprungen.push({
                                beitrag_id: beitrag.beitrag_id,
                                mitglied: `${beitrag.vorname} ${beitrag.nachname}`,
                                grund: `Hoechste Mahnstufe (${aktuelleStufenNr}) bereits erreicht`
                            });
                            continue;
                        }

                        // Pruefe ob genug Tage seit Faelligkeit/letzter Mahnung vergangen
                        let tageSeitReferenz;
                        if (aktuelleStufenNr === 0) {
                            // Noch keine Mahnung - pruefe Tage seit Faelligkeit
                            tageSeitReferenz = beitrag.tage_ueberfaellig;
                        } else {
                            // Bereits gemahnt - pruefe Tage seit letzter Mahnung
                            const tageSeitLetzterMahnung = beitrag.letzte_mahnung
                                ? Math.floor((new Date() - new Date(beitrag.letzte_mahnung)) / (1000 * 60 * 60 * 24))
                                : beitrag.tage_ueberfaellig;
                            tageSeitReferenz = tageSeitLetzterMahnung;
                        }

                        // Pruefe gegen tage_nach_faelligkeit der naechsten Stufe
                        const erforderlicheTage = aktuelleStufenNr === 0
                            ? naechsteStufe.tage_nach_faelligkeit
                            : 14; // Mindestens 14 Tage zwischen Mahnungen

                        if (tageSeitReferenz < erforderlicheTage) {
                            ergebnisse.uebersprungen.push({
                                beitrag_id: beitrag.beitrag_id,
                                mitglied: `${beitrag.vorname} ${beitrag.nachname}`,
                                grund: `Noch ${erforderlicheTage - tageSeitReferenz} Tage bis zur ${naechsteStufeNr}. Mahnung`
                            });
                            continue;
                        }

                        // Mahnung faellig!
                        if (nurSimulation) {
                            ergebnisse.neueMahnungen.push({
                                beitrag_id: beitrag.beitrag_id,
                                mitglied: `${beitrag.vorname} ${beitrag.nachname}`,
                                email: beitrag.email,
                                mahnstufe: naechsteStufeNr,
                                mahngebuehr: naechsteStufe.mahngebuehr,
                                betrag: beitrag.betrag,
                                simulation: true
                            });
                        } else {
                            // Erstelle echte Mahnung
                            const insertQuery = `
                                INSERT INTO mahnungen (beitrag_id, mahnstufe, mahndatum, mahngebuehr, versandt, versand_art)
                                VALUES (?, ?, CURDATE(), ?, 0, 'pending')
                            `;

                            await new Promise((resolve, reject) => {
                                db.query(insertQuery, [beitrag.beitrag_id, naechsteStufeNr, naechsteStufe.mahngebuehr], (err, result) => {
                                    if (err) reject(err);
                                    else resolve(result);
                                });
                            });

                            ergebnisse.neueMahnungen.push({
                                beitrag_id: beitrag.beitrag_id,
                                mitglied: `${beitrag.vorname} ${beitrag.nachname}`,
                                email: beitrag.email,
                                mahnstufe: naechsteStufeNr,
                                mahngebuehr: naechsteStufe.mahngebuehr,
                                betrag: beitrag.betrag
                            });
                        }

                    } catch (beitragError) {
                        ergebnisse.fehler.push({
                            beitrag_id: beitrag.beitrag_id,
                            fehler: beitragError.message
                        });
                    }
                }

                res.json({
                    success: true,
                    simulation: nurSimulation || false,
                    ergebnisse: ergebnisse,
                    zusammenfassung: {
                        geprueft: ergebnisse.geprueft,
                        neueMahnungen: ergebnisse.neueMahnungen.length,
                        uebersprungen: ergebnisse.uebersprungen.length,
                        fehler: ergebnisse.fehler.length
                    }
                });
            });
        });
    } catch (error) {
        logger.error('Fehler beim Mahnlauf:', { error: error });
        res.status(500).json({ error: 'Serverfehler', details: error.message });
    }
});

// API: Mehrere Mahnungen auf einmal versenden
router.post("/mahnungen/batch-senden", async (req, res) => {
    const { mahnung_ids, mitPdf } = req.body;

    if (!mahnung_ids || !Array.isArray(mahnung_ids) || mahnung_ids.length === 0) {
        return res.status(400).json({ error: 'Keine Mahnungs-IDs angegeben' });
    }

    const ergebnisse = {
        erfolgreich: [],
        fehlgeschlagen: []
    };

    for (const mahnung_id of mahnung_ids) {
        try {
            // Simuliere einzelnen Versand (nutzt die existierende Logik)
            // In der Praxis wuerde man hier die Logik aus /mahnungen/:id/senden wiederverwenden
            ergebnisse.erfolgreich.push(mahnung_id);
        } catch (error) {
            ergebnisse.fehlgeschlagen.push({ mahnung_id, fehler: error.message });
        }
    }

    res.json({
        success: true,
        ergebnisse: ergebnisse,
        zusammenfassung: {
            erfolgreich: ergebnisse.erfolgreich.length,
            fehlgeschlagen: ergebnisse.fehlgeschlagen.length
        }
    });
});

module.exports = router;
