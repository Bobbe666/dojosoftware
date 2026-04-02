-- =====================================================================================
-- PERFORMANCE INDEXES FÜR DOJOSOFTWARE (MySQL 5.7+ kompatibel)
-- =====================================================================================

-- MITGLIEDER TABELLE
CREATE INDEX idx_mitglieder_dojo_id ON mitglieder(dojo_id);
CREATE INDEX idx_mitglieder_email ON mitglieder(email);
CREATE INDEX idx_mitglieder_status ON mitglieder(status);
CREATE INDEX idx_mitglieder_dojo_status ON mitglieder(dojo_id, status);
CREATE INDEX idx_mitglieder_mitgliedsnummer ON mitglieder(mitgliedsnummer);

-- VERTRÄGE TABELLE
CREATE INDEX idx_vertraege_dojo_id ON vertraege(dojo_id);
CREATE INDEX idx_vertraege_mitglied_id ON vertraege(mitglied_id);
CREATE INDEX idx_vertraege_status ON vertraege(status);
CREATE INDEX idx_vertraege_dojo_mitglied ON vertraege(dojo_id, mitglied_id);
CREATE INDEX idx_vertraege_vertragsbeginn ON vertraege(vertragsbeginn);
CREATE INDEX idx_vertraege_kuendigungsdatum ON vertraege(kuendigungsdatum);

-- TRANSAKTIONEN TABELLE
CREATE INDEX idx_transaktionen_dojo_id ON transaktionen(dojo_id);
CREATE INDEX idx_transaktionen_mitglied_id ON transaktionen(mitglied_id);
CREATE INDEX idx_transaktionen_datum ON transaktionen(datum);
CREATE INDEX idx_transaktionen_status ON transaktionen(status);
CREATE INDEX idx_transaktionen_dojo_datum ON transaktionen(dojo_id, datum);

-- PRÜFUNGEN TABELLE
CREATE INDEX idx_pruefungen_dojo_id ON pruefungen(dojo_id);
CREATE INDEX idx_pruefungen_mitglied_id ON pruefungen(mitglied_id);
CREATE INDEX idx_pruefungen_datum ON pruefungen(datum);
CREATE INDEX idx_pruefungen_stil_id ON pruefungen(stil_id);
CREATE INDEX idx_pruefungen_guertel_id ON pruefungen(guertel_id);

-- ANWESENHEIT TABELLE
CREATE INDEX idx_anwesenheit_dojo_id ON anwesenheit(dojo_id);
CREATE INDEX idx_anwesenheit_mitglied_id ON anwesenheit(mitglied_id);
CREATE INDEX idx_anwesenheit_datum ON anwesenheit(datum);
CREATE INDEX idx_anwesenheit_dojo_datum ON anwesenheit(dojo_id, datum);

-- NOTIFICATIONS TABELLE
CREATE INDEX idx_notifications_dojo_id ON notifications(dojo_id);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_gelesen ON notifications(gelesen);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_recipient_gelesen ON notifications(recipient_id, gelesen);

-- ADMINS TABELLE
CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_admins_dojo_id ON admins(dojo_id);
CREATE INDEX idx_admins_role ON admins(role);
