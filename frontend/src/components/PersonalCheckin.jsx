import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/PersonalCheckin.css';

const PersonalCheckin = () => {
  const [personal, setPersonal]               = useState([]);
  const [checkins, setCheckins]               = useState([]);
  const [stats, setStats]                     = useState({});
  const [selectedPersonal, setSelectedPersonal] = useState('');
  const [bemerkung, setBemerkung]             = useState('');
  const [loading, setLoading]                 = useState(false);
  const [datum, setDatum]                     = useState(() => new Date().toISOString().split('T')[0]);
  const [error, setError]                     = useState('');
  const [success, setSuccess]                 = useState('');

  const showError   = (msg) => { setError(msg);   setTimeout(() => setError(''), 4000); };
  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const loadPersonal = useCallback(async () => {
    try {
      const response = await axios.get('/personalCheckin/personal');
      setPersonal(response.data.personal || []);
    } catch (err) {
      showError('Fehler beim Laden der Personal-Liste');
    }
  }, []);

  const loadCheckins = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/personalCheckin?datum=${datum}`);
      setCheckins(response.data.checkins || []);
      setStats(response.data.stats || {});
    } catch (err) {
      showError('Fehler beim Laden der Check-ins');
    } finally {
      setLoading(false);
    }
  }, [datum]);

  useEffect(() => { loadPersonal(); }, [loadPersonal]);
  useEffect(() => { loadCheckins(); }, [loadCheckins]);

  const handleCheckin = async () => {
    if (!selectedPersonal) { showError('Bitte Personal auswählen!'); return; }

    try {
      setLoading(true);
      await axios.post('/personalCheckin', {
        personal_id: parseInt(selectedPersonal),
        bemerkung: bemerkung || undefined
      });
      setSelectedPersonal('');
      setBemerkung('');
      loadCheckins();
      showSuccess('Erfolgreich eingecheckt!');
    } catch (err) {
      showError(err.response?.data?.error || 'Fehler beim Einchecken');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (checkinId) => {
    if (!window.confirm('Jetzt auschecken?')) return;
    try {
      setLoading(true);
      const response = await axios.put(`/personalCheckin/${checkinId}/checkout`);
      loadCheckins();
      showSuccess(response.data.message || 'Ausgecheckt');
    } catch (err) {
      showError(err.response?.data?.error || 'Fehler beim Auschecken');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (checkinId) => {
    if (!window.confirm('Check-in löschen?')) return;
    try {
      await axios.delete(`/personalCheckin/${checkinId}`);
      loadCheckins();
      showSuccess('Check-in gelöscht');
    } catch (err) {
      showError(err.response?.data?.error || 'Fehler beim Löschen');
    }
  };

  const formatTime = (ts) => ts
    ? new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '—';

  const formatDuration = (minutes) => {
    if (!minutes) return '0h 0min';
    return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  };

  const selectedInfo = personal.find(p => p.personal_id === parseInt(selectedPersonal));

  return (
    <div className="personal-checkin-container">
      {/* Header */}
      <div className="personal-checkin-header">
        <h2>👥 Personal Check-in</h2>
        <p className="personal-checkin-subtitle">Arbeitszeiten erfassen und verwalten</p>
      </div>

      {/* Meldungen */}
      {error   && <div className="pc-alert pc-alert--error">{error}</div>}
      {success && <div className="pc-alert pc-alert--success">{success}</div>}

      {/* Datum */}
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
            <div className="stat-label">Check-ins</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-content">
            <div className="stat-number">{stats.eingecheckt || 0}</div>
            <div className="stat-label">Aktiv</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏰</div>
          <div className="stat-content">
            <div className="stat-number">{stats.total_arbeitszeit_stunden || 0}h</div>
            <div className="stat-label">Gesamtzeit</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-number">€{(stats.total_kosten || 0).toFixed(2)}</div>
            <div className="stat-label">Gesamtkosten</div>
          </div>
        </div>
      </div>

      {/* Einchecken Form */}
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
              <option value="">Personal auswählen…</option>
              {personal.map((p) => (
                <option key={p.personal_id} value={p.personal_id}>
                  {p.vorname} {p.nachname} – {p.position} (€{p.stundenlohn}/h)
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
              placeholder="z.B. Frühdienst, Spätdienst…"
              className="form-input"
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && handleCheckin()}
            />
          </div>

          <button
            onClick={handleCheckin}
            disabled={loading || !selectedPersonal}
            className="checkin-button"
          >
            {loading ? '🔄 Wird eingecheckt…' : '✅ Einchecken'}
          </button>
        </div>
      </div>

      {/* Check-in Liste */}
      <div className="checkins-list">
        <h3>📋 Check-ins – {new Date(datum + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</h3>

        {loading && <div className="loading">🔄 Lade…</div>}

        {checkins.length === 0 && !loading && (
          <div className="no-checkins-message">
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h4>Keine Check-ins</h4>
              <p>Für dieses Datum sind noch keine Check-ins vorhanden.</p>
            </div>
          </div>
        )}

        <div className="checkins-grid">
          {checkins.map((checkin, index) => (
            <div
              key={checkin.checkin_id}
              className={`checkin-card ${checkin.status}`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="checkin-card-header">
                <div className="personal-name">{checkin.vorname} {checkin.nachname}</div>
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
                  <span className="checkin-value time-value">{formatTime(checkin.checkin_time)}</span>
                </div>
                {checkin.checkout_time && (
                  <div className="checkin-field">
                    <label>🕑 Check-out:</label>
                    <span className="checkin-value time-value">{formatTime(checkin.checkout_time)}</span>
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
                    €{(checkin.aktuelle_kosten || 0).toFixed(2)}
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

              <div className="checkin-card-actions">
                {checkin.status === 'eingecheckt' && (
                  <button
                    onClick={() => handleCheckout(checkin.checkin_id)}
                    disabled={loading}
                    className="checkout-button"
                  >
                    🔴 Auschecken
                  </button>
                )}
                <button
                  onClick={() => handleDelete(checkin.checkin_id)}
                  disabled={loading}
                  className="delete-button"
                  title="Check-in löschen"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PersonalCheckin;
