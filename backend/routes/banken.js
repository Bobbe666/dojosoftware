const express = require("express");
const db = require("../db");
const router = express.Router();

// IBAN-Validierung und BIC-Lookup
router.post("/validate-iban", (req, res) => {
    const { iban } = req.body;
    
    if (!iban) {
        return res.status(400).json({ error: "IBAN ist erforderlich" });
    }

    // IBAN bereinigen (Leerzeichen entfernen)
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    
    // Deutsche IBAN validieren (DE + 20 Zeichen)
    if (!/^DE\d{20}$/.test(cleanIban)) {
        return res.status(400).json({ 
            error: "Ungültige deutsche IBAN. Format: DE + 20 Ziffern" 
        });
    }

    // Bankleitzahl aus IBAN extrahieren (Zeichen 4-11)
    const bankleitzahl = cleanIban.substring(4, 12);
    // BIC aus Bankleitzahl suchen
    const query = "SELECT bankname, bic FROM banken WHERE bankleitzahl = ?";
    
    db.query(query, [bankleitzahl], (err, results) => {
        if (err) {
            console.error("Fehler bei BIC-Suche:", err);
            return res.status(500).json({ error: "Fehler bei der Bankensuche" });
        }

        if (results.length === 0) {
            return res.json({
                valid: true,
                iban: cleanIban,
                bankleitzahl: bankleitzahl,
                bankname: "Unbekannte Bank",
                bic: "",
                message: "IBAN ist gültig, aber Bank nicht in der Datenbank gefunden"
            });
        }

        const bank = results[0];
        res.json({
            valid: true,
            iban: cleanIban,
            bankleitzahl: bankleitzahl,
            bankname: bank.bankname,
            bic: bank.bic,
            message: "IBAN ist gültig und Bank wurde gefunden"
        });
    });
});

// Konto-Nummer + BLZ zu IBAN konvertieren
router.post("/kto-blz-to-iban", (req, res) => {
    const { kontonummer, bankleitzahl } = req.body;
    
    if (!kontonummer || !bankleitzahl) {
        return res.status(400).json({ 
            error: "Kontonummer und Bankleitzahl sind erforderlich" 
        });
    }

    // Kontonummer auf 10 Stellen auffüllen
    const paddedKto = kontonummer.padStart(10, '0');
    
    // Bankleitzahl validieren (8 Stellen)
    if (!/^\d{8}$/.test(bankleitzahl)) {
        return res.status(400).json({ 
            error: "Bankleitzahl muss 8 Ziffern haben" 
        });
    }

    // BBAN erstellen (Bankleitzahl + Kontonummer)
    const bban = bankleitzahl + paddedKto;
    
    // Prüfziffer berechnen
    const checkDigits = calculateCheckDigits(bban);
    
    // IBAN erstellen
    const iban = `DE${checkDigits}${bban}`;
    // BIC aus Bankleitzahl suchen
    const query = "SELECT bankname, bic FROM banken WHERE bankleitzahl = ?";
    
    db.query(query, [bankleitzahl], (err, results) => {
        if (err) {
            console.error("Fehler bei BIC-Suche:", err);
            return res.status(500).json({ error: "Fehler bei der Bankensuche" });
        }

        const bank = results.length > 0 ? results[0] : { bankname: "Unbekannte Bank", bic: "" };
        
        res.json({
            iban: iban,
            bankleitzahl: bankleitzahl,
            kontonummer: kontonummer,
            bankname: bank.bankname,
            bic: bank.bic,
            message: "IBAN wurde erfolgreich erstellt"
        });
    });
});

// Bankleitzahl-Suche
router.get("/search-bank/:blz", (req, res) => {
    const { blz } = req.params;
    
    if (!/^\d{8}$/.test(blz)) {
        return res.status(400).json({ 
            error: "Bankleitzahl muss 8 Ziffern haben" 
        });
    }

    const query = "SELECT * FROM banken WHERE bankleitzahl = ?";
    
    db.query(query, [blz], (err, results) => {
        if (err) {
            console.error("Fehler bei Bankensuche:", err);
            return res.status(500).json({ error: "Fehler bei der Bankensuche" });
        }

        if (results.length === 0) {
            return res.status(404).json({ 
                error: "Bankleitzahl nicht gefunden" 
            });
        }

        res.json(results[0]);
    });
});

// Alle Banken abrufen (für Dropdown)
router.get("/all", (req, res) => {
    const query = "SELECT bankleitzahl, bankname, bic FROM banken ORDER BY bankname";
    
    db.query(query, (err, results) => {
        if (err) {
            console.error("Fehler beim Abrufen der Banken:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Banken" });
        }

        res.json(results);
    });
});

// Bank-Suche (für Autocomplete)
router.get("/search", (req, res) => {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
        return res.json([]);
    }

    const query = `
        SELECT bankleitzahl, bankname, bic, ort 
        FROM banken 
        WHERE bankname LIKE ? OR ort LIKE ?
        ORDER BY bankname
        LIMIT 10
    `;
    
    const searchTerm = `%${q}%`;
    
    db.query(query, [searchTerm, searchTerm], (err, results) => {
        if (err) {
            console.error("Fehler bei der Bankensuche:", err);
            return res.status(500).json({ error: "Fehler bei der Bankensuche" });
        }
        res.json(results);
    });
});

// Bank-Details abrufen (für Autofill)
router.get("/details/:blz", (req, res) => {
    const { blz } = req.params;
    
    const query = "SELECT * FROM banken WHERE bankleitzahl = ?";
    
    db.query(query, [blz], (err, results) => {
        if (err) {
            console.error("Fehler beim Abrufen der Bank-Details:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Bank-Details" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "Bank nicht gefunden" });
        }

        res.json(results[0]);
    });
});

// IBAN-Prüfziffer berechnen
function calculateCheckDigits(bban) {
    // BBAN + "DE" + "00" für Prüfziffer-Berechnung
    const rearranged = bban + "1314"; // DE = 13, 14
    
    // Modulo 97 berechnen
    let remainder = 0;
    for (let i = 0; i < rearranged.length; i++) {
        remainder = (remainder * 10 + parseInt(rearranged[i])) % 97;
    }
    
    // Prüfziffer berechnen
    const checkDigits = (98 - remainder).toString().padStart(2, '0');
    return checkDigits;
}

module.exports = router;
