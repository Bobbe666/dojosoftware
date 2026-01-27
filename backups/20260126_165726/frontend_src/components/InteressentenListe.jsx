import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDojoContext } from '../context/DojoContext.jsx';
import "../styles/themes.css";
import "../styles/components.css";

const InteressentenListe = () => {
  const { getDojoFilterParam } = useDojoContext();
  const [interessenten, setInteressenten] = useState([]);
  const [filteredInteressenten, setFilteredInteressenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadInteressenten();
  }, []);

  const loadInteressenten = async () => {
    try {
      setLoading(true);
      const dojoFilterParam = getDojoFilterParam();
      const url = dojoFilterParam
        ? `/interessenten?${dojoFilterParam}`
        : '/interessenten';

      const response = await axios.get(url);
      setInteressenten(response.data);
      setFilteredInteressenten(response.data);
      setLoading(false);
    } catch (err) {
      console.error("Fehler beim Laden der Interessenten:", err);
      setError("Fehler beim Laden der Daten");
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = interessenten;

    if (searchTerm !== "") {
      filtered = filtered.filter((i) =>
        `${i.vorname} ${i.nachname}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== "") {
      filtered = filtered.filter((i) => i.status === filterStatus);
    }

    setFilteredInteressenten(filtered);
  }, [searchTerm, filterStatus, interessenten]);

  const getStatusColor = (status) => {
    const colors = {
      'neu': '#3b82f6',
      'kontaktiert': '#8b5cf6',
      'probetraining_vereinbart': '#f59e0b',
      'probetraining_absolviert': '#10b981',
      'angebot_gesendet': '#06b6d4',
      'interessiert': '#84cc16',
      'nicht_interessiert': '#6b7280',
      'konvertiert': '#22c55e'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'neu': 'Neu',
      'kontaktiert': 'Kontaktiert',
      'probetraining_vereinbart': 'Probetraining vereinbart',
      'probetraining_absolviert': 'Probetraining absolviert',
      'angebot_gesendet': 'Angebot gesendet',
      'interessiert': 'Interessiert',
      'nicht_interessiert': 'Nicht interessiert',
      'konvertiert': 'Konvertiert'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Lade Interessenten...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h1 style={{ margin: 0 }}>Interessenten</h1>
        <button
          className="primary-button"
          onClick={() => navigate('/dashboard/mitglieder')}
        >
          Zurück zu Mitgliedern
        </button>
      </div>

      <div style={{
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <input
          type="text"
          placeholder="Suchen nach Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '0.75rem',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(31, 41, 55, 0.6)',
            color: 'white'
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: '0.75rem',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(31, 41, 55, 0.6)',
            color: 'white',
            minWidth: '200px'
          }}
        >
          <option value="" style={{ background: '#1f2937', color: 'white' }}>Alle Status</option>
          <option value="neu" style={{ background: '#1f2937', color: 'white' }}>Neu</option>
          <option value="kontaktiert" style={{ background: '#1f2937', color: 'white' }}>Kontaktiert</option>
          <option value="probetraining_vereinbart" style={{ background: '#1f2937', color: 'white' }}>Probetraining vereinbart</option>
          <option value="probetraining_absolviert" style={{ background: '#1f2937', color: 'white' }}>Probetraining absolviert</option>
          <option value="angebot_gesendet" style={{ background: '#1f2937', color: 'white' }}>Angebot gesendet</option>
          <option value="interessiert" style={{ background: '#1f2937', color: 'white' }}>Interessiert</option>
          <option value="nicht_interessiert" style={{ background: '#1f2937', color: 'white' }}>Nicht interessiert</option>
          <option value="konvertiert" style={{ background: '#1f2937', color: 'white' }}>Konvertiert</option>
        </select>
        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          {filteredInteressenten.length} von {interessenten.length} angezeigt
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1rem'
      }}>
        {filteredInteressenten.length > 0 ? (
          filteredInteressenten.map((interessent) => (
            <div
              key={interessent.id}
              className="stat-card"
              style={{
                padding: '1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderLeft: `4px solid ${getStatusColor(interessent.status)}`
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                marginBottom: '0.5rem'
              }}>
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  margin: 0,
                  color: '#ffd700'
                }}>
                  {interessent.nachname}, {interessent.vorname}
                </h3>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  background: getStatusColor(interessent.status),
                  color: 'white',
                  fontWeight: '500'
                }}>
                  {getStatusLabel(interessent.status)}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.6' }}>
                {interessent.email && (
                  <p style={{ margin: '0.2rem 0' }}>
                    <strong>Email:</strong> {interessent.email}
                  </p>
                )}
                {interessent.telefon && (
                  <p style={{ margin: '0.2rem 0' }}>
                    <strong>Telefon:</strong> {interessent.telefon}
                  </p>
                )}
                {interessent.erstkontakt_datum && (
                  <p style={{ margin: '0.2rem 0' }}>
                    <strong>Erstkontakt:</strong> {new Date(interessent.erstkontakt_datum).toLocaleDateString('de-DE')}
                  </p>
                )}
                {interessent.interessiert_an && (
                  <p style={{ margin: '0.2rem 0' }}>
                    <strong>Interesse:</strong> {interessent.interessiert_an}
                  </p>
                )}
                {interessent.prioritaet && (
                  <p style={{ margin: '0.2rem 0' }}>
                    <strong>Priorität:</strong> {interessent.prioritaet}
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="stat-card" style={{
            gridColumn: '1 / -1',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <h3>Keine Interessenten gefunden</h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              Es sind noch keine Interessenten im System erfasst.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteressentenListe;
