# API Service Migration Guide

## Übersicht

Die zentrale API-Service-Schicht (`services/api.js`) konsolidiert alle Backend-Aufrufe an einem Ort.

## Vorteile

- ✅ **Zentrale Fehlerbehandlung** - Automatisches Token-Handling, 401 Redirects
- ✅ **Type-Safety** - Klare API-Methoden statt string URLs
- ✅ **Wartbarkeit** - Änderungen nur an einem Ort
- ✅ **Testing** - Einfacher zu mocken
- ✅ **Konsistenz** - Gleiche Patterns überall

## Migration

### Vorher (Direkter axios-Call)

```javascript
import axios from 'axios';
import config from '../config/config';

const fetchMitglieder = async () => {
  try {
    const token = localStorage.getItem('authToken');
    const response = await axios.get(`${config.apiUrl}/mitglieder`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    console.error('Error fetching mitglieder:', error);
    throw error;
  }
};
```

**Probleme:**
- Wiederholter Code (Token-Handling, Error-Handling)
- Hardcodierte URLs
- Fehleranfällig

### Nachher (Mit API Service)

```javascript
import api from '../services/api';

const fetchMitglieder = async () => {
  try {
    const response = await api.mitglieder.getAll();
    return response.data;
  } catch (error) {
    console.error('Error fetching mitglieder:', error);
    throw error;
  }
};
```

**Vorteile:**
- Kürzer und cleaner
- Automatisches Token-Handling
- Automatisches Error-Handling
- Type-Hints in modernen IDEs

## Verfügbare API-Methoden

### Auth
```javascript
api.auth.login({ email, password })
api.auth.tokenLogin(token)
api.auth.logout()
api.auth.resetPassword(email)
api.auth.changePassword({ oldPassword, newPassword })
```

### Mitglieder
```javascript
api.mitglieder.getAll({ status: 'aktiv', page: 1 })
api.mitglieder.getById(id)
api.mitglieder.create(data)
api.mitglieder.update(id, data)
api.mitglieder.delete(id)
api.mitglieder.search(query)
api.mitglieder.getStatistics(id)
api.mitglieder.getFortschritt(id)
```

### Verträge
```javascript
api.vertraege.getAll()
api.vertraege.getById(id)
api.vertraege.getByMitglied(mitgliedId)
api.vertraege.create(data)
api.vertraege.update(id, data)
api.vertraege.kuendigen(id, { grund, datum })
```

### Transaktionen
```javascript
api.transaktionen.getAll({ von: '2024-01-01', bis: '2024-12-31' })
api.transaktionen.getByMitglied(mitgliedId)
api.transaktionen.create(data)
api.transaktionen.exportSepa(params)
```

### Prüfungen
```javascript
api.pruefungen.getAll()
api.pruefungen.getByMitglied(mitgliedId)
api.pruefungen.create(data)
api.pruefungen.anmelden({ mitgliedId, pruefungId })
```

### Notifications
```javascript
api.notifications.getAll()
api.notifications.markAsRead(id)
api.notifications.markAllAsRead()
api.notifications.send({ recipient, message })
```

### Dashboard
```javascript
api.dashboard.getStatistics()
api.dashboard.getRecentActivity()
api.dashboard.getChartData('revenue')
```

## React Hook Pattern

### Custom Hook für API-Calls

```javascript
// hooks/useMitglieder.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export const useMitglieder = (filter = {}) => {
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.mitglieder.getAll(filter);
        setMitglieder(response.data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [JSON.stringify(filter)]);

  return { mitglieder, loading, error };
};
```

### Verwendung im Component

```javascript
import { useMitglieder } from '../hooks/useMitglieder';

function MitgliederListe() {
  const { mitglieder, loading, error } = useMitglieder({ status: 'aktiv' });

  if (loading) return <div>Laden...</div>;
  if (error) return <div>Fehler: {error}</div>;

  return (
    <ul>
      {mitglieder.map(m => (
        <li key={m.id}>{m.vorname} {m.nachname}</li>
      ))}
    </ul>
  );
}
```

## Error Handling

Der API-Service handhabt automatisch:

### 401 Unauthorized
```javascript
// Automatischer Logout und Redirect zu /login
// Kein manueller Code nötig!
```

### 403 Forbidden
```javascript
// Automatisches Error-Logging
// Optional: Custom Handler hinzufügen
```

### 500 Server Errors
```javascript
// Automatisches Error-Logging
// Error wird trotzdem propagiert für Custom-Handling
```

### Custom Error Handling

```javascript
try {
  await api.mitglieder.create(data);
} catch (error) {
  if (error.response?.status === 400) {
    // Validierungsfehler
    setFormErrors(error.response.data.errors);
  } else if (error.response?.status === 409) {
    // Konflikt (z.B. Email bereits vergeben)
    alert('Email bereits vergeben');
  } else {
    // Andere Fehler
    console.error('Unexpected error:', error);
  }
}
```

## File Uploads

```javascript
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await apiClient.post('/uploads', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};
```

## Downloads (z.B. SEPA Export)

```javascript
const downloadSepaExport = async (params) => {
  try {
    const response = await api.transaktionen.exportSepa(params);
    
    // Erstelle Blob und Download
    const blob = new Blob([response.data], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sepa_export.xml';
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download failed:', error);
  }
};
```

## Migration Checkliste

Für jeden Component:

- [ ] Import `api` aus `services/api`
- [ ] Ersetze `axios.get(...)` durch `api.resource.method(...)`
- [ ] Entferne manuelle Token-Handling
- [ ] Entferne manuelle 401-Redirects
- [ ] Teste die Funktionalität
- [ ] Git Commit

## Beispiel-Migration

### MitgliederListe.jsx (Vorher)

```javascript
const [mitglieder, setMitglieder] = useState([]);

useEffect(() => {
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${config.apiUrl}/mitglieder`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMitglieder(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('authToken');
        navigate('/login');
      }
    }
  };
  fetchData();
}, []);
```

### MitgliederListe.jsx (Nachher)

```javascript
import api from '../services/api';

const [mitglieder, setMitglieder] = useState([]);

useEffect(() => {
  const fetchData = async () => {
    try {
      const response = await api.mitglieder.getAll();
      setMitglieder(response.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };
  fetchData();
}, []);
```

**50% weniger Code!** ✨

## Next Steps

1. Migriere kritische Components zuerst (Dashboard, MitgliederListe)
2. Erstelle Custom Hooks für häufige Patterns
3. Entferne alte axios-Imports
4. Update Tests

## Performance

API-Service hat **null Overhead** - es ist nur ein Wrapper um axios mit Best Practices.
