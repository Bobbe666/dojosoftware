-- Migration 081: Email-Vorlage für Prüfungs-Stornierungshinweis
-- Fügt eine vorgefertigte Benachrichtigungsvorlage für den 7-Tage-Stornierungshinweis bei Gürtelprüfungen ein

INSERT INTO email_templates (name, subject, content, variables, created_at)
VALUES (
  'Prüfungsanmeldung – Stornierungshinweis',
  'Wichtiger Hinweis zu deiner Prüfungsanmeldung – {stil_name} am {pruefungsdatum}',
  'Hallo {vorname},

wir freuen uns sehr, dich bei der bevorstehenden Prüfung begrüßen zu dürfen! 🎉

Damit alles reibungslos ablaufen kann, möchten wir dich herzlich auf unsere Stornierungsregelung hinweisen:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 STORNIERUNGSREGELUNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Eine kostenfreie Abmeldung ist bis 7 Tage vor dem Prüfungstermin möglich.

Ab diesem Zeitpunkt laufen alle Vorbereitungen auf Hochtouren:
✦ Deine Urkunde wird gedruckt
✦ Prüfer sind fest eingeplant
✦ Die gesamte Veranstaltungsorganisation steht

Dieser Aufwand ist dann bereits entstanden und kann leider nicht mehr rückgängig gemacht werden.

Daher bleibt die Prüfungsgebühr ({pruefungsgebuehr} €) bei einer Abmeldung innerhalb dieser Frist in voller Höhe fällig – auch im Krankheitsfall oder bei sonstiger Verhinderung.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Wir bitten herzlich um dein Verständnis und sind überzeugt, dass du deinen wohlverdienten Prüfungstag rocken wirst. Viel Erfolg – wir drücken dir kräftig die Daumen! 🥋

Mit sportlichen Grüßen,
{dojoname}',
  '["vorname", "stil_name", "pruefungsdatum", "pruefungsgebuehr", "dojoname"]',
  NOW()
)
ON DUPLICATE KEY UPDATE
  subject = VALUES(subject),
  content = VALUES(content),
  variables = VALUES(variables);
