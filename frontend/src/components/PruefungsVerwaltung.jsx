// ============================================================================
// PRÜFUNGSVERWALTUNG - VOLLSTÄNDIGE KOMPONENTE
// Frontend/src/components/PruefungsVerwaltung.jsx
// Route: /dashboard/termine
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useDojoContext } from '../context/DojoContext';
import { Check, X, Calendar, Award, Users, TrendingUp, ChevronUp, ChevronDown, Download, Edit, Trash2 } from 'lucide-react';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/Buttons.css';
import '../styles/Dashboard.css';
import '../styles/PruefungsVerwaltung.css';

const PruefungsVerwaltung = () => {
  const { getDojoFilterParam, activeDojo, loading: dojosLoading, dojos } = useDojoContext();
  const API_BASE_URL = '/api'; // Nutzt Vite-Proxy

  // State
  const [kandidaten, setKandidaten] = useState([]);
  const [stile, setStile] = useState([]);
  const [selectedStil, setSelectedStil] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('termine'); // termine, kandidaten, zugelassen, abgeschlossen, statistiken
  const [selectedKandidaten, setSelectedKandidaten] = useState([]);
  const [datumFilter, setDatumFilter] = useState('alle'); // alle, zukuenftig, vergangen

  // Graduierungen pro Stil (für manuelle Auswahl)
  const [graduierungenProStil, setGraduierungenProStil] = useState({}); // { stil_id: [graduierungen] }
  const [selectedGraduierungen, setSelectedGraduierungen] = useState({}); // { "mitglied_id-stil_id": graduierung_id }

  // Prüfungstermin Modal
  const [pruefungsDaten, setPruefungsDaten] = useState({
    pruefungsdatum: '',
    pruefungszeit: '10:00',
    pruefungsort: '',
    pruefungsgebuehr: '',
    anmeldefrist: '',
    gurtlaenge: '',
    bemerkungen: '',
    teilnahmebedingungen: '',
    ist_historisch: false,
    historisch_bemerkung: ''
  });

  // Prüfungsergebnis Modal
  const [showErgebnisModal, setShowErgebnisModal] = useState(false);
  const [selectedPruefung, setSelectedPruefung] = useState(null);
  const [pruefungsErgebnis, setPruefungsErgebnis] = useState({
    bestanden: false,
    punktzahl: '',
    max_punktzahl: '',
    prueferkommentar: '',
    graduierung_nachher_index: 0,
    graduierung_nachher_id: null,
    graduierung_nachher_name: '',
    graduierung_nachher_farbe: ''
  });
  const [graduierungenFuerModal, setGraduierungenFuerModal] = useState([]);

  // Daten für zugelassene und abgeschlossene Prüfungen
  const [zugelassenePruefungen, setZugelassenePruefungen] = useState([]);
  const [abgeschlossenePruefungen, setAbgeschlossenePruefungen] = useState([]);
  const [statistiken, setStatistiken] = useState(null);
  const [pruefungstermine, setPruefungstermine] = useState([]);

  // Neuer Termin Modal
  const [showNeuerTerminModal, setShowNeuerTerminModal] = useState(false);
  const [terminStep, setTerminStep] = useState(1);
  const [neuerTermin, setNeuerTermin] = useState({
    pruefungsdatum: '',
    pruefungszeit: '10:00',
    pruefungsort: '',
    pruefer_name: '',
    stil_id: '',
    pruefungsgebuehr: '',
    anmeldefrist: '',
    gurtlaenge: '',
    bemerkungen: '',
    teilnahmebedingungen: '',
    oeffentlich: false,
    ist_historisch: false,
    historisch_bemerkung: ''
  });

  // Externe Anmeldungen pro Termin
  const [externeAnmeldungen, setExterneAnmeldungen] = useState({});

  // Termin bearbeiten Modal
  const [showEditTerminModal, setShowEditTerminModal] = useState(false);
  const [editTermin, setEditTermin] = useState(null);

  // Expanded/Collapsed State für Prüfungstermine
  const [expandedTermine, setExpandedTermine] = useState({});

  // Batch-Ergebnis Modal
  const [showBatchErgebnisModal, setShowBatchErgebnisModal] = useState(false);
  const [batchTermin, setBatchTermin] = useState(null);
  const [batchErgebnisse, setBatchErgebnisse] = useState({});

  // Termin-Auswahl Modal (beim Zulassen)
  const [terminAuswahlModal, setTerminAuswahlModal] = useState({ open: false, kandidat: null, termine: [], isAusnahme: false });

  // Filter für Kandidaten
  const [berechtigungsFilter, setBerechtigungsFilter] = useState('all'); // 'all', 'berechtigt', 'nicht_berechtigt'
  const [kandidatenStilFilter, setKandidatenStilFilter] = useState('all');
  const [kandidatenSuchbegriff, setKandidatenSuchbegriff] = useState('');

  // Filter für Zugelassene und Abgeschlossene Prüfungen
  const [zugelasseneStilFilter, setZugelasseneStilFilter] = useState('all');
  const [abgeschlosseneStilFilter, setAbgeschlosseneStilFilter] = useState('all');

  // Sortierung
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' }); // key: Spaltenname, direction: 'asc' oder 'desc'

  // Stile laden
  useEffect(() => {
    fetchStile();
  }, []);

  // Daten laden basierend auf aktivem Tab
  useEffect(() => {
    // 🔒 WICHTIG: Nur laden wenn Dojos vollständig geladen sind
    if (dojosLoading || !dojos || dojos.length === 0) {
      console.log('⏳ Warte auf Dojos...', { dojosLoading, dojosCount: dojos?.length });
      return;
    }

    console.log('✅ Dojos geladen, lade Prüfungsdaten...', { activeTab, dojos: dojos.length });

    if (activeTab === 'termine') {
      fetchPruefungstermine();
    } else if (activeTab === 'kandidaten') {
      fetchKandidaten();
    } else if (activeTab === 'zugelassen') {
      fetchZugelassenePruefungen();
    } else if (activeTab === 'abgeschlossen') {
      fetchAbgeschlossenePruefungen();
    } else if (activeTab === 'statistiken') {
      // Lade alle Daten für Statistiken
      fetchStatistiken();
      fetchKandidaten();
      fetchZugelassenePruefungen();
      fetchAbgeschlossenePruefungen();
    }
  }, [activeTab, selectedStil, dojosLoading, dojos]);

  const fetchStile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stile?aktiv=true`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
        }
      });
      const data = await response.json();
      setStile(data || []);

      // Lade Graduierungen für alle Stile
      if (data && data.length > 0) {
        fetchGraduierungenFuerStile(data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Stile:', error);
    }
  };

  const fetchGraduierungenFuerStile = async (stileArray) => {
    try {
      const graduierungen = {};

      // Lade Graduierungen für jeden Stil parallel
      await Promise.all(
        stileArray.map(async (stil) => {
          try {
            const response = await fetch(`${API_BASE_URL}/stile/${stil.stil_id}/graduierungen`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
              }
            });
            const data = await response.json();
            graduierungen[stil.stil_id] = data || [];
          } catch (error) {
            console.error(`Fehler beim Laden der Graduierungen für Stil ${stil.name}:`, error);
            graduierungen[stil.stil_id] = [];
          }
        })
      );

      setGraduierungenProStil(graduierungen);
    } catch (error) {
      console.error('Fehler beim Laden der Graduierungen:', error);
    }
  };

  const fetchKandidaten = async () => {
    setLoading(true);
    setError('');
    try {
      const dojoParam = getDojoFilterParam();

      // 🔒 WICHTIG: Nicht laden wenn dojoParam leer ist
      if (!dojoParam) {
        console.warn('⚠️ DojoParam ist leer - warte auf Dojo-Laden');
        setLoading(false);
        return;
      }

      const stilParam = selectedStil !== 'all' ? `&stil_id=${selectedStil}` : '';

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/kandidaten?${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );

      if (!response.ok) throw new Error('Fehler beim Laden der Kandidaten');

      const data = await response.json();
      console.log('🎯 Kandidaten-Daten:', data.kandidaten);
      console.log('🔍 Beispiel-Kandidat:', data.kandidaten?.[0]);
      setKandidaten(data.kandidaten || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchZugelassenePruefungen = async () => {
    setLoading(true);
    try {
      const dojoParam = getDojoFilterParam();

      // 🔒 WICHTIG: Nicht laden wenn dojoParam leer ist (Dojos noch nicht geladen)
      if (!dojoParam) {
        console.warn('⚠️ DojoParam ist leer - warte auf Dojo-Laden');
        setLoading(false);
        return;
      }

      const stilParam = selectedStil !== 'all' ? `&stil_id=${selectedStil}` : '';

      const response = await fetch(
        `${API_BASE_URL}/pruefungen?status=geplant&${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );

      const data = await response.json();
      console.log('🔍 Zugelassene Prüfungen API Response:', data);
      console.log('🔍 Prüfungen Array:', data.pruefungen);
      console.log('🔍 Beispiel-Prüfung:', data.pruefungen?.[0]);
      setZugelassenePruefungen(data.pruefungen || []);
    } catch (error) {
      console.error('❌ Fehler beim Laden zugelassener Prüfungen:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAbgeschlossenePruefungen = async () => {
    setLoading(true);
    try {
      const dojoParam = getDojoFilterParam();

      // 🔒 WICHTIG: Nicht laden wenn dojoParam leer ist
      if (!dojoParam) {
        console.warn('⚠️ DojoParam ist leer - warte auf Dojo-Laden');
        setLoading(false);
        return;
      }

      const stilParam = selectedStil !== 'all' ? `&stil_id=${selectedStil}` : '';

      const response = await fetch(
        `${API_BASE_URL}/pruefungen?status=bestanden&${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );

      const data = await response.json();
      setAbgeschlossenePruefungen(data.pruefungen || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistiken = async () => {
    setLoading(true);
    try {
      const dojoParam = getDojoFilterParam();

      // 🔒 WICHTIG: Nicht laden wenn dojoParam leer ist
      if (!dojoParam) {
        console.warn('⚠️ DojoParam ist leer - warte auf Dojo-Laden');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/stats/statistiken?${dojoParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );

      const data = await response.json();
      setStatistiken(data.statistiken);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPruefungstermine = async () => {
    setLoading(true);
    try {
      const dojoParam = getDojoFilterParam();

      // 🔒 WICHTIG: Nicht laden wenn dojoParam leer ist
      if (!dojoParam) {
        console.warn('⚠️ DojoParam ist leer - warte auf Dojo-Laden');
        setLoading(false);
        return;
      }

      const stilParam = selectedStil !== 'all' ? `&stil_id=${selectedStil}` : '';

      // Lade geplante Prüfungen
      const pruefungenResponse = await fetch(
        `${API_BASE_URL}/pruefungen?status=geplant&${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );
      const pruefungenData = await pruefungenResponse.json();

      // Lade Prüfungstermine (Vorlagen)
      const termineResponse = await fetch(
        `${API_BASE_URL}/pruefungen/termine?${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );
      const termineData = await termineResponse.json();

      // Gruppiere Prüfungen nach Datum UND Stil
      const grouped = {};
      (pruefungenData.pruefungen || []).forEach(pruefung => {
        const datum = pruefung.pruefungsdatum ? pruefung.pruefungsdatum.split('T')[0] : 'Kein Datum';
        const key = `${datum}_${pruefung.stil_id}`;
        if (!grouped[key]) {
          grouped[key] = {
            datum,
            stil_id: pruefung.stil_id,
            stil_name: pruefung.stil_name,
            pruefungen: []
          };
        }
        grouped[key].pruefungen.push(pruefung);
      });

      // Füge Termin-Vorlagen ohne Kandidaten hinzu
      (termineData.termine || []).forEach(termin => {
        const datum = termin.pruefungsdatum ? termin.pruefungsdatum.split('T')[0] : 'Kein Datum';
        const key = `${datum}_${termin.stil_id}`;
        if (!grouped[key]) {
          grouped[key] = {
            datum,
            stil_id: termin.stil_id,
            stil_name: termin.stil_name,
            pruefungen: [],
            isVorlage: true
          };
        }
        // Markiere als Termin-Vorlage
        grouped[key].isVorlage = true;
        grouped[key].vorlageData = {
          termin_id: termin.termin_id,
          ort: termin.pruefungsort,
          zeit: termin.pruefungszeit,
          pruefer_name: termin.pruefer_name,
          stil_id: termin.stil_id,
          stil_name: termin.stil_name,
          pruefungsgebuehr: termin.pruefungsgebuehr,
          anmeldefrist: termin.anmeldefrist ? termin.anmeldefrist.split('T')[0] : null,
          bemerkungen: termin.bemerkungen,
          teilnahmebedingungen: termin.teilnahmebedingungen,
          oeffentlich: termin.oeffentlich ? true : false
        };
      });

      // Konvertiere zu Array und sortiere nach Datum, dann nach Stil
      const termineArray = Object.keys(grouped).map(key => {
        const group = grouped[key];
        return {
          datum: group.datum,
          stil_id: group.stil_id,
          stil_name: group.stil_name,
          pruefungen: group.pruefungen,
          anzahl: group.pruefungen.length,
          ort: group.pruefungen[0]?.pruefungsort || group.vorlageData?.ort || 'Nicht festgelegt',
          zeit: group.pruefungen[0]?.pruefungszeit || group.vorlageData?.zeit || 'Nicht festgelegt',
          pruefer_name: group.pruefungen[0]?.pruefer_name || group.vorlageData?.pruefer_name || 'Nicht festgelegt',
          isVorlage: group.pruefungen.length === 0 && group.vorlageData,
          vorlageData: group.vorlageData,
          oeffentlich: group.vorlageData?.oeffentlich || false
        };
      }).sort((a, b) => {
        // Zukünftige Termine zuerst (aufsteigend), vergangene danach (absteigend)
        const today = new Date(); today.setHours(0,0,0,0);
        const da = new Date(a.datum); const db = new Date(b.datum);
        const aFuture = da >= today; const bFuture = db >= today;
        if (aFuture !== bFuture) return aFuture ? -1 : 1; // Zukunft zuerst
        const dateCompare = aFuture
          ? da - db   // Zukünftige: aufsteigend (nächster zuerst)
          : db - da;  // Vergangene: absteigend (neuester zuerst)
        if (dateCompare !== 0) return dateCompare;
        // Bei gleichem Datum: nach Uhrzeit sortieren
        const timeCompare = (a.zeit || '00:00').localeCompare(b.zeit || '00:00');
        if (timeCompare !== 0) return timeCompare;
        // Dann nach Stil-Name sortieren
        return (a.stil_name || '').localeCompare(b.stil_name || '');
      });

      setPruefungstermine(termineArray);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Kandidat zur Prüfung zulassen
  const handleKandidatZulassen = async (kandidat, customPruefungsDaten = null) => {
    try {
      if (!activeDojo || !activeDojo.id) {
        setError('Kein Dojo ausgewählt. Bitte wählen Sie ein Dojo aus.');
        return;
      }

      const dojoId = activeDojo.id;
      let datenZuVerwenden = customPruefungsDaten || pruefungsDaten;

      // Wenn kein Prüfungsdatum angegeben wurde, suche automatisch den nächsten Termin für den Stil
      if (!datenZuVerwenden.pruefungsdatum && kandidat.stil_id) {
        try {
          // Lade die nächsten Prüfungstermine für diesen Stil
          const termineResponse = await fetch(
            `${API_BASE_URL}/pruefungen/termine?stil_id=${kandidat.stil_id}&dojo_id=${dojoId}`,
            {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
              }
            }
          );

          if (termineResponse.ok) {
            const termineResult = await termineResponse.json();
            const termineData = termineResult.termine || [];

            console.log('📅 Prüfungstermine geladen:', termineData);

            // Finde den nächsten zukünftigen Termin
            const heute = new Date();
            heute.setHours(0, 0, 0, 0);

            const naechsterTermin = termineData
              .filter(termin => {
                const terminDatum = new Date(termin.pruefungsdatum);
                terminDatum.setHours(0, 0, 0, 0);
                return terminDatum >= heute;
              })
              .sort((a, b) => new Date(a.pruefungsdatum) - new Date(b.pruefungsdatum))[0];

            if (naechsterTermin) {
              datenZuVerwenden = {
                pruefungsdatum: naechsterTermin.pruefungsdatum,
                pruefungszeit: naechsterTermin.pruefungszeit || '10:00',
                pruefungsort: naechsterTermin.pruefungsort,
                pruefungsgebuehr: naechsterTermin.pruefungsgebuehr,
                anmeldefrist: naechsterTermin.anmeldefrist,
                gurtlaenge: naechsterTermin.gurtlaenge,
                bemerkungen: naechsterTermin.bemerkungen,
                teilnahmebedingungen: naechsterTermin.teilnahmebedingungen
              };
              console.log('✅ Nächster Prüfungstermin gefunden:', naechsterTermin);
            } else {
              setError(`Kein zukünftiger Prüfungstermin für ${kandidat.stil_name} gefunden. Bitte legen Sie zuerst einen Termin an.`);
              return;
            }
          }
        } catch (termineError) {
          console.error('Fehler beim Laden der Termine:', termineError);
          setError('Fehler beim Laden der Prüfungstermine.');
          return;
        }
      }

      // Prüfe erneut ob ein Datum vorhanden ist
      if (!datenZuVerwenden.pruefungsdatum) {
        setError('Kein Prüfungsdatum verfügbar. Bitte legen Sie zuerst einen Prüfungstermin an.');
        return;
      }

      // Kombiniere Datum und Uhrzeit
      let pruefungsdatumZeit = null;
      if (datenZuVerwenden.pruefungsdatum && datenZuVerwenden.pruefungszeit) {
        const datumStr = datenZuVerwenden.pruefungsdatum.split('T')[0];
        const zeitStr = datenZuVerwenden.pruefungszeit.includes(':')
          ? (datenZuVerwenden.pruefungszeit.split(':').length === 2
              ? `${datenZuVerwenden.pruefungszeit}:00`
              : datenZuVerwenden.pruefungszeit)
          : `${datenZuVerwenden.pruefungszeit}:00:00`;
        pruefungsdatumZeit = `${datumStr} ${zeitStr}`;
      } else if (datenZuVerwenden.pruefungsdatum) {
        const datumStr = datenZuVerwenden.pruefungsdatum.split('T')[0];
        pruefungsdatumZeit = datumStr;
      }

      // Ermittle die ausgewählte Graduierung (falls manuell gewählt, sonst die empfohlene)
      const key = `${kandidat.mitglied_id}-${kandidat.stil_id}`;
      const graduierung_nachher_id = selectedGraduierungen[key] || kandidat.naechste_graduierung_id;

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/kandidaten/${kandidat.mitglied_id}/zulassen`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            stil_id: kandidat.stil_id,
            graduierung_nachher_id: graduierung_nachher_id,
            pruefungsdatum: pruefungsdatumZeit,
            pruefungsort: datenZuVerwenden.pruefungsort || null,
            pruefungsgebuehr: datenZuVerwenden.pruefungsgebuehr ? parseFloat(datenZuVerwenden.pruefungsgebuehr) : null,
            anmeldefrist: datenZuVerwenden.anmeldefrist || null,
            gurtlaenge: datenZuVerwenden.gurtlaenge || null,
            bemerkungen: datenZuVerwenden.bemerkungen || null,
            teilnahmebedingungen: datenZuVerwenden.teilnahmebedingungen || null,
            dojo_id: parseInt(dojoId),
            pruefungszeit: datenZuVerwenden.pruefungszeit || '10:00'
          })
        }
      );

      if (!response.ok) throw new Error('Fehler beim Zulassen');

      const formattedDate = new Date(datenZuVerwenden.pruefungsdatum).toLocaleDateString('de-DE');
      setSuccess(`${kandidat.vorname} ${kandidat.nachname} wurde zur Prüfung am ${formattedDate} zugelassen!`);
      fetchKandidaten();
      fetchZugelassenePruefungen();
      fetchPruefungstermine(); // Aktualisiere auch die Prüfungstermine-Liste

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    }
  };

  // Ausnahme-Zulassung (für Kandidaten ohne Voraussetzungen)
  const handleAusnahmeZulassen = async (kandidat) => {
    if (!window.confirm(
      `${kandidat.vorname} ${kandidat.nachname} erfüllt die zeitlichen Voraussetzungen noch nicht.\n\n` +
      `Möchten Sie eine Ausnahme-Zulassung erteilen?`
    )) {
      return;
    }

    await handleKandidatZulassen(kandidat, null);
  };

  // Termin-Auswahl Modal öffnen (beim Zulassen)
  const openTerminAuswahl = (kandidat, isAusnahme = false) => {
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const verfuegbareTermine = pruefungstermine.filter(t => {
      if (t.stil_id !== kandidat.stil_id) return false;
      const terminDatum = new Date(t.datum);
      terminDatum.setHours(0, 0, 0, 0);
      return terminDatum >= heute;
    });

    if (verfuegbareTermine.length === 0) {
      setError(`Kein zukünftiger Prüfungstermin für ${kandidat.stil_name} gefunden. Bitte legen Sie zuerst einen Termin an.`);
      return;
    }

    setTerminAuswahlModal({ open: true, kandidat, termine: verfuegbareTermine, isAusnahme });
  };

  // Termin im Modal ausgewählt
  const handleTerminAuswahlSelected = async (termin) => {
    const { kandidat, isAusnahme } = terminAuswahlModal;
    setTerminAuswahlModal({ open: false, kandidat: null, termine: [], isAusnahme: false });

    const customDaten = {
      pruefungsdatum: termin.datum,
      pruefungszeit: termin.zeit !== 'Nicht festgelegt' ? termin.zeit : '10:00',
      pruefungsort: termin.ort,
      pruefungsgebuehr: termin.vorlageData?.pruefungsgebuehr,
      anmeldefrist: termin.vorlageData?.anmeldefrist,
      bemerkungen: termin.vorlageData?.bemerkungen,
      teilnahmebedingungen: termin.vorlageData?.teilnahmebedingungen
    };

    if (isAusnahme) {
      if (!window.confirm(
        `${kandidat.vorname} ${kandidat.nachname} erfüllt die zeitlichen Voraussetzungen noch nicht.\n\n` +
        `Möchten Sie eine Ausnahme-Zulassung erteilen?`
      )) {
        return;
      }
    }

    await handleKandidatZulassen(kandidat, customDaten);
  };

  // Funktion zum Entfernen der Zulassung
  const handleZulassungEntfernen = async (pruefung) => {
    if (!window.confirm(`Möchten Sie die Zulassung von ${pruefung.vorname} ${pruefung.nachname} wirklich entfernen?`)) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/pruefungen/kandidaten/${pruefung.mitglied_id}/zulassung/${pruefung.pruefung_id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );

      if (!response.ok) throw new Error('Fehler beim Entfernen der Zulassung');

      setSuccess(`Zulassung von ${pruefung.vorname} ${pruefung.nachname} wurde entfernt.`);
      fetchZugelassenePruefungen(); // Liste aktualisieren
      fetchKandidaten(); // Kandidaten auch aktualisieren
      fetchPruefungstermine(); // Prüfungstermine auch aktualisieren

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    }
  };

  // Funktion zum Ändern des Status (bestanden/nicht bestanden)
  const handleStatusAendern = async (pruefung) => {
    const neuerStatus = !pruefung.bestanden;
    const statusText = neuerStatus ? 'bestanden' : 'nicht bestanden';

    let confirmText = `Möchten Sie den Status von ${pruefung.vorname} ${pruefung.nachname} wirklich auf "${statusText}" ändern?`;

    if (!neuerStatus) {
      // Von bestanden auf nicht bestanden ändern
      confirmText += '\n\nHinweis: Die Graduierung des Mitglieds wird auf den Stand vor der Prüfung zurückgesetzt.';
    }

    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/pruefungen/${pruefung.pruefung_id}/status-aendern`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            bestanden: neuerStatus,
            mitglied_id: pruefung.mitglied_id,
            stil_id: pruefung.stil_id,
            graduierung_vorher_id: pruefung.graduierung_vorher_id,
            graduierung_nachher_id: pruefung.graduierung_nachher_id
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Ändern des Status');
      }

      setSuccess(`Status von ${pruefung.vorname} ${pruefung.nachname} wurde auf "${statusText}" geändert.`);
      fetchAbgeschlossenePruefungen(); // Liste aktualisieren
      fetchKandidaten(); // Kandidaten auch aktualisieren

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleErgebnisEintragen = async () => {
    if (!selectedPruefung) return;

    try {
      const updateData = {
        bestanden: pruefungsErgebnis.bestanden,
        punktzahl: pruefungsErgebnis.punktzahl ? parseFloat(pruefungsErgebnis.punktzahl) : null,
        max_punktzahl: pruefungsErgebnis.max_punktzahl ? parseFloat(pruefungsErgebnis.max_punktzahl) : null,
        prueferkommentar: pruefungsErgebnis.prueferkommentar,
        status: pruefungsErgebnis.bestanden ? 'bestanden' : 'nicht_bestanden',
        graduierung_nachher_id: pruefungsErgebnis.graduierung_nachher_id
      };

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/${selectedPruefung.pruefung_id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) throw new Error('Fehler beim Speichern des Ergebnisses');

      // Bei bestandener Prüfung: Graduierung aktualisieren
      if (pruefungsErgebnis.bestanden && pruefungsErgebnis.graduierung_nachher_id) {
        await updateMemberGraduierung(
          selectedPruefung.mitglied_id,
          selectedPruefung.stil_id,
          pruefungsErgebnis.graduierung_nachher_id
        );

        // Automatisch Urkunde generieren (TODO: Backend-Endpunkt implementieren)
        await generateUrkunde(selectedPruefung.pruefung_id);
      }

      setShowErgebnisModal(false);
      setSelectedPruefung(null);
      setPruefungsErgebnis({
        bestanden: false,
        punktzahl: '',
        max_punktzahl: '',
        prueferkommentar: '',
        graduierung_nachher_index: 0,
        graduierung_nachher_id: null,
        graduierung_nachher_name: '',
        graduierung_nachher_farbe: ''
      });
      setGraduierungenFuerModal([]);

      setSuccess('Prüfungsergebnis erfolgreich gespeichert!');
      setTimeout(() => setSuccess(''), 3000);
      fetchZugelassenePruefungen();
    } catch (error) {
      setError(error.message);
    }
  };

  // Batch-Ergebnis Modal oeffnen
  const openBatchErgebnisModal = (termin) => {
    setBatchTermin(termin);
    // Initialisiere Ergebnisse fuer alle Pruefungen
    const initialErgebnisse = {};
    termin.pruefungen.forEach(pruefung => {
      initialErgebnisse[pruefung.pruefung_id] = {
        bestanden: true, // Standard: bestanden
        punktzahl: '',
        prueferkommentar: ''
      };
    });
    setBatchErgebnisse(initialErgebnisse);
    setShowBatchErgebnisModal(true);
  };

  // Batch-Ergebnis speichern
  const handleBatchErgebnisSpeichern = async () => {
    if (!batchTermin) return;

    setLoading(true);
    try {
      let erfolgreiche = 0;
      let fehler = 0;

      for (const pruefung of batchTermin.pruefungen) {
        const ergebnis = batchErgebnisse[pruefung.pruefung_id];
        if (!ergebnis) continue;

        const updateData = {
          bestanden: ergebnis.bestanden,
          punktzahl: ergebnis.punktzahl ? parseFloat(ergebnis.punktzahl) : null,
          prueferkommentar: ergebnis.prueferkommentar || null,
          status: ergebnis.bestanden ? 'bestanden' : 'nicht_bestanden',
          graduierung_nachher_id: ergebnis.bestanden ? pruefung.graduierung_nachher_id : null
        };

        try {
          const response = await fetch(
            `${API_BASE_URL}/pruefungen/${pruefung.pruefung_id}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
              },
              body: JSON.stringify(updateData)
            }
          );

          if (response.ok) {
            // Bei bestandener Pruefung: Graduierung aktualisieren
            if (ergebnis.bestanden && pruefung.graduierung_nachher_id) {
              await updateMemberGraduierung(
                pruefung.mitglied_id,
                pruefung.stil_id,
                pruefung.graduierung_nachher_id
              );
            }
            erfolgreiche++;
          } else {
            fehler++;
          }
        } catch (err) {
          fehler++;
          console.error('Fehler bei Pruefung', pruefung.pruefung_id, err);
        }
      }

      setShowBatchErgebnisModal(false);
      setBatchTermin(null);
      setBatchErgebnisse({});

      if (fehler === 0) {
        setSuccess(`Alle ${erfolgreiche} Pruefungsergebnisse erfolgreich gespeichert!`);
      } else {
        setSuccess(`${erfolgreiche} Ergebnisse gespeichert, ${fehler} Fehler aufgetreten.`);
      }
      setTimeout(() => setSuccess(''), 5000);

      fetchPruefungstermine();
      fetchZugelassenePruefungen();
      fetchAbgeschlossenePruefungen();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Alle als bestanden/nicht bestanden markieren
  const setBatchAlleBestanden = (bestanden) => {
    const updated = { ...batchErgebnisse };
    Object.keys(updated).forEach(key => {
      updated[key].bestanden = bestanden;
    });
    setBatchErgebnisse(updated);
  };

  const updateMemberGraduierung = async (mitglied_id, stil_id, graduierung_id) => {
    try {
      await fetch(
        `${API_BASE_URL}/mitglieder/${mitglied_id}/stil/${stil_id}/data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            current_graduierung_id: graduierung_id,
            letzte_pruefung: new Date().toISOString().split('T')[0]
          })
        }
      );
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Graduierung:', error);
    }
  };

  const generateUrkunde = async (pruefung_id) => {
    try {
      // TODO: Backend-Endpunkt für Urkunden-Generierung
      console.log('Urkunde für Prüfung', pruefung_id, 'wird generiert...');
    } catch (error) {
      console.error('Fehler beim Generieren der Urkunde:', error);
    }
  };

  const handleNeuerTerminErstellen = async () => {
    if (!neuerTermin.pruefungsdatum) {
      setError('Bitte geben Sie ein Prüfungsdatum an');
      return;
    }

    if (!neuerTermin.stil_id) {
      setError('Bitte wählen Sie einen Stil aus');
      return;
    }

    if (!activeDojo || !activeDojo.id) {
      setError('Kein Dojo ausgewählt');
      return;
    }

    try {
      // Sende an Backend API
      const terminData = {
        datum: neuerTermin.pruefungsdatum,
        zeit: neuerTermin.pruefungszeit,
        ort: neuerTermin.pruefungsort,
        pruefer_name: neuerTermin.pruefer_name || null,
        stil_id: neuerTermin.stil_id,
        pruefungsgebuehr: neuerTermin.pruefungsgebuehr ? parseFloat(neuerTermin.pruefungsgebuehr) : null,
        anmeldefrist: neuerTermin.anmeldefrist || null,
        bemerkungen: neuerTermin.bemerkungen || null,
        teilnahmebedingungen: neuerTermin.teilnahmebedingungen || null,
        oeffentlich: neuerTermin.oeffentlich ? 1 : 0,
        dojo_id: activeDojo.id
      };

      const response = await fetch(`${API_BASE_URL}/pruefungen/termine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(terminData)
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 409) {
          // Überschneidung - zeige detaillierte Fehlermeldung
          throw new Error(data.message || data.error || 'Zeitüberschneidung');
        }
        throw new Error(data.error || 'Fehler beim Erstellen des Termins');
      }

      setSuccess(`Prüfungstermin für ${new Date(neuerTermin.pruefungsdatum).toLocaleDateString('de-DE')} wurde erstellt!`);
      setTimeout(() => setSuccess(''), 3000);

      setShowNeuerTerminModal(false);
      setNeuerTermin({
        pruefungsdatum: '',
        pruefungszeit: '10:00',
        pruefungsort: '',
        pruefer_name: '',
        stil_id: '',
        pruefungsgebuehr: '',
        anmeldefrist: '',
        gurtlaenge: '',
        bemerkungen: '',
        teilnahmebedingungen: '',
        oeffentlich: false,
        ist_historisch: false,
        historisch_bemerkung: ''
      });

      // Aktualisiere Termin-Liste
      fetchPruefungstermine();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleTerminBearbeiten = (termin) => {
    // Formatiere Daten korrekt - verhindert Zeitzonen-Probleme
    const formatDateForInput = (dateString) => {
      if (!dateString) return '';

      // Bereits im richtigen Format (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }

      // ISO-Format mit Zeit - extrahiere nur Datum
      if (dateString.includes('T')) {
        return dateString.split('T')[0];
      }

      // Falls Date-Objekt oder anderes Format, parse es
      try {
        const date = new Date(dateString);
        // Verwende UTC um Zeitzonen-Probleme zu vermeiden
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      } catch (e) {
        console.error('Fehler beim Formatieren des Datums:', dateString, e);
        return '';
      }
    };

    setEditTermin({
      id: termin.vorlageData?.termin_id,
      datum: formatDateForInput(termin.datum),
      pruefungsdatum: formatDateForInput(termin.datum),
      pruefungszeit: termin.zeit || '10:00',
      pruefungsort: termin.ort || '',
      pruefer_name: termin.vorlageData?.pruefer_name || '',
      stil_id: termin.vorlageData?.stil_id || '',
      pruefungsgebuehr: termin.vorlageData?.pruefungsgebuehr || '',
      anmeldefrist: formatDateForInput(termin.vorlageData?.anmeldefrist),
      bemerkungen: termin.vorlageData?.bemerkungen || '',
      teilnahmebedingungen: termin.vorlageData?.teilnahmebedingungen || '',
      oeffentlich: termin.vorlageData?.oeffentlich ? true : false
    });
    setShowEditTerminModal(true);
  };

  const toggleTerminExpanded = (terminKey, termin) => {
    const isCurrentlyExpanded = expandedTermine[terminKey];
    setExpandedTermine(prev => ({
      ...prev,
      [terminKey]: !prev[terminKey]
    }));
    // Externe Anmeldungen laden wenn öffentlicher Termin aufgeklappt wird
    if (!isCurrentlyExpanded && termin?.oeffentlich && termin?.vorlageData?.termin_id) {
      fetchExterneAnmeldungen(termin.vorlageData.termin_id);
    }
  };

  // Sortier-Funktion
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Sortier-Icon-Komponente
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return (
        <span className="pv3-sort-icon-inactive">⇅</span>
      );
    }
    return (
      <span className="pv3-sort-icon-active">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Sortier-Logik anwenden
  const applySorting = (data, key, direction) => {
    if (!key) return data;

    return [...data].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];

      // Behandle null/undefined Werte
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // String-Vergleich (case-insensitive)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleTerminAktualisieren = async () => {
    if (!editTermin || !editTermin.pruefungsdatum) {
      setError('Bitte geben Sie ein Prüfungsdatum an');
      return;
    }

    if (!editTermin.id) {
      setError('Termin-ID fehlt');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/pruefungen/termine/${editTermin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          datum: editTermin.pruefungsdatum,
          zeit: editTermin.pruefungszeit,
          ort: editTermin.pruefungsort,
          pruefer_name: editTermin.pruefer_name || null,
          stil_id: editTermin.stil_id,
          pruefungsgebuehr: editTermin.pruefungsgebuehr ? parseFloat(editTermin.pruefungsgebuehr) : null,
          anmeldefrist: editTermin.anmeldefrist || null,
          bemerkungen: editTermin.bemerkungen || null,
          teilnahmebedingungen: editTermin.teilnahmebedingungen || null,
          oeffentlich: editTermin.oeffentlich ? 1 : 0
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Aktualisieren des Termins');
      }

      setSuccess('Prüfungstermin wurde erfolgreich aktualisiert!');
      setTimeout(() => setSuccess(''), 3000);

      setShowEditTerminModal(false);
      setEditTermin(null);
      fetchPruefungstermine();
    } catch (error) {
      setError(error.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const fetchExterneAnmeldungen = async (termin_id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/pruefungen/termine/${termin_id}/anmeldungen`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}` }
      });
      const data = await response.json();
      setExterneAnmeldungen(prev => ({ ...prev, [termin_id]: data.anmeldungen || [] }));
    } catch (err) {
      console.error('Fehler beim Laden der externen Anmeldungen:', err);
    }
  };

  const handleTerminLoeschen = async (termin) => {
    // Prüfe ob es eine echte Vorlage ist oder nur ein gruppierter Termin mit Kandidaten
    if (!termin.vorlageData?.termin_id) {
      // Wenn es Kandidaten gibt, müssen diese einzeln entfernt werden
      if (termin.pruefungen && termin.pruefungen.length > 0) {
        setError(`Dieser Termin hat ${termin.pruefungen.length} zugelassene Kandidaten. Bitte entfernen Sie zuerst alle Kandidaten über "Zugelassene Prüfungen".`);
        return;
      }
      // Wenn keine Vorlage und keine Kandidaten: Termin existiert nicht wirklich
      setError('Dieser Termin existiert nicht in der Datenbank. Bitte aktualisieren Sie die Seite.');
      return;
    }

    if (!window.confirm(`Möchten Sie den Prüfungstermin am ${new Date(termin.datum).toLocaleDateString('de-DE')} wirklich löschen?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/pruefungen/termine/${termin.vorlageData.termin_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Löschen des Termins');
      }

      setSuccess('Prüfungstermin wurde erfolgreich gelöscht!');
      setTimeout(() => setSuccess(''), 3000);

      fetchPruefungstermine();
    } catch (error) {
      setError(error.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handlePruefungslistePDF = async (termin) => {
    try {
      // Öffne die PDF in einem neuen Tab
      const pdfUrl = `${API_BASE_URL}/pruefungen/termine/${termin.datum}/pdf?stil_id=${termin.stil_id}&dojo_id=${activeDojo.id}`;
      window.open(pdfUrl, '_blank');
    } catch (error) {
      setError('Fehler beim Generieren der PDF: ' + error.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const loadGraduierungenFuerModal = async (stil_id) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/stile/${stil_id}/graduierungen`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );
      const data = await response.json();
      setGraduierungenFuerModal(data.graduierungen || []);
      return data.graduierungen || [];
    } catch (error) {
      console.error('Fehler beim Laden der Graduierungen:', error);
      return [];
    }
  };

  const handleGraduierungAendern = (direction) => {
    if (!selectedPruefung || graduierungenFuerModal.length === 0) return;

    let newIndex = pruefungsErgebnis.graduierung_nachher_index;

    if (direction === 'up') {
      newIndex = Math.min(newIndex + 1, graduierungenFuerModal.length - 1);
    } else if (direction === 'down') {
      newIndex = Math.max(newIndex - 1, 0);
    }

    const newGrad = graduierungenFuerModal[newIndex];
    if (newGrad) {
      setPruefungsErgebnis({
        ...pruefungsErgebnis,
        graduierung_nachher_index: newIndex,
        graduierung_nachher_id: newGrad.graduierung_id,
        graduierung_nachher_name: newGrad.name,
        graduierung_nachher_farbe: newGrad.farbe_hex
      });
    }
  };

  // Keyboard Event für Pfeiltasten und Strg+Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showErgebnisModal) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleGraduierungAendern('up');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleGraduierungAendern('down');
        } else if (e.key === 'Enter' && e.ctrlKey) {
          e.preventDefault();
          handleErgebnisEintragen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showErgebnisModal, pruefungsErgebnis, selectedPruefung, graduierungenFuerModal]);

  // 🔒 Warte auf Dojos bevor irgendwas angezeigt wird
  if (dojosLoading || !dojos || dojos.length === 0) {
    return (
      <div className="content-card pv2-center-3rem">
        <div className="u-emoji-xl">⏳</div>
        <h2 className="pv3-loading-primary">Lade Dojos...</h2>
        <p className="pv-text-secondary">
          Bitte warten Sie, während die Dojo-Daten geladen werden.
        </p>
      </div>
    );
  }

  return (
    <div className="content-card">
      <div className="page-header">
        <div>
          <div className="pv3-page-header-row">
            <span className="pv3-header-icon">🎓</span>
            <h1 className="pv3-header-title">Prüfungsverwaltung</h1>
          </div>
          <p>Gurtprüfungen planen, durchführen und dokumentieren</p>
        </div>
        <div className="pv3-header-controls">
          <select
            value={selectedStil}
            onChange={(e) => setSelectedStil(e.target.value)}
            className="form-select pv3-select-min200"
          >
            <option value="all">Alle Stile</option>
            {stile.map(stil => (
              <option key={stil.stil_id} value={stil.stil_id}>
                {stil.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (activeTab === 'termine') fetchPruefungstermine();
              else if (activeTab === 'zugelassen') fetchZugelassenePruefungen();
              else if (activeTab === 'abgeschlossen') fetchAbgeschlossenePruefungen();
              else if (activeTab === 'statistiken') fetchStatistiken();
            }}
            className="logout-button pv3-btn-refresh"
          >
            🔄 Aktualisieren
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="pv3-tabs-row">
        <button
          onClick={() => setActiveTab('termine')}
          className={`pv3-tab-btn${activeTab === 'termine' ? ' active' : ''}`}
        >
          <Calendar size={18} />
          Prüfungstermine
        </button>
        <button
          onClick={() => setActiveTab('kandidaten')}
          className={`pv3-tab-btn${activeTab === 'kandidaten' ? ' active' : ''}`}
        >
          <Users size={18} />
          Prüfungskandidaten
        </button>
        <button
          onClick={() => setActiveTab('zugelassen')}
          className={`pv3-tab-btn${activeTab === 'zugelassen' ? ' active' : ''}`}
        >
          <Check size={18} />
          Zugelassene Prüfungen
        </button>
        <button
          onClick={() => setActiveTab('abgeschlossen')}
          className={`pv3-tab-btn${activeTab === 'abgeschlossen' ? ' active' : ''}`}
        >
          <Award size={18} />
          Abgeschlossene Prüfungen
        </button>
        <button
          onClick={() => setActiveTab('statistiken')}
          className={`pv3-tab-btn${activeTab === 'statistiken' ? ' active' : ''}`}
        >
          <TrendingUp size={18} />
          Statistiken
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="alert alert-success pv2-mb-1">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="alert alert-error pv2-mb-1">
          ❌ {error}
        </div>
      )}

      {/* Prüfungstermine Tab */}
      {activeTab === 'termine' && (
        <div>
          <div className="pv3-section-header">
            <div>
              <h2 className="pv3-section-title">
                GEPLANTE PRÜFUNGSTERMINE
                <span className="pv3-section-count">
                  ({(() => {
                    const heute = new Date();
                    heute.setHours(0, 0, 0, 0);
                    const geplante = pruefungstermine.filter(termin => {
                      const terminDatum = new Date(termin.datum);
                      terminDatum.setHours(0, 0, 0, 0);
                      return terminDatum >= heute;
                    });
                    return geplante.length;
                  })()} {(() => {
                    const heute = new Date();
                    heute.setHours(0, 0, 0, 0);
                    const geplante = pruefungstermine.filter(termin => {
                      const terminDatum = new Date(termin.datum);
                      terminDatum.setHours(0, 0, 0, 0);
                      return terminDatum >= heute;
                    });
                    return geplante.length === 1 ? 'TERMIN' : 'TERMINE';
                  })()})
                </span>
              </h2>
              <p className="pv3-section-subtitle">
                Übersicht aller geplanten Prüfungen gruppiert nach Datum
              </p>
            </div>
            <button
              onClick={() => setShowNeuerTerminModal(true)}
              className="pv3-btn-new-termin"
            >
              <Calendar size={18} />
              Neuer Termin
            </button>
          </div>

          {loading ? (
            <div className="pv3-loading-center">
              <div className="loading-spinner-large"></div>
              <p className="pv-text-muted">Termine werden geladen...</p>
            </div>
          ) : pruefungstermine.length === 0 ? (
            <div className="pv3-empty-state">
              <Calendar size={48} className="pv2-muted-mb" />
              <h3 className="pv2-secondary-mb">Keine Prüfungstermine geplant</h3>
              <p className="pv-muted-sm-row">
                Aktuell gibt es keine geplanten Prüfungstermine. Lassen Sie Kandidaten zur Prüfung zu, um Termine zu erstellen.
              </p>
            </div>
          ) : (
            <div className="pv3-termine-list">
              {/* Geplante Termine */}
              {(() => {
                const heute = new Date();
                heute.setHours(0, 0, 0, 0);
                const geplanteTermine = pruefungstermine.filter(termin => {
                  const terminDatum = new Date(termin.datum);
                  terminDatum.setHours(0, 0, 0, 0);
                  return terminDatum >= heute;
                });

                if (geplanteTermine.length === 0) {
                  return null;
                }

                return (
                  <div>
                    <h3 className="pv3-group-heading-warning">
                      GEPLANTE PRÜFUNGSTERMINE ({geplanteTermine.length} {geplanteTermine.length === 1 ? 'TERMIN' : 'TERMINE'})
                    </h3>
                    <div className="pv3-termin-group-list">
                      {geplanteTermine.map((termin, index) => {
                        const datum = new Date(termin.datum);
                        const isToday = termin.datum === new Date().toISOString().split('T')[0];
                        const isPast = false; // Geplante Termine sind nie vergangen

                return (
                  <div
                    key={index}
                    className={isToday ? 'pv3-termin-card--today' : 'pv3-termin-card'}
                  >
                    {/* Termin-Header */}
                    <div className="pv3-termin-header">
                      <div
                        className="pv2-flex-cursor"
                        onClick={() => toggleTerminExpanded(`${termin.datum}_${termin.stil_id}`, termin)}
                      >
                        <div className="pv3-termin-title-row">
                          <Calendar size={24} className={isToday ? 'pv3-calendar-today' : 'pv3-calendar-upcoming'} />
                          <h3 className={isToday ? 'pv3-termin-heading-today' : 'pv3-termin-heading-warning'}>
                            {datum.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </h3>
                          {expandedTermine[`${termin.datum}_${termin.stil_id}`] ? (
                            <ChevronUp size={24} className="pv-warning" />
                          ) : (
                            <ChevronDown size={24} className="pv-text-muted" />
                          )}
                          {isToday && (
                            <span className="pv3-badge-today">
                              Heute
                            </span>
                          )}
                          {isPast && !isToday && (
                            <span className="pv3-badge-past">
                              Vergangen
                            </span>
                          )}
                          {termin.oeffentlich && (
                            <span className="pv3-badge-public">
                              🌐 Öffentlich
                            </span>
                          )}
                        </div>
                        <div className="pv3-termin-meta-row">
                          <div className="pv-flex-row">
                            <span className="pv2-fw600">⏰ Uhrzeit:</span>
                            <span>{termin.zeit}</span>
                          </div>
                          <div className="pv-flex-row">
                            <span className="pv2-fw600">🥋 Stil:</span>
                            <span className="pv3-badge-stil">
                              {termin.stil_name}
                            </span>
                          </div>
                          <div className="pv-flex-row">
                            <span className="pv2-fw600">📍 Ort:</span>
                            <span>{termin.ort}</span>
                          </div>
                          <div className="pv-flex-row">
                            <span className="pv2-fw600">👥 Teilnehmer:</span>
                            <span className="pv3-badge-teilnehmer">
                              {termin.anzahl}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="u-flex-gap-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePruefungslistePDF(termin);
                          }}
                          className="logout-button pv3-btn-action-sm"
                          title="Teilnehmerliste als PDF drucken"
                        >
                          📄 PDF
                        </button>
                        {termin.anzahl > 0 && !termin.isVorlage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openBatchErgebnisModal(termin);
                            }}
                            className="logout-button pv3-btn-results"
                            title="Ergebnisse fuer alle Teilnehmer eintragen"
                          >
                            <Award size={16} />
                            Ergebnisse eintragen
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTerminBearbeiten(termin);
                          }}
                          className="logout-button pv3-btn-action-sm"
                          title="Termin bearbeiten"
                        >
                          <Edit size={16} />
                          Bearbeiten
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTerminLoeschen(termin);
                          }}
                          className="logout-button pv3-btn-delete"
                          title="Termin löschen"
                        >
                          <Trash2 size={16} />
                          Löschen
                        </button>
                      </div>
                    </div>

                    {/* Prüflinge-Liste */}
                    {expandedTermine[`${termin.datum}_${termin.stil_id}`] && (
                      <>
                        {termin.isVorlage ? (
                        <div className="pv3-vorlage-empty">
                          <Calendar size={48} className="pv3-icon-warning-large" />
                          <h4 className="pv3-vorlage-empty-title">
                            Termin ohne Teilnehmer
                          </h4>
                          <p className="pv3-vorlage-empty-text">
                            Dieser Termin wurde angelegt, hat aber noch keine zugelassenen Kandidaten.
                            <br />
                            Teilnehmer koennen ueber das Mitgliederprofil zu diesem Termin angemeldet werden.
                          </p>
                        </div>
                      ) : (
                        <div className="table-container pv2-mt-1">
                          <table className="data-table pv2-fs-0875">
                            <thead>
                              <tr>
                                <th className="pv3-th-180">Name</th>
                                <th className="pv3-th-110">Geburtsdatum</th>
                                <th className="pv3-th-100">Stil</th>
                                <th className="pv3-th-150">Aktueller Gurt</th>
                                <th className="pv3-th-150">Angestrebter Gurt</th>
                                <th className="pv3-th-140">Trainingsstunden</th>
                                <th className="pv3-th-100">Wartezeit</th>
                                <th className="pv3-th-130">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {termin.pruefungen.map((pruefung, pIndex) => (
                                <tr
                                  key={pIndex}
                                  className="pv3-table-row-gold hover-row"
                                >
                                  <td>
                                    <div className="pv-flex-col-xs">
                                      <span className="pv2-fw700-primary">
                                        {pruefung.vorname} {pruefung.nachname}
                                      </span>
                                      <span className="pv-muted-sm">
                                        ID: {pruefung.mitglied_id}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="pv-text-secondary">
                                      {pruefung.geburtsdatum ? new Date(pruefung.geburtsdatum).toLocaleDateString('de-DE') : '—'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="pv3-tag-stil-purple">
                                      {pruefung.stil_name}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="pv-flex-row">
                                      <div
                                        className="pv3-gurt-dot"
                                        style={{ '--dot-color': pruefung.farbe_vorher || '#6b7280' }}
                                      />
                                      <div className="pv2-flex-col">
                                        <span className="pv-bold-primary-sm">
                                          {pruefung.graduierung_vorher || 'Keine'}
                                        </span>
                                        <span className="pv-muted-xs">
                                          Ziel-Gurt
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    {graduierungenProStil[pruefung.stil_id] && graduierungenProStil[pruefung.stil_id].length > 0 ? (
                                      <div className="pv-flex-row">
                                        {(() => {
                                          const key = `${pruefung.mitglied_id}-${pruefung.stil_id}`;
                                          const selectedGradId = selectedGraduierungen[key] || pruefung.graduierung_nachher_id;
                                          const selectedGrad = graduierungenProStil[pruefung.stil_id].find(g => g.graduierung_id === selectedGradId);

                                          return (
                                            <>
                                              <div
                                                className="pv3-gurt-dot pv3-gurt-dot--selected"
                                                style={{ '--dot-color': selectedGrad?.farbe_hex || pruefung.farbe_nachher || '#EAB308' }}
                                                title={selectedGrad?.name || pruefung.graduierung_nachher || 'Keine Auswahl'}
                                              />
                                              <select
                                                value={selectedGradId || ''}
                                                onChange={async (e) => {
                                                  const newGradId = parseInt(e.target.value);
                                                  setSelectedGraduierungen({
                                                    ...selectedGraduierungen,
                                                    [key]: newGradId
                                                  });

                                                  try {
                                                    const response = await fetch(
                                                      `${API_BASE_URL}/pruefungen/${pruefung.pruefung_id}/graduierung`,
                                                      {
                                                        method: 'PUT',
                                                        headers: {
                                                          'Content-Type': 'application/json',
                                                          'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
                                                        },
                                                        body: JSON.stringify({ graduierung_nachher_id: newGradId })
                                                      }
                                                    );

                                                    if (response.ok) {
                                                      fetchPruefungstermine();
                                                      setSuccess('Graduierung erfolgreich aktualisiert!');
                                                      setTimeout(() => setSuccess(''), 2000);
                                                    } else {
                                                      const errorData = await response.json();
                                                      setError(errorData.error || 'Fehler beim Speichern der Graduierung');
                                                      setTimeout(() => setError(''), 3000);
                                                    }
                                                  } catch (err) {
                                                    console.error('Fehler beim Speichern der Graduierung:', err);
                                                    setError('Fehler beim Speichern der Graduierung');
                                                    setTimeout(() => setError(''), 3000);
                                                  }
                                                }}
                                                className="pv3-grad-select"
                                                title="Ziel-Graduierung ändern"
                                              >
                                                {graduierungenProStil[pruefung.stil_id]
                                                  .filter(grad => grad.aktiv === 1)
                                                  .sort((a, b) => a.reihenfolge - b.reihenfolge)
                                                  .map((grad) => (
                                                    <option key={grad.graduierung_id} value={grad.graduierung_id}>
                                                      {grad.name}
                                                    </option>
                                                  ))}
                                              </select>
                                            </>
                                          );
                                        })()}
                                      </div>
                                    ) : (
                                      <div className="pv-flex-row">
                                        <div
                                          className="pv3-gurt-dot"
                                          style={{ '--dot-color': pruefung.farbe_nachher || '#EAB308' }}
                                        />
                                        <span className="pv-bold-primary-sm">
                                          {pruefung.graduierung_nachher}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <div className="pv-flex-col-sm">
                                      <div className="pv-flex-row">
                                        <span className="pv2-fw700-success">
                                          {pruefung.anwesenheiten_aktuell || 0}
                                        </span>
                                        <span className="pv-muted-xs">
                                          / {pruefung.min_trainingseinheiten || 0}
                                        </span>
                                      </div>
                                      <div className="pv3-progress-wrap">
                                        <div
                                          className={`pv3-bar-fill${((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? ' pv3-bar-fill--good' : ' pv3-bar-fill--warn'}`}
                                          style={{ width: `${Math.min(100, ((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100)}%` }}
                                        />
                                      </div>
                                      <span className="pv-muted-xs">
                                        {((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? '100%' : Math.round(((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100) + '%'} erreicht
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="pv-flex-col-sm">
                                      <span className="pv3-wartezeit-value">
                                        {pruefung.monate_seit_letzter_pruefung || 0} Mon.
                                      </span>
                                      <span className="pv-muted-xs">
                                        von {pruefung.min_wartezeit_monate || 0}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="pv3-badge-zugelassen">
                                      <Check size={14} />
                                      Zugelassen
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                        {/* Externe Anmeldungen */}
                        {termin.oeffentlich && termin.vorlageData?.termin_id && (
                          <div className="pv2-mt-15">
                            <h4 className="pv3-extern-heading">
                              🌐 Externe Anmeldungen
                            </h4>
                            {(() => {
                              const anmeldungen = externeAnmeldungen[termin.vorlageData.termin_id];
                              if (!anmeldungen) {
                                return (
                                  <p className="pv-muted-sm-row">
                                    Lade externe Anmeldungen...
                                  </p>
                                );
                              }
                              if (anmeldungen.length === 0) {
                                return (
                                  <p className="pv-muted-sm-row">
                                    Keine externen Anmeldungen vorhanden.
                                  </p>
                                );
                              }
                              return (
                                <div className="table-container">
                                  <table className="data-table pv3-extern-table">
                                    <thead>
                                      <tr>
                                        <th className="pv-sky">Name</th>
                                        <th className="pv-sky">E-Mail</th>
                                        <th className="pv-sky">Verein</th>
                                        <th className="pv-sky">Aktueller Gurt</th>
                                        <th className="pv-sky">Angestrebter Gurt</th>
                                        <th className="pv-sky">Status</th>
                                        <th className="pv-sky">Datum</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {anmeldungen.map(a => (
                                        <tr key={a.id}>
                                          <td>{a.vorname} {a.nachname}</td>
                                          <td>{a.email}</td>
                                          <td>{a.verein || '—'}</td>
                                          <td>{a.aktueller_gurt || '—'}</td>
                                          <td>{a.angestrebter_gurt || '—'}</td>
                                          <td>
                                            <span className={`pv3-extern-status pv3-extern-status--${a.status}`}>
                                              {a.status}
                                            </span>
                                          </td>
                                          <td className="pv3-extern-date">
                                            {new Date(a.erstellt_am).toLocaleDateString('de-DE')}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Vergangene Termine */}
              {(() => {
                const heute = new Date();
                heute.setHours(0, 0, 0, 0);
                const vergangeneTermine = pruefungstermine.filter(termin => {
                  const terminDatum = new Date(termin.datum);
                  terminDatum.setHours(0, 0, 0, 0);
                  return terminDatum < heute;
                });

                if (vergangeneTermine.length === 0) {
                  return null;
                }

                return (
                  <div>
                    <h3 className="pv3-group-heading-muted">
                      VERGANGENE PRÜFUNGSTERMINE ({vergangeneTermine.length} {vergangeneTermine.length === 1 ? 'TERMIN' : 'TERMINE'})
                    </h3>
                    <div className="pv3-termin-group-list">
                      {vergangeneTermine.map((termin, index) => {
                        const datum = new Date(termin.datum);
                        const isToday = false; // Vergangene Termine sind nie heute
                        const isPast = true; // Vergangene Termine sind immer vergangen

                        return (
                          <div
                            key={index}
                            className="pv3-termin-card--past"
                          >
                            {/* Termin-Header */}
                            <div className="pv3-termin-header">
                              <div
                                className="pv2-flex-cursor"
                                onClick={() => toggleTerminExpanded(`${termin.datum}_${termin.stil_id}`, termin)}
                              >
                                <div className="pv3-termin-title-row">
                                  <Calendar size={24} className="pv3-icon-purple" />
                                  <h3 className="pv3-termin-heading-warning">
                                    {datum.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                  </h3>
                                  {expandedTermine[`${termin.datum}_${termin.stil_id}`] ? (
                                    <ChevronUp size={24} className="pv3-icon-chevron-warning" />
                                  ) : (
                                    <ChevronDown size={24} className="pv3-icon-chevron-muted" />
                                  )}
                                  <span className="pv3-badge-past">
                                    Vergangen
                                  </span>
                                </div>
                                <div className="pv3-termin-meta-row">
                                  <div className="pv-flex-row">
                                    <span className="pv2-fw600">⏰ Uhrzeit:</span>
                                    <span>{termin.zeit}</span>
                                  </div>
                                  <div className="pv-flex-row">
                                    <span className="pv2-fw600">🥋 Stil:</span>
                                    <span className="pv3-badge-stil">
                                      {termin.stil_name}
                                    </span>
                                  </div>
                                  <div className="pv-flex-row">
                                    <span className="pv2-fw600">📍 Ort:</span>
                                    <span>{termin.ort}</span>
                                  </div>
                                  <div className="pv-flex-row">
                                    <span className="pv2-fw600">👥 Teilnehmer:</span>
                                    <span className="pv3-badge-teilnehmer">
                                      {termin.anzahl}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="u-flex-gap-sm">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePruefungslistePDF(termin);
                                  }}
                                  className="logout-button pv3-btn-action-sm"
                                  title="Teilnehmerliste als PDF drucken"
                                >
                                  📄 PDF
                                </button>
                                {termin.anzahl > 0 && !termin.isVorlage && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openBatchErgebnisModal(termin);
                                    }}
                                    className="logout-button pv3-btn-results"
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.4) 0%, rgba(34, 197, 94, 0.2) 50%, transparent 100%)';
                                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.1) 50%, transparent 100%)';
                                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(34, 197, 94, 0.2)';
                                    }}
                                    title="Ergebnisse fuer alle Teilnehmer eintragen"
                                  >
                                    <Award size={16} />
                                    Ergebnisse eintragen
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTerminBearbeiten(termin);
                                  }}
                                  className="logout-button pv3-btn-action-sm"
                                  title="Termin bearbeiten"
                                >
                                  <Edit size={16} />
                                  Bearbeiten
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTerminLoeschen(termin);
                                  }}
                                  className="logout-button pv3-btn-delete"
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(220, 53, 69, 0.4) 0%, rgba(220, 53, 69, 0.2) 50%, transparent 100%)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(220, 53, 69, 0.3) 0%, rgba(220, 53, 69, 0.1) 50%, transparent 100%)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 53, 69, 0.2)';
                                  }}
                                  title="Termin löschen"
                                >
                                  <Trash2 size={16} />
                                  Löschen
                                </button>
                              </div>
                            </div>

                            {/* Prüflinge-Liste */}
                            {expandedTermine[`${termin.datum}_${termin.stil_id}`] && (
                              <>
                                {termin.isVorlage ? (
                                <div className="pv3-vorlage-empty">
                                  <Calendar size={48} className="pv3-icon-warning-large" />
                                  <h4 className="pv3-vorlage-empty-title">
                                    Termin ohne Teilnehmer
                                  </h4>
                                  <p className="pv3-vorlage-empty-text">
                                    Dieser Termin wurde angelegt, hat aber noch keine zugelassenen Kandidaten.
                                    <br />
                                    Teilnehmer koennen ueber das Mitgliederprofil zu diesem Termin angemeldet werden.
                                  </p>
                                </div>
                              ) : (
                                <div className="table-container pv2-mt-1">
                                  <table className="data-table pv2-fs-0875">
                                    <thead>
                                      <tr>
                                        <th className="pv3-th-180">Name</th>
                                        <th className="pv3-th-110">Geburtsdatum</th>
                                        <th className="pv3-th-100">Stil</th>
                                        <th className="pv3-th-150">Aktueller Gurt</th>
                                        <th className="pv3-th-150">Angestrebter Gurt</th>
                                        <th className="pv3-th-140">Trainingsstunden</th>
                                        <th className="pv3-th-100">Wartezeit</th>
                                        <th className="pv3-th-130">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {termin.pruefungen.map((pruefung, pIndex) => (
                                        <tr
                                          key={pIndex}
                                          className="hover-row pv3-table-row-gold"
                                        >
                                          <td>
                                            <div className="pv-flex-col-xs">
                                              <span className="pv2-fw700-primary">
                                                {pruefung.vorname} {pruefung.nachname}
                                              </span>
                                              <span className="pv-muted-sm">
                                                ID: {pruefung.mitglied_id}
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <span className="pv-text-secondary">
                                              {pruefung.geburtsdatum ? new Date(pruefung.geburtsdatum).toLocaleDateString('de-DE') : '—'}
                                            </span>
                                          </td>
                                          <td>
                                            <span className="pv3-tag-stil-purple">
                                              {pruefung.stil_name}
                                            </span>
                                          </td>
                                          <td>
                                            <div className="pv-flex-row">
                                              <div
                                                className="pv3-gurt-dot"
                                                style={{ '--dot-color': pruefung.farbe_vorher || '#6b7280' }}
                                              />
                                              <div className="pv2-flex-col">
                                                <span className="pv-bold-primary-sm">
                                                  {pruefung.graduierung_vorher || 'Keine'}
                                                </span>
                                                <span className="pv-muted-xs">
                                                  Ziel-Gurt
                                                </span>
                                              </div>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="pv-flex-row">
                                              <div
                                                className="pv3-gurt-dot"
                                                style={{ '--dot-color': pruefung.farbe_nachher || '#EAB308' }}
                                              />
                                              <div className="pv2-flex-col">
                                                <span className="pv-bold-primary-sm">
                                                  {pruefung.graduierung_nachher}
                                                </span>
                                                <span className="pv-muted-xs">
                                                  Ziel-Gurt
                                                </span>
                                              </div>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="pv-flex-col-sm">
                                              <div className="pv-flex-row">
                                                <span className="pv2-fw700-success">
                                                  {pruefung.anwesenheiten_aktuell || 0}
                                                </span>
                                                <span className="pv-muted-xs">
                                                  / {pruefung.min_trainingseinheiten || 0}
                                                </span>
                                              </div>
                                              <div className="pv3-progress-wrap">
                                                <div
                                                  className={`pv3-bar-fill${((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? ' pv3-bar-fill--good' : ' pv3-bar-fill--warn'}`}
                                                  style={{ width: `${Math.min(100, ((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100)}%` }}
                                                />
                                              </div>
                                              <span className="pv-muted-xs">
                                                {((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? '100%' : Math.round(((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100) + '%'} erreicht
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="pv-flex-col-sm">
                                              <span className="pv3-wartezeit-value">
                                                {pruefung.monate_seit_letzter_pruefung || 0} Mon.
                                              </span>
                                              <span className="pv-muted-xs">
                                                von {pruefung.min_wartezeit_monate || 0}
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <span className="pv3-badge-zugelassen">
                                              <Check size={14} />
                                              Zugelassen
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Kandidaten Tab */}
      {activeTab === 'kandidaten' && (() => {
        // Filtere Kandidaten basierend auf Berechtigungs- und Stil-Filter
        let filteredKandidaten = kandidaten;

        // Berechtigungsfilter anwenden
        if (berechtigungsFilter === 'berechtigt') {
          filteredKandidaten = filteredKandidaten.filter(k => k.berechtigt);
        } else if (berechtigungsFilter === 'nicht_berechtigt') {
          filteredKandidaten = filteredKandidaten.filter(k => !k.berechtigt);
        }

        // Stilfilter anwenden
        if (kandidatenStilFilter !== 'all') {
          filteredKandidaten = filteredKandidaten.filter(k => k.stil_id === parseInt(kandidatenStilFilter));
        }

        // Suchfilter anwenden (Name, Vorname, ID)
        if (kandidatenSuchbegriff.trim() !== '') {
          const suchbegriff = kandidatenSuchbegriff.toLowerCase().trim();
          filteredKandidaten = filteredKandidaten.filter(k =>
            (k.vorname && k.vorname.toLowerCase().includes(suchbegriff)) ||
            (k.nachname && k.nachname.toLowerCase().includes(suchbegriff)) ||
            (k.mitglied_id && k.mitglied_id.toString().includes(suchbegriff))
          );
        }

        // Sortierung anwenden
        if (sortConfig.key) {
          filteredKandidaten = applySorting(filteredKandidaten, sortConfig.key, sortConfig.direction);
        }

        return (
        <div>
          <div className="pv3-kandidaten-header">
            <div className="u-flex-1">
              <h2 className="pv3-kandidaten-title">
                Prüfungskandidaten
                <span className="pv3-kandidaten-count">
                  ({filteredKandidaten.filter(k => k.berechtigt).length} berechtigt / {filteredKandidaten.length} angezeigt
                  {(berechtigungsFilter !== 'all' || kandidatenStilFilter !== 'all') && ` von ${kandidaten.length} gesamt`})
                </span>
              </h2>
              <p className="pv3-kandidaten-subtitle">
                {selectedKandidaten.length > 0
                  ? `${selectedKandidaten.length} Kandidat${selectedKandidaten.length > 1 ? 'en' : ''} ausgewählt`
                  : 'Wählen Sie Kandidaten aus, um sie zur Prüfung zuzulassen'}
              </p>

              {/* Filter Controls */}
              <div className="pv3-filter-row">
                {/* Berechtigungsfilter */}
                <div className="pv-flex-row">
                  <span className="pv-secondary-bold">
                    Berechtigung:
                  </span>
                  <div className="pv3-btn-group">
                    <button
                      onClick={() => setBerechtigungsFilter('all')}
                      className={`pv3-filter-btn${berechtigungsFilter === 'all' ? ' active' : ''}`}
                    >
                      Alle
                    </button>
                    <button
                      onClick={() => setBerechtigungsFilter('berechtigt')}
                      className={`pv3-filter-btn${berechtigungsFilter === 'berechtigt' ? ' active' : ''}`}
                    >
                      Berechtigt
                    </button>
                    <button
                      onClick={() => setBerechtigungsFilter('nicht_berechtigt')}
                      className={`pv3-filter-btn${berechtigungsFilter === 'nicht_berechtigt' ? ' active' : ''}`}
                    >
                      Nicht berechtigt
                    </button>
                  </div>
                </div>

                {/* Stilfilter */}
                <div className="pv-flex-row">
                  <span className="pv-secondary-bold">
                    Stil:
                  </span>
                  <select
                    value={kandidatenStilFilter}
                    onChange={(e) => setKandidatenStilFilter(e.target.value)}
                    className="pv3-dark-select"
                  >
                    <option value="all" className="pv2-dark-input">
                      Alle Stile
                    </option>
                    {stile.map(stil => (
                      <option
                        key={stil.stil_id}
                        value={stil.stil_id}
                        className="pv2-dark-input"
                      >
                        {stil.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Suchfeld */}
                <div className="pv3-search-wrap">
                  <span className="pv-secondary-bold">
                    Suche:
                  </span>
                  <input
                    type="text"
                    placeholder="Name suchen..."
                    value={kandidatenSuchbegriff}
                    onChange={(e) => setKandidatenSuchbegriff(e.target.value)}
                    className="pv3-search-input"
                  />
                  {kandidatenSuchbegriff && (
                    <button
                      onClick={() => setKandidatenSuchbegriff('')}
                      className="pv3-search-clear"
                      title="Suche zurücksetzen"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
            {selectedKandidaten.length > 0 && (
              <button
                onClick={() => {
                  // Batch-Zulassung für ausgewählte Kandidaten
                  selectedKandidaten.forEach(kandidat => handleKandidatZulassen(kandidat));
                  setSelectedKandidaten([]);
                }}
                className="btn btn-primary pv3-batch-btn"
              >
                <Check size={20} />
                {selectedKandidaten.length} Kandidat{selectedKandidaten.length > 1 ? 'en' : ''} zulassen
              </button>
            )}
          </div>

          {loading ? (
            <div className="pv3-loading-center">
              <div className="loading-spinner-large"></div>
              <p className="pv-text-secondary">Kandidaten werden geladen...</p>
            </div>
          ) : kandidaten.length === 0 ? (
            <div className="pv3-empty-state-dashed-gold">
              <Users size={48} className="pv2-muted-mb" />
              <h3 className="pv2-secondary-mb">Keine Kandidaten gefunden</h3>
              <p className="pv-muted-sm-row">
                Aktuell gibt es keine Mitglieder, die die Voraussetzungen für eine Prüfung erfüllen.
              </p>
            </div>
          ) : filteredKandidaten.length === 0 ? (
            <div className="pv3-empty-state-dashed-gold">
              <Users size={48} className="pv2-muted-mb" />
              <h3 className="pv2-secondary-mb">Keine Kandidaten mit den aktuellen Filtern</h3>
              <p className="pv-muted-sm-row">
                Passen Sie die Filter an, um andere Kandidaten anzuzeigen.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table pv3-table-sm">
                <thead>
                  <tr>
                    <th className="pv3-th-plain-40-center">
                      <input
                        type="checkbox"
                        className="pv3-checkbox-gold"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedKandidaten(filteredKandidaten.filter(k => k.berechtigt && !k.bereits_zugelassen));
                          } else {
                            setSelectedKandidaten([]);
                          }
                        }}
                        checked={
                          filteredKandidaten.filter(k => k.berechtigt && !k.bereits_zugelassen).length > 0 &&
                          selectedKandidaten.length === filteredKandidaten.filter(k => k.berechtigt && !k.bereits_zugelassen).length
                        }
                      />
                    </th>
                    <th
                      className="pv3-th-sortable"
                      onClick={() => handleSort('name')}
                    >
                      Name <SortIcon columnKey="name" />
                    </th>
                    <th
                      className="pv3-th-sortable-sm"
                      onClick={() => handleSort('geburtsdatum')}
                    >
                      Geb.datum <SortIcon columnKey="geburtsdatum" />
                    </th>
                    <th
                      className="pv3-th-sortable-xs"
                      onClick={() => handleSort('stil_name')}
                    >
                      Stil <SortIcon columnKey="stil_name" />
                    </th>
                    <th
                      className="pv3-th-sortable-md"
                      onClick={() => handleSort('graduierung_vorher_name')}
                    >
                      Aktuell <SortIcon columnKey="graduierung_vorher_name" />
                    </th>
                    <th
                      className="pv3-th-sortable-md"
                      onClick={() => handleSort('graduierung_nachher_name')}
                    >
                      Ziel <SortIcon columnKey="graduierung_nachher_name" />
                    </th>
                    <th className="pv3-th-plain-110">Stunden</th>
                    <th className="pv3-th-plain-80">Monate</th>
                    <th className="pv3-th-plain-100">Status</th>
                    <th className="pv3-th-plain-100-center">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKandidaten.map((kandidat, index) => (
                    <tr
                      key={`${kandidat.mitglied_id}-${kandidat.stil_id}-${index}`}
                      className={`hover-row ${kandidat.bereits_zugelassen ? 'pv3-kandidat-row--zugelassen' : kandidat.berechtigt ? 'pv3-kandidat-row--berechtigt' : ''}`}
                    >
                      <td className="pv2-text-center">
                        {kandidat.berechtigt && !kandidat.bereits_zugelassen ? (
                          <input
                            type="checkbox"
                            className="pv3-checkbox-gold"
                            checked={selectedKandidaten.some(k =>
                              k.mitglied_id === kandidat.mitglied_id && k.stil_id === kandidat.stil_id
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedKandidaten([...selectedKandidaten, kandidat]);
                              } else {
                                setSelectedKandidaten(selectedKandidaten.filter(k =>
                                  !(k.mitglied_id === kandidat.mitglied_id && k.stil_id === kandidat.stil_id)
                                ));
                              }
                            }}
                          />
                        ) : (
                          <span className="pv3-dash-muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="pv-flex-col-xs">
                          <strong className="u-text-primary">
                            {kandidat.vorname} {kandidat.nachname}
                          </strong>
                          <span className="pv-muted-sm">
                            ID: {kandidat.mitglied_id}
                          </span>
                        </div>
                      </td>
                      <td className="pv-text-secondary">
                        {new Date(kandidat.geburtsdatum).toLocaleDateString('de-DE')}
                      </td>
                      <td>
                        <span className="pv3-stil-badge-sm">
                          {kandidat.stil_name}
                        </span>
                      </td>
                      <td>
                        <div className="pv3-grad-row">
                          <div
                            className="pv3-gurt-dot-sm"
                            style={{ '--dot-color': kandidat.aktuelle_farbe || 'rgba(255, 255, 255, 0.1)' }}
                            title={kandidat.aktuelle_graduierung || 'Keine'}
                          />
                          <span className="pv3-grad-name">
                            {kandidat.aktuelle_graduierung || 'Keine'}
                          </span>
                        </div>
                      </td>
                      <td>
                        {graduierungenProStil[kandidat.stil_id] && graduierungenProStil[kandidat.stil_id].length > 0 ? (
                          <div className="pv-flex-row">
                            {(() => {
                              const key = `${kandidat.mitglied_id}-${kandidat.stil_id}`;
                              const selectedGradId = selectedGraduierungen[key] || kandidat.angestrebte_graduierung_id || kandidat.naechste_graduierung_id;
                              const selectedGrad = graduierungenProStil[kandidat.stil_id].find(g => g.graduierung_id === selectedGradId);

                              return (
                                <>
                                  <div
                                    className="pv3-gurt-dot-green"
                                    style={{ '--dot-color': selectedGrad?.farbe_hex || 'rgba(255, 255, 255, 0.1)' }}
                                    title={selectedGrad?.name || 'Keine Auswahl'}
                                  />
                                  <select
                                    value={selectedGradId || ''}
                                    onChange={async (e) => {
                                      const newGradId = parseInt(e.target.value);
                                      console.log('🎯 Graduierung geändert:', {
                                        kandidat: kandidat.vorname + ' ' + kandidat.nachname,
                                        newGradId,
                                        pruefung_id: kandidat.pruefung_id,
                                        bereits_zugelassen: kandidat.bereits_zugelassen
                                      });

                                      setSelectedGraduierungen({
                                        ...selectedGraduierungen,
                                        [key]: newGradId
                                      });

                                      // Wenn der Kandidat bereits zugelassen ist, sofort speichern
                                      if (kandidat.pruefung_id) {
                                        console.log('✅ Kandidat hat pruefung_id, speichere...', kandidat.pruefung_id);
                                        try {
                                          const response = await fetch(
                                            `${API_BASE_URL}/pruefungen/${kandidat.pruefung_id}/graduierung`,
                                            {
                                              method: 'PUT',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
                                              },
                                              body: JSON.stringify({ graduierung_nachher_id: newGradId })
                                            }
                                          );

                                          if (response.ok) {
                                            // Alle Listen aktualisieren
                                            fetchKandidaten();
                                            fetchZugelassenePruefungen();
                                            fetchPruefungstermine();
                                            setSuccess('Graduierung erfolgreich aktualisiert!');
                                            setTimeout(() => setSuccess(''), 2000);
                                          } else {
                                            const errorData = await response.json();
                                            setError(errorData.error || 'Fehler beim Speichern der Graduierung');
                                            setTimeout(() => setError(''), 3000);
                                          }
                                        } catch (error) {
                                          console.error('Fehler beim Speichern der Graduierung:', error);
                                          setError('Fehler beim Speichern der Graduierung');
                                          setTimeout(() => setError(''), 3000);
                                        }
                                      }
                                    }}
                                    className="pv3-grad-select-green"
                                    title="Wählen Sie die Ziel-Graduierung"
                                  >
                                    {graduierungenProStil[kandidat.stil_id]
                                      .filter(grad => grad.aktiv === 1)
                                      .sort((a, b) => a.reihenfolge - b.reihenfolge)
                                      .map((grad) => (
                                        <option key={grad.graduierung_id} value={grad.graduierung_id}>
                                          {grad.name}
                                          {grad.graduierung_id === kandidat.naechste_graduierung_id ? ' (Empfohlen)' : ''}
                                        </option>
                                      ))}
                                  </select>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="pv3-grad-row">
                            <div
                              className="pv3-gurt-dot-green"
                              style={{ '--dot-color': kandidat.naechste_farbe || 'rgba(255, 255, 255, 0.1)' }}
                              title={kandidat.naechste_graduierung}
                            />
                            <span className="pv3-grad-name-primary">
                              {kandidat.naechste_graduierung}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="pv3-stunden-col">
                          <div className="pv3-stunden-header">
                            <span
                              className={`pv3-stunden-count ${kandidat.absolvierte_stunden >= kandidat.benoetigte_stunden ? 'pv3-value--met' : 'pv3-value--not-met'}`}
                            >
                              {kandidat.absolvierte_stunden}
                            </span>
                            <span className="pv-muted-sm">
                              / {kandidat.benoetigte_stunden}
                            </span>
                          </div>
                          <div className="pv3-bar-wrap-gray-sm">
                            <div
                              className={`pv3-bar-fill${kandidat.fortschritt_prozent >= 100 ? ' pv3-bar-fill--good' : ' pv3-bar-fill--warn'}`}
                              style={{ width: `${Math.min(kandidat.fortschritt_prozent, 100)}%` }}
                            />
                          </div>
                          <span className="pv-muted-xs">
                            {kandidat.fortschritt_prozent}% erreicht
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={`pv3-monate-col ${kandidat.monate_seit_letzter_pruefung >= kandidat.benoetigte_monate ? 'pv3-value--met' : 'pv3-value--not-met'}`}>
                          {kandidat.monate_seit_letzter_pruefung} Mon.
                        </div>
                        <div className="pv-muted-sm">
                          von {kandidat.benoetigte_monate}
                        </div>
                      </td>
                      <td>
                        {kandidat.bereits_zugelassen ? (
                          <span className="badge badge-warning pv3-badge-flex">
                            <Check size={14} />
                            Zugelassen
                          </span>
                        ) : kandidat.berechtigt ? (
                          <span className="badge badge-success pv3-badge-flex">
                            <Check size={14} />
                            Berechtigt
                          </span>
                        ) : (
                          <span className="badge badge-neutral pv3-badge-flex">
                            <X size={14} />
                            Noch nicht
                          </span>
                        )}
                      </td>
                      <td className="pv2-text-center">
                        {!kandidat.bereits_zugelassen ? (
                          kandidat.berechtigt ? (
                            <button
                              onClick={() => openTerminAuswahl(kandidat)}
                              className="btn btn-sm btn-success pv3-btn-flex"
                            >
                              <Check size={16} />
                              Zulassen
                            </button>
                          ) : (
                            <button
                              onClick={() => openTerminAuswahl(kandidat, true)}
                              className="btn btn-sm btn-warning pv3-btn-flex"
                              title="Ausnahme-Zulassung für Kandidaten ohne zeitliche Voraussetzungen"
                            >
                              <Check size={16} />
                              Ausnahme
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => {
                              if (kandidat.pruefung_id) {
                                handleZulassungEntfernen({
                                  pruefung_id: kandidat.pruefung_id,
                                  mitglied_id: kandidat.mitglied_id,
                                  vorname: kandidat.vorname,
                                  nachname: kandidat.nachname
                                });
                              } else {
                                setError('Keine Prüfung-ID gefunden. Bitte aktualisieren Sie die Seite.');
                              }
                            }}
                            className="btn btn-sm btn-danger pv3-btn-flex"
                            title="Zulassung widerrufen"
                          >
                            <X size={16} />
                            Entfernen
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legende */}
          {kandidaten.length > 0 && (
            <div className="pv3-legende-bar">
              <div className="pv3-legende-row">
                <div className="pv-flex-row">
                  <div className="pv3-legende-line-green" />
                  <span className="pv-text-secondary">Berechtigt zur Prüfung</span>
                </div>
                <div className="pv-flex-row">
                  <div className="pv3-legende-line-gold" />
                  <span className="pv-text-secondary">Bereits zugelassen</span>
                </div>
                <div className="pv-flex-row">
                  <div className="pv3-legende-line-white" />
                  <span className="pv-text-secondary">Noch nicht berechtigt</span>
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Zugelassene Prüfungen Tab */}
      {activeTab === 'zugelassen' && (
        <div>
          <div className="pv2-mb-15">
            <div className="pv3-tab-section-header">
              <h2>Zugelassene Prüfungen ({zugelassenePruefungen.length})</h2>

              {/* Datum Filter */}
              <div className="btn-toggle-group">
                <button
                  onClick={() => setDatumFilter('alle')}
                  className={`btn-toggle ${datumFilter === 'alle' ? 'active' : ''}`}
                >
                  Alle
                </button>
                <button
                  onClick={() => setDatumFilter('zukuenftig')}
                  className={`btn-toggle ${datumFilter === 'zukuenftig' ? 'active' : ''}`}
                >
                  Zukünftig
                </button>
                <button
                  onClick={() => setDatumFilter('vergangen')}
                  className={`btn-toggle ${datumFilter === 'vergangen' ? 'active' : ''}`}
                >
                  Vergangen
                </button>
              </div>
            </div>

            {/* Stilfilter */}
            <div className="pv-flex-row">
              <span className="pv-secondary-bold">
                Stil:
              </span>
              <select
                value={zugelasseneStilFilter}
                onChange={(e) => setZugelasseneStilFilter(e.target.value)}
                className="pv3-dark-select"
              >
                <option value="all" className="pv2-dark-input">
                  Alle Stile
                </option>
                {stile.map(stil => (
                  <option
                    key={stil.stil_id}
                    value={stil.stil_id}
                    className="pv2-dark-input"
                  >
                    {stil.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="pv2-center-3rem">Lädt...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th
                      className="pv-warning-clickable"
                      onClick={() => handleSort('name')}
                    >
                      Name <SortIcon columnKey="name" />
                    </th>
                    <th
                      className="pv-warning-clickable"
                      onClick={() => handleSort('stil_name')}
                    >
                      Stil <SortIcon columnKey="stil_name" />
                    </th>
                    <th
                      className="pv-warning-clickable"
                      onClick={() => handleSort('graduierung_nachher_name')}
                    >
                      Angestrebt <SortIcon columnKey="graduierung_nachher_name" />
                    </th>
                    <th
                      className="pv-warning-clickable"
                      onClick={() => handleSort('pruefungsdatum')}
                    >
                      Prüfungsdatum <SortIcon columnKey="pruefungsdatum" />
                    </th>
                    <th className="pv-warning">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Sortierung und Filterung
                    const heute = new Date();
                    heute.setHours(0, 0, 0, 0);

                    let gefiltert = zugelassenePruefungen.filter(pruefung => {
                      // Stilfilter anwenden
                      if (zugelasseneStilFilter !== 'all' && pruefung.stil_id !== parseInt(zugelasseneStilFilter)) {
                        return false;
                      }

                      if (!pruefung.pruefungsdatum) return true; // Prüfungen ohne Datum immer anzeigen

                      const pruefungsDatum = new Date(pruefung.pruefungsdatum);
                      pruefungsDatum.setHours(0, 0, 0, 0);

                      if (datumFilter === 'zukuenftig') {
                        return pruefungsDatum >= heute;
                      } else if (datumFilter === 'vergangen') {
                        return pruefungsDatum < heute;
                      }
                      return true; // 'alle'
                    });

                    // Sortierung anwenden
                    if (sortConfig.key) {
                      gefiltert = applySorting(gefiltert, sortConfig.key, sortConfig.direction);
                    } else {
                      // Standard-Sortierung: Zukünftige zuerst (aufsteigend), dann vergangene (absteigend)
                      gefiltert.sort((a, b) => {
                        if (!a.pruefungsdatum && !b.pruefungsdatum) return 0;
                        if (!a.pruefungsdatum) return 1;
                        if (!b.pruefungsdatum) return -1;

                        const dateA = new Date(a.pruefungsdatum);
                        const dateB = new Date(b.pruefungsdatum);
                        dateA.setHours(0, 0, 0, 0);
                        dateB.setHours(0, 0, 0, 0);

                        const isAFuture = dateA >= heute;
                        const isBFuture = dateB >= heute;

                        // Wenn beide zukünftig: aufsteigend (nächste zuerst)
                        if (isAFuture && isBFuture) {
                          return dateA - dateB;
                        }
                        // Wenn beide vergangen: absteigend (neueste zuerst)
                        if (!isAFuture && !isBFuture) {
                          return dateB - dateA;
                        }
                        // Zukünftige vor vergangenen
                        return isAFuture ? -1 : 1;
                      });
                    }

                    return gefiltert.map(pruefung => (
                    <tr key={pruefung.pruefung_id}>
                      <td><strong>{pruefung.vorname} {pruefung.nachname}</strong></td>
                      <td>
                        <span className="pv3-stil-badge-sm">
                          {pruefung.stil_name}
                        </span>
                      </td>
                      <td>
                        <div className="pv3-grad-row">
                          <div
                            className="pv3-gurt-dot-sm"
                            style={{ '--dot-color': pruefung.farbe_nachher || 'rgba(255, 255, 255, 0.1)' }}
                            title={pruefung.graduierung_nachher}
                          />
                          <span className="pv3-grad-name-primary">
                            {pruefung.graduierung_nachher}
                          </span>
                        </div>
                      </td>
                      <td>
                        {pruefung.pruefungsdatum
                          ? new Date(pruefung.pruefungsdatum).toLocaleDateString('de-DE')
                          : 'Nicht festgelegt'}
                      </td>
                      <td>
                        <div className="u-flex-wrap-gap">
                          <button
                            onClick={async () => {
                              if (!pruefung.stil_id) {
                                setError('Stil-ID fehlt für diese Prüfung');
                                return;
                              }

                              setSelectedPruefung(pruefung);
                              // Graduierungen für diesen Stil laden
                              const grads = await loadGraduierungenFuerModal(pruefung.stil_id);

                              // Finde Index der aktuellen Ziel-Graduierung
                              const currentIndex = grads.findIndex(g => g.graduierung_id === pruefung.graduierung_nachher_id);
                              const targetGrad = grads[currentIndex] || grads[0];

                              // Setze initialen State
                              setPruefungsErgebnis({
                                bestanden: false,
                                punktzahl: '',
                                max_punktzahl: '100',
                                prueferkommentar: '',
                                graduierung_nachher_index: currentIndex >= 0 ? currentIndex : 0,
                                graduierung_nachher_id: targetGrad?.graduierung_id || null,
                                graduierung_nachher_name: targetGrad?.name || '',
                                graduierung_nachher_farbe: targetGrad?.farbe_hex || ''
                              });

                              setShowErgebnisModal(true);
                            }}
                            className="btn btn-sm btn-primary"
                          >
                            📝 Ergebnis eintragen
                          </button>
                          <button
                            onClick={() => handleZulassungEntfernen(pruefung)}
                            className="btn btn-sm btn-danger pv3-badge-flex"
                          >
                            <X size={16} />
                            Entfernen
                          </button>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Abgeschlossene Prüfungen Tab */}
      {activeTab === 'abgeschlossen' && (
        <div>
          <div className="pv2-mb-15">
            <h2 className="pv2-mb-1">Abgeschlossene Prüfungen ({abgeschlossenePruefungen.length})</h2>

            {/* Stilfilter */}
            <div className="pv-flex-row">
              <span className="pv-secondary-bold">
                Stil:
              </span>
              <select
                value={abgeschlosseneStilFilter}
                onChange={(e) => setAbgeschlosseneStilFilter(e.target.value)}
                className="pv3-dark-select"
              >
                <option value="all" className="pv2-dark-input">
                  Alle Stile
                </option>
                {stile.map(stil => (
                  <option
                    key={stil.stil_id}
                    value={stil.stil_id}
                    className="pv2-dark-input"
                  >
                    {stil.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="pv2-center-3rem">Lädt...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th
                      className="pv-warning-clickable"
                      onClick={() => handleSort('name')}
                    >
                      Name <SortIcon columnKey="name" />
                    </th>
                    <th
                      className="pv-warning-clickable"
                      onClick={() => handleSort('stil_name')}
                    >
                      Stil <SortIcon columnKey="stil_name" />
                    </th>
                    <th
                      className="pv-warning-clickable"
                      onClick={() => handleSort('graduierung_nachher')}
                    >
                      Graduierung <SortIcon columnKey="graduierung_nachher" />
                    </th>
                    <th
                      className="pv-warning-clickable"
                      onClick={() => handleSort('pruefungsdatum')}
                    >
                      Datum <SortIcon columnKey="pruefungsdatum" />
                    </th>
                    <th
                      className="pv-warning-clickable"
                      onClick={() => handleSort('bestanden')}
                    >
                      Ergebnis <SortIcon columnKey="bestanden" />
                    </th>
                    <th className="pv-warning">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Stilfilter anwenden
                    let gefiltert = abgeschlossenePruefungen;

                    if (abgeschlosseneStilFilter !== 'all') {
                      gefiltert = gefiltert.filter(p => p.stil_id === parseInt(abgeschlosseneStilFilter));
                    }

                    // Sortierung anwenden
                    if (sortConfig.key) {
                      gefiltert = applySorting(gefiltert, sortConfig.key, sortConfig.direction);
                    }

                    return gefiltert.map(pruefung => (
                    <tr key={pruefung.pruefung_id}>
                      <td><strong>{pruefung.vorname} {pruefung.nachname}</strong></td>
                      <td>
                        <span className="pv3-stil-badge-sm">
                          {pruefung.stil_name}
                        </span>
                      </td>
                      <td>
                        <div className="pv3-grad-row">
                          <div
                            className="pv3-gurt-dot-sm"
                            style={{ '--dot-color': pruefung.farbe_nachher || 'rgba(255, 255, 255, 0.1)' }}
                            title={pruefung.graduierung_nachher}
                          />
                          <span className="pv3-grad-name">
                            {pruefung.graduierung_nachher}
                          </span>
                        </div>
                      </td>
                      <td>{new Date(pruefung.pruefungsdatum).toLocaleDateString('de-DE')}</td>
                      <td>
                        <div>
                          {pruefung.bestanden ? (
                            <span className="badge badge-success">
                              ✓ Bestanden
                            </span>
                          ) : (
                            <span className="badge badge-danger">
                              ✗ Nicht bestanden
                            </span>
                          )}
                          {pruefung.punktzahl && (
                            <div className="pv3-punktzahl-note">
                              {pruefung.punktzahl} / {pruefung.max_punktzahl} Pkt.
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="u-flex-wrap-gap">
                          <button className="btn btn-sm btn-secondary">
                            <Download size={16} /> Urkunde
                          </button>
                          <button
                            onClick={() => handleStatusAendern(pruefung)}
                            className="btn btn-sm btn-warning pv3-badge-flex"
                          >
                            <Edit size={16} />
                            Status ändern
                          </button>
                        </div>
                      </td>
                    </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Statistiken Tab */}
      {activeTab === 'statistiken' && statistiken && (
        <div>
          <h2 className="pv3-stat-h2">Prüfungsstatistiken</h2>
          <div className="pv3-stat-grid">
            <div className="stat-card pv2-p-075">
              <h3 className="pv-meta-sm">Gesamt</h3>
              <div className="pv2-stat-purple">
                {statistiken.gesamt.gesamt}
              </div>
              <div className="pv-muted-xxs">Prüfungen</div>
            </div>
            <div className="stat-card pv2-p-075">
              <h3 className="pv-meta-sm">Bestanden</h3>
              <div className="pv2-stat-success">
                {statistiken.gesamt.bestanden}
              </div>
              <div className="pv-muted-xxs">
                {statistiken.gesamt.gesamt > 0
                  ? `${Math.round((statistiken.gesamt.bestanden / statistiken.gesamt.gesamt) * 100)}% Quote`
                  : '0% Quote'}
              </div>
            </div>
            <div className="stat-card pv2-p-075">
              <h3 className="pv-meta-sm">Nicht bestanden</h3>
              <div className="pv3-stat-error">
                {statistiken.gesamt.nicht_bestanden}
              </div>
              <div className="pv-muted-xxs">
                {statistiken.gesamt.gesamt > 0
                  ? `${Math.round((statistiken.gesamt.nicht_bestanden / statistiken.gesamt.gesamt) * 100)}%`
                  : '0%'}
              </div>
            </div>
            <div className="stat-card pv2-p-075">
              <h3 className="pv-meta-sm">Geplant</h3>
              <div className="pv3-stat-warning">
                {statistiken.gesamt.geplant}
              </div>
              <div className="pv-muted-xxs">Anstehend</div>
            </div>
            <div className="stat-card pv2-p-075">
              <h3 className="pv-meta-sm">Kandidaten</h3>
              <div className="pv3-stat-info">
                {kandidaten.length}
              </div>
              <div className="pv-muted-xxs">
                {kandidaten.filter(k => k.berechtigt).length} berechtigt
              </div>
            </div>
            <div className="stat-card pv2-p-075">
              <h3 className="pv-meta-sm">Ø Punktzahl</h3>
              <div className="pv2-stat-purple">
                {(() => {
                  const bestandenePruefungen = abgeschlossenePruefungen.filter(p => p.bestanden && p.punktzahl && p.max_punktzahl);
                  const avgPunktzahl = bestandenePruefungen.length > 0
                    ? bestandenePruefungen.reduce((sum, p) => sum + ((p.punktzahl / p.max_punktzahl) * 100), 0) / bestandenePruefungen.length
                    : 0;
                  return avgPunktzahl.toFixed(0);
                })()}%
              </div>
              <div className="pv-muted-xxs">Bestanden</div>
            </div>
            <div className="stat-card pv2-p-075">
              <h3 className="pv-meta-sm">Ø Training</h3>
              <div className="pv2-stat-success">
                {(() => {
                  const avgTrainingsstunden = kandidaten.length > 0
                    ? kandidaten.reduce((sum, k) => sum + (k.trainingsstunden || 0), 0) / kandidaten.length
                    : 0;
                  return avgTrainingsstunden.toFixed(0);
                })()}h
              </div>
              <div className="pv-muted-xxs">Kandidaten</div>
            </div>
            <div className="stat-card pv2-p-075">
              <h3 className="pv-meta-sm">Ø Monate</h3>
              <div className="pv3-stat-cyan">
                {(() => {
                  const avgMonate = kandidaten.length > 0
                    ? kandidaten.reduce((sum, k) => sum + (k.monate_seit_letzter || 0), 0) / kandidaten.length
                    : 0;
                  return avgMonate.toFixed(0);
                })()}
              </div>
              <div className="pv-muted-xxs">Seit letzter</div>
            </div>
          </div>

          <h3>Nach Stil</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pv-warning">Stil</th>
                  <th className="pv-warning">Anzahl Prüfungen</th>
                  <th className="pv-warning">Bestanden</th>
                  <th className="pv-warning">Erfolgsquote</th>
                </tr>
              </thead>
              <tbody>
                {statistiken.nach_stil.map((stat, index) => (
                  <tr key={index}>
                    <td><strong>{stat.stil_name}</strong></td>
                    <td>{stat.anzahl}</td>
                    <td>{stat.bestanden}</td>
                    <td>
                      <div className="pv-flex-row">
                        <div className="pv3-bar-wrap-gray">
                          <div
                            className="pv3-bar-fill-green"
                            style={{ width: `${(stat.bestanden / stat.anzahl) * 100}%` }}
                          />
                        </div>
                        <span className="pv3-bar-percent">
                          {Math.round((stat.bestanden / stat.anzahl) * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Zusätzliche Statistiken */}
          <div className="pv2-mt-2">
            <h3 className="pv2-mb-1">Prüfungen nach Graduierung</h3>
            <div className="pv3-grad-grid">
              {(() => {
                // Gruppiere abgeschlossene Prüfungen nach Graduierung
                const graduierungStats = {};
                abgeschlossenePruefungen.forEach(p => {
                  const grad = p.graduierung_nachher || 'Unbekannt';
                  if (!graduierungStats[grad]) {
                    graduierungStats[grad] = { gesamt: 0, bestanden: 0, farbe: p.farbe_nachher };
                  }
                  graduierungStats[grad].gesamt++;
                  if (p.bestanden) graduierungStats[grad].bestanden++;
                });

                return Object.entries(graduierungStats)
                  .sort((a, b) => b[1].gesamt - a[1].gesamt)
                  .slice(0, 6)
                  .map(([grad, stats]) => (
                    <div key={grad} className="stat-card pv2-p-1">
                      <div className="pv3-grad-card-header">
                        <div
                          className="pv3-grad-dot-sm"
                          style={{ '--dot-color': stats.farbe || 'rgba(255, 255, 255, 0.1)' }}
                        />
                        <h4 className="pv3-grad-card-name">{grad}</h4>
                      </div>
                      <div className="pv3-grad-card-count">
                        {stats.gesamt}
                      </div>
                      <div className="pv2-fs-075-secondary">
                        {stats.bestanden} bestanden ({Math.round((stats.bestanden / stats.gesamt) * 100)}%)
                      </div>
                    </div>
                  ));
              })()}
            </div>
          </div>

          {/* Gurtverteilung */}
          {statistiken.gurtverteilung && statistiken.gurtverteilung.length > 0 && (
            <div className="pv2-mt-2">
              <h3 className="pv2-mb-1">Aktuelle Gurtverteilung</h3>
              <div className="pv3-gurt-grid">
                {statistiken.gurtverteilung.map((gurt, index) => (
                  <div key={index} className="stat-card pv2-p-1">
                    <div className="pv3-gurt-card-header">
                      {/* Gürtel-Darstellung horizontal mit abgerundeten Enden wie im Bild */}
                      <div
                        className="pv3-belt-display"
                        style={{ '--dot-color': gurt.farbe || '#CCCCCC' }}
                      />
                      <div className="pv-flex-col-xs">
                        <h4 className="pv3-gurt-card-name">{gurt.graduierung_name}</h4>
                        <span className="pv-muted-sm">{gurt.stil_name}</span>
                      </div>
                    </div>
                    <div className="pv3-gurt-card-count">
                      {gurt.anzahl}
                    </div>
                    <div className="pv2-fs-075-secondary">
                      {gurt.anzahl === 1 ? 'Mitglied' : 'Mitglieder'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monatliche Entwicklung */}
          <div className="pv2-mt-2">
            <h3 className="pv2-mb-1">Prüfungen der letzten 12 Monate</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pv-warning">Monat</th>
                    <th className="pv-warning">Gesamt</th>
                    <th className="pv-warning">Bestanden</th>
                    <th className="pv-warning">Nicht bestanden</th>
                    <th className="pv-warning">Erfolgsquote</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Gruppiere Prüfungen nach Monat
                    const monthlyStats = {};
                    const now = new Date();

                    // Initialisiere die letzten 12 Monate
                    for (let i = 11; i >= 0; i--) {
                      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      monthlyStats[key] = {
                        monat: date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
                        gesamt: 0,
                        bestanden: 0,
                        nichtBestanden: 0
                      };
                    }

                    // Zähle Prüfungen
                    abgeschlossenePruefungen.forEach(p => {
                      if (p.pruefungsdatum) {
                        const date = new Date(p.pruefungsdatum);
                        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        if (monthlyStats[key]) {
                          monthlyStats[key].gesamt++;
                          if (p.bestanden) {
                            monthlyStats[key].bestanden++;
                          } else {
                            monthlyStats[key].nichtBestanden++;
                          }
                        }
                      }
                    });

                    return Object.values(monthlyStats).map((stat, index) => (
                      <tr key={index}>
                        <td><strong>{stat.monat}</strong></td>
                        <td>{stat.gesamt}</td>
                        <td className="u-text-success">{stat.bestanden}</td>
                        <td className="u-text-error">{stat.nichtBestanden}</td>
                        <td>
                          {stat.gesamt > 0 ? (
                            <div className="pv-flex-row">
                              <div className="pv3-bar-wrap-gray-sm">
                                <div
                                  className="pv3-bar-fill-green"
                                  style={{ width: `${(stat.bestanden / stat.gesamt) * 100}%` }}
                                />
                              </div>
                              <span className="pv3-bar-percent-sm">
                                {Math.round((stat.bestanden / stat.gesamt) * 100)}%
                              </span>
                            </div>
                          ) : (
                            <span className="pv-text-muted">-</span>
                          )}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Performer & Prüfungs-Insights */}
          <div className="pv2-mt-2">
            <h3 className="pv2-mb-1">Prüfungs-Insights</h3>
            <div className="pv3-insights-grid">
              {/* Beste Erfolgsquote nach Stil */}
              <div className="stat-card">
                <h4 className="pv2-warning-label">🏆 Beste Erfolgsquote</h4>
                {(() => {
                  const bestStil = statistiken.nach_stil.length > 0
                    ? statistiken.nach_stil.reduce((best, current) => {
                        const currentRate = current.bestanden / current.anzahl;
                        const bestRate = best.bestanden / best.anzahl;
                        return currentRate > bestRate ? current : best;
                      })
                    : null;

                  return bestStil ? (
                    <>
                      <div className="pv2-heading-primary">
                        {bestStil.stil_name}
                      </div>
                      <div className="pv3-insight-success">
                        {Math.round((bestStil.bestanden / bestStil.anzahl) * 100)}%
                      </div>
                      <div className="pv2-muted-mt">
                        {bestStil.bestanden} von {bestStil.anzahl} Prüfungen bestanden
                      </div>
                    </>
                  ) : (
                    <div className="pv-text-muted">Keine Daten vorhanden</div>
                  );
                })()}
              </div>

              {/* Aktivster Monat */}
              <div className="stat-card">
                <h4 className="pv2-warning-label">📊 Aktivster Monat</h4>
                {(() => {
                  const monthlyCount = {};
                  abgeschlossenePruefungen.forEach(p => {
                    if (p.pruefungsdatum) {
                      const date = new Date(p.pruefungsdatum);
                      const monthKey = date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
                      monthlyCount[monthKey] = (monthlyCount[monthKey] || 0) + 1;
                    }
                  });

                  const aktivsterMonat = Object.entries(monthlyCount).sort((a, b) => b[1] - a[1])[0];

                  return aktivsterMonat ? (
                    <>
                      <div className="pv2-heading-primary">
                        {aktivsterMonat[0]}
                      </div>
                      <div className="pv3-insight-purple">
                        {aktivsterMonat[1]}
                      </div>
                      <div className="pv2-muted-mt">
                        Prüfungen durchgeführt
                      </div>
                    </>
                  ) : (
                    <div className="pv-text-muted">Keine Daten vorhanden</div>
                  );
                })()}
              </div>

              {/* Nächste geplante Prüfung */}
              <div className="stat-card">
                <h4 className="pv2-warning-label">📅 Nächste Prüfung</h4>
                {(() => {
                  const heute = new Date();
                  heute.setHours(0, 0, 0, 0);

                  // Filter geplante Prüfungen in der Zukunft
                  const zukunftspr = zugelassenePruefungen.filter(p => {
                    if (!p.pruefungsdatum) return false;
                    const pDate = new Date(p.pruefungsdatum);
                    pDate.setHours(0, 0, 0, 0);
                    return pDate >= heute;
                  });

                  if (zukunftspr.length === 0) {
                    return <div className="pv-text-muted">Keine geplanten Prüfungen</div>;
                  }

                  // Gruppiere nach Datum und Stil
                  const gruppiertePruefungen = {};
                  zukunftspr.forEach(p => {
                    const key = `${p.pruefungsdatum}_${p.stil_name || 'Unbekannt'}`;
                    if (!gruppiertePruefungen[key]) {
                      gruppiertePruefungen[key] = {
                        datum: p.pruefungsdatum,
                        stil: p.stil_name || 'Unbekannt',
                        anzahl: 0
                      };
                    }
                    gruppiertePruefungen[key].anzahl++;
                  });

                  // Sortiere nach Datum und nimm die nächste
                  const naechste = Object.values(gruppiertePruefungen)
                    .sort((a, b) => new Date(a.datum) - new Date(b.datum))[0];

                  return (
                    <>
                      <div className="pv2-heading-primary">
                        {new Date(naechste.datum).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="pv3-insight-next-stil">
                        {naechste.stil}
                      </div>
                      <div className="pv2-muted-mt">
                        {naechste.anzahl} Teilnehmer
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ergebnis Modal */}
      {showErgebnisModal && selectedPruefung && (
        <div className="modal-overlay" onClick={() => setShowErgebnisModal(false)}>
          <div className="modal-content pv3-modal-max600" onClick={(e) => e.stopPropagation()}>
            <h2>Prüfungsergebnis eintragen</h2>
            <p className="pv3-modal-muted">
              <strong className="u-text-primary">{selectedPruefung.vorname} {selectedPruefung.nachname}</strong> - {selectedPruefung.stil_name}
            </p>

            {/* Bestanden Checkbox mit visueller Hervorhebung */}
            <div className="form-group pv2-mb-15">
              <label className={`pv3-ergebnis-label-box ${pruefungsErgebnis.bestanden ? 'pv3-ergebnis-label-box--bestanden' : 'pv3-ergebnis-label-box--failed'}`}>
                <input
                  type="checkbox"
                  checked={pruefungsErgebnis.bestanden}
                  onChange={(e) => setPruefungsErgebnis({ ...pruefungsErgebnis, bestanden: e.target.checked })}
                  className="pv3-checkbox-gold"
                />
                <div className="u-flex-1">
                  <strong className={`pv3-ergebnis-strong ${pruefungsErgebnis.bestanden ? 'pv3-ergebnis-strong--bestanden' : 'pv3-ergebnis-strong--failed'}`}>
                    {pruefungsErgebnis.bestanden ? '✓ Prüfung bestanden' : '✗ Prüfung nicht bestanden'}
                  </strong>
                </div>
              </label>
            </div>

            {/* Punktzahl */}
            <div className="u-grid-2col">
              <div className="form-group">
                <label>Erreichte Punktzahl</label>
                <input
                  type="number"
                  step="0.5"
                  value={pruefungsErgebnis.punktzahl}
                  onChange={(e) => setPruefungsErgebnis({ ...pruefungsErgebnis, punktzahl: e.target.value })}
                  className="form-input"
                  placeholder="0"
                />
              </div>
              <div className="form-group">
                <label>Max. Punktzahl</label>
                <input
                  type="number"
                  step="0.5"
                  value={pruefungsErgebnis.max_punktzahl}
                  onChange={(e) => setPruefungsErgebnis({ ...pruefungsErgebnis, max_punktzahl: e.target.value })}
                  className="form-input"
                  placeholder="100"
                />
              </div>
            </div>

            {/* Gurt-Auswahl mit Pfeil-Buttons */}
            <div className="form-group pv2-mb-15">
              <label className="pv3-ergebnis-label">
                Gurt nach Prüfung
                <span className="pv3-ergebnis-label-hint">
                  (↑↓ Pfeiltasten zum Navigieren)
                </span>
              </label>
              <div className="pv3-gurt-picker-box">
                {/* Pfeil nach unten */}
                <button
                  type="button"
                  onClick={() => handleGraduierungAendern('down')}
                  className="btn btn-sm btn-secondary pv3-gurt-arrow-btn"
                  disabled={pruefungsErgebnis.graduierung_nachher_index === 0}
                >
                  <ChevronDown size={20} />
                </button>

                {/* Gurt-Anzeige */}
                <div className="pv3-gurt-display-box">
                  <div
                    className="pv3-gurt-big-dot"
                    style={{ '--dot-color': pruefungsErgebnis.graduierung_nachher_farbe || '#e5e7eb' }}
                  >
                    <div className="pv3-gurt-shine" />
                  </div>
                  <div className="u-flex-1">
                    <div className="pv3-gurt-name">
                      {pruefungsErgebnis.graduierung_nachher_name || 'Keine Auswahl'}
                    </div>
                    <div className="pv-muted-sm">
                      {graduierungenFuerModal.length > 0
                        ? `Graduierung ${pruefungsErgebnis.graduierung_nachher_index + 1} von ${graduierungenFuerModal.length}`
                        : 'Keine Graduierungen verfügbar'}
                    </div>
                  </div>
                </div>

                {/* Pfeil nach oben */}
                <button
                  type="button"
                  onClick={() => handleGraduierungAendern('up')}
                  className="btn btn-sm btn-secondary pv3-gurt-arrow-btn"
                  disabled={pruefungsErgebnis.graduierung_nachher_index === graduierungenFuerModal.length - 1}
                >
                  <ChevronUp size={20} />
                </button>
              </div>
            </div>

            {/* Prüfer-Kommentar */}
            <div className="form-group pv2-mb-15">
              <label>Prüfer-Kommentar</label>
              <textarea
                value={pruefungsErgebnis.prueferkommentar}
                onChange={(e) => setPruefungsErgebnis({ ...pruefungsErgebnis, prueferkommentar: e.target.value })}
                className="form-input"
                rows="3"
                placeholder="Bemerkungen zur Prüfung, Stärken, Verbesserungspotenzial..."
              />
            </div>

            {/* Keyboard Shortcuts Hinweis */}
            <div className="pv3-shortcut-box">
              <div className="pv3-shortcut-title">
                <strong>⌨️ Tastenkombinationen:</strong>
              </div>
              <div className="pv3-shortcut-text">
                ↑↓ Pfeiltasten = Gurt wechseln • Strg+Enter = Speichern
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowErgebnisModal(false)} className="btn btn-secondary">
                Abbrechen
              </button>
              <button onClick={handleErgebnisEintragen} className="btn btn-primary">
                <Check size={18} className="pv2-mr-05" />
                Speichern (Strg+Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch-Ergebnis Modal */}
      {showBatchErgebnisModal && batchTermin && (
        <div className="modal-overlay" onClick={() => setShowBatchErgebnisModal(false)}>
          <div
            className="modal-content pv3-batch-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="pv2-mb-05">Pruefungsergebnisse eintragen</h2>
            <p className="pv3-batch-muted-p">
              <strong className="u-text-primary">
                {new Date(batchTermin.datum).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </strong>
              {' - '}
              <span className="pv-warning">{batchTermin.stil_name}</span>
              {' - '}
              {batchTermin.anzahl} Teilnehmer
            </p>

            {/* Schnellauswahl */}
            <div className="pv3-batch-schnell-bar">
              <span className="pv3-batch-schnell-label">Schnellauswahl:</span>
              <button
                onClick={() => setBatchAlleBestanden(true)}
                className="btn btn-sm pv3-btn-batch-success"
              >
                <Check size={14} className="pv2-mr-025" />
                Alle bestanden
              </button>
              <button
                onClick={() => setBatchAlleBestanden(false)}
                className="btn btn-sm pv3-btn-batch-error"
              >
                <X size={14} className="pv2-mr-025" />
                Alle nicht bestanden
              </button>
            </div>

            {/* Teilnehmer-Liste */}
            <div className="table-container">
              <table className="data-table pv2-fs-0875">
                <thead>
                  <tr>
                    <th className="pv3-batch-th-200">Name</th>
                    <th className="pv3-batch-th-120">Aktueller Gurt</th>
                    <th className="pv3-batch-th-120">Neuer Gurt</th>
                    <th className="pv3-batch-th-130-center">Ergebnis</th>
                    <th className="pv3-batch-th-100">Punkte</th>
                    <th className="pv3-batch-th-180">Kommentar</th>
                  </tr>
                </thead>
                <tbody>
                  {batchTermin.pruefungen.map((pruefung) => {
                    const ergebnis = batchErgebnisse[pruefung.pruefung_id] || { bestanden: true, punktzahl: '', prueferkommentar: '' };
                    return (
                      <tr key={pruefung.pruefung_id} className={ergebnis.bestanden ? 'pv3-batch-row--bestanden' : 'pv3-batch-row--failed'}>
                        <td>
                          <div className="pv-flex-col-xs">
                            <span className="pv2-fw700-primary">
                              {pruefung.vorname} {pruefung.nachname}
                            </span>
                            <span className="pv-muted-sm">
                              ID: {pruefung.mitglied_id}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="pv-flex-row">
                            <div
                              className="pv3-batch-gurt-sm"
                              style={{ '--dot-color': pruefung.farbe_vorher || '#6b7280' }}
                            />
                            <span className="pv3-batch-gurt-text">
                              {pruefung.graduierung_vorher || 'Keine'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="pv-flex-row">
                            <div
                              className={`pv3-batch-gurt-sm ${!ergebnis.bestanden ? 'pv3-batch-gurt-sm--failed' : ''}`}
                              style={{ '--dot-color': ergebnis.bestanden ? (pruefung.farbe_nachher || '#EAB308') : '#6b7280' }}
                            />
                            <span className={ergebnis.bestanden ? 'pv3-batch-grad-text--bestanden' : 'pv3-batch-grad-text--failed'}>
                              {pruefung.graduierung_nachher}
                            </span>
                          </div>
                        </td>
                        <td className="pv2-text-center">
                          <label className={`pv3-batch-ergebnis-label ${ergebnis.bestanden ? 'pv3-ergebnis-label-box--bestanden' : 'pv3-ergebnis-label-box--failed'}`}>
                            <input
                              type="checkbox"
                              checked={ergebnis.bestanden}
                              onChange={(e) => {
                                setBatchErgebnisse({
                                  ...batchErgebnisse,
                                  [pruefung.pruefung_id]: {
                                    ...ergebnis,
                                    bestanden: e.target.checked
                                  }
                                });
                              }}
                              className="pv3-batch-checkbox"
                            />
                            <span className={`pv3-batch-ergebnis-text ${ergebnis.bestanden ? 'pv3-ergebnis-strong--bestanden' : 'pv3-ergebnis-strong--failed'}`}>
                              {ergebnis.bestanden ? 'Bestanden' : 'Nicht bestanden'}
                            </span>
                          </label>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.5"
                            value={ergebnis.punktzahl}
                            onChange={(e) => {
                              setBatchErgebnisse({
                                ...batchErgebnisse,
                                [pruefung.pruefung_id]: {
                                  ...ergebnis,
                                  punktzahl: e.target.value
                                }
                              });
                            }}
                            className="pv2-input-sm"
                            placeholder="Punkte"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={ergebnis.prueferkommentar}
                            onChange={(e) => {
                              setBatchErgebnisse({
                                ...batchErgebnisse,
                                [pruefung.pruefung_id]: {
                                  ...ergebnis,
                                  prueferkommentar: e.target.value
                                }
                              });
                            }}
                            className="pv2-input-sm"
                            placeholder="Kommentar..."
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Zusammenfassung */}
            <div className="pv3-batch-summary">
              <div className="pv3-batch-summary-counts">
                <div>
                  <span className="pv3-batch-count-success">
                    {Object.values(batchErgebnisse).filter(e => e.bestanden).length}
                  </span>
                  <span className="pv3-batch-muted-ml">Bestanden</span>
                </div>
                <div>
                  <span className="pv3-batch-count-error">
                    {Object.values(batchErgebnisse).filter(e => !e.bestanden).length}
                  </span>
                  <span className="pv3-batch-muted-ml">Nicht bestanden</span>
                </div>
              </div>
              <div className="pv-muted-sm-row">
                Bestehensquote: {Math.round((Object.values(batchErgebnisse).filter(e => e.bestanden).length / Object.values(batchErgebnisse).length) * 100)}%
              </div>
            </div>

            <div className="modal-actions pv2-mt-15">
              <button onClick={() => setShowBatchErgebnisModal(false)} className="btn btn-secondary">
                Abbrechen
              </button>
              <button
                onClick={handleBatchErgebnisSpeichern}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>Speichern...</>
                ) : (
                  <>
                    <Check size={18} className="pv2-mr-05" />
                    Alle Ergebnisse speichern
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Neuer Termin Modal - CACHE BREAK v8.0 GOLDEN HEADER */}
      {showNeuerTerminModal && (
        <div
          className="pv3-modal-overlay-dark"
          onClick={() => { setShowNeuerTerminModal(false); setTerminStep(1); }}
        >
          <div
            className="pv3-modal-dark"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="pv3-modal-header">
              <h2>
                Neuer Prüfungstermin
              </h2>
            </div>

            {/* Progress Bar */}
            <div className="pv3-modal-progress-section">
              {[
                { num: 1, label: 'Grunddaten' },
                { num: 2, label: 'Organisation' },
                { num: 3, label: 'Zusatzinfos' }
              ].map((step, idx) => (
                <div key={step.num} className="pv3-modal-step-wrapper">
                  {/* Connecting Line */}
                  {idx > 0 && (
                    <div className={`pv3-step-connector ${terminStep > step.num - 1 ? 'pv3-step-connector--active' : ''}`} />
                  )}

                  {/* Circle */}
                  <div className={`pv3-step-circle ${terminStep >= step.num ? 'pv3-step-circle--active' : ''}`}>
                    {step.num}
                  </div>

                  {/* Label */}
                  <div className={`pv3-step-label ${terminStep === step.num ? 'pv3-step-label--active' : ''}`}>
                    {step.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="pv3-modal-content-area">
              {/* Step 1: Grunddaten */}
              {terminStep === 1 && (
                <div>
                  <div className="pv2-mb-1">
                    <label className="pv-form-label">
                      Kampfkunst-Stil *
                    </label>
                    <select
                      value={neuerTermin.stil_id}
                      onChange={(e) => setNeuerTermin({ ...neuerTermin, stil_id: e.target.value })}
                      className="pv3-dark-input"
                    >
                      <option value="">Bitte wählen...</option>
                      {stile.map(stil => (
                        <option key={stil.stil_id} value={stil.stil_id}>{stil.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="u-grid-2col">
                    <div>
                      <label className="pv-form-label">
                        Prüfungsdatum *
                      </label>
                      <input
                        type="date"
                        value={neuerTermin.pruefungsdatum}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefungsdatum: e.target.value })}
                        className="pv3-dark-input"
                      />
                    </div>
                    <div>
                      <label className="pv-form-label">
                        Uhrzeit
                      </label>
                      <input
                        type="time"
                        value={neuerTermin.pruefungszeit}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefungszeit: e.target.value })}
                        className="pv3-dark-input"
                      />
                    </div>
                  </div>

                  <div className="pv2-grid-2col-1">
                    <div>
                      <label className="pv-form-label">
                        Prüfungsort
                      </label>
                      <input
                        type="text"
                        value={neuerTermin.pruefungsort}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefungsort: e.target.value })}
                        placeholder="z.B. Dojo Haupthalle"
                        className="pv3-dark-input"
                      />
                    </div>
                    <div>
                      <label className="pv-form-label">
                        Prüfer
                      </label>
                      <input
                        type="text"
                        value={neuerTermin.pruefer_name}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefer_name: e.target.value })}
                        placeholder="z.B. Meister Schmidt"
                        className="pv3-dark-input"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Organisation */}
              {terminStep === 2 && (
                <div>
                  <div className="pv2-grid-2col-1">
                    <div>
                      <label className="pv-form-label">
                        Prüfungsgebühr (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={neuerTermin.pruefungsgebuehr}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefungsgebuehr: e.target.value })}
                        placeholder="0.00"
                        className="pv3-dark-input"
                      />
                    </div>
                    <div>
                      <label className="pv-form-label">
                        Anmeldefrist
                      </label>
                      <input
                        type="date"
                        value={neuerTermin.anmeldefrist}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, anmeldefrist: e.target.value })}
                        className="pv3-dark-input"
                      />
                    </div>
                  </div>
                  {/* Validierungshinweis */}
                  {neuerTermin.anmeldefrist && neuerTermin.pruefungsdatum &&
                   new Date(neuerTermin.anmeldefrist) > new Date(neuerTermin.pruefungsdatum) && (
                    <div className="pv3-validation-error">
                      <span>⚠️</span>
                      <span>Die Anmeldefrist muss vor dem Prüfungsdatum liegen. Bitte passen Sie das Datum an.</span>
                    </div>
                  )}

                  {/* Öffentlich veröffentlichen */}
                  <div className="pv3-oeffentlich-row">
                    <input
                      type="checkbox"
                      id="neuerTermin_oeffentlich"
                      checked={neuerTermin.oeffentlich}
                      onChange={(e) => setNeuerTermin({ ...neuerTermin, oeffentlich: e.target.checked })}
                      className="pv2-checkbox"
                    />
                    <label htmlFor="neuerTermin_oeffentlich" className="pv3-oeffentlich-label">
                      🌐 Auf tda-intl.com veröffentlichen
                    </label>
                  </div>
                </div>
              )}

              {/* Step 3: Zusatzinfos */}
              {terminStep === 3 && (
                <div className="pv3-step3-grid">
                  <div>
                    <label className="pv-form-label">
                      Bemerkungen
                    </label>
                    <textarea
                      value={neuerTermin.bemerkungen}
                      onChange={(e) => setNeuerTermin({ ...neuerTermin, bemerkungen: e.target.value })}
                      placeholder="Zusätzliche Informationen..."
                      rows="3"
                      className="pv3-dark-textarea"
                    />
                  </div>
                  <div>
                    <label className="pv-form-label">
                      Teilnahmebedingungen
                    </label>
                    <textarea
                      value={neuerTermin.teilnahmebedingungen}
                      onChange={(e) => setNeuerTermin({ ...neuerTermin, teilnahmebedingungen: e.target.value })}
                      placeholder="Bedingungen für Teilnehmer..."
                      rows="4"
                      className="pv3-dark-textarea"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pv3-modal-footer">
              <button
                onClick={() => { setShowNeuerTerminModal(false); setTerminStep(1); }}
                className="pv3-modal-btn-cancel"
              >
                Abbrechen
              </button>

              <div className="u-flex-gap-sm">
                {terminStep > 1 && (
                  <button
                    onClick={() => setTerminStep(terminStep - 1)}
                    className="pv3-modal-btn-cancel"
                  >
                    Zurück
                  </button>
                )}

                {terminStep < 3 ? (
                  <button
                    onClick={() => setTerminStep(terminStep + 1)}
                    disabled={
                      (terminStep === 1 && (!neuerTermin.stil_id || !neuerTermin.pruefungsdatum)) ||
                      (terminStep === 2 && neuerTermin.anmeldefrist && neuerTermin.pruefungsdatum &&
                       new Date(neuerTermin.anmeldefrist) > new Date(neuerTermin.pruefungsdatum))
                    }
                    className="pv3-modal-btn-weiter"
                  >
                    Weiter
                  </button>
                ) : (
                  <button
                    onClick={() => { handleNeuerTerminErstellen(); setTerminStep(1); }}
                    className="pv3-modal-btn-submit"
                  >
                    <Calendar size={18} className="pv2-mr-05" />
                    Termin erstellen
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Termin bearbeiten Modal - CACHE BREAK v6.0 NO PADDING */}
      {showEditTerminModal && editTermin && (
        <div
          className="pv3-edit-modal-overlay"
          onClick={() => setShowEditTerminModal(false)}
        >
          <div
            className="pv3-edit-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="pv3-edit-modal-h2">Prüfungstermin bearbeiten</h2>
            <p className="pv3-edit-modal-sub">
              Bearbeiten Sie die Details des Prüfungstermins.
            </p>

            {/* Grunddaten */}
            <h3 className="pv3-edit-section-heading">Grunddaten</h3>

            <div className="pv2-grid-2col-08">
              {/* Stil-Auswahl */}
              <div className="pv2-grid-span-full">
                <label className="pv-field-label">
                  Kampfkunst-Stil *
                </label>
                <select
                  value={editTermin.stil_id}
                  onChange={(e) => setEditTermin({ ...editTermin, stil_id: e.target.value })}
                  className="pv3-dark-input-sm"
                  required
                >
                  <option value="">Bitte wählen...</option>
                  {stile.map(stil => (
                    <option key={stil.stil_id} value={stil.stil_id}>
                      {stil.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prüfungsdatum */}
              <div>
                <label className="pv-field-label">
                  Prüfungsdatum *
                </label>
                <input
                  type="date"
                  value={editTermin.pruefungsdatum}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefungsdatum: e.target.value })}
                  className="pv3-dark-input-sm"
                  required
                />
              </div>

              {/* Uhrzeit */}
              <div>
                <label className="pv-field-label">
                  Uhrzeit
                </label>
                <input
                  type="time"
                  value={editTermin.pruefungszeit}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefungszeit: e.target.value })}
                  className="pv3-dark-input-sm"
                />
              </div>

              {/* Prüfungsort */}
              <div className="pv2-grid-span-full">
                <label className="pv-field-label">
                  Prüfungsort
                </label>
                <input
                  type="text"
                  value={editTermin.pruefungsort}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefungsort: e.target.value })}
                  className="pv3-dark-input-sm"
                  placeholder="z.B. Dojo Haupthalle, Sporthalle XYZ"
                />
              </div>
            </div>

            {/* Organisatorisches */}
            <h3 className="pv3-edit-section-heading-mt">Organisatorisches</h3>

            <div className="pv2-grid-2col-08">
              {/* Prüfungsgebühr */}
              <div>
                <label className="pv-field-label">
                  Prüfungsgebühr (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editTermin.pruefungsgebuehr}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefungsgebuehr: e.target.value })}
                  className="pv3-dark-input-sm"
                  placeholder="0.00"
                />
              </div>

              {/* Anmeldefrist */}
              <div>
                <label className="pv-field-label">
                  Anmeldefrist
                </label>
                <input
                  type="date"
                  value={editTermin.anmeldefrist}
                  onChange={(e) => setEditTermin({ ...editTermin, anmeldefrist: e.target.value })}
                  className="pv3-dark-input-sm"
                />
              </div>
            </div>

            {/* Öffentlich veröffentlichen (Edit) */}
            <div className="pv3-edit-oeffentlich-row">
              <input
                type="checkbox"
                id="editTermin_oeffentlich"
                checked={editTermin.oeffentlich || false}
                onChange={(e) => setEditTermin({ ...editTermin, oeffentlich: e.target.checked })}
                className="pv2-checkbox"
              />
              <label htmlFor="editTermin_oeffentlich" className="pv3-edit-oeffentlich-label">
                🌐 Auf tda-intl.com veröffentlichen
              </label>
            </div>

            {/* Zusätzliche Informationen */}
            <h3 className="pv3-edit-section-heading-mt">Zusätzliche Informationen</h3>

            <div className="pv3-edit-textarea-grid">
              {/* Bemerkungen */}
              <div>
                <label className="pv-field-label">
                  Bemerkungen
                </label>
                <textarea
                  value={editTermin.bemerkungen}
                  onChange={(e) => setEditTermin({ ...editTermin, bemerkungen: e.target.value })}
                  className="pv3-dark-textarea-sm"
                  rows="2"
                  placeholder="Zusätzliche Informationen zur Prüfung..."
                />
              </div>

              {/* Teilnahmebedingungen */}
              <div>
                <label className="pv-field-label">
                  Teilnahmebedingungen
                </label>
                <textarea
                  value={editTermin.teilnahmebedingungen}
                  onChange={(e) => setEditTermin({ ...editTermin, teilnahmebedingungen: e.target.value })}
                  className="pv3-dark-textarea-sm"
                  rows="3"
                  placeholder="Beispiel:&#10;- Vollständige Trainingsausrüstung mitbringen&#10;- Pünktliches Erscheinen erforderlich&#10;- Prüfungsgebühr vorab überweisen"
                />
              </div>
            </div>

            <div className="pv3-edit-footer">
              <button
                onClick={() => setShowEditTerminModal(false)}
                className="pv3-edit-btn-cancel"
              >
                Abbrechen
              </button>
              <button
                onClick={handleTerminAktualisieren}
                disabled={!editTermin.pruefungsdatum}
                className="pv3-modal-btn-submit pv3-modal-btn-save"
              >
                <Edit size={18} className="pv2-mr-05" />
                Änderungen speichern
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Termin-Auswahl Modal */}
      {terminAuswahlModal.open && (
        <div
          className="pv3-auswahl-modal-overlay"
          onClick={() => setTerminAuswahlModal({ open: false, kandidat: null, termine: [], isAusnahme: false })}
        >
          <div
            className="pv3-auswahl-modal-box"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="pv2-mb-05">
              {terminAuswahlModal.isAusnahme ? 'Ausnahme-Zulassung' : 'Prüfungstermin wählen'}
            </h3>
            <p className="pv3-auswahl-muted-p">
              {terminAuswahlModal.kandidat?.vorname} {terminAuswahlModal.kandidat?.nachname} —{' '}
              {terminAuswahlModal.kandidat?.stil_name}
              {terminAuswahlModal.isAusnahme && (
                <span className="pv3-auswahl-warning-span">
                  ⚠️ Zeitliche Voraussetzungen nicht erfüllt
                </span>
              )}
            </p>
            <div className="u-flex-col-md">
              {terminAuswahlModal.termine.map((termin, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTerminAuswahlSelected(termin)}
                  className="pv3-auswahl-btn"
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color, #333)'}
                >
                  <div className="pv3-auswahl-btn-date">
                    {new Date(termin.datum).toLocaleDateString('de-DE', {
                      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                    })}
                  </div>
                  <div className="pv3-auswahl-btn-meta">
                    {termin.zeit !== 'Nicht festgelegt' && `🕐 ${termin.zeit} Uhr`}
                    {termin.zeit !== 'Nicht festgelegt' && termin.ort !== 'Nicht festgelegt' && '  '}
                    {termin.ort !== 'Nicht festgelegt' && `📍 ${termin.ort}`}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setTerminAuswahlModal({ open: false, kandidat: null, termine: [], isAusnahme: false })}
              className="pv3-auswahl-cancel"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PruefungsVerwaltung;
