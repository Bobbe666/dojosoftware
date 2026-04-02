-- Fügt Sicherheitsfrage und Antwort-Hash zur users-Tabelle hinzu
ALTER TABLE users
  ADD COLUMN security_question VARCHAR(255) NULL,
  ADD COLUMN security_answer_hash VARCHAR(255) NULL;


