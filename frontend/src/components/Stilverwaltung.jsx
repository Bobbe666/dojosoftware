/*
================================================================================
STIL-VERWALTUNG REACT KOMPONENTE - MIT @DND-KIT DRAG & DROP v2.2
================================================================================
Diese Komponente verwaltet Kampfkunst-Stile, ihre Graduierungen und Prüfungsinhalte.
NEUE FEATURES v2.2: Moderne @dnd-kit Drag & Drop Implementation
DEPENDENCIES: npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
================================================================================
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// @dnd-kit imports nur für Graduierungen (Drag & Drop für Graduierungen bleibt)
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import config from '../config/config.js';
import "../styles/themes.css";       // Centralized theme system
import "../styles/components.css";   // Universal component styles
import '../styles/StilVerwaltung.css';
import '../styles/Statistiken.css';          // Statistiken Charts und Visualisierungen
import '../styles/StilVerwaltungOverrides.css';
import GurtStatistikItem from './GurtStatistikDropdown.jsx';  // Gurt-Statistik mit Dropdown // MUST be last - overrides !important rules

/**
 * SortableKatItem – außerhalb StilVerwaltung definiert damit React kein Re-Mount erzwingt
 */
const SortableKatItem = ({ kat, editId, editLabel, editIcon, saving,
  setEditId, setEditLabel, setEditIcon, onSaveEdit, onDelete,
  graduierungen, gradSelectId, setGradSelectId, onToggleGraduierung }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: kat.kategorie_id
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : 'auto',
    position: 'relative'
  };
  const isGradExpanded = gradSelectId === kat.kategorie_id;
  const aktiveIds = kat.aktive_graduierung_ids; // null = alle; Array = nur diese
  const inaktivCount = aktiveIds ? graduierungen.filter(g => !aktiveIds.includes(g.graduierung_id)).length : 0;

  return (
    <div ref={setNodeRef} style={style} className={`pi-kat-item-wrap${isDragging ? ' pi-kat-item--dragging' : ''}`}>
      <div className="pi-kat-item">
        {editId === kat.kategorie_id ? (
          <div className="pi-kat-edit-row">
            <input type="text" value={editIcon} onChange={e => setEditIcon(e.target.value)}
              maxLength={4} className="pi-kat-icon-input" placeholder="Icon" />
            <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)}
              className="pi-kat-label-input" placeholder="Bezeichnung" autoFocus
              onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(kat.kategorie_id); if (e.key === 'Escape') setEditId(null); }} />
            <button className="btn btn-primary btn-sm" onClick={() => onSaveEdit(kat.kategorie_id)} disabled={saving || !editLabel.trim()}>✓</button>
            <button className="btn btn-neutral btn-sm" onClick={() => setEditId(null)}>✕</button>
          </div>
        ) : (
          <>
            <span className="pi-kat-drag-handle" {...attributes} {...listeners} title="Verschieben">⠿</span>
            <span className="pi-kat-icon">{kat.icon}</span>
            <span className="pi-kat-label">{kat.label}</span>
            <div className="pi-kat-actions">
              <button
                className={`pi-kat-grad-btn${isGradExpanded ? ' active' : ''}${inaktivCount > 0 ? ' has-inactive' : ''}`}
                onClick={() => setGradSelectId(isGradExpanded ? null : kat.kategorie_id)}
                title="Gilt für Graduierungen"
              >
                🎖️ {aktiveIds ? `${aktiveIds.length}/${graduierungen.length}` : 'Alle'}
              </button>
              <button className="pi-kat-edit-btn"
                onClick={() => { setEditId(kat.kategorie_id); setEditLabel(kat.label); setEditIcon(kat.icon); }}
                title="Bearbeiten">✏️</button>
              <button className="pi-kat-del-btn" onClick={() => onDelete(kat)} disabled={saving} title="Löschen">🗑️</button>
            </div>
          </>
        )}
      </div>

      {isGradExpanded && (
        <div className="pi-kat-grad-select">
          <div className="pi-kat-grad-hint">Kategorie gilt für diese Graduierungen:</div>
          <div className="pi-kat-grad-list">
            {graduierungen.map(g => {
              const isActive = aktiveIds === null || aktiveIds.includes(g.graduierung_id);
              return (
                <label key={g.graduierung_id} className="pi-kat-grad-item">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => onToggleGraduierung(kat, g.graduierung_id)}
                  />
                  <span>{g.name}</span>
                </label>
              );
            })}
          </div>
          <button className="pi-kat-grad-all-btn"
            onClick={() => onToggleGraduierung(kat, null)}
            title="Alle aktivieren"
          >Alle aktivieren</button>
        </div>
      )}
    </div>
  );
};

