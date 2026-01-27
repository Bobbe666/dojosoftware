# MitgliedDetailShared.jsx Refactoring Plan

## Übersicht
Die Datei hatte ursprünglich **10.336 Zeilen** und wird schrittweise in kleinere Komponenten aufgeteilt.

**Aktueller Stand:** 9.931 Zeilen (405 Zeilen extrahiert)

**WICHTIG:** Die Komponente wird sowohl von Admin als auch Member verwendet. Jede extrahierte Komponente MUSS die `isAdmin`/`editMode`-Prop erhalten und entsprechend unterschiedliche Inhalte anzeigen.

---

## Tab-Struktur (Priorität nach Größe)

| Priorität | Tab | Zeilen | Vorgeschlagener Name | Status |
|-----------|-----|--------|---------------------|--------|
| 1 | Finanzen | ~1.039 | `MemberFinanceTab.jsx` | Pending |
| 2 | Dokumente | ~938 | `MemberDocumentTab.jsx` | Pending |
| 3 | Vertrag | ~650 | `MemberContractTab.jsx` | Pending |
| 4 | Allgemein | ~611 | `MemberGeneralInfoTab.jsx` | Pending |
| 5 | Statistiken | ~446 | `MemberStatisticsTab.jsx` | Pending |
| 6 | Gurt & Stil | ~416 | `MemberStyleTab.jsx` | Pending |
| 7 | Familie | ~380 | `MemberFamilyTab.jsx` | Pending |
| 8 | Medizinisch | ~321 | `MemberMedicalTab.jsx` | Pending |
| 9 | Zusatzdaten | ~201 | `MemberAdditionalDataTab.jsx` | **DONE** |
| 10 | Sicherheit | ~146 | `MemberSecurityTab.jsx` | **DONE** |

## Große Modals (separate Extraktion)

| Modal | Zeilen | Vorgeschlagener Name |
|-------|--------|---------------------|
| Kündigungsmodal | ~1.409 | `ContractTerminationModal.jsx` |
| Neuer Vertrag | ~177 | `NewContractModal.jsx` |
| Ruhepause | ~88 | `ContractPauseModal.jsx` |
| Archivieren | ~257 | `ArchiveMemberModal.jsx` |

---

## Gemeinsame Props für alle Tab-Komponenten

```jsx
// Basis-Props die jede Tab-Komponente braucht:
const commonTabProps = {
  // Identifikation
  id: mitgliedId,           // Mitglied-ID
  mitglied: mitgliedObjekt, // Volle Mitglied-Daten

  // Berechtigungen
  isAdmin: boolean,         // Admin vs. Member Ansicht
  editMode: boolean,        // Bearbeitungsmodus aktiv

  // Dojo-Kontext
  dojoId: number,           // Aktives Dojo

  // Callbacks
  onUpdate: () => void,     // Nach Änderungen aufrufen
  onError: (msg) => void,   // Fehlerbehandlung
};
```

---

## Schritt-für-Schritt Refactoring

### Phase 1: Kleine, eigenständige Komponenten zuerst
1. `MemberSecurityTab.jsx` (146 Zeilen) - Am einfachsten
2. `MemberAdditionalDataTab.jsx` (201 Zeilen)
3. `MemberMedicalTab.jsx` (321 Zeilen)

### Phase 2: Mittlere Komplexität
4. `MemberFamilyTab.jsx` (380 Zeilen)
5. `MemberStyleTab.jsx` (416 Zeilen)
6. `MemberStatisticsTab.jsx` (446 Zeilen)

### Phase 3: Große, komplexe Tabs
7. `MemberGeneralInfoTab.jsx` (611 Zeilen)
8. `MemberContractTab.jsx` (650 Zeilen)
9. `MemberDocumentTab.jsx` (938 Zeilen)
10. `MemberFinanceTab.jsx` (1.039 Zeilen)

### Phase 4: Modals extrahieren
11. `ContractTerminationModal.jsx` (1.409 Zeilen) - Kritisch!
12. Weitere Modals...

---

## Zielstruktur

```
frontend/src/components/
├── MitgliedDetailShared.jsx          # Hauptkomponente (~1.500 Zeilen)
├── mitglied-detail/
│   ├── index.js                      # Re-exports
│   ├── REFACTORING.md                # Diese Dokumentation
│   │
│   ├── tabs/
│   │   ├── MemberSecurityTab.jsx
│   │   ├── MemberGeneralInfoTab.jsx
│   │   ├── MemberMedicalTab.jsx
│   │   ├── MemberFamilyTab.jsx
│   │   ├── MemberContractTab.jsx
│   │   ├── MemberFinanceTab.jsx
│   │   ├── MemberDocumentTab.jsx
│   │   ├── MemberStyleTab.jsx
│   │   ├── MemberStatisticsTab.jsx
│   │   └── MemberAdditionalDataTab.jsx
│   │
│   ├── modals/
│   │   ├── ContractTerminationModal.jsx
│   │   ├── ContractPauseModal.jsx
│   │   ├── NewContractModal.jsx
│   │   └── ArchiveMemberModal.jsx
│   │
│   └── shared/
│       ├── FinanceKPICard.jsx
│       ├── ContractCard.jsx
│       └── DocumentChecklist.jsx
```

---

## Wichtige Hinweise

### Admin vs. Member Ansichten

```jsx
// Beispiel: Im Finance-Tab
{isAdmin && (
  <section className="admin-only-section">
    <h3>SEPA-Verwaltung</h3>
    {/* Nur für Admins sichtbar */}
  </section>
)}

{!isAdmin && (
  <div className="member-finance-view">
    {/* Vereinfachte Ansicht für Mitglieder */}
  </div>
)}
```

### State-Management

Viele State-Variablen werden zwischen Tabs geteilt. Bei der Extraktion:
1. Gemeinsamen State im Parent behalten
2. State-Updates über Callbacks handhaben
3. Oder: Custom Hooks für geteilte Logik erstellen

```jsx
// Beispiel Custom Hook
export function useMemberFinance(mitgliedId) {
  const [finanzDaten, setFinanzDaten] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadFinanzDaten = useCallback(async () => {
    // ...
  }, [mitgliedId]);

  return { finanzDaten, loading, loadFinanzDaten };
}
```

---

## Testplan nach Extraktion

1. **Admin-Ansicht testen**
   - Alle Tabs durchklicken
   - Bearbeitungsmodus aktivieren
   - Speichern/Abbrechen testen

2. **Member-Ansicht testen**
   - Eigenes Profil anzeigen
   - Sicherheits-Tab (Passwort ändern)
   - Keine Admin-Features sichtbar

3. **Mobile Responsiveness**
   - Tabs auf Mobile
   - Formulare auf Mobile

---

*Erstellt: 2026-01-27*
*Letzte Aktualisierung: Automatisch bei Änderungen*
