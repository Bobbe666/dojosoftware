const express = require("express");
const db = require("../db");
const router = express.Router();

/**
 * API-Route: Generiere SEPA-Lastschrift CSV für alle aktiven Verträge
 * GET /api/lastschriftlauf
 */
router.get("/", async (req, res) => {
    try {
        console.log('📦 Starting SEPA batch file generation...');

        // Query für alle aktiven Verträge mit SEPA-Mandat (inkl. offene Rechnungen)
        const query = `
            SELECT
                v.id as vertrag_id,
                v.mitglied_id,
                v.monatsbeitrag as monatlicher_beitrag,
                COALESCE(SUM(r.betrag), 0) as offene_rechnungen,
                v.billing_cycle as zahlungszyklus,
                v.vertragsbeginn,
                m.vorname,
                m.nachname,
                m.iban,
                m.bic,
                m.kontoinhaber,
                sm.bankname,
                m.zahlungsmethode,
                t.name as tarif_name,
                t.price_cents,
                sm.mandatsreferenz,
                sm.glaeubiger_id,
                sm.erstellungsdatum as mandat_datum
            FROM vertraege v
            JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
            LEFT JOIN tarife t ON v.tarif_id = t.id
            LEFT JOIN sepa_mandate sm ON v.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
            LEFT JOIN rechnungen r ON v.mitglied_id = r.mitglied_id
                AND r.status IN ('offen', 'teilweise_bezahlt', 'ueberfaellig')
                AND r.archiviert = 0
            WHERE v.status = 'aktiv'
              AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND sm.mandatsreferenz IS NOT NULL
              AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
            GROUP BY v.id, v.mitglied_id, v.monatsbeitrag, v.billing_cycle, v.vertragsbeginn,
                     m.vorname, m.nachname, m.iban, m.bic, m.kontoinhaber,
                     sm.bankname, m.zahlungsmethode, t.name, t.price_cents,
                     sm.mandatsreferenz, sm.glaeubiger_id, sm.erstellungsdatum
            ORDER BY m.nachname, m.vorname
        `;

        db.query(query, (err, results) => {
            if (err) {
                console.error('❌ Database error:', err);
                return res.status(500).json({
                    error: 'Datenbankfehler',
                    details: err.message
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    error: 'Keine aktiven Verträge mit SEPA-Lastschrift gefunden'
                });
            }

            console.log(`✅ Found ${results.length} active contracts with SEPA mandate`);

            // Ermittle häufigste Bank
            const mostCommonBank = getMostCommonBank(results);

            // Generiere CSV
            const csvData = generateSepaCSV(results);
            const filename = `SEPA_Lastschriftlauf_${new Date().toISOString().split('T')[0]}.csv`;

            // Send as downloadable file
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('X-Mandate-Count', results.length);
            res.setHeader('X-Total-Amount', calculateTotalAmount(results));
            res.setHeader('X-Primary-Bank', mostCommonBank || 'Unbekannt');

            res.send('\uFEFF' + csvData); // UTF-8 BOM für Excel

            console.log(`📄 SEPA batch file generated: ${filename} via ${mostCommonBank}`);
        });

    } catch (error) {
        console.error('❌ Error generating SEPA batch file:', error);
        res.status(500).json({
            error: 'Fehler bei der Lastschrift-Generierung',
            details: error.message
        });
    }
});

/**
 * API-Route: Mitglieder mit Lastschrift aber ohne SEPA-Mandat
 * GET /api/lastschriftlauf/missing-mandates
 */
