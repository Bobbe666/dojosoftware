-- Migration 114: Initial-Einträge Zugangsdaten-Zentrale
-- Passwörter sind leer — bitte über die UI (Plattform > Zugangsdaten) befüllen!

INSERT INTO plattform_zugangsdaten (kategorie, name, url, benutzername_enc, notizen, sort_order) VALUES

-- ── SERVER & HOSTING ───────────────────────────────────────────────────────
('server', 'SSH: dojo.tda-intl.org',       NULL,                              'root',               'Port 2222 · Key: ~/.ssh/id_ed25519_dojo_deploy', 10),
('server', 'Alfahosting Kundenbereich',    'https://my.alfahosting.de',       NULL,                 'Hauptvertrag, Domains, Pakete, FTP-Zugänge',      20),
('server', 'FTP / SFTP',                  'ftp://dojo.tda-intl.org',         NULL,                 'FTP-Zugangsdaten für File-Uploads',               30),

-- ── DATENBANKEN ────────────────────────────────────────────────────────────
('datenbank', 'MySQL: dojo (Dojosoftware)',  'mysql://localhost:3306/dojo',     NULL,                 'Produktions-DB Dojosoftware · Benutzer: dojo_user', 10),
('datenbank', 'MySQL: tda (TDA Events)',    'mysql://localhost:3306/tda',      NULL,                 'Produktions-DB TDA Events · Benutzer: tdaUser',     20),
('datenbank', 'MySQL: hof (HOF)',           'mysql://localhost:3306/hof',      NULL,                 'Produktions-DB HOF · Benutzer: hof_user',           30),
('datenbank', 'phpMyAdmin',                'https://dojo.tda-intl.org/pma',   NULL,                 'Falls konfiguriert — URL ggf. anpassen',            40),

-- ── E-MAIL / SMTP ─────────────────────────────────────────────────────────
('email', 'SMTP Alfahosting (Dojosoftware)', NULL,                            NULL,                 'Host: smtp.alfahosting.de · Port 587/465 · TLS',    10),
('email', 'SMTP TDA Events',               NULL,                              NULL,                 'Host: smtp.alfahosting.de · Port 587/465',          20),
('email', 'Postfach info@ / noreply@',     'https://webmail.alfahosting.de',  NULL,                 'Webmail-Zugang Alfahosting',                        30),

-- ── PLATTFORMEN (eigene Apps) ─────────────────────────────────────────────
('plattform', 'Dojosoftware Admin',         'https://dojo.tda-intl.org',      NULL,                 'Super-Admin Login',                                10),
('plattform', 'TDA Events Dashboard',       'https://events.tda-intl.org/dashboard', NULL,          'Admin Login TDA Events Plattform',                 20),
('plattform', 'HOF Dashboard',             'https://hof.tda-intl.org',       NULL,                 'Admin Login HOF-Plattform',                        30),
('plattform', 'Check-in App',              'https://checkin.tda-intl.org',   NULL,                 'Läuft über Dojosoftware Login',                    40),
('plattform', 'Member App (app.tda-vib.de)','https://app.tda-vib.de',        NULL,                 'Läuft über Dojosoftware Login · VIB-Subdomain',    50),

-- ── EXTERNE DIENSTE ───────────────────────────────────────────────────────
('extern', 'Meta / Facebook Business',     'https://business.facebook.com',  NULL,                 'Messenger-Webhook, Facebook-Seite TDA',            10),
('extern', 'Google Play Console',          'https://play.google.com/console', NULL,                'Android App (falls vorhanden)',                    20),
('extern', 'Apple Developer',              'https://developer.apple.com',    NULL,                 'iOS App (falls vorhanden)',                        30),
('extern', 'Stripe / Zahlungsanbieter',    NULL,                              NULL,                 'API-Keys falls Stripe genutzt wird',               40),

-- ── SONSTIGES ─────────────────────────────────────────────────────────────
('sonstiges', 'VAPID Keys (Push Notifications)', NULL, NULL,                  'In .env auf Server: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_EMAIL', 10),
('sonstiges', 'JWT Secret',               NULL,                              NULL,                 'JWT_SECRET in .env auf Server — NICHT hier speichern!', 20);
