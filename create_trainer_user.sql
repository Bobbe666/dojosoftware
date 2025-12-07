INSERT INTO admin_users (username, email, password, vorname, nachname, rolle, berechtigungen, aktiv, email_verifiziert, erstellt_am)
VALUES (
  'TrainerloginTDA',
  'trainer@tda.local',
  '$2b$10$xbmodBntoDWp5kaKobVGMOPhDhUX5DJ3GAfBIjF30mc7KJJSSaBDW',
  'Trainer',
  'TDA',
  'eingeschraenkt',
  '{"checkin": true, "anwesenheit": true}',
  1,
  1,
  NOW()
)
ON DUPLICATE KEY UPDATE username=username;
