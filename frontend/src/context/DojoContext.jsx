import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import config from '../config/config.js';

const DojoContext = createContext();

export const useDojoContext = () => {
  const context = useContext(DojoContext);
  if (!context) {
    throw new Error('useDojoContext must be used within a DojoProvider');
  }
  return context;
};

// 🔧 Mock-Daten außerhalb der Komponente (konstante Referenz, wird nicht bei jedem Render neu erstellt)
const INITIAL_MOCK_DOJOS = [
  {
    id: 1,
    dojoname: 'Dojo Hamburg',
    inhaber: 'Max Mustermann',
    farbe: '#FFD700',
    ist_hauptdojo: true,
    steuer_status: 'kleinunternehmer',
    kleinunternehmer_grenze: 22000,
    jahresumsatz_aktuell: 15000,
    ust_satz: 19,
    rechtsform: 'e.V.',
    strasse: 'Beispielstraße 123',
    plz: '20095',
    ort: 'Hamburg',
    land: 'Deutschland',
    telefon: '+49 40 12345678',
    email: 'info@dojo-hamburg.de',
    website: 'www.dojo-hamburg.de'
  },
  {
    id: 2,
    dojoname: 'Dojo Berlin',
    inhaber: 'Anna Schmidt',
    farbe: '#3B82F6',
    ist_hauptdojo: false,
    steuer_status: 'regelbesteuert',
    kleinunternehmer_grenze: 22000,
    jahresumsatz_aktuell: 35000,
    ust_satz: 19,
    rechtsform: 'GmbH',
    strasse: 'Alexanderplatz 1',
    plz: '10178',
    ort: 'Berlin',
    land: 'Deutschland',
    telefon: '+49 30 98765432',
    email: 'kontakt@dojo-berlin.de',
    website: 'www.dojo-berlin.de'
  }
];

