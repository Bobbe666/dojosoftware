-- Mitgliedsvertrag Vorlage einfügen
-- Basierend auf TDA Vilsbiburg PDF-Vorlage

USE dojo_management;

-- Prüfen ob Vorlage bereits existiert und ggf. löschen
DELETE FROM vertragsvorlagen WHERE name = 'Mitgliedsvertrag - TDA Style';

-- Neue Vorlage einfügen
INSERT INTO vertragsvorlagen (
    name,
    template_type,
    grapesjs_html,
    grapesjs_css,
    created_at,
    updated_at
) VALUES (
    'Mitgliedsvertrag - TDA Style',
    'vertrag',
    -- HTML Content wird hier eingefügt (siehe mitgliedsvertrag_vorlage.html)
    'Die HTML-Vorlage wurde in C:\\dojosoftware\\Backend\\templates\\mitgliedsvertrag_vorlage.html erstellt',
    '',
    NOW(),
    NOW()
);

-- Verfügbare Platzhalter für diese Vorlage:
-- Persönliche Daten:
-- {{mitglied_id}} - Mitgliedsnummer
-- {{anrede}} - Herr/Frau
-- {{vorname}} - Vorname des Mitglieds
-- {{nachname}} - Nachname des Mitglieds
-- {{strasse}} - Straßenname
-- {{hausnummer}} - Hausnummer
-- {{plz}} - Postleitzahl
-- {{ort}} - Ort
-- {{telefon}} - Festnetznummer
-- {{email}} - E-Mail-Adresse
-- {{mobil}} - Mobilnummer
-- {{geburtsdatum}} - Geburtsdatum

-- Vertragsdaten:
-- {{tarif_name}} - Name des Tarifs
-- {{betrag}} - Monatlicher Betrag
-- {{zahlweise}} - monatlich/jährlich
-- {{aufnahmegebuehr}} - Aufnahmegebühr
-- {{mindestlaufzeit}} - z.B. "6 Monate"
-- {{vertragsbeginn}} - Startdatum
-- {{nutzungsbeginn}} - Nutzungsbeginn
-- {{vertragsverlaengerung}} - Verlängerungsdauer
-- {{kuendigungsfrist}} - Kündigungsfrist

-- SEPA-Daten:
-- {{kontoinhaber}} - Name des Kontoinhabers
-- {{kreditinstitut}} - Name der Bank
-- {{bic}} - BIC-Code
-- {{iban}} - IBAN
-- {{sepa_referenz}} - SEPA Mandatsreferenz
-- {{zahlungsdienstleister}} - z.B. "Finion Capital GmbH"
-- {{glaeubiger_id}} - Gläubiger-ID

-- Dojo-Daten:
-- {{dojo_name}} - Name des Dojos
-- {{dojo_adresse}} - Vollständige Adresse
-- {{dojo_kontakt}} - Kontaktdaten (Telefon, E-Mail, Website)
-- {{ort}} - Ort für Unterschrift
-- {{datum}} - Aktuelles Datum

-- Zahlungstermine:
-- {{zahlungstermine}} - Tabelle mit Zahlungsterminen (wird dynamisch generiert)

SELECT 'Vertragsvorlage wurde vorbereitet. Bitte HTML-Datei manuell im TemplateEditor importieren.' AS Info;
