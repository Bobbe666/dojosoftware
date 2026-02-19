/**
 * =============================================================================
 * FREUNDE WERBEN FREUNDE - REFERRAL API
 * =============================================================================
 * Komplettes Referral-System mit Codes, Prämien und Staffelungen
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const crypto = require('crypto');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
};

// Code-Generator
const generateReferralCode = (mitgliedId) => {
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `REF${mitgliedId}${random}`;
};

// =============================================================================
// EINSTELLUNGEN
// =============================================================================

/**
 * GET /referral/settings
 * Referral-Einstellungen für das Dojo laden
 */
router.get('/settings', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo-ID erforderlich' });
        }

        let [settings] = await queryAsync(
            'SELECT * FROM referral_settings WHERE dojo_id = ?',
            [dojoId]
        );

        // Wenn keine Einstellungen existieren, Defaults zurückgeben
        if (!settings) {
            settings = {
                dojo_id: dojoId,
                aktiv: false,
                standard_praemie: 50.00,
                max_kostenlos_monate: 12,
                mitglieder_fuer_max: 15,
                auszahlungsmodus: 'mitglied_waehlt',
                mindest_vertragslaufzeit_monate: 1
            };
        }

        res.json(settings);

    } catch (error) {
        logger.error('Fehler beim Laden der Referral-Einstellungen:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * PUT /referral/settings
 * Referral-Einstellungen speichern
 */
router.put('/settings', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const {
            aktiv,
            standard_praemie,
            max_kostenlos_monate,
            mitglieder_fuer_max,
            auszahlungsmodus,
            mindest_vertragslaufzeit_monate
        } = req.body;

        // Upsert
        await queryAsync(`
            INSERT INTO referral_settings
            (dojo_id, aktiv, standard_praemie, max_kostenlos_monate, mitglieder_fuer_max, auszahlungsmodus, mindest_vertragslaufzeit_monate)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                aktiv = VALUES(aktiv),
                standard_praemie = VALUES(standard_praemie),
                max_kostenlos_monate = VALUES(max_kostenlos_monate),
                mitglieder_fuer_max = VALUES(mitglieder_fuer_max),
                auszahlungsmodus = VALUES(auszahlungsmodus),
                mindest_vertragslaufzeit_monate = VALUES(mindest_vertragslaufzeit_monate),
                aktualisiert_am = NOW()
        `, [
            dojoId,
            aktiv ? 1 : 0,
            standard_praemie || 50.00,
            max_kostenlos_monate || 12,
            mitglieder_fuer_max || 15,
            auszahlungsmodus || 'mitglied_waehlt',
            mindest_vertragslaufzeit_monate || 1
        ]);

        logger.info(`Referral-Einstellungen aktualisiert für Dojo ${dojoId}`);

        res.json({ success: true, message: 'Einstellungen gespeichert' });

    } catch (error) {
        logger.error('Fehler beim Speichern der Referral-Einstellungen:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

// =============================================================================
// PRÄMIEN-STAFFELUNG
// =============================================================================

/**
 * GET /referral/staffel
 * Prämien-Staffelung laden
 */
router.get('/staffel', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);

        const staffel = await queryAsync(`
            SELECT * FROM referral_praemien_staffel
            WHERE dojo_id = ? AND aktiv = 1
            ORDER BY min_vertragslaufzeit_monate ASC
        `, [dojoId]);

        res.json(staffel);

    } catch (error) {
        logger.error('Fehler beim Laden der Staffelung:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * POST /referral/staffel
 * Neue Staffelung hinzufügen
 */
router.post('/staffel', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { min_vertragslaufzeit_monate, praemie_betrag, beschreibung } = req.body;

        const result = await queryAsync(`
            INSERT INTO referral_praemien_staffel
            (dojo_id, min_vertragslaufzeit_monate, praemie_betrag, beschreibung)
            VALUES (?, ?, ?, ?)
        `, [dojoId, min_vertragslaufzeit_monate, praemie_betrag, beschreibung || null]);

        res.status(201).json({
            success: true,
            id: result.insertId,
            message: 'Staffelung hinzugefügt'
        });

    } catch (error) {
        logger.error('Fehler beim Hinzufügen der Staffelung:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * PUT /referral/staffel/:id
 * Staffelung bearbeiten
 */
router.put('/staffel/:id', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { id } = req.params;
        const { min_vertragslaufzeit_monate, praemie_betrag, beschreibung } = req.body;

        await queryAsync(`
            UPDATE referral_praemien_staffel
            SET min_vertragslaufzeit_monate = ?, praemie_betrag = ?, beschreibung = ?
            WHERE id = ? AND dojo_id = ?
        `, [min_vertragslaufzeit_monate, praemie_betrag, beschreibung || null, id, dojoId]);

        res.json({ success: true, message: 'Staffelung aktualisiert' });

    } catch (error) {
        logger.error('Fehler beim Aktualisieren der Staffelung:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * DELETE /referral/staffel/:id
 * Staffelung löschen (soft delete)
 */
router.delete('/staffel/:id', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { id } = req.params;

        await queryAsync(`
            UPDATE referral_praemien_staffel SET aktiv = 0 WHERE id = ? AND dojo_id = ?
        `, [id, dojoId]);

        res.json({ success: true, message: 'Staffelung gelöscht' });

    } catch (error) {
        logger.error('Fehler beim Löschen der Staffelung:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

// =============================================================================
// REFERRAL CODES
// =============================================================================

/**
 * GET /referral/codes
 * Alle Codes laden (Admin) oder eigene Codes (Mitglied)
 */
router.get('/codes', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { mitglied_id, marketing_aktion_id } = req.query;

        let whereClause = 'WHERE rc.dojo_id = ?';
        const params = [dojoId];

        if (mitglied_id) {
            whereClause += ' AND rc.mitglied_id = ?';
            params.push(mitglied_id);
        }

        if (marketing_aktion_id) {
            whereClause += ' AND rc.marketing_aktion_id = ?';
            params.push(marketing_aktion_id);
        }

        const codes = await queryAsync(`
            SELECT
                rc.*,
                CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
                mj.titel as aktion_titel
            FROM referral_codes rc
            JOIN mitglieder m ON rc.mitglied_id = m.mitglied_id
            LEFT JOIN marketing_jahresplan mj ON rc.marketing_aktion_id = mj.id
            ${whereClause}
            ORDER BY rc.erstellt_am DESC
        `, params);

        res.json(codes);

    } catch (error) {
        logger.error('Fehler beim Laden der Codes:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * POST /referral/codes
 * Neuen Referral-Code generieren
 */
router.post('/codes', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { mitglied_id, marketing_aktion_id, gueltig_von, gueltig_bis, max_verwendungen } = req.body;

        if (!mitglied_id) {
            return res.status(400).json({ error: 'Mitglied-ID erforderlich' });
        }

        // Prüfen ob schon ein aktiver Code existiert für diese Aktion
        if (marketing_aktion_id) {
            const [existing] = await queryAsync(`
                SELECT id FROM referral_codes
                WHERE mitglied_id = ? AND marketing_aktion_id = ? AND aktiv = 1
            `, [mitglied_id, marketing_aktion_id]);

            if (existing) {
                return res.status(400).json({ error: 'Es existiert bereits ein aktiver Code für diese Aktion' });
            }
        }

        const code = generateReferralCode(mitglied_id);

        const result = await queryAsync(`
            INSERT INTO referral_codes
            (dojo_id, mitglied_id, marketing_aktion_id, code, gueltig_von, gueltig_bis, max_verwendungen)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            dojoId,
            mitglied_id,
            marketing_aktion_id || null,
            code,
            gueltig_von || null,
            gueltig_bis || null,
            max_verwendungen || null
        ]);

        logger.info(`Referral-Code generiert: ${code} für Mitglied ${mitglied_id}`);

        res.status(201).json({
            success: true,
            id: result.insertId,
            code: code,
            message: 'Referral-Code generiert'
        });

    } catch (error) {
        logger.error('Fehler beim Generieren des Codes:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * POST /referral/codes/generate-bulk
 * Codes für alle aktiven Mitglieder einer Aktion generieren
 */
router.post('/codes/generate-bulk', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { marketing_aktion_id, gueltig_von, gueltig_bis } = req.body;

        // Alle aktiven Mitglieder ohne Code für diese Aktion holen
        const mitglieder = await queryAsync(`
            SELECT m.mitglied_id
            FROM mitglieder m
            WHERE m.dojo_id = ? AND m.status = 'aktiv'
            AND m.mitglied_id NOT IN (
                SELECT mitglied_id FROM referral_codes
                WHERE marketing_aktion_id = ? AND aktiv = 1
            )
        `, [dojoId, marketing_aktion_id]);

        let generated = 0;
        for (const m of mitglieder) {
            const code = generateReferralCode(m.mitglied_id);
            await queryAsync(`
                INSERT INTO referral_codes
                (dojo_id, mitglied_id, marketing_aktion_id, code, gueltig_von, gueltig_bis)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [dojoId, m.mitglied_id, marketing_aktion_id, code, gueltig_von || null, gueltig_bis || null]);
            generated++;
        }

        logger.info(`${generated} Referral-Codes generiert für Aktion ${marketing_aktion_id}`);

        res.json({
            success: true,
            generated: generated,
            message: `${generated} Codes generiert`
        });

    } catch (error) {
        logger.error('Fehler beim Bulk-Generieren:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * GET /referral/codes/validate/:code
 * Code validieren (für Registrierung - öffentlich zugänglich)
 */
router.get('/codes/validate/:code', async (req, res) => {
    try {
        const { code } = req.params;

        const [referralCode] = await queryAsync(`
            SELECT
                rc.*,
                CONCAT(m.vorname, ' ', m.nachname) as werber_name,
                m.mitglied_id as werber_id
            FROM referral_codes rc
            JOIN mitglieder m ON rc.mitglied_id = m.mitglied_id
            WHERE rc.code = ? AND rc.aktiv = 1
        `, [code.toUpperCase()]);

        if (!referralCode) {
            return res.status(404).json({ valid: false, error: 'Code nicht gefunden' });
        }

        // Gültigkeit prüfen
        const now = new Date();
        if (referralCode.gueltig_von && new Date(referralCode.gueltig_von) > now) {
            return res.json({ valid: false, error: 'Code noch nicht gültig' });
        }
        if (referralCode.gueltig_bis && new Date(referralCode.gueltig_bis) < now) {
            return res.json({ valid: false, error: 'Code abgelaufen' });
        }

        // Max Verwendungen prüfen
        if (referralCode.max_verwendungen && referralCode.aktuelle_verwendungen >= referralCode.max_verwendungen) {
            return res.json({ valid: false, error: 'Code bereits maximal verwendet' });
        }

        res.json({
            valid: true,
            code_id: referralCode.id,
            werber_name: referralCode.werber_name,
            werber_id: referralCode.werber_id,
            dojo_id: referralCode.dojo_id
        });

    } catch (error) {
        logger.error('Fehler bei Code-Validierung:', error);
        res.status(500).json({ valid: false, error: 'Fehler bei der Validierung' });
    }
});

// =============================================================================
// WERBUNGEN
// =============================================================================

/**
 * GET /referral/werbungen
 * Alle Werbungen laden (Admin-Übersicht)
 */
router.get('/werbungen', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { status, werber_id } = req.query;

        let whereClause = 'WHERE r.dojo_id = ?';
        const params = [dojoId];

        if (status) {
            whereClause += ' AND r.status = ?';
            params.push(status);
        }

        if (werber_id) {
            whereClause += ' AND r.werber_mitglied_id = ?';
            params.push(werber_id);
        }

        const werbungen = await queryAsync(`
            SELECT
                r.*,
                CONCAT(mw.vorname, ' ', mw.nachname) as werber_name,
                CONCAT(mg.vorname, ' ', mg.nachname) as geworbener_name,
                mg.email as geworbener_email,
                rc.code as referral_code,
                rp.betrag as praemie_betrag,
                rp.status as praemie_status,
                rp.typ as praemie_typ
            FROM referrals r
            JOIN mitglieder mw ON r.werber_mitglied_id = mw.mitglied_id
            LEFT JOIN mitglieder mg ON r.geworbenes_mitglied_id = mg.mitglied_id
            JOIN referral_codes rc ON r.referral_code_id = rc.id
            LEFT JOIN referral_praemien rp ON rp.referral_id = r.id
            ${whereClause}
            ORDER BY r.erstellt_am DESC
        `, params);

        res.json(werbungen);

    } catch (error) {
        logger.error('Fehler beim Laden der Werbungen:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * GET /referral/meine-werbungen/:mitglied_id
 * Eigene Werbungen laden (Mitglied-Ansicht)
 */
router.get('/meine-werbungen/:mitglied_id', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { mitglied_id } = req.params;

        // Eigene Codes
        const codes = await queryAsync(`
            SELECT
                rc.*,
                mj.titel as aktion_titel,
                (SELECT COUNT(*) FROM referrals WHERE referral_code_id = rc.id) as verwendungen
            FROM referral_codes rc
            LEFT JOIN marketing_jahresplan mj ON rc.marketing_aktion_id = mj.id
            WHERE rc.mitglied_id = ? AND rc.aktiv = 1
            ORDER BY rc.erstellt_am DESC
        `, [mitglied_id]);

        // Eigene Werbungen
        const werbungen = await queryAsync(`
            SELECT
                r.*,
                CONCAT(mg.vorname, ' ', mg.nachname) as geworbener_name,
                rp.betrag as praemie_betrag,
                rp.status as praemie_status,
                rp.typ as praemie_typ
            FROM referrals r
            LEFT JOIN mitglieder mg ON r.geworbenes_mitglied_id = mg.mitglied_id
            LEFT JOIN referral_praemien rp ON rp.referral_id = r.id
            WHERE r.werber_mitglied_id = ?
            ORDER BY r.erstellt_am DESC
        `, [mitglied_id]);

        // Statistiken
        const [stats] = await queryAsync(`
            SELECT
                COUNT(*) as gesamt,
                SUM(CASE WHEN status = 'praemie_ausgezahlt' THEN 1 ELSE 0 END) as ausgezahlt,
                SUM(CASE WHEN status = 'praemie_freigegeben' THEN 1 ELSE 0 END) as freigegeben,
                SUM(CASE WHEN status IN ('registriert', 'vertrag_abgeschlossen', 'erste_zahlung') THEN 1 ELSE 0 END) as ausstehend
            FROM referrals
            WHERE werber_mitglied_id = ?
        `, [mitglied_id]);

        // Gesamte Prämien
        const [praemienSum] = await queryAsync(`
            SELECT
                SUM(CASE WHEN rp.status = 'ausgezahlt' THEN rp.betrag ELSE 0 END) as ausgezahlt,
                SUM(CASE WHEN rp.status IN ('freigegeben', 'ausstehend') THEN rp.betrag ELSE 0 END) as offen
            FROM referral_praemien rp
            WHERE rp.mitglied_id = ?
        `, [mitglied_id]);

        res.json({
            codes,
            werbungen,
            statistik: {
                ...stats,
                praemien_ausgezahlt: praemienSum?.ausgezahlt || 0,
                praemien_offen: praemienSum?.offen || 0
            }
        });

    } catch (error) {
        logger.error('Fehler beim Laden der eigenen Werbungen:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * POST /referral/werbungen
 * Werbung erfassen (bei Registrierung mit Code)
 */
router.post('/werbungen', async (req, res) => {
    try {
        const { referral_code, geworbenes_mitglied_id } = req.body;

        // Code validieren
        const [code] = await queryAsync(`
            SELECT * FROM referral_codes WHERE code = ? AND aktiv = 1
        `, [referral_code.toUpperCase()]);

        if (!code) {
            return res.status(404).json({ error: 'Ungültiger Referral-Code' });
        }

        // Werbung erfassen
        const result = await queryAsync(`
            INSERT INTO referrals
            (dojo_id, werber_mitglied_id, geworbenes_mitglied_id, referral_code_id, status)
            VALUES (?, ?, ?, ?, 'registriert')
        `, [code.dojo_id, code.mitglied_id, geworbenes_mitglied_id, code.id]);

        // Code-Verwendungen erhöhen
        await queryAsync(`
            UPDATE referral_codes SET aktuelle_verwendungen = aktuelle_verwendungen + 1 WHERE id = ?
        `, [code.id]);

        logger.info(`Werbung erfasst: Mitglied ${geworbenes_mitglied_id} geworben von ${code.mitglied_id}`);

        res.status(201).json({
            success: true,
            referral_id: result.insertId,
            werber_id: code.mitglied_id,
            message: 'Werbung erfasst'
        });

    } catch (error) {
        logger.error('Fehler beim Erfassen der Werbung:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * PUT /referral/werbungen/:id/vertrag
 * Vertrag zur Werbung hinzufügen (triggert Prämien-Berechnung)
 */
router.put('/werbungen/:id/vertrag', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { id } = req.params;
        const { vertrag_id, vertrag_laufzeit_monate } = req.body;

        // Werbung laden
        const [werbung] = await queryAsync(
            'SELECT * FROM referrals WHERE id = ? AND dojo_id = ?',
            [id, dojoId]
        );

        if (!werbung) {
            return res.status(404).json({ error: 'Werbung nicht gefunden' });
        }

        // Werbung aktualisieren
        await queryAsync(`
            UPDATE referrals
            SET vertrag_id = ?, vertrag_laufzeit_monate = ?, status = 'vertrag_abgeschlossen', aktualisiert_am = NOW()
            WHERE id = ?
        `, [vertrag_id, vertrag_laufzeit_monate, id]);

        // Prämie berechnen basierend auf Staffelung
        let praemieBetrag = 50.00; // Default

        // Einstellungen laden
        const [settings] = await queryAsync(
            'SELECT * FROM referral_settings WHERE dojo_id = ?',
            [dojoId]
        );

        if (settings) {
            praemieBetrag = settings.standard_praemie;
        }

        // Staffelung prüfen
        const [staffel] = await queryAsync(`
            SELECT praemie_betrag FROM referral_praemien_staffel
            WHERE dojo_id = ? AND min_vertragslaufzeit_monate <= ? AND aktiv = 1
            ORDER BY min_vertragslaufzeit_monate DESC
            LIMIT 1
        `, [dojoId, vertrag_laufzeit_monate]);

        if (staffel) {
            praemieBetrag = staffel.praemie_betrag;
        }

        // Prämie erstellen (noch ausstehend bis erste Zahlung)
        await queryAsync(`
            INSERT INTO referral_praemien
            (dojo_id, referral_id, mitglied_id, betrag, typ, status)
            VALUES (?, ?, ?, ?, 'gutschrift', 'ausstehend')
        `, [dojoId, id, werbung.werber_mitglied_id, praemieBetrag]);

        logger.info(`Vertrag ${vertrag_id} zur Werbung ${id} hinzugefügt, Prämie: ${praemieBetrag}€`);

        res.json({
            success: true,
            praemie_betrag: praemieBetrag,
            message: 'Vertrag hinzugefügt, Prämie berechnet'
        });

    } catch (error) {
        logger.error('Fehler beim Hinzufügen des Vertrags:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * PUT /referral/werbungen/:id/erste-zahlung
 * Erste Zahlung markieren (gibt Prämie frei)
 */
router.put('/werbungen/:id/erste-zahlung', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { id } = req.params;

        // Werbung aktualisieren
        await queryAsync(`
            UPDATE referrals
            SET status = 'praemie_freigegeben', erste_zahlung_datum = CURDATE(), aktualisiert_am = NOW()
            WHERE id = ? AND dojo_id = ?
        `, [id, dojoId]);

        // Prämie freigeben
        await queryAsync(`
            UPDATE referral_praemien
            SET status = 'freigegeben', freigabe_datum = CURDATE()
            WHERE referral_id = ?
        `, [id]);

        logger.info(`Erste Zahlung für Werbung ${id} markiert, Prämie freigegeben`);

        res.json({ success: true, message: 'Prämie freigegeben' });

    } catch (error) {
        logger.error('Fehler beim Markieren der ersten Zahlung:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

// =============================================================================
// PRÄMIEN
// =============================================================================

/**
 * GET /referral/praemien
 * Alle Prämien laden
 */
router.get('/praemien', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { status, mitglied_id } = req.query;

        let whereClause = 'WHERE rp.dojo_id = ?';
        const params = [dojoId];

        if (status) {
            whereClause += ' AND rp.status = ?';
            params.push(status);
        }

        if (mitglied_id) {
            whereClause += ' AND rp.mitglied_id = ?';
            params.push(mitglied_id);
        }

        const praemien = await queryAsync(`
            SELECT
                rp.*,
                CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
                r.geworbenes_mitglied_id,
                CONCAT(mg.vorname, ' ', mg.nachname) as geworbener_name
            FROM referral_praemien rp
            JOIN mitglieder m ON rp.mitglied_id = m.mitglied_id
            JOIN referrals r ON rp.referral_id = r.id
            LEFT JOIN mitglieder mg ON r.geworbenes_mitglied_id = mg.mitglied_id
            ${whereClause}
            ORDER BY rp.erstellt_am DESC
        `, params);

        res.json(praemien);

    } catch (error) {
        logger.error('Fehler beim Laden der Prämien:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * PUT /referral/praemien/:id/auszahlen
 * Prämie als ausgezahlt markieren
 */
router.put('/praemien/:id/auszahlen', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { id } = req.params;
        const { typ, notizen } = req.body;

        await queryAsync(`
            UPDATE referral_praemien
            SET status = 'ausgezahlt', typ = ?, auszahlung_datum = CURDATE(), notizen = ?
            WHERE id = ? AND dojo_id = ?
        `, [typ || 'gutschrift', notizen || null, id, dojoId]);

        // Werbung-Status aktualisieren
        const [praemie] = await queryAsync('SELECT referral_id FROM referral_praemien WHERE id = ?', [id]);
        if (praemie) {
            await queryAsync(`
                UPDATE referrals SET status = 'praemie_ausgezahlt' WHERE id = ?
            `, [praemie.referral_id]);
        }

        logger.info(`Prämie ${id} als ausgezahlt markiert`);

        res.json({ success: true, message: 'Prämie ausgezahlt' });

    } catch (error) {
        logger.error('Fehler beim Auszahlen der Prämie:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * PUT /referral/praemien/:id/wahl
 * Mitglied wählt Auszahlungsart
 */
router.put('/praemien/:id/wahl', async (req, res) => {
    try {
        const { id } = req.params;
        const { wahl } = req.body;

        if (!['gutschrift', 'bar'].includes(wahl)) {
            return res.status(400).json({ error: 'Ungültige Wahl' });
        }

        await queryAsync(`
            UPDATE referral_praemien SET mitglied_wahl = ? WHERE id = ?
        `, [wahl, id]);

        res.json({ success: true, message: 'Wahl gespeichert' });

    } catch (error) {
        logger.error('Fehler beim Speichern der Wahl:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

// =============================================================================
// STATISTIKEN
// =============================================================================

/**
 * GET /referral/statistiken
 * Dashboard-Statistiken
 */
router.get('/statistiken', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { jahr } = req.query;
        const year = parseInt(jahr) || new Date().getFullYear();

        // Gesamtstatistiken
        const [gesamt] = await queryAsync(`
            SELECT
                COUNT(*) as gesamt_werbungen,
                SUM(CASE WHEN status = 'praemie_ausgezahlt' THEN 1 ELSE 0 END) as ausgezahlt,
                SUM(CASE WHEN status = 'praemie_freigegeben' THEN 1 ELSE 0 END) as freigegeben,
                SUM(CASE WHEN status IN ('registriert', 'vertrag_abgeschlossen', 'erste_zahlung') THEN 1 ELSE 0 END) as ausstehend
            FROM referrals
            WHERE dojo_id = ? AND YEAR(erstellt_am) = ?
        `, [dojoId, year]);

        // Prämien-Summen
        const [praemien] = await queryAsync(`
            SELECT
                SUM(CASE WHEN status = 'ausgezahlt' THEN betrag ELSE 0 END) as ausgezahlt_summe,
                SUM(CASE WHEN status IN ('freigegeben', 'ausstehend') THEN betrag ELSE 0 END) as offen_summe
            FROM referral_praemien
            WHERE dojo_id = ? AND YEAR(erstellt_am) = ?
        `, [dojoId, year]);

        // Top-Werber
        const topWerber = await queryAsync(`
            SELECT
                r.werber_mitglied_id,
                CONCAT(m.vorname, ' ', m.nachname) as name,
                COUNT(*) as anzahl_werbungen,
                SUM(CASE WHEN r.status = 'praemie_ausgezahlt' THEN 1 ELSE 0 END) as erfolgreiche
            FROM referrals r
            JOIN mitglieder m ON r.werber_mitglied_id = m.mitglied_id
            WHERE r.dojo_id = ? AND YEAR(r.erstellt_am) = ?
            GROUP BY r.werber_mitglied_id
            ORDER BY anzahl_werbungen DESC
            LIMIT 10
        `, [dojoId, year]);

        // Monatliche Verteilung
        const monatlich = await queryAsync(`
            SELECT
                MONTH(erstellt_am) as monat,
                COUNT(*) as anzahl
            FROM referrals
            WHERE dojo_id = ? AND YEAR(erstellt_am) = ?
            GROUP BY MONTH(erstellt_am)
            ORDER BY monat
        `, [dojoId, year]);

        res.json({
            gesamt: {
                werbungen: gesamt?.gesamt_werbungen || 0,
                ausgezahlt: gesamt?.ausgezahlt || 0,
                freigegeben: gesamt?.freigegeben || 0,
                ausstehend: gesamt?.ausstehend || 0
            },
            praemien: {
                ausgezahlt: praemien?.ausgezahlt_summe || 0,
                offen: praemien?.offen_summe || 0
            },
            top_werber: topWerber,
            monatlich: monatlich
        });

    } catch (error) {
        logger.error('Fehler beim Laden der Statistiken:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

module.exports = router;
