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

export const DojoProvider = ({ children }) => {
  const [dojos, setDojos] = useState([]);
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
        // Prüfe ob 'super-admin' gespeichert ist
        if (savedDojoId === 'super-admin') {
          console.log('✅ DojoContext: Super-Admin Modus aus LocalStorage');
          setActiveDojo('super-admin');
          return;
        }

        // Prüfe ob 'verband' gespeichert ist
        if (savedDojoId === 'verband') {
          console.log('✅ DojoContext: Verband Modus aus LocalStorage');
          setActiveDojo('verband');
          return;
        }

        // Ansonsten suche normales Dojo
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
    try {
      const token = localStorage.getItem('dojo_auth_token');

      // 🔒 Nur laden wenn User eingeloggt ist
      if (!token) {
        console.log('⚠️ Kein Token vorhanden - Dojos werden nicht geladen');
        setDojos([]);
        setLoading(false);
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // 🔒 Lade nur zentral verwaltete Dojos (ohne separate Tenants wie Demo)
      const response = await fetch(`${config.apiBaseUrl}/dojos?filter=managed`, {
        headers
      });

      if (!response.ok) {
        console.error('Dojos API Response:', response.status, response.statusText);
        throw new Error('Fehler beim Laden der Dojos');
      }

      const data = await response.json();
      console.log('✅ Dojos geladen:', data);

      // Stelle sicher, dass data ein Array ist
      if (Array.isArray(data)) {
        setDojos(data);
      } else {
        console.error('❌ Dojos API returned non-array:', data);
        setDojos([]); // Fallback zu leerem Array
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Dojos:', error);
      setDojos([]); // Stelle sicher, dass dojos immer ein Array ist
    } finally {
      setLoading(false);
    }
  }, []);

  const switchDojo = useCallback((dojo) => {
    setActiveDojo(dojo);
    // Speichere entweder dojo.id, 'super-admin' oder 'verband'
    if (dojo === 'super-admin') {
      localStorage.setItem('activeDojoId', 'super-admin');
      console.log('✅ Gewechselt zu: TDA Int\'l Org (Super-Admin)');
    } else if (dojo === 'verband') {
      localStorage.setItem('activeDojoId', 'verband');
      console.log('✅ Gewechselt zu: TDA Verband');
    } else {
      localStorage.setItem('activeDojoId', dojo.id);
      console.log('✅ Gewechselt zu Dojo:', dojo.dojoname);
    }
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
    // Super-Admin Modus: Keine Dojo-Filterung (verwendet eigene API-Endpoints)
    if (activeDojo === 'super-admin') {
      return '';
    }

    // Verband Modus: Keine Dojo-Filterung (verwendet eigene API-Endpoints)
    if (activeDojo === 'verband') {
      return '';
    }

    switch (filter) {
      case 'current':
        return activeDojo ? `dojo_id=${activeDojo.id}` : '';
      case 'all':
        // 🔒 Bei "Alle" die spezifischen Dojo-IDs senden statt "all"
        if (dojos && dojos.length > 0) {
          const dojoIds = dojos.map(d => d.id).join(',');
          return `dojo_ids=${dojoIds}`;
        }
        return 'dojo_id=all';
      case 'compare':
        return 'dojo_id=compare';
      default:
        return activeDojo ? `dojo_id=${activeDojo.id}` : '';
    }
  }, [filter, activeDojo, dojos]);

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
    selectedDojo: activeDojo, // Alias für Dashboard-Kompatibilität
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
