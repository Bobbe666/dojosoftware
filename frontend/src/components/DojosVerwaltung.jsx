import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Edit, Trash2 } from 'lucide-react';
import '../styles/DojosVerwaltung.css';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const DojosVerwaltung = () => {
  const navigate = useNavigate();

  // 🔧 DEVELOPMENT MODE: Mock-Daten für lokale Entwicklung
  const isDevelopment = import.meta.env.MODE === 'development';

  const mockDojos = [
    {
      id: 1,
      dojoname: 'Dojo Hamburg',
      inhaber: 'Max Mustermann',
      farbe: '#FFD700',
      ist_hauptdojo: true,
      steuer_status: 'kleinunternehmer',
      kleinunternehmer_grenze: 22000,
      jahresumsatz_aktuell: 15000,
      ust_satz: 19,
      strasse: 'Beispielstraße',
      hausnummer: '123',
      plz: '20095',
      ort: 'Hamburg',
      land: 'Deutschland',
      telefon: '+49 40 12345678',
      email: 'info@dojo-hamburg.de',
      website: 'www.dojo-hamburg.de'
    },
    {
      id: 2,
      dojoname: 'Dojo Berlin',
      inhaber: 'Anna Schmidt',
      farbe: '#3B82F6',
      ist_hauptdojo: false,
      steuer_status: 'regelbesteuert',
      kleinunternehmer_grenze: 22000,
      jahresumsatz_aktuell: 35000,
      ust_satz: 19,
      strasse: 'Alexanderplatz',
      hausnummer: '1',
      plz: '10178',
      ort: 'Berlin',
      land: 'Deutschland',
      telefon: '+49 30 98765432',
      email: 'kontakt@dojo-berlin.de',
      website: 'www.dojo-berlin.de'
    }
  ];

  const mockStatistics = {
    dojos_anzahl: 2,
    mitglieder_gesamt: 127,
    umsatz_gesamt: 50000,
    ust_gesamt: 6650
  };

  const [dojos, setDojos] = useState(isDevelopment ? mockDojos : []);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [statistics, setStatistics] = useState(isDevelopment ? mockStatistics : null);

  useEffect(() => {
    loadDojos();
    loadGesamtStatistiken();
  }, []);

  const loadDojos = async () => {
    // 🔧 DEVELOPMENT MODE: Mock-Daten verwenden
    if (isDevelopment) {
      console.log('🔧 Development Mode: Verwende Mock-Dojos für DojosVerwaltung');
      setDojos(mockDojos);
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/dojos`);
      if (!response.ok) throw new Error('Fehler beim Laden der Dojos');
      const data = await response.json();
      setDojos(data);
    } catch (error) {
      setMessage('Fehler beim Laden der Dojos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadGesamtStatistiken = async () => {
    // 🔧 DEVELOPMENT MODE: Mock-Daten verwenden
    if (isDevelopment) {
      console.log('🔧 Development Mode: Verwende Mock-Statistiken');
      setStatistics(mockStatistics);
      return;
    }

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/dojos/statistics/gesamt`);
      if (!response.ok) throw new Error('Fehler beim Laden der Statistiken');
      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Möchten Sie dieses Dojo wirklich deaktivieren?')) return;

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/dojos/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      setMessage('Dojo erfolgreich deaktiviert');
      loadDojos();
    } catch (error) {
      setMessage(`Fehler: ${error.message}`);
    }
  };

  const getStatusBadge = (dojo) => {
    if (dojo.steuer_status === 'kleinunternehmer') {
      const prozent = (dojo.jahresumsatz_aktuell / dojo.kleinunternehmer_grenze) * 100;
      if (prozent >= 100) {
        return <span className="badge badge-danger">Grenze überschritten</span>;
      } else if (prozent >= 80) {
        return <span className="badge badge-warning">{prozent.toFixed(0)}% erreicht</span>;
      } else {
        return <span className="badge badge-success">Kleinunternehmer</span>;
      }
    } else {
      return <span className="badge badge-info">USt-pflichtig ({dojo.ust_satz}%)</span>;
    }
  };

  return (
    <div className="dojos-verwaltung">
      <div className="page-header">
        <h1>Multi-Dojo-Verwaltung</h1>
        <p>Verwalten Sie mehrere Geschäfte mit separater Steuerverwaltung</p>
        <button className="btn-primary" onClick={() => navigate('/dashboard/dojos/new')}>
          <Plus size={20} />
          Neues Dojo hinzufügen
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('erfolgreich') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {/* Gesamt-Statistiken */}
      {statistics && (
        <div className="gesamt-statistiken">
          <h2>Gesamt-Übersicht (alle Dojos)</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🏢</div>
              <div className="stat-content">
                <div className="stat-value">{statistics.dojos_anzahl}</div>
                <div className="stat-label">Aktive Dojos</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <div className="stat-value">{statistics.mitglieder_gesamt}</div>
                <div className="stat-label">Mitglieder gesamt</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-content">
                <div className="stat-value">{parseFloat(statistics.umsatz_gesamt || 0).toLocaleString('de-DE')} EUR</div>
                <div className="stat-label">Gesamtumsatz {new Date().getFullYear()}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🧾</div>
              <div className="stat-content">
                <div className="stat-value">{parseFloat(statistics.ust_gesamt || 0).toLocaleString('de-DE')} EUR</div>
                <div className="stat-label">USt zu zahlen</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dojos-Liste */}
      <div className="dojos-list">
        <h2>Ihre Dojos</h2>
        {loading ? (
          <div className="loading">Laden...</div>
        ) : dojos.length === 0 ? (
          <div className="empty-state">
            <Building2 size={64} />
            <p>Noch keine Dojos vorhanden</p>
          </div>
        ) : (
          <div className="dojos-grid">
            {dojos.map(dojo => (
              <div key={dojo.id} className="dojo-card" style={{ borderLeftColor: dojo.farbe }}>
                <div className="dojo-header">
                  <div className="dojo-icon" style={{ backgroundColor: dojo.farbe }}>
                    🏢
                  </div>
                  <div className="dojo-info">
                    <h3>{dojo.dojoname}</h3>
                    <p className="dojo-inhaber">{dojo.inhaber}</p>
                    {dojo.ist_hauptdojo && <span className="badge badge-primary">Haupt-Dojo</span>}
                    {getStatusBadge(dojo)}
                  </div>
                </div>

                <div className="dojo-details">
                  <div className="detail-row">
                    <span>📍</span>
                    <span>{dojo.strasse} {dojo.hausnummer}, {dojo.plz} {dojo.ort}</span>
                  </div>
                  <div className="detail-row">
                    <span>📧</span>
                    <span>{dojo.email}</span>
                  </div>
                  <div className="detail-row">
                    <span>💰</span>
                    <span>Umsatz {new Date().getFullYear()}: {parseFloat(dojo.jahresumsatz_aktuell || 0).toLocaleString('de-DE')} EUR</span>
                  </div>
                  {dojo.steuer_status === 'kleinunternehmer' && (
                    <div className="detail-row">
                      <span>📊</span>
                      <span>
                        Grenze: {parseFloat(dojo.kleinunternehmer_grenze || 0).toLocaleString('de-DE')} EUR
                        ({((dojo.jahresumsatz_aktuell / dojo.kleinunternehmer_grenze) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  )}
                </div>

                <div className="dojo-actions">
                  <button className="btn-action btn-edit" onClick={() => navigate(`/dashboard/dojos/edit/${dojo.id}`)}>
                    <Edit size={18} />
                    Bearbeiten
                  </button>
                  {!dojo.ist_hauptdojo && (
                    <button className="btn-action btn-delete" onClick={() => handleDelete(dojo.id)}>
                      <Trash2 size={18} />
                      Deaktivieren
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DojosVerwaltung;
