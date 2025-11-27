import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import "../styles/themes.css";
import "../styles/components.css";
import NeuesMitgliedAnlegen from "./NeuesMitgliedAnlegen.jsx";

const MitgliederListe = () => {
  // CACHE BREAK - Force reload
  const cacheBreak = Date.now();
  const { getDojoFilterParam, activeDojo, filter } = useDojoContext(); // 🔒 TAX COMPLIANCE: Dojo-Filter
  const { updateTrigger } = useMitgliederUpdate(); // 🔄 Automatische Updates nach Mitgliedsanlage
  
  // CSS für dunklen Placeholder-Text
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .search-input-dark::placeholder {
        color: rgba(255, 255, 255, 0.5) !important;
        opacity: 1 !important;
      }
      .search-input-dark::-webkit-input-placeholder {
        color: rgba(255, 255, 255, 0.5) !important;
        opacity: 1 !important;
      }
      .search-input-dark::-moz-placeholder {
        color: rgba(255, 255, 255, 0.5) !important;
        opacity: 1 !important;
      }
      .search-input-dark:-ms-input-placeholder {
        color: rgba(255, 255, 255, 0.5) !important;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  
  const [mitglieder, setMitglieder] = useState([]);
  const [filteredMitglieder, setFilteredMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("");
  const [availableLetters, setAvailableLetters] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // 🔒 TAX COMPLIANCE: Lade Mitglieder mit Dojo-Filter
    const dojoFilterParam = getDojoFilterParam();
    const url = dojoFilterParam
      ? `/mitglieder/all?${dojoFilterParam}`
      : '/mitglieder/all';

    console.log('🏢 Lade Mitglieder mit Filter:', dojoFilterParam);
    console.log('🔍 API URL:', url);

    axios.get(url)
      .then((response) => {
        const data = response.data;
        if (!Array.isArray(data)) {
          throw new Error("Unerwartetes API-Format!");
        }
        setMitglieder(data);
        setFilteredMitglieder(data);

        // Verfügbare Anfangsbuchstaben extrahieren
        const letters = [...new Set(
          data.map(m => m.nachname?.charAt(0)?.toUpperCase()).filter(Boolean)
        )].sort();
        setAvailableLetters(letters);

        console.log(`✅ ${data.length} Mitglieder geladen (Filter: ${dojoFilterParam || 'alle'})`);
      })
      .catch((error) => {
        console.error("Fehler beim Laden der Mitglieder:", error);
        setError("Fehler beim Laden der Mitglieder. Bitte Backend prüfen.");
      })
      .finally(() => setLoading(false));
  }, [activeDojo, filter, updateTrigger]); // 🔒 TAX COMPLIANCE: Reload when dojo, filter or members change!

  // Filter-Funktionen
  useEffect(() => {
    let filtered = mitglieder;

    // Erweiterte Text-Suche
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.vorname?.toLowerCase().includes(searchLower) ||
        m.nachname?.toLowerCase().includes(searchLower) ||
        m.email?.toLowerCase().includes(searchLower) ||
        m.stile?.toLowerCase().includes(searchLower) ||
        m.telefon?.toLowerCase().includes(searchLower) ||
        m.adresse?.toLowerCase().includes(searchLower) ||
        m.notizen?.toLowerCase().includes(searchLower)
      );
    }

    // Alphabet-Filter
    if (selectedLetter) {
      filtered = filtered.filter(m =>
        m.nachname?.charAt(0)?.toUpperCase() === selectedLetter
      );
    }

    setFilteredMitglieder(filtered);
  }, [mitglieder, searchTerm, selectedLetter]);

  const handleNewMember = () => {
    setIsModalOpen(true);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (selectedLetter) setSelectedLetter(""); // Reset Alphabet-Filter bei Suche
  };

  const handleLetterFilter = (letter) => {
    if (selectedLetter === letter) {
      setSelectedLetter(""); // Deselektieren
    } else {
      setSelectedLetter(letter);
      setSearchTerm(""); // Reset Suchfeld bei Alphabet-Filter
    }
  };

  return (
    <div className="app-container">
      <div className="page-header" style={{ 
        display: 'flex !important', 
        flexDirection: 'column !important', 
        gap: '0.6rem !important',
        textAlign: 'left !important',
        marginBottom: '0.8rem !important'
      }} data-cache-break={cacheBreak}>
        {/* Titel */}
        <div>
          <h2 className="page-title">Mitgliederübersicht</h2>
          <p className="page-subtitle">Verwalte alle Dojo-Mitglieder</p>
        </div>
        

        {/* Alphabet-Filter mit Suchfeld */}
        {availableLetters.length > 0 && (
          <div style={{
            padding: '0',
            background: 'transparent',
            borderRadius: '0',
            border: 'none',
            backdropFilter: 'none',
            boxShadow: 'none',
            marginTop: '0.3rem'
          }}>
            {/* Suchfeld und Button oberhalb der Buchstabenreihe */}
            <div style={{ 
              display: 'flex !important', 
              alignItems: 'center !important', 
              marginBottom: '0.4rem',
              width: '100%',
              textAlign: 'left !important',
              flexDirection: 'row !important',
              flexWrap: 'nowrap !important',
              justifyContent: 'flex-start !important'
            }}>
              <input
                type="text"
                placeholder="Mitglieder suchen..."
                value={searchTerm}
                onChange={handleSearchChange}
                style={{
                  width: '200px',
                  padding: '0.3rem 0.6rem',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  color: 'rgba(255, 255, 255, 0.9)',
                  boxSizing: 'border-box',
                  height: '28px',
                  marginRight: '2rem'
                }}
                className="search-input-dark"
                onFocus={(e) => {
                  e.target.style.borderColor = '#F59E0B';
                  e.target.style.boxShadow = '0 4px 20px rgba(245, 158, 11, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  e.target.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.1)';
                }}
              />
              <button
                onClick={handleNewMember}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  background: 'transparent',
                  color: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontWeight: '600',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(8px)',
                  boxSizing: 'border-box',
                  height: '28px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 50%, transparent 100%)';
                  e.target.style.color = 'rgba(255, 255, 255, 0.95)';
                  e.target.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.color = 'rgba(255, 255, 255, 0.7)';
                  e.target.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                }}
              >
                <span style={{ fontSize: '0.8rem' }}>➕</span>
                Mitglied anlegen
              </button>
            </div>
            
            <div style={{ marginBottom: '0.3rem', fontWeight: '600', color: '#F59E0B', fontSize: '0.8rem' }}>
              Filter nach Nachname:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {availableLetters.map(letter => (
                <button
                  key={letter}
                  onClick={() => handleLetterFilter(letter)}
                  style={{
                    padding: '0.3rem 0.5rem',
                    border: selectedLetter === letter ? '1px solid rgba(255, 215, 0, 0.4)' : '1px solid rgba(255, 215, 0, 0.2)',
                    borderRadius: '6px',
                    background: selectedLetter === letter ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 50%, transparent 100%)' : 'transparent',
                    color: selectedLetter === letter ? 'rgba(255, 255, 255, 0.95)' : '#ffd700',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.7rem',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedLetter !== letter) {
                      e.target.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 50%, transparent 100%)';
                      e.target.style.color = 'rgba(255, 255, 255, 0.95)';
                      e.target.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                      e.target.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedLetter !== letter) {
                      e.target.style.background = 'transparent';
                      e.target.style.color = '#ffd700';
                      e.target.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                      e.target.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {letter}
                </button>
              ))}
              {selectedLetter && (
                <button
                  onClick={() => setSelectedLetter("")}
                  style={{
                    padding: '0.3rem 0.5rem',
                    border: '1px solid #EF4444',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#EF4444',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.7rem',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 1px 2px rgba(239, 68, 68, 0.2)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#EF4444';
                    e.target.style.color = 'white';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(239, 68, 68, 0.1)';
                    e.target.style.color = '#EF4444';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  ✖ Alle
                </button>
              )}
            </div>
            {(searchTerm || selectedLetter) && (
              <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '500' }}>
                {filteredMitglieder.length} von {mitglieder.length} Mitgliedern angezeigt
              </div>
            )}
          </div>
        )}
      </div>



      {error && <div className="alert error">{error}</div>}
      {loading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Mitglieder...</p>
        </div>
      )}

      {!loading && (
         <div
           className="stats-grid"
           style={{
             display: 'grid',
             gridTemplateColumns: 'repeat(5, 1fr)',
             gap: '0.3rem',
             marginTop: '0.2rem',
             marginBottom: '0.5rem'
           }}
         >
          {filteredMitglieder.length > 0 ? (
            filteredMitglieder.map((mitglied) => (
              <div
                key={mitglied.mitglied_id}
                className="stat-card"
                onClick={() => navigate(`/dashboard/mitglieder/${mitglied.mitglied_id}`)}
                 style={{
                   padding: '0.8rem',
                   borderRadius: '6px',
                   cursor: 'pointer',
                   transition: 'all 0.2s',
                   minHeight: '130px',
                   display: 'flex',
                   flexDirection: 'column',
                   justifyContent: 'flex-start'
                 }}
              >
                <div style={{ marginBottom: '0.3rem' }}>
                  {/* Foto-Anzeige */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.3rem'
                  }}>
                    <img 
                      src={mitglied.foto_pfad ? `http://localhost:3002/${mitglied.foto_pfad}` : '/src/assets/default-avatar.png'} 
                      alt={`${mitglied.vorname} ${mitglied.nachname}`}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #e5e7eb'
                      }}
                      onError={(e) => {
                        e.target.src = '/src/assets/default-avatar.png';
                      }}
                    />
                    <h3 style={{
                      fontSize: '1.2rem',
                      fontWeight: '600',
                      margin: '0',
                      color: '#ffd700',
                      textShadow: '0 3px 12px rgba(0, 0, 0, 1), 0 0 15px rgba(255, 215, 0, 0.6), 0 0 25px rgba(255, 215, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.8)',
                      whiteSpace: 'normal',
                      overflow: 'visible',
                      textOverflow: 'unset',
                      lineHeight: '1.3'
                    }}>
                      {mitglied.nachname || "Unbekannt"}, {mitglied.vorname || "Unbekannt"}
                    </h3>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.4' }}>
                  <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.7rem' }}>
                    <strong>Geburtsdatum:</strong>{" "}
                    {mitglied.geburtsdatum
                      ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE')
                      : "N/A"}
                  </p>
                  <p style={{
                    margin: '0',
                    whiteSpace: 'normal',
                    overflow: 'visible',
                    textOverflow: 'unset',
                    lineHeight: '1.3'
                  }}>
                    <strong>Stile:</strong>{" "}
                    {mitglied.stile ? mitglied.stile.replace(/,/g, ", ") : "Keine Stile"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="stat-card" style={{
              gridColumn: '1 / -1',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>
                Keine Mitglieder gefunden
              </h3>
              <p style={{ margin: '0', color: 'rgba(255, 255, 255, 0.6)' }}>
                Es sind noch keine Mitglieder im System registriert.
              </p>
            </div>
          )}
        </div>
      )}

      {isModalOpen && <NeuesMitgliedAnlegen onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};

export default MitgliederListe;
