# CSS Naming Convention - BEM für DojoSoftware

## Problem
Globale CSS-Selektoren wie `.card-header`, `.btn-primary`, `.form-group` überschreiben sich gegenseitig
und führen zu unvorhersehbaren Styling-Konflikten.

## Lösung: BEM (Block Element Modifier)

### Namensschema
```
.block__element--modifier
```

- **Block**: Eigenständige Komponente (z.B. `anwesenheit`, `finanzcockpit`)
- **Element**: Teil eines Blocks, durch `__` getrennt (z.B. `anwesenheit__card`)
- **Modifier**: Variante/Zustand, durch `--` getrennt (z.B. `anwesenheit__card--active`)

### Beispiele

#### Vorher (Konflikte)
```css
/* In Anwesenheit.css */
.card-header { background: #1a1a2e; }

/* In Events.css - überschreibt das obige! */
.card-header { background: #2d2d44; }
```

#### Nachher (BEM)
```css
/* In Anwesenheit.css */
.anwesenheit__card-header { background: #1a1a2e; }

/* In Events.css - kein Konflikt */
.events__card-header { background: #2d2d44; }
```

### Komponenten-Präfixe

| Komponente | Präfix | Beispiel |
|------------|--------|----------|
| Anwesenheit | `anwesenheit__` | `.anwesenheit__stat-card` |
| Dashboard | `dashboard__` | `.dashboard__kpi-card` |
| Finanzcockpit | `finanzcockpit__` | `.finanzcockpit__chart` |
| MitgliedDetail | `mitglied__` | `.mitglied__tab-content` |
| Events | `events__` | `.events__card-header` |
| Kurse | `kurse__` | `.kurse__schedule-item` |
| Stundenplan | `stundenplan__` | `.stundenplan__time-slot` |
| Personal | `personal__` | `.personal__list-item` |
| Einstellungen | `einstellungen__` | `.einstellungen__form-group` |
| Checkin | `checkin__` | `.checkin__member-card` |

### Gemeinsame Utility-Klassen

Für wirklich gemeinsame Styles, die überall gleich sein sollen, nutze das `u-` Präfix:

```css
/* In designsystem.css */
.u-flex { display: flex; }
.u-text-center { text-align: center; }
.u-mb-1 { margin-bottom: 0.5rem; }
.u-hidden { display: none; }
```

### CSS-Variablen für Konsistenz

Nutze CSS-Variablen statt harter Werte:

```css
:root {
  /* Farben */
  --color-primary: #FFD700;
  --color-secondary: #4ECDC4;
  --color-danger: #ff4757;
  --color-success: #2ed573;

  /* Hintergründe */
  --bg-card: rgba(255, 255, 255, 0.05);
  --bg-card-hover: rgba(255, 255, 255, 0.08);

  /* Abstände */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Schatten */
  --shadow-sm: 0 2px 4px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 8px rgba(0,0,0,0.15);
  --shadow-lg: 0 8px 16px rgba(0,0,0,0.2);
}
```

### Migration bestehender Styles

1. **Neue Komponenten**: Immer BEM verwenden
2. **Bestehende Komponenten**: Schrittweise migrieren
3. **Priorität**: Komponenten mit den meisten Konflikten zuerst

### Beispiel: Anwesenheit.css Migration

```css
/* ALT */
.stat-card { ... }
.stat-value { ... }
.stat-label { ... }
.card-header { ... }

/* NEU */
.anwesenheit__stat-card { ... }
.anwesenheit__stat-value { ... }
.anwesenheit__stat-label { ... }
.anwesenheit__card-header { ... }
```

### Checkliste für neue CSS

- [ ] Komponenten-Präfix verwendet?
- [ ] Keine globalen Selektoren (`.card`, `.btn`)?
- [ ] CSS-Variablen für Farben/Abstände?
- [ ] Kein `!important` (außer für Overrides)?
- [ ] Responsive Breakpoints am Ende der Datei?
