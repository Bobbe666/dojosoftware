import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDojoContext } from '../context/DojoContext.jsx';
import "../styles/themes.css";
import "../styles/components.css";

const EhemaligenListe = () => {
  const { getDojoFilterParam } = useDojoContext();
  const [ehemalige, setEhemalige] = useState([]);
  const [filteredEhemalige, setFilteredEhemalige] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadEhemalige();
  }, []);

  const loadEhemalige = async () => {
    try {
      setLoading(true);
      const dojoFilterParam = getDojoFilterParam();
      const url = dojoFilterParam
        ? `/ehemalige?${dojoFilterParam}`
        : '/ehemalige';

      const response = await axios.get(url);
      setEhemalige(response.data);
      setFilteredEhemalige(response.data);
      setLoading(false);
    } catch (err) {
      console.error("Fehler beim Laden der ehemaligen Mitglieder:", err);
      setError("Fehler beim Laden der Daten");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchTerm === "") {
      setFilteredEhemalige(ehemalige);
    } else {
      const filtered = ehemalige.filter((e) =>
        `${e.vorname} ${e.nachname}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEhemalige(filtered);
    }
  }, [searchTerm, ehemalige]);

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Lade ehemalige Mitglieder...</div>
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
        <h1 style={{ margin: 0 }}>Ehemalige Mitglieder</h1>
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
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="Suchen nach Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            padding: '0.75rem',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(31, 41, 55, 0.6)',
            color: 'white'
          }}
        />
        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          {filteredEhemalige.length} von {ehemalige.length} angezeigt
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem'
      }}>
        {filteredEhemalige.length > 0 ? (
          filteredEhemalige.map((ehemaliger) => (
            <div
              key={ehemaliger.id}
              className="stat-card"
              style={{
                padding: '1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                margin: '0 0 0.5rem 0',
                color: '#ffd700'
              }}>
                {ehemaliger.nachname}, {ehemaliger.vorname}
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.6' }}>
                {ehemaliger.austrittsdatum && (
                  <p style={{ margin: '0.2rem 0' }}>
                    <strong>Austritt:</strong> {new Date(ehemaliger.austrittsdatum).toLocaleDateString('de-DE')}
                  </p>
                )}
                {ehemaliger.email && (
                  <p style={{ margin: '0.2rem 0' }}>
                    <strong>Email:</strong> {ehemaliger.email}
                  </p>
                )}
                {ehemaliger.letzter_guertel && (
                  <p style={{ margin: '0.2rem 0' }}>
                    <strong>Letzter Gürtel:</strong> {ehemaliger.letzter_guertel}
                  </p>
                )}
                {ehemaliger.austrittsgrund && (
                  <p style={{ margin: '0.2rem 0' }}>
                    <strong>Grund:</strong> {ehemaliger.austrittsgrund}
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
            <h3>Keine ehemaligen Mitglieder gefunden</h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              Es sind noch keine ehemaligen Mitglieder im System erfasst.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EhemaligenListe;