const StilVerwaltung = () => {
  const navigate = useNavigate();
  const { stilId } = useParams();
  const { token, user } = useAuth();
  const { activeDojo } = useDojoContext();
  // Effektive Dojo-ID: für Super-Admin aus activeDojo, sonst aus JWT
  const effectiveDojoId = activeDojo?.id || user?.dojo_id || null;

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // Hauptdaten States
  const [stile, setStile] = useState([]);                    // Array aller Stile
  const [currentStil, setCurrentStil] = useState(null);      // Aktuell gewählter Stil
  const [loading, setLoading] = useState(false);             // Loading-Zustand
  const [error, setError] = useState('');                    // Fehlermeldungen
  const [success, setSuccess] = useState('');                // Erfolgsmeldungen
  const [activeTab, setActiveTab] = useState('allgemein');   // Aktiver Tab in Detail-Ansicht
  const [mitglieder, setMitglieder] = useState([]);          // Alle Mitglieder für Schüler-Zählung

  // Stilmitglieder States
  const [stilMitglieder, setStilMitglieder] = useState([]);
  const [alleDojMitglieder, setAlleDojMitglieder] = useState([]);
  const [stilMitgliederLoading, setStilMitgliederLoading] = useState(false);
  const [stilMitgliederSearch, setStilMitgliederSearch] = useState('');
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberPickerSearch, setMemberPickerSearch] = useState('');
  const memberPickerSearchRef = useRef(null);
  // Bulk-Gürtelzuweisung
  const [bulkGradMode, setBulkGradMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
  const [bulkTargetGradId, setBulkTargetGradId] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Statistiken States
  const [statistiken, setStatistiken] = useState(null);      // Stil-Statistiken (Schüler-Verteilung, etc.)
  const [pruefungsStats, setPruefungsStats] = useState(null); // Prüfungs-Statistiken
  const [loadingStats, setLoadingStats] = useState(false);   // Loading-Zustand für Statistiken

  // Formular States
  const [showCreateForm, setShowCreateForm] = useState(false);     // Modal für neuen Stil
  const [createStep, setCreateStep] = useState(1);                // Aktueller Schritt im Erstellungsprozess
  const [showEditGraduierung, setShowEditGraduierung] = useState(false); // Modal für Graduierung bearbeiten
  const [editingGraduierung, setEditingGraduierung] = useState(null);     // Zu bearbeitende Graduierung
  const [showInactiveStile, setShowInactiveStile] = useState(false);     // Toggle für inaktive Stile
  
  // Drag & Drop States (nur für Graduierungen)
  const [activeId, setActiveId] = useState(null);                  // Aktive Drag-ID (für Graduierungen)

  // Prüfungsinhalte Accordion State
  const [expandedGraduierungen, setExpandedGraduierungen] = useState([]); // Geöffnete Graduierungen im Prüfungsinhalte-Tab
  const [draggedGraduierung, setDraggedGraduierung] = useState(null); // Gezogene Graduierung

  // Prüfungsinhalte States
  const [showPruefungsinhaltForm, setShowPruefungsinhaltForm] = useState(false); // Modal für Prüfungsinhalt
  const [editingPruefungsinhalt, setEditingPruefungsinhalt] = useState(null);   // Zu bearbeitender Inhalt
  const [selectedGraduierung, setSelectedGraduierung] = useState(null);          // Graduierung für den Inhalt
  const [selectedKategorie, setSelectedKategorie] = useState('');                // Kategorie (Grundtechniken, Kata, etc.)
  const [showPruefungsinhalteModal, setShowPruefungsinhalteModal] = useState(false); // Modal zum Anzeigen der Prüfungsinhalte
  const [viewingGraduierung, setViewingGraduierung] = useState(null);            // Graduierung deren Inhalte angezeigt werden

  // Prüfungsinhalte Kategorien States
  const [pruefungsinhalteSubTab, setPruefungsinhalteSubTab] = useState('inhalte');
  const [stilKategorien, setStilKategorien] = useState([]);
  const [kategorienLoading, setKategorienLoading] = useState(false);
  const [katGradSelectId, setKatGradSelectId] = useState(null); // geöffnete Graduierungsauswahl
  // "Inhalte übernehmen aus..."-UI
  const [copyFromGradId, setCopyFromGradId] = useState(null);   // welche Grad zeigt das Copy-Panel
  const [copySourceId, setCopySourceId] = useState('');          // ausgewählte Quell-Grad


  // Stil-Erstellung Form Data - Erweitert
  const [formData, setFormData] = useState({
    name: '',
    beschreibung: '',
    aktiv: true,
    kategorie: 'kampfkunst', // kampfkunst, selbstverteidigung, fitness
    schwierigkeitsgrad: 'mittel', // anfaenger, mittel, fortgeschritten
    altergruppe: 'alle', // kinder, jugendliche, erwachsene, alle
    trainingsdauer: 60, // Minuten
    ausruestung: [] // Array von benötigter Ausrüstung
  });



  // ============================================================================
  // KONSTANTEN UND KONFIGURATION
  // ============================================================================
  
  // API Base URL mit Fallback (apiBaseUrl enthält bereits /api)
  const API_BASE = config?.apiBaseUrl || '/api';

  // Erweiterte Standard-Gürtel mit Primär- und Sekundärfarben für alle Kampfkünste
  const standardGuertel = [
    // === GRUNDSTUFE (Anfänger) ===
    { name: 'Weißgurt', primaer: '#FFFFFF', sekundaer: null, kategorie: 'grundstufe', reihenfolge: 1 },
    { name: 'Weiß-Gelbgurt', primaer: '#FFFFFF', sekundaer: '#FFD700', kategorie: 'grundstufe', reihenfolge: 2 },
    { name: 'Gelbgurt', primaer: '#FFD700', sekundaer: null, kategorie: 'grundstufe', reihenfolge: 3 },
    { name: 'Gelb-Grüngurt', primaer: '#FFD700', sekundaer: '#32CD32', kategorie: 'grundstufe', reihenfolge: 4 },
    { name: 'Gelb-Orangegurt', primaer: '#FFD700', sekundaer: '#FF8C00', kategorie: 'grundstufe', reihenfolge: 5 },
    { name: 'Orangegurt', primaer: '#FF8C00', sekundaer: null, kategorie: 'grundstufe', reihenfolge: 6 },

    // === MITTELSTUFE (Fortgeschritten) ===
    { name: 'Orange-Grüngurt', primaer: '#FF8C00', sekundaer: '#32CD32', kategorie: 'mittelstufe', reihenfolge: 7 },
    { name: 'Grüngurt', primaer: '#32CD32', sekundaer: null, kategorie: 'mittelstufe', reihenfolge: 8 },
    { name: 'Grün-Blaugurt', primaer: '#32CD32', sekundaer: '#0066CC', kategorie: 'mittelstufe', reihenfolge: 9 },
    { name: 'Blaugurt', primaer: '#0066CC', sekundaer: null, kategorie: 'mittelstufe', reihenfolge: 10 },

    // === OBERSTUFE (Fortgeschritten Plus) ===
    { name: 'Blau-Rotgurt', primaer: '#0066CC', sekundaer: '#DC143C', kategorie: 'oberstufe', reihenfolge: 11 },
    { name: 'Rotgurt', primaer: '#DC143C', sekundaer: null, kategorie: 'oberstufe', reihenfolge: 12 },
    { name: 'Blau-Braungurt', primaer: '#0066CC', sekundaer: '#8B4513', kategorie: 'oberstufe', reihenfolge: 13 },
    { name: 'Braungurt', primaer: '#8B4513', sekundaer: null, kategorie: 'oberstufe', reihenfolge: 14 },
    { name: 'Rot-Schwarzgurt', primaer: '#DC143C', sekundaer: '#000000', kategorie: 'oberstufe', reihenfolge: 15 },
    { name: 'Braun-Schwarzgurt', primaer: '#8B4513', sekundaer: '#000000', kategorie: 'oberstufe', reihenfolge: 16 },

    // === DAN-GRADE (Schwarzgurt-Stufen) - Alle durchgehend schwarz ===
    { name: '1.DAN Schwarzgurt', primaer: '#000000', sekundaer: null, kategorie: 'dan', dan: 1, reihenfolge: 17 },
    { name: '2.DAN Schwarzgurt', primaer: '#000000', sekundaer: null, kategorie: 'dan', dan: 2, reihenfolge: 18 },
    { name: '3.DAN Schwarzgurt', primaer: '#000000', sekundaer: null, kategorie: 'dan', dan: 3, reihenfolge: 19 },
    { name: '4.DAN Schwarzgurt', primaer: '#000000', sekundaer: null, kategorie: 'dan', dan: 4, reihenfolge: 20 },
    { name: '5.DAN Schwarzgurt', primaer: '#000000', sekundaer: null, kategorie: 'dan', dan: 5, reihenfolge: 21 },
    { name: '6.DAN Schwarzgurt', primaer: '#000000', sekundaer: null, kategorie: 'dan', dan: 6, reihenfolge: 22 },
    { name: '7.DAN Schwarzgurt', primaer: '#000000', sekundaer: null, kategorie: 'dan', dan: 7, reihenfolge: 23 },
    { name: '8.DAN Schwarzgurt', primaer: '#000000', sekundaer: null, kategorie: 'dan', dan: 8, reihenfolge: 24 },
    { name: '9.DAN Schwarzgurt', primaer: '#000000', sekundaer: null, kategorie: 'dan', dan: 9, reihenfolge: 25 },
    { name: '10.DAN Schwarzgurt', primaer: '#000000', sekundaer: null, kategorie: 'dan', dan: 10, reihenfolge: 26 },

    // === MEISTER-GRADE (Rot-Gürtel) ===
    { name: 'Rot-Weißgurt', primaer: '#DC143C', sekundaer: '#FFFFFF', kategorie: 'meister', reihenfolge: 27 }
  ];

  // ============================================================================
  // GÜRTEL-VORSCHAU KOMPONENTE
  // ============================================================================
  
  /**
   * BeltPreview - Zeigt eine visuelle Darstellung eines Gürtels an
   * @param {string} primaer - Hauptfarbe des Gürtels (HEX)
   * @param {string|null} sekundaer - Optionale Sekundärfarbe für Streifen (HEX) 
   * @param {string} size - Größe: 'small', 'normal', 'large'
   * @param {string} className - Zusätzliche CSS-Klasse
   */
  const BeltPreview = ({ primaer, sekundaer, size = 'normal', className = '' }) => {
    // Bestimme CSS-Klasse basierend auf Größe
    const sizeClass = {
      'small': 'belt-preview-small',
      'normal': 'belt-preview',
      'large': 'belt-preview-large'
    }[size] || 'belt-preview';
    
    return (
      <div className={`${sizeClass} ${className}`} style={{ '--belt-primaer': primaer || '#CCCCCC' }}>
        {/* Basis-Gürtel mit Primärfarbe */}
        <div className="belt-base">
          {/* Sekundärer Streifen wenn vorhanden */}
          {sekundaer && (
            <div className="belt-stripe" style={{ '--belt-sekundaer': sekundaer }} />
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // @DND-KIT DRAG & DROP FUNKTIONEN
  // ============================================================================

  /**
   * Behandelt den Start eines Drag-Vorgangs
   * @param {Object} event - DragStart Event von @dnd-kit
   */
  const handleDragStart = (event) => {
    const { active } = event;
    console.log('🚀 Drag Start:', active.id);
    setActiveId(active.id);
    
    // Finde die gezogene Graduierung für das Overlay
    const graduierung = currentStil?.graduierungen?.find(
      g => g.graduierung_id.toString() === active.id
    );
    console.log('📋 Gefundene Graduierung für Drag:', graduierung?.name);
    setDraggedGraduierung(graduierung);
  };

  /**
   * Behandelt das Ende eines Drag-Vorgangs
   * @param {Object} event - DragEnd Event von @dnd-kit
   */
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    console.log('🏁 Drag End:', { activeId: active.id, overId: over?.id });
    
    // Reset Drag-States
    setActiveId(null);
    setDraggedGraduierung(null);

    // Überprüfe ob Drop gültig ist
    if (!over || active.id === over.id) {
      console.log('❌ Drag abgebrochen: over=', over, 'same id=', active.id === over?.id);
      return;
    }

    // Aktuelle Graduierungen sortiert holen
    const graduierungen = [...(currentStil?.graduierungen || [])]
      .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));

    const oldIndex = graduierungen.findIndex(
      g => g.graduierung_id.toString() === active.id
    );
    const newIndex = graduierungen.findIndex(
      g => g.graduierung_id.toString() === over.id
    );

    if (oldIndex !== -1 && newIndex !== -1) {
      console.log('✅ Indices gefunden:', { oldIndex, newIndex });
      
      // Reorder mit @dnd-kit arrayMove
      const reorderedGraduierungen = arrayMove(graduierungen, oldIndex, newIndex);
      
      // Neue Reihenfolge zuweisen (1-basiert)
      const updatedGraduierungen = reorderedGraduierungen.map((grad, index) => ({
        ...grad,
        reihenfolge: index + 1
      }));

      console.log('🔄 Neue Reihenfolge:', updatedGraduierungen.map(g => `${g.name}: ${g.reihenfolge}`));

      // Optimistic Update - UI sofort aktualisieren
      setCurrentStil({
        ...currentStil,
        graduierungen: updatedGraduierungen
      });

      // Backend-Update
      try {
        console.log('📡 Sende API Request...');
        await updateGraduierungsReihenfolge(updatedGraduierungen);
        setSuccess('Reihenfolge erfolgreich aktualisiert!');
        setTimeout(() => setSuccess(''), 2000);
        console.log('✅ API Request erfolgreich');
      } catch (err) {
        console.error('❌ Fehler beim Aktualisieren der Reihenfolge:', err);
        setError('Reihenfolge konnte nicht gespeichert werden');
        // Rollback bei Fehler
        loadStil(currentStil.stil_id);
      }
    } else {
      console.log('❌ Indices nicht gefunden:', { oldIndex, newIndex });
    }
  };

  /**
   * Sendet die aktualisierte Graduierungs-Reihenfolge an das Backend
   * @param {Array} graduierungen - Array der Graduierungen mit neuer Reihenfolge
   */
  const updateGraduierungsReihenfolge = async (graduierungen) => {
    const response = await fetch(`${API_BASE}/stile/${currentStil.stil_id}/graduierungen/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        graduierungen: graduierungen.map(g => ({
          graduierung_id: g.graduierung_id,
          reihenfolge: g.reihenfolge
        }))
      })
    });

    if (!response.ok) {
      throw new Error('Fehler beim Aktualisieren der Reihenfolge');
    }

    return await response.json();
  };

  /**
   * Speichert die Änderungen einer bearbeiteten Graduierung
   */
  const saveGraduierungEdit = async () => {
    if (!editingGraduierung || !editingGraduierung.name?.trim()) {
      setError('Name ist erforderlich');
      return;
    }

    setLoading(true);
    try {
      const graduierungData = {
        name: editingGraduierung.name.trim(),
        reihenfolge: editingGraduierung.reihenfolge || 1,
        trainingsstunden_min: editingGraduierung.trainingsstunden_min || 0,
        mindestzeit_monate: editingGraduierung.mindestzeit_monate || 0,
        farbe_hex: editingGraduierung.farbe_hex || '#FFFFFF',
        farbe_sekundaer: editingGraduierung.farbe_sekundaer || null,
        kategorie: editingGraduierung.kategorie || null,
        dan_grad: editingGraduierung.dan_grad || null,
        aktiv: editingGraduierung.aktiv !== false ? 1 : 0
      };

      console.log('💾 Speichere Graduierung:', graduierungData);

      const response = await fetch(`${API_BASE}/stile/graduierungen/${editingGraduierung.graduierung_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graduierungData)
      });

      if (response.ok) {
        setSuccess('Graduierung erfolgreich aktualisiert!');
        setShowEditGraduierung(false);
        setEditingGraduierung(null);
        
        // Einfache Lösung: Lade nur den aktuellen Stil neu
        setTimeout(async () => {
          if (currentStil) {
            await loadStil(currentStil.stil_id);
          }
        }, 100);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Fehler beim Speichern der Graduierung');
      }
    } catch (err) {
      console.error('❌ Fehler beim Speichern der Graduierung:', err);
      setError('Netzwerkfehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verschiebt eine Graduierung in der Reihenfolge nach oben
   * @param {Object} graduierung - Zu verschiebende Graduierung
   */
  const moveGraduierungUp = async (graduierung) => {
    try {
      const sortedGrads = [...currentStil.graduierungen].sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
      const currentIndex = sortedGrads.findIndex(g => g.graduierung_id === graduierung.graduierung_id);
      
      if (currentIndex > 0) {
        const newGraduierungen = arrayMove(sortedGrads, currentIndex, currentIndex - 1);
        
        // Neue Reihenfolgen zuweisen
        newGraduierungen.forEach((grad, index) => {
          grad.reihenfolge = index + 1;
        });

        // UI sofort aktualisieren
        setCurrentStil({
          ...currentStil,
          graduierungen: newGraduierungen
        });

        // Backend im Hintergrund aktualisieren (ohne await)
        updateGraduierungsReihenfolge(newGraduierungen).catch(err => {
          console.error('Backend update failed:', err);
          setError('Fehler beim Speichern der Reihenfolge');
        });
      }
    } catch (err) {
      setError('Fehler beim Verschieben');
    }
  };

  /**
   * Verschiebt eine Graduierung in der Reihenfolge nach unten
   * @param {Object} graduierung - Zu verschiebende Graduierung
   */
  const moveGraduierungDown = async (graduierung) => {
    try {
      const sortedGrads = [...currentStil.graduierungen].sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
      const currentIndex = sortedGrads.findIndex(g => g.graduierung_id === graduierung.graduierung_id);
      
      if (currentIndex >= 0 && currentIndex < sortedGrads.length - 1) {
        const newGraduierungen = arrayMove(sortedGrads, currentIndex, currentIndex + 1);
        
        // Neue Reihenfolgen zuweisen
        newGraduierungen.forEach((grad, index) => {
          grad.reihenfolge = index + 1;
        });

        // UI sofort aktualisieren
        setCurrentStil({
          ...currentStil,
          graduierungen: newGraduierungen
        });

        // Backend im Hintergrund aktualisieren (ohne await)
        updateGraduierungsReihenfolge(newGraduierungen).catch(err => {
          console.error('Backend update failed:', err);
          setError('Fehler beim Speichern der Reihenfolge');
        });
      }
    } catch (err) {
      setError('Fehler beim Verschieben');
    }
  };

  // ============================================================================
  // API-FUNKTIONEN
  // ============================================================================
  
  /**
   * Lädt alle Stile von der API
   */
  const loadStile = async () => {
    setLoading(true);
    console.log('🔄 Lade Stile von:', `${API_BASE}/stile`);
    console.log('🔧 API_BASE ist:', API_BASE);
    try {
      const response = await fetch(`${API_BASE}/stile`);
      console.log('📡 API Response Status:', response.status);
      console.log('📡 API Response OK:', response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Stile geladen:', data);
        console.log('✅ Anzahl Stile:', data.length);
        setStile(data);
      } else {
        const errorText = await response.text();
        console.error('❌ API Fehler:', response.status, errorText);
        setStile([]);
        setError(`API Fehler ${response.status}: ${errorText}`);
      }
    } catch (err) {
      console.error('❌ Fehler beim Laden der Stile:', err);
      setError('Stile konnten nicht geladen werden. Bitte Server prüfen.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Lädt die Prüfungsinhalte-Kategorien für einen Stil
   */
  const fetchStilKategorien = useCallback(async (stilId) => {
    if (!stilId) return;
    setKategorienLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stile/${stilId}/kategorien`);
      if (res.ok) {
        const data = await res.json();
        setStilKategorien(data.kategorien || []);
      }
    } catch (e) {
      console.error('Fehler beim Laden der Kategorien:', e);
    } finally {
      setKategorienLoading(false);
    }
  }, []);

  /**
   * Lädt einen spezifischen Stil mit allen Details
   * @param {number} id - Stil-ID
   */
  const loadStil = async (id) => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/stile/${id}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentStil(data);
        setPruefungsinhalteSubTab('inhalte');
        fetchStilKategorien(id);
        console.log('✅ Stil geladen:', data.name);
      } else {
        // Fallback: Suche im lokalen Array
        const stil = stile.find(s => s.stil_id === parseInt(id));
        if (stil) {
          setCurrentStil(stil);
          setPruefungsinhalteSubTab('inhalte');
          fetchStilKategorien(id);
        } else {
          setError('Stil nicht gefunden');
        }
      }
    } catch (err) {
      console.error('❌ Fehler beim Laden des Stils:', err);
      setError('Stil konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Erstellt einen neuen Stil
   */
  const createStil = async () => {
    // Validierung
    if (!formData.name.trim()) {
      setError('Stil-Name ist erforderlich');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/stile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const newStil = await response.json();
        setStile([...stile, newStil]);
        setSuccess(`Stil "${formData.name}" erfolgreich erstellt!`);
        setShowCreateForm(false);
        setFormData({ name: '', beschreibung: '', aktiv: true });
        setTimeout(() => setSuccess(''), 3000);
        console.log('✅ Stil erstellt:', newStil);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        setError(errorData.error || 'Fehler beim Erstellen des Stils');
      }
    } catch (err) {
      console.error('❌ Fehler beim Erstellen des Stils:', err);
      setError('Stil konnte nicht erstellt werden. Bitte Server prüfen.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Aktualisiert einen bestehenden Stil
   * @param {Object} updatedStilData - Neue Stil-Daten
   */
  const updateStil = async (updatedStilData) => {
    if (!currentStil) return;

    setLoading(true);
    try {
      console.log('📤 Sende Stil-Update:', updatedStilData);

      const response = await fetch(`${API_BASE}/stile/${currentStil.stil_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStilData)
      });

      if (response.ok) {
        const updatedStil = await response.json();
        console.log('✅ Stil-Update erfolgreich, Antwort:', updatedStil);

        // Aktualisiere currentStil mit der kompletten Antwort vom Backend
        setCurrentStil(updatedStil);
        setStile(stile.map(s => s.stil_id === currentStil.stil_id ? updatedStil : s));
        setSuccess('Stil erfolgreich aktualisiert!');
        setTimeout(() => setSuccess(''), 2000);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        console.error('❌ Stil-Update fehlgeschlagen:', errorData);
        setError(errorData.error || 'Fehler beim Aktualisieren des Stils');
      }
    } catch (err) {
      console.error('❌ Fehler beim Aktualisieren des Stils:', err);
      setError('Stil konnte nicht aktualisiert werden');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Löscht einen Stil mit Sicherheitsabfrage
   * @param {number} stilId - ID des zu löschenden Stils
   */
  const deleteStil = async (stilId) => {
    if (!stilId) return;

    // Finde den Stil
    const stil = stile.find(s => s.stil_id === stilId);
    if (!stil) return;

    // Bereits inaktiver Stil → direkt löschen anbieten
    if (!stil.aktiv) {
      const confirmDelete = confirm(
        `Stil "${stil.name}" ist bereits inaktiv.\nMöchten Sie ihn endgültig löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden!`
      );
      if (!confirmDelete) return;
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/stile/${stilId}`, { method: 'DELETE' });
        if (response.ok) {
          setStile(prev => prev.filter(s => s.stil_id !== stilId));
          setSuccess(`Stil "${stil.name}" wurde gelöscht.`);
          setTimeout(() => setSuccess(''), 3000);
        } else if (response.status === 409) {
          const errorData = await response.json().catch(() => ({}));
          setError(`Stil kann nicht gelöscht werden: ${errorData.error || 'Mitglieder noch zugeordnet'}`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          setError(errorData.error || 'Fehler beim Löschen');
        }
      } catch (err) {
        setError('Stil konnte nicht gelöscht werden');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Prüfe ob aktiver Stil Daten hat
    const hasData = (stil.anzahl_mitglieder && stil.anzahl_mitglieder > 0) ||
                   (stil.graduierungen && stil.graduierungen.length > 0);

    if (hasData) {
      // Aktiver Stil hat Daten - nur Deaktivierung möglich
      const confirmDeactivate = confirm(
        `Der Stil "${stil.name}" hat bereits Daten (${stil.anzahl_mitglieder || 0} Schüler, ${stil.graduierungen?.length || 0} Graduierungen).\n\n` +
        `Löschen ist nicht möglich. Möchten Sie den Stil stattdessen deaktivieren?\n\n` +
        `Deaktivierte Stile werden nicht mehr in der Schülerverwaltung angezeigt.`
      );

      if (confirmDeactivate) {
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE}/stile/${stilId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: stil.name,
              beschreibung: stil.beschreibung || '',
              aktiv: false
            })
          });

          if (response.ok) {
            const updatedStil = await response.json();
            // Update in der Stile-Liste
            setStile(stile.map(s => s.stil_id === stilId ? updatedStil : s));
            setSuccess(`Stil "${stil.name}" wurde deaktiviert.`);
            setTimeout(() => setSuccess(''), 3000);
            console.log('✅ Stil deaktiviert:', stilId);
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
            setError(errorData.error || 'Fehler beim Deaktivieren des Stils');
          }
        } catch (err) {
          console.error('❌ Fehler beim Deaktivieren des Stils:', err);
          setError('Stil konnte nicht deaktiviert werden');
        } finally {
          setLoading(false);
        }
      }
    } else {
      // Stil hat keine Daten - Löschung möglich
      const confirmDelete = confirm(
        `Möchten Sie den Stil "${stil.name}" wirklich löschen?\n\n` +
        `Diese Aktion kann nicht rückgängig gemacht werden!`
      );
      
      if (confirmDelete) {
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE}/stile/${stilId}`, {
            method: 'DELETE'
          });

          if (response.ok) {
            const result = await response.json();

            // Backend macht Soft Delete (aktiv = 0), also aktualisiere den Stil
            setStile(stile.map(s =>
              s.stil_id === stilId
                ? { ...s, aktiv: false }
                : s
            ));

            // Wenn aktueller Stil gelöscht wurde, zurück zur Übersicht
            if (currentStil && currentStil.stil_id === stilId) {
              setCurrentStil(null);
              navigate('/dashboard/stile');
            }

            setSuccess(`Stil "${stil.name}" wurde erfolgreich gelöscht (deaktiviert)!`);
            setTimeout(() => setSuccess(''), 3000);
            console.log('✅ Stil gelöscht:', result);
          } else if (response.status === 409) {
            // Konflikt: Stil hat noch zugeordnete Mitglieder
            const errorData = await response.json().catch(() => ({ error: 'Stil hat noch zugeordnete Mitglieder' }));
            const memberCount = errorData.mitglieder_anzahl || 'mehrere';
            setError(
              `Stil "${stil.name}" kann nicht gelöscht werden!\n\n` +
              `Es sind noch ${memberCount} aktive Mitglieder diesem Stil zugeordnet.\n\n` +
              `Bitte weisen Sie die Mitglieder einem anderen Stil zu oder deaktivieren Sie diese zuerst.`
            );
            console.warn('⚠️ Stil-Löschung verhindert:', errorData);
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
            setError(errorData.error || 'Fehler beim Löschen des Stils');
            console.error('❌ Fehler beim Löschen:', errorData);
          }
        } catch (err) {
          console.error('❌ Fehler beim Löschen des Stils:', err);
          setError('Stil konnte nicht gelöscht werden');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  /**
   * Fügt eine neue Graduierung zu einem Stil hinzu
   * @param {Object} newGraduierung - Graduierungs-Daten
   */
  const addGraduierung = async (newGraduierung) => {
    if (!currentStil) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/stile/${currentStil.stil_id}/graduierungen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGraduierung.name,
          trainingsstunden_min: newGraduierung.trainingsstunden_min,
          mindestzeit_monate: newGraduierung.mindestzeit_monate,
          farbe_hex: newGraduierung.farbe_hex,
          farbe_sekundaer: newGraduierung.farbe_sekundaer || null,
          kategorie: newGraduierung.kategorie || null,
          dan_grad: newGraduierung.dan_grad || null
        })
      });

      if (response.ok) {
        const savedGraduierung = await response.json();
        
        // Aktualisiere currentStil mit echten Backend-Daten
        const updatedStil = {
          ...currentStil,
          graduierungen: [...(currentStil.graduierungen || []), savedGraduierung]
        };
        setCurrentStil(updatedStil);
        
        // Aktualisiere Haupt-Stile-Liste
        setStile(stile.map(s => s.stil_id === currentStil.stil_id ? updatedStil : s));
        
        setSuccess('Graduierung erfolgreich hinzugefügt!');
        setTimeout(() => setSuccess(''), 2000);
        console.log('✅ Graduierung hinzugefügt:', savedGraduierung);
        
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        setError(errorData.error || 'Fehler beim Hinzufügen der Graduierung');
      }
    } catch (err) {
      console.error('❌ Fehler beim Hinzufügen der Graduierung:', err);
      setError('Graduierung konnte nicht hinzugefügt werden');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Aktualisiert eine bestehende Graduierung
   * @param {Object} graduierungData - Neue Graduierungs-Daten
   */
  const updateGraduierung = async (graduierungData) => {
    if (!graduierungData.graduierung_id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/stile/graduierungen/${graduierungData.graduierung_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graduierungData)
      });

      if (response.ok) {
        const updatedGraduierung = await response.json();
        
        // Aktualisiere currentStil
        const updatedStil = {
          ...currentStil,
          graduierungen: currentStil.graduierungen.map(g => 
            g.graduierung_id === graduierungData.graduierung_id ? updatedGraduierung : g
          )
        };
        setCurrentStil(updatedStil);
        
        // Aktualisiere Haupt-Liste
        setStile(stile.map(s => s.stil_id === currentStil.stil_id ? updatedStil : s));
        
        setSuccess('Graduierung erfolgreich aktualisiert!');
        setTimeout(() => setSuccess(''), 2000);
        console.log('✅ Graduierung aktualisiert:', updatedGraduierung);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        setError(errorData.error || 'Fehler beim Aktualisieren der Graduierung');
      }
    } catch (err) {
      console.error('❌ Fehler beim Aktualisieren der Graduierung:', err);
      setError('Graduierung konnte nicht aktualisiert werden');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Löscht eine Graduierung
   * @param {number} graduierungId - ID der zu löschenden Graduierung
   */
  const deleteGraduierung = async (graduierungId) => {
    if (!currentStil || !confirm('Graduierung wirklich löschen?')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/stile/graduierungen/${graduierungId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Entferne aus currentStil
        const updatedStil = {
          ...currentStil,
          graduierungen: currentStil.graduierungen.filter(g => g.graduierung_id !== graduierungId)
        };
        setCurrentStil(updatedStil);
        
        // Aktualisiere Haupt-Liste
        setStile(stile.map(s => s.stil_id === currentStil.stil_id ? updatedStil : s));
        
        setSuccess('Graduierung erfolgreich gelöscht!');
        setTimeout(() => setSuccess(''), 2000);
        console.log('✅ Graduierung gelöscht:', graduierungId);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        setError(errorData.error || 'Fehler beim Löschen der Graduierung');
      }
    } catch (err) {
      console.error('❌ Fehler beim Löschen der Graduierung:', err);
      setError('Graduierung konnte nicht gelöscht werden');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // EVENT HANDLER
  // ============================================================================

  /**
   * Handler für Formular-Änderungen
   * @param {string} field - Feld-Name
   * @param {any} value - Neuer Wert
   */
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Modal zurücksetzen
  const resetCreateModal = () => {
    setShowCreateForm(false);
    setCreateStep(1);
    setFormData({
      name: '',
      beschreibung: '',
      aktiv: true,
      kategorie: 'kampfkunst',
      schwierigkeitsgrad: 'mittel',
      altergruppe: 'alle',
      trainingsdauer: 60,
      ausruestung: []
    });
  };

  /**
   * Handler für Graduierung bearbeiten
   * @param {Object} graduierung - Zu bearbeitende Graduierung
   */
  const handleEditGraduierung = (graduierung) => {
    try {
      // Sicheres Setzen der Daten
      setEditingGraduierung({ ...graduierung });
      setShowEditGraduierung(true);
    } catch (error) {
      console.error('❌ Error in handleEditGraduierung:', error);
    }
  };

  /**
   * Handler für Modal schließen
   */
  const handleCloseEditModal = () => {
    console.log('❌ Closing edit modal');
    setShowEditGraduierung(false);
    setEditingGraduierung(null);
  };

  // ============================================================================
  // PRÜFUNGSINHALTE FUNKTIONEN
  // ============================================================================

  /**
   * Öffnet das Modal zum Hinzufügen eines Prüfungsinhalts
   */
  const handleAddPruefungsinhalt = (graduierung, kategorie) => {
    setSelectedGraduierung(graduierung);
    setSelectedKategorie(kategorie);
    setEditingPruefungsinhalt(null);
    setShowPruefungsinhaltForm(true);
  };

  /**
   * Öffnet das Modal zum Bearbeiten eines Prüfungsinhalts
   */
  const handleEditPruefungsinhalt = (graduierung, kategorie, inhalt) => {
    setSelectedGraduierung(graduierung);
    setSelectedKategorie(kategorie);
    setEditingPruefungsinhalt(inhalt);
    setShowPruefungsinhaltForm(true);
  };

  /**
   * Speichert einen Prüfungsinhalt (neu oder bearbeitet)
   */
  const handleSavePruefungsinhalt = async (inhaltText, beschreibungText = '') => {
    if (!selectedGraduierung || !selectedKategorie || !inhaltText.trim()) {
      setError('Bitte alle Felder ausfüllen');
      return;
    }

    try {
      setLoading(true);

      // Hole die aktuellen Prüfungsinhalte für diese Graduierung
      const pruefungsinhalte = selectedGraduierung.pruefungsinhalte || {};
      const kategorieInhalte = pruefungsinhalte[selectedKategorie] || [];

      let updatedInhalte;
      if (editingPruefungsinhalt) {
        // Bearbeiten: Finde und aktualisiere den Inhalt
        const index = kategorieInhalte.findIndex(item =>
          item.id === editingPruefungsinhalt.id
        );
        updatedInhalte = [...kategorieInhalte];
        updatedInhalte[index] = { ...editingPruefungsinhalt, inhalt: inhaltText, beschreibung: beschreibungText };
      } else {
        // Neu hinzufügen
        const newInhalt = {
          id: Date.now(), // Temporäre ID
          inhalt: inhaltText,
          beschreibung: beschreibungText,
          reihenfolge: kategorieInhalte.length
        };
        updatedInhalte = [...kategorieInhalte, newInhalt];
      }

      // Aktualisiere die Graduierung mit den neuen Inhalten
      const updatedPruefungsinhalte = {
        ...pruefungsinhalte,
        [selectedKategorie]: updatedInhalte
      };

      // API-Call zum Speichern
      const response = await fetch(
        `${API_BASE}/stile/${currentStil.stil_id}/graduierungen/${selectedGraduierung.graduierung_id}/pruefungsinhalte`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pruefungsinhalte: updatedPruefungsinhalte })
        }
      );

      if (!response.ok) throw new Error('Fehler beim Speichern');

      // Aktualisiere lokalen State
      setCurrentStil(prev => ({
        ...prev,
        graduierungen: prev.graduierungen.map(grad =>
          grad.graduierung_id === selectedGraduierung.graduierung_id
            ? { ...grad, pruefungsinhalte: updatedPruefungsinhalte }
            : grad
        )
      }));

      setSuccess(editingPruefungsinhalt ? 'Prüfungsinhalt aktualisiert' : 'Prüfungsinhalt hinzugefügt');
      setShowPruefungsinhaltForm(false);
      setEditingPruefungsinhalt(null);
      setSelectedGraduierung(null);
      setSelectedKategorie('');
    } catch (error) {
      console.error('Fehler beim Speichern des Prüfungsinhalts:', error);
      setError('Prüfungsinhalt konnte nicht gespeichert werden');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Kopiert alle Inhalte einer Quell-Graduierung in eine Ziel-Graduierung (Merge, keine Duplikate)
   */
  const handleCopyFromGrad = async (targetGrad, sourceGradIdStr) => {
    const sourceGradId = parseInt(sourceGradIdStr);
    if (!sourceGradId || !currentStil) return;

    const sourceGrad = currentStil.graduierungen.find(g => g.graduierung_id === sourceGradId);
    if (!sourceGrad) return;

    const sourceInhalte = sourceGrad.pruefungsinhalte || {};
    const targetInhalte = { ...(targetGrad.pruefungsinhalte || {}) };

    let addedCount = 0;
    Object.entries(sourceInhalte).forEach(([kategorie, items]) => {
      if (!Array.isArray(items)) return;
      if (!targetInhalte[kategorie]) targetInhalte[kategorie] = [];
      const existingTexts = targetInhalte[kategorie].map(
        i => (i.inhalt || i.titel || '').toLowerCase().trim()
      );
      items.forEach(item => {
        const text = (item.inhalt || item.titel || '').toLowerCase().trim();
        if (text && !existingTexts.includes(text)) {
          targetInhalte[kategorie].push({
            ...item,
            id: Date.now() + Math.floor(Math.random() * 10000)
          });
          addedCount++;
        }
      });
    });

    if (addedCount === 0) {
      setSuccess(`Alle Inhalte aus "${sourceGrad.name}" sind bereits vorhanden`);
      setCopyFromGradId(null);
      setCopySourceId('');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/stile/${currentStil.stil_id}/graduierungen/${targetGrad.graduierung_id}/pruefungsinhalte`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pruefungsinhalte: targetInhalte })
        }
      );

      if (!response.ok) throw new Error('Fehler beim Speichern');

      setCurrentStil(prev => ({
        ...prev,
        graduierungen: prev.graduierungen.map(g =>
          g.graduierung_id === targetGrad.graduierung_id
            ? { ...g, pruefungsinhalte: targetInhalte }
            : g
        )
      }));
      setSuccess(`${addedCount} Inhalt${addedCount !== 1 ? 'e' : ''} aus "${sourceGrad.name}" übernommen`);
      setCopyFromGradId(null);
      setCopySourceId('');
    } catch (err) {
      console.error('Fehler beim Übernehmen der Inhalte:', err);
      setError('Inhalte konnten nicht übernommen werden');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Öffnet das Modal zum Anzeigen der Prüfungsinhalte
   */
  const handleShowPruefungsinhalte = async (graduierung) => {
    try {
      // Lade die Prüfungsinhalte für diese Graduierung vom Backend
      const response = await fetch(`${API_BASE}/stile/${currentStil.stil_id}/graduierungen/${graduierung.graduierung_id}/pruefungsinhalte`);

      if (response.ok) {
        const data = await response.json();
        // Füge die Prüfungsinhalte zur Graduierung hinzu
        const graduierungMitInhalten = {
          ...graduierung,
          pruefungsinhalte: data.pruefungsinhalte || {}
        };
        setViewingGraduierung(graduierungMitInhalten);
        setShowPruefungsinhalteModal(true);
      } else {
        // Falls nicht gefunden, zeige leeres Modal
        console.log('Keine Prüfungsinhalte gefunden, zeige leeres Modal');
        setViewingGraduierung({...graduierung, pruefungsinhalte: {}});
        setShowPruefungsinhalteModal(true);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Prüfungsinhalte:', error);
      // Zeige Modal trotzdem, aber leer
      setViewingGraduierung({...graduierung, pruefungsinhalte: {}});
      setShowPruefungsinhalteModal(true);
    }
  };

  /**
   * Löscht einen Prüfungsinhalt
   */
  const handleDeletePruefungsinhalt = async (graduierung, kategorie, inhaltId) => {
    if (!window.confirm('Prüfungsinhalt wirklich löschen?')) return;

    try {
      setLoading(true);

      const pruefungsinhalte = graduierung.pruefungsinhalte || {};
      const kategorieInhalte = pruefungsinhalte[kategorie] || [];
      const updatedInhalte = kategorieInhalte.filter(item => item.id !== inhaltId);

      const updatedPruefungsinhalte = {
        ...pruefungsinhalte,
        [kategorie]: updatedInhalte
      };

      const response = await fetch(
        `${API_BASE}/stile/${currentStil.stil_id}/graduierungen/${graduierung.graduierung_id}/pruefungsinhalte`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pruefungsinhalte: updatedPruefungsinhalte })
        }
      );

      if (!response.ok) throw new Error('Fehler beim Löschen');

      setCurrentStil(prev => ({
        ...prev,
        graduierungen: prev.graduierungen.map(grad =>
          grad.graduierung_id === graduierung.graduierung_id
            ? { ...grad, pruefungsinhalte: updatedPruefungsinhalte }
            : grad
        )
      }));

      setSuccess('Prüfungsinhalt gelöscht');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      setError('Prüfungsinhalt konnte nicht gelöscht werden');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handler für automatische Fehler-Bereinigung
   */
  const clearMessages = () => {
    if (error) setError('');
    if (success) setSuccess('');
  };

  // ============================================================================
  // REACT LIFECYCLE HOOKS
  // ============================================================================

  // Lade alle Stile beim ersten Laden der Komponente

  // ============================================================================
  // STATISTIKEN LADEN
  // ============================================================================

  /**
   * Lädt Stil-Statistiken vom Backend
   * @param {number} id - Stil-ID
   */
  const loadStatistiken = async (id) => {
    if (!id) return;

    setLoadingStats(true);
    try {
      // Stil-Statistiken laden (Schüler-Verteilung, Kategorien, etc.)
      const stilStatsResponse = await fetch(`${API_BASE}/stile/${id}/statistiken`);
      if (!stilStatsResponse.ok) throw new Error('Fehler beim Laden der Stil-Statistiken');
      const stilStats = await stilStatsResponse.json();
      setStatistiken(stilStats);

      // Prüfungs-Statistiken laden (mit Stil-Filter)
      const pruefungsResponse = await fetch(`${API_BASE}/pruefungen/stats/statistiken`);
      if (!pruefungsResponse.ok) throw new Error('Fehler beim Laden der Prüfungs-Statistiken');
      const pruefungsData = await pruefungsResponse.json();
      setPruefungsStats(pruefungsData.statistiken);
    } catch (err) {
      console.error('Fehler beim Laden der Statistiken:', err);
      setError('Statistiken konnten nicht geladen werden: ' + err.message);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStile();
  }, []);

  // Lade spezifischen Stil wenn stilId in URL vorhanden
  useEffect(() => {
    if (stilId && stile.length > 0) {
      loadStil(stilId);
      loadStatistiken(stilId); // Statistiken auch laden
    } else if (!stilId) {
      setCurrentStil(null);
      setStatistiken(null); // Statistiken zurücksetzen
      setPruefungsStats(null);
    }
  }, [stilId, stile]);

  // Lade Stilmitglieder wenn Tab aktiv + Stil geladen
  useEffect(() => {
    if (activeTab === 'stilmitglieder' && currentStil) {
      loadStilMitglieder();
      loadAlleDojMitglieder();
    }
  }, [activeTab, currentStil]);

  // Bereinige Nachrichten nach 5 Sekunden
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(clearMessages, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // ============================================================================
  // STIL REIHENFOLGE ÄNDERN (PFEIL-BUTTONS)
  // ============================================================================

  /**
   * Verschiebt einen Stil nach oben in der Reihenfolge
   * @param {Object} stil - Der zu verschiebende Stil
   */
  const moveStilUp = async (stil) => {
    const sortedStile = [...stile].filter(s => s.aktiv).sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
    const currentIndex = sortedStile.findIndex(s => s.stil_id === stil.stil_id);

    if (currentIndex <= 0) return; // Bereits ganz oben

    // Tausche mit dem vorherigen Stil
    const prevStil = sortedStile[currentIndex - 1];
    const currentReihenfolge = stil.reihenfolge || currentIndex + 1;
    const prevReihenfolge = prevStil.reihenfolge || currentIndex;

    setLoading(true);

    try {
      const requestData = {
        stile: [
          { stil_id: parseInt(stil.stil_id), reihenfolge: parseInt(prevReihenfolge) },
          { stil_id: parseInt(prevStil.stil_id), reihenfolge: parseInt(currentReihenfolge) }
        ]
      };

      console.log('🔄 Move Up Request:', requestData);
      console.log('  Current Stil:', stil.stil_id, 'to', prevReihenfolge);
      console.log('  Prev Stil:', prevStil.stil_id, 'to', currentReihenfolge);

      const response = await fetch(`${API_BASE}/stile/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Backend Fehler:', errorData);
        throw new Error(errorData.error || 'Fehler beim Aktualisieren der Reihenfolge');
      }

      // Reload Stile um aktuelle Daten zu bekommen
      await loadStile();
      setSuccess('Reihenfolge aktualisiert!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('❌ Fehler beim Verschieben:', err);
      setError(err.message || 'Fehler beim Verschieben des Stils');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verschiebt einen Stil nach unten in der Reihenfolge
   * @param {Object} stil - Der zu verschiebende Stil
   */
  const moveStilDown = async (stil) => {
    const sortedStile = [...stile].filter(s => s.aktiv).sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
    const currentIndex = sortedStile.findIndex(s => s.stil_id === stil.stil_id);

    if (currentIndex >= sortedStile.length - 1) return; // Bereits ganz unten

    // Tausche mit dem nächsten Stil
    const nextStil = sortedStile[currentIndex + 1];
    const currentReihenfolge = stil.reihenfolge || currentIndex + 1;
    const nextReihenfolge = nextStil.reihenfolge || currentIndex + 2;

    setLoading(true);

    try {
      const requestData = {
        stile: [
          { stil_id: parseInt(stil.stil_id), reihenfolge: parseInt(nextReihenfolge) },
          { stil_id: parseInt(nextStil.stil_id), reihenfolge: parseInt(currentReihenfolge) }
        ]
      };

      console.log('🔄 Move Down Request:', requestData);
      console.log('  Current Stil:', stil.stil_id, 'to', nextReihenfolge);
      console.log('  Next Stil:', nextStil.stil_id, 'to', currentReihenfolge);

      const response = await fetch(`${API_BASE}/stile/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Backend Fehler:', errorData);
        throw new Error(errorData.error || 'Fehler beim Aktualisieren der Reihenfolge');
      }

      // Reload Stile um aktuelle Daten zu bekommen
      await loadStile();
      setSuccess('Reihenfolge aktualisiert!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('❌ Fehler beim Verschieben:', err);
      setError(err.message || 'Fehler beim Verschieben des Stils');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // STILMITGLIEDER FUNKTIONEN
  // ============================================================================

  const loadStilMitglieder = useCallback(async () => {
    if (!currentStil) return;
    setStilMitgliederLoading(true);
    try {
      const params = new URLSearchParams();
      if (effectiveDojoId) params.set('dojo_id', effectiveDojoId);
      const res = await fetch(
        `${API_BASE}/mitglieder/zuweisung/stil/${currentStil.stil_id}?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) setStilMitglieder(data.mitglieder || []);
    } catch (e) {
      console.error('Stilmitglieder laden Fehler:', e);
    } finally {
      setStilMitgliederLoading(false);
    }
  }, [currentStil, API_BASE, token, effectiveDojoId]);

  const loadAlleDojMitglieder = useCallback(async () => {
    if (!effectiveDojoId) return; // Ohne Dojo-ID keine Mitglieder laden
    try {
      const res = await fetch(`${API_BASE}/mitglieder?dojo_id=${effectiveDojoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.mitglieder || []);
      setAlleDojMitglieder(list);
    } catch (e) {
      console.error('Dojo-Mitglieder laden Fehler:', e);
    }
  }, [API_BASE, token, effectiveDojoId]);

  const addMemberToStil = async (mitgliedId) => {
    try {
      const params = new URLSearchParams();
      if (effectiveDojoId) params.set('dojo_id', effectiveDojoId);
      const res = await fetch(`${API_BASE}/mitglieder/stil/${currentStil.stil_id}/assign?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mitglied_id: mitgliedId })
      });
      const data = await res.json();
      if (data.success || data.message === 'Bereits zugewiesen') {
        // Mitglied sofort aus Picker-Liste entfernen
        setAlleDojMitglieder(prev => prev.filter(m => m.mitglied_id !== mitgliedId));
        // Stil-Mitgliederliste aktualisieren
        await loadStilMitglieder();
        // Modal bleibt offen
      }
    } catch (e) {
      setError('Fehler beim Zuweisen');
    }
  };

  const removeMemberFromStil = async (mitgliedId, name) => {
    if (!window.confirm(`${name} aus diesem Stil entfernen?`)) return;
    try {
      const params = new URLSearchParams();
      if (effectiveDojoId) params.set('dojo_id', effectiveDojoId);
      const res = await fetch(
        `${API_BASE}/mitglieder/stil/${currentStil.stil_id}/remove/${mitgliedId}?${params}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) {
        setStilMitglieder(prev => prev.filter(m => m.mitglied_id !== mitgliedId));
        setSuccess('Mitglied entfernt!');
        setTimeout(() => setSuccess(''), 2000);
      }
    } catch (e) {
      setError('Fehler beim Entfernen');
    }
  };

  const handleBulkGraduierung = async () => {
    if (!bulkTargetGradId || bulkSelectedIds.length === 0 || !currentStil) return;
    setBulkSaving(true);
    try {
      const assignments = bulkSelectedIds.map(id => ({
        mitglied_id: id,
        graduierung_id: parseInt(bulkTargetGradId)
      }));
      const params = new URLSearchParams();
      if (effectiveDojoId) params.set('dojo_id', effectiveDojoId);
      const res = await fetch(`${API_BASE}/mitglieder/bulk-graduierung?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stil_id: currentStil.stil_id, assignments })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`${bulkSelectedIds.length} Mitglied${bulkSelectedIds.length !== 1 ? 'er' : ''} zugewiesen`);
        setBulkGradMode(false);
        setBulkSelectedIds([]);
        setBulkTargetGradId('');
        await loadStilMitglieder();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Fehler bei der Zuweisung');
      }
    } catch (e) {
      setError('Netzwerkfehler');
    } finally {
      setBulkSaving(false);
    }
  };

  // ============================================================================
  // SORTABLE GRADUIERUNG KOMPONENTE
  // ============================================================================
  
  /**
   * GraduierungItem - Einzelne Graduierung mit Move-Buttons
   * @param {Object} graduierung - Graduierungs-Objekt
   */
  const GraduierungItem = ({ graduierung, onEdit, onDelete, onMoveUp, onMoveDown, onShowPruefungsinhalte, loading, isFirst, isLast }) => {

    return (
      <div
        className="graduierung-item sv-grad-item-relative"
        // Dynamische Border-Farbe basierend auf Gürtel-Farbe
        data-border-color={graduierung.farbe_hex}
      >

        <div className="graduierung-header">
          <div className="graduierung-name">
            <BeltPreview 
              primaer={graduierung.farbe_hex} 
              sekundaer={graduierung.farbe_sekundaer} 
              size="normal"
            />
            <strong>{graduierung.name}</strong>
            <span className="reihenfolge-badge">#{graduierung.reihenfolge}</span>
          </div>
          <div className="graduierung-actions sv-grad-actions">
            {/* Position-Buttons */}
          <button
            className="btn btn-info move-btn move-up sv-grad-move-btn"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp && onMoveUp(graduierung);
            }}
            disabled={isFirst}
            title="Nach oben verschieben"
          >
            ↑
          </button>
          <button
            className="btn btn-info move-btn move-down sv-grad-move-btn"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown && onMoveDown(graduierung);
            }}
            disabled={isLast}
            title="Nach unten verschieben"
          >
            ↓
          </button>

            {/* Trennlinie */}
            <span className="button-divider"></span>

            {/* Bearbeiten & Löschen Buttons */}
            <button
              className="sub-tab-btn sv-grad-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onShowPruefungsinhalte && onShowPruefungsinhalte(graduierung);
              }}
              disabled={loading}
              title="Prüfungsinhalte anzeigen"
            >
              📝 Prüfungsinhalte
            </button>
            <button
              className="sub-tab-btn sv-grad-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEdit && onEdit(graduierung);
              }}
              disabled={loading}
              title="Graduierung bearbeiten"
            >
              ✏️ Bearbeiten
            </button>
            <button
              className="sub-tab-btn sv-grad-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(graduierung.graduierung_id);
              }}
              disabled={loading}
              title="Graduierung löschen"
            >
              🗑️
            </button>
          </div>
        </div>
        <div className="graduierung-details">
          <span>⏱️ {graduierung.trainingsstunden_min}h Training</span>
          <span>📅 {graduierung.mindestzeit_monate} Monate Mindestzeit</span>
          <span>🏆 Reihenfolge: {graduierung.reihenfolge}</span>
          {graduierung.dan_grad && <span>🥋 {graduierung.dan_grad}. DAN</span>}
          {graduierung.kategorie && <span>📂 {graduierung.kategorie}</span>}
        </div>
      </div>
    );
  };

  // ============================================================================
  // UNTER-KOMPONENTEN
  // ============================================================================

  /**
   * StilCard - Stil-Karte mit Pfeil-Buttons
   * @param {Object} stil - Stil-Objekt
   * @param {Function} onDelete - Callback-Funktion zum Löschen
   * @param {Function} onMoveUp - Callback nach oben verschieben
   * @param {Function} onMoveDown - Callback nach unten verschieben
   * @param {boolean} isFirst - Ist erster Stil in der Liste
   * @param {boolean} isLast - Ist letzter Stil in der Liste
   */
  const StilCard = ({ stil, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
    return (
      <motion.div
        className={`stil-card ${!stil.aktiv ? 'inactive' : ''}`}
        title={`${stil.name}${!stil.aktiv ? ' (Inaktiv)' : ''}`}
      >
        <div className="stil-card-content" onClick={() => navigate(`/dashboard/stile/${stil.stil_id}`)}>
          <div className="stil-card-header">
            <h3>{stil.name}</h3>
            <div className="stil-badge">
              {stil.graduierungen?.length || 0} Gürtel
            </div>
          </div>

          <p className="stil-beschreibung">
            {stil.beschreibung || 'Keine Beschreibung verfügbar'}
          </p>

          <div className="stil-card-stats">
            <div className="stil-stat">
              <span className="stil-stat-number">{stil.anzahl_mitglieder || 0}</span>
              <span className="stil-stat-label">Schüler</span>
            </div>
            <div className="stil-stat">
              <span className="stil-stat-number">{stil.graduierungen?.length || 0}</span>
              <span className="stil-stat-label">Gürtel</span>
            </div>
            <div className="stil-stat">
              <div className="stat-status">
                <span className={`status-dot ${stil.aktiv ? 'active' : 'inactive'}`}></span>
                {stil.aktiv ? 'Aktiv' : 'Inaktiv'}
              </div>
            </div>
          </div>
        </div>

        {/* Actions mit Pfeil-Buttons */}
        <div className="stil-card-actions" onClick={(e) => e.stopPropagation()}>
          {/* Reaktivieren Button für inaktive Stile */}
          {!stil.aktiv && (
            <button
              className="btn btn-success btn-small move-btn sv-btn-sm-compact"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const token = localStorage.getItem('token');
                  // Stelle sicher, dass name vorhanden ist (kann stil_name oder name sein)
                  const stilData = {
                    name: stil.name || stil.stil_name,
                    beschreibung: stil.beschreibung || '',
                    aktiv: true,
                    reihenfolge: stil.reihenfolge || 0
                  };

                  console.log('🔄 Reaktiviere Stil:', stilData);

                  const response = await fetch(`${API_BASE}/stile/${stil.stil_id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(stilData)
                  });
                  if (response.ok) {
                    console.log('✅ Stil reaktiviert:', stilData.name);
                    await loadStile();
                    // Klappe inaktive Stile nach kurzem Delay ein, damit User die Änderung sieht
                    setTimeout(() => {
                      setShowInactiveStile(false);
                    }, 500);
                  } else {
                    const error = await response.json();
                    console.error('❌ Fehler beim Reaktivieren:', error);
                    alert('Fehler beim Reaktivieren: ' + (error.error || 'Unbekannter Fehler'));
                  }
                } catch (error) {
                  console.error('❌ Fehler beim Reaktivieren:', error);
                  alert('Fehler beim Reaktivieren: ' + error.message);
                }
              }}
              title="Stil reaktivieren"
            >
              ✓
            </button>
          )}

          {/* Reihenfolge Buttons nur für aktive Stile */}
          {stil.aktiv && (
            <>
              <button
                className="btn btn-neutral btn-sm move-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp && onMoveUp(stil);
                }}
                disabled={isFirst || loading}
                title="Nach oben verschieben"
              >
                ↑
              </button>
              <button
                className="btn btn-neutral btn-sm move-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown && onMoveDown(stil);
                }}
                disabled={isLast || loading}
                title="Nach unten verschieben"
              >
                ↓
              </button>
            </>
          )}

          {/* Delete Button */}
          <button
            className="btn btn-danger btn-small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete && onDelete(stil.stil_id);
            }}
            title="Stil löschen oder deaktivieren"
          >
            🗑️
          </button>
        </div>
      </motion.div>
    );
  };

  /**
   * GraduierungManager - Verwaltet Graduierungen mit @dnd-kit Drag & Drop
   */
  const GraduierungManager = () => {
    // Lokale States für GraduierungManager
    const [showAddForm, setShowAddForm] = useState(false);
    const [showCustomColorForm, setShowCustomColorForm] = useState(false);
    const [activeKategorie, setActiveKategorie] = useState('grundstufe'); // Aktive Kategorie im Graduierung-Modal
    const [newGraduierung, setNewGraduierung] = useState({
      name: '',
      trainingsstunden_min: 40,
      mindestzeit_monate: 3,
      farbe_hex: '#FFFFFF',
      farbe_sekundaer: null,
      kategorie: null,
      dan_grad: null
    });

    /**
     * Handler für das Hinzufügen einer Standard-Graduierung
     */
    const handleAddGraduierung = async () => {
      if (!newGraduierung.name.trim()) {
        setError('Graduierung-Name ist erforderlich');
        return;
      }
      
      // Finde gewählten Gürtel für zusätzliche Daten
      const selectedBelt = standardGuertel.find(g => g.name === newGraduierung.name);
      const graduierungData = {
        ...newGraduierung,
        kategorie: selectedBelt?.kategorie || newGraduierung.kategorie,
        dan_grad: selectedBelt?.dan || newGraduierung.dan_grad
      };

      await addGraduierung(graduierungData);
      
      // Reset form
      setNewGraduierung({
        name: '',
        trainingsstunden_min: 40,
        mindestzeit_monate: 3,
        farbe_hex: '#FFFFFF',
        farbe_sekundaer: null,
        kategorie: null,
        dan_grad: null
      });
      setShowAddForm(false);
    };

    /**
     * Handler für das Erstellen einer benutzerdefinierten Graduierung
     */
    const handleAddCustomGraduierung = async () => {
      if (!newGraduierung.name.trim()) {
        setError('Graduierung-Name ist erforderlich');
        return;
      }

      await addGraduierung(newGraduierung);
      
      // Reset form
      setNewGraduierung({
        name: '',
        trainingsstunden_min: 40,
        mindestzeit_monate: 3,
        farbe_hex: '#FFFFFF',
        farbe_sekundaer: null,
        kategorie: 'custom',
        dan_grad: null
      });
      setShowCustomColorForm(false);
    };

    // Sortierte Graduierungen für Darstellung und DnD
    const sortedGraduierungen = currentStil?.graduierungen
      ? [...currentStil.graduierungen].sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))
      : [];


    return (
      <>
        {/* Header mit Buttons - AUSSERHALB des graduierung-manager */}
        <div className="sv-grad-manager-header">
          <h3 className="sv-grad-manager-title">Graduierungen verwalten</h3>
          <div className="sv-grad-manager-btn-row">
            <button
              className="sv-grad-manager-btn"
              onClick={() => setShowAddForm(true)}
              disabled={loading}
              title="Standard-Gürtel hinzufügen"
            >
              + Graduierung hinzufügen
            </button>
            <button
              className="sv-grad-manager-btn"
              onClick={() => setShowCustomColorForm(true)}
              disabled={loading}
              title="Eigene Farbe erstellen"
            >
              Eigene Farbe
            </button>
          </div>
        </div>

        <div className="graduierung-manager">
        {/* Move-Info */}
        {sortedGraduierungen.length > 1 && (
          <div className="drag-drop-info">
            <span className="info-icon">ℹ️</span>
            Verwenden Sie die <strong>↑↓</strong> Buttons, um die Reihenfolge zu ändern
          </div>
        )}

        {/* Graduierungen-Liste */}
        {sortedGraduierungen.length > 0 ? (
          <div className="graduierung-list">
            {sortedGraduierungen.map((graduierung) => (
              <GraduierungItem
                key={graduierung.graduierung_id}
                graduierung={graduierung}
                onEdit={handleEditGraduierung}
                onDelete={deleteGraduierung}
                onMoveUp={moveGraduierungUp}
                onMoveDown={moveGraduierungDown}
                onShowPruefungsinhalte={handleShowPruefungsinhalte}
                loading={loading}
                isFirst={sortedGraduierungen[0]?.graduierung_id === graduierung.graduierung_id}
                isLast={sortedGraduierungen[sortedGraduierungen.length - 1]?.graduierung_id === graduierung.graduierung_id}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🎖️</div>
            <h3>Noch keine Graduierungen angelegt</h3>
            <p>Fügen Sie die erste Graduierung für diesen Stil hinzu</p>
          </div>
        )}

        {/* Modal: Standard Graduierung hinzufügen */}
        {showAddForm && ReactDOM.createPortal(
          (
            <div
              onClick={() => setShowAddForm(false)}
              className="sv-modal-overlay"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="sv-modal-content sv-modal-content--800"
              >
                <div className="modal-header sv-modal-header-sep">
                  <h3 className="modal-title sv-heading-primary">Neue Graduierung hinzufügen</h3>
                  <button
                    className="modal-close sv-close-btn"
                    onClick={() => setShowAddForm(false)}
                    title="Schließen"
                  >
                    ×
                  </button>
                </div>

                {/* Tab-Navigation */}
                <div className="sv-tab-nav">
                  {[
                    { key: 'grundstufe', label: '🟡 Grundstufe' },
                    { key: 'mittelstufe', label: '🟢 Mittelstufe' },
                    { key: 'oberstufe', label: '🟤 Oberstufe' },
                    { key: 'dan', label: '⚫ Dan-Grade' },
                    { key: 'meister', label: '🔴 Meister' }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveKategorie(tab.key)}
                      className={`sv-kat-tab-btn ${activeKategorie === tab.key ? 'sv-kat-tab-btn--active' : ''}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Gürtel der aktiven Kategorie */}
                <div className="sv-mb-15">
                  <div className="belt-grid sv-belt-grid">
                    {standardGuertel
                      .filter(guertel => guertel.kategorie === activeKategorie)
                      .map(guertel => (
                        <div
                          key={guertel.name}
                          className={`belt-option sv-belt-option-card ${newGraduierung.name === guertel.name ? 'selected sv-belt-option-card--selected' : ''}`}
                          onClick={() => {
                            // Automatisch passende Wartezeit aus Prüfungseinstellungen vorschlagen
                            let suggestedWaitTime = 3; // Default
                            if (guertel.kategorie === 'grundstufe' && currentStil?.wartezeit_grundstufe) {
                              suggestedWaitTime = currentStil.wartezeit_grundstufe;
                            } else if (guertel.kategorie === 'mittelstufe' && currentStil?.wartezeit_mittelstufe) {
                              suggestedWaitTime = currentStil.wartezeit_mittelstufe;
                            } else if (guertel.kategorie === 'oberstufe' && currentStil?.wartezeit_oberstufe) {
                              suggestedWaitTime = currentStil.wartezeit_oberstufe;
                            }

                            setNewGraduierung({
                              ...newGraduierung,
                              name: guertel.name,
                              farbe_hex: guertel.primaer,
                              farbe_sekundaer: guertel.sekundaer,
                              kategorie: guertel.kategorie,
                              dan_grad: guertel.dan || null,
                              mindestzeit_monate: suggestedWaitTime
                            });
                          }}
                          title={guertel.name}
                        >
                          <BeltPreview
                            primaer={guertel.primaer}
                            sekundaer={guertel.sekundaer}
                            size="small"
                          />
                          <span className={`sv-belt-option-name ${newGraduierung.name === guertel.name ? 'sv-belt-option-name--selected' : ''}`}>{guertel.name}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* Vorschau des gewählten Gürtels */}
                {newGraduierung.name && (
                  <div className="sv-belt-preview-box">
                    <h4 className="sv-belt-preview-title">Vorschau:</h4>
                    <div className="sv-belt-preview-row">
                      <BeltPreview
                        primaer={newGraduierung.farbe_hex}
                        sekundaer={newGraduierung.farbe_sekundaer}
                        size="large"
                      />
                      <div>
                        <strong className="sv-belt-preview-name">{newGraduierung.name}</strong>
                        <div className="sv-belt-preview-meta">
                          <span>Primär: {newGraduierung.farbe_hex}</span>
                          {newGraduierung.farbe_sekundaer && (
                            <span>Sekundär: {newGraduierung.farbe_sekundaer}</span>
                          )}
                          {newGraduierung.dan_grad && (
                            <span>DAN-Grad: {newGraduierung.dan_grad}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Anforderungen */}
                <div className="sv-grid-2col">
                  <div>
                    <label className="sv-label-primary">
                      Trainingsstunden (Minimum):
                    </label>
                    <input
                      type="number"
                      value={newGraduierung.trainingsstunden_min}
                      onChange={(e) => setNewGraduierung({
                        ...newGraduierung,
                        trainingsstunden_min: Math.max(0, parseInt(e.target.value) || 0)
                      })}
                      min="0"
                      className="sv-number-input"
                    />
                  </div>
                  <div>
                    <label className="sv-label-primary">
                      Mindestzeit (Monate):
                    </label>
                    <input
                      type="number"
                      value={newGraduierung.mindestzeit_monate}
                      onChange={(e) => setNewGraduierung({
                        ...newGraduierung,
                        mindestzeit_monate: Math.max(0, parseInt(e.target.value) || 0)
                      })}
                      min="0"
                      className="sv-number-input"
                    />
                  </div>
                </div>

                <div className="sv-modal-footer">
                  <button
                    onClick={() => setShowAddForm(false)}
                    disabled={loading}
                    className="sv-btn-cancel"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleAddGraduierung}
                    disabled={!newGraduierung.name || loading}
                    className="sv-btn-save"
                  >
                    {loading ? 'Wird gespeichert...' : 'Graduierung hinzufügen'}
                  </button>
                </div>
              </div>
            </div>
          ),
          document.body
        )}

        {/* Modal: Eigene Farbe erstellen */}
        {showCustomColorForm && ReactDOM.createPortal(
          (
            <div
              onClick={() => setShowCustomColorForm(false)}
              className="sv-modal-overlay"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="sv-modal-content sv-modal-content--600"
              >
                <div className="sv-section-header">
                  <h3 className="sv-heading-primary">Eigene Gürtel-Farbe erstellen</h3>
                  <button
                    onClick={() => setShowCustomColorForm(false)}
                    title="Schließen"
                    className="sv-close-btn"
                  >
                    ×
                  </button>
                </div>
                
                <div className="sv-mb-15">
                  <label className="sv-label-primary">
                    Graduierung-Name: <span className="sv-required-star">*</span>
                  </label>
                  <input
                    type="text"
                    value={newGraduierung.name}
                    onChange={(e) => setNewGraduierung({
                      ...newGraduierung,
                      name: e.target.value
                    })}
                    placeholder="z.B. Lila-Silbergurt"
                    autoFocus
                    className={`sv-grad-name-input ${!newGraduierung.name ? 'sv-grad-name-input--error' : ''}`}
                  />
                  {!newGraduierung.name && (
                    <small className="sv-required-hint">
                      Bitte geben Sie einen Namen ein
                    </small>
                  )}
                </div>

                <div className="u-grid-2col">
                  <div>
                    <label className="sv-label-primary">
                      Primärfarbe:
                    </label>
                    <div className="sv-flex-gap-sm">
                      <input
                        type="color"
                        value={newGraduierung.farbe_hex}
                        onChange={(e) => setNewGraduierung({
                          ...newGraduierung,
                          farbe_hex: e.target.value
                        })}
                        className="sv-color-picker"
                      />
                      <input
                        type="text"
                        value={newGraduierung.farbe_hex}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Akzeptiere Eingaben mit oder ohne #
                          if (value.match(/^#?[0-9A-Fa-f]{0,6}$/)) {
                            const hex = value.startsWith('#') ? value : '#' + value;
                            setNewGraduierung({
                              ...newGraduierung,
                              farbe_hex: hex
                            });
                          }
                        }}
                        placeholder="#32CD32"
                        className="sv-color-text-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className={`sv-sekundaer-label ${newGraduierung.farbe_sekundaer ? 'sv-sekundaer-label--active' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={newGraduierung.farbe_sekundaer !== null}
                        onChange={(e) => setNewGraduierung({
                          ...newGraduierung,
                          farbe_sekundaer: e.target.checked ? '#FFFFFF' : null
                        })}
                        className="sv-sekundaer-checkbox"
                      />
                      <span className={`sv-sekundaer-text ${newGraduierung.farbe_sekundaer ? 'sv-sekundaer-text--active' : ''}`}>
                        Sekundärfarbe (Streifen) hinzufügen
                      </span>
                    </label>
                    {newGraduierung.farbe_sekundaer ? (
                      <div className="sv-flex-gap-sm">
                        <input
                          type="color"
                          value={newGraduierung.farbe_sekundaer}
                          onChange={(e) => setNewGraduierung({
                            ...newGraduierung,
                            farbe_sekundaer: e.target.value
                          })}
                          className="sv-color-picker"
                        />
                        <input
                          type="text"
                          value={newGraduierung.farbe_sekundaer}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value.match(/^#?[0-9A-Fa-f]{0,6}$/)) {
                              const hex = value.startsWith('#') ? value : '#' + value;
                              setNewGraduierung({
                                ...newGraduierung,
                                farbe_sekundaer: hex
                              });
                            }
                          }}
                          placeholder="#FFFFFF"
                          className="sv-color-text-input"
                        />
                      </div>
                    ) : (
                      <div className="sv-placeholder-row">
                        Keine Sekundärfarbe
                      </div>
                    )}
                  </div>
                </div>

                {/* Live-Vorschau kompakt */}
                <div className="sv-card-gold">
                  <span className="sv-label-secondary">Vorschau:</span>
                  <BeltPreview
                    primaer={newGraduierung.farbe_hex}
                    sekundaer={newGraduierung.farbe_sekundaer}
                    size="medium"
                  />
                </div>

                <div className="sv-grid-2col">
                  <div>
                    <label className="sv-label-primary">
                      Trainingsstunden (Minimum):
                    </label>
                    <input
                      type="number"
                      value={newGraduierung.trainingsstunden_min}
                      onChange={(e) => setNewGraduierung({
                        ...newGraduierung,
                        trainingsstunden_min: Math.max(0, parseInt(e.target.value) || 0)
                      })}
                      min="0"
                      className="sv-number-input"
                    />
                  </div>
                  <div>
                    <label className="sv-label-primary">
                      Mindestzeit (Monate):
                    </label>
                    <input
                      type="number"
                      value={newGraduierung.mindestzeit_monate}
                      onChange={(e) => setNewGraduierung({
                        ...newGraduierung,
                        mindestzeit_monate: Math.max(0, parseInt(e.target.value) || 0)
                      })}
                      min="0"
                      className="sv-number-input"
                    />
                  </div>
                </div>

                <div className="sv-actions-row">
                  <button
                    onClick={() => setShowCustomColorForm(false)}
                    disabled={loading}
                    className="sv-btn-cancel"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleAddCustomGraduierung}
                    disabled={!newGraduierung.name || loading}
                    title={!newGraduierung.name ? 'Bitte geben Sie zuerst einen Namen ein' : 'Graduierung erstellen'}
                    className="sv-btn-save"
                  >
                    {loading ? 'Wird erstellt...' : 'Eigene Graduierung erstellen'}
                  </button>
                </div>
              </div>
            </div>
          ),
          document.body
        )}

        {/* Modal: Graduierung bearbeiten */}
        {showEditGraduierung && editingGraduierung && ReactDOM.createPortal(
          (
            <div
              onClick={() => {
                setShowEditGraduierung(false);
                setEditingGraduierung(null);
              }}
              className="sv-modal-overlay"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="sv-modal-content sv-modal-content--700"
              >
                <div className="sv-section-header">
                  <h3 className="sv-heading-primary">Graduierung bearbeiten</h3>
                  <button
                    onClick={() => {
                      setShowEditGraduierung(false);
                      setEditingGraduierung(null);
                    }}
                    title="Schließen"
                    className="sv-close-btn"
                  >
                    ×
                  </button>
                </div>

                <div className="sv-mb-15">
                  <label className="sv-label-primary">
                    Graduierung-Name:
                  </label>
                  <input
                    type="text"
                    value={editingGraduierung.name}
                    onChange={(e) => setEditingGraduierung({
                      ...editingGraduierung,
                      name: e.target.value
                    })}
                    className="sv-text-input"
                  />
                </div>

                <div className="u-grid-2col">
                  <div>
                    <label className="sv-label-primary">
                      Primärfarbe:
                    </label>
                    <div className="sv-flex-gap-sm">
                      <input
                        type="color"
                        value={editingGraduierung.farbe_hex}
                        onChange={(e) => setEditingGraduierung({
                          ...editingGraduierung,
                          farbe_hex: e.target.value
                        })}
                        className="sv-color-picker"
                      />
                      <input
                        type="text"
                        value={editingGraduierung.farbe_hex}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.match(/^#?[0-9A-Fa-f]{0,6}$/)) {
                            const hex = value.startsWith('#') ? value : '#' + value;
                            setEditingGraduierung({
                              ...editingGraduierung,
                              farbe_hex: hex
                            });
                          }
                        }}
                        placeholder="#32CD32"
                        className="sv-color-text-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className={`sv-sekundaer-label ${editingGraduierung.farbe_sekundaer ? 'sv-sekundaer-label--active' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={editingGraduierung.farbe_sekundaer !== null}
                        onChange={(e) => setEditingGraduierung({
                          ...editingGraduierung,
                          farbe_sekundaer: e.target.checked ? '#FFFFFF' : null
                        })}
                        className="sv-sekundaer-checkbox"
                      />
                      <span className={`sv-sekundaer-text ${editingGraduierung.farbe_sekundaer ? 'sv-sekundaer-text--active' : ''}`}>
                        Sekundärfarbe (Streifen) hinzufügen
                      </span>
                    </label>
                    {editingGraduierung.farbe_sekundaer ? (
                      <div className="sv-flex-gap-sm">
                        <input
                          type="color"
                          value={editingGraduierung.farbe_sekundaer}
                          onChange={(e) => setEditingGraduierung({
                            ...editingGraduierung,
                            farbe_sekundaer: e.target.value
                          })}
                          className="sv-color-picker"
                        />
                        <input
                          type="text"
                          value={editingGraduierung.farbe_sekundaer}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value.match(/^#?[0-9A-Fa-f]{0,6}$/)) {
                              const hex = value.startsWith('#') ? value : '#' + value;
                              setEditingGraduierung({
                                ...editingGraduierung,
                                farbe_sekundaer: hex
                              });
                            }
                          }}
                          placeholder="#FFFFFF"
                          className="sv-color-text-input"
                        />
                      </div>
                    ) : (
                      <div className="sv-placeholder-row">
                        Keine Sekundärfarbe
                      </div>
                    )}
                  </div>
                </div>

                {/* Live-Vorschau kompakt */}
                <div className="sv-card-gold">
                  <span className="sv-label-secondary">Vorschau:</span>
                  <BeltPreview
                    primaer={editingGraduierung.farbe_hex}
                    sekundaer={editingGraduierung.farbe_sekundaer}
                    size="medium"
                  />
                </div>

                <div className="sv-grid-2col">
                  <div>
                    <label className="sv-label-primary">
                      Trainingsstunden:
                    </label>
                    <input
                      type="number"
                      value={editingGraduierung.trainingsstunden_min}
                      onChange={(e) => setEditingGraduierung({
                        ...editingGraduierung,
                        trainingsstunden_min: Math.max(0, parseInt(e.target.value) || 0)
                      })}
                      min="0"
                      className="sv-number-input"
                    />
                  </div>
                  <div>
                    <label className="sv-label-primary">
                      Mindestzeit (Monate):
                    </label>
                    <input
                      type="number"
                      value={editingGraduierung.mindestzeit_monate}
                      onChange={(e) => setEditingGraduierung({
                        ...editingGraduierung,
                        mindestzeit_monate: Math.max(0, parseInt(e.target.value) || 0)
                      })}
                      min="0"
                      className="sv-number-input"
                    />
                  </div>
                </div>

                <div className="sv-actions-row">
                  <button
                    onClick={() => {
                      setShowEditGraduierung(false);
                      setEditingGraduierung(null);
                    }}
                    disabled={loading}
                    className="sv-btn-cancel"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={async () => {
                      await updateGraduierung(editingGraduierung);
                      setShowEditGraduierung(false);
                      setEditingGraduierung(null);
                    }}
                    disabled={!editingGraduierung.name || loading}
                    className="sv-btn-save"
                  >
                    {loading ? 'Wird gespeichert...' : 'Änderungen speichern'}
                  </button>
                </div>
              </div>
            </div>
          ),
          document.body
        )}
      </div>
      </>
    );
  };

  /**
   * Modal für Prüfungsinhalt hinzufügen/bearbeiten
   */
  const PruefungsinhaltFormModal = () => {
    const [inhaltText, setInhaltText] = React.useState(
      editingPruefungsinhalt?.inhalt || ''
    );
    const [beschreibungText, setBeschreibungText] = React.useState(
      editingPruefungsinhalt?.beschreibung || ''
    );

    React.useEffect(() => {
      setInhaltText(editingPruefungsinhalt?.inhalt || '');
      setBeschreibungText(editingPruefungsinhalt?.beschreibung || '');
    }, [editingPruefungsinhalt]);

    const handleSubmit = () => {
      handleSavePruefungsinhalt(inhaltText, beschreibungText);
    };

    const kategorieLabels = {
      'kondition': '💪 Kondition / Warm Up',
      'grundtechniken': '🥋 Grundtechniken',
      'kata': '🎭 Kata / Kombinationen',
      'kumite': '⚔️ Kumite / Sparring',
      'theorie': '📚 Theorie'
    };

    if (!showPruefungsinhaltForm) return null;

    return ReactDOM.createPortal(
      (
        <div
          onClick={() => {
            setShowPruefungsinhaltForm(false);
            setEditingPruefungsinhalt(null);
            setSelectedGraduierung(null);
            setSelectedKategorie('');
          }}
          className="sv-modal-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sv-modal-content sv-modal-content--600"
          >
            <div className="sv-section-header">
              <h3 className="sv-heading-primary">
                {editingPruefungsinhalt ? 'Prüfungsinhalt bearbeiten' : 'Prüfungsinhalt hinzufügen'}
              </h3>
              <button
                onClick={() => {
                  setShowPruefungsinhaltForm(false);
                  setEditingPruefungsinhalt(null);
                  setSelectedGraduierung(null);
                  setSelectedKategorie('');
                }}
                title="Schließen"
                className="sv-close-btn"
              >
                ×
              </button>
            </div>

            <div className="sv-mb-15">
              <div className="sv-belt-info-row">
                <BeltPreview
                  primaer={selectedGraduierung?.farbe_hex}
                  sekundaer={selectedGraduierung?.farbe_sekundaer}
                  size="small"
                />
                <div>
                  <div className="sv-belt-info-name">
                    {selectedGraduierung?.name}
                  </div>
                  <div className="sv-belt-info-kat">
                    {kategorieLabels[selectedKategorie]}
                  </div>
                </div>
              </div>

              <label className="sv-label-primary">
                Inhalt:
              </label>
              <textarea
                value={inhaltText}
                onChange={(e) => setInhaltText(e.target.value)}
                placeholder="z.B. Grundstellungen, Heian Shodan, Grundkumite..."
                rows="4"
                className="sv-textarea"
              />

              <label className="sv-label-primary" style={{ marginTop: '12px', display: 'block' }}>
                Zusatzinfo / Beschreibung: <small style={{ fontWeight: 'normal', opacity: 0.7 }}>(optional)</small>
              </label>
              <textarea
                value={beschreibungText}
                onChange={(e) => setBeschreibungText(e.target.value)}
                placeholder="z.B. Ausführungshinweise, Details, Bewertungskriterien..."
                rows="2"
                className="sv-textarea"
              />
            </div>

            <div className="sv-modal-footer">
              <button
                onClick={() => {
                  setShowPruefungsinhaltForm(false);
                  setEditingPruefungsinhalt(null);
                  setSelectedGraduierung(null);
                  setSelectedKategorie('');
                }}
                disabled={loading}
                className="sv-btn-cancel"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSubmit}
                disabled={!inhaltText.trim() || loading}
                className="sv-btn-save"
              >
                {loading ? 'Wird gespeichert...' : editingPruefungsinhalt ? 'Speichern' : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      ),
      document.body
    );
  };

  /**
   * Modal zum Anzeigen der Prüfungsinhalte einer Graduierung
   */
  const PruefungsinhalteViewModal = () => {
    const kategorien = stilKategorien.length > 0
      ? stilKategorien.map(k => ({ key: k.kategorie_key, label: k.label, icon: k.icon }))
      : [
          { key: 'kondition', label: 'Kondition / Warm Up', icon: '💪' },
          { key: 'grundtechniken', label: 'Grundtechniken', icon: '🥋' },
          { key: 'kata', label: 'Kata / Kombinationen', icon: '🎭' },
          { key: 'kumite', label: 'Kumite / Sparring', icon: '⚔️' },
          { key: 'theorie', label: 'Theorie', icon: '📚' }
        ];

    if (!showPruefungsinhalteModal || !viewingGraduierung) return null;

    const pruefungsinhalte = viewingGraduierung.pruefungsinhalte || {};

    return ReactDOM.createPortal(
      (
        <div
          onClick={() => {
            setShowPruefungsinhalteModal(false);
            setViewingGraduierung(null);
          }}
          className="sv-modal-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sv-modal-content sv-modal-content--900"
          >
            {/* Header */}
            <div className="sv-section-header">
              <div className="u-flex-row-lg">
                <BeltPreview
                  primaer={viewingGraduierung.farbe_hex}
                  sekundaer={viewingGraduierung.farbe_sekundaer}
                  size="normal"
                />
                <div>
                  <h3 className="sv-heading-primary">Prüfungsinhalte</h3>
                  <p className="sv-modal-subtitle">
                    {viewingGraduierung.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPruefungsinhalteModal(false);
                  setViewingGraduierung(null);
                }}
                title="Schließen"
                className="sv-close-btn"
              >
                ×
              </button>
            </div>

            {/* Prüfungsinhalte Kategorien */}
            <div className="sv-pruef-kat-grid">
              {kategorien.map(kategorie => {
                const inhalte = pruefungsinhalte[kategorie.key] || [];

                return (
                  <div
                    key={kategorie.key}
                    className="sv-pruef-kat-card"
                  >
                    <h4 className="sv-pruef-kat-title">
                      <span>{kategorie.icon}</span>
                      <span>{kategorie.label}</span>
                    </h4>
                    {inhalte.length > 0 ? (
                      <ul className="sv-pruef-inhalt-list">
                        {inhalte
                          .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))
                          .map(inhalt => (
                            <li
                              key={inhalt.id}
                              className="sv-pruef-inhalt-item"
                            >
                              {inhalt.inhalt}
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="sv-pruef-inhalt-empty">
                        Noch keine Inhalte definiert
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="sv-pruef-footer">
              <button
                onClick={() => {
                  setShowPruefungsinhalteModal(false);
                  setViewingGraduierung(null);
                }}
                className="sub-tab-btn sv-btn-wide"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      ),
      document.body
    );
  };

  /**
   * PruefungsinhaltManager - Verwaltet Prüfungsinhalte für Graduierungen
   */
  const PruefungsinhaltManager = () => {
    const kategorien = stilKategorien.length > 0
      ? stilKategorien.map(k => ({ key: k.kategorie_key, label: k.label, icon: k.icon, beispiele: [], aktive_graduierung_ids: k.aktive_graduierung_ids ?? null }))
      : [
          { key: 'kondition',      label: 'Kondition / Warm Up',  icon: '💪', beispiele: ['Warm Up', 'Kraft: Liegestütze', 'Kicks in Zeitlupe'] },
          { key: 'grundtechniken', label: 'Grundtechniken',        icon: '🥋', beispiele: ['Kampfstellung', 'Handtechniken', 'Fußtechniken', 'Abwehr'] },
          { key: 'kata',           label: 'Kata / Kombinationen',  icon: '🎭', beispiele: ['Kombinationen Handtechniken', 'Kombination Hand/Fuß'] },
          { key: 'kumite',         label: 'Kumite / Sparring',     icon: '⚔️', beispiele: ['Sandsack/Pratzen', 'Sparring Boxen', 'Pointfighting'] },
          { key: 'theorie',        label: 'Theorie',               icon: '📚', beispiele: ['Regelkunde', 'Notwehrparagraph', 'Erste Hilfe'] }
        ];

    // Toggle-Funktion für Graduierungen
    const toggleGraduierung = (graduierungId) => {
      setExpandedGraduierungen(prev =>
        prev.includes(graduierungId)
          ? prev.filter(id => id !== graduierungId)
          : [...prev, graduierungId]
      );
    };

    return (
      <div className="pruefungsinhalt-manager">
        <div className="section-header">
          <h3>Prüfungsinhalte definieren</h3>
          <p>Legen Sie fest, was für jede Graduierung gelernt werden muss</p>
        </div>

        {currentStil?.graduierungen?.length > 0 ? (
          currentStil.graduierungen
            .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))
            .map(grad => {
              const pruefungsinhalte = grad.pruefungsinhalte || {};
              const isExpanded = expandedGraduierungen.includes(grad.graduierung_id);

              return (
                <div key={grad.graduierung_id} className="graduierung-pruefung">
                  <div
                    className="graduierung-header clickable sv-pruef-mgr-cursor"
                    onClick={() => toggleGraduierung(grad.graduierung_id)}
                  >
                    <div className="sv-pruef-mgr-row">
                      <BeltPreview
                        primaer={grad.farbe_hex}
                        sekundaer={grad.farbe_sekundaer}
                        size="normal"
                      />
                      <h4 className="sv-grad-h4">{grad.name}</h4>
                    </div>
                    <span
                      className={`sv-chevron ${isExpanded ? 'sv-chevron--expanded' : ''}`}
                    >
                      ▼
                    </span>
                  </div>

                  {isExpanded && (
                    <>
                    {/* Copy-from-Graduierung Panel */}
                    {copyFromGradId !== grad.graduierung_id ? (
                      <div className="sv-pruef-copy-bar">
                        <button
                          className="sv-pruef-copy-trigger"
                          onClick={e => { e.stopPropagation(); setCopyFromGradId(grad.graduierung_id); setCopySourceId(''); }}
                        >
                          📋 Inhalte übernehmen aus…
                        </button>
                      </div>
                    ) : (
                      <div className="sv-pruef-copy-panel">
                        <span className="sv-pruef-copy-label">📋 Inhalte aus:</span>
                        <select
                          className="sv-pruef-copy-select"
                          value={copySourceId}
                          onChange={e => setCopySourceId(e.target.value)}
                        >
                          <option value="">Graduierung wählen…</option>
                          {(currentStil?.graduierungen || [])
                            .filter(g => g.graduierung_id !== grad.graduierung_id)
                            .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))
                            .map(g => (
                              <option key={g.graduierung_id} value={g.graduierung_id}>{g.name}</option>
                            ))}
                        </select>
                        <button
                          className="sv-pruef-copy-confirm"
                          onClick={() => handleCopyFromGrad(grad, copySourceId)}
                          disabled={!copySourceId || loading}
                        >
                          ✓ Übernehmen
                        </button>
                        <button
                          className="sv-pruef-copy-cancel"
                          onClick={() => { setCopyFromGradId(null); setCopySourceId(''); }}
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <div className="pruefungsinhalt-categories">
                    {kategorien.filter(kat => {
                      if (!kat.aktive_graduierung_ids) return true; // null = alle aktiv
                      return kat.aktive_graduierung_ids.includes(grad.graduierung_id);
                    }).map(kategorie => {
                      const inhalte = pruefungsinhalte[kategorie.key] || [];

                      return (
                        <div key={kategorie.key} className="category">
                          <h5>{kategorie.icon} {kategorie.label}</h5>
                          <ul>
                            {inhalte.length > 0 ? (
                              inhalte
                                .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))
                                .map(inhalt => (
                                  <li key={inhalt.id}>
                                    <div className="sv-pruef-inhalt-text">
                                      <span>{inhalt.inhalt || inhalt.titel}</span>
                                      {(inhalt.beschreibung) && (
                                        <span className="sv-pruef-beschreibung">{inhalt.beschreibung}</span>
                                      )}
                                    </div>
                                    <div className="inhalt-actions">
                                      <button
                                        className="sub-tab-btn sv-pruef-action-btn"
                                        onClick={() => handleEditPruefungsinhalt(grad, kategorie.key, inhalt)}
                                        title="Bearbeiten"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        className="sub-tab-btn sv-pruef-action-btn"
                                        onClick={() => handleDeletePruefungsinhalt(grad, kategorie.key, inhalt.id)}
                                        title="Löschen"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </li>
                                ))
                            ) : (kategorie.beispiele || []).length > 0 ? (
                              (kategorie.beispiele || []).map((beispiel, index) => (
                                <li key={`beispiel-${index}`}>{beispiel}</li>
                              ))
                            ) : (
                              <li className="sv-pruef-empty-hint">Noch keine Inhalte — klicke „+ Hinzufügen"</li>
                            )}
                          </ul>
                          <div className="sub-tabs sv-sub-tabs-mt">
                            <button
                              className="sub-tab-btn"
                              onClick={() => handleAddPruefungsinhalt(grad, kategorie.key)}
                            >
                              + Hinzufügen
                            </button>
                            <button
                              className="sub-tab-btn"
                              onClick={() => {
                                // Wenn eigene Inhalte vorhanden, bearbeite den ersten, sonst erstelle einen neuen
                                if (inhalte.length > 0) {
                                  handleEditPruefungsinhalt(grad, kategorie.key, inhalte[0]);
                                } else {
                                  handleAddPruefungsinhalt(grad, kategorie.key);
                                }
                              }}
                              title="Bearbeiten"
                            >
                              ✏️ Bearbeiten
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                    </>
                  )}
                </div>
              );
            })
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <h3>Noch keine Graduierungen vorhanden</h3>
            <p>Legen Sie zuerst Graduierungen an, um Prüfungsinhalte zu definieren</p>
          </div>
        )}
      </div>
    );
  };

  /**
   * KategorienEinstellungen - Kategorien für Prüfungsinhalte eines Stils verwalten
   */
  const KategorienEinstellungen = () => {
    const [newLabel, setNewLabel] = useState('');
    const [newIcon, setNewIcon] = useState('📋');
    const [editId, setEditId] = useState(null);
    const [editLabel, setEditLabel] = useState('');
    const [editIcon, setEditIcon] = useState('');
    const [saving, setSaving] = useState(false);
    const [localError, setLocalError] = useState('');
    // gradSelectId lebt im äußeren State (katGradSelectId) um Remount-Verlust zu vermeiden

    const stilId = currentStil?.stil_id;
    const graduierungen = (currentStil?.graduierungen || [])
      .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));

    const katSensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
    );

    const handleAdd = async () => {
      if (!newLabel.trim() || !stilId) return;
      setSaving(true);
      setLocalError('');
      try {
        const res = await fetch(`${API_BASE}/stile/${stilId}/kategorien`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: newLabel.trim(), icon: newIcon || '📋' })
        });
        const data = await res.json();
        if (!res.ok) { setLocalError(data.error || 'Fehler'); }
        else { setNewLabel(''); setNewIcon('📋'); fetchStilKategorien(stilId); }
      } catch (e) { setLocalError('Netzwerkfehler'); }
      setSaving(false);
    };

    const handleSaveEdit = async (katId) => {
      if (!editLabel.trim() || !stilId) return;
      setSaving(true);
      setLocalError('');
      try {
        const res = await fetch(`${API_BASE}/stile/${stilId}/kategorien/${katId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: editLabel.trim(), icon: editIcon || '📋' })
        });
        const data = await res.json();
        if (!res.ok) { setLocalError(data.error || 'Fehler'); }
        else { setEditId(null); fetchStilKategorien(stilId); }
      } catch (e) { setLocalError('Netzwerkfehler'); }
      setSaving(false);
    };

    const handleDelete = async (kat) => {
      if (!window.confirm(`Kategorie „${kat.label}" wirklich löschen?`)) return;
      setSaving(true);
      setLocalError('');
      try {
        const res = await fetch(`${API_BASE}/stile/${stilId}/kategorien/${kat.kategorie_id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) { setLocalError(data.error || 'Fehler'); }
        else { fetchStilKategorien(stilId); }
      } catch (e) { setLocalError('Netzwerkfehler'); }
      setSaving(false);
    };

    const handleToggleGraduierung = async (kat, graduierungId) => {
      // null = alle aktivieren
      let neueIds;
      if (graduierungId === null) {
        neueIds = null; // alle aktiv
      } else {
        const aktuelleIds = kat.aktive_graduierung_ids
          ? [...kat.aktive_graduierung_ids]
          : graduierungen.map(g => g.graduierung_id);
        if (aktuelleIds.includes(graduierungId)) {
          neueIds = aktuelleIds.filter(id => id !== graduierungId);
          if (neueIds.length === 0) neueIds = []; // mindestens leer, nicht null
        } else {
          neueIds = [...aktuelleIds, graduierungId];
          if (neueIds.length === graduierungen.length) neueIds = null; // alle aktiv → null
        }
      }
      // Optimistic update
      setStilKategorien(prev => prev.map(k =>
        k.kategorie_id === kat.kategorie_id ? { ...k, aktive_graduierung_ids: neueIds } : k
      ));
      try {
        const res = await fetch(`${API_BASE}/stile/${stilId}/kategorien/${kat.kategorie_id}/graduierungen`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aktive_graduierung_ids: neueIds })
        });
        if (!res.ok) fetchStilKategorien(stilId);
      } catch (e) { fetchStilKategorien(stilId); }
    };

    const handleDragEnd = async (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = stilKategorien.findIndex(k => k.kategorie_id === active.id);
      const newIdx = stilKategorien.findIndex(k => k.kategorie_id === over.id);
      const newOrder = arrayMove(stilKategorien, oldIdx, newIdx);
      // Optimistic update
      setStilKategorien(newOrder);
      const reorderData = newOrder.map((k, i) => ({ kategorie_id: k.kategorie_id, reihenfolge: i + 1 }));
      try {
        const res = await fetch(`${API_BASE}/stile/${stilId}/kategorien/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kategorien: reorderData })
        });
        if (!res.ok) fetchStilKategorien(stilId); // revert on error
      } catch (e) { fetchStilKategorien(stilId); setLocalError('Fehler beim Neuordnen'); }
    };

    return (
      <div className="pi-kat-einstellungen">
        <div className="section-header">
          <h3>Kategorien verwalten</h3>
          <p>Definiere die Prüfungskategorien für diesen Stil. Reihenfolge per Drag & Drop ändern.</p>
        </div>

        {localError && <div className="error-message sv-kat-error">⚠️ {localError}</div>}

        {kategorienLoading ? (
          <div className="sv-kat-loading">⏳ Kategorien werden geladen…</div>
        ) : (
          <DndContext sensors={katSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stilKategorien.map(k => k.kategorie_id)} strategy={verticalListSortingStrategy}>
              <div className="pi-kat-list">
                {stilKategorien.map(kat => (
                  <SortableKatItem
                    key={kat.kategorie_id}
                    kat={kat}
                    editId={editId}
                    editLabel={editLabel}
                    editIcon={editIcon}
                    saving={saving}
                    setEditId={setEditId}
                    setEditLabel={setEditLabel}
                    setEditIcon={setEditIcon}
                    onSaveEdit={handleSaveEdit}
                    onDelete={handleDelete}
                    graduierungen={graduierungen}
                    gradSelectId={katGradSelectId}
                    setGradSelectId={setKatGradSelectId}
                    onToggleGraduierung={handleToggleGraduierung}
                  />
                ))}
                {stilKategorien.length === 0 && (
                  <div className="empty-state"><p>Noch keine Kategorien angelegt</p></div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="pi-kat-add-form">
          <h4>Neue Kategorie hinzufügen</h4>
          <div className="pi-kat-add-row">
            <input
              type="text"
              value={newIcon}
              onChange={e => setNewIcon(e.target.value)}
              maxLength={4}
              className="pi-kat-icon-input"
              placeholder="🎯"
              title="Emoji-Icon (1-2 Zeichen)"
            />
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="pi-kat-label-input"
              placeholder="Kategorie-Name, z. B. Nage-waza…"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving || !newLabel.trim()}>
              + Hinzufügen
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  // Zeige Loading-Screen beim ersten Laden
  if (loading && stile.length === 0) {
    return (
      <div className="stil-verwaltung-loading">
        <div className="loading-spinner-large"></div>
        <p>Lade Stil-Verwaltung...</p>
      </div>
    );
  }

  // ============================================================================
  // HAUPT-RENDER
  // ============================================================================
  
  return (
    <div className="stil-verwaltung">
      <div className="stil-verwaltung-container">
        
        {/* Header-Bereich */}
        <div className="stil-header">
          <div className="header-left">
            <h1>Stil-Verwaltung</h1>
            <p>Kampfkunst-Stile, Graduierungen und Prüfungsanforderungen verwalten</p>
          </div>
          <div className="header-actions">
            {!currentStil && (
              <button
                className="add-stil-btn"
                onClick={() => setShowCreateForm(true)}
              >
                ➕ Neuen Stil hinzufügen
              </button>
            )}
            {currentStil && (
              <button 
                onClick={() => {
                  navigate('/dashboard/stile');
                  setCurrentStil(null);
                  setActiveTab('allgemein');
                }}
                className="back-btn"
                title="Zurück zur Übersicht"
              >
                ← Zurück zur Übersicht
              </button>
            )}
          </div>
        </div>

        {/* Nachrichten-Bereich */}
        <AnimatePresence>
          {success && (
            <motion.div
              key="success-message"
              className="success-message"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {success}
            </motion.div>
          )}
          {error && (
            <motion.div
              key="error-message"
              className="error-message"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {error}
              <button onClick={() => setError('')} className="message-close">×</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Haupt-Content */}
        <div className="stil-content">
          {!currentStil ? (
            // ======== ÜBERSICHTS-ANSICHT ========
            <div className="stil-overview">
              {/* Statistik-Karten */}
              <div className="stil-stats">
                <div className="stat-card">
                  <h3>{stile.filter(s => s.aktiv).length}</h3>
                  <p>Aktive Stile</p>
                </div>
                <div className="stat-card">
                  <h3>{stile.reduce((sum, s) => sum + (s.graduierungen?.length || 0), 0)}</h3>
                  <p>Gürtel gesamt</p>
                </div>
                <div className="stat-card">
                  <h3>{stile.reduce((sum, s) => sum + (s.anzahl_mitglieder || 0), 0)}</h3>
                  <p>Schüler gesamt</p>
                </div>
              </div>

              {/* Aktive Stil-Grid */}
              {stile.filter(s => s.aktiv).length > 0 ? (
                <>
                  <div className="stil-grid">
                    {(() => {
                      const sortedStile = stile
                        .filter(s => s.aktiv)
                        .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));

                      return sortedStile.map((stil, index) => (
                        <StilCard
                          key={stil.stil_id}
                          stil={stil}
                          onDelete={deleteStil}
                          onMoveUp={moveStilUp}
                          onMoveDown={moveStilDown}
                          isFirst={index === 0}
                          isLast={index === sortedStile.length - 1}
                        />
                      ));
                    })()}
                  </div>
                </>
              ) : stile.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎖️</div>
                  <h3>Noch keine Stile angelegt</h3>
                  <p>Legen Sie Ihren ersten Kampfkunst-Stil an, um zu beginnen</p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="sub-tab-btn"
                    disabled={loading}
                  >
                    + Ersten Stil anlegen
                  </button>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">✓</div>
                  <h3>Alle Stile sind inaktiv</h3>
                  <p>Aktivieren Sie einen Stil oder legen Sie einen neuen an</p>
                </div>
              )}

              {/* Inaktive Stile - Ausklappbarer Bereich */}
              {stile.filter(s => !s.aktiv).length > 0 && (
                <div className="inactive-stile-section">
                  <button
                    className="inactive-stile-toggle"
                    onClick={() => setShowInactiveStile(!showInactiveStile)}
                  >
                    <span className="toggle-icon">{showInactiveStile ? '▼' : '▶'}</span>
                    <span className="toggle-text">
                      Inaktive Stile ({stile.filter(s => !s.aktiv).length})
                    </span>
                  </button>

                  {showInactiveStile && (
                    <motion.div
                      className="stil-grid inactive-grid"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {stile
                        .filter(s => !s.aktiv)
                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                        .map(stil => (
                          <StilCard key={stil.stil_id} stil={stil} onDelete={deleteStil} />
                        ))}
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // ======== DETAIL-ANSICHT ========
            <div className="stil-detail">
              {/* Detail-Header */}
              <div className="stil-detail-header">
                <h2 className="stil-detail-title">{currentStil.name}</h2>
                <div className="stil-detail-stats">
                  <span>👥 {currentStil.anzahl_mitglieder || 0} Schüler</span>
                  <span>🎖️ {currentStil.graduierungen?.length || 0} Gürtel</span>
                  <span className={`status ${currentStil.aktiv ? 'active' : 'inactive'}`}>
                    {currentStil.aktiv ? '✅ Aktiv' : '❌ Inaktiv'}
                  </span>
                </div>
              </div>

              {/* Tab-Navigation */}
              <div className="tab-navigation">
                {[
                  { id: 'allgemein', label: '📋 Allgemein', title: 'Grundeinstellungen des Stils' },
                  { id: 'pruefungseinstellungen', label: '⏱️ Prüfungseinstellungen', title: 'Wartezeiten und Prüfungsregeln' },
                  { id: 'graduierungen', label: '🎖️ Graduierungen', title: 'Gürtel und Graduierungen verwalten' },
                  { id: 'pruefungsinhalte', label: '📝 Prüfungsinhalte', title: 'Prüfungsinhalte definieren' },
                  { id: 'stilmitglieder', label: '👥 Stilmitglieder', title: 'Mitglieder diesem Stil zuweisen' },
                  { id: 'statistiken', label: '📊 Statistiken', title: 'Auswertungen und Statistiken' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.title}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab-Content */}
              <div className="tab-content">
                {activeTab === 'allgemein' && (
                  <motion.div 
                    className="allgemein-tab"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3>Grundeinstellungen</h3>
                    
                    <div className="form-group">
                      <label className="form-label">Stil-Name:</label>
                      <input 
                        type="text" 
                        value={currentStil.name || ''} 
                        onChange={(e) => setCurrentStil({...currentStil, name: e.target.value})}
                        className="form-input"
                        placeholder="Name des Kampfkunst-Stils"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Beschreibung:</label>
                      <textarea 
                        value={currentStil.beschreibung || ''} 
                        onChange={(e) => setCurrentStil({...currentStil, beschreibung: e.target.value})}
                        rows="4"
                        className="form-textarea"
                        placeholder="Beschreibung des Kampfkunst-Stils..."
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">
                        <input 
                          type="checkbox" 
                          checked={currentStil.aktiv || false}
                          onChange={(e) => setCurrentStil({...currentStil, aktiv: e.target.checked})}
                        />
                        Stil ist aktiv
                      </label>
                      <small>Inaktive Stile werden nicht in der Schülerverwaltung angezeigt</small>
                    </div>
                    
                    <div className="sub-tabs">
                      <button
                        className="sub-tab-btn"
                        onClick={() => updateStil({
                          name: currentStil.name,
                          beschreibung: currentStil.beschreibung,
                          aktiv: currentStil.aktiv
                        })}
                        disabled={loading || !currentStil.name?.trim()}
                      >
                        {loading ? 'Wird gespeichert...' : '💾 Änderungen speichern'}
                      </button>

                      <button
                        className="sub-tab-btn"
                        onClick={() => deleteStil(currentStil.stil_id)}
                        disabled={loading}
                        title="Stil löschen oder deaktivieren"
                      >
                        🗑️ Stil löschen
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'pruefungseinstellungen' && (
                  <motion.div
                    className="pruefungseinstellungen-tab"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3>Prüfungseinstellungen</h3>
                    <p className="tab-description">
                      Definieren Sie die standardmäßigen Wartezeiten zwischen Gürtelprüfungen für verschiedene Stufen.
                    </p>

                    <div className="pruefungseinstellungen-container">
                      {/* Wartezeiten für Farbgürtel */}
                      <div className="wartezeiten-section">
                        <h4>Wartezeiten für Farbgürtel</h4>

                        <div className="form-group">
                          <label className="form-label">
                            Grundstufe (Monate):
                            <span className="label-info">Weiß-, Gelb-, Orangegurt</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={currentStil.wartezeit_grundstufe || 3}
                            onChange={(e) => setCurrentStil({
                              ...currentStil,
                              wartezeit_grundstufe: parseInt(e.target.value) || 3
                            })}
                            className="form-input"
                            placeholder="z.B. 3"
                          />
                          <small>Empfohlen: 3 Monate</small>
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            Mittelstufe (Monate):
                            <span className="label-info">Grün-, Blaugurt</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={currentStil.wartezeit_mittelstufe || 4}
                            onChange={(e) => setCurrentStil({
                              ...currentStil,
                              wartezeit_mittelstufe: parseInt(e.target.value) || 4
                            })}
                            className="form-input"
                            placeholder="z.B. 4"
                          />
                          <small>Empfohlen: 4 Monate</small>
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            Oberstufe (Monate):
                            <span className="label-info">Rot-, Braungurt</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={currentStil.wartezeit_oberstufe || 6}
                            onChange={(e) => setCurrentStil({
                              ...currentStil,
                              wartezeit_oberstufe: parseInt(e.target.value) || 6
                            })}
                            className="form-input"
                            placeholder="z.B. 6"
                          />
                          <small>Empfohlen: 6 Monate</small>
                        </div>
                      </div>

                      {/* Schwarzgurt-Einstellungen */}
                      <div className="schwarzgurt-section">
                        <h4>Schwarzgurt-Regelung (DAN-Grade)</h4>

                        <div className="form-group checkbox-group">
                          <label className="form-label checkbox-label">
                            <input
                              type="checkbox"
                              checked={currentStil.wartezeit_schwarzgurt_traditionell || false}
                              onChange={(e) => setCurrentStil({
                                ...currentStil,
                                wartezeit_schwarzgurt_traditionell: e.target.checked
                              })}
                            />
                            <span className="checkbox-text">
                              Traditionelle Wartezeiten verwenden
                            </span>
                          </label>
                          <div className="checkbox-info">
                            <p>Bei aktivierter Option gelten folgende Wartezeiten:</p>
                            <ul>
                              <li>1. DAN → 2. DAN: 2 Jahre</li>
                              <li>2. DAN → 3. DAN: 3 Jahre</li>
                              <li>3. DAN → 4. DAN: 4 Jahre</li>
                              <li>4. DAN → 5. DAN: 5 Jahre</li>
                              <li>usw. (DAN-Stufe = Jahre Wartezeit)</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="sub-tabs">
                      <button
                        className="sub-tab-btn"
                        onClick={() => updateStil({
                          name: currentStil.name,
                          beschreibung: currentStil.beschreibung,
                          aktiv: currentStil.aktiv,
                          wartezeit_grundstufe: currentStil.wartezeit_grundstufe,
                          wartezeit_mittelstufe: currentStil.wartezeit_mittelstufe,
                          wartezeit_oberstufe: currentStil.wartezeit_oberstufe,
                          wartezeit_schwarzgurt_traditionell: currentStil.wartezeit_schwarzgurt_traditionell
                        })}
                        disabled={loading || !currentStil.name?.trim()}
                      >
                        {loading ? 'Wird gespeichert...' : '💾 Einstellungen speichern'}
                      </button>

                      <button
                        className="sub-tab-btn sv-allgemein-apply-btn"
                        onClick={async () => {
                          if (!confirm('Möchten Sie die aktuellen Wartezeiten auf ALLE bestehenden Graduierungen anwenden?\n\nDies überschreibt die Mindestzeiten aller Graduierungen entsprechend ihrer Kategorie.\n\nHinweis: Kategorien werden automatisch basierend auf dem Gürtelnamen erkannt.')) {
                            return;
                          }

                          setLoading(true);
                          try {
                            const graduierungen = currentStil.graduierungen || [];
                            let updatedCount = 0;

                            // Funktion zum automatischen Erkennen der Kategorie basierend auf dem Namen
                            const detectKategorie = (name) => {
                              const nameLower = name.toLowerCase();

                              // DAN-Grade
                              if (nameLower.includes('dan') || nameLower.includes('schwarzgurt')) {
                                return 'dan';
                              }

                              // Meister
                              if (nameLower.includes('rot-weiß') || nameLower.includes('meister')) {
                                return 'meister';
                              }

                              // Oberstufe: Braun, Rot, kombiniert mit Schwarz
                              if (nameLower.includes('braun') || nameLower.includes('rot')) {
                                return 'oberstufe';
                              }

                              // Mittelstufe: Blau, Grün
                              if (nameLower.includes('blau') || nameLower.includes('grün')) {
                                return 'mittelstufe';
                              }

                              // Grundstufe: Weiß, Gelb, Orange
                              if (nameLower.includes('weiß') || nameLower.includes('gelb') || nameLower.includes('orange')) {
                                return 'grundstufe';
                              }

                              return null;
                            };

                            for (const grad of graduierungen) {
                              // Erkenne Kategorie automatisch - hat Vorrang vor bestehender Kategorie
                              const detectedKategorie = detectKategorie(grad.name);
                              const kategorie = detectedKategorie || grad.kategorie;
                              let newWaitTime = grad.mindestzeit_monate;

                              // Kategorie aktualisieren wenn sich die erkannte von der bestehenden unterscheidet
                              const updateKategorie = detectedKategorie && detectedKategorie !== grad.kategorie;

                              if (kategorie === 'grundstufe') {
                                newWaitTime = currentStil.wartezeit_grundstufe || 3;
                              } else if (kategorie === 'mittelstufe') {
                                newWaitTime = currentStil.wartezeit_mittelstufe || 4;
                              } else if (kategorie === 'oberstufe') {
                                newWaitTime = currentStil.wartezeit_oberstufe || 6;
                              } else if (kategorie === 'dan') {
                                if (currentStil.wartezeit_schwarzgurt_traditionell && grad.dan_grad >= 2) {
                                  // Traditionelle Wartezeiten: (n-1).DAN → n.DAN = n Jahre
                                  // 1→2.DAN: 2 Jahre, 2→3.DAN: 3 Jahre, 3→4.DAN: 4 Jahre ...
                                  newWaitTime = grad.dan_grad * 12;
                                } else {
                                  newWaitTime = currentStil.wartezeit_oberstufe || 6;
                                }
                              }

                              // Nur aktualisieren wenn sich was geändert hat oder Kategorie gesetzt werden soll
                              if (newWaitTime !== grad.mindestzeit_monate || updateKategorie) {
                                const response = await fetch(`${API_BASE}/stile/graduierungen/${grad.graduierung_id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    name: grad.name,
                                    reihenfolge: grad.reihenfolge,
                                    trainingsstunden_min: grad.trainingsstunden_min,
                                    mindestzeit_monate: newWaitTime,
                                    farbe_hex: grad.farbe_hex,
                                    farbe_sekundaer: grad.farbe_sekundaer,
                                    kategorie: kategorie, // Verwende die erkannte oder vorhandene Kategorie
                                    dan_grad: grad.dan_grad,
                                    aktiv: grad.aktiv
                                  })
                                });

                                if (response.ok) {
                                  updatedCount++;
                                  console.log(`✅ ${grad.name} aktualisiert: ${grad.mindestzeit_monate} → ${newWaitTime} Monate`);
                                } else {
                                  console.error(`❌ Fehler beim Aktualisieren von ${grad.name}`);
                                }
                              }
                            }

                            // Reload Stil to get updated graduations
                            await loadStil(currentStil.stil_id);

                            setSuccess(`${updatedCount} Graduierung(en) erfolgreich aktualisiert!`);
                            setTimeout(() => setSuccess(''), 3000);
                          } catch (err) {
                            console.error('Fehler beim Aktualisieren der Graduierungen:', err);
                            setError('Fehler beim Anwenden der Wartezeiten');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading || !currentStil.graduierungen?.length}
                      >
                        {loading ? 'Wird angewendet...' : '🔄 Auf alle Graduierungen anwenden'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'graduierungen' && (
                  <div className="sv-graduierungen-isolation">
                    <GraduierungManager />
                  </div>
                )}

                {activeTab === 'pruefungsinhalte' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Sub-Tab-Leiste */}
                    <div className="pi-subtabs">
                      <button
                        className={`pi-subtab-btn${pruefungsinhalteSubTab === 'inhalte' ? ' pi-subtab-btn--active' : ''}`}
                        onClick={() => setPruefungsinhalteSubTab('inhalte')}
                      >
                        📝 Inhalte
                      </button>
                      <button
                        className={`pi-subtab-btn${pruefungsinhalteSubTab === 'einstellungen' ? ' pi-subtab-btn--active' : ''}`}
                        onClick={() => setPruefungsinhalteSubTab('einstellungen')}
                      >
                        ⚙️ Einstellungen
                      </button>
                    </div>

                    {pruefungsinhalteSubTab === 'inhalte' && <PruefungsinhaltManager />}
                    {pruefungsinhalteSubTab === 'einstellungen' && <KategorienEinstellungen />}
                  </motion.div>
                )}
                
                {activeTab === 'stilmitglieder' && (
                  <motion.div
                    className="stilmitglieder-tab"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Header-Zeile */}
                    <div className="sv-sm-header">
                      <h3 className="sv-sm-title">
                        👥 Mitglieder in diesem Stil
                        <span className="sv-sm-count">{stilMitglieder.length}</span>
                      </h3>
                      <div className="sv-sm-header-actions">
                        {stilMitglieder.length > 0 && (
                          <button
                            className={`btn btn-sm${bulkGradMode ? ' btn-neutral' : ''}`}
                            style={!bulkGradMode ? { background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' } : {}}
                            onClick={() => {
                              setBulkGradMode(v => !v);
                              setBulkSelectedIds([]);
                              setBulkTargetGradId('');
                            }}
                          >
                            {bulkGradMode ? '✕ Abbrechen' : '🎖️ Gürtel zuweisen'}
                          </button>
                        )}
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setShowMemberPicker(true);
                            setMemberPickerSearch('');
                            setTimeout(() => memberPickerSearchRef.current?.focus(), 80);
                          }}
                        >
                          + Mitglied hinzufügen
                        </button>
                      </div>
                    </div>

                    {/* Bulk-Gürtelzuweisung Panel */}
                    {bulkGradMode && (
                      <div className="sv-sm-bulk-panel">
                        <label className="sv-sm-bulk-label">
                          <input
                            type="checkbox"
                            checked={bulkSelectedIds.length === stilMitglieder.length && stilMitglieder.length > 0}
                            onChange={e => setBulkSelectedIds(e.target.checked ? stilMitglieder.map(m => m.mitglied_id) : [])}
                          />
                          Alle auswählen ({bulkSelectedIds.length} gewählt)
                        </label>
                        <select
                          className="sv-sm-bulk-select"
                          value={bulkTargetGradId}
                          onChange={e => setBulkTargetGradId(e.target.value)}
                        >
                          <option value="">Gürtel wählen…</option>
                          {(currentStil?.graduierungen || [])
                            .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))
                            .map(g => (
                              <option key={g.graduierung_id} value={g.graduierung_id}>{g.name}</option>
                            ))}
                        </select>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={handleBulkGraduierung}
                          disabled={bulkSaving || !bulkTargetGradId || bulkSelectedIds.length === 0}
                        >
                          {bulkSaving ? 'Wird gespeichert…' : `✓ Zuweisen (${bulkSelectedIds.length})`}
                        </button>
                      </div>
                    )}

                    {/* Suchfeld für aktuelle Mitglieder */}
                    <input
                      className="sv-sm-search"
                      type="text"
                      placeholder="Mitglieder filtern…"
                      value={stilMitgliederSearch}
                      onChange={e => setStilMitgliederSearch(e.target.value)}
                    />

                    {/* Mitgliederliste */}
                    {stilMitgliederLoading ? (
                      <div className="no-data-message"><p>Mitglieder werden geladen…</p></div>
                    ) : stilMitglieder.length === 0 ? (
                      <div className="no-data-message">
                        <p>Noch keine Mitglieder in diesem Stil. Klicke auf „Mitglied hinzufügen".</p>
                      </div>
                    ) : (
                      <div className="sv-sm-list">
                        {stilMitglieder
                          .filter(m => {
                            const q = stilMitgliederSearch.toLowerCase();
                            return !q || `${m.vorname} ${m.nachname}`.toLowerCase().includes(q);
                          })
                          .map(m => (
                            <div
                              key={m.mitglied_id}
                              className={`sv-sm-item${bulkGradMode && bulkSelectedIds.includes(m.mitglied_id) ? ' sv-sm-item--selected' : ''}`}
                              onClick={bulkGradMode ? () => setBulkSelectedIds(prev =>
                                prev.includes(m.mitglied_id)
                                  ? prev.filter(id => id !== m.mitglied_id)
                                  : [...prev, m.mitglied_id]
                              ) : undefined}
                              style={bulkGradMode ? { cursor: 'pointer' } : {}}
                            >
                              {bulkGradMode && (
                                <input
                                  type="checkbox"
                                  className="sv-sm-checkbox"
                                  checked={bulkSelectedIds.includes(m.mitglied_id)}
                                  onChange={() => {}}
                                  onClick={e => e.stopPropagation()}
                                />
                              )}
                              <div
                                className="sv-sm-belt-dot"
                                style={{ background: m.farbe_hex || '#888' }}
                                title={m.graduierung_name || 'Kein Gürtel'}
                              />
                              <div className="sv-sm-info">
                                <span className="sv-sm-name">{m.vorname} {m.nachname}</span>
                                {m.graduierung_name && (
                                  <span className="sv-sm-grad">{m.graduierung_name}</span>
                                )}
                              </div>
                              {!bulkGradMode && (
                                <button
                                  className="sv-sm-remove-btn"
                                  title="Aus Stil entfernen"
                                  onClick={() => removeMemberFromStil(m.mitglied_id, `${m.vorname} ${m.nachname}`)}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'statistiken' && (
                  <motion.div
                    className="statistiken-tab"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {loadingStats && (
                      <div className="no-data-message">
                        <p>Statistiken werden geladen...</p>
                      </div>
                    )}

                    {!statistiken && !loadingStats && (
                      <div className="no-data-message">
                        <p>Keine Statistiken verfügbar. Bitte wählen Sie einen Stil aus.</p>
                      </div>
                    )}

                    {statistiken && !loadingStats && (
                      <div className="stats-container">

                        {/* Zusammenfassung oben - 3 Boxen nebeneinander */}
                        {statistiken?.summary && (
                          <div className="sv-stats-summary-grid">
                            <div className="sv-stat-summary-card">
                              <div className="sv-stat-label">
                                Gürtel gesamt
                              </div>
                              <div className="sv-stat-value">
                                {statistiken.summary.total_graduierungen || 0}
                              </div>
                            </div>
                            <div className="sv-stat-summary-card">
                              <div className="sv-stat-label">
                                Aktive Mitglieder
                              </div>
                              <div className="sv-stat-value">
                                {statistiken.summary.total_mitglieder || 0}
                              </div>
                            </div>
                            <div className="sv-stat-summary-card">
                              <div className="sv-stat-label">
                                Kategorien
                              </div>
                              <div className="sv-stat-value">
                                {statistiken.summary.kategorien_count || 0}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Hauptbereich: Schüler-Verteilung und Prüfungs-Erfolgsrate nebeneinander */}
                        <div className="sv-stats-main-grid">

                          {/* Linke Spalte: Schüler-Verteilung */}
                          {statistiken?.graduierungen && statistiken.graduierungen.length > 0 && (
                            <div className="sv-stats-card">
                              <h4 className="sv-stats-card-title">
                                👥 Schüler-Verteilung nach Gürteln
                              </h4>
                              <p className="sv-stats-card-subtitle">
                                Anzahl der Schüler pro Gürtelfarbe
                              </p>
                              <div className="sv-punkte-grid">
                                {statistiken.graduierungen.map((grad, idx) => (
                                  <GurtStatistikItem
                                    key={grad.graduierung_id || idx}
                                    grad={grad}
                                    stilId={currentStil?.stil_id}
                                    API_BASE={API_BASE}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Rechte Spalte: Prüfungs-Erfolgsrate */}
                          {pruefungsStats?.gesamt && (
                            <div className="sv-pruef-success-panel">
                              <h4 className="sv-stats-card-title-center">
                                ✅ Prüfungs-Erfolgsrate
                              </h4>
                              <p className="sv-stats-card-subtitle-center">
                                Erfolgsquote bei Gürtelprüfungen
                              </p>

                              {/* Großer Prozentkreis */}
                              <div className="sv-percent-circle-wrap">
                                <div className="sv-percent-circle">
                                  <div className="sv-percent-number">
                                    {pruefungsStats.gesamt.gesamt > 0
                                      ? Math.round((pruefungsStats.gesamt.bestanden / pruefungsStats.gesamt.gesamt) * 100)
                                      : 0}%
                                  </div>
                                  <div className="sv-percent-label">
                                    Erfolgsrate
                                  </div>
                                </div>
                              </div>

                              {/* Details */}
                              <div className="sv-stat-details-col">
                                <div className="sv-stat-detail-row">
                                  <span className="sv-stat-detail-label">Gesamt:</span>
                                  <span className="sv-stat-detail-value">
                                    {pruefungsStats.gesamt.gesamt || 0}
                                  </span>
                                </div>
                                <div className="sv-stat-detail-row--green">
                                  <span className="sv-stat-detail-label">Bestanden:</span>
                                  <span className="sv-stat-detail-value--green">
                                    {pruefungsStats.gesamt.bestanden || 0}
                                  </span>
                                </div>
                                <div className="sv-stat-detail-row--red">
                                  <span className="sv-stat-detail-label">Nicht bestanden:</span>
                                  <span className="sv-stat-detail-value--red">
                                    {pruefungsStats.gesamt.nicht_bestanden || 0}
                                  </span>
                                </div>
                                <div className="sv-stat-detail-row--orange">
                                  <span className="sv-stat-detail-label">Geplant:</span>
                                  <span className="sv-stat-detail-value--orange">
                                    {pruefungsStats.gesamt.geplant || 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>

                        {/* Pruefungs-Punkte Statistik */}
                        {statistiken?.pruefungsPunkte?.pro_graduierung?.length > 0 && (
                          <div className="sv-stats-card-mt">
                            <h4 className="sv-stats-card-title">
                              📊 Pruefungs-Punkte nach Graduierung
                            </h4>
                            <p className="sv-stats-card-subtitle">
                              Durchschnittliche Punktzahl bei Pruefungen
                            </p>

                            {/* Gesamt-Durchschnitt */}
                            {statistiken.pruefungsPunkte.gesamt && (
                              <div className="sv-punkte-gesamt-row">
                                <div className="sv-center-flex">
                                  <div className="sv-meta-label">
                                    Gesamt-Durchschnitt
                                  </div>
                                  <div className="sv-stat-lg">
                                    {statistiken.pruefungsPunkte.gesamt.durchschnitt?.toFixed(1) || '0'}
                                  </div>
                                </div>
                                <div className="sv-center-flex">
                                  <div className="sv-meta-label">
                                    Pruefungen gesamt
                                  </div>
                                  <div className="sv-stat-lg">
                                    {statistiken.pruefungsPunkte.gesamt.gesamt_pruefungen || 0}
                                  </div>
                                </div>
                                <div className="sv-center-flex">
                                  <div className="sv-meta-label">
                                    Erfolgsquote
                                  </div>
                                  <div className="sv-erfolgsquote">
                                    {statistiken.pruefungsPunkte.gesamt.gesamt_pruefungen > 0
                                      ? Math.round((statistiken.pruefungsPunkte.gesamt.gesamt_bestanden / statistiken.pruefungsPunkte.gesamt.gesamt_pruefungen) * 100)
                                      : 0}%
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Punkte pro Graduierung */}
                            <div className="sv-punkte-grid">
                              {statistiken.pruefungsPunkte.pro_graduierung.map((grad, idx) => (
                                <div
                                  key={idx}
                                  className="sv-punkte-row"
                                  style={{ '--grad-farbe': grad.graduierung_farbe || '#FFD700' }}
                                >
                                  <div className="sv-punkte-dot" />
                                  <div className="u-flex-1-min0">
                                    <div className="sv-text-primary-14">
                                      {grad.graduierung_name}
                                    </div>
                                    <div className="sv-text-muted-12">
                                      {grad.anzahl_pruefungen} Pruefungen
                                    </div>
                                  </div>
                                  <div className="sv-text-right">
                                    <div className="sv-stat-md">
                                      {parseFloat(grad.durchschnitt_punkte)?.toFixed(1) || '0'}
                                    </div>
                                    <div className="sv-text-muted-11">
                                      ({parseFloat(grad.min_punkte)?.toFixed(0) ?? '0'} - {parseFloat(grad.max_punkte)?.toFixed(0) ?? '0'})
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Hochstufungen / Promotions */}
                        {statistiken?.hochstufungen && (
                          <div className="sv-stats-card-mt">
                            <h4 className="sv-stats-card-title">
                              🎓 Hochstufungen (letzte 12 Monate)
                            </h4>
                            <p className="sv-stats-card-subtitle">
                              Erfolgreiche Pruefungen und Graduierungswechsel
                            </p>

                            {/* Gesamt-Zahl */}
                            <div className="sv-hochstufungen-total">
                              <div className="sv-hochstufungen-number">
                                {statistiken.hochstufungen.gesamt_12_monate || 0}
                              </div>
                              <div className="sv-hochstufungen-label">
                                Hochstufungen in 12 Monaten
                              </div>
                            </div>

                            {/* Hochstufungen pro Monat */}
                            {statistiken.hochstufungen.pro_monat?.length > 0 && (
                              <div className="sv-mb-20">
                                <div className="sv-label-secondary-13">
                                  Verlauf nach Monat:
                                </div>
                                <div className="sv-monat-chips">
                                  {statistiken.hochstufungen.pro_monat.slice(0, 6).map((monat, idx) => (
                                    <div key={idx} className="sv-monat-chip">
                                      <div className="sv-stat-md">
                                        {monat.anzahl}
                                      </div>
                                      <div className="sv-text-muted-11">
                                        {monat.monat_label}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Letzte Hochstufungen */}
                            {statistiken.hochstufungen.letzte?.length > 0 && (
                              <div>
                                <div className="sv-label-secondary-13">
                                  Letzte Hochstufungen:
                                </div>
                                <div className="sv-letzte-hochstufungen">
                                  {statistiken.hochstufungen.letzte.slice(0, 10).map((h, idx) => (
                                    <div
                                      key={idx}
                                      className="sv-hochstufung-row"
                                      style={{ '--zu-farbe': h.zu_farbe || '#FFD700', '--von-farbe': h.von_farbe || '#ccc' }}
                                    >
                                      <div className="u-flex-1">
                                        <div className="sv-text-primary-14">
                                          {h.vorname} {h.nachname}
                                        </div>
                                        <div className="sv-farb-arrow">
                                          <div className="sv-farb-dot-sm" style={{ '--dot-color': h.von_farbe || '#ccc' }} />
                                          <span className="sv-text-muted-12">→</span>
                                          <div className="sv-farb-dot-sm" style={{ '--dot-color': h.zu_farbe || '#FFD700' }} />
                                          <span className="sv-text-secondary-12">
                                            {h.zu_graduierung}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="sv-text-right">
                                        <div className="sv-text-secondary-12">
                                          {new Date(h.pruefungsdatum).toLocaleDateString('de-DE')}
                                        </div>
                                        {h.punktzahl && (
                                          <div className="sv-punktzahl">
                                            {h.punktzahl}/{h.max_punktzahl || 100} Pkt.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal: Neuen Stil erstellen - Mehrstufig */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              className="modal-overlay sv-create-modal-overlay-flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => resetCreateModal()}
            >
              <motion.div
                className="modal-content create-stil-modal stil-modal sv-modal-content sv-modal-content--700"
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 50 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header mit Fortschritt */}
                <div className="modal-header">
                  <div className="modal-title-section">
                    <h3 className="modal-title">Neuen Stil anlegen</h3>
                    <div className="progress-indicator">
                      <div className={`progress-step ${createStep >= 1 ? 'active' : ''}`}>1</div>
                      <div className={`progress-line ${createStep >= 2 ? 'active' : ''}`}></div>
                      <div className={`progress-step ${createStep >= 2 ? 'active' : ''}`}>2</div>
                      <div className={`progress-line ${createStep >= 3 ? 'active' : ''}`}></div>
                      <div className={`progress-step ${createStep >= 3 ? 'active' : ''}`}>3</div>
                    </div>
                  </div>
                  <button 
                    className="modal-close"
                    onClick={() => resetCreateModal()}
                    title="Schließen"
                  >
                    ×
                  </button>
                </div>

                {/* Schritt 1: Grundinformationen */}
                {createStep === 1 && (
                  <motion.div
                    className="modal-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="step-title">
                      <h4>📝 Grundinformationen</h4>
                      <p>Geben Sie die grundlegenden Informationen zum neuen Stil ein.</p>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Stil-Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        placeholder="z.B. Karate, Taekwon-Do, Kickboxen..."
                        className="form-input"
                        autoFocus
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Kategorie</label>
                      <select
                        value={formData.kategorie}
                        onChange={(e) => handleFormChange('kategorie', e.target.value)}
                        className="form-select"
                      >
                        <option value="kampfkunst">🥋 Kampfkunst</option>
                        <option value="selbstverteidigung">🛡️ Selbstverteidigung</option>
                        <option value="fitness">💪 Fitness & Kondition</option>
                        <option value="sport">🏆 Wettkampfsport</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Beschreibung</label>
                      <textarea
                        value={formData.beschreibung}
                        onChange={(e) => handleFormChange('beschreibung', e.target.value)}
                        rows="3"
                        placeholder="Kurze Beschreibung des Stils, seiner Herkunft und Besonderheiten..."
                        className="form-textarea"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Schritt 2: Trainingsdetails */}
                {createStep === 2 && (
                  <motion.div
                    className="modal-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="step-title">
                      <h4>⚙️ Trainingsdetails</h4>
                      <p>Definieren Sie die Trainingsparameter für diesen Stil.</p>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Schwierigkeitsgrad</label>
                        <select
                          value={formData.schwierigkeitsgrad}
                          onChange={(e) => handleFormChange('schwierigkeitsgrad', e.target.value)}
                          className="form-select"
                        >
                          <option value="anfaenger">🟢 Anfänger</option>
                          <option value="mittel">🟡 Mittel</option>
                          <option value="fortgeschritten">🔴 Fortgeschritten</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Altersgruppe</label>
                        <select
                          value={formData.altergruppe}
                          onChange={(e) => handleFormChange('altergruppe', e.target.value)}
                          className="form-select"
                        >
                          <option value="kinder">👶 Kinder (4-12)</option>
                          <option value="jugendliche">🧒 Jugendliche (13-17)</option>
                          <option value="erwachsene">👨 Erwachsene (18+)</option>
                          <option value="alle">👥 Alle Altersgruppen</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Trainingsdauer (Minuten)</label>
                      <input
                        type="number"
                        value={formData.trainingsdauer}
                        onChange={(e) => handleFormChange('trainingsdauer', parseInt(e.target.value))}
                        min="30"
                        max="180"
                        step="15"
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Benötigte Ausrüstung</label>
                      <div className="equipment-tags">
                        {['Gi/Anzug', 'Gürtel', 'Handschuhe', 'Schienbeinschoner', 'Mundschutz', 'Boxhandschuhe'].map(equipment => (
                          <label key={equipment} className="equipment-tag">
                            <input
                              type="checkbox"
                              checked={formData.ausruestung.includes(equipment)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleFormChange('ausruestung', [...formData.ausruestung, equipment]);
                                } else {
                                  handleFormChange('ausruestung', formData.ausruestung.filter(item => item !== equipment));
                                }
                              }}
                            />
                            <span>{equipment}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Schritt 3: Bestätigung */}
                {createStep === 3 && (
                  <motion.div
                    className="modal-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="step-title">
                      <h4>✅ Bestätigung</h4>
                      <p>Überprüfen Sie Ihre Eingaben vor dem Erstellen.</p>
                    </div>

                    <div className="confirmation-summary">
                      <div className="summary-item">
                        <strong>Name:</strong> {formData.name}
                      </div>
                      <div className="summary-item">
                        <strong>Kategorie:</strong> {formData.kategorie}
                      </div>
                      <div className="summary-item">
                        <strong>Schwierigkeitsgrad:</strong> {formData.schwierigkeitsgrad}
                      </div>
                      <div className="summary-item">
                        <strong>Altersgruppe:</strong> {formData.altergruppe}
                      </div>
                      <div className="summary-item">
                        <strong>Trainingsdauer:</strong> {formData.trainingsdauer} Minuten
                      </div>
                      {formData.beschreibung && (
                        <div className="summary-item">
                          <strong>Beschreibung:</strong> {formData.beschreibung}
                        </div>
                      )}
                      {formData.ausruestung.length > 0 && (
                        <div className="summary-item">
                          <strong>Ausrüstung:</strong> {formData.ausruestung.join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <input
                          type="checkbox"
                          checked={formData.aktiv}
                          onChange={(e) => handleFormChange('aktiv', e.target.checked)}
                        />
                        Stil ist sofort aktiv und verfügbar
                      </label>
                    </div>
                  </motion.div>
                )}

                {/* Navigation */}
                <div className="modal-actions">
                  <button 
                    onClick={() => resetCreateModal()}
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    Abbrechen
                  </button>
                  
                  <div className="step-navigation">
                    {createStep > 1 && (
                      <button 
                        onClick={() => setCreateStep(createStep - 1)}
                        className="btn btn-outline"
                        disabled={loading}
                      >
                        ← Zurück
                      </button>
                    )}
                    
                    {createStep < 3 ? (
                      <button 
                        onClick={() => setCreateStep(createStep + 1)}
                        className="btn btn-primary"
                        disabled={!formData.name.trim() || loading}
                      >
                        Weiter →
                      </button>
                    ) : (
                      <button 
                        onClick={createStil}
                        className="btn btn-success"
                        disabled={!formData.name.trim() || loading}
                      >
                        {loading ? 'Wird erstellt...' : '✅ Stil anlegen'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal für Graduierung bearbeiten */}
        <AnimatePresence>
          {showEditGraduierung && editingGraduierung && (
            <motion.div 
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseEditModal}
            >
              <motion.div
                className="modal-content stil-modal"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3 className="modal-title">Graduierung bearbeiten</h3>
                  <button 
                    className="modal-close"
                    onClick={handleCloseEditModal}
                    title="Schließen"
                  >
                    ×
                  </button>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Name:</label>
                  <input
                    type="text"
                    value={editingGraduierung.name}
                    onChange={(e) => setEditingGraduierung({
                      ...editingGraduierung,
                      name: e.target.value
                    })}
                    placeholder="Graduierungsname"
                    className="form-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Reihenfolge:</label>
                    <input
                      type="number"
                      min="1"
                      value={editingGraduierung.reihenfolge || ''}
                      onChange={(e) => setEditingGraduierung({
                        ...editingGraduierung,
                        reihenfolge: parseInt(e.target.value) || 1
                      })}
                      placeholder="Reihenfolge (z.B. 1, 2, 3...)"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Trainingsstunden (min.):</label>
                    <input
                      type="number"
                      min="0"
                      value={editingGraduierung.trainingsstunden_min || ''}
                      onChange={(e) => setEditingGraduierung({
                        ...editingGraduierung,
                        trainingsstunden_min: parseInt(e.target.value) || 0
                      })}
                      placeholder="Mindest-Trainingsstunden"
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Mindestzeit (Monate):</label>
                    <input
                      type="number"
                      min="0"
                      value={editingGraduierung.mindestzeit_monate || ''}
                      onChange={(e) => setEditingGraduierung({
                        ...editingGraduierung,
                        mindestzeit_monate: parseInt(e.target.value) || 0
                      })}
                      placeholder="Mindestzeit in Monaten"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Primärfarbe:</label>
                    <input
                      type="color"
                      value={editingGraduierung.farbe_hex || '#FFFFFF'}
                      onChange={(e) => setEditingGraduierung({
                        ...editingGraduierung,
                        farbe_hex: e.target.value
                      })}
                      className="color-picker"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Sekundärfarbe (optional):</label>
                    <input
                      type="color"
                      value={editingGraduierung.farbe_sekundaer || ''}
                      onChange={(e) => setEditingGraduierung({
                        ...editingGraduierung,
                        farbe_sekundaer: e.target.value
                      })}
                      className="color-picker"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kategorie (optional):</label>
                    <select
                      value={editingGraduierung.kategorie || ''}
                      onChange={(e) => {
                        const selectedKategorie = e.target.value || null;

                        // Automatisch passende Wartezeit aus Prüfungseinstellungen vorschlagen
                        let suggestedWaitTime = editingGraduierung.mindestzeit_monate;
                        if (selectedKategorie === 'grundstufe' && currentStil?.wartezeit_grundstufe) {
                          suggestedWaitTime = currentStil.wartezeit_grundstufe;
                        } else if (selectedKategorie === 'mittelstufe' && currentStil?.wartezeit_mittelstufe) {
                          suggestedWaitTime = currentStil.wartezeit_mittelstufe;
                        } else if (selectedKategorie === 'oberstufe' && currentStil?.wartezeit_oberstufe) {
                          suggestedWaitTime = currentStil.wartezeit_oberstufe;
                        }

                        setEditingGraduierung({
                          ...editingGraduierung,
                          kategorie: selectedKategorie,
                          mindestzeit_monate: suggestedWaitTime
                        });
                      }}
                      className="form-select"
                    >
                      <option value="">Keine Kategorie</option>
                      <option value="grundstufe">Grundstufe</option>
                      <option value="mittelstufe">Mittelstufe</option>
                      <option value="oberstufe">Oberstufe</option>
                      <option value="meister">Meister</option>
                    </select>
                  </div>
                </div>

                {/* Belt-Vorschau */}
                <div className="belt-preview-section">
                  <h4>Gürtel-Vorschau:</h4>
                  <div className="selected-belt-preview">
                    <BeltPreview 
                      primaer={editingGraduierung.farbe_hex || '#FFFFFF'} 
                      sekundaer={editingGraduierung.farbe_sekundaer || ''} 
                      size="large"
                    />
                    <div className="belt-info">
                      <strong>{editingGraduierung.name || 'Unbenannte Graduierung'}</strong>
                      <div className="color-codes">
                        <span>Primär: {editingGraduierung.farbe_hex || '#FFFFFF'}</span>
                        {editingGraduierung.farbe_sekundaer && (
                          <span>Sekundär: {editingGraduierung.farbe_sekundaer}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-actions">
                  <button 
                    onClick={handleCloseEditModal}
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    Abbrechen
                  </button>
                  <button 
                    onClick={saveGraduierungEdit}
                    className="btn btn-primary"
                    disabled={!editingGraduierung.name?.trim() || loading}
                  >
                    {loading ? 'Wird gespeichert...' : '✅ Speichern'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Prüfungsinhalt hinzufügen/bearbeiten */}
        <PruefungsinhaltFormModal />

        {/* Modal: Prüfungsinhalte anzeigen */}
        <PruefungsinhalteViewModal />

        {/* Modal: Mitglied zum Stil hinzufügen */}
        <AnimatePresence>
          {showMemberPicker && (
            <motion.div
              className="sv-sm-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMemberPicker(false)}
            >
              <motion.div
                className="sv-sm-modal"
                initial={{ scale: 0.92, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 30 }}
                transition={{ duration: 0.2 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="sv-sm-modal-header">
                  <h3 className="sv-sm-modal-title">
                    👥 Mitglied hinzufügen
                    <span className="sv-sm-modal-subtitle">
                      {currentStil?.name}
                    </span>
                  </h3>
                  <button className="modal-close" onClick={() => setShowMemberPicker(false)}>×</button>
                </div>

                <input
                  ref={memberPickerSearchRef}
                  className="sv-sm-modal-search"
                  type="text"
                  placeholder="Name oder E-Mail suchen…"
                  value={memberPickerSearch}
                  onChange={e => setMemberPickerSearch(e.target.value)}
                />

                {(() => {
                  const available = alleDojMitglieder.filter(
                    m => !stilMitglieder.find(sm => sm.mitglied_id === m.mitglied_id)
                  ).filter(m => {
                    const q = memberPickerSearch.toLowerCase();
                    return !q
                      || `${m.vorname} ${m.nachname}`.toLowerCase().includes(q)
                      || (m.email || '').toLowerCase().includes(q);
                  });

                  if (alleDojMitglieder.length === 0) {
                    return <div className="sv-sm-modal-empty">Mitglieder werden geladen…</div>;
                  }
                  if (available.length === 0) {
                    return (
                      <div className="sv-sm-modal-empty">
                        {memberPickerSearch
                          ? `Kein Treffer für „${memberPickerSearch}"`
                          : 'Alle Mitglieder sind bereits zugewiesen'}
                      </div>
                    );
                  }
                  return (
                    <div className="sv-sm-modal-list">
                      {available.map(m => (
                        <button
                          key={m.mitglied_id}
                          className="sv-sm-modal-item"
                          onClick={() => addMemberToStil(m.mitglied_id)}
                        >
                          <span className="sv-sm-modal-avatar">
                            {(m.vorname || '?')[0]}{(m.nachname || '?')[0]}
                          </span>
                          <div className="sv-sm-modal-info">
                            <span className="sv-sm-modal-name">{m.vorname} {m.nachname}</span>
                            {m.email && <span className="sv-sm-modal-email">{m.email}</span>}
                          </div>
                          <span className="sv-sm-modal-add">+</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default StilVerwaltung;

/*
================================================================================
KOMPONENTEN-DOKUMENTATION v2.2 - MIT @DND-KIT DRAG & DROP
================================================================================

NEUE FEATURES v2.2:
✅ @dnd-kit Drag & Drop Implementation (React 18 kompatibel)
✅ SortableContext mit verticalListSortingStrategy
✅ DragOverlay für smooth Drag-Feedback
✅ Touch-optimierte Sensors für Mobile
✅ Optimistic Updates mit Rollback bei Fehlern
✅ Visuelles Feedback mit CSS-Klassen (is-dragging, is-dragging-overlay)
✅ Drag-Handle mit ⋮⋮ Icon für bessere UX

DEPENDENCIES:
- npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

API-ENDPUNKTE:
- PUT /api/stile/:stilId/graduierungen/reorder - Graduierungen neu ordnen

@DND-KIT KOMPONENTEN:
- DndContext - Haupt-Drag-Context mit Sensors
- SortableContext - Container für sortierbare Items
- useSortable - Hook für einzelne sortierbare Elemente
- DragOverlay - Visuelles Overlay während des Dragging

VERWENDETE HOOKS:
- useState: Drag-States (activeId, draggedGraduierung)
- useEffect: Lifecycle-Hooks  
- useNavigate: React Router Navigation
- useParams: URL-Parameter
- useSensor: @dnd-kit Touch/Pointer/Keyboard Sensoren

CSS-KLASSEN:
- .is-dragging - Element während des Dragging
- .is-dragging-overlay - Drag-Overlay Element
- .is-drag-over - Drop-Zone während Hover
- .drag-handle - Zieh-Griff
- .drag-handle-icon - ⋮⋮ Icon
- .drag-drop-info - Info-Box für Benutzer

BACKEND-ANFORDERUNGEN:
PUT /api/stile/:stilId/graduierungen/reorder
Body: { graduierungen: [{ graduierung_id, reihenfolge }] }

VERBESSERUNGEN GEGENÜBER REACT-BEAUTIFUL-DND:
- Bessere Performance und Stabilität
- React 18+ Concurrent Features Kompatibilität
- Verbesserte Touch-Unterstützung
- Flexible Collision Detection Algorithmen
- Bessere Accessibility-Unterstützung
- Moderne TypeScript Integration
- Aktive Entwicklung und Community
================================================================================
*/
