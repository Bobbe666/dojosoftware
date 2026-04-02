# Buchhaltung & Bank-Import

## Übersicht

| Modul | Feature-Gate | Route-Datei |
|-------|-------------|-------------|
| Kassenbuch / Belege / EÜR-Basis | `buchfuehrung` (Premium) | `buchhaltung.js` |
| Bank-Import + Steuerauswertung | `kontoauszug` (Enterprise) | `buchhaltung.js` |
| EÜR für Dojos | `buchfuehrung` | `euer.js` |

## Bank-Import — unterstützte Formate & Banken

**Formate:** CSV, XLSX/XLS, MT940/STA

**Banken (Auto-Erkennung via Header-Signatur):**
- ING, DKB (alt + neu), Comdirect, N26
- Deutsche Bank, Postbank
- Sparkasse (2 Varianten), Volksbank/Raiffeisenbank
- Generic-Fallback für unbekannte Banken

## Auto-Kategorisierung

`autoKategorisieren(verwendungszweck, auftraggeber)` in `buchhaltung.js`

20 Kategorien, Kampfkunstschule-spezifisch:
- Einnahmen: Mitgliedsbeiträge, Prüfungsgebühren, Seminargebühren, Shopverkäufe, Spenden
- Ausgaben: Miete/Hallenmiete, Strom, Wasser, Versicherungen, Sportmaterial,
  Verbandsbeiträge, Büro/IT, Steuerberater, Marketing, Fortbildung, Fahrtkosten,
  Trainer-Honorare, Bankgebühren, Transfers

Ergebnis wird in `bank_transaktionen.auto_kategorie` + `auto_kategorie_typ` + `auto_kategorie_euer` gespeichert.

## Auto-Matching (runAutoMatching)

4-stufig, in Reihenfolge:
1. **Rechnungsnummer** im Verwendungszweck (Confidence 0.95) → `rechnungen`
2. **Mitgliedsnummer** im Verwendungszweck (0.85) → `beitraege`
3. **Name + Betrag** (0.75) → `beitraege`
3b. **Verkauf** (0.82) → `verkaeufe` (Datum ±2 Tage + Betrag)
3c. **Verbandsbeitrag** (0.72) → Keyword-Erkennung
4. **Gelernte Regeln** (0.70) → `bank_zuordnung_regeln`

Bei Confidence ≥ 0.5 → `status = 'vorgeschlagen'`, `match_typ`, `match_id`, `match_details` gesetzt.

## Doppelzählung vermeiden (wichtig!)

Die EÜR-Views aggregieren bereits:
- `v_euer_einnahmen`: `buchhaltung_belege` + bezahlte `rechnungen` + `beitraege` + `verkaeufe`
- `v_euer_ausgaben`: `buchhaltung_belege` (Ausgaben)
- `v_bilanz_bank_bestand`: `bank_transaktionen` WHERE `status IN ('zugeordnet','ignoriert')`

**Regel:** Beim `euer-uebertragen` werden Bank-Transaktionen mit `match_typ IN ('rechnung','beitrag','verkauf')` NICHT als neue Belege übertragen — sie sind bereits via ihre Quelltabelle in der EÜR!

Nur Transaktionen mit `match_typ = NULL` oder `match_typ = 'manuell'` (+ Auto-Kategorie gesetzt) werden als neue `buchhaltung_belege` übertragen.

## Datenbanktabellen

### bank_transaktionen
Haupttabelle für importierte Buchungen.
```
transaktion_id, import_id, import_datum, import_datei, import_format
dojo_id, organisation_name
buchungsdatum, valutadatum, betrag, waehrung
verwendungszweck, auftraggeber_empfaenger, iban_gegenkonto, bic
buchungstext, mandatsreferenz, kundenreferenz
status (unzugeordnet|vorgeschlagen|zugeordnet|ignoriert)
kategorie (alte ENUM, SKR03)
match_typ, match_id, match_confidence, match_details (JSON)
beleg_id (FK → buchhaltung_belege)
hash_key (SHA256 für Duplikaterkennung)
auto_kategorie, auto_kategorie_typ, auto_kategorie_euer  ← neu (Migration 072)
```

### bank_euer_zuordnungen (Migration 072)
Verknüpft bank_transaktionen mit EÜR-Kategorien nach der Übertragung.

### bank_kategorien + bank_kategorie_regeln (Migration 072)
Dojo-spezifische Kategorien und Keyword-Regeln.

### buchhaltung_belege
Zentrale Buchungs-Tabelle für EÜR.
Neue Felder (Migration 072): `extern_ref_id` (transaktion_id), `quelle` (manual|bank_import|auto)

### Duplikaterkennung
`hash_key = SHA256(buchungsdatum + betrag + verwendungszweck[:100])`
Vor dem Insert geprüft — doppelte Importe werden übersprungen.

## GuV und Bilanz

Nutzen DB-Views (existieren auf Server):
- `v_guv_daten`, `v_guv_einnahmen_grouped`, `v_guv_ausgaben_grouped`
- `v_euer_einnahmen`, `v_euer_ausgaben`, `v_euer_privat`
- `v_bilanz_bank_bestand`, `v_bilanz_forderungen`, `v_bilanz_eigenkapital`

GuV-Route: `/buchhaltung/guv/details` (KEIN `/api/`-Prefix!)
Bilanz-Route: `/buchhaltung/bilanz` (KEIN `/api/`-Prefix!)

## Migration 072

```
backend/migrations/072_add_kontoauszug_enterprise.sql
```
- `feature_kontoauszug` in `dojo_subscriptions` + `subscription_plans`
- Neue Spalten in `bank_transaktionen` (auto_kategorie*)
- `import_format` ENUM erweitert (excel, ofx, qif)
- `extern_ref_id` + `quelle` in `buchhaltung_belege`
- Neue Tabellen: `bank_kategorien`, `bank_kategorie_regeln`, `bank_euer_zuordnungen`