// Diagnose-Route: Zeige alle Mitglieder mit Lastschrift und ihren Status
router.get("/diagnose", (req, res) => {
    const query = `
        SELECT
            m.mitglied_id,
            m.vorname,
            m.nachname,
            m.zahlungsmethode,
            (SELECT COUNT(*) FROM vertraege WHERE mitglied_id = m.mitglied_id) as total_contracts,
            (SELECT COUNT(*) FROM vertraege WHERE mitglied_id = m.mitglied_id AND status = 'aktiv') as active_contracts,
            (SELECT COUNT(*) FROM sepa_mandate WHERE mitglied_id = m.mitglied_id) as total_mandates,
            (SELECT COUNT(*) FROM sepa_mandate WHERE mitglied_id = m.mitglied_id AND status = 'aktiv' AND mandatsreferenz IS NOT NULL) as active_mandates,
            (SELECT status FROM sepa_mandate WHERE mitglied_id = m.mitglied_id LIMIT 1) as mandate_status
        FROM mitglieder m
        WHERE (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
        ORDER BY m.nachname, m.vorname
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({
                error: 'Datenbankfehler',
                details: err.message
            });
        }

        const summary = {
            total: results.length,
            with_active_contract: results.filter(r => r.active_contracts > 0).length,
            with_active_mandate: results.filter(r => r.active_mandates > 0).length,
            with_both: results.filter(r => r.active_contracts > 0 && r.active_mandates > 0).length,
            missing_contract: results.filter(r => r.active_contracts === 0).length,
            missing_mandate: results.filter(r => r.active_mandates === 0).length
        };

        res.json({
            success: true,
            summary,
            details: results
        });
    });
});

router.get("/missing-mandates", (req, res) => {
    const query = `
        SELECT DISTINCT
            m.mitglied_id,
            m.vorname,
            m.nachname,
            m.email,
            m.zahlungsmethode,
            COUNT(v.id) as anzahl_vertraege
        FROM mitglieder m
        JOIN vertraege v ON m.mitglied_id = v.mitglied_id
        LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
        WHERE v.status = 'aktiv'
          AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
          AND sm.mandat_id IS NULL
          AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
        GROUP BY m.mitglied_id
        ORDER BY m.nachname, m.vorname
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({
                error: 'Datenbankfehler',
                details: err.message
            });
        }

        res.json({
            success: true,
            count: results.length,
            members: results
        });
    });
});

/**
 * API-Route: Vorschau der Lastschriften (JSON)
 * GET /api/lastschriftlauf/preview
 */
router.get("/preview", (req, res) => {
    try {
        console.log('📢 Preview-Route aufgerufen');
        const query = `
            SELECT
                m.mitglied_id,
                m.vorname,
                m.nachname,
                m.iban,
                m.bic,
                m.kontoinhaber,
                m.zahlungsmethode,
                sm.bankname,
                sm.mandatsreferenz,
                sm.glaeubiger_id,
                COALESCE(SUM(v.monatsbeitrag), 0) as monatlicher_beitrag,
                COALESCE(SUM(r.betrag), 0) as offene_rechnungen,
                COALESCE(GROUP_CONCAT(DISTINCT t.name SEPARATOR ', '), 'Kein Tarif') as tarif_name,
                'monatlich' as zahlungszyklus
            FROM mitglieder m
            JOIN vertraege v ON m.mitglied_id = v.mitglied_id
            LEFT JOIN tarife t ON v.tarif_id = t.id
            LEFT JOIN rechnungen r ON m.mitglied_id = r.mitglied_id
                AND r.status IN ('offen', 'teilweise_bezahlt', 'ueberfaellig')
                AND r.archiviert = 0
            INNER JOIN (
                SELECT mitglied_id, bankname, mandatsreferenz, glaeubiger_id
                FROM sepa_mandate
                WHERE status = 'aktiv' AND mandatsreferenz IS NOT NULL
                ORDER BY erstellungsdatum DESC
                LIMIT 18446744073709551615
            ) sm ON m.mitglied_id = sm.mitglied_id
            WHERE v.status = 'aktiv'
              AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
              AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
            GROUP BY m.mitglied_id, m.vorname, m.nachname, m.iban, m.bic, m.kontoinhaber, m.zahlungsmethode, sm.bankname, sm.mandatsreferenz, sm.glaeubiger_id
            ORDER BY m.nachname, m.vorname
        `;

        db.query(query, (err, results) => {
            if (err) {
                console.error('❌ Database error in /preview:', err);
                console.error('❌ SQL Query:', query);
                return res.status(500).json({
                    success: false,
                    error: 'Datenbankfehler',
                    details: err.message,
                    sqlState: err.sqlState,
                    sqlMessage: err.sqlMessage
                });
            }

            try {
                // Ermittle häufigste Bank
                const mostCommonBank = getMostCommonBank(results);

                const preview = results.map(r => ({
                    mitglied_id: r.mitglied_id,
                    name: `${r.vorname || ''} ${r.nachname || ''}`.trim(),
                    iban: maskIBAN(r.iban),
                    betrag: calculateAmount(r),
                    mandatsreferenz: r.mandatsreferenz || 'KEIN MANDAT',
                    tarif: r.tarif_name || 'Kein Tarif',
                    zahlungszyklus: r.zahlungszyklus || 'monatlich',
                    bank: r.bankname || 'Unbekannt'
                }));

                res.json({
                    success: true,
                    count: results.length,
                    total_amount: calculateTotalAmount(results),
                    primary_bank: mostCommonBank || 'Gemischte Banken',
                    preview: preview
                });
            } catch (processingError) {
                console.error('❌ Error processing preview results:', processingError);
                return res.status(500).json({
                    success: false,
                    error: 'Fehler bei der Verarbeitung der Daten',
                    details: processingError.message
                });
            }
        });
    } catch (error) {
        console.error('❌ Error in /preview route:', error);
        return res.status(500).json({
            success: false,
            error: 'Fehler in der Preview-Route',
            details: error.message
        });
    }
});

