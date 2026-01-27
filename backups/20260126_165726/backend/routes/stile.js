const express = require("express");
const router = express.Router();

/**
 * GET /stile
 * Returns all available martial arts styles
 */
router.get("/", (req, res) => {
    // Hardcoded list of available styles (matches stilMapping in mitglieder.js)
    const stile = [
        {
            stil_id: 2,
            stil_name: 'ShieldX',
            beschreibung: 'Moderne Selbstverteidigung mit realistischen Szenarien',
            enum_value: 'ShieldX'
        },
        {
            stil_id: 3,
            stil_name: 'BJJ',
            beschreibung: 'Brazilian Jiu-Jitsu - Bodenkampf und Grappling-Techniken',
            enum_value: 'BJJ'
        },
        {
            stil_id: 4,
            stil_name: 'Kickboxen',
            beschreibung: 'Moderne Kampfsportart kombiniert Boxing mit Fußtechniken',
            enum_value: 'Kickboxen'
        },
        {
            stil_id: 5,
            stil_name: 'Enso Karate',
            beschreibung: 'Traditionelle japanische Kampfkunst mit Fokus auf Schlag- und Tritttechniken',
            enum_value: 'Karate'
        },
        {
            stil_id: 7,
            stil_name: 'Taekwon-Do',
            beschreibung: 'Koreanische Kampfkunst mit Betonung auf Fußtechniken und hohe Tritte',
            enum_value: 'Taekwon-Do'
        }
    ];

    res.json(stile);
});

module.exports = router;
