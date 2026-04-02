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

// Gurt-Farben als kleine Dot-Indikatoren (dezent, kein buntes Badge)
const GURT_DOT_COLORS = {
  'Weißgurt':    '#d1d5db',
  'Gelbgurt':    '#ffd700',
  'Orangegurt':  '#f97316',
  'Grüngurt':    '#22c55e',
  'Blaugurt':    '#60a5fa',
  'Braungurt':   '#b45309',
  'Schwarzgurt': '#6b7280',
};
const getGurtDotColor = (gurt) => GURT_DOT_COLORS[gurt] || 'rgba(255,255,255,0.3)';

// Memoized List Row für Listen-Ansicht
const MemberListRow = React.memo(({
  mitglied,
  selectionMode,
  isSelected,
  onToggleSelection,
  onNavigate
}) => {
  const initials = `${mitglied.vorname?.charAt(0) || ''}${mitglied.nachname?.charAt(0) || ''}`.toUpperCase();
  const age = calculateAge(mitglied.geburtsdatum);
  const dobFormatted = mitglied.geburtsdatum
    ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  const stileArr = mitglied.stile
    ? mitglied.stile.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const gurte = mitglied.aktuelle_graduierung
    ? mitglied.aktuelle_graduierung.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const primaryGurt = gurte[0] || null;
  const gurtDot = getGurtDotColor(primaryGurt);

  const [imgError, setImgError] = React.useState(false);

  return (
    <div
      className={`ml-list-row${selectionMode && isSelected ? ' ml-list-row--selected' : ''}`}
      onClick={(e) => {
        if (selectionMode) {
          e.stopPropagation();
          onToggleSelection(mitglied.mitglied_id);
        } else {
          onNavigate(mitglied.mitglied_id);
        }
      }}
    >
      {selectionMode && (
        <div
          className={`ml-checkbox${isSelected ? ' ml-checkbox--selected' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleSelection(mitglied.mitglied_id); }}
        >
          {isSelected && <span className="ml-check-mark">✓</span>}
        </div>
      )}

      {/* Avatar */}
      <div className="ml-list-avatar-wrap">
        {mitglied.foto_pfad && !imgError ? (
          <img
            src={`${config.imageBaseUrl}/${mitglied.foto_pfad}`}
            alt={initials}
            className="ml-list-avatar-img"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="ml-list-avatar-circle">{initials}</div>
        )}
      </div>

      {/* Name + Metainfo (2-zeilig) */}
      <div className="ml-list-name-block">
        <div className="ml-list-name">
          {mitglied.nachname || 'Unbekannt'}, {mitglied.vorname || 'Unbekannt'}
        </div>
        <div className="ml-list-meta">
          {dobFormatted && <span>{dobFormatted}{age > 0 ? ` · ${age} J.` : ''}</span>}
          {mitglied.email && <span className="ml-list-email">{mitglied.email}</span>}
        </div>
      </div>

      {/* Stile Pills */}
      <div className="ml-list-stile">
        {stileArr.slice(0, 3).map(s => (
          <span key={s} className="ml-stile-pill">{s}</span>
        ))}
        {stileArr.length > 3 && (
          <span className="ml-stile-pill ml-stile-pill--more">+{stileArr.length - 3}</span>
        )}
      </div>

      {/* Gurt — kleiner Dot + Text, kein buntes Badge */}
      <div className="ml-list-gurt">
        {primaryGurt ? (
          <span className="ml-gurt-text">
            <span className="ml-gurt-dot" style={{ background: gurtDot }} />
            {primaryGurt}
          </span>
        ) : (
          <span className="ml-gurt-text ml-gurt-text--none">—</span>
        )}
      </div>

      {/* Pfeil */}
      <div className="ml-list-arrow">›</div>
    </div>
  );
});

MemberListRow.displayName = 'MemberListRow';

// Memoized Member Card - verhindert Re-Render wenn andere Karten sich ändern
const MemberCard = React.memo(({
  mitglied,
  selectionMode,
  isSelected,
  onToggleSelection,
  onNavigate
}) => {
  const initials = `${mitglied.vorname?.charAt(0) || ''}${mitglied.nachname?.charAt(0) || ''}`.toUpperCase();
  const [imgError, setImgError] = React.useState(false);
  const age = calculateAge(mitglied.geburtsdatum);

  const stileArr = mitglied.stile
    ? mitglied.stile.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const gurte = mitglied.aktuelle_graduierung
    ? mitglied.aktuelle_graduierung.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const primaryGurt = gurte[0] || null;
  const gurtDot = getGurtDotColor(primaryGurt);

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
      {selectionMode && (
        <div
          className={`ml-checkbox${isSelected ? ' ml-checkbox--selected' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleSelection(mitglied.mitglied_id); }}
        >
          {isSelected && <span className="ml-check-mark">✓</span>}
        </div>
      )}

      <div className="ml-card-top">
        <div className="ml-card-header-row">
          {mitglied.foto_pfad && !imgError ? (
            <img
              src={`${config.imageBaseUrl}/${mitglied.foto_pfad}`}
              alt={initials}
              className="ml-avatar"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="ml-avatar ml-avatar--initials">
              {initials}
            </div>
          )}
          <h3 className="member-name ml-member-name">
            {mitglied.nachname || "Unbekannt"}, {mitglied.vorname || "Unbekannt"}
          </h3>
        </div>
      </div>

      <div className="member-info ml-member-info">
        {/* Gurt: Dot + Text, kein buntes Badge */}
        {primaryGurt && (
          <div className="ml-card-gurt">
            <span className="ml-gurt-text">
              <span className="ml-gurt-dot" style={{ background: gurtDot }} />
              {primaryGurt}
            </span>
          </div>
        )}
        {/* Stile Pills */}
        <div className="ml-card-stile">
          {stileArr.slice(0, 2).map(s => (
            <span key={s} className="ml-stile-pill">{s}</span>
          ))}
          {stileArr.length > 2 && (
            <span className="ml-stile-pill ml-stile-pill--more">+{stileArr.length - 2}</span>
          )}
          {stileArr.length === 0 && (
            <span className="ml-info-stile-none">Keine Stile</span>
          )}
        </div>
        {/* Alter */}
        {age > 0 && <div className="ml-card-alter">{age} J.</div>}
      </div>
    </div>
  );
});

