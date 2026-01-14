import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/TdaTurniere.css';

const TdaTurniereList = () => {
  const { token } = useAuth();

  const [turniere, setTurniere] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('upcoming'); // 'upcoming', 'all', 'past'

  // Lade TDA-Turniere
  const ladeTurniere = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filter === 'upcoming') {
        params.append('upcoming', 'true');
      }

      const response = await axios.get(`/tda-turniere?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        let turniereData = response.data.turniere || [];

        // Client-seitiges Filtern für "past"
        if (filter === 'past') {
          turniereData = turniereData.filter(t => t.ist_vergangen);
        }

        setTurniere(turniereData);
      } else {
        setTurniere([]);
      }
    } catch (err) {
      console.error('Fehler beim Laden der TDA-Turniere:', err);
      setError('Fehler beim Laden der Turniere: ' + (err.response?.data?.error || err.message));
      setTurniere([]);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    if (token) {
      ladeTurniere();
    }
  }, [token, ladeTurniere]);

  // Formatiere Datum
  const formatDatum = (datum) => {
    if (!datum) return '';
    return new Date(datum).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Berechne Tage bis zum Turnier
  const getTageText = (turnier) => {
    if (!turnier.datum) return '';
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const turnierDatum = new Date(turnier.datum);
    turnierDatum.setHours(0, 0, 0, 0);

    const diffTime = turnierDatum - heute;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Heute!';
    if (diffDays === 1) return 'Morgen';
    if (diffDays < 0) return `Vor ${Math.abs(diffDays)} Tagen`;
    if (diffDays <= 7) return `In ${diffDays} Tagen`;
    if (diffDays <= 30) return `In ${Math.ceil(diffDays / 7)} Wochen`;
    return `In ${Math.ceil(diffDays / 30)} Monaten`;
  };

  // Öffne TDA-Anmeldeseite
  const handleAnmelden = (turnier) => {
    if (turnier.tda_registration_url) {
      window.open(turnier.tda_registration_url, '_blank', 'noopener,noreferrer');
    } else {
      alert('Keine Anmelde-URL verfügbar');
    }
  };

  // Status Badge-Farbe
  const getStatusBadge = (turnier) => {
    if (turnier.ist_vergangen) {
      return { text: 'Beendet', class: 'badge-secondary' };
    }
    if (!turnier.anmeldung_moeglich) {
      return { text: 'Anmeldung geschlossen', class: 'badge-warning' };
    }
    return { text: 'Anmeldung offen', class: 'badge-success' };
  };

  return (
    <div className="tda-turniere-container">
      {/* Filter-Leiste */}
      <div className="tda-filter-bar">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setFilter('upcoming')}
          >
            Kommende
          </button>
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Alle
          </button>
          <button
            className={`filter-btn ${filter === 'past' ? 'active' : ''}`}
            onClick={() => setFilter('past')}
          >
            Vergangene
          </button>
        </div>

        <button
          className="btn-refresh"
          onClick={ladeTurniere}
          disabled={loading}
          title="Aktualisieren"
        >
          {loading ? '...' : ''}
        </button>
      </div>

      {/* Fehleranzeige */}
      {error && (
        <div className="tda-error-message">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="tda-loading">
          <div className="loading-spinner"></div>
          <p>Lade Turniere...</p>
        </div>
      ) : turniere.length === 0 ? (
        <div className="tda-empty-state">
          <div className="empty-icon">
            <span role="img" aria-label="trophy">&#127942;</span>
          </div>
          <h3>Keine Turniere gefunden</h3>
          <p>
            {filter === 'upcoming'
              ? 'Aktuell sind keine kommenden TDA-Turniere geplant.'
              : filter === 'past'
              ? 'Keine vergangenen Turniere vorhanden.'
              : 'Es sind keine TDA-Turniere in der Datenbank.'}
          </p>
        </div>
      ) : (
        <div className="tda-turniere-grid">
          {turniere.map((turnier) => {
            const status = getStatusBadge(turnier);
            return (
              <div
                key={turnier.id}
                className={`tda-turnier-card ${turnier.ist_vergangen ? 'vergangen' : ''}`}
              >
                {/* Header */}
                <div className="turnier-card-header">
                  <div className="turnier-badges">
                    {turnier.disziplin && (
                      <span className="badge badge-disziplin">{turnier.disziplin}</span>
                    )}
                    <span className={`badge ${status.class}`}>{status.text}</span>
                  </div>
                  <div className="turnier-tage">{getTageText(turnier)}</div>
                </div>

                {/* Titel */}
                <h3 className="turnier-titel">{turnier.name}</h3>

                {/* Info-Zeilen */}
                <div className="turnier-info">
                  <div className="info-row">
                    <span className="info-icon" role="img" aria-label="kalender">&#128197;</span>
                    <span>{formatDatum(turnier.datum)}</span>
                    {turnier.datum_ende && turnier.datum_ende !== turnier.datum && (
                      <span> - {formatDatum(turnier.datum_ende)}</span>
                    )}
                  </div>

                  {turnier.ort && (
                    <div className="info-row">
                      <span className="info-icon" role="img" aria-label="ort">&#128205;</span>
                      <span>{turnier.ort}</span>
                    </div>
                  )}

                  {turnier.adresse && (
                    <div className="info-row info-sub">
                      <span className="info-icon"></span>
                      <span className="text-muted">{turnier.adresse}</span>
                    </div>
                  )}

                  {turnier.anmeldeschluss && (
                    <div className="info-row">
                      <span className="info-icon" role="img" aria-label="uhr">&#9200;</span>
                      <span>Anmeldeschluss: {formatDatum(turnier.anmeldeschluss)}</span>
                    </div>
                  )}

                  {turnier.teilnahmegebuehr > 0 && (
                    <div className="info-row">
                      <span className="info-icon" role="img" aria-label="geld">&#128176;</span>
                      <span>Startgebühr: {parseFloat(turnier.teilnahmegebuehr).toFixed(2)} EUR</span>
                    </div>
                  )}

                  {turnier.max_teilnehmer && (
                    <div className="info-row">
                      <span className="info-icon" role="img" aria-label="personen">&#128101;</span>
                      <span>Max. {turnier.max_teilnehmer} Teilnehmer</span>
                    </div>
                  )}

                  {turnier.veranstalter && (
                    <div className="info-row">
                      <span className="info-icon" role="img" aria-label="organisation">&#127970;</span>
                      <span>{turnier.veranstalter}</span>
                    </div>
                  )}
                </div>

                {/* Beschreibung */}
                {turnier.beschreibung && (
                  <div className="turnier-beschreibung">
                    <p>{turnier.beschreibung}</p>
                  </div>
                )}

                {/* Footer mit Anmelden-Button */}
                <div className="turnier-card-footer">
                  {turnier.anmeldung_moeglich && !turnier.ist_vergangen ? (
                    <button
                      className="btn-anmelden"
                      onClick={() => handleAnmelden(turnier)}
                    >
                      <span role="img" aria-label="registrieren" className="btn-icon">&#9997;</span>
                      Jetzt anmelden
                    </button>
                  ) : turnier.ist_vergangen ? (
                    <span className="turnier-vergangen-text">Turnier beendet</span>
                  ) : (
                    <span className="turnier-geschlossen-text">Anmeldung geschlossen</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info-Box */}
      <div className="tda-info-box">
        <p>
          <span role="img" aria-label="info">&#8505;&#65039;</span>
          Turniere werden automatisch von TDA International synchronisiert.
          Die Anmeldung erfolgt über das TDA-Turniersystem.
        </p>
      </div>
    </div>
  );
};

export default TdaTurniereList;
