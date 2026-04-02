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


// 🔒 Dojo-Filter: async, nutzt admin_user_dojos für Super-Admins
// Gibt zurück: { clause, params, checkinClause, checkinParams }
// clause/checkinClause sind leere Strings wenn kein Filter nötig
async function getSecureDojoFilter(req) {
  const userDojoId = req.user?.dojo_id;
  const userRole   = req.user?.rolle;
  const userId     = req.user?.id;
  const isSuperAdmin = userRole === 'super_admin';

  // Expliziter dojo_id Query-Param hat immer Vorrang
  const q = req.query.dojo_id;
  if (q && q !== 'all') {
    const id = parseInt(q, 10);
    return {
      clause:        'AND dojo_id = ?',
      params:        [id],
      checkinClause: 'AND mitglied_id IN (SELECT mitglied_id FROM mitglieder WHERE dojo_id = ?)',
      checkinParams: [id]
    };
  }

  if (isSuperAdmin) {
    // Super-Admin: eigene Dojo-Zuweisungen aus admin_user_dojos laden
    if (userId) {
      const rows = await queryAsync(
        'SELECT dojo_id FROM admin_user_dojos WHERE admin_user_id = ? ORDER BY dojo_id',
        [userId]
      );
      if (rows.length > 0) {
        const ids = rows.map(r => r.dojo_id);
        const ph  = ids.map(() => '?').join(',');
        return {
          clause:        `AND dojo_id IN (${ph})`,
          params:        ids,
          checkinClause: `AND mitglied_id IN (SELECT mitglied_id FROM mitglieder WHERE dojo_id IN (${ph}))`,
          checkinParams: ids
        };
      }
    }
    // Super-Admin ohne Dojo-Zuweisungen: kein Filter
    return { clause: '', params: [], checkinClause: '', checkinParams: [] };
  }

  // Normaler Admin mit dojo_id
  if (userDojoId) {
    const id = parseInt(userDojoId, 10);
    return {
      clause:        'AND dojo_id = ?',
      params:        [id],
      checkinClause: 'AND mitglied_id IN (SELECT mitglied_id FROM mitglieder WHERE dojo_id = ?)',
      checkinParams: [id]
    };
  }

  return { clause: '', params: [], checkinClause: '', checkinParams: [] };
}

// GET /api/auswertungen/test - Test-Endpunkt
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Auswertungen-Route funktioniert!' });
});

