# Dojosoftware — CLAUDE.md

Hauptprojekt: Kampfkunstschule-Management-Software mit Multi-Tenant-Architektur.

## Lokale Entwicklung

```
Lokal:   /Users/schreinersascha/dojosoftware/
GitHub:  git@github.com:Bobbe666/dojosoftware.git (main)
Workflow: lokal ändern → testen → git commit → git push → deploy
```

> **Niemals direkt auf dem Server editieren.**

## Projektstruktur

```
dojosoftware/
├── frontend/        React + Vite (Port 5173 lokal)
└── backend/         Node.js + Express (Port 5001)
    ├── routes/      API-Routen (eine Datei pro Thema)
    ├── middleware/  Auth, FeatureAccess, TenantSecurity
    ├── migrations/  SQL-Migrations (nummeriert: 001–072)
    └── db.js        mysql2-Pool
```

## Deploy

→ Siehe [deploy.md](deploy.md) für alle Deploy-Befehle.

## API-Routen

→ Siehe [api.md](api.md) für alle Endpunkte und wichtige Regeln.

## Architektur & kritische Bugs

→ Siehe [architektur.md](architektur.md) für Multi-Tenant, Feature-Flags, bekannte Fallen.

## Buchhaltung / Bank-Import (Enterprise)

→ Siehe [buchhaltung.md](buchhaltung.md) für EÜR, Bank-Import, Abgleich-Logik.
