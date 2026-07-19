-- =============================================================================
-- Migration 235: Feingranulare ERP-Rollen zum admin_users.rolle ENUM
-- Fundament fürs Rollen-/Rechtesystem (ERP-Punkt 1). Additiv/nicht-brechend:
-- die bestehenden Rollen bleiben unverändert, es kommen nur neue Werte hinzu.
--   dojoleiter       – volle Dojo-Leitung (wie admin, aber dojo-scoped)
--   assistenztrainer – Trainer-Assistenz (überwiegend Leserechte)
--   kassenwart       – Finanzen/Kasse
--   pruefer          – Prüfungen
--   turnierleiter    – Turniere/Events + Stundenplan
--   rezeption        – Empfang (Mitglieder anlegen/lesen, Stundenplan lesen)
-- =============================================================================

ALTER TABLE admin_users
  MODIFY COLUMN rolle ENUM(
    'super_admin','admin','mitarbeiter','eingeschraenkt','trainer','checkin',
    'dojoleiter','assistenztrainer','kassenwart','pruefer','turnierleiter','rezeption'
  ) DEFAULT 'eingeschraenkt';
