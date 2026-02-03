import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useTranslation } from 'react-i18next';
// Grid von react-window temporär deaktiviert wegen Object.values Bug
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import "../styles/themes.css";
import "../styles/components.css";
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
      className="stat-card"
      onClick={(e) => {
        if (selectionMode) {
          e.stopPropagation();
          onToggleSelection(mitglied.mitglied_id);
        } else {
          onNavigate(mitglied.mitglied_id);
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
        border: selectionMode && isSelected
          ? '2px solid rgba(139, 92, 246, 0.6)'
          : '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: selectionMode && isSelected
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
            border: isSelected ? '2px solid #8b5cf6' : '2px solid rgba(255, 255, 255, 0.4)',
            background: isSelected ? '#8b5cf6' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            zIndex: 10
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection(mitglied.mitglied_id);
          }}
        >
          {isSelected && (
            <span style={{ color: 'white', fontSize: '0.9rem', fontWeight: 'bold' }}>✓</span>
          )}
        </div>
      )}

      <div style={{ marginBottom: '0.3rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.3rem'
        }}>
          <img
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
      <div className="stat-card" style={{
        padding: '2rem',
        textAlign: 'center',
        marginTop: '0.5rem'
      }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>
          {t('list.noMembers', 'Keine Mitglieder gefunden')}
        </h3>
        <p style={{ margin: '0', color: 'rgba(255, 255, 255, 0.6)' }}>
          {t('list.noMembersDescription', 'Es sind noch keine Mitglieder im System registriert.')}
        </p>
      </div>
    );
  }

  // Einfaches Grid für alle Listen (Virtualisierung temporär deaktiviert)
  return (
    <div
      ref={containerRef}
      className="stats-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gap: `${GAP}px`,
        marginTop: '0.2rem',
        marginBottom: '0.5rem',
        maxHeight: '600px',
        overflowY: 'auto'
      }}
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
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.7)' }}>Lade Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="page-header" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        marginBottom: '0.5rem',
        paddingTop: '0.3rem',
        alignItems: 'center'
      }} data-cache-break={cacheBreak}>

        {/* Zeile 1: Nur Titel */}
        <h2 className="page-title" style={{
          margin: 0,
          fontSize: '1.6rem',
          fontWeight: '700',
          textAlign: 'center',
          color: '#ffd700',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>{t('list.title')}</h2>

        {/* Zeile 2: Suchfeld + Neu + Filter + Aktionen */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {/* Suchfeld */}
          <input
            type="text"
            placeholder={t('list.searchPlaceholder')}
            value={searchTerm}
            onChange={handleSearchChange}
            style={{
              width: '160px',
              padding: '0 0.6rem',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '6px',
              fontSize: '0.8rem',
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(12px)',
              transition: 'all 0.3s ease',
              outline: 'none',
              color: 'white',
              boxSizing: 'border-box',
              height: '34px'
            }}
            className="search-input-dark"
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
            className={`filter-select ${filterStil ? 'active' : ''}`}
            style={{
              padding: '0 0.6rem',
              fontSize: '0.8rem',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              height: '34px',
              outline: 'none',
              paddingRight: '1.8rem'
            }}
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
            className={`filter-select ${filterAlter ? 'active' : ''}`}
            style={{
              padding: '0 0.6rem',
              fontSize: '0.8rem',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              height: '34px',
              outline: 'none',
              paddingRight: '1.8rem'
            }}
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
            className={`filter-select ${filterGurt ? 'active' : ''}`}
            style={{
              padding: '0 0.6rem',
              fontSize: '0.8rem',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              height: '34px',
              outline: 'none',
              paddingRight: '1.8rem'
            }}
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
              className="filter-reset-btn"
              style={{
                padding: '0 0.6rem',
                fontSize: '0.8rem',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                height: '34px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontWeight: '600'
              }}
            >
              ✕ Reset
            </button>
          )}

          {/* Aktionen-Menü */}
          <div className="menu-container" style={{ position: 'relative', display: 'inline-block', zIndex: 10000 }}>
            <button
              ref={menuButtonRef}
              onClick={handleMenuToggle}
              className="actions-btn"
              style={{
                padding: '0 0.6rem',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                whiteSpace: 'nowrap',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                boxSizing: 'border-box',
                height: '34px'
              }}
            >
              <span style={{ fontSize: '1rem', fontWeight: '900' }}>⋮</span>
              <span>{t('common:labels.actions')}</span>
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
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="actions-dropdown-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(false);
                  handleNewMember();
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
                <span style={{ fontSize: '1.3rem' }}>➕</span>
                <span>{t('list.addMember')}</span>
              </button>

              <button
                className="actions-dropdown-item"
                onMouseDown={(e) => {
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
                <span>{t('list.printList', 'Mitgliederliste drucken')}</span>
              </button>

              <button
                className="actions-dropdown-item"
                onMouseDown={(e) => {
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
                <span>{selectionMode ? t('list.endSelection', 'Auswahl beenden') : t('list.bulkArchive', 'Mehrfach archivieren')}</span>
              </button>
            </div>,
            document.body
          )}

          {/* Anzahl Mitglieder */}
          <span style={{
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.6)',
            whiteSpace: 'nowrap',
            padding: '0 0.5rem'
          }}>
            {filteredMitglieder.length}/{mitglieder.length}
          </span>
        </div>

        {/* Zeile 3: Nachname-Label + ABC-Buchstaben */}
        {availableLetters.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'rgba(255,255,255,0.7)',
              whiteSpace: 'nowrap'
            }}>
              {t('detail.fields.lastName', 'Nachname')}:
            </span>

            {availableLetters.map(letter => (
              <button
                key={letter}
                onClick={() => handleLetterFilter(letter)}
                className={`letter-filter-btn ${selectedLetter === letter ? 'active' : ''}`}
                style={{
                  padding: '0.2rem 0.45rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.7rem',
                  transition: 'all 0.2s ease',
                  minWidth: '24px',
                  height: '24px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
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
                  padding: '0.2rem 0.45rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.7rem',
                  transition: 'all 0.2s ease',
                  height: '24px',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                ✖ Alle
              </button>
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
              {t('list.selectedCount', '{{count}} ausgewählt', { count: selectedMembers.length })}
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
              {selectedMembers.length === filteredMitglieder.length ? t('list.deselectAll', 'Alle abwählen') : t('list.selectAll', 'Alle auswählen')}
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