export const DojoProvider = ({ children }) => {
  // 🔧 DEVELOPMENT MODE: Mock-Daten für lokale Entwicklung
  const isDevelopment = import.meta.env.MODE === 'development';

  const [dojos, setDojos] = useState(isDevelopment ? [...INITIAL_MOCK_DOJOS] : []);
  const [activeDojo, setActiveDojo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'current', 'all', 'compare' - Standard: alle Dojos anzeigen

  // Lade alle Dojos beim Start
  useEffect(() => {
    loadDojos();
  }, []);

  // Setze das aktive Dojo aus LocalStorage oder wähle das erste/Haupt-Dojo
  useEffect(() => {
    if (dojos.length > 0 && !activeDojo) {
      console.log('🔄 DojoContext: Setze aktives Dojo...', { dojos: dojos.length, activeDojo });

      const savedDojoId = localStorage.getItem('activeDojoId');
      if (savedDojoId) {
        const saved = dojos.find(d => d.id === parseInt(savedDojoId));
        if (saved) {
          console.log('✅ DojoContext: Gespeichertes Dojo gefunden:', saved.dojoname);
          setActiveDojo(saved);
          return;
        }
      }

      // Fallback: Haupt-Dojo oder erstes Dojo
      const hauptDojo = dojos.find(d => d.ist_hauptdojo);
      const dojoToSet = hauptDojo || dojos[0];
      console.log('✅ DojoContext: Setze Fallback-Dojo:', dojoToSet?.dojoname);
      setActiveDojo(dojoToSet);
    }
  }, [dojos, activeDojo]);

  const loadDojos = useCallback(async () => {
    // 🔧 DEVELOPMENT MODE: Mock-Daten verwenden (nur beim initialen Laden)
    if (isDevelopment) {
      console.log('🔧 Development Mode: Mock-Dojos bereits geladen (keine Überschreibung)');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('dojo_auth_token');
      const headers = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${config.apiBaseUrl}/dojos`, {
        headers
      });

      if (!response.ok) {
        console.error('Dojos API Response:', response.status, response.statusText);
        throw new Error('Fehler beim Laden der Dojos');
      }

      const data = await response.json();
      console.log('✅ Dojos geladen:', data);
      setDojos(data);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Dojos:', error);
    } finally {
      setLoading(false);
    }
  }, [isDevelopment]);

  const switchDojo = useCallback((dojo) => {
    setActiveDojo(dojo);
    localStorage.setItem('activeDojoId', dojo.id);
  }, []);

  const getDojoById = useCallback((id) => {
    return dojos.find(d => d.id === id);
  }, [dojos]);

  // Filter-Logik für Statistiken
  const getFilteredDojoIds = useCallback(() => {
    switch (filter) {
      case 'current':
        return activeDojo ? [activeDojo.id] : [];
      case 'all':
        return dojos.map(d => d.id);
      case 'compare':
        return dojos.map(d => d.id);
      default:
        return activeDojo ? [activeDojo.id] : [];
    }
  }, [filter, activeDojo, dojos]);

  // URL-Parameter für API-Calls
  const getDojoFilterParam = useCallback(() => {
    switch (filter) {
      case 'current':
        return activeDojo ? `dojo_id=${activeDojo.id}` : '';
      case 'all':
        return 'dojo_id=all';
      case 'compare':
        return 'dojo_id=compare';
      default:
        return activeDojo ? `dojo_id=${activeDojo.id}` : '';
    }
  }, [filter, activeDojo]);

  // Intelligente Dojo-Auswahl für neue Mitglieder
  // Priorisiert Kleinunternehmer-Dojos, die noch nicht an der Grenze sind
  const getBestDojoForNewMember = useCallback(() => {
    if (dojos.length === 0) return null;

    console.log('🏯 Wähle bestes Dojo für neues Mitglied...');

    // 1. Priorisiere Kleinunternehmer-Dojos, die noch Platz haben
    const kleinunternehmerDojos = dojos
      .filter(d => d.steuer_status === 'kleinunternehmer')
      .map(d => ({
        ...d,
        auslastung: (d.jahresumsatz_aktuell / d.kleinunternehmer_grenze) * 100
      }))
      .filter(d => d.auslastung < 100) // Nur Dojos unter der Grenze
      .sort((a, b) => a.auslastung - b.auslastung); // Sortiere nach Auslastung (niedrigste zuerst)

    if (kleinunternehmerDojos.length > 0) {
      const selected = kleinunternehmerDojos[0];
      console.log(`✅ Kleinunternehmer-Dojo gewählt: ${selected.dojoname} (${selected.auslastung.toFixed(1)}% ausgelastet)`);
      return selected;
    }

    // 2. Falls alle Kleinunternehmer-Dojos voll sind, wähle regelbesteuertes Dojo
    const regelbesteuerteDojos = dojos.filter(d => d.steuer_status === 'regelbesteuert');

    if (regelbesteuerteDojos.length > 0) {
      const selected = regelbesteuerteDojos[0];
      console.log(`✅ Regelbesteuertes Dojo gewählt: ${selected.dojoname} (alle Kleinunternehmer-Dojos sind voll)`);
      return selected;
    }

    // 3. Fallback: Haupt-Dojo oder erstes Dojo
    const fallback = dojos.find(d => d.ist_hauptdojo) || dojos[0];
    console.log(`⚠️ Fallback-Dojo gewählt: ${fallback.dojoname}`);
    return fallback;
  }, [dojos]);

  // Update Dojo (für Mock-Daten im Development Mode)
  const updateDojo = useCallback((id, updatedData) => {
    console.log('🔄 DojoContext: Update Dojo', { id, updatedData });

    setDojos(prevDojos =>
      prevDojos.map(dojo =>
        dojo.id === parseInt(id) ? { ...dojo, ...updatedData } : dojo
      )
    );

    // Update activeDojo wenn es das bearbeitete Dojo ist
    if (activeDojo && activeDojo.id === parseInt(id)) {
      setActiveDojo(prev => ({ ...prev, ...updatedData }));
      console.log('✅ DojoContext: Aktives Dojo aktualisiert');
    }
  }, [activeDojo]);

  const value = useMemo(() => ({
    dojos,
    activeDojo,
    loading,
    filter,
    setFilter,
    switchDojo,
    getDojoById,
    getFilteredDojoIds,
    getDojoFilterParam,
    getBestDojoForNewMember,
    updateDojo,
    refreshDojos: loadDojos
  }), [dojos, activeDojo, loading, filter, switchDojo, getDojoById, getFilteredDojoIds, getDojoFilterParam, getBestDojoForNewMember, updateDojo, loadDojos]);

  return <DojoContext.Provider value={value}>{children}</DojoContext.Provider>;
};
