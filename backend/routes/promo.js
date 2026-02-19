/**
 * PROMO ROUTES
 * Early-Bird Aktion für die ersten 50 Dojos
 * - 50% Rabatt für 12 Monate
 * - Erste 2 Monate kostenlos
 */

const express = require('express');
const router = express.Router();

// Promo-Konfiguration
const PROMO_CONFIG = {
    name: 'early-bird-2026',
    maxDojos: 50,
    startCount: 9,  // Beginnt bei 9 (bereits registrierte Dojos simulieren)
    discountPercent: 50,
    discountMonths: 12,
    freeMonths: 2,
    active: true
};

/**
 * GET /api/promo/early-bird
 * Holt den aktuellen Stand der Early-Bird Aktion
 */
router.get('/early-bird', async (req, res) => {
    try {
        const db = req.db;

        // Prüfe ob promo_registrations Tabelle existiert, wenn nicht erstellen
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS promo_registrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                promo_name VARCHAR(100) NOT NULL,
                dojo_id INT,
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                discount_percent INT DEFAULT 50,
                discount_months INT DEFAULT 12,
                free_months INT DEFAULT 2,
                UNIQUE KEY unique_dojo_promo (dojo_id, promo_name)
            )
        `);

        // Zähle registrierte Dojos für diese Promo
        const [countResult] = await db.promise().query(`
            SELECT COUNT(*) as count
            FROM promo_registrations
            WHERE promo_name = ?
        `, [PROMO_CONFIG.name]);

        const registeredCount = countResult[0].count + PROMO_CONFIG.startCount;
        const spotsRemaining = Math.max(0, PROMO_CONFIG.maxDojos - registeredCount);
        const isActive = PROMO_CONFIG.active && spotsRemaining > 0;

        res.json({
            success: true,
            promo: {
                name: PROMO_CONFIG.name,
                active: isActive,
                currentCount: registeredCount,
                maxDojos: PROMO_CONFIG.maxDojos,
                spotsRemaining: spotsRemaining,
                discountPercent: PROMO_CONFIG.discountPercent,
                discountMonths: PROMO_CONFIG.discountMonths,
                freeMonths: PROMO_CONFIG.freeMonths
            }
        });

    } catch (error) {
        console.error('Fehler beim Laden der Promo-Daten:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Laden der Promo-Daten'
        });
    }
});

/**
 * POST /api/promo/early-bird/register
 * Registriert ein Dojo für die Early-Bird Aktion
 * Wird bei erfolgreicher Dojo-Registrierung aufgerufen
 */
router.post('/early-bird/register', async (req, res) => {
    try {
        const db = req.db;
        const { dojo_id } = req.body;

        if (!dojo_id) {
            return res.status(400).json({
                success: false,
                message: 'dojo_id erforderlich'
            });
        }

        // Prüfe ob Promo noch aktiv
        const [countResult] = await db.promise().query(`
            SELECT COUNT(*) as count
            FROM promo_registrations
            WHERE promo_name = ?
        `, [PROMO_CONFIG.name]);

        const currentCount = countResult[0].count + PROMO_CONFIG.startCount;

        if (currentCount >= PROMO_CONFIG.maxDojos) {
            return res.json({
                success: false,
                message: 'Promo-Aktion ist beendet',
                promoApplied: false
            });
        }

        // Prüfe ob Dojo bereits registriert
        const [existing] = await db.promise().query(`
            SELECT id FROM promo_registrations
            WHERE dojo_id = ? AND promo_name = ?
        `, [dojo_id, PROMO_CONFIG.name]);

        if (existing.length > 0) {
            return res.json({
                success: true,
                message: 'Dojo bereits für Promo registriert',
                promoApplied: true,
                discountPercent: PROMO_CONFIG.discountPercent,
                discountMonths: PROMO_CONFIG.discountMonths,
                freeMonths: PROMO_CONFIG.freeMonths
            });
        }

        // Registriere Dojo für Promo
        await db.promise().query(`
            INSERT INTO promo_registrations
            (promo_name, dojo_id, discount_percent, discount_months, free_months)
            VALUES (?, ?, ?, ?, ?)
        `, [
            PROMO_CONFIG.name,
            dojo_id,
            PROMO_CONFIG.discountPercent,
            PROMO_CONFIG.discountMonths,
            PROMO_CONFIG.freeMonths
        ]);

        res.json({
            success: true,
            message: 'Promo erfolgreich angewendet',
            promoApplied: true,
            discountPercent: PROMO_CONFIG.discountPercent,
            discountMonths: PROMO_CONFIG.discountMonths,
            freeMonths: PROMO_CONFIG.freeMonths,
            spotNumber: currentCount + 1
        });

    } catch (error) {
        console.error('Fehler beim Registrieren für Promo:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Registrieren für Promo'
        });
    }
});

/**
 * GET /api/promo/early-bird/check/:dojo_id
 * Prüft ob ein Dojo die Promo hat
 */
router.get('/early-bird/check/:dojo_id', async (req, res) => {
    try {
        const db = req.db;
        const { dojo_id } = req.params;

        const [result] = await db.promise().query(`
            SELECT * FROM promo_registrations
            WHERE dojo_id = ? AND promo_name = ?
        `, [dojo_id, PROMO_CONFIG.name]);

        if (result.length > 0) {
            res.json({
                success: true,
                hasPromo: true,
                promo: result[0]
            });
        } else {
            res.json({
                success: true,
                hasPromo: false
            });
        }

    } catch (error) {
        console.error('Fehler beim Prüfen der Promo:', error);
        res.status(500).json({
            success: false,
            message: 'Fehler beim Prüfen der Promo'
        });
    }
});

module.exports = router;
