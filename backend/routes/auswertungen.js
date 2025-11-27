const express = require('express');
const router = express.Router();
const db = require('../db');

// Promise-wrapper für db.query
const queryAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

// GET /api/auswertungen/test - Test-Endpunkt
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Auswertungen-Route funktioniert!' });
});

// GET /api/auswertungen/complete - Vollständige Auswertungen für Übersicht-Tab
router.get('/complete', async (req, res) => {
    try {
        // Mitglieder-Statistiken
        const mitgliederStats = await queryAsync(`
            SELECT
                COUNT(*) as gesamt,
                SUM(CASE WHEN aktiv = 1 THEN 1 ELSE 0 END) as aktiv,
                SUM(CASE WHEN aktiv = 0 THEN 1 ELSE 0 END) as inaktiv,
                SUM(CASE WHEN eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) THEN 1 ELSE 0 END) as neueThisMonth
            FROM mitglieder
        `);

        // Altersgruppen
        const altersgruppen = await queryAsync(`
            SELECT
                CASE
                    WHEN DATEDIFF(CURDATE(), geburtsdatum) / 365.25 < 12 THEN 'Kinder (unter 12)'
                    WHEN DATEDIFF(CURDATE(), geburtsdatum) / 365.25 < 18 THEN 'Jugendliche (12-17)'
                    WHEN DATEDIFF(CURDATE(), geburtsdatum) / 365.25 < 30 THEN 'Erwachsene (18-29)'
                    WHEN DATEDIFF(CURDATE(), geburtsdatum) / 365.25 < 50 THEN 'Erwachsene (30-49)'
                    ELSE 'Senioren (50+)'
                END as name,
                COUNT(*) as value
            FROM mitglieder
            WHERE aktiv = 1
            GROUP BY name
            ORDER BY value DESC
        `);

        // Wachstum - Wöchentlich (letzte 12 Wochen)
        const wachstumWoche = await queryAsync(`
            SELECT
                YEARWEEK(eintrittsdatum, 1) as woche,
                DATE_FORMAT(eintrittsdatum, '%Y-W%v') as periode,
                COUNT(*) as neueMitglieder
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
            GROUP BY woche, periode
            ORDER BY woche ASC
        `);

        // Wachstum - Monatlich (letzte 24 Monate für Vergleich)
        const wachstumMonat = await queryAsync(`
            SELECT
                DATE_FORMAT(eintrittsdatum, '%Y-%m') as monat,
                YEAR(eintrittsdatum) as jahr,
                MONTH(eintrittsdatum) as monatNum,
                COUNT(*) as neueMitglieder
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH)
            GROUP BY monat, jahr, monatNum
            ORDER BY monat ASC
        `);

        // Wachstum - Quartalsweise (letzte 8 Quartale)
        const wachstumQuartal = await queryAsync(`
            SELECT
                CONCAT(YEAR(eintrittsdatum), '-Q', QUARTER(eintrittsdatum)) as quartal,
                YEAR(eintrittsdatum) as jahr,
                QUARTER(eintrittsdatum) as quartalNum,
                COUNT(*) as neueMitglieder
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH)
            GROUP BY quartal, jahr, quartalNum
            ORDER BY jahr ASC, quartalNum ASC
        `);

        // Wachstum - Jährlich (letzte 5 Jahre)
        const wachstumJahr = await queryAsync(`
            SELECT
                YEAR(eintrittsdatum) as jahr,
                COUNT(*) as neueMitglieder
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR)
            GROUP BY jahr
            ORDER BY jahr ASC
        `);

        // Vergleich zum Vorjahr (aktuelles Jahr vs. letztes Jahr)
        const aktuellesJahr = new Date().getFullYear();
        const vorjahr = aktuellesJahr - 1;

        const vergleichVorjahr = await queryAsync(`
            SELECT
                YEAR(eintrittsdatum) as jahr,
                COUNT(*) as neueMitglieder
            FROM mitglieder
            WHERE YEAR(eintrittsdatum) IN (?, ?)
            GROUP BY jahr
        `, [vorjahr, aktuellesJahr]);

        const neueAktuellesJahr = vergleichVorjahr.find(v => v.jahr === aktuellesJahr)?.neueMitglieder || 0;
        const neueVorjahr = vergleichVorjahr.find(v => v.jahr === vorjahr)?.neueMitglieder || 0;
        const vorjahresVergleich = neueVorjahr > 0
            ? Math.round(((neueAktuellesJahr - neueVorjahr) / neueVorjahr) * 100)
            : 0;

        // Prognose für nächstes Jahr (basierend auf Durchschnitt der letzten 3 Jahre)
        const prognoseData = await queryAsync(`
            SELECT AVG(anzahl) as durchschnitt
            FROM (
                SELECT COUNT(*) as anzahl
                FROM mitglieder
                WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 3 YEAR)
                GROUP BY YEAR(eintrittsdatum)
            ) as jahresStats
        `);

        const prognoseNaechstesJahr = Math.round(prognoseData[0]?.durchschnitt || neueAktuellesJahr);

        // Check-in / Anwesenheitsstatistik (echte Daten)
        const anwesenheitWochentag = await queryAsync(`
            SELECT
                DAYNAME(checkin_time) as wochentag,
                COUNT(*) as anzahl
            FROM checkins
            WHERE checkin_time >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            GROUP BY wochentag
            ORDER BY FIELD(wochentag, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
        `).catch(() => []);

        // Wochentag-Namen auf Deutsch mappen
        const wochentagMap = {
            'Monday': 'Montag',
            'Tuesday': 'Dienstag',
            'Wednesday': 'Mittwoch',
            'Thursday': 'Donnerstag',
            'Friday': 'Freitag',
            'Saturday': 'Samstag',
            'Sunday': 'Sonntag'
        };

        const wochentagsVerteilung = anwesenheitWochentag.map(w => ({
            tag: wochentagMap[w.wochentag] || w.wochentag,
            anzahl: w.anzahl
        }));

        // Spitzenzeiten (echte Daten aus Check-ins)
        const spitzenzeitenData = await queryAsync(`
            SELECT
                CONCAT(LPAD(stunde, 2, '0'), ':00 - ', LPAD(stunde + 1, 2, '0'), ':00') as zeitfenster,
                COUNT(*) as teilnehmer
            FROM (
                SELECT HOUR(checkin_time) as stunde
                FROM checkins
                WHERE checkin_time >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            ) as hourly_checkins
            GROUP BY stunde
            ORDER BY teilnehmer DESC
            LIMIT 5
        `).catch(() => []);

        const spitzenzeiten = spitzenzeitenData.map(s => ({
            zeit: s.zeitfenster,
            teilnehmer: s.teilnehmer
        }));

        // Durchschnittliche Anwesenheit pro Tag
        const durchschnittAnwesenheit = await queryAsync(`
            SELECT AVG(daily_count) as durchschnitt
            FROM (
                SELECT DATE(checkin_time) as datum, COUNT(*) as daily_count
                FROM checkins
                WHERE checkin_time >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                GROUP BY DATE(checkin_time)
            ) as daily_stats
        `).catch(() => [{ durchschnitt: 0 }]);

        // Mitgliedschafts-Längen-Verteilung
        const mitgliedschaftsLaengen = await queryAsync(`
            SELECT
                CASE
                    WHEN DATEDIFF(CURDATE(), eintrittsdatum) / 365.25 < 0.5 THEN 'Unter 6 Monate'
                    WHEN DATEDIFF(CURDATE(), eintrittsdatum) / 365.25 < 1 THEN '6-12 Monate'
                    WHEN DATEDIFF(CURDATE(), eintrittsdatum) / 365.25 < 2 THEN '1-2 Jahre'
                    WHEN DATEDIFF(CURDATE(), eintrittsdatum) / 365.25 < 5 THEN '2-5 Jahre'
                    ELSE 'Über 5 Jahre'
                END as zeitraum,
                COUNT(*) as anzahl
            FROM mitglieder
            WHERE aktiv = 1
            GROUP BY zeitraum
            ORDER BY FIELD(zeitraum, 'Unter 6 Monate', '6-12 Monate', '1-2 Jahre', '2-5 Jahre', 'Über 5 Jahre')
        `);

        // Austritte/Kündigungen (letzte 12 Monate)
        const austritte = await queryAsync(`
            SELECT
                DATE_FORMAT(austritt_datum, '%Y-%m') as monat,
                COUNT(*) as anzahl
            FROM mitglieder
            WHERE austritt_datum >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                AND austritt_datum IS NOT NULL
            GROUP BY monat
            ORDER BY monat ASC
        `).catch(() => []);

        // Tarif-Verteilung (über vertraege)
        const tarifVerteilung = await queryAsync(`
            SELECT
                t.name as tarifname,
                COUNT(DISTINCT m.mitglied_id) as anzahl
            FROM tarife t
            LEFT JOIN vertraege v ON t.id = v.tarif_id
            LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id AND m.aktiv = 1
            WHERE t.active = 1
            GROUP BY t.id, t.name
            HAVING anzahl > 0
            ORDER BY anzahl DESC
        `).catch(() => []);

        // Churn-Rate berechnen (Austritte / Gesamtmitglieder)
        const totalAustritte = austritte.reduce((sum, a) => sum + a.anzahl, 0);
        const churnRate = mitgliederStats[0].gesamt > 0
            ? Math.round((totalAustritte / mitgliederStats[0].gesamt) * 100 * 10) / 10
            : 0;

        // Kurs-Statistiken
        const kursStats = await queryAsync(`
            SELECT
                COUNT(*) as gesamtKurse,
                COUNT(*) as aktivKurse
            FROM kurse
        `);

        // Beliebteste Kurse (vereinfacht, da kursmitglieder-Tabelle nicht existiert)
        const beliebtsteKurse = await queryAsync(`
            SELECT
                gruppenname as name,
                0 as teilnehmer
            FROM kurse
            ORDER BY gruppenname ASC
            LIMIT 5
        `);

        // Stil-Verteilung
        const stilVerteilung = await queryAsync(`
            SELECT
                s.name,
                COUNT(k.kurs_id) as anzahl
            FROM stile s
            LEFT JOIN kurse k ON s.name = k.stil
            GROUP BY s.stil_id, s.name
            ORDER BY anzahl DESC
        `);

        // Finanzielle Daten (Durchschnittsbeitrag aus Tarifen)
        const tarifeResult = await queryAsync('SELECT AVG(price_cents) as avg_price FROM tarife WHERE active = 1');
        const durchschnittsbeitrag = Math.round((tarifeResult[0]?.avg_price || 8500) / 100);
        const monatlicheEinnahmen = mitgliederStats[0].aktiv * durchschnittsbeitrag;

        // Geschlechterverteilung
        const geschlechterVerteilung = await queryAsync(`
            SELECT
                geschlecht,
                COUNT(*) as anzahl
            FROM mitglieder
            WHERE aktiv = 1
            GROUP BY geschlecht
        `);

        // Eintrittsjahre (letzte 5 Jahre)
        const eintrittsJahre = await queryAsync(`
            SELECT
                YEAR(eintrittsdatum) as jahr,
                COUNT(*) as anzahl
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR)
            GROUP BY jahr
            ORDER BY jahr DESC
        `);

        // Nächste Geburtstage (nächste 30 Tage)
        const naechsteGeburtstage = await queryAsync(`
            SELECT
                vorname,
                nachname,
                geburtsdatum,
                DATEDIFF(
                    DATE_ADD(geburtsdatum, INTERVAL YEAR(CURDATE()) - YEAR(geburtsdatum) + IF(DAYOFYEAR(CURDATE()) > DAYOFYEAR(geburtsdatum), 1, 0) YEAR),
                    CURDATE()
                ) as tage_bis_geburtstag
            FROM mitglieder
            WHERE aktiv = 1
            HAVING tage_bis_geburtstag BETWEEN 0 AND 30
            ORDER BY tage_bis_geburtstag ASC
            LIMIT 10
        `);

        // Mitgliedschaftsdauer (Durchschnitt)
        const mitgliedschaftsDauer = await queryAsync(`
            SELECT
                AVG(DATEDIFF(CURDATE(), eintrittsdatum) / 365.25) as durchschnitt_jahre
            FROM mitglieder
            WHERE aktiv = 1
        `);

        // Mitglieder pro Stil (aus mitglied_stile Tabelle)
        const mitgliederProStil = await queryAsync(`
            SELECT
                s.name as stil,
                COUNT(DISTINCT ms.mitglied_id) as anzahl
            FROM stile s
            LEFT JOIN mitglied_stile ms ON s.stil_id = ms.mitglied_stil_id
            WHERE ms.mitglied_id IN (SELECT mitglied_id FROM mitglieder WHERE aktiv = 1)
            GROUP BY s.stil_id, s.name
            ORDER BY anzahl DESC
        `).catch(() => []);

        // Graduierungen (Top 5 häufigste Gurte)
        const graduierungsStats = await queryAsync(`
            SELECT
                gurtfarbe,
                COUNT(*) as anzahl
            FROM mitglieder
            WHERE aktiv = 1 AND gurtfarbe IS NOT NULL AND gurtfarbe != ''
            GROUP BY gurtfarbe
            ORDER BY anzahl DESC
            LIMIT 5
        `);

        // Retention-Rate (Mitglieder die länger als 1 Jahr dabei sind)
        const retentionStats = await queryAsync(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN DATEDIFF(CURDATE(), eintrittsdatum) > 365 THEN 1 ELSE 0 END) as ueber_ein_jahr
            FROM mitglieder
            WHERE aktiv = 1
        `);

        const retentionRate = retentionStats[0].total > 0
            ? Math.round((retentionStats[0].ueber_ein_jahr / retentionStats[0].total) * 100)
            : 0;

        // Zusammenfassen
        const auswertungsData = {
            generatedAt: new Date().toISOString(),
            summary: {
                totalMembers: mitgliederStats[0].gesamt,
                activeMembers: mitgliederStats[0].aktiv,
                inactiveMembers: mitgliederStats[0].inaktiv,
                monthlyRevenue: monatlicheEinnahmen,
                yearlyRevenue: monatlicheEinnahmen * 12,
                averageMembershipDuration: Math.round((mitgliedschaftsDauer[0]?.durchschnitt_jahre || 0) * 10) / 10,
                retentionRate: retentionRate,
                growthRate: wachstumMonat.length > 1
                    ? Math.round(((wachstumMonat[wachstumMonat.length - 1].neueMitglieder - wachstumMonat[0].neueMitglieder) / wachstumMonat[0].neueMitglieder) * 100)
                    : 0
            },
            mitgliederAnalyse: {
                gesamt: mitgliederStats[0].gesamt,
                aktiv: mitgliederStats[0].aktiv,
                inaktiv: mitgliederStats[0].inaktiv,
                neueThisMonth: mitgliederStats[0].neueThisMonth,
                altersgruppen: altersgruppen,
                demographics: altersgruppen,
                geschlechterVerteilung: geschlechterVerteilung,
                eintrittsJahre: eintrittsJahre,
                mitgliederProStil: mitgliederProStil,
                graduierungsStats: graduierungsStats,
                naechsteGeburtstage: naechsteGeburtstage.map(g => ({
                    name: `${g.vorname} ${g.nachname}`,
                    datum: g.geburtsdatum,
                    tageVerbleibend: g.tage_bis_geburtstag
                })),
                mitgliedschaftsLaengen: mitgliedschaftsLaengen,
                austritte: austritte,
                churnRate: churnRate
            },
            kursAnalyse: {
                gesamtKurse: kursStats[0].gesamtKurse,
                aktivKurse: kursStats[0].aktivKurse,
                beliebtsteKurse: beliebtsteKurse,
                durchschnittlicheTeilnehmer: beliebtsteKurse.length > 0
                    ? Math.round(beliebtsteKurse.reduce((sum, k) => sum + k.teilnehmer, 0) / beliebtsteKurse.length)
                    : 0
            },
            wachstumsAnalyse: {
                woche: wachstumWoche.map(w => ({
                    periode: w.periode,
                    neueMitglieder: w.neueMitglieder
                })),
                monat: wachstumMonat.map(w => ({
                    monat: w.monat,
                    jahr: w.jahr,
                    neueMitglieder: w.neueMitglieder
                })),
                quartal: wachstumQuartal.map(w => ({
                    quartal: w.quartal,
                    jahr: w.jahr,
                    neueMitglieder: w.neueMitglieder
                })),
                jahr: wachstumJahr.map(w => ({
                    jahr: w.jahr,
                    neueMitglieder: w.neueMitglieder
                })),
                vergleichVorjahr: {
                    aktuellesJahr: aktuellesJahr,
                    vorjahr: vorjahr,
                    neueAktuellesJahr: neueAktuellesJahr,
                    neueVorjahr: neueVorjahr,
                    differenz: neueAktuellesJahr - neueVorjahr,
                    prozent: vorjahresVergleich
                },
                prognose: {
                    naechstesJahr: prognoseNaechstesJahr,
                    basis: 'Durchschnitt der letzten 3 Jahre'
                },
                // Backwards compatibility
                monatlichesWachstum: wachstumMonat.slice(-12).map(w => ({
                    monat: w.monat,
                    neueMitglieder: w.neueMitglieder
                }))
            },
            stilAnalyse: {
                verteilung: stilVerteilung
            },
            finanzielleAuswertung: {
                monatlicheEinnahmen: monatlicheEinnahmen,
                jahreseinnahmen: monatlicheEinnahmen * 12,
                durchschnittsBeitrag: durchschnittsbeitrag,
                tarifVerteilung: tarifVerteilung
            },
            anwesenheitsStatistik: {
                durchschnittlicheAnwesenheit: Math.round(durchschnittAnwesenheit[0]?.durchschnitt || 0),
                wochentagsVerteilung: wochentagsVerteilung,
                spitzenzeiten: spitzenzeiten
            },
            recommendations: generateRecommendations({
                neueThisMonth: mitgliederStats[0].neueThisMonth,
                churnRate,
                retentionRate,
                aktiveMitglieder: mitgliederStats[0].aktiv,
                inaktiveMitglieder: mitgliederStats[0].inaktiv,
                aktivKurse: kursStats[0].aktivKurse,
                durchschnittAnwesenheit: Math.round(durchschnittAnwesenheit[0]?.durchschnitt || 0),
                vorjahresVergleich: vorjahresVergleich
            })
        };

        // Generiere intelligente Empfehlungen basierend auf echten Daten
        function generateRecommendations(data) {
            const recommendations = [];

            // Wachstums-Empfehlungen
            if (data.neueThisMonth >= 5) {
                recommendations.push({
                    title: 'Starkes Wachstum',
                    description: `Ausgezeichnet! ${data.neueThisMonth} neue Mitglieder diesen Monat. Nutzen Sie diesen Schwung für weitere Marketing-Maßnahmen.`,
                    priority: 'hoch',
                    typ: 'success'
                });
            } else if (data.neueThisMonth < 2) {
                recommendations.push({
                    title: 'Wachstum fördern',
                    description: `Nur ${data.neueThisMonth} neue Mitglieder diesen Monat. Erwägen Sie Marketing-Kampagnen oder Empfehlungsprogramme.`,
                    priority: 'hoch',
                    typ: 'warning'
                });
            }

            // Churn-Rate Warnung
            if (data.churnRate > 5) {
                recommendations.push({
                    title: 'Hohe Abwanderungsrate',
                    description: `Die Churn-Rate liegt bei ${data.churnRate}%. Sprechen Sie mit austretenden Mitgliedern und verbessern Sie das Kundenerlebnis.`,
                    priority: 'hoch',
                    typ: 'danger'
                });
            }

            // Retention-Empfehlungen
            if (data.retentionRate < 70) {
                recommendations.push({
                    title: 'Retention verbessern',
                    description: `Nur ${data.retentionRate}% der Mitglieder bleiben länger als 1 Jahr. Implementieren Sie Loyalitätsprogramme.`,
                    priority: 'mittel',
                    typ: 'warning'
                });
            } else if (data.retentionRate >= 85) {
                recommendations.push({
                    title: 'Exzellente Retention',
                    description: `${data.retentionRate}% Retention-Rate ist ausgezeichnet! Nutzen Sie zufriedene Mitglieder für Testimonials.`,
                    priority: 'niedrig',
                    typ: 'success'
                });
            }

            // Inaktive Mitglieder
            if (data.inaktiveMitglieder > 10) {
                recommendations.push({
                    title: 'Inaktive reaktivieren',
                    description: `${data.inaktiveMitglieder} inaktive Mitglieder. Starten Sie eine Reaktivierungs-Kampagne mit speziellen Angeboten.`,
                    priority: 'mittel',
                    typ: 'info'
                });
            }

            // Anwesenheit
            if (data.durchschnittAnwesenheit > 0 && data.durchschnittAnwesenheit < 30) {
                recommendations.push({
                    title: 'Anwesenheit steigern',
                    description: `Durchschnittlich ${data.durchschnittAnwesenheit} Check-ins pro Tag. Bieten Sie mehr attraktive Kurse zu Spitzenzeiten an.`,
                    priority: 'mittel',
                    typ: 'info'
                });
            }

            // Vorjahresvergleich
            if (data.vorjahresVergleich < 0) {
                recommendations.push({
                    title: 'Rückgang zum Vorjahr',
                    description: `${Math.abs(data.vorjahresVergleich)}% weniger neue Mitglieder als letztes Jahr. Analysieren Sie die Ursachen.`,
                    priority: 'hoch',
                    typ: 'warning'
                });
            }

            // Kurs-Empfehlungen
            if (data.aktivKurse < 5) {
                recommendations.push({
                    title: 'Kursangebot erweitern',
                    description: `Nur ${data.aktivKurse} aktive Kurse. Erwägen Sie neue Kurse zu gefragten Zeiten anzubieten.`,
                    priority: 'mittel',
                    typ: 'info'
                });
            }

            return recommendations.slice(0, 5); // Maximal 5 Empfehlungen
        }

        res.json({ success: true, data: auswertungsData });

    } catch (err) {
        console.error('Fehler beim Laden der vollständigen Auswertungen:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/auswertungen/kostenvorlagen - Kostenvorlagen für Break-Even
router.get('/kostenvorlagen', async (req, res) => {
    try {
        // Durchschnittsbeitrag aus aktiven Tarifen berechnen
        const tarifeResult = await queryAsync('SELECT AVG(price_cents) as avg_price FROM tarife WHERE active = 1');
        const avgPriceCents = tarifeResult[0]?.avg_price || 8500;
        const durchschnittsbeitrag = Math.round(avgPriceCents / 100);

        const vorlagen = {
            fixkosten: {
                miete: 2500,
                versicherung: 180,
                strom: 120,
                wasser: 80,
                gas: 150,
                internet: 40,
                hausmeister: 300,
                wartung: 150,
                verwaltung: 200
            },
            variableKosten: {
                ausruestung: 300,
                marketing: 200,
                reinigung: 100,
                sonstiges: 150
            },
            durchschnittsbeitrag: durchschnittsbeitrag
        };

        res.json({ success: true, data: vorlagen });

    } catch (err) {
        console.error('Fehler beim Laden der Kostenvorlagen:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/auswertungen/break-even - Break-Even-Berechnung speichern
router.post('/break-even', async (req, res) => {
    try {
        const { fixkosten = {}, variableKosten = {}, durchschnittsbeitrag = 85 } = req.body;
        // Berechne Gesamtkosten
        const gesamtFixkosten = Object.values(fixkosten).reduce((sum, cost) => sum + (Number(cost) || 0), 0);
        const gesamtVariableKosten = Object.values(variableKosten).reduce((sum, cost) => sum + (Number(cost) || 0), 0);
        const monatlicheGesamtkosten = gesamtFixkosten + gesamtVariableKosten;
        const breakEvenMitglieder = Math.ceil(monatlicheGesamtkosten / durchschnittsbeitrag);
        const breakEvenUmsatz = breakEvenMitglieder * durchschnittsbeitrag;

        const kostenProMitglied = durchschnittsbeitrag > 0 ? monatlicheGesamtkosten / breakEvenMitglieder : 0;

        const analyse = {
            fixkosten: gesamtFixkosten,
            variableKosten: gesamtVariableKosten,
            gesamtkosten: monatlicheGesamtkosten,
            durchschnittsbeitrag: durchschnittsbeitrag,
            breakEvenMitglieder: breakEvenMitglieder,
            breakEvenUmsatz: breakEvenUmsatz,
            mitSicherheitspuffer: {
                mitglieder: Math.ceil(breakEvenMitglieder * 1.2),
                umsatz: Math.ceil(breakEvenUmsatz * 1.2)
            },
            // Frontend-kompatible Struktur
            breakEvenPunkt: {
                mitglieder: breakEvenMitglieder,
                umsatz: breakEvenUmsatz,
                kostenProMitglied: Math.round(kostenProMitglied)
            },
            szenarien: [
                {
                    name: 'Konservativ',
                    mitglieder: Math.ceil(breakEvenMitglieder * 1.2),
                    umsatz: Math.ceil(breakEvenUmsatz * 1.2),
                    beschreibung: '20% Sicherheitspuffer'
                },
                {
                    name: 'Optimal',
                    mitglieder: Math.ceil(breakEvenMitglieder * 1.5),
                    umsatz: Math.ceil(breakEvenUmsatz * 1.5),
                    beschreibung: '50% über Break-Even'
                },
                {
                    name: 'Wachstum',
                    mitglieder: Math.ceil(breakEvenMitglieder * 2),
                    umsatz: Math.ceil(breakEvenUmsatz * 2),
                    beschreibung: 'Doppelte Mitgliederanzahl'
                }
            ],
            empfehlungen: [
                {
                    typ: breakEvenMitglieder < 50 ? 'success' : 'warning',
                    titel: `${breakEvenMitglieder} Mitglieder für Break-Even`,
                    beschreibung: breakEvenMitglieder < 50
                        ? 'Ihr Break-Even-Punkt ist gut erreichbar.'
                        : 'Break-Even-Punkt erfordert viele Mitglieder. Prüfen Sie Ihre Kostenstruktur.'
                },
                {
                    typ: 'info',
                    titel: 'Kostenkontrolle',
                    beschreibung: `Ihre Gesamtkosten betragen ${monatlicheGesamtkosten.toFixed(2)}€ pro Monat.`
                },
                {
                    typ: 'info',
                    titel: 'Durchschnittsbeitrag',
                    beschreibung: `Mit einem Durchschnittsbeitrag von ${durchschnittsbeitrag}€ benötigen Sie ${breakEvenMitglieder} aktive Mitglieder.`
                }
            ]
        };

        // In Datenbank speichern
        await queryAsync(
            `INSERT INTO break_even_berechnungen
            (fixkosten, variable_kosten, durchschnittsbeitrag, break_even_mitglieder, break_even_umsatz, sicherheitspuffer_prozent)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                JSON.stringify(fixkosten),
                JSON.stringify(variableKosten),
                durchschnittsbeitrag,
                breakEvenMitglieder,
                breakEvenUmsatz,
                20
            ]
        );

        res.json({ success: true, data: analyse });

    } catch (err) {
        console.error('Fehler bei Break-Even-Berechnung:', err);
        res.status(500).json({ success: false, error: err.message, details: err.stack });
    }
});

