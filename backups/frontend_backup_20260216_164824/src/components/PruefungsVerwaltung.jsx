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

const PruefungsVerwaltung = () => {
  const { getDojoFilterParam, activeDojo } = useDojoContext();
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
    ist_historisch: false,
    historisch_bemerkung: ''
  });

  // Termin bearbeiten Modal
  const [showEditTerminModal, setShowEditTerminModal] = useState(false);
  const [editTermin, setEditTermin] = useState(null);

  // Expanded/Collapsed State für Prüfungstermine
  const [expandedTermine, setExpandedTermine] = useState({});

  // Batch-Ergebnis Modal
  const [showBatchErgebnisModal, setShowBatchErgebnisModal] = useState(false);
  const [batchTermin, setBatchTermin] = useState(null);
  const [batchErgebnisse, setBatchErgebnisse] = useState({});

  // Filter für Kandidaten
  const [berechtigungsFilter, setBerechtigungsFilter] = useState('all'); // 'all', 'berechtigt', 'nicht_berechtigt'
  const [kandidatenStilFilter, setKandidatenStilFilter] = useState('all');

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
  }, [activeTab, selectedStil]);

  const fetchStile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stile?aktiv=true`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      const data = await response.json();
      setStile(data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Stile:', error);
    }
  };

  const fetchKandidaten = async () => {
    setLoading(true);
    setError('');
    try {
      const dojoParam = getDojoFilterParam();
      const stilParam = selectedStil !== 'all' ? `&stil_id=${selectedStil}` : '';

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/kandidaten?${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
      const stilParam = selectedStil !== 'all' ? `&stil_id=${selectedStil}` : '';

      const response = await fetch(
        `${API_BASE_URL}/pruefungen?status=geplant&${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
      const stilParam = selectedStil !== 'all' ? `&stil_id=${selectedStil}` : '';

      const response = await fetch(
        `${API_BASE_URL}/pruefungen?status=bestanden&${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/stats/statistiken?${dojoParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
      const stilParam = selectedStil !== 'all' ? `&stil_id=${selectedStil}` : '';

      // Lade geplante Prüfungen
      const pruefungenResponse = await fetch(
        `${API_BASE_URL}/pruefungen?status=geplant&${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );
      const pruefungenData = await pruefungenResponse.json();

      // Lade Prüfungstermine (Vorlagen)
      const termineResponse = await fetch(
        `${API_BASE_URL}/pruefungen/termine?${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
          teilnahmebedingungen: termin.teilnahmebedingungen
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
          vorlageData: group.vorlageData
        };
      }).sort((a, b) => {
        // Erst nach Datum sortieren (neueste zuerst)
        const dateCompare = new Date(b.datum) - new Date(a.datum);
        if (dateCompare !== 0) return dateCompare;
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
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/kandidaten/${kandidat.mitglied_id}/zulassen`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            stil_id: kandidat.stil_id,
            graduierung_nachher_id: kandidat.naechste_graduierung_id,
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
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );

      if (!response.ok) throw new Error('Fehler beim Entfernen der Zulassung');

      setSuccess(`Zulassung von ${pruefung.vorname} ${pruefung.nachname} wurde entfernt.`);
      fetchZugelassenePruefungen(); // Liste aktualisieren
      fetchKandidaten(); // Kandidaten auch aktualisieren

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
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
        dojo_id: activeDojo.id
      };

      const response = await fetch(`${API_BASE_URL}/pruefungen/termine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
      teilnahmebedingungen: termin.vorlageData?.teilnahmebedingungen || ''
    });
    setShowEditTerminModal(true);
  };

  const toggleTerminExpanded = (terminKey) => {
    setExpandedTermine(prev => ({
      ...prev,
      [terminKey]: !prev[terminKey]
    }));
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
        <span style={{ marginLeft: '0.25rem', opacity: 0.3, fontSize: '0.75rem' }}>⇅</span>
      );
    }
    return (
      <span style={{ marginLeft: '0.25rem', color: '#EAB308', fontSize: '0.75rem' }}>
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
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
          teilnahmebedingungen: editTermin.teilnahmebedingungen || null
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
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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

  return (
    <div className="content-card">
      <div className="page-header">
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1.25rem',
            marginBottom: '0.5rem'
          }}>
            <span style={{ 
              fontSize: '2.5rem',
              filter: 'drop-shadow(0 2px 8px rgba(255, 215, 0, 0.3))',
              position: 'relative',
              zIndex: 10,
              lineHeight: 1,
              display: 'inline-block',
              flexShrink: 0
            }}>🎓</span>
            <h1 style={{ 
              fontSize: '2.5rem',
              fontWeight: '700',
              color: '#FFD700',
              margin: 0,
              textShadow: 'none',
              WebkitTextFillColor: '#FFD700',
              background: 'none',
              WebkitBackgroundClip: 'initial',
              backgroundClip: 'initial',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              letterSpacing: '0.5px',
              position: 'relative',
              zIndex: 2
            }}>Prüfungsverwaltung</h1>
          </div>
          <p>Gurtprüfungen planen, durchführen und dokumentieren</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select
            value={selectedStil}
            onChange={(e) => setSelectedStil(e.target.value)}
            className="form-select"
            style={{ minWidth: '200px' }}
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
            className="logout-button"
            style={{
              padding: '12px 28px',
              minWidth: '160px'
            }}
          >
            🔄 Aktualisieren
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        marginBottom: '2rem',
        display: 'flex',
        gap: '0.75rem',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setActiveTab('termine')}
          style={{
            background: activeTab === 'termine'
              ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 100%)'
              : 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 50%, transparent 100%)',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.95)',
            padding: '0.5rem 0.75rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.95rem',
            fontWeight: '600',
            boxShadow: activeTab === 'termine'
              ? '0 4px 12px rgba(255, 215, 0, 0.3)'
              : '0 2px 8px rgba(255, 215, 0, 0.15)',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 100%)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'termine') {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 50%, transparent 100%)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 215, 0, 0.15)';
            }
          }}
        >
          <Calendar size={18} />
          Prüfungstermine
        </button>
        <button
          onClick={() => setActiveTab('kandidaten')}
          style={{
            background: activeTab === 'kandidaten'
              ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 100%)'
              : 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 50%, transparent 100%)',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.95)',
            padding: '0.5rem 0.75rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.95rem',
            fontWeight: '600',
            boxShadow: activeTab === 'kandidaten'
              ? '0 4px 12px rgba(255, 215, 0, 0.3)'
              : '0 2px 8px rgba(255, 215, 0, 0.15)',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 100%)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'kandidaten') {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 50%, transparent 100%)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 215, 0, 0.15)';
            }
          }}
        >
          <Users size={18} />
          Prüfungskandidaten
        </button>
        <button
          onClick={() => setActiveTab('zugelassen')}
          style={{
            background: activeTab === 'zugelassen'
              ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 100%)'
              : 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 50%, transparent 100%)',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.95)',
            padding: '0.5rem 0.75rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.95rem',
            fontWeight: '600',
            boxShadow: activeTab === 'zugelassen'
              ? '0 4px 12px rgba(255, 215, 0, 0.3)'
              : '0 2px 8px rgba(255, 215, 0, 0.15)',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 100%)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'zugelassen') {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 50%, transparent 100%)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 215, 0, 0.15)';
            }
          }}
        >
          <Check size={18} />
          Zugelassene Prüfungen
        </button>
        <button
          onClick={() => setActiveTab('abgeschlossen')}
          style={{
            background: activeTab === 'abgeschlossen'
              ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 100%)'
              : 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 50%, transparent 100%)',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.95)',
            padding: '0.5rem 0.75rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.95rem',
            fontWeight: '600',
            boxShadow: activeTab === 'abgeschlossen'
              ? '0 4px 12px rgba(255, 215, 0, 0.3)'
              : '0 2px 8px rgba(255, 215, 0, 0.15)',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 100%)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'abgeschlossen') {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 50%, transparent 100%)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 215, 0, 0.15)';
            }
          }}
        >
          <Award size={18} />
          Abgeschlossene Prüfungen
        </button>
        <button
          onClick={() => setActiveTab('statistiken')}
          style={{
            background: activeTab === 'statistiken'
              ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 100%)'
              : 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 50%, transparent 100%)',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.95)',
            padding: '0.5rem 0.75rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.95rem',
            fontWeight: '600',
            boxShadow: activeTab === 'statistiken'
              ? '0 4px 12px rgba(255, 215, 0, 0.3)'
              : '0 2px 8px rgba(255, 215, 0, 0.15)',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 100%)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'statistiken') {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 50%, transparent 100%)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 215, 0, 0.15)';
            }
          }}
        >
          <TrendingUp size={18} />
          Statistiken
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          ❌ {error}
        </div>
      )}

      {/* Prüfungstermine Tab */}
      {activeTab === 'termine' && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                GEPLANTE PRÜFUNGSTERMINE
                <span style={{
                  marginLeft: '0.5rem',
                  color: '#EAB308',
                  fontWeight: 'bold'
                }}>
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
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                Übersicht aller geplanten Prüfungen gruppiert nach Datum
              </p>
            </div>
            <button
              onClick={() => setShowNeuerTerminModal(true)}
              style={{
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 50%, transparent 100%)',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.95)',
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                boxShadow: '0 2px 8px rgba(255, 215, 0, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 100%)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 50%, transparent 100%)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 215, 0, 0.2)';
              }}
            >
              <Calendar size={18} />
              Neuer Termin
            </button>
          </div>

          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div className="loading-spinner-large"></div>
              <p style={{ color: '#6b7280' }}>Termine werden geladen...</p>
            </div>
          ) : pruefungstermine.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0.5rem',
              border: '1px dashed rgba(255, 255, 255, 0.1)'
            }}>
              <Calendar size={48} style={{ color: 'rgba(255, 255, 255, 0.3)', marginBottom: '1rem' }} />
              <h3 style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem' }}>Keine Prüfungstermine geplant</h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem' }}>
                Aktuell gibt es keine geplanten Prüfungstermine. Lassen Sie Kandidaten zur Prüfung zu, um Termine zu erstellen.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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
                    <h3 style={{
                      marginBottom: '1rem',
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      color: '#EAB308',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      GEPLANTE PRÜFUNGSTERMINE ({geplanteTermine.length} {geplanteTermine.length === 1 ? 'TERMIN' : 'TERMINE'})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {geplanteTermine.map((termin, index) => {
                        const datum = new Date(termin.datum);
                        const isToday = termin.datum === new Date().toISOString().split('T')[0];
                        const isPast = false; // Geplante Termine sind nie vergangen

                return (
                  <div
                    key={index}
                    style={{
                      backgroundColor: isToday
                        ? 'rgba(59, 130, 246, 0.1)'
                        : isPast
                          ? 'rgba(255, 255, 255, 0.03)'
                          : 'rgba(255, 255, 255, 0.05)',
                      border: isToday
                        ? '1px solid rgba(59, 130, 246, 0.3)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '0.75rem',
                      padding: '1.5rem',
                      boxShadow: isToday
                        ? '0 4px 12px rgba(59, 130, 246, 0.15)'
                        : '0 2px 8px rgba(0, 0, 0, 0.1)',
                      opacity: isPast ? 0.6 : 1
                    }}
                  >
                    {/* Termin-Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '1rem',
                      paddingBottom: '1rem',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <div
                        style={{ flex: 1, cursor: 'pointer' }}
                        onClick={() => toggleTerminExpanded(`${termin.datum}_${termin.stil_id}`)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          <Calendar size={24} style={{ color: isToday ? '#3b82f6' : '#8b5cf6' }} />
                          <h3 style={{
                            margin: 0,
                            fontSize: '1.25rem',
                            fontWeight: '700',
                            color: isToday ? '#3b82f6' : '#EAB308'
                          }}>
                            {datum.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </h3>
                          {expandedTermine[`${termin.datum}_${termin.stil_id}`] ? (
                            <ChevronUp size={24} style={{ color: '#EAB308', transition: 'transform 0.2s' }} />
                          ) : (
                            <ChevronDown size={24} style={{ color: '#6b7280', transition: 'transform 0.2s' }} />
                          )}
                          {isToday && (
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              Heute
                            </span>
                          )}
                          {isPast && !isToday && (
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#6b7280',
                              color: 'white',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              Vergangen
                            </span>
                          )}
                        </div>
                        <div style={{
                          display: 'flex',
                          gap: '2rem',
                          fontSize: '0.875rem',
                          color: '#6b7280'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: '600' }}>⏰ Uhrzeit:</span>
                            <span>{termin.zeit}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: '600' }}>🥋 Stil:</span>
                            <span style={{
                              padding: '0.125rem 0.5rem',
                              backgroundColor: '#EAB308',
                              color: '#1a1a1a',
                              borderRadius: '0.375rem',
                              fontWeight: '700'
                            }}>
                              {termin.stil_name}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: '600' }}>📍 Ort:</span>
                            <span>{termin.ort}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: '600' }}>👥 Teilnehmer:</span>
                            <span style={{
                              padding: '0.125rem 0.5rem',
                              backgroundColor: '#8b5cf6',
                              color: 'white',
                              borderRadius: '0.375rem',
                              fontWeight: '700'
                            }}>
                              {termin.anzahl}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePruefungslistePDF(termin);
                          }}
                          className="logout-button"
                          style={{
                            padding: '0.4rem 0.6rem',
                            fontSize: '0.85rem'
                          }}
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
                            className="logout-button"
                            style={{
                              padding: '0.4rem 0.6rem',
                              fontSize: '0.85rem',
                              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.1) 50%, transparent 100%)',
                              border: 'none',
                              color: 'rgba(255, 255, 255, 0.95)',
                              boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2)'
                            }}
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
                          className="logout-button"
                          style={{
                            padding: '0.4rem 0.6rem',
                            fontSize: '0.85rem'
                          }}
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
                          className="logout-button"
                          style={{
                            padding: '0.4rem 0.6rem',
                            fontSize: '0.85rem',
                            background: 'linear-gradient(135deg, rgba(220, 53, 69, 0.3) 0%, rgba(220, 53, 69, 0.1) 50%, transparent 100%)',
                            border: 'none',
                            color: 'rgba(255, 255, 255, 0.95)',
                            boxShadow: '0 2px 8px rgba(220, 53, 69, 0.2)'
                          }}
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
                        <div style={{
                          padding: '2rem',
                          textAlign: 'center',
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          borderRadius: '0.5rem',
                          border: '1px dashed rgba(245, 158, 11, 0.3)'
                        }}>
                          <Calendar size={48} style={{ color: '#f59e0b', margin: '0 auto 1rem' }} />
                          <h4 style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0 0 0.5rem 0' }}>
                            Termin ohne Teilnehmer
                          </h4>
                          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.875rem', margin: 0 }}>
                            Dieser Termin wurde angelegt, hat aber noch keine zugelassenen Kandidaten.
                            <br />
                            Teilnehmer koennen ueber das Mitgliederprofil zu diesem Termin angemeldet werden.
                          </p>
                        </div>
                      ) : (
                        <div className="table-container" style={{ marginTop: '1rem' }}>
                          <table className="data-table" style={{ fontSize: '0.875rem' }}>
                            <thead>
                              <tr>
                                <th style={{ minWidth: '180px', color: '#EAB308' }}>Name</th>
                                <th style={{ minWidth: '110px', color: '#EAB308' }}>Geburtsdatum</th>
                                <th style={{ minWidth: '100px', color: '#EAB308' }}>Stil</th>
                                <th style={{ minWidth: '150px', color: '#EAB308' }}>Aktueller Gurt</th>
                                <th style={{ minWidth: '150px', color: '#EAB308' }}>Angestrebter Gurt</th>
                                <th style={{ minWidth: '140px', color: '#EAB308' }}>Trainingsstunden</th>
                                <th style={{ minWidth: '100px', color: '#EAB308' }}>Wartezeit</th>
                                <th style={{ minWidth: '130px', color: '#EAB308' }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {termin.pruefungen.map((pruefung, pIndex) => (
                                <tr
                                  key={pIndex}
                                  style={{
                                    backgroundColor: 'rgba(255, 215, 0, 0.05)',
                                    borderLeft: '3px solid rgba(255, 215, 0, 0.5)',
                                    transition: 'all 0.2s ease'
                                  }}
                                  className="hover-row"
                                >
                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                                      <span style={{ fontWeight: '700', color: 'rgba(255, 255, 255, 0.95)' }}>
                                        {pruefung.vorname} {pruefung.nachname}
                                      </span>
                                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                        ID: {pruefung.mitglied_id}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                                      {pruefung.geburtsdatum ? new Date(pruefung.geburtsdatum).toLocaleDateString('de-DE') : '—'}
                                    </span>
                                  </td>
                                  <td>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '0.25rem 0.75rem',
                                      backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                      color: '#a78bfa',
                                      borderRadius: '0.375rem',
                                      fontSize: '0.8125rem',
                                      fontWeight: '600',
                                      border: '1px solid rgba(139, 92, 246, 0.3)'
                                    }}>
                                      {pruefung.stil_name}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        backgroundColor: pruefung.farbe_vorher || '#6b7280',
                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                        flexShrink: 0
                                      }} />
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.8125rem' }}>
                                          {pruefung.graduierung_vorher || 'Keine'}
                                        </span>
                                        <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                                          Ziel-Gurt
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        backgroundColor: pruefung.farbe_nachher || '#EAB308',
                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                        flexShrink: 0
                                      }} />
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.8125rem' }}>
                                          {pruefung.graduierung_nachher}
                                        </span>
                                        <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                                          Ziel-Gurt
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontWeight: '700', color: '#22c55e', fontSize: '1rem' }}>
                                          {pruefung.anwesenheiten_aktuell || 0}
                                        </span>
                                        <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                                          / {pruefung.min_trainingseinheiten || 0}
                                        </span>
                                      </div>
                                      <div style={{
                                        width: '100%',
                                        height: '6px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: '3px',
                                        overflow: 'hidden'
                                      }}>
                                        <div style={{
                                          width: `${Math.min(100, ((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100)}%`,
                                          height: '100%',
                                          backgroundColor: ((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? '#22c55e' : '#f59e0b',
                                          transition: 'width 0.3s ease'
                                        }} />
                                      </div>
                                      <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                                        {((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? '100%' : Math.round(((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100) + '%'} erreicht
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      <span style={{
                                        fontWeight: '700',
                                        color: '#22c55e',
                                        fontSize: '0.9375rem'
                                      }}>
                                        {pruefung.monate_seit_letzter_pruefung || 0} Mon.
                                      </span>
                                      <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                                        von {pruefung.min_wartezeit_monate || 0}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.375rem',
                                      padding: '0.375rem 0.75rem',
                                      backgroundColor: 'rgba(255, 215, 0, 0.2)',
                                      color: '#fbbf24',
                                      borderRadius: '0.375rem',
                                      fontSize: '0.8125rem',
                                      fontWeight: '600',
                                      border: '1px solid rgba(255, 215, 0, 0.3)'
                                    }}>
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
                    <h3 style={{
                      marginBottom: '1rem',
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      VERGANGENE PRÜFUNGSTERMINE ({vergangeneTermine.length} {vergangeneTermine.length === 1 ? 'TERMIN' : 'TERMINE'})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {vergangeneTermine.map((termin, index) => {
                        const datum = new Date(termin.datum);
                        const isToday = false; // Vergangene Termine sind nie heute
                        const isPast = true; // Vergangene Termine sind immer vergangen

                        return (
                          <div
                            key={index}
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '0.75rem',
                              padding: '1.5rem',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                              opacity: 0.6
                            }}
                          >
                            {/* Termin-Header */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '1rem',
                              paddingBottom: '1rem',
                              borderBottom: '1px solid #e5e7eb'
                            }}>
                              <div
                                style={{ flex: 1, cursor: 'pointer' }}
                                onClick={() => toggleTerminExpanded(`${termin.datum}_${termin.stil_id}`)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                  <Calendar size={24} style={{ color: '#8b5cf6' }} />
                                  <h3 style={{
                                    margin: 0,
                                    fontSize: '1.25rem',
                                    fontWeight: '700',
                                    color: '#EAB308'
                                  }}>
                                    {datum.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                  </h3>
                                  {expandedTermine[`${termin.datum}_${termin.stil_id}`] ? (
                                    <ChevronUp size={24} style={{ color: '#EAB308', transition: 'transform 0.2s' }} />
                                  ) : (
                                    <ChevronDown size={24} style={{ color: '#6b7280', transition: 'transform 0.2s' }} />
                                  )}
                                  <span style={{
                                    padding: '0.25rem 0.75rem',
                                    backgroundColor: '#6b7280',
                                    color: 'white',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}>
                                    Vergangen
                                  </span>
                                </div>
                                <div style={{
                                  display: 'flex',
                                  gap: '2rem',
                                  fontSize: '0.875rem',
                                  color: '#6b7280'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: '600' }}>⏰ Uhrzeit:</span>
                                    <span>{termin.zeit}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: '600' }}>🥋 Stil:</span>
                                    <span style={{
                                      padding: '0.125rem 0.5rem',
                                      backgroundColor: '#EAB308',
                                      color: '#1a1a1a',
                                      borderRadius: '0.375rem',
                                      fontWeight: '700'
                                    }}>
                                      {termin.stil_name}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: '600' }}>📍 Ort:</span>
                                    <span>{termin.ort}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: '600' }}>👥 Teilnehmer:</span>
                                    <span style={{
                                      padding: '0.125rem 0.5rem',
                                      backgroundColor: '#8b5cf6',
                                      color: 'white',
                                      borderRadius: '0.375rem',
                                      fontWeight: '700'
                                    }}>
                                      {termin.anzahl}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePruefungslistePDF(termin);
                                  }}
                                  className="logout-button"
                                  style={{
                                    padding: '0.4rem 0.6rem',
                                    fontSize: '0.85rem'
                                  }}
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
                                    className="logout-button"
                                    style={{
                                      padding: '0.4rem 0.6rem',
                                      fontSize: '0.85rem',
                                      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.1) 50%, transparent 100%)',
                                      border: 'none',
                                      color: 'rgba(255, 255, 255, 0.95)',
                                      boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2)'
                                    }}
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
                                  className="logout-button"
                                  style={{
                                    padding: '0.4rem 0.6rem',
                                    fontSize: '0.85rem'
                                  }}
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
                                  className="logout-button"
                                  style={{
                                    padding: '0.4rem 0.6rem',
                                    fontSize: '0.85rem',
                                    background: 'linear-gradient(135deg, rgba(220, 53, 69, 0.3) 0%, rgba(220, 53, 69, 0.1) 50%, transparent 100%)',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.95)',
                                    boxShadow: '0 2px 8px rgba(220, 53, 69, 0.2)'
                                  }}
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
                                <div style={{
                                  padding: '2rem',
                                  textAlign: 'center',
                                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                  borderRadius: '0.5rem',
                                  border: '1px dashed rgba(245, 158, 11, 0.3)'
                                }}>
                                  <Calendar size={48} style={{ color: '#f59e0b', margin: '0 auto 1rem' }} />
                                  <h4 style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0 0 0.5rem 0' }}>
                                    Termin ohne Teilnehmer
                                  </h4>
                                  <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.875rem', margin: 0 }}>
                                    Dieser Termin wurde angelegt, hat aber noch keine zugelassenen Kandidaten.
                                    <br />
                                    Teilnehmer koennen ueber das Mitgliederprofil zu diesem Termin angemeldet werden.
                                  </p>
                                </div>
                              ) : (
                                <div className="table-container" style={{ marginTop: '1rem' }}>
                                  <table className="data-table" style={{ fontSize: '0.875rem' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ minWidth: '180px', color: '#EAB308' }}>Name</th>
                                        <th style={{ minWidth: '110px', color: '#EAB308' }}>Geburtsdatum</th>
                                        <th style={{ minWidth: '100px', color: '#EAB308' }}>Stil</th>
                                        <th style={{ minWidth: '150px', color: '#EAB308' }}>Aktueller Gurt</th>
                                        <th style={{ minWidth: '150px', color: '#EAB308' }}>Angestrebter Gurt</th>
                                        <th style={{ minWidth: '140px', color: '#EAB308' }}>Trainingsstunden</th>
                                        <th style={{ minWidth: '100px', color: '#EAB308' }}>Wartezeit</th>
                                        <th style={{ minWidth: '130px', color: '#EAB308' }}>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {termin.pruefungen.map((pruefung, pIndex) => (
                                        <tr
                                          key={pIndex}
                                          style={{
                                            backgroundColor: 'rgba(255, 215, 0, 0.05)',
                                            borderLeft: '3px solid rgba(255, 215, 0, 0.5)',
                                            transition: 'all 0.2s ease'
                                          }}
                                          className="hover-row"
                                        >
                                          <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                                              <span style={{ fontWeight: '700', color: 'rgba(255, 255, 255, 0.95)' }}>
                                                {pruefung.vorname} {pruefung.nachname}
                                              </span>
                                              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                ID: {pruefung.mitglied_id}
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                                              {pruefung.geburtsdatum ? new Date(pruefung.geburtsdatum).toLocaleDateString('de-DE') : '—'}
                                            </span>
                                          </td>
                                          <td>
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '0.25rem 0.75rem',
                                              backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                              color: '#a78bfa',
                                              borderRadius: '0.375rem',
                                              fontSize: '0.8125rem',
                                              fontWeight: '600',
                                              border: '1px solid rgba(139, 92, 246, 0.3)'
                                            }}>
                                              {pruefung.stil_name}
                                            </span>
                                          </td>
                                          <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                backgroundColor: pruefung.farbe_vorher || '#6b7280',
                                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                flexShrink: 0
                                              }} />
                                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.8125rem' }}>
                                                  {pruefung.graduierung_vorher || 'Keine'}
                                                </span>
                                                <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                                                  Ziel-Gurt
                                                </span>
                                              </div>
                                            </div>
                                          </td>
                                          <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                backgroundColor: pruefung.farbe_nachher || '#EAB308',
                                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                flexShrink: 0
                                              }} />
                                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.8125rem' }}>
                                                  {pruefung.graduierung_nachher}
                                                </span>
                                                <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                                                  Ziel-Gurt
                                                </span>
                                              </div>
                                            </div>
                                          </td>
                                          <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontWeight: '700', color: '#22c55e', fontSize: '1rem' }}>
                                                  {pruefung.anwesenheiten_aktuell || 0}
                                                </span>
                                                <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                                                  / {pruefung.min_trainingseinheiten || 0}
                                                </span>
                                              </div>
                                              <div style={{
                                                width: '100%',
                                                height: '6px',
                                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                borderRadius: '3px',
                                                overflow: 'hidden'
                                              }}>
                                                <div style={{
                                                  width: `${Math.min(100, ((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100)}%`,
                                                  height: '100%',
                                                  backgroundColor: ((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? '#22c55e' : '#f59e0b',
                                                  transition: 'width 0.3s ease'
                                                }} />
                                              </div>
                                              <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                                                {((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? '100%' : Math.round(((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100) + '%'} erreicht
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                              <span style={{
                                                fontWeight: '700',
                                                color: '#22c55e',
                                                fontSize: '0.9375rem'
                                              }}>
                                                {pruefung.monate_seit_letzter_pruefung || 0} Mon.
                                              </span>
                                              <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                                                von {pruefung.min_wartezeit_monate || 0}
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <span style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.375rem',
                                              padding: '0.375rem 0.75rem',
                                              backgroundColor: 'rgba(255, 215, 0, 0.2)',
                                              color: '#fbbf24',
                                              borderRadius: '0.375rem',
                                              fontSize: '0.8125rem',
                                              fontWeight: '600',
                                              border: '1px solid rgba(255, 215, 0, 0.3)'
                                            }}>
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

        // Sortierung anwenden
        if (sortConfig.key) {
          filteredKandidaten = applySorting(filteredKandidaten, sortConfig.key, sortConfig.direction);
        }

        return (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '0.5rem',
            border: '1px solid rgba(255, 215, 0, 0.2)'
          }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                Prüfungskandidaten
                <span style={{
                  marginLeft: '0.5rem',
                  color: '#ffd700',
                  fontWeight: 'bold',
                  fontSize: '0.875rem'
                }}>
                  ({filteredKandidaten.filter(k => k.berechtigt).length} berechtigt / {filteredKandidaten.length} angezeigt
                  {(berechtigungsFilter !== 'all' || kandidatenStilFilter !== 'all') && ` von ${kandidaten.length} gesamt`})
                </span>
              </h2>
              <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                {selectedKandidaten.length > 0
                  ? `${selectedKandidaten.length} Kandidat${selectedKandidaten.length > 1 ? 'en' : ''} ausgewählt`
                  : 'Wählen Sie Kandidaten aus, um sie zur Prüfung zuzulassen'}
              </p>

              {/* Filter Controls */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                marginTop: '0.75rem',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                {/* Berechtigungsfilter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>
                    Berechtigung:
                  </span>
                  <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: '0.375rem', padding: '0.125rem' }}>
                    <button
                      onClick={() => setBerechtigungsFilter('all')}
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.875rem',
                        backgroundColor: berechtigungsFilter === 'all' ? '#EAB308' : 'transparent',
                        color: berechtigungsFilter === 'all' ? '#1a1a1a' : 'rgba(255, 255, 255, 0.7)',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        fontWeight: berechtigungsFilter === 'all' ? '600' : '400',
                        transition: 'all 0.2s'
                      }}
                    >
                      Alle
                    </button>
                    <button
                      onClick={() => setBerechtigungsFilter('berechtigt')}
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.875rem',
                        backgroundColor: berechtigungsFilter === 'berechtigt' ? '#EAB308' : 'transparent',
                        color: berechtigungsFilter === 'berechtigt' ? '#1a1a1a' : 'rgba(255, 255, 255, 0.7)',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        fontWeight: berechtigungsFilter === 'berechtigt' ? '600' : '400',
                        transition: 'all 0.2s'
                      }}
                    >
                      Berechtigt
                    </button>
                    <button
                      onClick={() => setBerechtigungsFilter('nicht_berechtigt')}
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.875rem',
                        backgroundColor: berechtigungsFilter === 'nicht_berechtigt' ? '#EAB308' : 'transparent',
                        color: berechtigungsFilter === 'nicht_berechtigt' ? '#1a1a1a' : 'rgba(255, 255, 255, 0.7)',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        fontWeight: berechtigungsFilter === 'nicht_berechtigt' ? '600' : '400',
                        transition: 'all 0.2s'
                      }}
                    >
                      Nicht berechtigt
                    </button>
                  </div>
                </div>

                {/* Stilfilter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>
                    Stil:
                  </span>
                  <select
                    value={kandidatenStilFilter}
                    onChange={(e) => setKandidatenStilFilter(e.target.value)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.875rem',
                      backgroundColor: '#1a1a1a',
                      color: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: '500',
                      outline: 'none'
                    }}
                  >
                    <option value="all" style={{ backgroundColor: '#1a1a1a', color: 'rgba(255, 255, 255, 0.9)' }}>
                      Alle Stile
                    </option>
                    {stile.map(stil => (
                      <option
                        key={stil.stil_id}
                        value={stil.stil_id}
                        style={{ backgroundColor: '#1a1a1a', color: 'rgba(255, 255, 255, 0.9)' }}
                      >
                        {stil.name}
                      </option>
                    ))}
                  </select>
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
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                <Check size={20} />
                {selectedKandidaten.length} Kandidat{selectedKandidaten.length > 1 ? 'en' : ''} zulassen
              </button>
            )}
          </div>

          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div className="loading-spinner-large"></div>
              <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Kandidaten werden geladen...</p>
            </div>
          ) : kandidaten.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0.5rem',
              border: '2px dashed rgba(255, 215, 0, 0.2)'
            }}>
              <Users size={48} style={{ color: 'rgba(255, 255, 255, 0.3)', marginBottom: '1rem' }} />
              <h3 style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem' }}>Keine Kandidaten gefunden</h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem' }}>
                Aktuell gibt es keine Mitglieder, die die Voraussetzungen für eine Prüfung erfüllen.
              </p>
            </div>
          ) : filteredKandidaten.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0.5rem',
              border: '2px dashed rgba(255, 215, 0, 0.2)'
            }}>
              <Users size={48} style={{ color: 'rgba(255, 255, 255, 0.3)', marginBottom: '1rem' }} />
              <h3 style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem' }}>Keine Kandidaten mit den aktuellen Filtern</h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem' }}>
                Passen Sie die Filter an, um andere Kandidaten anzuzeigen.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center', color: '#EAB308' }}>
                      <input
                        type="checkbox"
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          accentColor: '#ffd700'
                        }}
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
                      style={{ minWidth: '140px', color: '#EAB308', cursor: 'pointer', userSelect: 'none', fontSize: '0.8125rem', padding: '0.5rem' }}
                      onClick={() => handleSort('name')}
                    >
                      Name <SortIcon columnKey="name" />
                    </th>
                    <th
                      style={{ minWidth: '90px', color: '#EAB308', cursor: 'pointer', userSelect: 'none', fontSize: '0.8125rem', padding: '0.5rem' }}
                      onClick={() => handleSort('geburtsdatum')}
                    >
                      Geb.datum <SortIcon columnKey="geburtsdatum" />
                    </th>
                    <th
                      style={{ minWidth: '80px', color: '#EAB308', cursor: 'pointer', userSelect: 'none', fontSize: '0.8125rem', padding: '0.5rem' }}
                      onClick={() => handleSort('stil_name')}
                    >
                      Stil <SortIcon columnKey="stil_name" />
                    </th>
                    <th
                      style={{ minWidth: '120px', color: '#EAB308', cursor: 'pointer', userSelect: 'none', fontSize: '0.8125rem', padding: '0.5rem' }}
                      onClick={() => handleSort('graduierung_vorher_name')}
                    >
                      Aktuell <SortIcon columnKey="graduierung_vorher_name" />
                    </th>
                    <th
                      style={{ minWidth: '120px', color: '#EAB308', cursor: 'pointer', userSelect: 'none', fontSize: '0.8125rem', padding: '0.5rem' }}
                      onClick={() => handleSort('graduierung_nachher_name')}
                    >
                      Ziel <SortIcon columnKey="graduierung_nachher_name" />
                    </th>
                    <th style={{ minWidth: '110px', color: '#EAB308', fontSize: '0.8125rem', padding: '0.5rem' }}>Stunden</th>
                    <th style={{ minWidth: '80px', color: '#EAB308', fontSize: '0.8125rem', padding: '0.5rem' }}>Monate</th>
                    <th style={{ minWidth: '100px', color: '#EAB308', fontSize: '0.8125rem', padding: '0.5rem' }}>Status</th>
                    <th style={{ minWidth: '100px', textAlign: 'center', color: '#EAB308', fontSize: '0.8125rem', padding: '0.5rem' }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKandidaten.map((kandidat, index) => (
                    <tr
                      key={`${kandidat.mitglied_id}-${kandidat.stil_id}-${index}`}
                      style={{
                        backgroundColor: kandidat.bereits_zugelassen
                          ? 'rgba(255, 215, 0, 0.05)'
                          : kandidat.berechtigt
                            ? 'rgba(34, 197, 94, 0.05)'
                            : 'transparent',
                        opacity: kandidat.bereits_zugelassen ? 0.7 : 1,
                        transition: 'all 0.2s ease',
                        borderLeft: kandidat.berechtigt && !kandidat.bereits_zugelassen
                          ? '3px solid rgba(34, 197, 94, 0.5)'
                          : kandidat.bereits_zugelassen
                            ? '3px solid rgba(255, 215, 0, 0.5)'
                            : '3px solid transparent'
                      }}
                      className="hover-row"
                    >
                      <td style={{ textAlign: 'center' }}>
                        {kandidat.berechtigt && !kandidat.bereits_zugelassen ? (
                          <input
                            type="checkbox"
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                              accentColor: '#ffd700'
                            }}
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
                          <span style={{ color: '#d1d5db' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                          <strong style={{ color: 'rgba(255, 255, 255, 0.95)' }}>
                            {kandidat.vorname} {kandidat.nachname}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                            ID: {kandidat.mitglied_id}
                          </span>
                        </div>
                      </td>
                      <td style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        {new Date(kandidat.geburtsdatum).toLocaleDateString('de-DE')}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.4rem 0.6rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          color: 'rgba(255, 255, 255, 0.8)',
                          border: '1px solid rgba(255, 215, 0, 0.2)'
                        }}>
                          {kandidat.stil_name}
                        </span>
                      </td>
                      <td>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: kandidat.aktuelle_farbe || 'rgba(255, 255, 255, 0.1)',
                              border: '2px solid rgba(255, 255, 255, 0.3)',
                              flexShrink: 0
                            }}
                            title={kandidat.aktuelle_graduierung || 'Keine'}
                          />
                          <span style={{
                            fontSize: '0.875rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontWeight: '500'
                          }}>
                            {kandidat.aktuelle_graduierung || 'Keine'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: kandidat.naechste_farbe || 'rgba(255, 255, 255, 0.1)',
                              border: '2px solid rgba(34, 197, 94, 0.5)',
                              flexShrink: 0
                            }}
                            title={kandidat.naechste_graduierung}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                            <span style={{
                              fontSize: '0.875rem',
                              color: 'rgba(255, 255, 255, 0.9)',
                              fontWeight: '600'
                            }}>
                              {kandidat.naechste_graduierung}
                            </span>
                            <span style={{
                              fontSize: '0.7rem',
                              color: 'rgba(255, 255, 255, 0.5)',
                              fontWeight: '400'
                            }}>
                              Ziel-Gurt
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '0.8125rem',
                              fontWeight: '600',
                              color: kandidat.absolvierte_stunden >= kandidat.benoetigte_stunden ? '#10b981' : '#ef4444'
                            }}>
                              {kandidat.absolvierte_stunden}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                              / {kandidat.benoetigte_stunden}
                            </span>
                          </div>
                          <div style={{
                            width: '100%',
                            height: '6px',
                            backgroundColor: '#e5e7eb',
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div
                              style={{
                                width: `${Math.min(kandidat.fortschritt_prozent, 100)}%`,
                                height: '100%',
                                backgroundColor: kandidat.fortschritt_prozent >= 100 ? '#10b981' : '#f59e0b',
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                            {kandidat.fortschritt_prozent}% erreicht
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{
                          fontSize: '0.8125rem',
                          fontWeight: '600',
                          color: kandidat.monate_seit_letzter_pruefung >= kandidat.benoetigte_monate ? '#10b981' : '#ef4444'
                        }}>
                          {kandidat.monate_seit_letzter_pruefung} Mon.
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          von {kandidat.benoetigte_monate}
                        </div>
                      </td>
                      <td>
                        {kandidat.bereits_zugelassen ? (
                          <span className="badge badge-warning" style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.75rem'
                          }}>
                            <Check size={14} />
                            Zugelassen
                          </span>
                        ) : kandidat.berechtigt ? (
                          <span className="badge badge-success" style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.75rem'
                          }}>
                            <Check size={14} />
                            Berechtigt
                          </span>
                        ) : (
                          <span className="badge badge-neutral" style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.75rem'
                          }}>
                            <X size={14} />
                            Noch nicht
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {!kandidat.bereits_zugelassen ? (
                          kandidat.berechtigt ? (
                            <button
                              onClick={() => handleKandidatZulassen(kandidat)}
                              className="btn btn-sm btn-success"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.5rem 1rem',
                                fontSize: '0.8125rem',
                                fontWeight: '600'
                              }}
                            >
                              <Check size={16} />
                              Zulassen
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAusnahmeZulassen(kandidat)}
                              className="btn btn-sm btn-warning"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.5rem 1rem',
                                fontSize: '0.8125rem',
                                fontWeight: '600'
                              }}
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
                            className="btn btn-sm btn-danger"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.5rem 1rem',
                              fontSize: '0.8125rem',
                              fontWeight: '600'
                            }}
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
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '0.5rem',
              border: '1px solid rgba(255, 215, 0, 0.15)'
            }}>
              <div style={{
                display: 'flex',
                gap: '2rem',
                flexWrap: 'wrap',
                fontSize: '0.875rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '20px',
                    height: '4px',
                    backgroundColor: 'rgba(34, 197, 94, 0.5)',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Berechtigt zur Prüfung</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '20px',
                    height: '4px',
                    backgroundColor: 'rgba(255, 215, 0, 0.5)',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Bereits zugelassen</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '20px',
                    height: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Noch nicht berechtigt</span>
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
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>
                Stil:
              </span>
              <select
                value={zugelasseneStilFilter}
                onChange={(e) => setZugelasseneStilFilter(e.target.value)}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#1a1a1a',
                  color: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  outline: 'none'
                }}
              >
                <option value="all" style={{ backgroundColor: '#1a1a1a', color: 'rgba(255, 255, 255, 0.9)' }}>
                  Alle Stile
                </option>
                {stile.map(stil => (
                  <option
                    key={stil.stil_id}
                    value={stil.stil_id}
                    style={{ backgroundColor: '#1a1a1a', color: 'rgba(255, 255, 255, 0.9)' }}
                  >
                    {stil.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>Lädt...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th
                      style={{ color: '#EAB308', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('name')}
                    >
                      Name <SortIcon columnKey="name" />
                    </th>
                    <th
                      style={{ color: '#EAB308', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('stil_name')}
                    >
                      Stil <SortIcon columnKey="stil_name" />
                    </th>
                    <th
                      style={{ color: '#EAB308', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('graduierung_nachher_name')}
                    >
                      Angestrebt <SortIcon columnKey="graduierung_nachher_name" />
                    </th>
                    <th
                      style={{ color: '#EAB308', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('pruefungsdatum')}
                    >
                      Prüfungsdatum <SortIcon columnKey="pruefungsdatum" />
                    </th>
                    <th style={{ color: '#EAB308' }}>Aktionen</th>
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
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.4rem 0.6rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          color: 'rgba(255, 255, 255, 0.8)',
                          border: '1px solid rgba(255, 215, 0, 0.2)'
                        }}>
                          {pruefung.stil_name}
                        </span>
                      </td>
                      <td>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: pruefung.farbe_nachher || 'rgba(255, 255, 255, 0.1)',
                              border: '2px solid rgba(255, 255, 255, 0.3)',
                              flexShrink: 0
                            }}
                            title={pruefung.graduierung_nachher}
                          />
                          <span style={{
                            fontSize: '0.875rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '600'
                          }}>
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
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                            className="btn btn-sm btn-danger"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem'
                            }}
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
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Abgeschlossene Prüfungen ({abgeschlossenePruefungen.length})</h2>

            {/* Stilfilter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>
                Stil:
              </span>
              <select
                value={abgeschlosseneStilFilter}
                onChange={(e) => setAbgeschlosseneStilFilter(e.target.value)}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#1a1a1a',
                  color: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  outline: 'none'
                }}
              >
                <option value="all" style={{ backgroundColor: '#1a1a1a', color: 'rgba(255, 255, 255, 0.9)' }}>
                  Alle Stile
                </option>
                {stile.map(stil => (
                  <option
                    key={stil.stil_id}
                    value={stil.stil_id}
                    style={{ backgroundColor: '#1a1a1a', color: 'rgba(255, 255, 255, 0.9)' }}
                  >
                    {stil.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>Lädt...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th
                      style={{ color: '#EAB308', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('name')}
                    >
                      Name <SortIcon columnKey="name" />
                    </th>
                    <th
                      style={{ color: '#EAB308', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('stil_name')}
                    >
                      Stil <SortIcon columnKey="stil_name" />
                    </th>
                    <th
                      style={{ color: '#EAB308', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('graduierung_nachher')}
                    >
                      Graduierung <SortIcon columnKey="graduierung_nachher" />
                    </th>
                    <th
                      style={{ color: '#EAB308', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('pruefungsdatum')}
                    >
                      Datum <SortIcon columnKey="pruefungsdatum" />
                    </th>
                    <th
                      style={{ color: '#EAB308', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('bestanden')}
                    >
                      Ergebnis <SortIcon columnKey="bestanden" />
                    </th>
                    <th style={{ color: '#EAB308' }}>Aktionen</th>
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
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.4rem 0.6rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          color: 'rgba(255, 255, 255, 0.8)',
                          border: '1px solid rgba(255, 215, 0, 0.2)'
                        }}>
                          {pruefung.stil_name}
                        </span>
                      </td>
                      <td>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: pruefung.farbe_nachher || 'rgba(255, 255, 255, 0.1)',
                              border: '2px solid rgba(255, 255, 255, 0.3)',
                              flexShrink: 0
                            }}
                            title={pruefung.graduierung_nachher}
                          />
                          <span style={{
                            fontSize: '0.85rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontWeight: '500'
                          }}>
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
                            <div style={{
                              fontSize: '0.75rem',
                              color: 'rgba(255, 255, 255, 0.5)',
                              marginTop: '0.25rem'
                            }}>
                              {pruefung.punktzahl} / {pruefung.max_punktzahl} Pkt.
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button className="btn btn-sm btn-secondary">
                            <Download size={16} /> Urkunde
                          </button>
                          <button
                            onClick={() => handleStatusAendern(pruefung)}
                            className="btn btn-sm btn-warning"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem'
                            }}
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
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Prüfungsstatistiken</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <h3 style={{ fontSize: '0.75rem', margin: '0 0 0.375rem 0', color: 'rgba(255, 255, 255, 0.7)' }}>Gesamt</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                {statistiken.gesamt.gesamt}
              </div>
              <div style={{ fontSize: '0.625rem', color: 'rgba(255, 255, 255, 0.5)' }}>Prüfungen</div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <h3 style={{ fontSize: '0.75rem', margin: '0 0 0.375rem 0', color: 'rgba(255, 255, 255, 0.7)' }}>Bestanden</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                {statistiken.gesamt.bestanden}
              </div>
              <div style={{ fontSize: '0.625rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                {statistiken.gesamt.gesamt > 0
                  ? `${Math.round((statistiken.gesamt.bestanden / statistiken.gesamt.gesamt) * 100)}% Quote`
                  : '0% Quote'}
              </div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <h3 style={{ fontSize: '0.75rem', margin: '0 0 0.375rem 0', color: 'rgba(255, 255, 255, 0.7)' }}>Nicht bestanden</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>
                {statistiken.gesamt.nicht_bestanden}
              </div>
              <div style={{ fontSize: '0.625rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                {statistiken.gesamt.gesamt > 0
                  ? `${Math.round((statistiken.gesamt.nicht_bestanden / statistiken.gesamt.gesamt) * 100)}%`
                  : '0%'}
              </div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <h3 style={{ fontSize: '0.75rem', margin: '0 0 0.375rem 0', color: 'rgba(255, 255, 255, 0.7)' }}>Geplant</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
                {statistiken.gesamt.geplant}
              </div>
              <div style={{ fontSize: '0.625rem', color: 'rgba(255, 255, 255, 0.5)' }}>Anstehend</div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <h3 style={{ fontSize: '0.75rem', margin: '0 0 0.375rem 0', color: 'rgba(255, 255, 255, 0.7)' }}>Kandidaten</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
                {kandidaten.length}
              </div>
              <div style={{ fontSize: '0.625rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                {kandidaten.filter(k => k.berechtigt).length} berechtigt
              </div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <h3 style={{ fontSize: '0.75rem', margin: '0 0 0.375rem 0', color: 'rgba(255, 255, 255, 0.7)' }}>Ø Punktzahl</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                {(() => {
                  const bestandenePruefungen = abgeschlossenePruefungen.filter(p => p.bestanden && p.punktzahl && p.max_punktzahl);
                  const avgPunktzahl = bestandenePruefungen.length > 0
                    ? bestandenePruefungen.reduce((sum, p) => sum + ((p.punktzahl / p.max_punktzahl) * 100), 0) / bestandenePruefungen.length
                    : 0;
                  return avgPunktzahl.toFixed(0);
                })()}%
              </div>
              <div style={{ fontSize: '0.625rem', color: 'rgba(255, 255, 255, 0.5)' }}>Bestanden</div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <h3 style={{ fontSize: '0.75rem', margin: '0 0 0.375rem 0', color: 'rgba(255, 255, 255, 0.7)' }}>Ø Training</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                {(() => {
                  const avgTrainingsstunden = kandidaten.length > 0
                    ? kandidaten.reduce((sum, k) => sum + (k.trainingsstunden || 0), 0) / kandidaten.length
                    : 0;
                  return avgTrainingsstunden.toFixed(0);
                })()}h
              </div>
              <div style={{ fontSize: '0.625rem', color: 'rgba(255, 255, 255, 0.5)' }}>Kandidaten</div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <h3 style={{ fontSize: '0.75rem', margin: '0 0 0.375rem 0', color: 'rgba(255, 255, 255, 0.7)' }}>Ø Monate</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#06b6d4' }}>
                {(() => {
                  const avgMonate = kandidaten.length > 0
                    ? kandidaten.reduce((sum, k) => sum + (k.monate_seit_letzter || 0), 0) / kandidaten.length
                    : 0;
                  return avgMonate.toFixed(0);
                })()}
              </div>
              <div style={{ fontSize: '0.625rem', color: 'rgba(255, 255, 255, 0.5)' }}>Seit letzter</div>
            </div>
          </div>

          <h3>Nach Stil</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ color: '#EAB308' }}>Stil</th>
                  <th style={{ color: '#EAB308' }}>Anzahl Prüfungen</th>
                  <th style={{ color: '#EAB308' }}>Bestanden</th>
                  <th style={{ color: '#EAB308' }}>Erfolgsquote</th>
                </tr>
              </thead>
              <tbody>
                {statistiken.nach_stil.map((stat, index) => (
                  <tr key={index}>
                    <td><strong>{stat.stil_name}</strong></td>
                    <td>{stat.anzahl}</td>
                    <td>{stat.bestanden}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${(stat.bestanden / stat.anzahl) * 100}%`,
                              height: '100%',
                              backgroundColor: '#10b981'
                            }}
                          />
                        </div>
                        <span style={{ fontWeight: 'bold' }}>
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
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Prüfungen nach Graduierung</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
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
                    <div key={grad} className="stat-card" style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: stats.farbe || 'rgba(255, 255, 255, 0.1)',
                            border: '2px solid rgba(255, 255, 255, 0.3)'
                          }}
                        />
                        <h4 style={{ margin: 0, fontSize: '0.875rem' }}>{grad}</h4>
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#EAB308', marginBottom: '0.25rem' }}>
                        {stats.gesamt}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                        {stats.bestanden} bestanden ({Math.round((stats.bestanden / stats.gesamt) * 100)}%)
                      </div>
                    </div>
                  ));
              })()}
            </div>
          </div>

          {/* Gurtverteilung */}
          {statistiken.gurtverteilung && statistiken.gurtverteilung.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Aktuelle Gurtverteilung</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {statistiken.gurtverteilung.map((gurt, index) => (
                  <div key={index} className="stat-card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      {/* Gürtel-Darstellung horizontal mit abgerundeten Enden wie im Bild */}
                      <div style={{
                        width: '50px',
                        height: '18px',
                        backgroundColor: gurt.farbe || '#CCCCCC',
                        borderRadius: '9px',
                        boxShadow: '0 3px 10px rgba(0, 0, 0, 0.4)',
                        flexShrink: 0,
                        border: '1.5px solid rgba(0, 0, 0, 0.2)'
                      }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: 'rgba(255, 255, 255, 0.95)' }}>{gurt.graduierung_name}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>{gurt.stil_name}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#EAB308', marginBottom: '0.25rem' }}>
                      {gurt.anzahl}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                      {gurt.anzahl === 1 ? 'Mitglied' : 'Mitglieder'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monatliche Entwicklung */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Prüfungen der letzten 12 Monate</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ color: '#EAB308' }}>Monat</th>
                    <th style={{ color: '#EAB308' }}>Gesamt</th>
                    <th style={{ color: '#EAB308' }}>Bestanden</th>
                    <th style={{ color: '#EAB308' }}>Nicht bestanden</th>
                    <th style={{ color: '#EAB308' }}>Erfolgsquote</th>
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
                        <td style={{ color: '#10b981' }}>{stat.bestanden}</td>
                        <td style={{ color: '#ef4444' }}>{stat.nichtBestanden}</td>
                        <td>
                          {stat.gesamt > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: 1, height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${(stat.bestanden / stat.gesamt) * 100}%`,
                                    height: '100%',
                                    backgroundColor: '#10b981'
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                                {Math.round((stat.bestanden / stat.gesamt) * 100)}%
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>-</span>
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
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Prüfungs-Insights</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              {/* Beste Erfolgsquote nach Stil */}
              <div className="stat-card">
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#EAB308' }}>🏆 Beste Erfolgsquote</h4>
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
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '0.5rem' }}>
                        {bestStil.stil_name}
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
                        {Math.round((bestStil.bestanden / bestStil.anzahl) * 100)}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.5rem' }}>
                        {bestStil.bestanden} von {bestStil.anzahl} Prüfungen bestanden
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Keine Daten vorhanden</div>
                  );
                })()}
              </div>

              {/* Aktivster Monat */}
              <div className="stat-card">
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#EAB308' }}>📊 Aktivster Monat</h4>
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
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '0.5rem' }}>
                        {aktivsterMonat[0]}
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                        {aktivsterMonat[1]}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.5rem' }}>
                        Prüfungen durchgeführt
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Keine Daten vorhanden</div>
                  );
                })()}
              </div>

              {/* Nächste geplante Prüfung */}
              <div className="stat-card">
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#EAB308' }}>📅 Nächste Prüfung</h4>
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
                    return <div style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Keine geplanten Prüfungen</div>;
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
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '0.5rem' }}>
                        {new Date(naechste.datum).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                      <div style={{ fontSize: '1rem', color: '#f59e0b', marginTop: '0.5rem' }}>
                        {naechste.stil}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.5rem' }}>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>Prüfungsergebnis eintragen</h2>
            <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
              <strong style={{ color: 'rgba(255, 255, 255, 0.95)' }}>{selectedPruefung.vorname} {selectedPruefung.nachname}</strong> - {selectedPruefung.stil_name}
            </p>

            {/* Bestanden Checkbox mit visueller Hervorhebung */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                backgroundColor: pruefungsErgebnis.bestanden ? '#d1fae5' : '#fee2e2',
                borderRadius: '0.5rem',
                border: `2px solid ${pruefungsErgebnis.bestanden ? '#10b981' : '#ef4444'}`,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}>
                <input
                  type="checkbox"
                  checked={pruefungsErgebnis.bestanden}
                  onChange={(e) => setPruefungsErgebnis({ ...pruefungsErgebnis, bestanden: e.target.checked })}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#10b981' }}
                />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '1.1rem', color: pruefungsErgebnis.bestanden ? '#065f46' : '#991b1b' }}>
                    {pruefungsErgebnis.bestanden ? '✓ Prüfung bestanden' : '✗ Prüfung nicht bestanden'}
                  </strong>
                </div>
              </label>
            </div>

            {/* Punktzahl */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
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
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ marginBottom: '0.5rem', display: 'block', fontWeight: '600' }}>
                Gurt nach Prüfung
                <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
                  (↑↓ Pfeiltasten zum Navigieren)
                </span>
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                border: '2px solid #e5e7eb'
              }}>
                {/* Pfeil nach unten */}
                <button
                  type="button"
                  onClick={() => handleGraduierungAendern('down')}
                  className="btn btn-sm btn-secondary"
                  style={{
                    padding: '0.5rem',
                    minWidth: 'auto',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  disabled={pruefungsErgebnis.graduierung_nachher_index === 0}
                >
                  <ChevronDown size={20} />
                </button>

                {/* Gurt-Anzeige */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem 1rem',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)',
                  borderRadius: '0.5rem',
                  border: '2px solid #d1d5db',
                  minHeight: '60px'
                }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: pruefungsErgebnis.graduierung_nachher_farbe || '#e5e7eb',
                      border: '3px solid #fff',
                      boxShadow: '0 3px 12px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.4)',
                      flexShrink: 0,
                      position: 'relative'
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), transparent)`,
                      pointerEvents: 'none'
                    }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      color: '#111827',
                      marginBottom: '0.25rem'
                    }}>
                      {pruefungsErgebnis.graduierung_nachher_name || 'Keine Auswahl'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
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
                  className="btn btn-sm btn-secondary"
                  style={{
                    padding: '0.5rem',
                    minWidth: 'auto',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  disabled={pruefungsErgebnis.graduierung_nachher_index === graduierungenFuerModal.length - 1}
                >
                  <ChevronUp size={20} />
                </button>
              </div>
            </div>

            {/* Prüfer-Kommentar */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
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
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#eff6ff',
              borderRadius: '0.5rem',
              border: '1px solid #bfdbfe',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                <strong>⌨️ Tastenkombinationen:</strong>
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#3b82f6', marginTop: '0.25rem' }}>
                ↑↓ Pfeiltasten = Gurt wechseln • Strg+Enter = Speichern
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowErgebnisModal(false)} className="btn btn-secondary">
                Abbrechen
              </button>
              <button onClick={handleErgebnisEintragen} className="btn btn-primary">
                <Check size={18} style={{ marginRight: '0.5rem' }} />
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
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <h2 style={{ marginBottom: '0.5rem' }}>Pruefungsergebnisse eintragen</h2>
            <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
              <strong style={{ color: 'rgba(255, 255, 255, 0.95)' }}>
                {new Date(batchTermin.datum).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </strong>
              {' - '}
              <span style={{ color: '#EAB308' }}>{batchTermin.stil_name}</span>
              {' - '}
              {batchTermin.anzahl} Teilnehmer
            </p>

            {/* Schnellauswahl */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              marginBottom: '1.5rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(255, 215, 0, 0.1)',
              borderRadius: '0.5rem',
              border: '1px solid rgba(255, 215, 0, 0.3)'
            }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.8)', marginRight: '0.5rem' }}>Schnellauswahl:</span>
              <button
                onClick={() => setBatchAlleBestanden(true)}
                className="btn btn-sm"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.3)',
                  color: '#22c55e',
                  border: '1px solid rgba(34, 197, 94, 0.5)',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.8125rem'
                }}
              >
                <Check size={14} style={{ marginRight: '0.25rem' }} />
                Alle bestanden
              </button>
              <button
                onClick={() => setBatchAlleBestanden(false)}
                className="btn btn-sm"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.8125rem'
                }}
              >
                <X size={14} style={{ marginRight: '0.25rem' }} />
                Alle nicht bestanden
              </button>
            </div>

            {/* Teilnehmer-Liste */}
            <div className="table-container">
              <table className="data-table" style={{ fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '200px', color: '#EAB308' }}>Name</th>
                    <th style={{ minWidth: '120px', color: '#EAB308' }}>Aktueller Gurt</th>
                    <th style={{ minWidth: '120px', color: '#EAB308' }}>Neuer Gurt</th>
                    <th style={{ minWidth: '130px', color: '#EAB308', textAlign: 'center' }}>Ergebnis</th>
                    <th style={{ minWidth: '100px', color: '#EAB308' }}>Punkte</th>
                    <th style={{ minWidth: '180px', color: '#EAB308' }}>Kommentar</th>
                  </tr>
                </thead>
                <tbody>
                  {batchTermin.pruefungen.map((pruefung) => {
                    const ergebnis = batchErgebnisse[pruefung.pruefung_id] || { bestanden: true, punktzahl: '', prueferkommentar: '' };
                    return (
                      <tr key={pruefung.pruefung_id} style={{
                        backgroundColor: ergebnis.bestanden ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'
                      }}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                            <span style={{ fontWeight: '700', color: 'rgba(255, 255, 255, 0.95)' }}>
                              {pruefung.vorname} {pruefung.nachname}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              ID: {pruefung.mitglied_id}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: pruefung.farbe_vorher || '#6b7280',
                              border: '2px solid rgba(255, 255, 255, 0.3)'
                            }} />
                            <span style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                              {pruefung.graduierung_vorher || 'Keine'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: ergebnis.bestanden ? (pruefung.farbe_nachher || '#EAB308') : '#6b7280',
                              border: '2px solid rgba(255, 255, 255, 0.3)',
                              opacity: ergebnis.bestanden ? 1 : 0.5
                            }} />
                            <span style={{
                              fontSize: '0.8125rem',
                              color: ergebnis.bestanden ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)',
                              textDecoration: ergebnis.bestanden ? 'none' : 'line-through'
                            }}>
                              {pruefung.graduierung_nachher}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.375rem 0.75rem',
                            backgroundColor: ergebnis.bestanden ? '#d1fae5' : '#fee2e2',
                            borderRadius: '0.375rem',
                            border: `2px solid ${ergebnis.bestanden ? '#10b981' : '#ef4444'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}>
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
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#10b981' }}
                            />
                            <span style={{
                              fontWeight: '600',
                              fontSize: '0.8125rem',
                              color: ergebnis.bestanden ? '#065f46' : '#991b1b'
                            }}>
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
                            className="form-input"
                            style={{ padding: '0.375rem', fontSize: '0.8125rem' }}
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
                            className="form-input"
                            style={{ padding: '0.375rem', fontSize: '0.8125rem' }}
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
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div>
                  <span style={{ color: '#22c55e', fontWeight: '700', fontSize: '1.25rem' }}>
                    {Object.values(batchErgebnisse).filter(e => e.bestanden).length}
                  </span>
                  <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>Bestanden</span>
                </div>
                <div>
                  <span style={{ color: '#ef4444', fontWeight: '700', fontSize: '1.25rem' }}>
                    {Object.values(batchErgebnisse).filter(e => !e.bestanden).length}
                  </span>
                  <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>Nicht bestanden</span>
                </div>
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Bestehensquote: {Math.round((Object.values(batchErgebnisse).filter(e => e.bestanden).length / Object.values(batchErgebnisse).length) * 100)}%
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
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
                    <Check size={18} style={{ marginRight: '0.5rem' }} />
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          overflowY: 'auto'
        }} onClick={() => { setShowNeuerTerminModal(false); setTerminStep(1); }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1a1a1a',
              borderRadius: '0 0 12px 12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              border: '1px solid #333',
              borderTop: 'none',
              maxWidth: '750px',
              width: '90%',
              margin: '0 auto 20px',
              color: '#e5e5e5'
            }}
          >
            {/* Header */}
            <div style={{ padding: '1.5rem 2rem 1rem', borderBottom: '1px solid #333' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#EAB308' }}>
                Neuer Prüfungstermin
              </h2>
            </div>

            {/* Progress Bar */}
            <div style={{
              display: 'flex',
              padding: '1.5rem 2rem',
              background: '#0a0a0a',
              borderBottom: '1px solid #333'
            }}>
              {[
                { num: 1, label: 'Grunddaten' },
                { num: 2, label: 'Organisation' },
                { num: 3, label: 'Zusatzinfos' }
              ].map((step, idx) => (
                <div key={step.num} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  {/* Connecting Line */}
                  {idx > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '15px',
                      left: '-50%',
                      right: '50%',
                      height: '2px',
                      background: terminStep > step.num - 1 ? '#EAB308' : '#333'
                    }} />
                  )}

                  {/* Circle */}
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: terminStep >= step.num ? '#EAB308' : '#2a2a2a',
                    color: terminStep >= step.num ? '#000' : '#666',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    border: `2px solid ${terminStep >= step.num ? '#EAB308' : '#333'}`,
                    position: 'relative',
                    zIndex: 2
                  }}>
                    {step.num}
                  </div>

                  {/* Label */}
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    color: terminStep === step.num ? '#EAB308' : '#999',
                    fontWeight: terminStep === step.num ? '600' : '400',
                    textAlign: 'center'
                  }}>
                    {step.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Content */}
            <div style={{ padding: '2rem', minHeight: '300px' }}>
              {/* Step 1: Grunddaten */}
              {terminStep === 1 && (
                <div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                      Kampfkunst-Stil *
                    </label>
                    <select
                      value={neuerTermin.stil_id}
                      onChange={(e) => setNeuerTermin({ ...neuerTermin, stil_id: e.target.value })}
                      style={{
                        padding: '0.6rem',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        fontSize: '0.95rem',
                        width: '100%',
                        background: '#2a2a2a',
                        color: '#e5e5e5'
                      }}
                    >
                      <option value="" style={{ background: '#2a2a2a', color: '#e5e5e5' }}>Bitte wählen...</option>
                      {stile.map(stil => (
                        <option key={stil.stil_id} value={stil.stil_id} style={{ background: '#2a2a2a', color: '#e5e5e5' }}>{stil.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                        Prüfungsdatum *
                      </label>
                      <input
                        type="date"
                        value={neuerTermin.pruefungsdatum}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefungsdatum: e.target.value })}
                        style={{
                          padding: '0.6rem',
                          border: '1px solid #444',
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          width: '100%',
                          background: '#2a2a2a',
                          color: '#e5e5e5'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                        Uhrzeit
                      </label>
                      <input
                        type="time"
                        value={neuerTermin.pruefungszeit}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefungszeit: e.target.value })}
                        style={{
                          padding: '0.6rem',
                          border: '1px solid #444',
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          width: '100%',
                          background: '#2a2a2a',
                          color: '#e5e5e5'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                        Prüfungsort
                      </label>
                      <input
                        type="text"
                        value={neuerTermin.pruefungsort}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefungsort: e.target.value })}
                        placeholder="z.B. Dojo Haupthalle"
                        style={{
                          padding: '0.6rem',
                          border: '1px solid #444',
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          width: '100%',
                          background: '#2a2a2a',
                          color: '#e5e5e5'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                        Prüfer
                      </label>
                      <input
                        type="text"
                        value={neuerTermin.pruefer_name}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefer_name: e.target.value })}
                        placeholder="z.B. Meister Schmidt"
                        style={{
                          padding: '0.6rem',
                          border: '1px solid #444',
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          width: '100%',
                          background: '#2a2a2a',
                          color: '#e5e5e5'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Organisation */}
              {terminStep === 2 && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                        Prüfungsgebühr (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={neuerTermin.pruefungsgebuehr}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefungsgebuehr: e.target.value })}
                        placeholder="0.00"
                        style={{
                          padding: '0.6rem',
                          border: '1px solid #444',
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          width: '100%',
                          background: '#2a2a2a',
                          color: '#e5e5e5'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                        Anmeldefrist
                      </label>
                      <input
                        type="date"
                        value={neuerTermin.anmeldefrist}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, anmeldefrist: e.target.value })}
                        style={{
                          padding: '0.6rem',
                          border: '1px solid #444',
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          width: '100%',
                          background: '#2a2a2a',
                          color: '#e5e5e5'
                        }}
                      />
                    </div>
                  </div>
                  {/* Validierungshinweis */}
                  {neuerTermin.anmeldefrist && neuerTermin.pruefungsdatum &&
                   new Date(neuerTermin.anmeldefrist) > new Date(neuerTermin.pruefungsdatum) && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: '#4a1515',
                      border: '1px solid #8b2020',
                      borderRadius: '6px',
                      color: '#ff6b6b',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                      <span>Die Anmeldefrist muss vor dem Prüfungsdatum liegen. Bitte passen Sie das Datum an.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Zusatzinfos */}
              {terminStep === 3 && (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                      Bemerkungen
                    </label>
                    <textarea
                      value={neuerTermin.bemerkungen}
                      onChange={(e) => setNeuerTermin({ ...neuerTermin, bemerkungen: e.target.value })}
                      placeholder="Zusätzliche Informationen..."
                      rows="3"
                      style={{
                        padding: '0.6rem',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        fontSize: '0.95rem',
                        width: '100%',
                        background: '#2a2a2a',
                        color: '#e5e5e5',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                      Teilnahmebedingungen
                    </label>
                    <textarea
                      value={neuerTermin.teilnahmebedingungen}
                      onChange={(e) => setNeuerTermin({ ...neuerTermin, teilnahmebedingungen: e.target.value })}
                      placeholder="Bedingungen für Teilnehmer..."
                      rows="4"
                      style={{
                        padding: '0.6rem',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        fontSize: '0.95rem',
                        width: '100%',
                        background: '#2a2a2a',
                        color: '#e5e5e5',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div style={{ padding: '1rem 2rem', borderTop: '1px solid #333', display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
              <button
                onClick={() => { setShowNeuerTerminModal(false); setTerminStep(1); }}
                style={{
                  padding: '0.6rem 1.2rem',
                  border: '1px solid #555',
                  borderRadius: '6px',
                  background: '#2a2a2a',
                  color: '#e5e5e5',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Abbrechen
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {terminStep > 1 && (
                  <button
                    onClick={() => setTerminStep(terminStep - 1)}
                    style={{
                      padding: '0.6rem 1.2rem',
                      border: '1px solid #555',
                      borderRadius: '6px',
                      background: '#2a2a2a',
                      color: '#e5e5e5',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
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
                    style={{
                      padding: '0.6rem 1.2rem',
                      border: 'none',
                      borderRadius: '6px',
                      background: (
                        (terminStep === 1 && (!neuerTermin.stil_id || !neuerTermin.pruefungsdatum)) ||
                        (terminStep === 2 && neuerTermin.anmeldefrist && neuerTermin.pruefungsdatum &&
                         new Date(neuerTermin.anmeldefrist) > new Date(neuerTermin.pruefungsdatum))
                      ) ? '#555' : '#EAB308',
                      color: (
                        (terminStep === 1 && (!neuerTermin.stil_id || !neuerTermin.pruefungsdatum)) ||
                        (terminStep === 2 && neuerTermin.anmeldefrist && neuerTermin.pruefungsdatum &&
                         new Date(neuerTermin.anmeldefrist) > new Date(neuerTermin.pruefungsdatum))
                      ) ? '#888' : '#000',
                      cursor: (
                        (terminStep === 1 && (!neuerTermin.stil_id || !neuerTermin.pruefungsdatum)) ||
                        (terminStep === 2 && neuerTermin.anmeldefrist && neuerTermin.pruefungsdatum &&
                         new Date(neuerTermin.anmeldefrist) > new Date(neuerTermin.pruefungsdatum))
                      ) ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}
                  >
                    Weiter
                  </button>
                ) : (
                  <button
                    onClick={() => { handleNeuerTerminErstellen(); setTerminStep(1); }}
                    style={{
                      padding: '0.6rem 1.2rem',
                      border: 'none',
                      borderRadius: '6px',
                      background: '#EAB308',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}
                  >
                    <Calendar size={18} style={{ marginRight: '0.5rem', display: 'inline' }} />
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '0',
          overflowY: 'auto'
        }} onClick={() => setShowEditTerminModal(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1a1a1a',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              border: '1px solid #333',
              maxWidth: '850px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem',
              margin: '0 auto 20px',
              color: '#e5e5e5'
            }}
          >
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: '700', color: '#e5e5e5' }}>Prüfungstermin bearbeiten</h2>
            <p style={{ marginBottom: '2rem', color: '#999', fontSize: '0.9rem' }}>
              Bearbeiten Sie die Details des Prüfungstermins.
            </p>

            {/* Grunddaten */}
            <h3 style={{
              color: '#EAB308',
              marginTop: '0',
              marginBottom: '1rem',
              fontSize: '1.1rem',
              borderBottom: '2px solid #EAB308',
              paddingBottom: '0.5rem',
              fontWeight: '600',
              background: 'transparent'
            }}>Grunddaten</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem 1rem', marginBottom: '1.5rem' }}>
              {/* Stil-Auswahl */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontWeight: 600, marginBottom: '0.4rem', color: '#e5e5e5', fontSize: '0.85rem', display: 'block' }}>
                  Kampfkunst-Stil *
                </label>
                <select
                  value={editTermin.stil_id}
                  onChange={(e) => setEditTermin({ ...editTermin, stil_id: e.target.value })}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    width: '100%',
                    background: '#2a2a2a',
                    color: '#e5e5e5'
                  }}
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
                <label style={{ fontWeight: 600, marginBottom: '0.4rem', color: '#e5e5e5', fontSize: '0.85rem', display: 'block' }}>
                  Prüfungsdatum *
                </label>
                <input
                  type="date"
                  value={editTermin.pruefungsdatum}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefungsdatum: e.target.value })}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    width: '100%',
                    background: '#2a2a2a',
                    color: '#e5e5e5'
                  }}
                  required
                />
              </div>

              {/* Uhrzeit */}
              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.4rem', color: '#e5e5e5', fontSize: '0.85rem', display: 'block' }}>
                  Uhrzeit
                </label>
                <input
                  type="time"
                  value={editTermin.pruefungszeit}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefungszeit: e.target.value })}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    width: '100%',
                    background: '#2a2a2a',
                    color: '#e5e5e5'
                  }}
                />
              </div>

              {/* Prüfungsort */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontWeight: 600, marginBottom: '0.4rem', color: '#e5e5e5', fontSize: '0.85rem', display: 'block' }}>
                  Prüfungsort
                </label>
                <input
                  type="text"
                  value={editTermin.pruefungsort}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefungsort: e.target.value })}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    width: '100%',
                    background: '#2a2a2a',
                    color: '#e5e5e5'
                  }}
                  placeholder="z.B. Dojo Haupthalle, Sporthalle XYZ"
                />
              </div>
            </div>

            {/* Organisatorisches */}
            <h3 style={{
              color: '#EAB308',
              marginTop: '1.5rem',
              marginBottom: '1rem',
              fontSize: '1.1rem',
              borderBottom: '2px solid #EAB308',
              paddingBottom: '0.5rem',
              fontWeight: '600',
              background: 'transparent'
            }}>Organisatorisches</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem 1rem', marginBottom: '1.5rem' }}>
              {/* Prüfungsgebühr */}
              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.4rem', color: '#e5e5e5', fontSize: '0.85rem', display: 'block' }}>
                  Prüfungsgebühr (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editTermin.pruefungsgebuehr}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefungsgebuehr: e.target.value })}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    width: '100%',
                    background: '#2a2a2a',
                    color: '#e5e5e5'
                  }}
                  placeholder="0.00"
                />
              </div>

              {/* Anmeldefrist */}
              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.4rem', color: '#e5e5e5', fontSize: '0.85rem', display: 'block' }}>
                  Anmeldefrist
                </label>
                <input
                  type="date"
                  value={editTermin.anmeldefrist}
                  onChange={(e) => setEditTermin({ ...editTermin, anmeldefrist: e.target.value })}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    width: '100%',
                    background: '#2a2a2a',
                    color: '#e5e5e5'
                  }}
                />
              </div>
            </div>

            {/* Zusätzliche Informationen */}
            <h3 style={{
              color: '#EAB308',
              marginTop: '1.5rem',
              marginBottom: '1rem',
              fontSize: '1.1rem',
              borderBottom: '2px solid #EAB308',
              paddingBottom: '0.5rem',
              fontWeight: '600',
              background: 'transparent'
            }}>Zusätzliche Informationen</h3>

            <div style={{ display: 'grid', gap: '0.8rem', marginBottom: '1.5rem' }}>
              {/* Bemerkungen */}
              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.4rem', color: '#e5e5e5', fontSize: '0.85rem', display: 'block' }}>
                  Bemerkungen
                </label>
                <textarea
                  value={editTermin.bemerkungen}
                  onChange={(e) => setEditTermin({ ...editTermin, bemerkungen: e.target.value })}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    width: '100%',
                    minHeight: '70px',
                    resize: 'vertical',
                    background: '#2a2a2a',
                    color: '#e5e5e5',
                    fontFamily: 'inherit'
                  }}
                  rows="2"
                  placeholder="Zusätzliche Informationen zur Prüfung..."
                />
              </div>

              {/* Teilnahmebedingungen */}
              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.4rem', color: '#e5e5e5', fontSize: '0.85rem', display: 'block' }}>
                  Teilnahmebedingungen
                </label>
                <textarea
                  value={editTermin.teilnahmebedingungen}
                  onChange={(e) => setEditTermin({ ...editTermin, teilnahmebedingungen: e.target.value })}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    width: '100%',
                    minHeight: '90px',
                    resize: 'vertical',
                    background: '#2a2a2a',
                    color: '#e5e5e5',
                    fontFamily: 'inherit'
                  }}
                  rows="3"
                  placeholder="Beispiel:&#10;- Vollständige Trainingsausrüstung mitbringen&#10;- Pünktliches Erscheinen erforderlich&#10;- Prüfungsgebühr vorab überweisen"
                />
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', background: 'transparent' }}>
              <button
                onClick={() => setShowEditTerminModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #555',
                  borderRadius: '6px',
                  background: '#2a2a2a',
                  color: '#e5e5e5',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#333'}
                onMouseOut={(e) => e.target.style.background = '#2a2a2a'}
              >
                Abbrechen
              </button>
              <button
                onClick={handleTerminAktualisieren}
                disabled={!editTermin.pruefungsdatum}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '6px',
                  background: !editTermin.pruefungsdatum ? '#555' : '#EAB308',
                  color: !editTermin.pruefungsdatum ? '#888' : '#000',
                  cursor: !editTermin.pruefungsdatum ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!e.target.disabled) e.target.style.background = '#F59E0B';
                }}
                onMouseOut={(e) => {
                  if (!e.target.disabled) e.target.style.background = '#EAB308';
                }}
              >
                <Edit size={18} style={{ marginRight: '0.5rem' }} />
                Änderungen speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PruefungsVerwaltung;