/**
 * Generiere SEPA-CSV im PAIN.008 Format (vereinfacht)
 */
function generateSepaCSV(contracts) {
    // CSV Headers (Deutsche Bank Format)
    const headers = [
        'Mandatsreferenz',
        'IBAN',
        'BIC',
        'Kontoinhaber',
        'Betrag',
        'Währung',
        'Verwendungszweck',
        'Mandat-Datum',
        'Mitgliedsnummer',
        'Tarif'
    ];

    const rows = [headers.join(';')];

    contracts.forEach(contract => {
        const betrag = calculateAmount(contract);
        const verwendungszweck = `Mitgliedsbeitrag ${contract.tarif_name || 'Standard'} - ${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;

        const row = [
            contract.mandatsreferenz || `DOJO-${contract.mitglied_id}-TEMP`,
            contract.iban,
            contract.bic || '',
            `"${contract.kontoinhaber || `${contract.vorname} ${contract.nachname}`}"`,
            betrag.toFixed(2),
            'EUR',
            `"${verwendungszweck}"`,
            contract.mandat_datum ? new Date(contract.mandat_datum).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            contract.mitglied_id,
            contract.tarif_name || 'Standard'
        ];

        rows.push(row.join(';'));
    });

    return rows.join('\n');
}

/**
 * Berechne Betrag für einen Vertrag (inkl. offene Rechnungen)
 */
function calculateAmount(contract) {
    try {
        let totalAmount = 0;

        // 1. Monatsbeitrag
        if (contract.monatlicher_beitrag != null && contract.monatlicher_beitrag !== undefined) {
            const amount = parseFloat(contract.monatlicher_beitrag);
            if (!isNaN(amount) && amount > 0) {
                totalAmount += amount;
            }
        } else if (contract.price_cents != null && contract.price_cents !== undefined) {
            // Fallback zu Tarif-Preis
            const amount = parseFloat(contract.price_cents) / 100;
            if (!isNaN(amount) && amount > 0) {
                totalAmount += amount;
            }
        }

        // 2. Offene Rechnungen hinzufügen
        if (contract.offene_rechnungen != null && contract.offene_rechnungen !== undefined) {
            const invoiceAmount = parseFloat(contract.offene_rechnungen);
            if (!isNaN(invoiceAmount) && invoiceAmount > 0) {
                totalAmount += invoiceAmount;
            }
        }

        return totalAmount;
    } catch (error) {
        console.error('❌ Error calculating amount for contract:', contract, error);
        return 0.00;
    }
}

/**
 * Berechne Gesamtsumme
 */
function calculateTotalAmount(contracts) {
    return contracts.reduce((sum, contract) => {
        return sum + calculateAmount(contract);
    }, 0).toFixed(2);
}

/**
 * Maskiere IBAN für Preview (zeige nur letzte 4 Stellen)
 */
function maskIBAN(iban) {
    if (!iban || iban.length < 4) return '****';
    return '****' + iban.slice(-4);
}

/**
 * Ermittle die häufigste Bank aus den Mandaten
 */
function getMostCommonBank(contracts) {
    if (!contracts || contracts.length === 0) return null;

    // Zähle Banken
    const bankCounts = {};
    contracts.forEach(contract => {
        const bank = contract.bankname || 'Unbekannt';
        bankCounts[bank] = (bankCounts[bank] || 0) + 1;
    });

    // Finde häufigste Bank
    let mostCommonBank = null;
    let maxCount = 0;

    for (const [bank, count] of Object.entries(bankCounts)) {
        if (count > maxCount) {
            maxCount = count;
            mostCommonBank = bank;
        }
    }

    // Wenn mehrere Banken gleich häufig sind, zeige alle
    const topBanks = Object.entries(bankCounts)
        .filter(([bank, count]) => count === maxCount)
        .map(([bank]) => bank);

    if (topBanks.length > 1) {
        return topBanks.join(' / ');
    }

    return mostCommonBank;
}

module.exports = router;
