import React, { useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config/config.js';
import '../styles/PersonalCheckin.css';

const PersonalCheckin = () => {
  const [personal, setPersonal] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedPersonal, setSelectedPersonal] = useState('');
  const [bemerkung, setBemerkung] = useState('');
  const [loading, setLoading] = useState(false);
  const [datum, setDatum] = useState(() => new Date().toISOString().split('T')[0]);

  // Personal-Liste und Check-ins laden
  useEffect(() => {
    loadPersonal();
  }, []);

  useEffect(() => {
    loadCheckins();
  }, [datum]);

  const loadPersonal = async () => {
    try {
      const response = await axios.get(`${config.apiBaseUrl}/personalCheckin/personal`);
      setPersonal(response.data.personal);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Personal-Liste:', error);
    }
  };

  const loadCheckins = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${config.apiBaseUrl}/personalCheckin?datum=${datum}`);
      setCheckins(response.data.checkins);
      setStats(response.data.stats);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Check-ins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!selectedPersonal) {
      alert('Bitte Personal auswählen!');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${config.apiBaseUrl}/personalCheckin`, {
        personal_id: selectedPersonal,
        bemerkung: bemerkung
      });

      // Form zurücksetzen
      setSelectedPersonal('');
      setBemerkung('');
      
      // Daten neu laden
      loadCheckins();
      
      alert('Personal erfolgreich eingecheckt!');
    } catch (error) {
      console.error('❌ Fehler beim Einchecken:', error);
      alert('Fehler beim Einchecken: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (checkinId) => {
    if (!window.confirm('Personal auschecken?')) return;

    try {
      setLoading(true);
      const response = await axios.put(`${config.apiBaseUrl}/personalCheckin/${checkinId}/checkout`);
      
      // Daten neu laden
      loadCheckins();
      
      alert(response.data.message);
    } catch (error) {
      console.error('❌ Fehler beim Auschecken:', error);
      alert('Fehler beim Auschecken: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return new Date(timeString).toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0h 0min';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const getSelectedPersonalInfo = () => {
    if (!selectedPersonal) return null;
    return personal.find(p => p.personal_id === parseInt(selectedPersonal));
  };

  const selectedInfo = getSelectedPersonalInfo();

  return (
    <div className="personal-checkin-container">
      {/* Header */}
      <div className="personal-checkin-header">
        <h2>👥 Personal Check-in</h2>
        <p className="personal-checkin-subtitle">Arbeitszeiten erfassen und verwalten</p>
      </div>

      {/* Datum Auswahl */}
      <div className="datum-selection">
        <label>📅 Datum:</label>
        <input
          type="date"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          className="datum-input"
        />
      </div>

      {/* Statistiken */}
      <div className="personal-stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-number">{stats.total_checkins || 0}</div>
            <div className="stat-label">Check-ins Heute</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-number">{stats.eingecheckt || 0}</div>
            <div className="stat-label">Aktiv Eingecheckt</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏰</div>
          <div className="stat-content">
            <div className="stat-number">{stats.total_arbeitszeit_stunden || 0}h</div>
            <div className="stat-label">Gesamtarbeitszeit</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-number">€{stats.total_kosten?.toFixed(2) || '0.00'}</div>
            <div className="stat-label">Gesamtkosten</div>
          </div>
        </div>
      </div>

      {/* Check-in Form */}
      <div className="checkin-form-card">
        <div className="card-header">
          <h3>➕ Personal Einchecken</h3>
        </div>
        <div className="checkin-form">
          <div className="form-group">
            <label>👤 Personal auswählen:</label>
            <select
              value={selectedPersonal}
              onChange={(e) => setSelectedPersonal(e.target.value)}
              className="form-select"
              disabled={loading}
            >
              <option value="">Personal auswählen...</option>
              {personal.map((p) => (
                <option key={p.personal_id} value={p.personal_id}>
                  {p.vorname} {p.nachname} - {p.position} (€{p.stundenlohn}/h)
                </option>
              ))}
            </select>
          </div>

          {selectedInfo && (
            <div className="selected-personal-info">
              <div className="personal-info-card">
                <strong>{selectedInfo.vorname} {selectedInfo.nachname}</strong>
                <div className="personal-details">
                  <span className="position-tag">{selectedInfo.position}</span>
                  <span className="hourly-rate">€{selectedInfo.stundenlohn}/Stunde</span>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>📝 Bemerkung (optional):</label>
            <input
              type="text"
              value={bemerkung}
              onChange={(e) => setBemerkung(e.target.value)}
              placeholder="z.B. Frühdienst, Spätdienst..."
              className="form-input"
              disabled={loading}
            />
          </div>

          <button 
            onClick={handleCheckin}
            disabled={loading || !selectedPersonal}
            className="checkin-button"
          >
            {loading ? '🔄 Wird eingecheckt...' : '✅ Einchecken'}
          </button>
        </div>
      </div>

      {/* Check-in Liste */}
      <div className="checkins-list">
        <h3>📋 Heutige Check-ins ({datum})</h3>
        
        {loading && <div className="loading">🔄 Lade...</div>}
        
        {checkins.length === 0 && !loading && (
          <div className="no-checkins-message">
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h4>Keine Check-ins vorhanden</h4>
              <p>Für das ausgewählte Datum sind noch keine Personal Check-ins vorhanden.</p>
            </div>
          </div>
        )}

        <div className="checkins-grid">
          {checkins.map((checkin, index) => (
            <div 
              key={checkin.checkin_id} 
              className={`checkin-card ${checkin.status}`}
              style={{animationDelay: `${index * 0.1}s`}}
            >
              <div className="checkin-card-header">
                <div className="personal-name">
                  {checkin.vorname} {checkin.nachname}
                </div>
                <div className={`status-badge ${checkin.status}`}>
                  {checkin.status === 'eingecheckt' ? '🟢 Eingecheckt' : '🔴 Ausgecheckt'}
                </div>
              </div>

              <div className="checkin-card-content">
                <div className="checkin-field">
                  <label>👤 Position:</label>
                  <span className="checkin-value position-tag">{checkin.position}</span>
                </div>

                <div className="checkin-field">
                  <label>🕐 Check-in:</label>
                  <span className="checkin-value time-value">
                    {formatTime(checkin.checkin_time)}
                  </span>
                </div>

                {checkin.checkout_time && (
                  <div className="checkin-field">
                    <label>🕑 Check-out:</label>
                    <span className="checkin-value time-value">
                      {formatTime(checkin.checkout_time)}
                    </span>
                  </div>
                )}

                <div className="checkin-field">
                  <label>⏱️ Arbeitszeit:</label>
                  <span className="checkin-value duration-value">
                    {formatDuration(checkin.aktuelle_arbeitszeit_minuten)}
                  </span>
                </div>

                <div className="checkin-field">
                  <label>💰 Kosten:</label>
                  <span className="checkin-value cost-value">
                    €{checkin.aktuelle_kosten?.toFixed(2) || '0.00'}
                  </span>
                </div>

                <div className="checkin-field">
                  <label>💵 Stundenlohn:</label>
                  <span className="checkin-value">€{checkin.stundenlohn}/h</span>
                </div>

                {checkin.bemerkung && (
                  <div className="checkin-field">
                    <label>📝 Bemerkung:</label>
                    <span className="checkin-value">{checkin.bemerkung}</span>
                  </div>
                )}
              </div>

              {checkin.status === 'eingecheckt' && (
                <div className="checkin-card-actions">
                  <button
                    onClick={() => handleCheckout(checkin.checkin_id)}
                    disabled={loading}
                    className="checkout-button"
                  >
                    🔴 Auschecken
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PersonalCheckin;