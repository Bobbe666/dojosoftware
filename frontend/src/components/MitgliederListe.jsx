import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useTranslation } from 'react-i18next';
import config from '../config/config.js';
// Grid von react-window temporär deaktiviert wegen Object.values Bug
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/MitgliederListe.css";
import NeuesMitgliedAnlegen from "./NeuesMitgliedAnlegen.jsx";

// Konstanten für Grid-Layout
const COLUMN_COUNT = 5;
const CARD_WIDTH = 220;
const CARD_HEIGHT = 150;
const GAP = 6;

// Hilfsfunktion außerhalb der Komponente (wird nicht bei jedem Render neu erstellt)
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

// Memoized Member Card - verhindert Re-Render wenn andere Karten sich ändern
const MemberCard = React.memo(({
  mitglied,
  selectionMode,
  isSelected,
  onToggleSelection,
  onNavigate
}) => {
  return (
    <div
      className={`stat-card ml-member-card${selectionMode && isSelected ? ' ml-member-card--selected' : ''}`}
      onClick={(e) => {
        if (selectionMode) {
          e.stopPropagation();
          onToggleSelection(mitglied.mitglied_id);
        } else {
          onNavigate(mitglied.mitglied_id);
        }
      }}
    >
      {/* Checkbox im Auswahlmodus */}
      {selectionMode && (
        <div
          className={`ml-checkbox${isSelected ? ' ml-checkbox--selected' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection(mitglied.mitglied_id);
          }}
        >
          {isSelected && (
            <span className="ml-check-mark">✓</span>
          )}
        </div>
      )}

      <div className="ml-card-top">
        <div className="ml-card-header-row">
          <img
            src={mitglied.foto_pfad ? `${config.imageBaseUrl}/${mitglied.foto_pfad}` : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%232a2a4e" width="40" height="40"/%3E%3Ctext fill="%23ffd700" font-family="sans-serif" font-size="20" dy=".35em" x="50%25" y="50%25" text-anchor="middle"%3E👤%3C/text%3E%3C/svg%3E'}
            alt={`${mitglied.vorname} ${mitglied.nachname}`}
            className="ml-avatar"
            onError={(e) => {
              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%232a2a4e" width="40" height="40"/%3E%3Ctext fill="%23ffd700" font-family="sans-serif" font-size="20" dy=".35em" x="50%25" y="50%25" text-anchor="middle"%3E👤%3C/text%3E%3C/svg%3E';
            }}
          />
          <h3 className="member-name ml-member-name">
            {mitglied.nachname || "Unbekannt"}, {mitglied.vorname || "Unbekannt"}
          </h3>
        </div>
      </div>
      <div className="member-info ml-member-info">
        <p className="ml-info-dob">
          <strong>Geburtsdatum:</strong>{" "}
          {mitglied.geburtsdatum
            ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE')
            : "N/A"}
        </p>
        <p className="ml-info-stile">
          <strong>Stile:</strong>{" "}
          {mitglied.stile ? mitglied.stile.replace(/,/g, ", ") : "Keine Stile"}
        </p>
      </div>
    </div>
  );
});

MemberCard.displayName = 'MemberCard';

// Virtualisiertes Grid für große Mitgliederlisten (100+ Mitglieder)
const VirtualizedMemberGrid = React.memo(({
  members,
  selectionMode,
  selectedMembers,
  onToggleSelection,
  onNavigate,
  t
}) => {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Schutzprüfung: Stelle sicher dass members ein Array ist
  const safeMembers = Array.isArray(members) ? members : [];

  // Container-Breite messen
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Berechne Spalten basierend auf Container-Breite
  const columnCount = useMemo(() => {
    if (containerWidth < 500) return 2;
    if (containerWidth < 800) return 3;
    if (containerWidth < 1100) return 4;
    return COLUMN_COUNT;
  }, [containerWidth]);

  const rowCount = useMemo(() => Math.ceil(safeMembers.length / columnCount), [safeMembers.length, columnCount]);

  // Berechne Karten-Breite basierend auf verfügbarem Platz
  const cardWidth = useMemo(() => {
    return Math.floor((containerWidth - (columnCount - 1) * GAP) / columnCount);
  }, [containerWidth, columnCount]);

  // Cell Renderer für das Grid
  const Cell = useCallback(({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * columnCount + columnIndex;
    if (index >= safeMembers.length) return null;

    const mitglied = safeMembers[index];
    return (
      <div style={{
        ...style,
        left: style.left + GAP / 2,
        top: style.top + GAP / 2,
        width: style.width - GAP,
        height: style.height - GAP
      }}>
        <MemberCard
          mitglied={mitglied}
          selectionMode={selectionMode}
          isSelected={selectedMembers.includes(mitglied.mitglied_id)}
          onToggleSelection={onToggleSelection}
          onNavigate={onNavigate}
        />
      </div>
    );
  }, [safeMembers, columnCount, selectionMode, selectedMembers, onToggleSelection, onNavigate]);

  // Empty State
  if (safeMembers.length === 0) {
    return (
      <div className="stat-card ml-empty-card">
        <h3 className="ml-empty-title">
          {t('list.noMembers', 'Keine Mitglieder gefunden')}
        </h3>
        <p className="ml-empty-desc">
          {t('list.noMembersDescription', 'Es sind noch keine Mitglieder im System registriert.')}
        </p>
      </div>
    );
  }

  // Einfaches Grid für alle Listen (Virtualisierung temporär deaktiviert)
  return (
    <div
      ref={containerRef}
      className="stats-grid ml-member-grid"
      style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
    >
      {safeMembers.map((mitglied) => (
        <MemberCard
          key={mitglied.mitglied_id}
          mitglied={mitglied}
          selectionMode={selectionMode}
          isSelected={selectedMembers.includes(mitglied.mitglied_id)}
          onToggleSelection={onToggleSelection}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
});

VirtualizedMemberGrid.displayName = 'VirtualizedMemberGrid';

const MitgliederListe = () => {
  const { t, ready } = useTranslation(['members', 'common']);
  // CACHE BREAK - Force reload
  const cacheBreak = Date.now();
  const { getDojoFilterParam, activeDojo, filter, dojos } = useDojoContext(); // 🔒 TAX COMPLIANCE: Dojo-Filter
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
  // filteredMitglieder wird jetzt durch useMemo berechnet
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
    // Warte bis Übersetzungen und Context bereit sind
    if (!ready || !dojos) {
      console.log('⏳ Warte auf Übersetzungen/Dojos...');
      return;
    }

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
        setError(t('errors.loadingError'));
      })
      .finally(() => setLoading(false));
  }, [activeDojo, filter, updateTrigger, ready, dojos]); // 🔒 TAX COMPLIANCE: Reload when dojo, filter or members change!

  // Filter-Logik mit useMemo (nur neu berechnet wenn sich Dependencies ändern)
  const filteredMitglieder = useMemo(() => {
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
        filtered = filtered.filter(m => !m.stile || m.stile.trim() === '');
      } else {
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

    return filtered;
  }, [mitglieder, searchTerm, selectedLetter, filterStil, filterAlter, filterGurt]);

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

  const handleNewMember = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    setSelectedLetter(""); // Reset Alphabet-Filter bei Suche
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedLetter("");
    setFilterStil("");
    setFilterAlter("");
    setFilterGurt("");
  }, []);

  // Memoized check für aktive Filter
  const hasActiveFilters = useMemo(() => {
    return searchTerm || selectedLetter || filterStil || filterAlter || filterGurt;
  }, [searchTerm, selectedLetter, filterStil, filterAlter, filterGurt]);

  const handleLetterFilter = useCallback((letter) => {
    setSelectedLetter(prev => {
      if (prev === letter) {
        return ""; // Deselektieren
      } else {
        setSearchTerm(""); // Reset Suchfeld bei Alphabet-Filter
        return letter;
      }
    });
  }, []);

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

  const handleToggleMemberSelection = useCallback((mitgliedId) => {
    setSelectedMembers(prev => {
      if (prev.includes(mitgliedId)) {
        return prev.filter(id => id !== mitgliedId);
      } else {
        return [...prev, mitgliedId];
      }
    });
  }, []);

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
      }
    } catch (error) {
      console.error('Fehler bei der Bulk-Archivierung:', error);
      alert(`Fehler bei der Archivierung: ${error.response?.data?.error || error.message}`);
    }
  };

  // Warte bis Übersetzungen und Context bereit sind
  if (!ready || !dojos) {
    return (
      <div className="app-container ml-center-loader">
        <div className="ml-loader-text">
          <div className="loading-spinner"></div>
          <p>Lade Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="page-header ml-page-header" data-cache-break={cacheBreak}>

        {/* Zeile 1: Nur Titel */}
        <h2 className="page-title ml-page-title">{t('list.title')}</h2>

        {/* Zeile 2: Suchfeld + Neu + Filter + Aktionen */}
        <div className="ml-toolbar-row">
          {/* Suchfeld */}
          <input
            type="text"
            placeholder={t('list.searchPlaceholder')}
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input-dark ml-search-input"
            onFocus={(e) => {
              e.target.style.borderColor = '#F59E0B';
              e.target.style.boxShadow = '0 4px 20px rgba(245, 158, 11, 0.2)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              e.target.style.boxShadow = 'none';
            }}
          />

          {/* Stil-Filter */}
          <select
            value={filterStil}
            onChange={(e) => setFilterStil(e.target.value)}
            className={`filter-select ml-filter-select ${filterStil ? 'active' : ''}`}
          >
            <option value="">🎯 {t('list.filters.allStyles', 'Alle Stile')}</option>
            <option value="__OHNE_STIL__" className="option-warning">❌ {t('list.filters.noStyle', 'Ohne Stil')}</option>
            {availableStile.map(stil => (
              <option key={stil} value={stil}>{stil}</option>
            ))}
          </select>

          {/* Alter-Filter */}
          <select
            value={filterAlter}
            onChange={(e) => setFilterAlter(e.target.value)}
            className={`filter-select ml-filter-select ${filterAlter ? 'active' : ''}`}
          >
            <option value="">📅 {t('list.filters.age', 'Alter')}</option>
            <option value="0-6">0-6 J.</option>
            <option value="7-12">7-12 J.</option>
            <option value="13-17">13-17 J.</option>
            <option value="18-25">18-25 J.</option>
            <option value="26-40">26-40 J.</option>
            <option value="41+">41+ J.</option>
          </select>

          {/* Gurt-Filter */}
          <select
            value={filterGurt}
            onChange={(e) => setFilterGurt(e.target.value)}
            className={`filter-select ml-filter-select ${filterGurt ? 'active' : ''}`}
          >
            <option value="">🥋 {t('list.filters.allBelts', 'Alle Gurte')}</option>
            {availableGurte.map(gurt => (
              <option key={gurt} value={gurt}>{gurt}</option>
            ))}
          </select>

          {/* Filter zurücksetzen Button */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="filter-reset-btn ml-reset-btn"
            >
              ✕ Reset
            </button>
          )}

          {/* Aktionen-Menü */}
          <div className="menu-container ml-menu-anchor">
            <button
              ref={menuButtonRef}
              onClick={handleMenuToggle}
              className="actions-btn ml-actions-btn"
            >
              <span className="ml-kebab-icon">⋮</span>
              <span>{t('common:labels.actions')}</span>
            </button>
          </div>

          {/* Dropdown Menü als Portal direkt im Body */}
          {showMenu && ReactDOM.createPortal(
            <div
              className="actions-dropdown ml-dropdown"
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="actions-dropdown-item ml-dropdown-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(false);
                  handleNewMember();
                }}
              >
                <span className="ml-icon-lg">➕</span>
                <span>{t('list.addMember')}</span>
              </button>

              <button
                className="actions-dropdown-item ml-dropdown-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePrintMitglieder();
                }}
              >
                <span className="ml-icon-lg">🖨️</span>
                <span>{t('list.printList', 'Mitgliederliste drucken')}</span>
              </button>

              <button
                className="actions-dropdown-item ml-dropdown-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleToggleSelectionMode();
                }}
              >
                <span className="ml-icon-lg">📦</span>
                <span>{selectionMode ? t('list.endSelection', 'Auswahl beenden') : t('list.bulkArchive', 'Mehrfach archivieren')}</span>
              </button>
            </div>,
            document.body
          )}

          {/* Anzahl Mitglieder */}
          <span className="ml-member-count">
            {filteredMitglieder.length}/{mitglieder.length}
          </span>
        </div>

        {/* Zeile 3: Nachname-Label + ABC-Buchstaben */}
        {availableLetters.length > 0 && (
          <div className="ml-letter-row">
            <span className="ml-letter-label">
              {t('detail.fields.lastName', 'Nachname')}:
            </span>

            {availableLetters.map(letter => (
              <button
                key={letter}
                onClick={() => handleLetterFilter(letter)}
                className={`letter-filter-btn ml-letter-btn ${selectedLetter === letter ? 'active' : ''}`}
              >
                {letter}
              </button>
            ))}
            {selectedLetter && (
              <button
                onClick={() => setSelectedLetter("")}
                className="letter-filter-reset-btn ml-letter-reset-btn"
              >
                ✖ Alle
              </button>
            )}
          </div>
        )}
      </div>



      {/* Aktionsleiste im Auswahlmodus */}
      {selectionMode && (
        <div className="ml-selection-bar">
          <div className="u-flex-row-lg">
            <span className="ml-selection-count">
              {t('list.selectedCount', '{{count}} ausgewählt', { count: selectedMembers.length })}
            </span>
            <button
              onClick={handleSelectAll}
              className="ml-select-all-btn"
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
            >
              {selectedMembers.length === filteredMitglieder.length ? t('list.deselectAll', 'Alle abwählen') : t('list.selectAll', 'Alle auswählen')}
            </button>
          </div>
          <div className="u-flex-row-sm">
            <button
              onClick={handleBulkArchive}
              disabled={selectedMembers.length === 0}
              className="ml-bulk-archive-btn"
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
              className="ml-cancel-selection-btn"
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

      {!loading && Array.isArray(filteredMitglieder) && (
        <VirtualizedMemberGrid
          members={filteredMitglieder}
          selectionMode={selectionMode}
          selectedMembers={selectedMembers}
          onToggleSelection={handleToggleMemberSelection}
          onNavigate={(id) => navigate(`/dashboard/mitglieder/${id}`)}
          t={t}
        />
      )}

      {isModalOpen && <NeuesMitgliedAnlegen onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};

export default MitgliederListe;
