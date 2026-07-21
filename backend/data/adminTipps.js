// ============================================================================
// ADMIN-TIPPS — kuratierte „Wusstest du schon…?"-Feature-Tipps fürs Dashboard.
//
// Zielgruppe: Inhaber & Staff im Admin-Bereich (Feature-Discovery).
// Anzeige: Widget in der Dashboard-Übersicht, Aktionen Erledigt/Später/Nächster/Aus.
//
// ⚠️ WICHTIG: `id` ist der STABILE Schlüssel, unter dem der Lese-Status pro
//    Mitarbeiter gespeichert wird (Tabelle admin_tipp_status.tipp_id).
//    → IDs NIE wiederverwenden oder umnummerieren. Neue Tipps hinten anhängen
//      mit der nächsten freien ID. Gelöschte Tipps: ID einfach frei lassen.
// ============================================================================

const ADMIN_TIPPS = [
  {
    id: 1,
    kategorie: 'Finanzen',
    icon: '💸',
    titel: 'Beiträge automatisch per SEPA einziehen',
    text: 'Wusstest du schon, dass du Lastschrift-Gruppen mit festem Einzugstag pro Dojo anlegen kannst? Die Beiträge werden dann zeitgesteuert automatisch eingezogen – kein manuelles Anstoßen mehr nötig.',
  },
  {
    id: 2,
    kategorie: 'Mitglieder',
    icon: '🏦',
    titel: 'Mitglieder ändern ihre Bankverbindung selbst',
    text: 'Wusstest du schon, dass deine Mitglieder ihre IBAN/SEPA-Bankverbindung selbst in der App ändern können (Meine Beiträge → Zahlungsmethoden)? Das spart dir Rückfragen und Tippfehler bei Rückläufern.',
  },
  {
    id: 3,
    kategorie: 'Auswertung',
    icon: '📈',
    titel: 'Prognose-Dashboard nutzen',
    text: 'Wusstest du schon, dass es ein Prognose-Dashboard gibt, das Mitglieder- und Umsatzentwicklung hochrechnet? So siehst du früh, wohin sich deine Schule bewegt.',
  },
  {
    id: 4,
    kategorie: 'Team',
    icon: '🔐',
    titel: 'Mitarbeiter mit passenden Rechten anlegen',
    text: 'Wusstest du schon, dass du Mitarbeitern feingranulare Rollen geben kannst (z. B. Kassenwart, Prüfer, Rezeption)? Unter Einstellungen → „Mitarbeiter & Rechte" bekommt jeder genau die Bereiche, die er braucht – und sonst nichts.',
  },
  {
    id: 5,
    kategorie: 'Neukunden',
    icon: '🥋',
    titel: 'Probetraining zur Selbstbuchung anbieten',
    text: 'Wusstest du schon, dass Interessenten ihr Probetraining selbst über einen Link/QR-Code buchen können? Sie bekommen automatisch eine Bestätigungsmail, du hast den Termin direkt im System.',
  },
  {
    id: 6,
    kategorie: 'Marketing',
    icon: '📺',
    titel: 'Werbe-Bildschirm fürs Schaufenster',
    text: 'Wusstest du schon, dass du einen Werbe-/Signage-Bildschirm für dein Schaufenster oder den Eingangsbereich einrichten kannst? Ein einfacher Browser-Tab zeigt deine Angebote in Dauerschleife.',
  },
  {
    id: 7,
    kategorie: 'Team',
    icon: '📱',
    titel: 'Trainer-App (Coach-App)',
    text: 'Wusstest du schon, dass deine Trainer eine eigene PWA haben? Sie sehen ihre Stunden, sagen Vertretungen zu oder Trainingszeiten ab – ohne Zugang zum vollen Admin-Bereich.',
  },
  {
    id: 8,
    kategorie: 'Marketing',
    icon: '🌐',
    titel: 'Eigene Homepage pro Schule bauen',
    text: 'Wusstest du schon, dass du mit dem Homepage-Builder eine eigene Landingpage für deine Subdomain zusammenklicken kannst (Hero, Stile, Stundenplan, Call-to-Action)? Besucher landen unter „/willkommen".',
  },
  {
    id: 9,
    kategorie: 'Kommunikation',
    icon: '💬',
    titel: 'WhatsApp als Chat-Kanal',
    text: 'Wusstest du schon, dass sich WhatsApp als Nachrichten-Kanal anbinden lässt (Enterprise)? Mitglieder-Kommunikation läuft dann direkt über den Messenger.',
  },
  {
    id: 10,
    kategorie: 'Organisation',
    icon: '📨',
    titel: 'Jede Kundenmail landet im Archiv',
    text: 'Wusstest du schon, dass alle an Kunden versendeten System-Mails automatisch als Kopie am jeweiligen Konto archiviert werden? So kannst du jederzeit nachvollziehen, wer wann was bekommen hat.',
  },
  {
    id: 11,
    kategorie: 'Prüfungen',
    icon: '📜',
    titel: 'Urkunden selbst gestalten',
    text: 'Wusstest du schon, dass du im Urkunden-Vorlagen-Editor per Drag & Drop eigene Urkunden layouten kannst? Namen, Grade und Datum werden beim Druck automatisch eingesetzt.',
  },
  {
    id: 12,
    kategorie: 'Verträge',
    icon: '⏸️',
    titel: 'Ruhepause verlängert den Vertrag automatisch',
    text: 'Wusstest du schon, dass eine eingetragene Ruhepause das Vertragsende automatisch um die Pausendauer nach hinten schiebt? Du musst das Enddatum nicht mehr von Hand korrigieren.',
  },
  {
    id: 13,
    kategorie: 'Mitglieder',
    icon: '👨‍👩‍👧',
    titel: 'Familien & Familienrabatt',
    text: 'Wusstest du schon, dass du Familienmitglieder verknüpfen und einen Familienrabatt hinterlegen kannst? Adresse und Bankdaten übernimmt das System vom Hauptmitglied.',
  },
  {
    id: 14,
    kategorie: 'Check-in',
    icon: '✅',
    titel: 'Check-in nach Stil und Alter filtern',
    text: 'Wusstest du schon, dass der Check-in den Mitgliedern zuerst die zu ihrem Stil und Alter passenden Kurse zeigt? Das reduziert Fehl-Check-ins spürbar (Einstellungen → Check-in).',
  },
  {
    id: 15,
    kategorie: 'Kommunikation',
    icon: '📣',
    titel: 'Schnell-Ansage bei kurzfristigen Änderungen',
    text: 'Wusstest du schon, dass du mit der Schnell-Ansage kurzfristige Trainingszeit-Änderungen oder Ausfälle in Sekunden an die Betroffenen ausspielen kannst?',
  },
  {
    id: 16,
    kategorie: 'Organisation',
    icon: '📅',
    titel: 'Fremdtermine im Kalender mit Konflikt-Check',
    text: 'Wusstest du schon, dass du Verbands-/Fremdtermine in den Kalender eintragen kannst und das System dich bei Terminkonflikten warnt?',
  },
  {
    id: 17,
    kategorie: 'Finanzen',
    icon: '🧾',
    titel: 'Rechnungen im DIN-5008-Layout',
    text: 'Wusstest du schon, dass deine Rechnungen fensterkuvert-tauglich sind und einen Zahl-QR-Code enthalten? Empfänger können per Banking-App scannen statt IBAN abzutippen.',
  },
  {
    id: 18,
    kategorie: 'Design',
    icon: '🎨',
    titel: 'Eigenes Farb-/Design-Theme',
    text: 'Wusstest du schon, dass du das Erscheinungsbild deiner Schule über das Theme-System an deine Farben anpassen kannst? Deine Mitglieder-App wirkt dann wie aus einem Guss.',
  },
  {
    id: 19,
    kategorie: 'Sicherheit',
    icon: '🛡️',
    titel: 'Selbst-Diagnose im Sicherheits-Panel',
    text: 'Wusstest du schon, dass es ein Sicherheits-Panel gibt (System → Integrität), das Mandanten-Trennung, Modul-Gesundheit und Konfiguration selbst prüft und dich bei Auffälligkeiten alarmiert?',
  },
  {
    id: 20,
    kategorie: 'Neukunden',
    icon: '🤖',
    titel: 'KI-Chat für Website-Besucher',
    text: 'Wusstest du schon, dass ein KI-Assistent auf deiner Homepage Besucherfragen beantworten kann (als KI offengelegt)? Er nimmt dir Standard-Anfragen ab und leitet zu Probetraining/Anmeldung.',
  },
  {
    id: 21,
    kategorie: 'Finanzen',
    icon: '💡',
    titel: 'AG-Monatsabrechnung automatisch',
    text: 'Wusstest du schon, dass die Monatsabrechnung für Schul-AGs automatisch aus Wochentagen minus Ferien und Feiertagen berechnet wird? Du findest sie unter den Rechnungen.',
  },
  {
    id: 22,
    kategorie: 'Auswertung',
    icon: '🎂',
    titel: 'Geburtstage & auslaufende Verträge im Blick',
    text: 'Wusstest du schon, dass dir das Dashboard Geburtstage, auslaufende Verträge, offene Mahnungen und fehlgeschlagene Lastschriften als Hinweise oben einblendet? Ein schneller Blick genügt.',
  },
  {
    id: 23,
    kategorie: 'Mitglieder',
    icon: '📥',
    titel: 'Bestandsdaten per CSV importieren',
    text: 'Wusstest du schon, dass du bestehende Mitglieder per CSV importieren kannst – inklusive Erkennung von Umlauten/Excel-Kodierung und Duplikat-Prüfung?',
  },
  {
    id: 24,
    kategorie: 'Planung',
    icon: '📊',
    titel: 'Businessplan & Ziele-Board',
    text: 'Wusstest du schon, dass es ein Businessplan-Modul mit Finanzplanung, PDF-Export und einem Ziele-Board gibt? Ideal, um Wachstum zu planen und Ziele zu verfolgen.',
  },
  {
    id: 25,
    kategorie: 'Buchhaltung',
    icon: '🏦',
    titel: 'Kontoauszug per Bank-Import einlesen',
    text: 'Wusstest du schon, dass du deine Kontoumsätze in die Buchhaltung importieren kannst, statt jede Zahlung von Hand zu erfassen? Das System liest den Auszug ein und legt die Umsätze zum Zuordnen bereit.',
  },
  {
    id: 26,
    kategorie: 'Buchhaltung',
    icon: '🔗',
    titel: 'Zahlungen automatisch zuordnen',
    text: 'Wusstest du schon, dass importierte Bankumsätze automatisch mit offenen Beiträgen und Rechnungen abgeglichen werden? Passende Zahlungen werden vorgeschlagen – du bestätigst nur noch, statt manuell zu suchen.',
  },
  {
    id: 27,
    kategorie: 'Buchhaltung',
    icon: '📑',
    titel: 'EÜR auf Knopfdruck',
    text: 'Wusstest du schon, dass du dir jederzeit eine Einnahmen-Überschuss-Rechnung (EÜR) erzeugen lassen kannst? Einnahmen und Ausgaben werden nach Kategorien ausgewertet – ideal fürs Finanzamt und den Steuerberater.',
  },
  {
    id: 28,
    kategorie: 'Buchhaltung',
    icon: '⏰',
    titel: 'Offene Posten & Mahnwesen im Blick',
    text: 'Wusstest du schon, dass dir die Buchhaltung offene Posten anzeigt und beim Mahnwesen unterstützt? So siehst du auf einen Blick, welche Beiträge und Rechnungen noch nicht bezahlt sind.',
  },
  {
    id: 29,
    kategorie: 'Buchhaltung',
    icon: '📚',
    titel: 'Ausgaben, Kreditoren & wiederkehrende Buchungen',
    text: 'Wusstest du schon, dass du in der Buchführung auch Ausgaben, Kreditoren, Anlagevermögen und wiederkehrende Buchungen erfassen kannst? Damit hast du nicht nur die Einnahmen, sondern deine komplette Finanzlage im Griff.',
  },
];

module.exports = { ADMIN_TIPPS };
