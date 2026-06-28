-- =============================================================================
-- Migration 218: Enso-Karate-Urkunde als Art im Verbands-Urkundenregister
-- Erweitert das ENUM verband_urkunden.art um 'enso'.
-- =============================================================================

ALTER TABLE verband_urkunden
  MODIFY art ENUM(
    'pruefungsurkunde',
    'dan_urkunde',
    'ehren_dan',
    'board_of_black_belts',
    'trainer_lizenz',
    'kampfrichter_lizenz',
    'meister_urkunde',
    'kickboxen_schuelergrad',
    'aikido_schuelergrad',
    'hof_nominierung',
    'shieldx',
    'enso',
    'sonstiges'
  ) NOT NULL DEFAULT 'pruefungsurkunde';
