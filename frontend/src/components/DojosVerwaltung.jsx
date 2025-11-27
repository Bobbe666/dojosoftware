import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Edit, Trash2 } from 'lucide-react';
import '../styles/DojosVerwaltung.css';

const DojosVerwaltung = () => {
  const navigate = useNavigate();
  const [dojos, setDojos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [statistics, setStatistics] = useState(null);

  useEffect(() => {
    loadDojos();
    loadGesamtStatistiken();
  }, []);

  const loadDojos = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dojos');
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
    try {
      const response = await fetch('/api/dojos/statistics/gesamt');
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
      const response = await fetch(`/api/dojos/${id}`, { method: 'DELETE' });
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