// GET /api/auswertungen/complete - Vollständige Auswertungen für Übersicht-Tab
router.get('/complete', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        const dF = f.clause;
        const dP = f.params;

        // Mitglieder-Statistiken
        const mitgliederStats = await queryAsync(`
            SELECT
                COUNT(*) as gesamt,
                SUM(CASE WHEN aktiv = 1 THEN 1 ELSE 0 END) as aktiv,
                SUM(CASE WHEN aktiv = 0 THEN 1 ELSE 0 END) as inaktiv,
                SUM(CASE WHEN eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) THEN 1 ELSE 0 END) as neueThisMonth
            FROM mitglieder
            WHERE 1=1 ${dF}
        `, dP);

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
            WHERE aktiv = 1 ${dF}
            GROUP BY name
            ORDER BY value DESC
        `, dP);

        // Wachstum - Wöchentlich (letzte 12 Wochen)
        const wachstumWoche = await queryAsync(`
            SELECT
                YEARWEEK(eintrittsdatum, 1) as woche,
                DATE_FORMAT(eintrittsdatum, '%Y-W%v') as periode,
                COUNT(*) as neueMitglieder
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK) ${dF}
            GROUP BY woche, periode
            ORDER BY woche ASC
        `, dP);

        // Wachstum - Monatlich (letzte 24 Monate für Vergleich)
        const wachstumMonat = await queryAsync(`
            SELECT
                DATE_FORMAT(eintrittsdatum, '%Y-%m') as monat,
                YEAR(eintrittsdatum) as jahr,
                MONTH(eintrittsdatum) as monatNum,
                COUNT(*) as neueMitglieder
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH) ${dF}
            GROUP BY monat, jahr, monatNum
            ORDER BY monat ASC
        `, dP);

        // Wachstum - Quartalsweise (letzte 8 Quartale)
        const wachstumQuartal = await queryAsync(`
            SELECT
                CONCAT(YEAR(eintrittsdatum), '-Q', QUARTER(eintrittsdatum)) as quartal,
                YEAR(eintrittsdatum) as jahr,
                QUARTER(eintrittsdatum) as quartalNum,
                COUNT(*) as neueMitglieder
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH) ${dF}
            GROUP BY quartal, jahr, quartalNum
            ORDER BY jahr ASC, quartalNum ASC
        `, dP);

        // Wachstum - Jährlich (letzte 5 Jahre)
        const wachstumJahr = await queryAsync(`
            SELECT
                YEAR(eintrittsdatum) as jahr,
                COUNT(*) as neueMitglieder
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR) ${dF}
            GROUP BY jahr
            ORDER BY jahr ASC
        `, dP);

        // Vergleich zum Vorjahr (aktuelles Jahr vs. letztes Jahr)
        const aktuellesJahr = new Date().getFullYear();
        const vorjahr = aktuellesJahr - 1;

        const vergleichVorjahr = await queryAsync(`
            SELECT
                YEAR(eintrittsdatum) as jahr,
                COUNT(*) as neueMitglieder
            FROM mitglieder
            WHERE eintrittsdatum >= DATE(CONCAT(?, '-01-01'))
              AND eintrittsdatum < DATE(CONCAT(?, '-01-01')) ${dF}
            GROUP BY jahr
        `, [vorjahr, aktuellesJahr + 1, ...dP]);

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
                WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 3 YEAR) ${dF}
                GROUP BY YEAR(eintrittsdatum)
            ) as jahresStats
        `, dP);

        const prognoseNaechstesJahr = Math.round(prognoseData[0]?.durchschnitt || neueAktuellesJahr);

        // Check-in / Anwesenheitsstatistik (echte Daten)
        const anwesenheitWochentag = await queryAsync(`
            SELECT
                DAYNAME(checkin_time) as wochentag,
                COUNT(*) as anzahl
            FROM checkins
            WHERE checkin_time >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            ${f.checkinClause}
            GROUP BY wochentag
            ORDER BY FIELD(wochentag, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
        `, f.checkinParams).catch(() => []);

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

        // Spitzenzeiten — nur echte Scanner-Check-ins (touch/qr_code/nfc).
        // Manuelle Einträge (method='manual') haben immer 12:00 als Platzhalter-Zeit
        // und verfälschen die Stundenauswertung.
        const spitzenzeitenData = await queryAsync(`
            SELECT
                CONCAT(LPAD(stunde, 2, '0'), ':00 - ', LPAD(stunde + 1, 2, '0'), ':00') as zeitfenster,
                COUNT(*) as teilnehmer
            FROM (
                SELECT HOUR(checkin_time) as stunde
                FROM checkins
                WHERE checkin_time >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                  AND checkin_method IN ('touch', 'qr_code', 'nfc')
                ${f.checkinClause}
            ) as hourly_checkins
            GROUP BY stunde
            ORDER BY teilnehmer DESC
            LIMIT 5
        `, f.checkinParams).catch(() => []);

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
                ${f.checkinClause}
                GROUP BY DATE(checkin_time)
            ) as daily_stats
        `, f.checkinParams).catch(() => [{ durchschnitt: 0 }]);

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
            WHERE aktiv = 1 ${dF}
            GROUP BY zeitraum
            ORDER BY FIELD(zeitraum, 'Unter 6 Monate', '6-12 Monate', '1-2 Jahre', '2-5 Jahre', 'Über 5 Jahre')
        `, dP);

        // Austritte/Kündigungen (letzte 12 Monate)
        const austritte = await queryAsync(`
            SELECT
                DATE_FORMAT(austritt_datum, '%Y-%m') as monat,
                COUNT(*) as anzahl
            FROM mitglieder
            WHERE austritt_datum >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                AND austritt_datum IS NOT NULL ${dF}
            GROUP BY monat
            ORDER BY monat ASC
        `, dP).catch(() => []);

        // Tarif-Verteilung (über vertraege)
        const tarifVerteilung = await queryAsync(`
            SELECT
                t.name as tarifname,
                t.price_cents,
                COUNT(DISTINCT v.id) as anzahl,
                COALESCE(SUM(v.monatsbeitrag), 0) as monatsumsatz
            FROM tarife t
            LEFT JOIN vertraege v ON t.id = v.tarif_id AND v.status = 'aktiv'
            LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id AND m.aktiv = 1
            WHERE t.active = 1 AND t.ist_archiviert = 0 ${f.clause.replace('dojo_id', 't.dojo_id')}
            GROUP BY t.id, t.name, t.price_cents
            HAVING anzahl > 0
            ORDER BY monatsumsatz DESC
        `, f.params).catch(() => []);

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
            WHERE 1=1 ${dF}
        `, dP);

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
        // Echte monatliche Einnahmen: Summe aller aktiven Vertragsbeträge
        const einnahmenResult = await queryAsync(`
            SELECT
                COALESCE(SUM(v.monatsbeitrag), 0) as monatliche_einnahmen,
                COALESCE(AVG(v.monatsbeitrag), 0) as avg_beitrag,
                COUNT(*) as vertrag_anzahl
            FROM vertraege v
            JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
            WHERE v.status = 'aktiv'
            ${dF.replace('dojo_id', 'v.dojo_id')}
        `, dP);
        const monatlicheEinnahmen = Math.round(einnahmenResult[0]?.monatliche_einnahmen || 0);
        const durchschnittsbeitrag = Math.round(einnahmenResult[0]?.avg_beitrag || 0);

        // Geschlechterverteilung
        const geschlechterVerteilung = await queryAsync(`
            SELECT
                geschlecht,
                COUNT(*) as anzahl
            FROM mitglieder
            WHERE aktiv = 1 ${dF}
            GROUP BY geschlecht
        `, dP);

        // Eintrittsjahre (letzte 5 Jahre)
        const eintrittsJahre = await queryAsync(`
            SELECT
                YEAR(eintrittsdatum) as jahr,
                COUNT(*) as anzahl
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR) ${dF}
            GROUP BY jahr
            ORDER BY jahr DESC
        `, dP);

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
            WHERE aktiv = 1 ${dF}
            HAVING tage_bis_geburtstag BETWEEN 0 AND 30
            ORDER BY tage_bis_geburtstag ASC
            LIMIT 10
        `, dP);

        // Mitgliedschaftsdauer (Durchschnitt)
        const mitgliedschaftsDauer = await queryAsync(`
            SELECT
                AVG(DATEDIFF(CURDATE(), eintrittsdatum) / 365.25) as durchschnitt_jahre
            FROM mitglieder
            WHERE aktiv = 1 ${dF}
        `, dP);

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
            WHERE aktiv = 1 AND gurtfarbe IS NOT NULL AND gurtfarbe != '' ${dF}
            GROUP BY gurtfarbe
            ORDER BY anzahl DESC
            LIMIT 5
        `, dP);

        // Retention-Rate (Mitglieder die länger als 1 Jahr dabei sind)
        const retentionStats = await queryAsync(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN DATEDIFF(CURDATE(), eintrittsdatum) > 365 THEN 1 ELSE 0 END) as ueber_ein_jahr
            FROM mitglieder
            WHERE aktiv = 1 ${dF}
        `, dP);

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
                growthRate: wachstumMonat.length > 1 && Number(wachstumMonat[0].neueMitglieder) > 0
                    ? Math.round(((Number(wachstumMonat[wachstumMonat.length - 1].neueMitglieder) - Number(wachstumMonat[0].neueMitglieder)) / Number(wachstumMonat[0].neueMitglieder)) * 100)
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
        console.error('Fehler beim Laden der vollständigen Auswertungen:', { error: err });
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/auswertungen/kostenvorlagen - Kostenvorlagen für Break-Even
router.get('/kostenvorlagen', async (req, res) => {
    try {
        const f = await getSecureDojoFilter(req);
        // Durchschnittsbeitrag aus echten aktiven Verträgen berechnen (nicht aus Tarif-Preisen)
        const vertraegeResult = await queryAsync(
            `SELECT AVG(monatsbeitrag) as avg_beitrag FROM vertraege WHERE status = 'aktiv' ${f.clause}`,
            f.params);
        const durchschnittsbeitrag = Math.round(vertraegeResult[0]?.avg_beitrag || 85);

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
                zahlungsabwicklung: 2,
                verwaltung: 1,
                material: 1,
                sonstiges: 1
            },
            durchschnittsbeitrag: durchschnittsbeitrag
        };

        res.json({ success: true, data: vorlagen });

    } catch (err) {
        console.error('Fehler beim Laden der Kostenvorlagen:', { error: err });
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/auswertungen/break-even - Break-Even-Berechnung speichern
router.post('/break-even', async (req, res) => {
    try {
        const { fixkosten = {}, variableKosten = {}, durchschnittsbeitrag = 85 } = req.body;

        // Korrekte wirtschaftliche Break-Even-Formel:
        // BEP (Menge) = Fixkosten / (Preis pro Einheit - variable Kosten pro Einheit)
        const gesamtFixkosten = Object.values(fixkosten).reduce((sum, cost) => sum + (Number(cost) || 0), 0);
        const variableKostenProMitglied = Object.values(variableKosten).reduce((sum, cost) => sum + (Number(cost) || 0), 0);
        const deckungsbeitrag = durchschnittsbeitrag - variableKostenProMitglied;

        if (deckungsbeitrag <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Der Mitgliedsbeitrag muss größer als die variablen Kosten pro Mitglied sein.'
            });
        }

        const breakEvenMitglieder = Math.ceil(gesamtFixkosten / deckungsbeitrag);
        const breakEvenUmsatz = breakEvenMitglieder * durchschnittsbeitrag;

        // Gesamtkosten bei n Mitgliedern: Fixkosten + variable Kosten * n
        const gesamtKostenFuer = (n) => gesamtFixkosten + variableKostenProMitglied * n;
        const kostenProMitglied = variableKostenProMitglied + (breakEvenMitglieder > 0 ? gesamtFixkosten / breakEvenMitglieder : 0);

        const n_konservativ = Math.ceil(breakEvenMitglieder * 1.2);
        const n_optimal = Math.ceil(breakEvenMitglieder * 1.5);
        const n_wachstum = Math.ceil(breakEvenMitglieder * 2);

        const analyse = {
            fixkosten: gesamtFixkosten,
            variableKostenProMitglied: variableKostenProMitglied,
            deckungsbeitrag: deckungsbeitrag,
            durchschnittsbeitrag: durchschnittsbeitrag,
            breakEvenMitglieder: breakEvenMitglieder,
            breakEvenUmsatz: breakEvenUmsatz,
            // Frontend-kompatible Struktur
            breakEvenPunkt: {
                mitglieder: breakEvenMitglieder,
                umsatz: breakEvenUmsatz,
                kostenProMitglied: Math.round(kostenProMitglied)
            },
            szenarien: [
                {
                    name: 'Konservativ',
                    mitglieder: n_konservativ,
                    umsatz: n_konservativ * durchschnittsbeitrag,
                    gewinn: n_konservativ * durchschnittsbeitrag - gesamtKostenFuer(n_konservativ),
                    beschreibung: '20% Sicherheitspuffer'
                },
                {
                    name: 'Optimal',
                    mitglieder: n_optimal,
                    umsatz: n_optimal * durchschnittsbeitrag,
                    gewinn: n_optimal * durchschnittsbeitrag - gesamtKostenFuer(n_optimal),
                    beschreibung: '50% über Break-Even'
                },
                {
                    name: 'Wachstum',
                    mitglieder: n_wachstum,
                    umsatz: n_wachstum * durchschnittsbeitrag,
                    gewinn: n_wachstum * durchschnittsbeitrag - gesamtKostenFuer(n_wachstum),
                    beschreibung: 'Doppelte Mitgliederanzahl'
                }
            ],
            empfehlungen: [
                {
                    typ: breakEvenMitglieder < 80 ? 'success' : 'warning',
                    titel: `${breakEvenMitglieder} Mitglieder für Break-Even`,
                    beschreibung: breakEvenMitglieder < 80
                        ? 'Ihr Break-Even-Punkt ist gut erreichbar.'
                        : 'Break-Even-Punkt erfordert viele Mitglieder. Prüfen Sie Ihre Kostenstruktur.'
                },
                {
                    typ: 'info',
                    titel: 'Deckungsbeitrag',
                    beschreibung: `Deckungsbeitrag: ${deckungsbeitrag.toFixed(2)}€/Mitglied (Beitrag ${durchschnittsbeitrag}€ - variable Kosten ${variableKostenProMitglied.toFixed(2)}€/Mitglied)`
                },
                {
                    typ: 'info',
                    titel: 'Formel',
                    beschreibung: `BEP = ${gesamtFixkosten}€ Fixkosten / ${deckungsbeitrag.toFixed(2)}€ Deckungsbeitrag = ${breakEvenMitglieder} Mitglieder`
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
        console.error('Fehler bei Break-Even-Berechnung:', { error: err });
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
                fixkosten: JSON.parse(berechnung.fixkosten),
                variableKosten: JSON.parse(berechnung.variable_kosten),
                durchschnittsbeitrag: parseFloat(berechnung.durchschnittsbeitrag)
            }
        });

    } catch (err) {
        console.error('Fehler beim Laden der letzten Berechnung:', { error: err });
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/auswertungen/member-analytics - Mitgliederanalysen
router.get('/member-analytics', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        const dF = f.clause;
        const dP = f.params;
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

        const [neueMitglieder, stats] = await Promise.all([
            queryAsync(`
                SELECT
                    DATE_FORMAT(eintrittsdatum, '${dateFormat}') as period,
                    COUNT(*) as count
                FROM mitglieder
                WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 2 YEAR) ${dF}
                GROUP BY period
                ORDER BY period DESC
                LIMIT 24
            `, dP),
            queryAsync(`
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN aktiv = 1 THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR) THEN 1 ELSE 0 END) as new_last_year,
                    SUM(CASE WHEN aktiv = 0 THEN 1 ELSE 0 END) as inactive
                FROM mitglieder
                WHERE 1=1 ${dF}
            `, dP)
        ]);

        // Kündigungen und Ruhepausen nicht verfügbar (Spalten existieren nicht in der DB)
        const kuendigungen = [];
        const ruhepausen = [];

        // Wachstumsprognose berechnen
        // Spike-Filter: Import-Monate (z.B. Magicline-Import mit 56 Neuzugängen) rausfiltern
        const allCounts = neueMitglieder.map(m => Number(m.count)).sort((a, b) => a - b);
        const median = allCounts[Math.floor(allCounts.length / 2)] || 1;
        const normalMonths = neueMitglieder.filter(m => Number(m.count) <= median * 3);
        const recentNormal = normalMonths.slice(0, 6);
        const avgGrowth = recentNormal.length > 0
            ? recentNormal.reduce((sum, item) => sum + Number(item.count), 0) / recentNormal.length
            : 0;

        // Number() nötig: mysql2 gibt SUM() als String zurück (DECIMAL-Typ)
        const currentMembers = Number(stats[0]?.active || 0);
        const forecast = {
            current: currentMembers,
            threeMonth:   Math.round(currentMembers + (avgGrowth * 3)),
            sixMonth:     Math.round(currentMembers + (avgGrowth * 6)),
            twelveMonth:  Math.round(currentMembers + (avgGrowth * 12)),
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
        console.error('Fehler beim Laden der Mitgliederanalysen:', { error: err });
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/auswertungen/beitragsvergleich - Mitglieder mit niedrigen Beiträgen
router.get('/beitragsvergleich', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        const dF = f.clause.replace('dojo_id', 'm.dojo_id');
        const dP = f.params;

        // Tarif-Filter mit denselben Dojo-Params wie Mitglieder-Filter
        const tarifDojoFilter = dP.length > 0
            ? `AND dojo_id IN (${dP.map(() => '?').join(',')})`
            : '';
        const tarifParams = [...dP];

        // Aktuelle Tarife laden (mit Dojo-Filter)
        const aktuelleTarife = await queryAsync(`
            SELECT
                id,
                name,
                price_cents,
                duration_months,
                CASE
                    WHEN name LIKE '%Kinder%' OR name LIKE '%Jugendlich%'
                      OR name LIKE '%Student%' OR name LIKE '%Sch%ler%'
                      OR name LIKE '%Kids%'
                    THEN 'Unter 18'
                    ELSE 'Über 18'
                END as alterskategorie
            FROM tarife
            WHERE active = 1 AND ist_archiviert = 0 ${tarifDojoFilter}
            ORDER BY price_cents ASC
        `, tarifParams);

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

        // Tarife als Map für schnellen Zugriff per tarif_id
        const tarifeMap = {};
        aktuelleTarife.forEach(t => { tarifeMap[t.id] = t; });

        // Niedrigste Tarife pro Alterskategorie (Fallback für Verträge ohne tarif_id)
        const niedrigsteTarife = {};
        aktuelleTarife.forEach(tarif => {
            const kategorie = tarif.alterskategorie;
            if (!niedrigsteTarife[kategorie] || tarif.price_cents < niedrigsteTarife[kategorie].price_cents) {
                niedrigsteTarife[kategorie] = tarif;
            }
        });

        // Mitglieder laden — monatsbeitrag hat Vorrang vor monatlicher_beitrag (Altfeld)
        // WICHTIG: dF beginnt mit 'AND', deshalb nach dem ersten WHERE-Ausdruck einfügen
        const mitglieder = await queryAsync(`
            SELECT
                m.mitglied_id as id,
                m.vorname,
                m.nachname,
                m.geburtsdatum,
                m.eintrittsdatum,
                v.tarif_id,
                v.rabatt_prozent,
                COALESCE(v.monatsbeitrag, v.monatlicher_beitrag) as aktueller_beitrag,
                CASE
                    WHEN DATEDIFF(CURDATE(), m.geburtsdatum) / 365.25 < 18 THEN 'Unter 18'
                    ELSE 'Über 18'
                END as alterskategorie
            FROM mitglieder m
            JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
            WHERE m.aktiv = 1 ${dF}
              AND COALESCE(v.monatsbeitrag, v.monatlicher_beitrag) IS NOT NULL
        `, dP);

        const mitgliederMitNiedrigenBeitraegen = [];
        let totalPotentialRevenue = 0;
        let totalMembers = 0;

        mitglieder.forEach(mitglied => {
            const aktuellerBeitragCent = Math.round(mitglied.aktueller_beitrag * 100);
            const rabattFaktor = 1 - (parseFloat(mitglied.rabatt_prozent || 0) / 100);

            let sollBeitragCent;
            let tarifName;

            if (mitglied.tarif_id && tarifeMap[mitglied.tarif_id]) {
                // Vertrag hat Tarif → Soll = aktueller Tarifpreis abzüglich Rabatt
                const tarif = tarifeMap[mitglied.tarif_id];
                sollBeitragCent = Math.round(tarif.price_cents * rabattFaktor);
                tarifName = tarif.name;
            } else {
                // Kein Tarif → Vergleich mit niedrigstem Tarif der Alterskategorie
                const niedrigsterTarif = niedrigsteTarife[mitglied.alterskategorie];
                if (!niedrigsterTarif) return;
                sollBeitragCent = Math.round(niedrigsterTarif.price_cents * rabattFaktor);
                tarifName = niedrigsterTarif.name;
            }

            const potentialIncrease = sollBeitragCent - aktuellerBeitragCent;

            if (potentialIncrease > 0) {
                mitgliederMitNiedrigenBeitraegen.push({
                    id: mitglied.id,
                    name: `${mitglied.vorname} ${mitglied.nachname}`,
                    alterskategorie: mitglied.alterskategorie,
                    aktuellerBeitrag: aktuellerBeitragCent,
                    sollBeitrag: sollBeitragCent,
                    potentialErhoehung: potentialIncrease,
                    tarifName: tarifName,
                    eintrittsdatum: mitglied.eintrittsdatum
                });
                totalPotentialRevenue += potentialIncrease;
                totalMembers++;
            }
        });

        // Nach größtem Potenzial sortieren
        mitgliederMitNiedrigenBeitraegen.sort((a, b) => b.potentialErhoehung - a.potentialErhoehung);

        const beitragsvergleich = {
            niedrigeBeitraege: mitgliederMitNiedrigenBeitraegen,
            tarife: Object.values(niedrigsteTarife).map(tarif => ({
                name: tarif.name,
                preis: tarif.price_cents,
                alterskategorie: tarif.alterskategorie
            })),
            zusammenfassung: {
                gesamt: totalMembers,
                potential: totalPotentialRevenue,
                niedrigsterTarif: totalMembers > 0 ? (mitgliederMitNiedrigenBeitraegen[0]?.tarifName || '') : '',
                durchschnittlicheErhoehung: totalMembers > 0 ? Math.round(totalPotentialRevenue / totalMembers) : 0
            }
        };

        res.json({ success: true, data: beitragsvergleich });

    } catch (err) {
        console.error('Fehler beim Laden des Beitragsvergleichs:', { error: err });
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
        console.error('Fehler beim Laden der Demografiedaten:', { error: err });
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
        console.error('Fehler beim Laden der Finanzdaten:', { error: err });
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/auswertungen/kurs-performance — Kursauslastung & Tagesplan-Analyse
router.get('/kurs-performance', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        const dF = f.clause;   // z.B. "AND dojo_id = ?"
        const dP = f.params;

        // ── 1. Alle Kurse + Stundenplan-Einträge mit Check-in-Daten (90 Tage)
        const kursDaten = await queryAsync(`
            SELECT
                k.kurs_id,
                k.gruppenname,
                k.stil,
                k.max_teilnehmer,
                s.stundenplan_id,
                s.tag,
                s.uhrzeit_start,
                s.uhrzeit_ende,
                COUNT(c.checkin_id)                           AS checkins_gesamt,
                COUNT(DISTINCT DATE(c.checkin_time))          AS trainings_tage,
                ROUND(COUNT(c.checkin_id) /
                    NULLIF(COUNT(DISTINCT DATE(c.checkin_time)), 0), 1)
                                                              AS schnitt_pro_tag
            FROM kurse k
            JOIN stundenplan s ON s.kurs_id = k.kurs_id
            LEFT JOIN checkins c
                ON  c.stundenplan_id = s.stundenplan_id
                AND c.checkin_time >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            WHERE k.dojo_id IS NOT NULL ${dF.replace('dojo_id', 'k.dojo_id')}
            GROUP BY k.kurs_id, s.stundenplan_id
            ORDER BY checkins_gesamt DESC
        `, dP);

        // ── 2. Pro Kurs aggregieren (mehrere Wochentage zusammenfassen)
        const kursMap = {};
        for (const row of kursDaten) {
            if (!kursMap[row.kurs_id]) {
                kursMap[row.kurs_id] = {
                    kurs_id:        row.kurs_id,
                    name:           row.gruppenname,
                    stil:           row.stil,
                    max_teilnehmer: row.max_teilnehmer,
                    tage:           [],
                    checkins_gesamt: 0,
                    trainings_tage:  0,
                    schnitt_pro_tag: 0,
                };
            }
            const k = kursMap[row.kurs_id];
            k.tage.push({
                tag:           row.tag,
                stundenplan_id: row.stundenplan_id,
                start:         row.uhrzeit_start,
                ende:          row.uhrzeit_ende,
                checkins:      Number(row.checkins_gesamt),
                training_tage: Number(row.trainings_tage),
                schnitt:       Number(row.schnitt_pro_tag) || 0,
            });
            k.checkins_gesamt += Number(row.checkins_gesamt);
            k.trainings_tage  += Number(row.trainings_tage);
        }

        // Schnitt pro Tag über alle Einheiten
        const kurse = Object.values(kursMap).map(k => ({
            ...k,
            schnitt_pro_tag: k.trainings_tage > 0
                ? Math.round((k.checkins_gesamt / k.trainings_tage) * 10) / 10
                : 0,
            auslastung_pct: k.max_teilnehmer
                ? Math.min(100, Math.round((k.checkins_gesamt / k.trainings_tage / k.max_teilnehmer) * 100))
                : null,
        })).sort((a, b) => b.schnitt_pro_tag - a.schnitt_pro_tag);

        // ── 3. Belegungsplan: alle Zeitslots der Woche
        const tageReihenfolge = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
        const wochenplan = {};
        for (const tag of tageReihenfolge) wochenplan[tag] = [];
        for (const k of kurse) {
            for (const t of k.tage) {
                if (wochenplan[t.tag] !== undefined) {
                    wochenplan[t.tag].push({
                        name:    k.name,
                        stil:    k.stil,
                        start:   t.start,
                        ende:    t.ende,
                        checkins: t.checkins,
                        schnitt:  t.schnitt,
                    });
                }
            }
        }
        // Innerhalb jedes Tages nach Startzeit sortieren
        for (const tag of tageReihenfolge) {
            wochenplan[tag].sort((a, b) => a.start.localeCompare(b.start));
        }

        // ── 4. Freie Kapazitäten: Lücken pro Tag ermitteln (> 30 Min Pause)
        const freieSlots = {};
        const DOJO_OPEN  = '14:00:00';
        const DOJO_CLOSE = '22:00:00';
        for (const tag of tageReihenfolge) {
            const kurseAmTag = wochenplan[tag];
            if (kurseAmTag.length === 0) {
                freieSlots[tag] = [{ start: DOJO_OPEN, ende: DOJO_CLOSE, minuten: 480 }];
                continue;
            }
            const slots = [];
            let cursor = DOJO_OPEN;
            for (const k of kurseAmTag) {
                if (k.start > cursor) {
                    const minuten = zeitDiff(cursor, k.start);
                    if (minuten >= 30) slots.push({ start: cursor, ende: k.start, minuten });
                }
                if (k.ende > cursor) cursor = k.ende;
            }
            if (cursor < DOJO_CLOSE) {
                const minuten = zeitDiff(cursor, DOJO_CLOSE);
                if (minuten >= 30) slots.push({ start: cursor, ende: DOJO_CLOSE, minuten });
            }
            freieSlots[tag] = slots;
        }

        res.json({
            success: true,
            data: { kurse, wochenplan, freieSlots }
        });

    } catch (err) {
        console.error('Fehler bei kurs-performance:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

function zeitDiff(start, ende) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = ende.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
}

// Hilfsfunktion: expliziter dojo_id Filter für JOINs mit Tabellen-Alias
function buildMFilter(f, alias = 'm') {
    if (f.params.length === 0) return { clause: '', params: [] };
    const ph = f.params.map(() => '?').join(',');
    const clause = f.params.length === 1
        ? `AND ${alias}.dojo_id = ?`
        : `AND ${alias}.dojo_id IN (${ph})`;
    return { clause, params: f.params };
}

// ── /absprung-risiko ──────────────────────────────────────────────────────────
router.get('/absprung-risiko', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        const mf = buildMFilter(f);
        const rows = await queryAsync(`
            SELECT m.mitglied_id, m.vorname, m.nachname,
                   MAX(a.datum) as letztes_training,
                   COALESCE(DATEDIFF(CURDATE(), MAX(a.datum)), 9999) as tage_weg
            FROM mitglieder m
            JOIN vertraege v ON v.mitglied_id = m.mitglied_id AND v.status = 'aktiv'
            LEFT JOIN anwesenheit a ON a.mitglied_id = m.mitglied_id AND a.anwesend = 1
            WHERE m.aktiv = 1 ${mf.clause}
            GROUP BY m.mitglied_id, m.vorname, m.nachname
            HAVING tage_weg >= 21
            ORDER BY tage_weg DESC
            LIMIT 100
        `, mf.params);
        const fmt = rows.map(r => ({
            mitglied_id: r.mitglied_id,
            vorname: r.vorname,
            nachname: r.nachname,
            letztes_training: r.letztes_training
                ? (r.letztes_training instanceof Date ? r.letztes_training.toISOString().slice(0,10) : String(r.letztes_training).slice(0,10))
                : null,
            tage_weg: Number(r.tage_weg) === 9999 ? null : Number(r.tage_weg)
        }));
        res.json({ success: true, data: {
            tier3w: fmt.filter(r => r.tage_weg !== null && r.tage_weg >= 21 && r.tage_weg < 42),
            tier6w: fmt.filter(r => r.tage_weg !== null && r.tage_weg >= 42 && r.tage_weg < 60),
            tier2m: fmt.filter(r => r.tage_weg === null || r.tage_weg >= 60)
        }});
    } catch (err) {
        console.error('Fehler absprung-risiko:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── /vertragsablauf ───────────────────────────────────────────────────────────
router.get('/vertragsablauf', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        const mf = buildMFilter(f);
        const rows = await queryAsync(`
            SELECT v.id, v.mitglied_id, v.vertragsende,
                   COALESCE(v.monatlicher_beitrag, v.monatsbeitrag) as beitrag,
                   m.vorname, m.nachname,
                   DATEDIFF(v.vertragsende, CURDATE()) as tage_bis
            FROM vertraege v
            JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
            WHERE v.status = 'aktiv'
              AND v.vertragsende IS NOT NULL
              AND v.vertragsende >= CURDATE()
              AND v.vertragsende <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
              AND m.aktiv = 1 ${mf.clause}
            ORDER BY v.vertragsende ASC
        `, mf.params);
        const fmt = rows.map(r => ({
            id: r.id,
            mitglied_id: r.mitglied_id,
            vorname: r.vorname,
            nachname: r.nachname,
            vertragsende: r.vertragsende instanceof Date ? r.vertragsende.toISOString().slice(0,10) : String(r.vertragsende).slice(0,10),
            beitrag: parseFloat(r.beitrag) || 0,
            tage_bis: Number(r.tage_bis)
        }));
        res.json({ success: true, data: {
            in30: fmt.filter(r => r.tage_bis <= 30),
            in60: fmt.filter(r => r.tage_bis > 30 && r.tage_bis <= 60),
            in90: fmt.filter(r => r.tage_bis > 60)
        }});
    } catch (err) {
        console.error('Fehler vertragsablauf:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── /zahlungsrueckstand ───────────────────────────────────────────────────────
router.get('/zahlungsrueckstand', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        const dF = f.clause; // beitraege hat direkt dojo_id
        const dP = f.params;
        // Nur fällige Einträge (zahlungsdatum <= heute) — zukünftige Beiträge ausschließen
        const [stats] = await queryAsync(`
            SELECT COUNT(*) as gesamt,
                   SUM(CASE WHEN bezahlt = 0 THEN 1 ELSE 0 END) as offen_count,
                   SUM(CASE WHEN bezahlt = 0 THEN COALESCE(betrag, 0) ELSE 0 END) as offen_betrag
            FROM beitraege
            WHERE zahlungsdatum <= CURDATE() ${dF}
        `, dP);
        const trend = await queryAsync(`
            SELECT DATE_FORMAT(zahlungsdatum, '%Y-%m') as monat,
                   COUNT(*) as gesamt,
                   SUM(CASE WHEN bezahlt = 0 THEN 1 ELSE 0 END) as offen
            FROM beitraege
            WHERE zahlungsdatum >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
              AND zahlungsdatum <= CURDATE() ${dF}
            GROUP BY monat ORDER BY monat ASC
        `, dP);
        const gesamt = Number(stats.gesamt);
        const offenCount = Number(stats.offen_count);
        res.json({ success: true, data: {
            gesamt,
            offen_count: offenCount,
            offen_betrag: parseFloat(stats.offen_betrag) || 0,
            offen_pct: gesamt > 0 ? Math.round((offenCount / gesamt) * 100) : 0,
            trend: trend.map(t => ({ monat: t.monat, gesamt: Number(t.gesamt), offen: Number(t.offen) }))
        }});
    } catch (err) {
        console.error('Fehler zahlungsrueckstand:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── /trainingsfrequenz ────────────────────────────────────────────────────────
router.get('/trainingsfrequenz', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        const mf = buildMFilter(f);
        const trainRows = await queryAsync(`
            SELECT m.mitglied_id,
                   COUNT(DISTINCT a.datum) as trainingstage
            FROM mitglieder m
            JOIN vertraege v ON v.mitglied_id = m.mitglied_id AND v.status = 'aktiv'
            LEFT JOIN anwesenheit a ON a.mitglied_id = m.mitglied_id
                 AND a.anwesend = 1
                 AND a.datum >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            WHERE m.aktiv = 1 ${mf.clause}
            GROUP BY m.mitglied_id
        `, mf.params);
        const WEEKS = 90 / 7;
        const buckets = { zero: 0, low: 0, mid: 0, high: 0 };
        for (const r of trainRows) {
            const days = Number(r.trainingstage);
            const perWeek = days / WEEKS;
            if (days === 0)          buckets.zero++;
            else if (perWeek <= 1.5) buckets.low++;
            else if (perWeek <= 3.5) buckets.mid++;
            else                     buckets.high++;
        }
        res.json({ success: true, data: {
            total: trainRows.length,
            buckets: [
                { label: 'Kein Training', count: buckets.zero, color: '#dc2626' },
                { label: '1× / Woche',    count: buckets.low,  color: '#f59e0b' },
                { label: '2–3× / Woche',  count: buckets.mid,  color: '#10b981' },
                { label: '4+× / Woche',   count: buckets.high, color: '#ffd700' }
            ]
        }});
    } catch (err) {
        console.error('Fehler trainingsfrequenz:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── /onboarding-kohorte ───────────────────────────────────────────────────────
router.get('/onboarding-kohorte', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        const mf = buildMFilter(f);
        const neueRows = await queryAsync(`
            SELECT m.mitglied_id, m.eintrittsdatum,
                   DATE_FORMAT(m.eintrittsdatum, '%Y-%m') as monat
            FROM mitglieder m
            WHERE m.eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
              AND m.eintrittsdatum IS NOT NULL
              ${mf.clause}
            ORDER BY m.eintrittsdatum
        `, mf.params);
        if (neueRows.length === 0) return res.json({ success: true, data: [] });

        const ids = neueRows.map(r => r.mitglied_id);
        const ph  = ids.map(() => '?').join(',');
        const anwRows = await queryAsync(
            `SELECT mitglied_id, datum FROM anwesenheit WHERE mitglied_id IN (${ph}) AND anwesend = 1`,
            ids
        );
        const anwMap = {};
        for (const a of anwRows) {
            const d = a.datum instanceof Date ? a.datum.toISOString().slice(0,10) : String(a.datum).slice(0,10);
            if (!anwMap[a.mitglied_id]) anwMap[a.mitglied_id] = [];
            anwMap[a.mitglied_id].push(new Date(d).getTime());
        }
        const monthMap = {};
        for (const m of neueRows) {
            const einMs = m.eintrittsdatum instanceof Date
                ? m.eintrittsdatum.getTime()
                : new Date(String(m.eintrittsdatum).slice(0,10)).getTime();
            if (!monthMap[m.monat]) monthMap[m.monat] = { monat: m.monat, total: 0, m1: 0, m2: 0, m3: 0 };
            monthMap[m.monat].total++;
            const ts = anwMap[m.mitglied_id] || [];
            const D = 86400000;
            if (ts.some(t => t > einMs && t <= einMs + 30*D))                          monthMap[m.monat].m1++;
            if (ts.some(t => t > einMs + 30*D && t <= einMs + 60*D))                   monthMap[m.monat].m2++;
            if (ts.some(t => t > einMs + 60*D && t <= einMs + 90*D))                   monthMap[m.monat].m3++;
        }
        const result = Object.values(monthMap)
            .sort((a, b) => a.monat.localeCompare(b.monat))
            .map(m => ({
                ...m,
                m1_pct: Math.round((m.m1 / m.total) * 100),
                m2_pct: m.total > 0 && new Date() > new Date(m.monat + '-01').setMonth(new Date(m.monat + '-01').getMonth() + 1)
                    ? Math.round((m.m2 / m.total) * 100) : null,
                m3_pct: m.total > 0 && new Date() > new Date(m.monat + '-01').setMonth(new Date(m.monat + '-01').getMonth() + 2)
                    ? Math.round((m.m3 / m.total) * 100) : null
            }));
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Fehler onboarding-kohorte:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── /check-in-streaks ─────────────────────────────────────────────────────────
router.get('/check-in-streaks', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        const mf = buildMFilter(f);
        const rows = await queryAsync(`
            SELECT a.mitglied_id, m.vorname, m.nachname,
                   YEARWEEK(a.datum, 1) as woche
            FROM anwesenheit a
            JOIN mitglieder m ON m.mitglied_id = a.mitglied_id
            WHERE a.anwesend = 1
              AND a.datum >= DATE_SUB(CURDATE(), INTERVAL 26 WEEK)
              AND m.aktiv = 1 ${mf.clause}
            GROUP BY a.mitglied_id, m.vorname, m.nachname, woche
            ORDER BY a.mitglied_id, woche
        `, mf.params);
        const [cwRow] = await queryAsync('SELECT YEARWEEK(CURDATE(), 1) as cw');
        const currentWeek = cwRow.cw;
        const memberMap = {};
        for (const r of rows) {
            if (!memberMap[r.mitglied_id]) {
                memberMap[r.mitglied_id] = { mitglied_id: r.mitglied_id, vorname: r.vorname, nachname: r.nachname, wochen: new Set() };
            }
            memberMap[r.mitglied_id].wochen.add(r.woche);
        }
        const results = [];
        for (const m of Object.values(memberMap)) {
            let streak = 0;
            let w = currentWeek;
            if (!m.wochen.has(w)) {
                w = ywPrev(w);
                if (!m.wochen.has(w)) continue;
            }
            while (m.wochen.has(w)) { streak++; w = ywPrev(w); }
            if (streak > 0) results.push({ mitglied_id: m.mitglied_id, name: `${m.vorname} ${m.nachname}`, streak });
        }
        results.sort((a, b) => b.streak - a.streak);
        res.json({ success: true, data: results.slice(0, 10) });
    } catch (err) {
        console.error('Fehler check-in-streaks:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

function ywPrev(yw) {
    const year = Math.floor(yw / 100);
    const week = yw % 100;
    if (week > 1) return year * 100 + (week - 1);
    const prevYear = year - 1;
    const jan1 = new Date(prevYear, 0, 1).getDay();
    const dec31 = new Date(prevYear, 11, 31).getDay();
    const lastWeek = (jan1 === 4 || dec31 === 4) ? 53 : 52;
    return prevYear * 100 + lastWeek;
}

// ── /graduierungs-pyramide ────────────────────────────────────────────────────
router.get('/graduierungs-pyramide', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        const mf = buildMFilter(f);
        const rows = await queryAsync(`
            SELECT s.name as stil, s.stil_id, s.reihenfolge as stil_reihenfolge,
                   g.graduierung_id, g.name as grad_name, g.reihenfolge,
                   g.farbe_hex, g.kategorie, g.dan_grad,
                   COUNT(msd.id) as count
            FROM mitglied_stil_data msd
            JOIN graduierungen g ON g.graduierung_id = msd.current_graduierung_id
            JOIN stile s ON s.stil_id = g.stil_id
            JOIN mitglieder m ON m.mitglied_id = msd.mitglied_id AND m.aktiv = 1
            WHERE g.aktiv = 1 ${mf.clause}
            GROUP BY g.graduierung_id
            ORDER BY s.reihenfolge, g.reihenfolge DESC
        `, mf.params);
        const stilMap = {};
        for (const r of rows) {
            if (!stilMap[r.stil]) stilMap[r.stil] = { stil: r.stil, stil_id: r.stil_id, stil_reihenfolge: r.stil_reihenfolge, stufen: [] };
            stilMap[r.stil].stufen.push({
                grad_name: r.grad_name,
                reihenfolge: r.reihenfolge,
                farbe_hex: r.farbe_hex || '#ffffff',
                kategorie: r.kategorie,
                dan_grad: r.dan_grad,
                count: Number(r.count)
            });
        }
        for (const stil of Object.values(stilMap)) {
            stil.stufen.sort((a, b) => b.reihenfolge - a.reihenfolge);
            stil.total = stil.stufen.reduce((s, g) => s + g.count, 0);
        }
        const result = Object.values(stilMap).sort((a, b) => a.stil_reihenfolge - b.stil_reihenfolge);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Fehler graduierungs-pyramide:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── /trainer-auslastung ───────────────────────────────────────────────────────
router.get('/trainer-auslastung', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        const dF = f.clause; // trainer hat direkt dojo_id
        const dP = f.params;
        const rows = await queryAsync(`
            SELECT t.trainer_id, t.vorname, t.nachname, t.stil,
                   COUNT(DISTINCT CONCAT(a.datum, '_', a.stundenplan_id)) as einheiten,
                   SUM(CASE WHEN a.anwesend = 1 THEN 1 ELSE 0 END) as gesamt_teilnehmer
            FROM trainer t
            JOIN stundenplan s ON s.trainer_id = t.trainer_id
            LEFT JOIN anwesenheit a ON a.stundenplan_id = s.stundenplan_id
                 AND a.datum >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            WHERE 1=1 ${dF.replace(/AND dojo_id/g, 'AND t.dojo_id')}
            GROUP BY t.trainer_id
            HAVING einheiten > 0
            ORDER BY gesamt_teilnehmer DESC
        `, dP);
        const result = rows.map(r => {
            const einheiten = Number(r.einheiten);
            const gesamt = Number(r.gesamt_teilnehmer);
            return {
                trainer_id: r.trainer_id,
                name: `${r.vorname} ${r.nachname}`,
                initials: `${r.vorname[0]}${r.nachname[0]}`.toUpperCase(),
                stil: r.stil,
                einheiten,
                gesamt_teilnehmer: gesamt,
                avg_teilnehmer: einheiten > 0 ? Math.round((gesamt / einheiten) * 10) / 10 : 0
            };
        });
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Fehler trainer-auslastung:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── /registrierungen-stats ────────────────────────────────────────────────────
router.get('/registrierungen-stats', async (req, res) => {
    try {
        const f  = await getSecureDojoFilter(req);
        // Kein Alias für einfache mitglieder-Queries
        const plainClause = f.clause;   // "AND dojo_id = ?"
        const plainParams = f.params;
        // Mit Alias m für JOIN-Queries
        const mf = buildMFilter(f);     // "AND m.dojo_id = ?"
        const mClause = mf.clause;
        const mParams = mf.params;

        // 1. Monatliche Neuanmeldungen – letzte 13 Monate (für YoY-Vergleich)
        const monatlichRows = await queryAsync(`
            SELECT DATE_FORMAT(eintrittsdatum, '%Y-%m') AS monat,
                   COUNT(*) AS anzahl
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 13 MONTH)
              AND eintrittsdatum IS NOT NULL
              ${plainClause}
            GROUP BY monat
            ORDER BY monat
        `, plainParams);

        // 2. KPI: diese Monat / Vormonat / Vorjahr-gleicher-Monat / Gesamt aktiv
        const [[kpiRow]] = await Promise.all([queryAsync(`
            SELECT
              SUM(CASE WHEN DATE_FORMAT(eintrittsdatum,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m') THEN 1 ELSE 0 END) AS dieser_monat,
              SUM(CASE WHEN DATE_FORMAT(eintrittsdatum,'%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH),'%Y-%m') THEN 1 ELSE 0 END) AS vormonat,
              SUM(CASE WHEN DATE_FORMAT(eintrittsdatum,'%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 YEAR),'%Y-%m') THEN 1 ELSE 0 END) AS vorjahr_monat,
              SUM(CASE WHEN aktiv = 1 THEN 1 ELSE 0 END) AS gesamt_aktiv
            FROM mitglieder
            WHERE 1=1 ${plainClause}
        `, plainParams)]);

        // 3. Wochentags-Verteilung
        const wochentageRows = await queryAsync(`
            SELECT DAYOFWEEK(eintrittsdatum) AS dow, COUNT(*) AS anzahl
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
              AND eintrittsdatum IS NOT NULL
              ${plainClause}
            GROUP BY dow
            ORDER BY dow
        `, plainParams);
        const dowLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        const wochentage = dowLabels.map((label, i) => {
            const row = wochentageRows.find(r => r.dow === i + 1);
            return { tag: label, anzahl: row ? row.anzahl : 0 };
        });

        // 4. Quelle: Empfehlung vs. direkt (aus referrals-Tabelle)
        const quelleRows = await queryAsync(`
            SELECT
              SUM(CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) AS empfehlung,
              SUM(CASE WHEN r.id IS NULL     THEN 1 ELSE 0 END) AS direkt
            FROM mitglieder m
            LEFT JOIN referrals r ON r.geworbenes_mitglied_id = m.mitglied_id
            WHERE m.eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
              ${mClause}
        `, mParams);

        // 5. Promo-Code vs. kein Code (aus registrierungen – join über email)
        const promoRows = await queryAsync(`
            SELECT
              SUM(CASE WHEN rg.promo_code IS NOT NULL AND rg.promo_code != '' THEN 1 ELSE 0 END) AS mit_promo,
              SUM(CASE WHEN rg.promo_code IS NULL OR rg.promo_code = ''       THEN 1 ELSE 0 END) AS ohne_promo
            FROM registrierungen rg
            JOIN mitglieder m ON m.email = rg.email
            WHERE m.eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
              ${mClause}
        `, mParams);

        // 6. Registrierungs-Funnel: Status-Verteilung aus registrierungen
        //    Nur für Dojos mit echtem Filter (andernfalls plattformweit)
        const funnelRows = await queryAsync(`
            SELECT rg.status, COUNT(*) AS anzahl
            FROM registrierungen rg
            ${mParams.length > 0
                ? `JOIN mitglieder m ON m.email = rg.email WHERE ${mClause.replace(/^AND /, '')}`
                : 'WHERE 1=1'}
            GROUP BY rg.status
        `, mParams.length > 0 ? mParams : []);

        const funnelOrder = [
            'email_pending', 'email_verified', 'personal_data_complete',
            'bank_data_complete', 'tariff_selected',
            'health_questions_complete', 'registration_complete'
        ];
        const funnelLabels = {
            email_pending: 'E-Mail ausstehend',
            email_verified: 'E-Mail bestätigt',
            personal_data_complete: 'Persönl. Daten',
            bank_data_complete: 'Bankdaten',
            tariff_selected: 'Tarif gewählt',
            health_questions_complete: 'Gesundheit',
            registration_complete: 'Abgeschlossen'
        };
        const funnelMap = {};
        for (const r of funnelRows) funnelMap[r.status] = r.anzahl;
        const funnel = funnelOrder.map(key => ({
            schritt: funnelLabels[key] || key,
            anzahl: funnelMap[key] || 0
        }));

        // 7. Wachstums-Trend: 12 Monate inkl. Vorjahr-Linie
        const trend12 = monatlichRows.slice(-12);
        const vorjahrRows = await queryAsync(`
            SELECT DATE_FORMAT(eintrittsdatum, '%Y-%m') AS monat,
                   COUNT(*) AS anzahl
            FROM mitglieder
            WHERE eintrittsdatum >= DATE_SUB(CURDATE(), INTERVAL 25 MONTH)
              AND eintrittsdatum < DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
              AND eintrittsdatum IS NOT NULL
              ${plainClause}
            GROUP BY monat
            ORDER BY monat
        `, plainParams);

        // Vorjahr-Monat auf aktuellen Monat mappen (+12 Monate)
        const vorjahrMap = {};
        for (const r of vorjahrRows) {
            const d = new Date(r.monat + '-01');
            d.setMonth(d.getMonth() + 12);
            const key = d.toISOString().slice(0, 7);
            vorjahrMap[key] = r.anzahl;
        }
        const trendData = trend12.map(r => ({
            monat: r.monat,
            anzahl: r.anzahl,
            vorjahr: vorjahrMap[r.monat] || 0
        }));

        res.json({
            success: true,
            data: {
                kpi: kpiRow,
                trendData,
                wochentage,
                quelle: {
                    empfehlung: quelleRows[0]?.empfehlung || 0,
                    direkt: quelleRows[0]?.direkt || 0,
                    mit_promo: promoRows[0]?.mit_promo || 0,
                    ohne_promo: promoRows[0]?.ohne_promo || 0
                },
                funnel
            }
        });
    } catch (err) {
        console.error('Fehler registrierungen-stats:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;