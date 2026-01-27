import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuButtonRef = React.useRef(null);
  const navigate = useNavigate();

  // Neue Filter-States
  const [filterStil, setFilterStil] = useState("");
  const [filterAlter, setFilterAlter] = useState("");
  const [filterGurt, setFilterGurt] = useState("");
  const [availableStile, setAvailableStile] = useState([]);
  const [availableGurte, setAvailableGurte] = useState([]);

  useEffect(() => {
    // 🔒 TAX COMPLIANCE: Lade Mitglieder mit Dojo-Filter
    const dojoFilterParam = getDojoFilterParam();
    const url = dojoFilterParam
      ? `/mitglieder/all?${dojoFilterParam}`
      : '/mitglieder/all';

    console.log('🏢 Lade Mitglieder mit Filter:', dojoFilterParam);
    console.log('🔍 API URL:', url);

    // Lade Mitglieder, Stile und Gurte parallel
    Promise.all([
      axios.get(url),
      axios.get('/mitglieder/filter-options/stile'),
      axios.get('/mitglieder/filter-options/gurte')
    ])
      .then(([mitgliederResponse, stileResponse, gurteResponse]) => {
        const data = mitgliederResponse.data;
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

        // Verfügbare Stile aus API
        if (stileResponse.data.success) {
          console.log('✅ Verfügbare Stile aus API:', stileResponse.data.stile);
          setAvailableStile(stileResponse.data.stile);
        }

        // Verfügbare Gurte aus API
        if (gurteResponse.data.success) {
          console.log('✅ Verfügbare Gurte aus API:', gurteResponse.data.gurte);
          setAvailableGurte(gurteResponse.data.gurte);
        }

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

    // Stil-Filter
    if (filterStil) {
      if (filterStil === '__OHNE_STIL__') {
        // Zeige nur Mitglieder ohne Stil
        filtered = filtered.filter(m => !m.stile || m.stile.trim() === '');
      } else {
        // Zeige nur Mitglieder mit diesem Stil
        filtered = filtered.filter(m =>
          m.stile?.split(',').map(s => s.trim()).includes(filterStil)
        );
      }
    }

    // Alter-Filter
    if (filterAlter) {
      filtered = filtered.filter(m => {
        if (!m.geburtsdatum) return false;
        const age = calculateAge(m.geburtsdatum);

        switch(filterAlter) {
          case '0-6': return age >= 0 && age <= 6;
          case '7-12': return age >= 7 && age <= 12;
          case '13-17': return age >= 13 && age <= 17;
          case '18-25': return age >= 18 && age <= 25;
          case '26-40': return age >= 26 && age <= 40;
          case '41+': return age >= 41;
          default: return true;
        }
      });
    }

    // Gurt-Filter
    if (filterGurt) {
      filtered = filtered.filter(m =>
        m.aktuelle_graduierung?.split(',').map(s => s.trim()).includes(filterGurt)
      );
    }

    setFilteredMitglieder(filtered);
  }, [mitglieder, searchTerm, selectedLetter, filterStil, filterAlter, filterGurt]);

  // Hilfsfunktion: Alter berechnen
  const calculateAge = (birthdate) => {
    if (!birthdate) return 0;
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Schließe Menü beim Klicken außerhalb
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu) {
        // Prüfe ob Klick auf den Button oder das Dropdown war
        const isMenuButton = event.target.closest('.menu-container');
        const isDropdownContent = event.target.closest('.dropdown-content');

        if (!isMenuButton && !isDropdownContent) {
          console.log('🚫 Click outside detected, closing menu');
          setShowMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleNewMember = () => {
    setIsModalOpen(true);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (selectedLetter) setSelectedLetter(""); // Reset Alphabet-Filter bei Suche
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedLetter("");
    setFilterStil("");
    setFilterAlter("");
    setFilterGurt("");
  };

  const hasActiveFilters = () => {
    return searchTerm || selectedLetter || filterStil || filterAlter || filterGurt;
  };

  const handleLetterFilter = (letter) => {
    if (selectedLetter === letter) {
      setSelectedLetter(""); // Deselektieren
    } else {
      setSelectedLetter(letter);
      setSearchTerm(""); // Reset Suchfeld bei Alphabet-Filter
    }
  };

  const handleToggleSelectionMode = () => {
    console.log('🎯 handleToggleSelectionMode called!');
    console.log('Current selectionMode:', selectionMode);
    setSelectionMode(!selectionMode);
    setSelectedMembers([]);
    setShowMenu(false);
    console.log('✅ Selection mode toggled, menu closed');
  };

  const handlePrintMitglieder = async () => {
    console.log('🖨️ Drucken Mitgliederliste!');
    try {
      setShowMenu(false);

      // 🔒 TAX COMPLIANCE: Dojo-Filter wie bei anderen API-Aufrufen
      const dojoFilterParam = getDojoFilterParam();
      const url = dojoFilterParam
        ? `/mitglieder/print?${dojoFilterParam}`
        : '/mitglieder/print';

      console.log('🖨️ PDF URL:', url);

      // PDF von Backend abrufen
      const response = await axios.get(url, {
        responseType: 'blob'
      });

      // PDF im neuen Tab öffnen
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const pdfUrl = window.URL.createObjectURL(blob);
      window.open(pdfUrl, '_blank');

      // URL nach kurzer Zeit freigeben
      setTimeout(() => window.URL.revokeObjectURL(pdfUrl), 100);
    } catch (error) {
      console.error('❌ Fehler beim Drucken der Mitgliederliste:', error);
      alert('Fehler beim Erstellen der PDF-Liste');
    }
  };

  const handleMenuToggle = () => {
    console.log('🔘 Menu Toggle clicked, current showMenu:', showMenu);
    if (!showMenu && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      // Position direkt unter dem Button
      const pos = {
        top: rect.bottom + 8,
        left: rect.left
      };
      console.log('📍 Menu position calculated:', pos);
      console.log('📏 Button rect:', rect);
      setMenuPosition(pos);
    }
    setShowMenu(!showMenu);
    console.log('✅ Menu state changed to:', !showMenu);
  };

  const handleToggleMemberSelection = (mitgliedId) => {
    if (selectedMembers.includes(mitgliedId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== mitgliedId));
    } else {
      setSelectedMembers([...selectedMembers, mitgliedId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === filteredMitglieder.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(filteredMitglieder.map(m => m.mitglied_id));
    }
  };

  const handleBulkArchive = async () => {
    if (selectedMembers.length === 0) {
      alert('Bitte wähle mindestens ein Mitglied aus.');
      return;
    }

    const confirmed = window.confirm(
      `Möchtest du wirklich ${selectedMembers.length} Mitglied(er) archivieren?\n\n` +
      `Diese Aktion kann nicht rückgängig gemacht werden.`
    );

    if (!confirmed) return;

    try {
      const response = await axios.post('/mitglieder/bulk-archivieren', {
        mitglied_ids: selectedMembers,
        grund: 'Bulk-Archivierung durch Admin',
        archiviert_von: null  // NULL statt String, da Spalte Integer erwartet
      });

      if (response.data.success) {
        const { results } = response.data;

        if (results.failed.length > 0) {
          alert(
            `Archivierung abgeschlossen:\n\n` +
            `✅ Erfolgreich: ${results.success.length}\n` +
            `❌ Fehlgeschlagen: ${results.failed.length}\n\n` +
            `Fehlgeschlagene Mitglieder:\n${results.failed.map(f => `- ID ${f.mitglied_id}: ${f.error}`).join('\n')}`
          );
        } else {
          alert(`✅ ${results.success.length} Mitglied(er) erfolgreich archiviert!`);
        }

        // Reset selection mode und lade Mitglieder neu
        setSelectionMode(false);
        setSelectedMembers([]);

        // Trigger reload
        const dojoFilterParam = getDojoFilterParam();
        const url = dojoFilterParam
          ? `/mitglieder/all?${dojoFilterParam}`
          : '/mitglieder/all';

        const refreshResponse = await axios.get(url);
        setMitglieder(refreshResponse.data);
        setFilteredMitglieder(refreshResponse.data);
      }
    } catch (error) {
      console.error('Fehler bei der Bulk-Archivierung:', error);
      alert(`Fehler bei der Archivierung: ${error.response?.data?.error || error.message}`);
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
            {/* Suchfeld und Buttons oberhalb der Buchstabenreihe */}
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
                  marginRight: '0.5rem'
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
                className="add-member-btn"
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box',
                  height: '28px',
                  marginRight: '0.5rem'
                }}
              >
                <span style={{ fontSize: '0.8rem' }}>➕</span>
                Mitglied anlegen
              </button>

              {/* Drei-Punkte-Menü Button - RECHTS NEBEN "Mitglied anlegen" */}
              <div className="menu-container" style={{ position: 'relative', display: 'inline-block', zIndex: 10000 }}>
                <button
                  ref={menuButtonRef}
                  onClick={handleMenuToggle}
                  className="actions-btn"
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    whiteSpace: 'nowrap',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    boxSizing: 'border-box',
                    height: '28px'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: '900' }}>⋮</span>
                  <span>Aktionen</span>
                </button>

              </div>

              {/* Dropdown Menü als Portal direkt im Body */}
              {showMenu && ReactDOM.createPortal(
                <div
                  className="actions-dropdown"
                  style={{
                    position: 'fixed',
                    top: `${menuPosition.top}px`,
                    left: `${menuPosition.left}px`,
                    borderRadius: '8px',
                    zIndex: 999999,
                    minWidth: '220px',
                    overflow: 'visible',
                    display: 'block',
                    visibility: 'visible',
                    opacity: 1,
                    padding: '0.5rem'
                  }}
                  onClick={(e) => {
                    console.log('🎯 Dropdown clicked!');
                    e.stopPropagation();
                  }}
                >
                  <button
                    className="actions-dropdown-item"
                    onMouseDown={(e) => {
                      console.log('🖨️ Drucken button MOUSEDOWN!');
                      e.preventDefault();
                      e.stopPropagation();
                      handlePrintMitglieder();
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontWeight: '600',
                      borderRadius: '6px',
                      marginBottom: '0.5rem'
                    }}
                  >
                    <span style={{ fontSize: '1.3rem' }}>🖨️</span>
                    <span>Mitgliederliste drucken</span>
                  </button>

                  <button
                    className="actions-dropdown-item"
                    onMouseDown={(e) => {
                      console.log('📦 Archivieren button MOUSEDOWN!');
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleSelectionMode();
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontWeight: '600',
                      borderRadius: '6px'
                    }}
                  >
                    <span style={{ fontSize: '1.3rem' }}>📦</span>
                    <span>{selectionMode ? 'Auswahl beenden' : 'Mehrfach archivieren'}</span>
                  </button>
                </div>,
                document.body
              )}
            </div>

            {/* Neue Filter-Leiste */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.8rem',
              flexWrap: 'wrap'
            }}>
              {/* Stil-Filter */}
              <select
                value={filterStil}
                onChange={(e) => setFilterStil(e.target.value)}
                className={`filter-select ${filterStil ? 'active' : ''}`}
                style={{
                  padding: '0.5rem 0.8rem',
                  fontSize: '0.85rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  height: '38px',
                  minHeight: '38px',
                  outline: 'none',
                  width: 'auto',
                  paddingRight: '2rem',
                  lineHeight: '1.4'
                }}
              >
                <option value="">🎯 Alle Stile</option>
                <option value="__OHNE_STIL__" className="option-warning">❌ Ohne Stil</option>
                {availableStile.map(stil => (
                  <option key={stil} value={stil}>
                    {stil}
                  </option>
                ))}
              </select>

              {/* Alter-Filter */}
              <select
                value={filterAlter}
                onChange={(e) => setFilterAlter(e.target.value)}
                className={`filter-select ${filterAlter ? 'active' : ''}`}
                style={{
                  padding: '0.5rem 0.8rem',
                  fontSize: '0.85rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  height: '38px',
                  minHeight: '38px',
                  outline: 'none',
                  width: 'auto',
                  paddingRight: '2rem',
                  lineHeight: '1.4'
                }}
              >
                <option value="">📅 Alle Altersgruppen</option>
                <option value="0-6">0-6 Jahre</option>
                <option value="7-12">7-12 Jahre</option>
                <option value="13-17">13-17 Jahre</option>
                <option value="18-25">18-25 Jahre</option>
                <option value="26-40">26-40 Jahre</option>
                <option value="41+">41+ Jahre</option>
              </select>

              {/* Gurt-Filter */}
              <select
                value={filterGurt}
                onChange={(e) => setFilterGurt(e.target.value)}
                className={`filter-select ${filterGurt ? 'active' : ''}`}
                style={{
                  padding: '0.5rem 0.8rem',
                  fontSize: '0.85rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  height: '38px',
                  minHeight: '38px',
                  outline: 'none',
                  width: 'auto',
                  paddingRight: '2rem',
                  lineHeight: '1.4'
                }}
              >
                <option value="">🥋 Alle Gurte</option>
                {availableGurte.map(gurt => (
                  <option key={gurt} value={gurt}>
                    {gurt}
                  </option>
                ))}
              </select>

              {/* Filter zurücksetzen Button */}
              {hasActiveFilters() && (
                <button
                  onClick={handleResetFilters}
                  className="filter-reset-btn"
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    height: '28px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontWeight: '600'
                  }}
                >
                  ✕ Filter zurücksetzen
                </button>
              )}
            </div>

            <div className="filter-label" style={{ marginBottom: '0.3rem', fontWeight: '600', fontSize: '0.8rem' }}>
              Filter nach Nachname:
            </div>

            <div className="letter-filter-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {availableLetters.map(letter => (
                <button
                  key={letter}
                  onClick={() => handleLetterFilter(letter)}
                  className={`letter-filter-btn ${selectedLetter === letter ? 'active' : ''}`}
                  style={{
                    padding: '0.3rem 0.5rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.7rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {letter}
                </button>
              ))}
              {selectedLetter && (
                <button
                  onClick={() => setSelectedLetter("")}
                  className="letter-filter-reset-btn"
                  style={{
                    padding: '0.3rem 0.5rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.7rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  ✖ Alle
                </button>
              )}
            </div>
            {(searchTerm || selectedLetter) && (
              <div className="filter-result-count" style={{ marginTop: '0.3rem', fontSize: '0.7rem', fontWeight: '500' }}>
                {filteredMitglieder.length} von {mitglieder.length} Mitgliedern angezeigt
              </div>
            )}
          </div>
        )}
      </div>



      {/* Aktionsleiste im Auswahlmodus */}
      {selectionMode && (
        <div style={{
          background: 'rgba(139, 92, 246, 0.15)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '8px',
          padding: '0.75rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.85rem', fontWeight: '600' }}>
              {selectedMembers.length} Mitglied{selectedMembers.length !== 1 ? 'er' : ''} ausgewählt
            </span>
            <button
              onClick={handleSelectAll}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
            >
              {selectedMembers.length === filteredMitglieder.length ? 'Alle abwählen' : 'Alle auswählen'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handleBulkArchive}
              disabled={selectedMembers.length === 0}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                background: selectedMembers.length > 0 ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'rgba(128, 128, 128, 0.3)',
                color: selectedMembers.length > 0 ? 'white' : 'rgba(255, 255, 255, 0.5)',
                border: 'none',
                borderRadius: '6px',
                cursor: selectedMembers.length > 0 ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              onMouseEnter={(e) => {
                if (selectedMembers.length > 0) {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <span>📦</span>
              Archivieren
            </button>
            <button
              onClick={handleToggleSelectionMode}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
              }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

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
                onClick={(e) => {
                  if (selectionMode) {
                    e.stopPropagation();
                    handleToggleMemberSelection(mitglied.mitglied_id);
                  } else {
                    navigate(`/dashboard/mitglieder/${mitglied.mitglied_id}`);
                  }
                }}
                 style={{
                   padding: '0.8rem',
                   borderRadius: '6px',
                   cursor: 'pointer',
                   transition: 'all 0.2s',
                   minHeight: '130px',
                   display: 'flex',
                   flexDirection: 'column',
                   justifyContent: 'flex-start',
                   position: 'relative',
                   border: selectionMode && selectedMembers.includes(mitglied.mitglied_id)
                     ? '2px solid rgba(139, 92, 246, 0.6)'
                     : '1px solid rgba(255, 255, 255, 0.1)',
                   boxShadow: selectionMode && selectedMembers.includes(mitglied.mitglied_id)
                     ? '0 0 15px rgba(139, 92, 246, 0.3)'
                     : 'none'
                 }}
              >
                {/* Checkbox im Auswahlmodus */}
                {selectionMode && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: selectedMembers.includes(mitglied.mitglied_id)
                        ? '2px solid #8b5cf6'
                        : '2px solid rgba(255, 255, 255, 0.4)',
                      background: selectedMembers.includes(mitglied.mitglied_id)
                        ? '#8b5cf6'
                        : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      zIndex: 10
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleMemberSelection(mitglied.mitglied_id);
                    }}
                  >
                    {selectedMembers.includes(mitglied.mitglied_id) && (
                      <span style={{ color: 'white', fontSize: '0.9rem', fontWeight: 'bold' }}>✓</span>
                    )}
                  </div>
                )}

                <div style={{ marginBottom: '0.3rem' }}>
                  {/* Foto-Anzeige */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.3rem'
                  }}>
                    <img
                      key={mitglied.mitglied_id}
                      src={mitglied.foto_pfad ? `http://localhost:3000/${mitglied.foto_pfad}` : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%232a2a4e" width="40" height="40"/%3E%3Ctext fill="%23ffd700" font-family="sans-serif" font-size="20" dy=".35em" x="50%25" y="50%25" text-anchor="middle"%3E👤%3C/text%3E%3C/svg%3E'}
                      alt={`${mitglied.vorname} ${mitglied.nachname}`}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #e5e7eb'
                      }}
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%232a2a4e" width="40" height="40"/%3E%3Ctext fill="%23ffd700" font-family="sans-serif" font-size="20" dy=".35em" x="50%25" y="50%25" text-anchor="middle"%3E👤%3C/text%3E%3C/svg%3E';
                      }}
                    />
                    <h3 className="member-name" style={{
                      fontSize: '1.2rem',
                      fontWeight: '600',
                      margin: '0',
                      whiteSpace: 'normal',
                      overflow: 'visible',
                      textOverflow: 'unset',
                      lineHeight: '1.3'
                    }}>
                      {mitglied.nachname || "Unbekannt"}, {mitglied.vorname || "Unbekannt"}
                    </h3>
                  </div>
                </div>
                <div className="member-info" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
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