// GET /api/auswertungen/break-even/latest - Letzte Break-Even-Berechnung laden
router.get('/break-even/latest', async (req, res) => {
    try {
        const result = await queryAsync(
            'SELECT * FROM break_even_berechnungen ORDER BY erstellt_am DESC LIMIT 1'
        );

        if (result.length === 0) {
            return res.json({ success: true, data: null });
        }

        const berechnung = result[0];

        res.json({
            success: true,
            data: {
                fixkosten: berechnung.fixkosten,
                variableKosten: berechnung.variable_kosten,
                durchschnittsbeitrag: parseFloat(berechnung.durchschnittsbeitrag)
            }
        });

    } catch (err) {
        console.error('Fehler beim Laden der letzten Berechnung:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/auswertungen/member-analytics - Mitgliederanalysen
router.get('/member-analytics', async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
        let dateFormat, groupBy;
        switch (period) {
            case 'quarterly':
                dateFormat = '%Y-Q%q';
                groupBy = 'YEAR(eintrittsdatum), QUARTER(eintrittsdatum)';
                break;
            case 'biannually':
                dateFormat = '%Y-%m';
                groupBy = 'YEAR(eintrittsdatum), CEIL(MONTH(eintrittsdatum)/6)';
                break;
            case 'annually':
                dateFormat = '%Y';
                groupBy = 'YEAR(eintrittsdatum)';
                break;
            default: // monthly
                dateFormat = '%Y-%m';
                groupBy = 'YEAR(eintrittsdatum), MONTH(eintrittsdatum)';
        }

        // Neue Mitglieder
        const neueMitgliederQuery = `
            SELECT
                DATE_FORMAT(eintrittsdatum, '${dateFormat}') as period,
                COUNT(*) as count
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
            GROUP BY period
            ORDER BY period DESC
            LIMIT 24
        `;

        // Aktuelle Statistiken
        const statsQuery = `
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN aktiv = 1 THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR) THEN 1 ELSE 0 END) as new_last_year,
                SUM(CASE WHEN aktiv = 0 THEN 1 ELSE 0 END) as inactive
            FROM mitglieder
        `;

        const [neueMitglieder, stats] = await Promise.all([
            queryAsync(neueMitgliederQuery),
            queryAsync(statsQuery)
        ]);

        // Kündigungen und Ruhepausen nicht verfügbar (Spalten existieren nicht in der DB)
        const kuendigungen = [];
        const ruhepausen = [];

        // Wachstumsprognose berechnen
        const recentNewMembers = neueMitglieder.slice(0, 3);
        const avgGrowth = recentNewMembers.length > 0 
            ? recentNewMembers.reduce((sum, item) => sum + item.count, 0) / recentNewMembers.length 
            : 0;

        const currentMembers = stats[0]?.active || 0;
        const forecast = {
            current: currentMembers,
            threeMonth: Math.round(currentMembers + (avgGrowth * 1.5)),
            sixMonth: Math.round(currentMembers + (avgGrowth * 3)),
            twelveMonth: Math.round(currentMembers + (avgGrowth * 6)),
            growthRate: avgGrowth > 0 ? ((avgGrowth / currentMembers) * 100).toFixed(1) : 0
        };

        res.json({
            success: true,
            data: {
                zugänge: neueMitglieder.map(m => ({ periode: m.period, wert: m.count })),
                kündigungen: kuendigungen,
                ruhepausen: ruhepausen,
                wachstumPrognose: {
                    aktuell: forecast.current,
                    prognose3Monate: forecast.threeMonth,
                    prognose6Monate: forecast.sixMonth,
                    prognose12Monate: forecast.twelveMonth,
                    wachstumsrate: parseFloat(forecast.growthRate)
                },
                stats: stats[0],
                period
            }
        });

    } catch (err) {
        console.error('Fehler beim Laden der Mitgliederanalysen:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/auswertungen/beitragsvergleich - Mitglieder mit niedrigen Beiträgen
router.get('/beitragsvergleich', async (req, res) => {
    try {
        // Aktuelle Tarife laden
        const aktuelleTarife = await queryAsync(`
            SELECT
                name,
                price_cents,
                duration_months,
                CASE
                    WHEN name LIKE '%Kinder%' OR name LIKE '%Jugendlich%' OR name LIKE '%Student%' THEN 'Unter 18'
                    ELSE 'Über 18'
                END as alterskategorie
            FROM tarife
            WHERE active = 1
            ORDER BY price_cents ASC
        `);

        if (aktuelleTarife.length === 0) {
            return res.json({
                success: true,
                data: {
                    niedrigeBeitraege: [],
                    tarife: [],
                    zusammenfassung: {
                        gesamt: 0,
                        potential: 0,
                        niedrigsterTarif: 'Kein Tarif gefunden',
                        durchschnittlicheErhoehung: 0
                    }
                }
            });
        }

        // Niedrigste Tarife pro Alterskategorie ermitteln
        const niedrigsteTarife = {};
        aktuelleTarife.forEach(tarif => {
            const kategorie = tarif.alterskategorie;
            if (!niedrigsteTarife[kategorie] || tarif.price_cents < niedrigsteTarife[kategorie].price_cents) {
                niedrigsteTarife[kategorie] = tarif;
            }
        });
        // Mitglieder mit echten Beiträgen aus Verträgen laden
        const mitgliederQuery = `
            SELECT
                m.mitglied_id as id,
                m.vorname,
                m.nachname,
                m.geburtsdatum,
                m.eintrittsdatum,
                m.aktiv,
                v.monatlicher_beitrag,
                CASE
                    WHEN DATEDIFF(CURDATE(), m.geburtsdatum) / 365.25 < 18 THEN 'Unter 18'
                    ELSE 'Über 18'
                END as alterskategorie
            FROM mitglieder m
            LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
            WHERE m.aktiv = 1 AND v.monatlicher_beitrag IS NOT NULL
        `;

        const mitglieder = await queryAsync(mitgliederQuery);

        // Echte Beiträge und Vergleich
        const mitgliederMitNiedrigenBeitraegen = [];
        let totalPotentialRevenue = 0;
        let totalMembers = 0;

        mitglieder.forEach(mitglied => {
            const alterskategorie = mitglied.alterskategorie;
            const niedrigsterTarif = niedrigsteTarife[alterskategorie];

            if (!niedrigsterTarif) {
                return;
            }

            // Echte Beiträge aus Vertrag (in Cent umrechnen)
            const aktuellerBeitragCent = Math.round(mitglied.monatlicher_beitrag * 100);
            const niedrigsterTarifCent = niedrigsterTarif.price_cents;
            const potentialIncrease = niedrigsterTarifCent - aktuellerBeitragCent;

            // Nur Mitglieder mit niedrigeren Beiträgen als der niedrigste aktuelle Tarif
            if (aktuellerBeitragCent < niedrigsterTarifCent) {
                mitgliederMitNiedrigenBeitraegen.push({
                    id: mitglied.id,
                    name: `${mitglied.vorname} ${mitglied.nachname}`,
                    alterskategorie: alterskategorie,
                    aktuellerBeitrag: aktuellerBeitragCent,
                    potentialErhoehung: potentialIncrease,
                    eintrittsdatum: mitglied.eintrittsdatum
                });

                totalPotentialRevenue += potentialIncrease;
                totalMembers++;
            }
        });
        // Zusammenfassung erstellen
        const summary = {
            totalMitglieder: totalMembers,
            potentialRevenue: totalPotentialRevenue,
            averageIncrease: totalMembers > 0 ? Math.round(totalPotentialRevenue / totalMembers) : 0,
            lowestCurrentTarif: `${Math.min(...Object.values(niedrigsteTarife).map(t => t.price_cents))} Cent`
        };

        // Tarife für Anzeige formatieren
        const tarifeListe = Object.values(niedrigsteTarife).map(tarif => ({
            name: tarif.name,
            preis: tarif.price_cents,
            alterskategorie: tarif.alterskategorie
        }));

        const beitragsvergleich = {
            niedrigeBeitraege: mitgliederMitNiedrigenBeitraegen,
            tarife: tarifeListe,
            zusammenfassung: {
                gesamt: summary.totalMitglieder,
                potential: summary.potentialRevenue,
                niedrigsterTarif: summary.lowestCurrentTarif,
                durchschnittlicheErhoehung: summary.averageIncrease
            }
        };

        res.json({ success: true, data: beitragsvergleich });

    } catch (err) {
        console.error('Fehler beim Laden des Beitragsvergleichs:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/auswertungen/demographics - Demografische Daten
router.get('/demographics', async (req, res) => {
    try {
        const demographicsQuery = `
            SELECT 
                CASE 
                    WHEN DATEDIFF(CURDATE(), geburtsdatum) / 365.25 < 18 THEN 'Unter 18'
                    ELSE 'Über 18'
                END as altersgruppe,
                COUNT(*) as anzahl
            FROM mitglieder 
            WHERE status = 'aktiv'
            GROUP BY altersgruppe
        `;

        const demographics = await queryAsync(demographicsQuery);

        res.json({
            success: true,
            data: demographics
        });

    } catch (err) {
        console.error('Fehler beim Laden der Demografiedaten:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/auswertungen/financial - Finanzielle Übersicht
router.get('/financial', async (req, res) => {
    try {
        const financialQuery = `
            SELECT 
                SUM(CASE WHEN status = 'aktiv' THEN 1 ELSE 0 END) as aktive_mitglieder,
                SUM(CASE WHEN status = 'inaktiv' THEN 1 ELSE 0 END) as inaktive_mitglieder,
                SUM(CASE WHEN eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) THEN 1 ELSE 0 END) as neue_mitglieder_letzten_monat,
                SUM(CASE WHEN kuendigungsdatum >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) THEN 1 ELSE 0 END) as kuendigungen_letzten_monat
            FROM mitglieder
        `;

        const financial = await queryAsync(financialQuery);

        res.json({
            success: true,
            data: financial[0]
        });

    } catch (err) {
        console.error('Fehler beim Laden der Finanzdaten:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;