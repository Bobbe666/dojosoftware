-- ============================================================================
-- 192: Tägliches Briefing — Event-Checklisten-Log
-- Merkt sich, für welche Events bereits automatisch eine Aufgaben-Checkliste
-- (todos) erzeugt wurde — verhindert, dass gelöschte Aufgaben täglich
-- wieder angelegt werden (1 Zeile pro Event, nicht pro Aufgabe).
-- ============================================================================

CREATE TABLE IF NOT EXISTS briefing_event_checklisten (
  event_key   VARCHAR(120) NOT NULL PRIMARY KEY,
  event_titel VARCHAR(255) DEFAULT NULL,
  event_datum DATE DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
