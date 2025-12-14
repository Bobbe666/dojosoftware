/*
================================================================================
STIL-VERWALTUNG REACT KOMPONENTE - MIT @DND-KIT DRAG & DROP v2.2
================================================================================
Diese Komponente verwaltet Kampfkunst-Stile, ihre Graduierungen und Prüfungsinhalte.
NEUE FEATURES v2.2: Moderne @dnd-kit Drag & Drop Implementation
DEPENDENCIES: npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
================================================================================
*/

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
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

const StilVerwaltung = () => {
  const navigate = useNavigate();
  const { stilId } = useParams();
  
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
  const [draggedGraduierung, setDraggedGraduierung] = useState(null); // Gezogene Graduierung

  // Prüfungsinhalte States
  const [showPruefungsinhaltForm, setShowPruefungsinhaltForm] = useState(false); // Modal für Prüfungsinhalt
  const [editingPruefungsinhalt, setEditingPruefungsinhalt] = useState(null);   // Zu bearbeitender Inhalt
  const [selectedGraduierung, setSelectedGraduierung] = useState(null);          // Graduierung für den Inhalt
  const [selectedKategorie, setSelectedKategorie] = useState('');                // Kategorie (Grundtechniken, Kata, etc.)
  const [showPruefungsinhalteModal, setShowPruefungsinhalteModal] = useState(false); // Modal zum Anzeigen der Prüfungsinhalte
  const [viewingGraduierung, setViewingGraduierung] = useState(null);            // Graduierung deren Inhalte angezeigt werden


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
  const API_BASE = config?.apiBaseUrl || 'http://localhost:3002/api';

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
      <div className={`${sizeClass} ${className}`}>
        {/* Basis-Gürtel mit Primärfarbe */}
        <div 
          className="belt-base" 
          style={{ backgroundColor: primaer || '#CCCCCC' }}
        >
          {/* Sekundärer Streifen wenn vorhanden */}
          {sekundaer && (
            <div 
              className="belt-stripe" 
              style={{ backgroundColor: sekundaer }}
            />
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
        console.log('✅ Stil geladen:', data.name);
      } else {
        // Fallback: Suche im lokalen Array
        const stil = stile.find(s => s.stil_id === parseInt(id));
        if (stil) {
          setCurrentStil(stil);
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
    
    // Prüfe ob Stil Daten hat
    const hasData = (stil.anzahl_mitglieder && stil.anzahl_mitglieder > 0) || 
                   (stil.graduierungen && stil.graduierungen.length > 0);
    
    if (hasData) {
      // Stil hat Daten - nur Deaktivierung möglich
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
  const handleSavePruefungsinhalt = async (inhaltText) => {
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
        updatedInhalte[index] = { ...editingPruefungsinhalt, inhalt: inhaltText };
      } else {
        // Neu hinzufügen
        const newInhalt = {
          id: Date.now(), // Temporäre ID
          inhalt: inhaltText,
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
   * Öffnet das Modal zum Anzeigen der Prüfungsinhalte
   */
  const handleShowPruefungsinhalte = (graduierung) => {
    setViewingGraduierung(graduierung);
    setShowPruefungsinhalteModal(true);
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
  // SORTABLE GRADUIERUNG KOMPONENTE
  // ============================================================================
  
  /**
   * GraduierungItem - Einzelne Graduierung mit Move-Buttons
   * @param {Object} graduierung - Graduierungs-Objekt
   */
  const GraduierungItem = ({ graduierung, onEdit, onDelete, onMoveUp, onMoveDown, onShowPruefungsinhalte, loading, isFirst, isLast }) => {

    return (
      <div
        className="graduierung-item"
        // Dynamische Border-Farbe basierend auf Gürtel-Farbe
        data-border-color={graduierung.farbe_hex}
        style={{
          position: 'relative',
          zIndex: 1
        }}
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
          <div className="graduierung-actions" style={{position: 'relative', zIndex: 9999}}>
            {/* Position-Buttons */}
          <button 
            className="btn btn-info move-btn move-up"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp && onMoveUp(graduierung);
            }}
            disabled={isFirst}
            title="Nach oben verschieben"
            style={{position: 'relative', zIndex: 10000, pointerEvents: 'auto'}}
          >
            ↑
          </button>
          <button 
            className="btn btn-info move-btn move-down"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown && onMoveDown(graduierung);
            }}
            disabled={isLast}
            title="Nach unten verschieben"
            style={{position: 'relative', zIndex: 10000, pointerEvents: 'auto'}}
          >
            ↓
          </button>

            {/* Trennlinie */}
            <span className="button-divider"></span>

            {/* Bearbeiten & Löschen Buttons */}
            <button
              className="sub-tab-btn"
              onClick={(e) => {
                e.stopPropagation();
                onShowPruefungsinhalte && onShowPruefungsinhalte(graduierung);
              }}
              disabled={loading}
              title="Prüfungsinhalte anzeigen"
              style={{position: 'relative', zIndex: 10000, pointerEvents: 'auto', fontSize: '0.85rem', padding: '0.5rem 1rem'}}
            >
              📝 Prüfungsinhalte
            </button>
            <button
              className="sub-tab-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEdit && onEdit(graduierung);
              }}
              disabled={loading}
              title="Graduierung bearbeiten"
              style={{position: 'relative', zIndex: 10000, pointerEvents: 'auto', fontSize: '0.85rem', padding: '0.5rem 1rem'}}
            >
              ✏️ Bearbeiten
            </button>
            <button
              className="sub-tab-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(graduierung.graduierung_id);
              }}
              disabled={loading}
              title="Graduierung löschen"
              style={{position: 'relative', zIndex: 10000, pointerEvents: 'auto', fontSize: '0.85rem', padding: '0.5rem 1rem'}}
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
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        title={`${stil.name} - ${stil.beschreibung}${!stil.aktiv ? ' (Inaktiv)' : ''}`}
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
              className="btn btn-success btn-small move-btn"
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
              style={{ minWidth: '40px', padding: '4px 8px', fontSize: '0.75rem' }}
            >
              ✓
            </button>
          )}

          {/* Reihenfolge Buttons nur für aktive Stile */}
          {stil.aktiv && (
            <>
              <button
                className="btn btn-info btn-small move-btn"
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
                className="btn btn-info btn-small move-btn"
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
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid rgba(255, 215, 0, 0.2)',
          isolation: 'isolate',
          position: 'relative',
          zIndex: 10000
        }}>
          <h3 style={{
            fontSize: '1.5rem',
            margin: 0,
            color: '#ffd700',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            textShadow: '0 2px 10px rgba(255, 215, 0, 0.3)'
          }}>Graduierungen verwalten</h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => setShowAddForm(true)}
              disabled={loading}
              title="Standard-Gürtel hinzufügen"
              style={{
                position: 'relative',
                zIndex: 10001,
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                filter: 'none',
                textShadow: 'none',
                background: 'rgba(30, 30, 50, 0.95)',
                border: '2px solid #ffd700',
                color: '#ffd700',
                fontWeight: 700,
                fontSize: '0.95rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                isolation: 'isolate',
                opacity: loading ? 0.5 : 1
              }}
            >
              + Graduierung hinzufügen
            </button>
            <button
              onClick={() => setShowCustomColorForm(true)}
              disabled={loading}
              title="Eigene Farbe erstellen"
              style={{
                position: 'relative',
                zIndex: 10001,
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                filter: 'none',
                textShadow: 'none',
                background: 'rgba(30, 30, 50, 0.95)',
                border: '2px solid #ffd700',
                color: '#ffd700',
                fontWeight: 700,
                fontSize: '0.95rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                isolation: 'isolate',
                opacity: loading ? 0.5 : 1
              }}
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
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '2rem 0',
                overflowY: 'auto',
                zIndex: 1000
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'block',
                  width: '90%',
                  maxWidth: '800px',
                  margin: '0 auto',
                  padding: '2rem',
                  boxSizing: 'border-box',
                  overflowX: 'hidden',
                  overflowY: 'visible',
                  background: 'rgba(26, 26, 46, 0.98)',
                  borderRadius: '20px',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  position: 'relative'
                }}
              >
                <div className="modal-header" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 215, 0, 0.2)' }}>
                  <h3 className="modal-title" style={{ margin: 0, color: '#ffd700', fontSize: '1.5rem' }}>Neue Graduierung hinzufügen</h3>
                  <button
                    className="modal-close"
                    onClick={() => setShowAddForm(false)}
                    title="Schließen"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '2rem',
                      cursor: 'pointer',
                      padding: '0',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Tab-Navigation */}
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginBottom: '1.5rem',
                  borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                  paddingBottom: '0.5rem',
                  overflowX: 'auto'
                }}>
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
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: activeKategorie === tab.key ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
                        border: activeKategorie === tab.key ? '1px solid rgba(255, 215, 0, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: activeKategorie === tab.key ? '#ffd700' : 'rgba(255, 255, 255, 0.7)',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        fontWeight: activeKategorie === tab.key ? '600' : '400',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Gürtel der aktiven Kategorie */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div className="belt-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '1rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    {standardGuertel
                      .filter(guertel => guertel.kategorie === activeKategorie)
                      .map(guertel => (
                        <div
                          key={guertel.name}
                          className={`belt-option ${newGraduierung.name === guertel.name ? 'selected' : ''}`}
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
                          style={{
                            padding: '1rem 0.75rem',
                            background: newGraduierung.name === guertel.name ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            border: newGraduierung.name === guertel.name ? '2px solid #ffd700' : '2px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '110px',
                            boxSizing: 'border-box'
                          }}
                        >
                          <BeltPreview
                            primaer={guertel.primaer}
                            sekundaer={guertel.sekundaer}
                            size="small"
                          />
                          <span style={{
                            fontSize: '0.85rem',
                            color: newGraduierung.name === guertel.name ? '#ffd700' : 'rgba(255, 255, 255, 0.85)',
                            marginTop: '0.5rem',
                            textAlign: 'center',
                            lineHeight: '1.3',
                            wordWrap: 'break-word',
                            width: '100%'
                          }}>{guertel.name}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* Vorschau des gewählten Gürtels */}
                {newGraduierung.name && (
                  <div style={{
                    padding: '1rem',
                    background: 'rgba(255, 215, 0, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 215, 0, 0.2)',
                    marginBottom: '1.5rem'
                  }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#ffd700', fontSize: '1rem' }}>Vorschau:</h4>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <BeltPreview
                        primaer={newGraduierung.farbe_hex}
                        sekundaer={newGraduierung.farbe_sekundaer}
                        size="large"
                      />
                      <div>
                        <strong style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.1rem', display: 'block', marginBottom: '0.5rem' }}>{newGraduierung.name}</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', fontWeight: '500' }}>
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
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '1rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', fontWeight: '500' }}>
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
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '1rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <button
                    onClick={() => setShowAddForm(false)}
                    disabled={loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '1rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.5 : 1
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleAddGraduierung}
                    disabled={!newGraduierung.name || loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: (!newGraduierung.name || loading) ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 215, 0, 0.2)',
                      border: '1px solid #ffd700',
                      borderRadius: '8px',
                      color: '#ffd700',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: (!newGraduierung.name || loading) ? 'not-allowed' : 'pointer',
                      opacity: (!newGraduierung.name || loading) ? 0.5 : 1
                    }}
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
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '2rem 0',
                overflowY: 'auto',
                zIndex: 1000
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'block',
                  width: '90%',
                  maxWidth: '600px',
                  margin: '0 auto',
                  padding: '2rem',
                  boxSizing: 'border-box',
                  overflowX: 'hidden',
                  overflowY: 'visible',
                  background: 'rgba(26, 26, 46, 0.98)',
                  borderRadius: '20px',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 215, 0, 0.2)' }}>
                  <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.5rem' }}>Eigene Gürtel-Farbe erstellen</h3>
                  <button
                    onClick={() => setShowCustomColorForm(false)}
                    title="Schließen"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '2rem',
                      cursor: 'pointer',
                      padding: '0',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ×
                  </button>
                </div>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', fontWeight: '500' }}>
                    Graduierung-Name: <span style={{ color: '#ff6b6b', fontWeight: '700' }}>*</span>
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
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: !newGraduierung.name ? '2px solid rgba(255, 107, 107, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                      boxShadow: !newGraduierung.name ? '0 0 0 3px rgba(255, 107, 107, 0.1)' : 'none'
                    }}
                  />
                  {!newGraduierung.name && (
                    <small style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                      Bitte geben Sie einen Namen ein
                    </small>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', fontWeight: '500' }}>
                      Primärfarbe:
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={newGraduierung.farbe_hex}
                        onChange={(e) => setNewGraduierung({
                          ...newGraduierung,
                          farbe_hex: e.target.value
                        })}
                        style={{
                          width: '50px',
                          height: '40px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
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
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '6px',
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontSize: '0.85rem',
                          textAlign: 'center',
                          textTransform: 'uppercase'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '0.5rem',
                      padding: '0.75rem',
                      background: newGraduierung.farbe_sekundaer ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid ' + (newGraduierung.farbe_sekundaer ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.2)'),
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}>
                      <input
                        type="checkbox"
                        checked={newGraduierung.farbe_sekundaer !== null}
                        onChange={(e) => setNewGraduierung({
                          ...newGraduierung,
                          farbe_sekundaer: e.target.checked ? '#FFFFFF' : null
                        })}
                        style={{
                          marginRight: '0.75rem',
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer'
                        }}
                      />
                      <span style={{
                        color: newGraduierung.farbe_sekundaer ? '#ffd700' : 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.9rem',
                        fontWeight: newGraduierung.farbe_sekundaer ? '600' : '500'
                      }}>
                        Sekundärfarbe (Streifen) hinzufügen
                      </span>
                    </label>
                    {newGraduierung.farbe_sekundaer ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={newGraduierung.farbe_sekundaer}
                          onChange={(e) => setNewGraduierung({
                            ...newGraduierung,
                            farbe_sekundaer: e.target.value
                          })}
                          style={{
                            width: '50px',
                            height: '40px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
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
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '0.85rem',
                            textAlign: 'center',
                            textTransform: 'uppercase'
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ height: '40px', display: 'flex', alignItems: 'center', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                        Keine Sekundärfarbe
                      </div>
                    )}
                  </div>
                </div>

                {/* Live-Vorschau kompakt */}
                <div style={{ padding: '1rem', background: 'rgba(255, 215, 0, 0.05)', borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.2)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', fontWeight: '500' }}>Vorschau:</span>
                  <BeltPreview
                    primaer={newGraduierung.farbe_hex}
                    sekundaer={newGraduierung.farbe_sekundaer}
                    size="medium"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', fontWeight: '500' }}>
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
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '1rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', fontWeight: '500' }}>
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
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '1rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '1.5rem' }}>
                  <button
                    onClick={() => setShowCustomColorForm(false)}
                    disabled={loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '1rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.5 : 1
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleAddCustomGraduierung}
                    disabled={!newGraduierung.name || loading}
                    title={!newGraduierung.name ? 'Bitte geben Sie zuerst einen Namen ein' : 'Graduierung erstellen'}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: (!newGraduierung.name || loading) ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 215, 0, 0.2)',
                      border: '1px solid #ffd700',
                      borderRadius: '8px',
                      color: '#ffd700',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: (!newGraduierung.name || loading) ? 'not-allowed' : 'pointer',
                      opacity: (!newGraduierung.name || loading) ? 0.5 : 1
                    }}
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
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '2rem 0',
                overflowY: 'auto',
                zIndex: 1000
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'block',
                  width: '90%',
                  maxWidth: '700px',
                  margin: '0 auto',
                  padding: '2rem',
                  boxSizing: 'border-box',
                  overflowX: 'hidden',
                  overflowY: 'visible',
                  background: 'rgba(26, 26, 46, 0.98)',
                  borderRadius: '20px',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 215, 0, 0.2)' }}>
                  <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.5rem' }}>Graduierung bearbeiten</h3>
                  <button
                    onClick={() => {
                      setShowEditGraduierung(false);
                      setEditingGraduierung(null);
                    }}
                    title="Schließen"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '2rem',
                      cursor: 'pointer',
                      padding: '0',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', fontWeight: '500' }}>
                    Graduierung-Name:
                  </label>
                  <input
                    type="text"
                    value={editingGraduierung.name}
                    onChange={(e) => setEditingGraduierung({
                      ...editingGraduierung,
                      name: e.target.value
                    })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', fontWeight: '500' }}>
                      Primärfarbe:
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={editingGraduierung.farbe_hex}
                        onChange={(e) => setEditingGraduierung({
                          ...editingGraduierung,
                          farbe_hex: e.target.value
                        })}
                        style={{
                          width: '50px',
                          height: '40px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
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
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '6px',
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontSize: '0.85rem',
                          textAlign: 'center',
                          textTransform: 'uppercase'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '0.5rem',
                      padding: '0.75rem',
                      background: editingGraduierung.farbe_sekundaer ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid ' + (editingGraduierung.farbe_sekundaer ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.2)'),
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}>
                      <input
                        type="checkbox"
                        checked={editingGraduierung.farbe_sekundaer !== null}
                        onChange={(e) => setEditingGraduierung({
                          ...editingGraduierung,
                          farbe_sekundaer: e.target.checked ? '#FFFFFF' : null
                        })}
                        style={{
                          marginRight: '0.75rem',
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer'
                        }}
                      />
                      <span style={{
                        color: editingGraduierung.farbe_sekundaer ? '#ffd700' : 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.9rem',
                        fontWeight: editingGraduierung.farbe_sekundaer ? '600' : '500'
                      }}>
                        Sekundärfarbe (Streifen) hinzufügen
                      </span>
                    </label>
                    {editingGraduierung.farbe_sekundaer ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={editingGraduierung.farbe_sekundaer}
                          onChange={(e) => setEditingGraduierung({
                            ...editingGraduierung,
                            farbe_sekundaer: e.target.value
                          })}
                          style={{
                            width: '50px',
                            height: '40px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
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
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '0.85rem',
                            textAlign: 'center',
                            textTransform: 'uppercase'
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ height: '40px', display: 'flex', alignItems: 'center', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                        Keine Sekundärfarbe
                      </div>
                    )}
                  </div>
                </div>

                {/* Live-Vorschau kompakt */}
                <div style={{ padding: '1rem', background: 'rgba(255, 215, 0, 0.05)', borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.2)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', fontWeight: '500' }}>Vorschau:</span>
                  <BeltPreview
                    primaer={editingGraduierung.farbe_hex}
                    sekundaer={editingGraduierung.farbe_sekundaer}
                    size="medium"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', fontWeight: '500' }}>
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
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '1rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', fontWeight: '500' }}>
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
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '1rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '1.5rem' }}>
                  <button
                    onClick={() => {
                      setShowEditGraduierung(false);
                      setEditingGraduierung(null);
                    }}
                    disabled={loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '1rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.5 : 1
                    }}
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
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: (!editingGraduierung.name || loading) ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 215, 0, 0.2)',
                      border: '1px solid #ffd700',
                      borderRadius: '8px',
                      color: '#ffd700',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: (!editingGraduierung.name || loading) ? 'not-allowed' : 'pointer',
                      opacity: (!editingGraduierung.name || loading) ? 0.5 : 1
                    }}
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

    React.useEffect(() => {
      setInhaltText(editingPruefungsinhalt?.inhalt || '');
    }, [editingPruefungsinhalt]);

    const handleSubmit = () => {
      handleSavePruefungsinhalt(inhaltText);
    };

    const kategorieLabels = {
      'grundtechniken': 'Grundtechniken',
      'kata': 'Kata / Formen',
      'kumite': 'Kumite / Sparring',
      'theorie': 'Theorie'
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '2rem 0',
            overflowY: 'auto',
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'block',
              width: '90%',
              maxWidth: '600px',
              margin: '0 auto',
              padding: '2rem',
              boxSizing: 'border-box',
              background: 'rgba(26, 26, 46, 0.98)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 215, 0, 0.2)' }}>
              <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.5rem' }}>
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
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                <BeltPreview
                  primaer={selectedGraduierung?.farbe_hex}
                  sekundaer={selectedGraduierung?.farbe_sekundaer}
                  size="small"
                />
                <div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600' }}>
                    {selectedGraduierung?.name}
                  </div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
                    {kategorieLabels[selectedKategorie]}
                  </div>
                </div>
              </div>

              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', fontWeight: '500' }}>
                Inhalt:
              </label>
              <textarea
                value={inhaltText}
                onChange={(e) => setInhaltText(e.target.value)}
                placeholder="z.B. Grundstellungen, Heian Shodan, Grundkumite..."
                rows="4"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowPruefungsinhaltForm(false);
                  setEditingPruefungsinhalt(null);
                  setSelectedGraduierung(null);
                  setSelectedKategorie('');
                }}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '1rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleSubmit}
                disabled={!inhaltText.trim() || loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: (!inhaltText.trim() || loading) ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 215, 0, 0.2)',
                  border: '1px solid #ffd700',
                  borderRadius: '8px',
                  color: '#ffd700',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: (!inhaltText.trim() || loading) ? 'not-allowed' : 'pointer',
                  opacity: (!inhaltText.trim() || loading) ? 0.5 : 1
                }}
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
    const kategorien = [
      { key: 'grundtechniken', label: 'Grundtechniken', icon: '🥋' },
      { key: 'kata', label: 'Kata / Formen', icon: '🎭' },
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '2rem 0',
            overflowY: 'auto',
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'block',
              width: '90%',
              maxWidth: '900px',
              margin: '0 auto',
              padding: '2rem',
              boxSizing: 'border-box',
              background: 'rgba(26, 26, 46, 0.98)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              position: 'relative'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 215, 0, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <BeltPreview
                  primaer={viewingGraduierung.farbe_hex}
                  sekundaer={viewingGraduierung.farbe_sekundaer}
                  size="normal"
                />
                <div>
                  <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.5rem' }}>Prüfungsinhalte</h3>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem' }}>
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
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Prüfungsinhalte Kategorien */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {kategorien.map(kategorie => {
                const inhalte = pruefungsinhalte[kategorie.key] || [];

                return (
                  <div
                    key={kategorie.key}
                    style={{
                      padding: '1.5rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px'
                    }}
                  >
                    <h4 style={{
                      margin: '0 0 1rem 0',
                      color: '#ffd700',
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>{kategorie.icon}</span>
                      <span>{kategorie.label}</span>
                    </h4>
                    {inhalte.length > 0 ? (
                      <ul style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}>
                        {inhalte
                          .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))
                          .map(inhalt => (
                            <li
                              key={inhalt.id}
                              style={{
                                padding: '0.75rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '8px',
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontSize: '0.95rem',
                                borderLeft: '3px solid rgba(255, 215, 0, 0.5)'
                              }}
                            >
                              {inhalt.inhalt}
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p style={{
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '0.9rem',
                        fontStyle: 'italic',
                        margin: 0
                      }}>
                        Noch keine Inhalte definiert
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
              <button
                onClick={() => {
                  setShowPruefungsinhalteModal(false);
                  setViewingGraduierung(null);
                }}
                className="sub-tab-btn"
                style={{ minWidth: '200px' }}
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
    const kategorien = [
      {
        key: 'grundtechniken',
        label: 'Grundtechniken',
        icon: '🥋',
        beispiele: ['Grundstellungen', 'Fußarbeit', 'Hand- und Fußtechniken']
      },
      {
        key: 'kata',
        label: 'Kata / Formen',
        icon: '🎭',
        beispiele: ['Heian Shodan', 'Heian Nidan']
      },
      {
        key: 'kumite',
        label: 'Kumite / Sparring',
        icon: '⚔️',
        beispiele: ['Grundkumite', 'Situative Techniken']
      },
      {
        key: 'theorie',
        label: 'Theorie',
        icon: '📚',
        beispiele: ['Dojo-Kun (Verhaltensregeln)', 'Grundbegriffe', 'Geschichte']
      }
    ];

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

              return (
                <div key={grad.graduierung_id} className="graduierung-pruefung">
                  <div className="graduierung-header">
                    <BeltPreview
                      primaer={grad.farbe_hex}
                      sekundaer={grad.farbe_sekundaer}
                      size="normal"
                    />
                    <h4>{grad.name}</h4>
                  </div>

                  <div className="pruefungsinhalt-categories">
                    {kategorien.map(kategorie => {
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
                                    <span>{inhalt.inhalt}</span>
                                    <div className="inhalt-actions">
                                      <button
                                        className="sub-tab-btn"
                                        onClick={() => handleEditPruefungsinhalt(grad, kategorie.key, inhalt)}
                                        title="Bearbeiten"
                                        style={{fontSize: '0.75rem', padding: '0.35rem 0.75rem'}}
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        className="sub-tab-btn"
                                        onClick={() => handleDeletePruefungsinhalt(grad, kategorie.key, inhalt.id)}
                                        title="Löschen"
                                        style={{fontSize: '0.75rem', padding: '0.35rem 0.75rem'}}
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </li>
                                ))
                            ) : (
                              kategorie.beispiele.map((beispiel, index) => (
                                <li key={`beispiel-${index}`}>{beispiel}</li>
                              ))
                            )}
                          </ul>
                          <div className="sub-tabs" style={{ marginTop: '0.5rem' }}>
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
                <div>
                  <h2 className="stil-detail-title">{currentStil.name}</h2>
                  <p>{currentStil.beschreibung}</p>
                  <div className="stil-detail-stats">
                    <span>👥 {currentStil.anzahl_mitglieder || 0} Schüler</span>
                    <span>🎖️ {currentStil.graduierungen?.length || 0} Gürtel</span>
                    <span className={`status ${currentStil.aktiv ? 'active' : 'inactive'}`}>
                      {currentStil.aktiv ? '✅ Aktiv' : '❌ Inaktiv'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tab-Navigation */}
              <div className="tab-navigation">
                {[
                  { id: 'allgemein', label: '📋 Allgemein', title: 'Grundeinstellungen des Stils' },
                  { id: 'pruefungseinstellungen', label: '⏱️ Prüfungseinstellungen', title: 'Wartezeiten und Prüfungsregeln' },
                  { id: 'graduierungen', label: '🎖️ Graduierungen', title: 'Gürtel und Graduierungen verwalten' },
                  { id: 'pruefungsinhalte', label: '📝 Prüfungsinhalte', title: 'Prüfungsinhalte definieren' },
                  { id: 'statistiken', label: '📊 Statistiken', title: 'Auswertungen und Statistiken' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
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
                        className="sub-tab-btn"
                        style={{
                          background: 'linear-gradient(135deg, rgba(50, 205, 50, 0.2), rgba(34, 139, 34, 0.3))',
                          borderColor: '#32CD32'
                        }}
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
                              // Erkenne Kategorie automatisch wenn nicht gesetzt
                              const kategorie = grad.kategorie || detectKategorie(grad.name);
                              let newWaitTime = grad.mindestzeit_monate;
                              let updateKategorie = false;

                              if (kategorie === 'grundstufe') {
                                newWaitTime = currentStil.wartezeit_grundstufe || 3;
                                updateKategorie = !grad.kategorie; // Kategorie setzen wenn nicht vorhanden
                              } else if (kategorie === 'mittelstufe') {
                                newWaitTime = currentStil.wartezeit_mittelstufe || 4;
                                updateKategorie = !grad.kategorie;
                              } else if (kategorie === 'oberstufe') {
                                newWaitTime = currentStil.wartezeit_oberstufe || 6;
                                updateKategorie = !grad.kategorie;
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
                  <div style={{ isolation: 'isolate', position: 'relative', zIndex: 1 }}>
                    <GraduierungManager />
                  </div>
                )}

                {activeTab === 'pruefungsinhalte' && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <PruefungsinhaltManager />
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
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '20px',
                            marginBottom: '30px'
                          }}>
                            <div style={{
                              padding: '20px',
                              background: 'rgba(20, 20, 35, 0.7)',
                              backdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255, 215, 0, 0.2)',
                              borderRadius: '12px',
                              textAlign: 'center'
                            }}>
                              <div style={{color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '10px'}}>
                                Gürtel gesamt
                              </div>
                              <div style={{color: '#FFD700', fontSize: '36px', fontWeight: 'bold'}}>
                                {statistiken.summary.total_graduierungen || 0}
                              </div>
                            </div>
                            <div style={{
                              padding: '20px',
                              background: 'rgba(20, 20, 35, 0.7)',
                              backdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255, 215, 0, 0.2)',
                              borderRadius: '12px',
                              textAlign: 'center'
                            }}>
                              <div style={{color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '10px'}}>
                                Aktive Mitglieder
                              </div>
                              <div style={{color: '#FFD700', fontSize: '36px', fontWeight: 'bold'}}>
                                {statistiken.summary.total_mitglieder || 0}
                              </div>
                            </div>
                            <div style={{
                              padding: '20px',
                              background: 'rgba(20, 20, 35, 0.7)',
                              backdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255, 215, 0, 0.2)',
                              borderRadius: '12px',
                              textAlign: 'center'
                            }}>
                              <div style={{color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '10px'}}>
                                Kategorien
                              </div>
                              <div style={{color: '#FFD700', fontSize: '36px', fontWeight: 'bold'}}>
                                {statistiken.summary.kategorien_count || 0}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Hauptbereich: Schüler-Verteilung und Prüfungs-Erfolgsrate nebeneinander */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr',
                          gap: '25px',
                          alignItems: 'start'
                        }}>

                          {/* Linke Spalte: Schüler-Verteilung */}
                          {statistiken?.graduierungen && statistiken.graduierungen.length > 0 && (
                            <div style={{
                              padding: '25px',
                              background: 'rgba(20, 20, 35, 0.7)',
                              backdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255, 215, 0, 0.2)',
                              borderRadius: '12px'
                            }}>
                              <h4 style={{
                                color: '#FFD700',
                                fontSize: '18px',
                                marginBottom: '8px',
                                fontWeight: '600'
                              }}>
                                👥 Schüler-Verteilung nach Gürteln
                              </h4>
                              <p style={{
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: '14px',
                                marginBottom: '20px'
                              }}>
                                Anzahl der Schüler pro Gürtelfarbe
                              </p>
                              <div style={{
                                display: 'grid',
                                gap: '10px'
                              }}>
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
                            <div style={{
                              padding: '25px',
                              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 215, 0, 0.05))',
                              backdropFilter: 'blur(20px)',
                              border: '2px solid rgba(255, 215, 0, 0.3)',
                              borderRadius: '12px',
                              position: 'sticky',
                              top: '20px'
                            }}>
                              <h4 style={{
                                color: '#FFD700',
                                fontSize: '18px',
                                marginBottom: '8px',
                                fontWeight: '600',
                                textAlign: 'center'
                              }}>
                                ✅ Prüfungs-Erfolgsrate
                              </h4>
                              <p style={{
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: '14px',
                                marginBottom: '25px',
                                textAlign: 'center'
                              }}>
                                Erfolgsquote bei Gürtelprüfungen
                              </p>

                              {/* Großer Prozentkreis */}
                              <div style={{
                                textAlign: 'center',
                                marginBottom: '25px'
                              }}>
                                <div style={{
                                  width: '150px',
                                  height: '150px',
                                  margin: '0 auto',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.05))',
                                  border: '3px solid rgba(255, 215, 0, 0.4)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 0 30px rgba(255, 215, 0, 0.3)'
                                }}>
                                  <div style={{
                                    fontSize: '42px',
                                    fontWeight: 'bold',
                                    color: '#FFD700',
                                    textShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
                                    lineHeight: '1'
                                  }}>
                                    {pruefungsStats.gesamt.gesamt > 0
                                      ? Math.round((pruefungsStats.gesamt.bestanden / pruefungsStats.gesamt.gesamt) * 100)
                                      : 0}%
                                  </div>
                                  <div style={{
                                    fontSize: '12px',
                                    color: 'rgba(255,255,255,0.7)',
                                    marginTop: '5px'
                                  }}>
                                    Erfolgsrate
                                  </div>
                                </div>
                              </div>

                              {/* Details */}
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                              }}>
                                <div style={{
                                  padding: '10px 12px',
                                  background: 'rgba(255,255,255,0.05)',
                                  borderRadius: '8px',
                                  borderLeft: '3px solid rgba(255,255,255,0.3)',
                                  display: 'flex',
                                  justifyContent: 'space-between'
                                }}>
                                  <span style={{color: 'rgba(255,255,255,0.7)', fontSize: '13px'}}>Gesamt:</span>
                                  <span style={{color: '#FFD700', fontWeight: '600', fontSize: '14px'}}>
                                    {pruefungsStats.gesamt.gesamt || 0}
                                  </span>
                                </div>
                                <div style={{
                                  padding: '10px 12px',
                                  background: 'rgba(50,205,50,0.1)',
                                  borderRadius: '8px',
                                  borderLeft: '3px solid #32CD32',
                                  display: 'flex',
                                  justifyContent: 'space-between'
                                }}>
                                  <span style={{color: 'rgba(255,255,255,0.7)', fontSize: '13px'}}>Bestanden:</span>
                                  <span style={{color: '#32CD32', fontWeight: '600', fontSize: '14px'}}>
                                    {pruefungsStats.gesamt.bestanden || 0}
                                  </span>
                                </div>
                                <div style={{
                                  padding: '10px 12px',
                                  background: 'rgba(220,20,60,0.1)',
                                  borderRadius: '8px',
                                  borderLeft: '3px solid #DC143C',
                                  display: 'flex',
                                  justifyContent: 'space-between'
                                }}>
                                  <span style={{color: 'rgba(255,255,255,0.7)', fontSize: '13px'}}>Nicht bestanden:</span>
                                  <span style={{color: '#DC143C', fontWeight: '600', fontSize: '14px'}}>
                                    {pruefungsStats.gesamt.nicht_bestanden || 0}
                                  </span>
                                </div>
                                <div style={{
                                  padding: '10px 12px',
                                  background: 'rgba(255,165,0,0.1)',
                                  borderRadius: '8px',
                                  borderLeft: '3px solid #FFA500',
                                  display: 'flex',
                                  justifyContent: 'space-between'
                                }}>
                                  <span style={{color: 'rgba(255,255,255,0.7)', fontSize: '13px'}}>Geplant:</span>
                                  <span style={{color: '#FFA500', fontWeight: '600', fontSize: '14px'}}>
                                    {pruefungsStats.gesamt.geplant || 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>

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
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => resetCreateModal()}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '2rem 0',
                overflowY: 'auto'
              }}
            >
              <motion.div
                className="modal-content create-stil-modal stil-modal"
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 50 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'block',
                  width: '90%',
                  maxWidth: '700px',
                  margin: '0 auto',
                  padding: '2rem',
                  boxSizing: 'border-box',
                  overflowX: 'hidden',
                  overflowY: 'visible',
                  background: 'rgba(26, 26, 46, 0.98)',
                  borderRadius: '20px',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  position: 'relative'
                }}
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