MemberCard.displayName = 'MemberCard';

// Virtualisiertes Grid für große Mitgliederlisten (100+ Mitglieder)
const VirtualizedMemberGrid = React.memo(({
  members,
  viewMode,
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

  // Listen-Ansicht
  if (viewMode === 'list') {
    return (
      <div ref={containerRef} className="ml-list-container">
        {safeMembers.map((mitglied) => (
          <MemberListRow
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
  }

  // Karten-Ansicht (Grid)
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

  // Erweiterte Filter-States
  const [filterStatus, setFilterStatus] = useState("aktiv"); // default: nur aktive zeigen
  const [filterGeschlecht, setFilterGeschlecht] = useState("");
  const [filterGeburtstag, setFilterGeburtstag] = useState("");
  const [filterMitgliedSeit, setFilterMitgliedSeit] = useState("");
  const [filterVertrag, setFilterVertrag] = useState("");
  const [sortierung, setSortierung] = useState("nachname_az");
  const [showMehrFilter, setShowMehrFilter] = useState(false);
  const [savedLists, setSavedLists] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ml-saved-lists') || '[]'); } catch { return []; }
  });
  const [activeListId, setActiveListId] = useState(() => {
    const v = localStorage.getItem('ml-active-list-id');
    return v ? parseInt(v) : null;
  });
  const [showSaveListModal, setShowSaveListModal] = useState(false);
  const [showListenModal, setShowListenModal] = useState(false);
  const [saveListName, setSaveListName] = useState("");

  // Ansichts-Modus: 'list' (Standard) oder 'grid'
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('ml-view-mode') || 'list');

  const handleToggleViewMode = useCallback(() => {
    setViewMode(prev => {
      const next = prev === 'list' ? 'grid' : 'list';
      localStorage.setItem('ml-view-mode', next);
      return next;
    });
  }, []);

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

        // Gespeicherte aktive Liste auto-anwenden
        const activeId = parseInt(localStorage.getItem('ml-active-list-id') || '0');
        if (activeId) {
          const lists = JSON.parse(localStorage.getItem('ml-saved-lists') || '[]');
          const activeList = lists.find(l => l.id === activeId);
          if (activeList) {
            const f = activeList.filters;
            setFilterStil(f.filterStil || "");
            setFilterAlter(f.filterAlter || "");
            setFilterGurt(f.filterGurt || "");
            setFilterStatus(f.filterStatus || "aktiv");
            setFilterGeschlecht(f.filterGeschlecht || "");
            setFilterGeburtstag(f.filterGeburtstag || "");
            setFilterMitgliedSeit(f.filterMitgliedSeit || "");
            setFilterVertrag(f.filterVertrag || "");
            setSortierung(f.sortierung || "nachname_az");
          }
        }
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

    // Status-Filter (aktiv/inaktiv/alle)
    if (filterStatus === 'aktiv') {
      filtered = filtered.filter(m => m.aktiv === 1 || m.aktiv === true);
    } else if (filterStatus === 'inaktiv') {
      filtered = filtered.filter(m => m.aktiv === 0 || m.aktiv === false);
    }
    // 'alle' = kein Filter

    // Geschlecht-Filter
    if (filterGeschlecht) {
      filtered = filtered.filter(m => m.geschlecht === filterGeschlecht);
    }

    // Geburtstag-Filter
    if (filterGeburtstag) {
      const today = new Date();
      filtered = filtered.filter(m => {
        if (!m.geburtsdatum) return false;
        const geb = new Date(m.geburtsdatum);
        if (filterGeburtstag === 'diesen_monat') {
          return geb.getMonth() === today.getMonth();
        }
        if (filterGeburtstag === 'naechste_7') {
          const in7 = new Date(today); in7.setDate(today.getDate() + 7);
          let bd = new Date(today.getFullYear(), geb.getMonth(), geb.getDate());
          if (bd < today) bd = new Date(today.getFullYear() + 1, geb.getMonth(), geb.getDate());
          return bd >= today && bd <= in7;
        }
        if (filterGeburtstag === 'naechste_30') {
          const in30 = new Date(today); in30.setDate(today.getDate() + 30);
          let bd = new Date(today.getFullYear(), geb.getMonth(), geb.getDate());
          if (bd < today) bd = new Date(today.getFullYear() + 1, geb.getMonth(), geb.getDate());
          return bd >= today && bd <= in30;
        }
        return true;
      });
    }

    // Mitglied-seit-Filter
    if (filterMitgliedSeit) {
      const today = new Date();
      filtered = filtered.filter(m => {
        if (!m.eintrittsdatum) return false;
        const eintritt = new Date(m.eintrittsdatum);
        if (filterMitgliedSeit === 'dieses_jahr') {
          return eintritt.getFullYear() === today.getFullYear();
        }
        if (filterMitgliedSeit === 'letztes_jahr') {
          return eintritt.getFullYear() === today.getFullYear() - 1;
        }
        const monate = parseInt(filterMitgliedSeit);
        if (!isNaN(monate)) {
          const cutoff = new Date(today); cutoff.setMonth(today.getMonth() - monate);
          return eintritt >= cutoff;
        }
        return true;
      });
    }

    // Vertrag-Filter
    if (filterVertrag) {
      filtered = filtered.filter(m => {
        if (filterVertrag === 'kein') return !m.vertrag_status;
        if (filterVertrag === 'aktiv') return m.vertrag_status === 'aktiv';
        if (filterVertrag === 'ruhepause') return m.vertrag_status === 'ruhepause';
        if (filterVertrag === 'gekuendigt') return m.vertrag_status === 'gekuendigt' || m.vertrag_status === 'beendet';
        // Läuft ab in X Monaten
        const monate = parseInt(filterVertrag);
        if (!isNaN(monate) && m.vertrag_status === 'aktiv' && m.vertrag_ende) {
          const today = new Date();
          const cutoff = new Date(today); cutoff.setMonth(today.getMonth() + monate);
          const ende = new Date(m.vertrag_ende);
          return ende >= today && ende <= cutoff;
        }
        return false;
      });
    }

    // Sortierung
    const sortFns = {
      'nachname_az': (a, b) => (a.nachname || '').localeCompare(b.nachname || '', 'de'),
      'nachname_za': (a, b) => (b.nachname || '').localeCompare(a.nachname || '', 'de'),
      'vorname_az': (a, b) => (a.vorname || '').localeCompare(b.vorname || '', 'de'),
      'vorname_za': (a, b) => (b.vorname || '').localeCompare(a.vorname || '', 'de'),
      'eintrittsdatum_neu': (a, b) => new Date(b.eintrittsdatum || 0) - new Date(a.eintrittsdatum || 0),
      'eintrittsdatum_alt': (a, b) => new Date(a.eintrittsdatum || 0) - new Date(b.eintrittsdatum || 0),
      'alter_jung': (a, b) => new Date(b.geburtsdatum || 0) - new Date(a.geburtsdatum || 0),
      'alter_alt': (a, b) => new Date(a.geburtsdatum || 0) - new Date(b.geburtsdatum || 0),
    };
    if (sortierung && sortFns[sortierung]) {
      filtered = [...filtered].sort(sortFns[sortierung]);
    }

    return filtered;
  }, [mitglieder, searchTerm, selectedLetter, filterStil, filterAlter, filterGurt, filterStatus, filterGeschlecht, filterGeburtstag, filterMitgliedSeit, filterVertrag, sortierung]);

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
    setFilterStatus("aktiv");
    setFilterGeschlecht("");
    setFilterGeburtstag("");
    setFilterMitgliedSeit("");
    setFilterVertrag("");
    setSortierung("nachname_az");
    setActiveListId(null);
    localStorage.removeItem('ml-active-list-id');
  }, []);

  // Memoized check für aktive Filter
  const hasActiveFilters = useMemo(() => {
    return searchTerm || selectedLetter || filterStil || filterAlter || filterGurt ||
      filterStatus !== 'aktiv' || filterGeschlecht || filterGeburtstag || filterMitgliedSeit ||
      filterVertrag || sortierung !== 'nachname_az';
  }, [searchTerm, selectedLetter, filterStil, filterAlter, filterGurt, filterStatus, filterGeschlecht, filterGeburtstag, filterMitgliedSeit, filterVertrag, sortierung]);

  const handleSaveList = useCallback(() => {
    if (!saveListName.trim()) return;
    const newList = {
      id: Date.now(),
      name: saveListName.trim(),
      count: filteredMitglieder.length,
      filters: { filterStil, filterAlter, filterGurt, filterStatus, filterGeschlecht, filterGeburtstag, filterMitgliedSeit, filterVertrag, sortierung }
    };
    const updated = [...savedLists, newList];
    setSavedLists(updated);
    localStorage.setItem('ml-saved-lists', JSON.stringify(updated));
    setSaveListName("");
    setShowSaveListModal(false);
  }, [saveListName, savedLists, filteredMitglieder.length, filterStil, filterAlter, filterGurt, filterStatus, filterGeschlecht, filterGeburtstag, filterMitgliedSeit, filterVertrag, sortierung]);

  const handleLoadList = useCallback((list) => {
    const f = list.filters;
    setFilterStil(f.filterStil || "");
    setFilterAlter(f.filterAlter || "");
    setFilterGurt(f.filterGurt || "");
    setFilterStatus(f.filterStatus || "aktiv");
    setFilterGeschlecht(f.filterGeschlecht || "");
    setFilterGeburtstag(f.filterGeburtstag || "");
    setFilterMitgliedSeit(f.filterMitgliedSeit || "");
    setFilterVertrag(f.filterVertrag || "");
    setSortierung(f.sortierung || "nachname_az");
    setSelectedLetter("");
    setSearchTerm("");
    // Aktive Liste merken → beim nächsten Öffnen automatisch anwenden
    setActiveListId(list.id);
    localStorage.setItem('ml-active-list-id', String(list.id));
  }, []);

  const handleDeleteList = useCallback((id, e) => {
    e.stopPropagation();
    const updated = savedLists.filter(l => l.id !== id);
    setSavedLists(updated);
    localStorage.setItem('ml-saved-lists', JSON.stringify(updated));
    // Falls die gelöschte Liste aktiv war, zurücksetzen
    if (activeListId === id) {
      setActiveListId(null);
      localStorage.removeItem('ml-active-list-id');
    }
  }, [savedLists, activeListId]);

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

        {/* Zeile 2: Status-Chips + Suchfeld + Filter + Aktionen */}
        <div className="ml-toolbar-row">
          {/* Status-Chips */}
          <div className="ml-status-chips-inline">
            {[
              { value: 'aktiv', label: 'Aktiv' },
              { value: 'inaktiv', label: 'Inaktiv' },
              { value: 'alle', label: 'Alle' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterStatus(opt.value)}
                className={`ml-status-chip ${filterStatus === opt.value ? `ml-status-chip--${opt.value}` : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

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

          {/* Mehr Filter Toggle */}
          <button
            onClick={() => setShowMehrFilter(prev => !prev)}
            className={`ml-mehr-filter-btn ${showMehrFilter ? 'active' : ''} ${(filterStil || filterAlter || filterGurt || filterGeschlecht || filterGeburtstag || filterMitgliedSeit || filterVertrag) && !showMehrFilter ? 'ml-mehr-filter-btn--has-active' : ''}`}
          >
            ⚙ Filter{showMehrFilter ? ' ▲' : ' ▼'}
          </button>

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
              <span>{t('common:labels.actions')}</span>
              <span className="ml-chevron-icon">▾</span>
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

              <div className="ml-dropdown-divider" />

              <button
                className="actions-dropdown-item ml-dropdown-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(false);
                  setShowListenModal(true);
                }}
              >
                <span className="ml-icon-lg">📋</span>
                <span>Gespeicherte Listen{savedLists.length > 0 ? ` (${savedLists.length})` : ''}</span>
              </button>

              <button
                className="actions-dropdown-item ml-dropdown-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(false);
                  setShowSaveListModal(true);
                }}
              >
                <span className="ml-icon-lg">💾</span>
                <span>Liste speichern</span>
              </button>
            </div>,
            document.body
          )}

          {/* Ansicht umschalten: Liste / Karten */}
          <button
            onClick={handleToggleViewMode}
            className="ml-view-toggle-btn"
            title={viewMode === 'list' ? 'Karten-Ansicht' : 'Listen-Ansicht'}
          >
            {viewMode === 'list' ? '⊞' : '☰'}
          </button>

          {/* Anzahl Mitglieder */}
          <span className="ml-member-count">
            {filteredMitglieder.length}/{mitglieder.length}
          </span>
        </div>

        {/* Aktive Liste Indikator */}
        {activeListId && savedLists.find(l => l.id === activeListId) && (
          <div className="ml-status-row">
            <span className="ml-active-list-indicator">
              ✓ {savedLists.find(l => l.id === activeListId)?.name}
            </span>
          </div>
        )}

        {/* Zeile 4: Erweiterte Filter (aufklappbar) */}
        {showMehrFilter && (
          <div className="ml-mehr-filter-panel">
            <div className="ml-mehr-filter-grid">
              {/* Stil */}
              <div className="ml-filter-group">
                <label className="ml-filter-label">Stil</label>
                <select
                  value={filterStil}
                  onChange={(e) => setFilterStil(e.target.value)}
                  className={`filter-select ml-filter-select ${filterStil ? 'active' : ''}`}
                >
                  <option value="">{t('list.filters.allStyles', 'Alle Stile')}</option>
                  <option value="__OHNE_STIL__">❌ {t('list.filters.noStyle', 'Ohne Stil')}</option>
                  {availableStile.map(stil => (
                    <option key={stil} value={stil}>{stil}</option>
                  ))}
                </select>
              </div>

              {/* Alter */}
              <div className="ml-filter-group">
                <label className="ml-filter-label">Alter</label>
                <select
                  value={filterAlter}
                  onChange={(e) => setFilterAlter(e.target.value)}
                  className={`filter-select ml-filter-select ${filterAlter ? 'active' : ''}`}
                >
                  <option value="">{t('list.filters.age', 'Alle')}</option>
                  <option value="0-6">0–6 J.</option>
                  <option value="7-12">7–12 J.</option>
                  <option value="13-17">13–17 J.</option>
                  <option value="18-25">18–25 J.</option>
                  <option value="26-40">26–40 J.</option>
                  <option value="41+">41+ J.</option>
                </select>
              </div>

              {/* Gurt */}
              <div className="ml-filter-group">
                <label className="ml-filter-label">Gurt</label>
                <select
                  value={filterGurt}
                  onChange={(e) => setFilterGurt(e.target.value)}
                  className={`filter-select ml-filter-select ${filterGurt ? 'active' : ''}`}
                >
                  <option value="">{t('list.filters.allBelts', 'Alle Gurte')}</option>
                  {availableGurte.map(gurt => (
                    <option key={gurt} value={gurt}>{gurt}</option>
                  ))}
                </select>
              </div>

              {/* Geschlecht */}
              <div className="ml-filter-group">
                <label className="ml-filter-label">Geschlecht</label>
                <select
                  value={filterGeschlecht}
                  onChange={e => setFilterGeschlecht(e.target.value)}
                  className={`filter-select ml-filter-select ${filterGeschlecht ? 'active' : ''}`}
                >
                  <option value="">Alle</option>
                  <option value="m">Männlich</option>
                  <option value="w">Weiblich</option>
                  <option value="d">Divers</option>
                </select>
              </div>

              {/* Geburtstag */}
              <div className="ml-filter-group">
                <label className="ml-filter-label">Geburtstag</label>
                <select
                  value={filterGeburtstag}
                  onChange={e => setFilterGeburtstag(e.target.value)}
                  className={`filter-select ml-filter-select ${filterGeburtstag ? 'active' : ''}`}
                >
                  <option value="">Alle</option>
                  <option value="diesen_monat">Diesen Monat</option>
                  <option value="naechste_7">Nächste 7 Tage</option>
                  <option value="naechste_30">Nächste 30 Tage</option>
                </select>
              </div>

              {/* Mitglied seit */}
              <div className="ml-filter-group">
                <label className="ml-filter-label">Mitglied seit</label>
                <select
                  value={filterMitgliedSeit}
                  onChange={e => setFilterMitgliedSeit(e.target.value)}
                  className={`filter-select ml-filter-select ${filterMitgliedSeit ? 'active' : ''}`}
                >
                  <option value="">Alle</option>
                  <option value="3">Letzten 3 Monate</option>
                  <option value="6">Letzten 6 Monate</option>
                  <option value="12">Letzten 12 Monate</option>
                  <option value="dieses_jahr">Dieses Jahr</option>
                  <option value="letztes_jahr">Letztes Jahr</option>
                </select>
              </div>

              {/* Vertrag */}
              <div className="ml-filter-group">
                <label className="ml-filter-label">Vertrag</label>
                <select
                  value={filterVertrag}
                  onChange={e => setFilterVertrag(e.target.value)}
                  className={`filter-select ml-filter-select ${filterVertrag ? 'active' : ''}`}
                >
                  <option value="">Alle</option>
                  <option value="aktiv">Aktiver Vertrag</option>
                  <option value="ruhepause">In Ruhepause</option>
                  <option value="gekuendigt">Gekündigt/Beendet</option>
                  <option value="kein">Kein Vertrag</option>
                  <option value="3">Läuft ab: 3 Monate</option>
                  <option value="6">Läuft ab: 6 Monate</option>
                  <option value="12">Läuft ab: 12 Monate</option>
                </select>
              </div>

              {/* Sortierung */}
              <div className="ml-filter-group">
                <label className="ml-filter-label">Sortierung</label>
                <select
                  value={sortierung}
                  onChange={e => setSortierung(e.target.value)}
                  className="filter-select ml-filter-select"
                >
                  <option value="nachname_az">Nachname A–Z</option>
                  <option value="nachname_za">Nachname Z–A</option>
                  <option value="vorname_az">Vorname A–Z</option>
                  <option value="vorname_za">Vorname Z–A</option>
                  <option value="eintrittsdatum_neu">Neueste Mitglieder zuerst</option>
                  <option value="eintrittsdatum_alt">Älteste Mitglieder zuerst</option>
                  <option value="alter_jung">Jüngste zuerst</option>
                  <option value="alter_alt">Älteste zuerst</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Zeile 5: Nachname-Label + ABC-Buchstaben */}
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
          viewMode={viewMode}
          selectionMode={selectionMode}
          selectedMembers={selectedMembers}
          onToggleSelection={handleToggleMemberSelection}
          onNavigate={(id) => navigate(`/dashboard/mitglieder/${id}`)}
          t={t}
        />
      )}

      {/* Modal: Gespeicherte Listen */}
      {showListenModal && (
        <div className="ml-modal-overlay" onClick={() => setShowListenModal(false)}>
          <div className="ml-modal-box ml-listen-modal-box" onClick={e => e.stopPropagation()}>
            <div className="ml-listen-modal-header">
              <h3 className="ml-modal-title">Gespeicherte Listen</h3>
              <button className="ml-modal-close-btn" onClick={() => setShowListenModal(false)}>×</button>
            </div>

            {savedLists.length === 0 ? (
              <div className="ml-listen-empty">
                <span className="ml-listen-empty-icon">📋</span>
                <p>Noch keine Listen gespeichert.</p>
                <p className="ml-listen-empty-hint">Filter setzen und auf „Liste speichern" klicken.</p>
              </div>
            ) : (
              <ul className="ml-listen-list">
                {savedLists.map(list => {
                  const isActive = activeListId === list.id;
                  const labels = [];
                  const f = list.filters || {};
                  if (f.filterStatus && f.filterStatus !== 'aktiv') labels.push(f.filterStatus === 'inaktiv' ? 'Inaktiv' : 'Alle');
                  if (f.filterGeschlecht) labels.push({ m: 'Männlich', w: 'Weiblich', d: 'Divers' }[f.filterGeschlecht] || f.filterGeschlecht);
                  if (f.filterGeburtstag) labels.push('Geburtstag');
                  if (f.filterMitgliedSeit) labels.push(`Seit ${f.filterMitgliedSeit} Mon.`);
                  if (f.filterVertrag) labels.push('Vertrag');
                  if (f.filterStil) labels.push(f.filterStil);
                  if (f.filterGurt) labels.push(f.filterGurt);
                  if (f.filterAlter) labels.push(`${f.filterAlter} J.`);
                  return (
                    <li
                      key={list.id}
                      className={`ml-listen-item ${isActive ? 'ml-listen-item--active' : ''}`}
                      onClick={() => { handleLoadList(list); setShowListenModal(false); }}
                    >
                      <div className="ml-listen-item-main">
                        <span className="ml-listen-item-name">
                          {isActive && <span className="ml-listen-item-check">✓ </span>}
                          {list.name}
                        </span>
                        {labels.length > 0 && (
                          <span className="ml-listen-item-tags">
                            {labels.map((l, i) => <span key={i} className="ml-listen-tag">{l}</span>)}
                          </span>
                        )}
                      </div>
                      <button
                        className="ml-listen-delete-btn"
                        onClick={(e) => { handleDeleteList(list.id, e); }}
                        title="Liste löschen"
                      >🗑</button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="ml-listen-modal-footer">
              <button
                className="ml-listen-new-btn"
                onClick={() => { setShowListenModal(false); setShowSaveListModal(true); }}
              >
                + Aktuelle Filter als Liste speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Filterliste speichern */}
      {showSaveListModal && (
        <div className="ml-modal-overlay" onClick={() => setShowSaveListModal(false)}>
          <div className="ml-modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="ml-modal-title">Liste speichern</h3>
            <p className="ml-modal-desc">
              Aktuelle Filter werden gespeichert ({filteredMitglieder.length} Mitglieder).
            </p>
            <input
              type="text"
              value={saveListName}
              onChange={e => setSaveListName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveList()}
              placeholder="Name der Liste, z.B. &quot;Geburtstage März&quot;"
              className="ml-modal-input"
              autoFocus
            />
            <div className="ml-modal-actions">
              <button onClick={handleSaveList} className="ml-modal-save-btn" disabled={!saveListName.trim()}>
                Speichern
              </button>
              <button onClick={() => { setShowSaveListModal(false); setSaveListName(""); }} className="ml-modal-cancel-btn">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && <NeuesMitgliedAnlegen onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};

export default MitgliederListe;
