import React, { useState, useEffect } from "react";
import axios from "axios";
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Anwesenheit.css";
import config from '../config/config.js';

const Anwesenheit = () => {
  const { updateTrigger } = useMitgliederUpdate(); // 🔄 Automatische Updates nach Mitgliedsanlage
  const [stundenplan, setStundenplan] = useState([]);
  const [ausgewaehlteStunde, setAusgewaehlteStunde] = useState(null);
  const [ausgewaehltesDatum, setAusgewaehltesDatum] = useState(() => new Date().toISOString().split("T")[0]);
  const [mitglieder, setMitglieder] = useState([]);
  const [anwesenheit, setAnwesenheit] = useState({});
  const [gefilterteStunden, setGefilterteStunden] = useState([]);
  const [suchbegriff, setSuchbegriff] = useState("");
  const [nurNichtAnwesend, setNurNichtAnwesend] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});
  
  // NEU: Check-in Integration
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [showStyleOnly, setShowStyleOnly] = useState(false); // NEU: Stil-Filter (ohne Gruppe)
  const [kurseStats, setKurseStats] = useState({});
  const [loading, setLoading] = useState(false);

  // 🆕 NEU: Intelligente Suche
  const [allMembersForSearch, setAllMembersForSearch] = useState([]);
  const [isSearchActive, setIsSearchActive] = useState(false);

  // NEU: Kurse für Datum laden statt Stundenplan
  useEffect(() => {
    loadKurseForDate(ausgewaehltesDatum);
  }, [ausgewaehltesDatum]);

  // Hilfsfunktion für sichere API-Aufrufe mit Fehlerbehandlung
  const fetchKursMitglieder = async (url) => {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Fehler beim Laden der Kursmitglieder:", error);
      throw error;
    }
  };

  // 🔧 FIX: Statistiken basierend auf aktuellen Daten berechnen
  const berechneKursStatistiken = (stundenplan_id) => {
    const istAusgewaehlt = ausgewaehlteStunde && 
      (ausgewaehlteStunde.stundenplan_id || ausgewaehlteStunde.id) === stundenplan_id;
    
    // Nur Statistiken anzeigen wenn Kurs ausgewählt UND Daten vollständig geladen sind
    if (istAusgewaehlt && mitglieder.length > 0 && !loading) {
      // Für ausgewählten Kurs: Aktuelle Frontend-Daten verwenden
      const aktiveCheckins = mitglieder.filter(m => m.checkin_status === 'eingecheckt').length;
      const anwesendeHeute = Object.values(anwesenheit).filter(a => a.status === 'anwesend').length;

      return {
        checkins_heute: anwesendeHeute,
        aktive_checkins: aktiveCheckins,
        showStats: true
      };
    }
    
    // Während des Ladens oder für nicht-ausgewählte Kurse: Ladeanzeige oder Platzhalter
    if (istAusgewaehlt && loading) {
      return {
        checkins_heute: 0,
        aktive_checkins: 0,
        showStats: false,
        loading: true
      };
    }
    
    // Für nicht-ausgewählte Kurse: Keine Statistiken anzeigen
    return {
      checkins_heute: 0,
      aktive_checkins: 0,
      showStats: false
    };
  };

  const loadKurseForDate = async (datum) => {
    try {
      setLoading(true);

      const response = await axios.get(`/anwesenheit/kurse/${datum}`);
      const data = response.data;
      
      if (data.success) {
        setGefilterteStunden(data.kurse);
        
        // Statistiken für jeden Kurs sammeln (als Fallback)
        const stats = {};
        data.kurse.forEach(kurs => {
          stats[kurs.stundenplan_id] = {
            checkins_heute: kurs.checkins_heute,
            aktive_checkins: kurs.aktive_checkins
          };
        });
        setKurseStats(stats);
      } else {
        setGefilterteStunden([]);
        setKurseStats({});
      }
    } catch (error) {
      console.error("❌ Fehler beim Laden der Kurse:", error);
      setGefilterteStunden([]);
      setKurseStats({});
    } finally {
      setLoading(false);
    }
  };

  const getWochentagName = (datumStr) => {
    const tage = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    return tage[new Date(datumStr).getDay()];
  };

  const handleDatumWechsel = (neuesDatum) => {
    setAusgewaehltesDatum(neuesDatum);
    setAusgewaehlteStunde(null);
    setMitglieder([]);
    setAnwesenheit({});
    setShowAllMembers(false);
    setShowStyleOnly(false); // NEU: Stil-Filter zurücksetzen
    // 🆕 Suche zurücksetzen
    setSuchbegriff("");
    setAllMembersForSearch([]);
    setIsSearchActive(false);
    loadKurseForDate(neuesDatum);
  };

  // Neue Funktion: Berechnet das Datum des gewünschten Wochentags in der aktuellen Woche
  const handleWochentagClick = (tagName) => {
    const tage = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    const targetIndex = tage.indexOf(tagName);
    const today = new Date();
    const currentDayIndex = today.getDay();
    const diff = targetIndex - currentDayIndex;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);
    const formattedDate = targetDate.toISOString().split("T")[0];
    handleDatumWechsel(formattedDate);
  };

  // NEU: Kurs auswählen und Check-in-basierte Mitglieder laden
  const handleStundeWaehlen = async (stunde) => {
    try {
      setLoading(true);
      setAusgewaehlteStunde(stunde);
      setMitglieder([]);
      setAnwesenheit({});
      // Filter zurücksetzen auf Standard (Kurs-Mitglieder)
      setShowAllMembers(false);
      setShowStyleOnly(false);
      // 🆕 Suche zurücksetzen
      setSuchbegriff("");
      setAllMembersForSearch([]);
      setIsSearchActive(false);

      const stundenplan_id = stunde.stundenplan_id || stunde.id;

      // Standard: Kurs-Mitglieder laden (ohne Parameter)
      const membersData = await fetchKursMitglieder(
        `/api/anwesenheit/kurs/${stundenplan_id}/${ausgewaehltesDatum}`
      );
      
      if (membersData.success) {
        const members = membersData.members;
        setMitglieder(members);
        
        // Anwesenheitsstatus aus der API-Response übernehmen
        const anwesenheitStatus = {};
        members.forEach(member => {
          const id = member.mitglied_id;
          anwesenheitStatus[id] = {
            status: member.anwesend === 1 ? "anwesend" : "",
            bemerkung: "",
            gespeichert: member.anwesend === 1,
            checkin_status: member.checkin_status,
            checkin_time: member.checkin_time,
            checkout_time: member.checkout_time
          };
        });
        setAnwesenheit(anwesenheitStatus);

        // 🆕 Alle Mitglieder für Suche einmalig laden
        loadAllMembersForSearch(stundenplan_id);
      }
      
    } catch (error) {
      console.error("❌ Fehler beim Laden der Kursmitglieder:", error);
      setMitglieder([]);
      setAnwesenheit({});
    } finally {
      setLoading(false);
    }
  };

  // 🔄 AUTOMATISCHES UPDATE: Wenn sich Mitglieder ändern und Kurs ausgewählt ist, neu laden
  useEffect(() => {
    if (ausgewaehlteStunde && updateTrigger > 0) {
      console.log('🔄 Mitglieder-Update erkannt, lade Kursmitglieder neu...');
      // Lade Kursmitglieder neu, wenn ein Update ausgelöst wurde
      const stundenplan_id = ausgewaehlteStunde.stundenplan_id || ausgewaehlteStunde.id;
      const reloadMembers = async () => {
        try {
          setLoading(true);

          // Priorisierung: show_all > show_style_only > standard (nur eingecheckte)
          let queryParams = '';
          if (showAllMembers) {
            queryParams = '?show_all=true';
          } else if (showStyleOnly) {
            queryParams = '?show_style_only=true';
          }

          const membersData = await fetchKursMitglieder(
            `/api/anwesenheit/kurs/${stundenplan_id}/${ausgewaehltesDatum}${queryParams}`
          );
          
          if (membersData.success) {
            const members = membersData.members;
            setMitglieder(members);
            
            // Anwesenheitsstatus aus der API-Response übernehmen
            const anwesenheitStatus = {};
            members.forEach(member => {
              const id = member.mitglied_id;
              anwesenheitStatus[id] = {
                status: member.anwesend === 1 ? "anwesend" : "",
                bemerkung: "",
                gespeichert: member.anwesend === 1,
                checkin_status: member.checkin_status,
                checkin_time: member.checkin_time,
                checkout_time: member.checkout_time
              };
            });
            setAnwesenheit(anwesenheitStatus);
            loadAllMembersForSearch(stundenplan_id);
          }
        } catch (error) {
          console.error("❌ Fehler beim Neuladen der Kursmitglieder:", error);
        } finally {
          setLoading(false);
        }
      };
      reloadMembers();
    }
  }, [updateTrigger, ausgewaehlteStunde, ausgewaehltesDatum, showAllMembers, showStyleOnly]);

  // 🆕 NEU: Alle Mitglieder für intelligente Suche laden
  const loadAllMembersForSearch = async (stundenplan_id) => {
    try {
      const allMembersData = await fetchKursMitglieder(
        `/api/anwesenheit/kurs/${stundenplan_id}/${ausgewaehltesDatum}?show_all=true`
      );
      
      if (allMembersData.success) {
        setAllMembersForSearch(allMembersData.members);
      }
    } catch (error) {
      console.error("❌ Fehler beim Laden aller Mitglieder für Suche:", error);
    }
  };

  // NEU: Toggle zwischen eingecheckten und allen Mitgliedern
  const toggleShowAllMembers = () => {
    const newShowAll = !showAllMembers;
    setShowAllMembers(newShowAll);

    // Wenn show_all aktiviert wird, style_only deaktivieren
    if (newShowAll && showStyleOnly) {
      setShowStyleOnly(false);
    }

    if (ausgewaehlteStunde) {
      // Kurs neu laden mit anderer Einstellung
      handleStundeWaehlen(ausgewaehlteStunde);
    }
  };

  // NEU: Toggle für Stil-Filter (zeigt alle Mitglieder des Stils, unabhängig von der Gruppe)
  const toggleShowStyleOnly = () => {
    const newShowStyleOnly = !showStyleOnly;
    setShowStyleOnly(newShowStyleOnly);

    // Wenn style_only aktiviert wird, show_all deaktivieren
    if (newShowStyleOnly && showAllMembers) {
      setShowAllMembers(false);
    }

    if (ausgewaehlteStunde) {
      // Kurs neu laden mit anderer Einstellung
      handleStundeWaehlen(ausgewaehlteStunde);
    }
  };

  const updateStatus = async (mitgliedId, status) => {
    try {
      const aktuell = anwesenheit[mitgliedId]?.status;
      const neuerStatus = status === "anwesend" && aktuell === "anwesend" ? "entfernt" : status;

      const eintrag = {
        mitglied_id: mitgliedId,
        stundenplan_id: ausgewaehlteStunde.stundenplan_id || ausgewaehlteStunde.id,
        datum: ausgewaehltesDatum,
        anwesend: neuerStatus === "anwesend" ? 1 : 0,
        bemerkung: anwesenheit[mitgliedId]?.bemerkung || "",
        status: neuerStatus, // Status explizit speichern
      };

      // Direkt in anwesenheit Tabelle speichern (nicht nur Protokoll)
      const response = await fetch(`${config.apiBaseUrl}/anwesenheit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eintrag)
      });

      const responseData = await response.json();

      if (response.ok) {
        // 🆕 NEU: Wenn "anwesend" markiert wird, auch Check-in erstellen
        if (neuerStatus === "anwesend") {
          try {
            const checkinData = {
              mitglied_id: mitgliedId,
              stundenplan_id: ausgewaehlteStunde.stundenplan_id || ausgewaehlteStunde.id,
              datum: ausgewaehltesDatum,
              checkin_type: 'manual' // Kennzeichnen als manueller Check-in
            };
            
            const checkinResponse = await fetch(`${config.apiBaseUrl}/checkin`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(checkinData)
            });
            
            const checkinResult = await checkinResponse.json();

            if (checkinResponse.ok) {
              // Mitglied-Status auch im Frontend aktualisieren
              setMitglieder(prevMitglieder => 
                prevMitglieder.map(m => 
                  m.mitglied_id === mitgliedId 
                    ? { ...m, checkin_status: 'eingecheckt', checkin_time: new Date().toISOString() }
                    : m
                )
              );
            } else {
              console.warn(`⚠️ Check-in-Erstellung fehlgeschlagen:`, checkinResult);
              // Anwesenheit trotzdem beibehalten - Check-in ist optional
            }
            
          } catch (checkinError) {
            console.warn(`⚠️ Fehler beim Check-in erstellen:`, checkinError);
            // Anwesenheit trotzdem beibehalten - Check-in ist optional
          }
        }
        
        // State sofort updaten
        setAnwesenheit((prev) => {
          const newState = {
            ...prev,
            [mitgliedId]: {
              ...prev[mitgliedId],
              status: neuerStatus,
              gespeichert: true,
            },
          };
          return newState;
        });

        // Bei Suche das Mitglied sofort zur Hauptliste hinzufügen
        if (isSearchActive && neuerStatus === "anwesend") {
          // Mitglied aus Search-Liste finden
          const searchMember = allMembersForSearch.find(m => m.mitglied_id === mitgliedId);
          if (searchMember) {
            // Sofort zur Hauptliste hinzufügen
            setMitglieder(prevMitglieder => {
              const exists = prevMitglieder.some(m => m.mitglied_id === mitgliedId);
              if (exists) {
                return prevMitglieder.map(m =>
                  m.mitglied_id === mitgliedId
                    ? { ...m, anwesend: 1, checkin_status: 'eingecheckt', checkin_time: new Date().toISOString() }
                    : m
                );
              } else {
                return [...prevMitglieder, {
                  ...searchMember,
                  anwesend: 1,
                  checkin_status: 'eingecheckt',
                  checkin_time: new Date().toISOString()
                }];
              }
            });
          }
        }
      } else {
        console.error(`❌ API-Fehler: ${response.status}`, responseData);
      }
      
    } catch (error) {
      console.error("❌ Fehler beim Speichern der Anwesenheit:", error);
    }
  };

  const updateBemerkung = (mitgliedId, bemerkung) => {
    setAnwesenheit((prev) => ({
      ...prev,
      [mitgliedId]: {
        ...prev[mitgliedId],
        bemerkung,
        gespeichert: false,
      },
    }));
  };

  const toggleCard = (mitgliedId) => {
    const currentStatus = anwesenheit[mitgliedId]?.status;

    if (currentStatus !== "anwesend") {
      updateStatus(mitgliedId, "anwesend");
      return;
    }
    setExpandedCards((prev) => ({ ...prev, [mitgliedId]: !prev[mitgliedId] }));
  };

  const handleSuchbegriffChange = (neuerBegriff) => {
    setSuchbegriff(neuerBegriff);

    // Bei Eingabe: Intelligente Suche aktivieren
    if (neuerBegriff.length > 0) {
      setIsSearchActive(true);
    } else {
      setIsSearchActive(false);
    }
  };

  const gruppiereMitglieder = () => {
    const nichtAnwesend = [];
    const anwesend = [];
    const entfernt = [];

    const begriff = suchbegriff.toLowerCase();

    const zuDurchsuchendeMitglieder = isSearchActive && allMembersForSearch.length > 0
      ? allMembersForSearch
      : mitglieder;

    const gefiltert = zuDurchsuchendeMitglieder.filter((mitglied) => {
      const name = mitglied.nachname?.toLowerCase() || "";
      const vorname = mitglied.vorname?.toLowerCase() || "";
      const match = name.includes(begriff) || vorname.includes(begriff);
      return match;
    });

    gefiltert.forEach((mitglied) => {
      const id = mitglied.mitglied_id || mitglied.id;
      
      // 🆕 Anwesenheit aus verschiedenen Quellen bestimmen
      let status;
      if (anwesenheit[id]) {
        status = anwesenheit[id].status;
      } else if (isSearchActive) {
        // Bei Suche: Status aus den Daten des Mitglieds nehmen
        status = mitglied.anwesend === 1 ? "anwesend" : "";
        
        // Anwesenheitsstatus für Suchergebnisse temporär setzen
        if (!anwesenheit[id]) {
          setAnwesenheit(prev => ({
            ...prev,
            [id]: {
              status: status,
              bemerkung: "",
              gespeichert: mitglied.anwesend === 1,
              checkin_status: mitglied.checkin_status,
              checkin_time: mitglied.checkin_time,
              checkout_time: mitglied.checkout_time
            }
          }));
        }
      } else {
        status = "";
      }
      
      if (nurNichtAnwesend && status === "anwesend") return;
      
      if (status === "entfernt") {
        entfernt.push(mitglied);
      } else if (status === "anwesend") {
        anwesend.push(mitglied);
      } else {
        nichtAnwesend.push(mitglied);
      }
    });

    return [...entfernt, ...nichtAnwesend, "---ANWESEND---", ...anwesend];
  };

  return (
    <div className="anwesenheit-container">
      {/* Header Section */}
      <div className="anwesenheit-header">
        <div className="anwesenheit-header-content">
          <h2>Anwesenheitsverwaltung</h2>
          <p className="anwesenheit-subtitle">Kurse auswählen und Anwesenheit verwalten</p>
        </div>
      </div>

      {/* Wochentagsbuttons und Datumsauswahl in einer Zeile */}
      <div className="wochentag-und-datum-container">
        <div className="wochentag-buttons">
          {["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"].map((tag) => (
            <button key={tag} onClick={() => handleWochentagClick(tag)}>
              {tag}
            </button>
          ))}
        </div>
        
        <div className="datum-auswahl-kompakt">
          <input type="date" value={ausgewaehltesDatum} onChange={(e) => handleDatumWechsel(e.target.value)} />
        </div>
      </div>

      {loading && <div className="loading">🔄 Lade...</div>}

      <div className="stundenplan-list">
        {gefilterteStunden.length === 0 && !loading && (
          <p style={{ color: "#a00", fontStyle: "italic", marginBottom: "1rem" }}>
           ⚠️ Für das gewählte Datum sind keine Kurse geplant.
          </p>
        )}

        {gefilterteStunden.map((stunde) => {
          // 🔧 FIX: Verwende berechnete Statistiken statt API-Daten
          const stats = berechneKursStatistiken(stunde.stundenplan_id);
          return (
            <button
              key={stunde.stundenplan_id || stunde.id}
              onClick={() => handleStundeWaehlen(stunde)}
              className={
                ausgewaehlteStunde &&
                (ausgewaehlteStunde.stundenplan_id || ausgewaehlteStunde.id) ===
                  (stunde.stundenplan_id || stunde.id)
                  ? "ausgewaehlt"
                  : ""
              }
            >
              <div>
                {stunde.wochentag}, {stunde.zeit}
              </div>
              <div>
                {stunde.stil && <strong>{stunde.stil}</strong>}
                {stunde.stil && stunde.kurs_name && <br />}
                {stunde.kurs_name}
              </div>
              {stats.showStats ? (
                <div className="kurs-stats">
                  📍 {stats.aktive_checkins} aktiv | 📋 {stats.checkins_heute} heute
                </div>
              ) : stats.loading ? (
                <div className="kurs-stats-loading">
                  🔄 Lade...
                </div>
              ) : (
                <div className="kurs-stats-placeholder">
                  📊 Wählen für Details
                </div>
              )}
            </button>
          );
        })}
      </div>

      {ausgewaehlteStunde && (
        <div className="mitglieder-abschnitt">
          {/* NEU: Suchfeld, Toggle und Anwesend-Button in einer Zeile */}
          <div className="alle-kontrollen-container">
            <div className="suchfeld-links">
              <input
                type="text"
                placeholder={isSearchActive
                  ? "🔍 Durchsuche ALLE Kursmitglieder..."
                  : "Mitglied suchen..."
                }
                value={suchbegriff}
                onChange={(e) => handleSuchbegriffChange(e.target.value)}
                className="suchfeld"
                style={{
                  ...(isSearchActive && {
                    borderColor: '#1976d2',
                    backgroundColor: '#e3f2fd',
                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)'
                  })
                }}
              />
            </div>

            {/* NEU: Filter-Buttons in Gruppe */}
            <div className="filter-buttons-gruppe" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Button 1: Kurs-Mitglieder (Standard) */}
              <button
                onClick={async () => {
                  if (!ausgewaehlteStunde) return;
                  setShowAllMembers(false);
                  setShowStyleOnly(false);
                  setLoading(true);

                  const stundenplan_id = ausgewaehlteStunde.stundenplan_id || ausgewaehlteStunde.id;
                  const membersData = await fetchKursMitglieder(`/api/anwesenheit/kurs/${stundenplan_id}/${ausgewaehltesDatum}`);

                  if (membersData.success) {
                    setMitglieder(membersData.members);
                    const anwesenheitStatus = {};
                    membersData.members.forEach(member => {
                      anwesenheitStatus[member.mitglied_id] = {
                        status: member.anwesend === 1 ? "anwesend" : "",
                        bemerkung: "",
                        gespeichert: member.anwesend === 1,
                        checkin_status: member.checkin_status,
                        checkin_time: member.checkin_time,
                        checkout_time: member.checkout_time
                      };
                    });
                    setAnwesenheit(anwesenheitStatus);
                  }
                  setLoading(false);
                }}
                className={!showAllMembers && !showStyleOnly ? 'filter-button-active' : 'filter-button-inactive'}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '2px solid',
                  borderColor: !showAllMembers && !showStyleOnly ? '#1976d2' : '#ccc',
                  backgroundColor: !showAllMembers && !showStyleOnly ? '#e3f2fd' : '#fff',
                  color: !showAllMembers && !showStyleOnly ? '#1976d2' : '#666',
                  fontWeight: !showAllMembers && !showStyleOnly ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                📋 Kurs-Mitglieder
              </button>

              {/* Button 2: Stil-Mitglieder (mehr Mitglieder) */}
              <button
                onClick={async () => {
                  if (!ausgewaehlteStunde) return;
                  setShowAllMembers(false);
                  setShowStyleOnly(true);
                  setLoading(true);

                  const stundenplan_id = ausgewaehlteStunde.stundenplan_id || ausgewaehlteStunde.id;
                  const membersData = await fetchKursMitglieder(`/api/anwesenheit/kurs/${stundenplan_id}/${ausgewaehltesDatum}?show_style_only=true`);

                  if (membersData.success) {
                    setMitglieder(membersData.members);
                    const anwesenheitStatus = {};
                    membersData.members.forEach(member => {
                      anwesenheitStatus[member.mitglied_id] = {
                        status: member.anwesend === 1 ? "anwesend" : "",
                        bemerkung: "",
                        gespeichert: member.anwesend === 1,
                        checkin_status: member.checkin_status,
                        checkin_time: member.checkin_time,
                        checkout_time: member.checkout_time
                      };
                    });
                    setAnwesenheit(anwesenheitStatus);
                  }
                  setLoading(false);
                }}
                className={showStyleOnly ? 'filter-button-active' : 'filter-button-inactive'}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '2px solid',
                  borderColor: showStyleOnly ? '#ff9800' : '#ccc',
                  backgroundColor: showStyleOnly ? '#fff3e0' : '#fff',
                  color: showStyleOnly ? '#ff9800' : '#666',
                  fontWeight: showStyleOnly ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                🥋 Alle Stil-Mitglieder
              </button>

              {/* Button 3: Alle Mitglieder (Suche) */}
              <button
                onClick={async () => {
                  if (!ausgewaehlteStunde) return;
                  setShowAllMembers(true);
                  setShowStyleOnly(false);
                  setLoading(true);

                  const stundenplan_id = ausgewaehlteStunde.stundenplan_id || ausgewaehlteStunde.id;
                  const membersData = await fetchKursMitglieder(`/api/anwesenheit/kurs/${stundenplan_id}/${ausgewaehltesDatum}?show_all=true`);

                  if (membersData.success) {
                    setMitglieder(membersData.members);
                    const anwesenheitStatus = {};
                    membersData.members.forEach(member => {
                      anwesenheitStatus[member.mitglied_id] = {
                        status: member.anwesend === 1 ? "anwesend" : "",
                        bemerkung: "",
                        gespeichert: member.anwesend === 1,
                        checkin_status: member.checkin_status,
                        checkin_time: member.checkin_time,
                        checkout_time: member.checkout_time
                      };
                    });
                    setAnwesenheit(anwesenheitStatus);
                  }
                  setLoading(false);
                }}
                className={showAllMembers ? 'filter-button-active' : 'filter-button-inactive'}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '2px solid',
                  borderColor: showAllMembers ? '#4caf50' : '#ccc',
                  backgroundColor: showAllMembers ? '#e8f5e9' : '#fff',
                  color: showAllMembers ? '#4caf50' : '#666',
                  fontWeight: showAllMembers ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                🔍 Alle Mitglieder
              </button>
            </div>

            <div className="filter-checkbox-kompakt">
              <label className="filter-checkbox-label">
                <input
                  type="checkbox"
                  checked={nurNichtAnwesend}
                  onChange={() => setNurNichtAnwesend(!nurNichtAnwesend)}
                  className="filter-checkbox"
                />
                Nur nicht anwesende Mitglieder anzeigen
              </label>
            </div>

            <div className="anwesend-button-rechts">
              <button className="anwesend-toggle-button">
                ✅ Anwesend
              </button>
            </div>
          </div>
          
          {/* Statistiken anzeigen */}
          <div className="mitglieder-stats-container">
            <div className="mitglieder-stats">
              📊 {mitglieder.length} Mitglieder |
              ✅ {mitglieder.filter(m => anwesenheit[m.mitglied_id]?.status === 'anwesend').length} anwesend |
              📱 {mitglieder.filter(m => m.checkin_status === 'eingecheckt').length} eingecheckt
              {/* Filter-Status anzeigen */}
              {showStyleOnly && (
                <span style={{ color: '#ff9800', fontWeight: 'bold', marginLeft: '10px' }}>
                  | 🥋 Stil-Filter aktiv
                </span>
              )}
              {showAllMembers && (
                <span style={{ color: '#4caf50', fontWeight: 'bold', marginLeft: '10px' }}>
                  | 🔍 Alle Mitglieder
                </span>
              )}
              {/* Suchstatus anzeigen */}
              {isSearchActive && (
                <span style={{ color: '#1976d2', fontWeight: 'bold', marginLeft: '10px' }}>
                  | 🔍 Suche aktiv ({allMembersForSearch.length} durchsuchbar)
                </span>
              )}
            </div>
          </div>

          <div className="mitglieder-list">
            {gruppiereMitglieder().map((mitglied) => {
              if (mitglied === "---ANWESEND---") {
                return null; // Gruppierungs-Header entfernt
              }

              const id = mitglied.mitglied_id || mitglied.id;
              const eintrag = anwesenheit[id] || { status: "", bemerkung: "" };
              const statusKlasse = eintrag.status ? `status-${eintrag.status}` : "";
              const gespeicherteKlasse =
                eintrag.status === "anwesend" && eintrag.gespeichert ? "block-gespeichert" : "";
              const expanded = expandedCards[id];
              
              // NEU: Check-in Status anzeigen
              const checkinStatus = mitglied.checkin_status || 'nicht_eingecheckt';
              const checkinKlasse = `checkin-${checkinStatus}`;

              // 🆕 Such-Hervorhebung
              const isFromSearch = isSearchActive && !mitglieder.some(m => m.mitglied_id === id);
              const searchHighlight = isFromSearch ? 'search-result' : '';

              return (
                <div
                  key={id}
                  className={`mitglied-block ${statusKlasse} ${gespeicherteKlasse} ${checkinKlasse} ${searchHighlight}`}
                  onClick={() => toggleCard(id)}
                  style={{
                    ...(isFromSearch && {
                      borderColor: '#1976d2',
                      backgroundColor: '#e3f2fd'
                    })
                  }}
                >
                  <div className="mitglied-header">
                    <img
                      src={mitglied.profilbild || "/default-user.png"}
                      alt="Profil"
                      className="mitglied-profilbild"
                    />
                    <div className="mitglied-info">
                      <strong>
                        {mitglied.vorname} {mitglied.nachname}
                        {/* 🆕 Suchindikator */}
                        {isFromSearch && (
                          <span style={{ 
                            color: '#1976d2', 
                            fontSize: '12px', 
                            marginLeft: '8px',
                            background: '#bbdefb',
                            padding: '2px 6px',
                            borderRadius: '10px'
                          }}>
                            🔍 Suchergebnis
                          </span>
                        )}
                      </strong>
                      <div className="mitglied-details-inline">
                        {mitglied.gurtfarbe && <span className="gurtfarbe">{mitglied.gurtfarbe}</span>}
                        {checkinStatus === 'eingecheckt' && eintrag.status !== "entfernt" && (
                          <span className="checkin-badge">
                            📱 Eingecheckt
                          </span>
                        )}
                      </div>
                      {eintrag.status === "entfernt" && (
                        <div className="entfernt-hinweis">
                          ❌ aus der Stunde entfernt
                        </div>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="mitglied-details">
                      <select
                        value={eintrag.status ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateStatus(id, e.target.value)}
                      >
                        <option value="">Status wählen</option>
                        <option value="anwesend">Anwesend</option>
                        <option value="verspätet">Verspätet</option>
                        <option value="entschuldigt">Entschuldigt</option>
                        <option value="unentschuldigt">Unentschuldigt</option>
                        <option value="abgebrochen">Abgebrochen</option>
                      </select>

                      <button
                        className="anwesenheit-quick"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatus(id, "anwesend");
                        }}
                      >
                        {eintrag.status === "anwesend" ? "Entfernen ✕" : "Anwesend ✓"}
                      </button>

                      <input
                        type="text"
                        placeholder="Bemerkung"
                        value={eintrag.bemerkung ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateBemerkung(id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Anwesenheit;