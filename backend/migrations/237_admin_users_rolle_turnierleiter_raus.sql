-- =============================================================================
-- Migration 237: Rolle 'turnierleiter' aus admin_users.rolle ENUM entfernen
-- Turniere gehören nicht in die Dojosoftware (separate Events-Plattform) →
-- die in Migration 235 eingeführte Rolle wird wieder entfernt.
-- Sicher: 0 Nutzer mit rolle='turnierleiter' (auf Prod verifiziert vor Ausführung).
-- =============================================================================

ALTER TABLE admin_users
  MODIFY COLUMN rolle ENUM(
    'super_admin','admin','mitarbeiter','eingeschraenkt','trainer','checkin',
    'dojoleiter','assistenztrainer','kassenwart','pruefer','rezeption'
  ) DEFAULT 'eingeschraenkt';
