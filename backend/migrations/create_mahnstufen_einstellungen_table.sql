-- Tabelle für Mahnstufen-Einstellungen erstellen
CREATE TABLE IF NOT EXISTS mahnstufen_einstellungen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stufe INT NOT NULL,
    bezeichnung VARCHAR(255) NOT NULL,
    tage_nach_faelligkeit INT NOT NULL DEFAULT 14,
    mahngebuehr DECIMAL(10, 2) DEFAULT 0.00,
    email_betreff VARCHAR(500),
    email_text TEXT,
    aktiv TINYINT(1) DEFAULT 1,
    dojo_id INT DEFAULT 1,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_stufe (stufe),
    INDEX idx_dojo (dojo_id),
    UNIQUE KEY unique_stufe_dojo (stufe, dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Standard-Mahnstufen einfügen
INSERT INTO mahnstufen_einstellungen (stufe, bezeichnung, tage_nach_faelligkeit, mahngebuehr, email_betreff, email_text, aktiv, dojo_id)
VALUES
(1, '1. Mahnung (Zahlungserinnerung)', 14, 5.00, 'Zahlungserinnerung - Offener Beitrag', 'Sehr geehrte/r {vorname} {nachname},\n\nwir möchten Sie freundlich daran erinnern, dass folgender Beitrag noch offen ist:\n\nBetrag: {betrag} €\nFällig seit: {faelligkeitsdatum}\n\nBitte überweisen Sie den Betrag zeitnah auf unser Konto.\n\nMit freundlichen Grüßen\nIhr Dojo-Team', 1, 1),
(2, '2. Mahnung (Erste Mahnung)', 28, 10.00, '2. Mahnung - Dringend: Offener Beitrag', 'Sehr geehrte/r {vorname} {nachname},\n\nleider haben wir bisher keine Zahlung erhalten. Dies ist Ihre 2. Mahnung.\n\nBetrag: {betrag} €\nFällig seit: {faelligkeitsdatum}\nMahngebühr: {mahngebuehr} €\nGesamtbetrag: {gesamtbetrag} €\n\nBitte begleichen Sie den Betrag umgehend.\n\nMit freundlichen Grüßen\nIhr Dojo-Team', 1, 1),
(3, '3. Mahnung (Letzte Mahnung)', 42, 15.00, '3. Mahnung - LETZTE ZAHLUNGSAUFFORDERUNG', 'Sehr geehrte/r {vorname} {nachname},\n\ntrotz mehrfacher Aufforderung ist der fällige Betrag noch nicht eingegangen. Dies ist unsere letzte Mahnung vor rechtlichen Schritten.\n\nBetrag: {betrag} €\nFällig seit: {faelligkeitsdatum}\nMahngebühr: {mahngebuehr} €\nGesamtbetrag: {gesamtbetrag} €\n\nBitte zahlen Sie SOFORT, um weitere Maßnahmen zu vermeiden.\n\nMit freundlichen Grüßen\nIhr Dojo-Team', 1, 1)
ON DUPLICATE KEY UPDATE
    bezeichnung = VALUES(bezeichnung),
    tage_nach_faelligkeit = VALUES(tage_nach_faelligkeit),
    mahngebuehr = VALUES(mahngebuehr),
    email_betreff = VALUES(email_betreff),
    email_text = VALUES(email_text);
