-- =====================================================
-- Migration 080: Plan-Features bereinigen + Mappings vervollständigen
-- Datum: 2026-04-14
-- Beschreibung:
--   - Deaktiviert alte Duplikate (buchfuehrung, mahnwesen, vertraege, externe_chats)
--   - Setzt is_active=0 für Features die nicht für Kunden relevant sind
--   - Vervollständigt plan_feature_mapping für alle Pläne
--   - Enterprise erhält alle aktiven Features
-- =====================================================

-- 1. Duplikate deaktivieren
UPDATE plan_features SET is_active = 0 WHERE feature_key IN (
  'buchfuehrung',     -- Duplikat von finanzcockpit
  'mahnwesen',        -- enthalten in rechnungen
  'vertraege',        -- Duplikat von digitale_vertraege
  'externe_chats',    -- Duplikat von messenger
  'whitelabel',       -- interne Funktion, nicht für Kunden relevant
  'sicherheit',       -- DSGVO-Basisfeature, kein Differenzierungsmerkmal
  'benachrichtigungen'-- Basis, kein Differenzierungsmerkmal
);

-- 2. Alle Mappings neu aufbauen (sauber)
DELETE FROM plan_feature_mapping;

-- ── STARTER ───────────────────────────────────────────────────────────────────
INSERT INTO plan_feature_mapping (plan_id, feature_id, is_included)
SELECT p.plan_id, f.feature_id, 1
FROM subscription_plans p, plan_features f
WHERE p.plan_name = 'starter'
  AND f.is_active = 1
  AND f.feature_key IN (
    'mitgliederverwaltung',
    'checkin',
    'online_registrierung',
    'mitglieder_portal',
    'stundenplan',
    'digitale_vertraege',
    'trainerverwaltung',
    'dokumente',
    'pruefungen',
    'familien',
    'dashboard',
    'probetraining'
  );

-- ── PROFESSIONAL ──────────────────────────────────────────────────────────────
INSERT INTO plan_feature_mapping (plan_id, feature_id, is_included)
SELECT p.plan_id, f.feature_id, 1
FROM subscription_plans p, plan_features f
WHERE p.plan_name = 'professional'
  AND f.is_active = 1
  AND f.feature_key IN (
    'mitgliederverwaltung',
    'checkin',
    'online_registrierung',
    'mitglieder_portal',
    'stundenplan',
    'digitale_vertraege',
    'trainerverwaltung',
    'dokumente',
    'pruefungen',
    'familien',
    'dashboard',
    'probetraining',
    'sepa',
    'rechnungen',
    'verkauf',
    'beitragsabrechnung',
    'events',
    'kommunikation',
    'badges',
    'eltern_portal',
    'trainer_stunden',
    'freunde_werben',
    'marketing',
    'ausruestung',
    'wallet_pass',
    'entwicklungsziele',
    'kalender_abo',
    'interessenten',
    'ruhepause',
    'auswertungen'
  );

-- ── PREMIUM ───────────────────────────────────────────────────────────────────
INSERT INTO plan_feature_mapping (plan_id, feature_id, is_included)
SELECT p.plan_id, f.feature_id, 1
FROM subscription_plans p, plan_features f
WHERE p.plan_name = 'premium'
  AND f.is_active = 1
  AND f.feature_key IN (
    'mitgliederverwaltung',
    'checkin',
    'online_registrierung',
    'mitglieder_portal',
    'stundenplan',
    'digitale_vertraege',
    'trainerverwaltung',
    'dokumente',
    'pruefungen',
    'familien',
    'dashboard',
    'probetraining',
    'sepa',
    'rechnungen',
    'verkauf',
    'beitragsabrechnung',
    'events',
    'kommunikation',
    'badges',
    'eltern_portal',
    'trainer_stunden',
    'freunde_werben',
    'marketing',
    'ausruestung',
    'wallet_pass',
    'entwicklungsziele',
    'kalender_abo',
    'interessenten',
    'ruhepause',
    'auswertungen',
    'finanzcockpit',
    'homepage_builder',
    'api',
    'chat',
    'shop',
    'lernplattform',
    'wettbewerb'
  );

-- ── ENTERPRISE: alle aktiven Features ─────────────────────────────────────────
INSERT INTO plan_feature_mapping (plan_id, feature_id, is_included)
SELECT p.plan_id, f.feature_id, 1
FROM subscription_plans p, plan_features f
WHERE p.plan_name = 'enterprise'
  AND f.is_active = 1;

SELECT 'Migration 080: Features bereinigt, Mappings vollständig' as status;
