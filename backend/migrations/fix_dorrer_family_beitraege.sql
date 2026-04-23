-- Fix: Familienmitglieder Dorrer (Mario #828, Elias #829) hatten kein tarif_id bei Anmeldung
-- → keine vertraege und keine beitraege angelegt
-- Lösung: vertraege + beitraege für April 2026 nachträglich anlegen
-- basierend auf Niklas Dorrer (#827, Hauptmitglied) Tarif

-- Schritt 1: Vertrag für Mario Dorrer (828)
INSERT INTO vertraege (mitglied_id, dojo_id, tarif_id, status, vertragsbeginn, monatsbeitrag, monatlicher_beitrag,
                       rabatt_prozent, rabatt_grund, mindestlaufzeit_monate, kuendigungsfrist_monate)
SELECT
    828,
    v.dojo_id,
    v.tarif_id,
    'aktiv',
    v.vertragsbeginn,
    v.monatsbeitrag,
    v.monatsbeitrag,
    0,
    NULL,
    v.mindestlaufzeit_monate,
    v.kuendigungsfrist_monate
FROM vertraege v
WHERE v.mitglied_id = 827 AND v.status = 'aktiv'
LIMIT 1;

-- Schritt 2: Vertrag für Elias Dorrer (829)
INSERT INTO vertraege (mitglied_id, dojo_id, tarif_id, status, vertragsbeginn, monatsbeitrag, monatlicher_beitrag,
                       rabatt_prozent, rabatt_grund, mindestlaufzeit_monate, kuendigungsfrist_monate)
SELECT
    829,
    v.dojo_id,
    v.tarif_id,
    'aktiv',
    v.vertragsbeginn,
    v.monatsbeitrag,
    v.monatsbeitrag,
    0,
    NULL,
    v.mindestlaufzeit_monate,
    v.kuendigungsfrist_monate
FROM vertraege v
WHERE v.mitglied_id = 827 AND v.status = 'aktiv'
LIMIT 1;

-- Schritt 3: Beitrag April 2026 für Mario Dorrer (828)
INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id)
SELECT
    828,
    v.monatsbeitrag,
    '2026-04-01',
    'Lastschrift',
    0,
    v.dojo_id
FROM vertraege v
WHERE v.mitglied_id = 827 AND v.status = 'aktiv'
LIMIT 1;

-- Schritt 4: Beitrag April 2026 für Elias Dorrer (829)
INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id)
SELECT
    829,
    v.monatsbeitrag,
    '2026-04-01',
    'Lastschrift',
    0,
    v.dojo_id
FROM vertraege v
WHERE v.mitglied_id = 827 AND v.status = 'aktiv'
LIMIT 1;

-- Prüfabfrage: alle 3 Dorrers in Lastschriftlauf-Preview?
SELECT m.mitglied_id, m.vorname, m.nachname,
       COUNT(b.beitrag_id) as offene_beitraege,
       SUM(b.betrag) as gesamt,
       sm.mandatsreferenz
FROM mitglieder m
JOIN beitraege b ON m.mitglied_id = b.mitglied_id AND b.bezahlt = 0
JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
WHERE m.familien_id = 201
GROUP BY m.mitglied_id, m.vorname, m.nachname, sm.mandatsreferenz;
