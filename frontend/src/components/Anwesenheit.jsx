import React, { useState, useEffect, useRef, Suspense, lazy } from "react";
import axios from "axios";
const VerkaufKasse = lazy(() => import('./VerkaufKasse'));
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Anwesenheit.css";
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';

// Extrahierte Sub-Komponenten
import { AnwesenheitPopup, MitgliedKarte } from './anwesenheit/index.js';


const Anwesenheit = () => {
  const { updateTrigger } = useMitgliederUpdate(); // 🔄 Automatische Updates nach Mitgliedsanlage
  const { getDojoFilterParam, activeDojo } = useDojoContext(); // 🔒 Dojo-Filter für Multi-Tenant
  const [stundenplan, setStundenplan] = useState([]);
  const [ausgewaehlteStunde, setAusgewaehlteStunde] = useState(null);
  const [ausgewaehltesDatum, setAusgewaehltesDatum] = useState(() => new Date().toISOString().split("T")[0]);
  const [mitglieder, setMitglieder] = useState([]);
  const [anwesenheit, setAnwesenheit] = useState({});
  const [gefilterteStunden, setGefilterteStunden] = useState([]);
  const [suchbegriff, setSuchbegriff] = useState("");
  const [nurNichtAnwesend, setNurNichtAnwesend] = useState(false);
  const [nurAnwesend, setNurAnwesend] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});
  const [selectedMember, setSelectedMember] = useState(null); // Für Popup-Modal
  
  // Abwesenheiten für gewähltes Datum
  const [abwesenheiten, setAbwesenheiten] = useState([]);
  const [abwesenheitenLoading, setAbwesenheitenLoading] = useState(false);
  const [showAbwesenheiten, setShowAbwesenheiten] = useState(true);

  // NEU: Check-in Integration
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [showStyleOnly, setShowStyleOnly] = useState(false); // NEU: Stil-Filter (ohne Gruppe)
  const [kurseStats, setKurseStats] = useState({});
  const [loading, setLoading] = useState(false);

  // 🆕 NEU: Intelligente Suche
  const [allMembersForSearch, setAllMembersForSearch] = useState([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const suchfeldRef = useRef(null);

  // Verletzung Modal
  const [showVerletzungModal, setShowVerletzungModal] = useState(false);
  const [verletzungMember, setVerletzungMember] = useState(null);
  const [verletzungForm, setVerletzungForm] = useState({ datum: new Date().toISOString().split('T')[0], art: '', koerperregion: '', schwere: 'leicht', notizen: '', wieder_trainierbar_ab: '' });
  const [verletzungSaving, setVerletzungSaving] = useState(false);
  const [verletzungError, setVerletzungError] = useState(null);

  // Verkauf Modal
  const [showVerkauf, setShowVerkauf] = useState(false);
  const [verkaufKunde, setVerkaufKunde] = useState(null);

  const openVerletzung = (mitglied) => {
    setVerletzungMember(mitglied);
    setVerletzungForm({ datum: new Date().toISOString().split('T')[0], art: '', koerperregion: '', schwere: 'leicht', notizen: '', wieder_trainierbar_ab: '' });
    setVerletzungError(null);
    setShowVerletzungModal(true);
  };

  const saveVerletzung = async () => {
    if (!verletzungForm.art.trim()) { setVerletzungError('Bitte Art der Verletzung angeben.'); return; }
    setVerletzungSaving(true);
    setVerletzungError(null);
    try {
      await axios.post('/verletzungen', { mitglied_id: verletzungMember.mitglied_id || verletzungMember.id, ...verletzungForm });
      setShowVerletzungModal(false);
    } catch { setVerletzungError('Fehler beim Speichern.'); }
    finally { setVerletzungSaving(false); }
  };

  // Sondertraining Modal
  const [showSonderModal, setShowSonderModal] = useState(false);
  const [sonderForm, setSonderForm] = useState({ name: '', datum: '', stil_id: '' });
  const [sonderSaving, setSonderSaving] = useState(false);
  const [stile, setStile] = useState([]);

  // Abwesenheiten für gewähltes Datum laden
  useEffect(() => {
    const loadAbwesenheiten = async () => {
      setAbwesenheitenLoading(true);
      try {
        const dojoParam = activeDojo?.id ? `&dojo_id=${activeDojo.id}` : '';
        const res = await fetchWithAuth(`${config.apiBaseUrl}/abwesenheiten/admin?von=${ausgewaehltesDatum}&bis=${ausgewaehltesDatum}${dojoParam}`);
        if (res.ok) {
          const data = await res.json();
          setAbwesenheiten(data.abwesenheiten || []);
        }
      } catch (_) {}
      setAbwesenheitenLoading(false);
    };
    loadAbwesenheiten();
  }, [ausgewaehltesDatum]);

  // NEU: Kurse für Datum laden statt Stundenplan
  useEffect(() => {
    loadKurseForDate(ausgewaehltesDatum);
  }, [ausgewaehltesDatum]);

  // Stile einmalig laden
  useEffect(() => {
    fetchWithAuth(`${config.apiBaseUrl}/stile?aktiv=1`)
      .then(r => r.json())
      .then(data => setStile(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Hilfsfunktion für sichere API-Aufrufe mit Fehlerbehandlung
  const fetchKursMitglieder = async (url) => {
    try {
      const response = await fetchWithAuth(url);
      
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

      // 🔒 Dojo-Filter für Multi-Tenant Unterstützung
      const dojoParam = getDojoFilterParam();
      const url = dojoParam ? `${config.apiBaseUrl}/anwesenheit/kurse/${datum}?${dojoParam}` : `${config.apiBaseUrl}/anwesenheit/kurse/${datum}`;

      const response = await fetchWithAuth(url);
      const data = await response.json();
      
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
      const response = await fetchWithAuth(`${config.apiBaseUrl}/anwesenheit`, {
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
            
            const checkinResponse = await fetchWithAuth(`${config.apiBaseUrl}/checkin`, {
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

        // 🆕 Bei "entfernt" auch den Checkin-Status im Frontend aktualisieren
        if (neuerStatus === "entfernt") {
          setMitglieder(prevMitglieder =>
            prevMitglieder.map(m =>
              m.mitglied_id === mitgliedId
                ? { ...m, checkin_status: 'entfernt' }
                : m
            )
          );
        }

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

            // Suchfeld leeren und Focus setzen für nächste Suche
            setSuchbegriff("");
            setTimeout(() => suchfeldRef.current?.focus(), 50);
          }
        }
      } else {
        console.error(`❌ API-Fehler: ${response.status}`, responseData);

        // 🆕 Auch bei Fehler (z.B. "bereits eingecheckt") das Mitglied zur Liste hinzufügen
        if (isSearchActive && status === "anwesend") {
          const searchMember = allMembersForSearch.find(m => m.mitglied_id === mitgliedId);
          if (searchMember) {
            setMitglieder(prevMitglieder => {
              const exists = prevMitglieder.some(m => m.mitglied_id === mitgliedId);
              if (!exists) {
                return [...prevMitglieder, {
                  ...searchMember,
                  anwesend: 1,
                  checkin_status: 'eingecheckt',
                  checkin_time: new Date().toISOString()
                }];
              }
              return prevMitglieder;
            });

            // Anwesenheit-State auch updaten
            setAnwesenheit((prev) => ({
              ...prev,
              [mitgliedId]: {
                ...prev[mitgliedId],
                status: "anwesend",
                gespeichert: true,
              },
            }));

            setSuchbegriff("");
            setTimeout(() => suchfeldRef.current?.focus(), 50);
          }
        }
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

  const toggleCard = (mitgliedId, mitglied) => {
    const currentStatus = anwesenheit[mitgliedId]?.status;

    if (currentStatus !== "anwesend") {
      // Nicht anwesend -> direkt als anwesend markieren
      updateStatus(mitgliedId, "anwesend");
      // Filter deaktivieren damit das Mitglied sichtbar bleibt
      if (nurNichtAnwesend) {
        setNurNichtAnwesend(false);
      }
      return;
    }
    // Anwesend -> Popup öffnen für weitere Optionen
    setSelectedMember({ ...mitglied, id: mitgliedId });
  };

  const closePopup = () => {
    setSelectedMember(null);
  };

  const handlePopupAction = (action) => {
    if (!selectedMember) return;
    const id = selectedMember.id;

    if (action === 'entfernen') {
      updateStatus(id, 'entfernt');
    } else {
      updateStatus(id, action);
    }
    closePopup();
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
      if (nurAnwesend && status !== "anwesend") return;
      
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

  const handleSondertrainingErstellen = async () => {
    if (!sonderForm.name.trim() || !sonderForm.datum || !sonderForm.stil_id) return;
    setSonderSaving(true);
    try {
      // dojo_id direkt aus activeDojo holen — getDojoFilterParam gibt '' für Super-Admin zurück
      const dojoId = activeDojo && typeof activeDojo === 'object' ? activeDojo.id : null;
      const url = dojoId
        ? `${config.apiBaseUrl}/anwesenheit/sondertraining?dojo_id=${dojoId}`
        : `${config.apiBaseUrl}/anwesenheit/sondertraining`;
      const res = await fetchWithAuth(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_name: sonderForm.name.trim(), datum: sonderForm.datum, stil_id: sonderForm.stil_id }),
      });
      const data = await res.json();
      if (data.success) {
        const neuesEvent = {
          stundenplan_id: data.stundenplan_id,
          typ: 'sonder',
          wochentag: sonderForm.datum,
          zeit: '—',
          kurs_name: data.event_name,
          stil: stile.find(s => String(s.stil_id) === String(sonderForm.stil_id))?.name || '',
        };
        // Falls das Datum mit dem aktuell gewählten übereinstimmt → in Liste einfügen
        if (sonderForm.datum === ausgewaehltesDatum) {
          setGefilterteStunden(prev => [...prev, neuesEvent]);
        } else {
          // Datum wechseln und Liste neu laden
          setAusgewaehltesDatum(sonderForm.datum);
        }
        setShowSonderModal(false);
        setSonderForm({ name: '', datum: ausgewaehltesDatum, stil_id: '' });
        // Auto-auswählen
        handleStundeWaehlen(neuesEvent);
      }
    } catch (e) {
      console.error('Fehler beim Anlegen des Sondertrainings:', e);
    } finally {
      setSonderSaving(false);
    }
  };

  return (
    <div className="anwesenheit-container">
      {/* Header Section */}
      <div className="anwesenheit-header">
        <div className="anwesenheit-header-content">
          {/* Zeile 1: Titel + Datum + Sondertraining */}
          <div className="anwesenheit-header-top">
            <h2>Anwesenheitsverwaltung</h2>
            <div className="datum-auswahl-kompakt">
              <input type="date" value={ausgewaehltesDatum} onChange={(e) => handleDatumWechsel(e.target.value)} />
              <button
                className="sonder-btn"
                onClick={() => {
                  setSonderForm({ name: '', datum: ausgewaehltesDatum, stil_id: stile[0]?.stil_id ? String(stile[0].stil_id) : '' });
                  setShowSonderModal(true);
                }}
                title="Sondertraining / einmaliges Event erfassen"
              >
                ⚡ Sondertraining
              </button>
            </div>
          </div>
          {/* Zeile 2: Wochentag-Schnellauswahl */}
          <div className="wochentag-buttons">
            {["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"].map((tag) => (
              <button key={tag} onClick={() => handleWochentagClick(tag)}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div className="loading">🔄 Lade...</div>}

      <div className="stundenplan-list">
        {gefilterteStunden.length === 0 && !loading && (
          <p className="anw-warn-italic">
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
                {stunde.typ === 'sonder'
                  ? <span className="sonder-badge">⚡ Sondertraining</span>
                  : <>{stunde.wochentag}, {stunde.zeit}</>
                }
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

      {/* Abwesenheiten Panel */}
      {(abwesenheiten.length > 0 || abwesenheitenLoading) && (
        <div className="abw-panel">
          <button
            className="abw-panel-header"
            onClick={() => setShowAbwesenheiten(v => !v)}
          >
            <span>🚫 Abgemeldete Mitglieder ({abwesenheitenLoading ? '…' : abwesenheiten.length})</span>
            <span className="abw-panel-toggle">{showAbwesenheiten ? '▲' : '▼'}</span>
          </button>
          {showAbwesenheiten && (
            <div className="abw-panel-list">
              {abwesenheitenLoading ? (
                <p className="abw-panel-loading">Lade…</p>
              ) : abwesenheiten.map(a => {
                const artLabels = { krank: { label: 'Krank', emoji: '🤒' }, abwesend: { label: 'Abwesend', emoji: '✈️' }, urlaub: { label: 'Urlaub', emoji: '🏖️' }, sonstiges: { label: 'Sonstiges', emoji: '📝' } };
                const meta = artLabels[a.art] || artLabels.sonstiges;
                const vonStr = a.datum ? new Date(String(a.datum).slice(0,10) + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }) : '';
                const bisStr = a.datum_bis && a.datum_bis !== a.datum ? new Date(String(a.datum_bis).slice(0,10) + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }) : '';
                return (
                  <div key={a.id} className="abw-panel-item">
                    <span className="abw-panel-emoji">{meta.emoji}</span>
                    <div className="abw-panel-info">
                      <span className="abw-panel-name">{a.vorname} {a.nachname}</span>
                      <span className="abw-panel-meta">{meta.label}{bisStr ? ` · ${vonStr} – ${bisStr}` : ''}</span>
                      {a.notiz && <span className="abw-panel-notiz">{a.notiz}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                ref={suchfeldRef}
                value={suchbegriff}
                onChange={(e) => handleSuchbegriffChange(e.target.value)}
                className={`suchfeld ${isSearchActive ? 'suchfeld-aktiv' : ''}`}
              />
            </div>

            {/* NEU: Filter-Buttons in Gruppe — nur bei regulären Kursen */}
            <div className="filter-buttons-gruppe" style={ausgewaehlteStunde?.typ === 'sonder' ? { display: 'none' } : {}}>
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
                className={`filter-btn ${!showAllMembers && !showStyleOnly ? 'active-blue' : ''}`}
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
                className={`filter-btn ${showStyleOnly ? 'active-orange' : ''}`}
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
                className={`filter-btn ${showAllMembers ? 'active-green' : ''}`}
              >
                🔍 Alle Mitglieder
              </button>
            </div>

            <div className="anwesenheit-filter-buttons">
              <button
                onClick={() => {
                  setNurAnwesend(!nurAnwesend);
                  if (!nurAnwesend) setNurNichtAnwesend(false);
                }}
                className={`filter-btn-small ${nurAnwesend ? 'active-green' : ''}`}
              >
                ✅ Nur Anwesende
              </button>
              <button
                onClick={() => {
                  setNurNichtAnwesend(!nurNichtAnwesend);
                  if (!nurNichtAnwesend) setNurAnwesend(false);
                }}
                className={`filter-btn-small ${nurNichtAnwesend ? 'active-red' : ''}`}
              >
                ❌ Nur Fehlende
              </button>
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
                <span className="anw-filter-secondary">
                  | 🥋 Stil-Filter aktiv
                </span>
              )}
              {showAllMembers && (
                <span className="anw-filter-success">
                  | 🔍 Alle Mitglieder
                </span>
              )}
              {/* Suchstatus anzeigen */}
              {isSearchActive && (
                <span className="anw-filter-info">
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
              const isFromSearch = isSearchActive && !mitglieder.some(m => m.mitglied_id === id);

              return (
                <MitgliedKarte
                  key={id}
                  mitglied={mitglied}
                  anwesenheitEintrag={eintrag}
                  isFromSearch={isFromSearch}
                  onClick={toggleCard}
                  onVerletzung={openVerletzung}
                  onVerkauf={(m) => { setVerkaufKunde(m); setShowVerkauf(true); }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Sondertraining Modal */}
      {showSonderModal && (
        <div className="sonder-modal-overlay" onClick={() => setShowSonderModal(false)}>
          <div className="sonder-modal" onClick={e => e.stopPropagation()}>
            <div className="sonder-modal-header">
              <h3>⚡ Sondertraining anlegen</h3>
              <button className="sonder-modal-close" onClick={() => setShowSonderModal(false)}>✕</button>
            </div>
            <div className="sonder-modal-body">
              <label className="sonder-label">Name des Events</label>
              <input
                className="sonder-input"
                type="text"
                placeholder="z.B. Weißwurstessen, Wettkampftraining..."
                value={sonderForm.name}
                onChange={e => setSonderForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
              <label className="sonder-label">Datum</label>
              <input
                className="sonder-input"
                type="date"
                value={sonderForm.datum}
                onChange={e => setSonderForm(f => ({ ...f, datum: e.target.value }))}
              />
              <label className="sonder-label">Kampfstil (zählt als Einheit für)</label>
              <select
                className="sonder-select"
                value={sonderForm.stil_id}
                onChange={e => setSonderForm(f => ({ ...f, stil_id: e.target.value }))}
              >
                <option value="">— Stil wählen —</option>
                {stile.map(s => (
                  <option key={s.stil_id} value={s.stil_id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="sonder-modal-footer">
              <button className="sonder-cancel-btn" onClick={() => setShowSonderModal(false)}>Abbrechen</button>
              <button
                className="sonder-save-btn"
                onClick={handleSondertrainingErstellen}
                disabled={sonderSaving || !sonderForm.name.trim() || !sonderForm.datum || !sonderForm.stil_id}
              >
                {sonderSaving ? '⏳ Anlegen...' : '✓ Anlegen & öffnen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sondertraining Modal */}
      {showSonderModal && (
        <div className="sonder-modal-overlay" onClick={() => setShowSonderModal(false)}>
          <div className="sonder-modal" onClick={e => e.stopPropagation()}>
            <h3>⚡ Sondertraining erfassen</h3>
            <p className="sonder-modal-hint">Einmaliges Event das als Trainingseinheit zählt</p>

            <div className="sonder-modal-field">
              <label>Name des Events</label>
              <input
                type="text"
                placeholder="z.B. Weißwurstessen, Wettkampftraining..."
                value={sonderForm.name}
                onChange={e => setSonderForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="sonder-modal-field">
              <label>Datum</label>
              <input
                type="date"
                value={sonderForm.datum}
                onChange={e => setSonderForm(f => ({ ...f, datum: e.target.value }))}
              />
            </div>

            <div className="sonder-modal-field">
              <label>Kampfstil</label>
              <select
                value={sonderForm.stil_id}
                onChange={e => setSonderForm(f => ({ ...f, stil_id: e.target.value }))}
              >
                <option value="">— Stil wählen —</option>
                {stile.map(s => (
                  <option key={s.stil_id} value={s.stil_id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="sonder-modal-actions">
              <button className="sonder-modal-cancel" onClick={() => setShowSonderModal(false)}>
                Abbrechen
              </button>
              <button
                className="sonder-modal-save"
                onClick={handleSondertrainingErstellen}
                disabled={sonderSaving || !sonderForm.name.trim() || !sonderForm.datum || !sonderForm.stil_id}
              >
                {sonderSaving ? '⏳ Erstelle...' : '✓ Erstellen & Anwesenheit erfassen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup-Modal für Mitglied-Aktionen */}
      <AnwesenheitPopup
        member={selectedMember}
        anwesenheitEintrag={selectedMember ? anwesenheit[selectedMember.id] : null}
        onClose={closePopup}
        onAction={handlePopupAction}
        onBemerkungChange={(value) => updateBemerkung(selectedMember?.id, value)}
      />

      {/* Verkauf Modal */}
      {showVerkauf && verkaufKunde && (
        <Suspense fallback={null}>
          <VerkaufKasse
            kunde={verkaufKunde}
            onClose={() => { setShowVerkauf(false); setVerkaufKunde(null); }}
          />
        </Suspense>
      )}

      {/* Verletzung Modal */}
      {showVerletzungModal && verletzungMember && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 9999, overflowY: 'auto' }} onClick={() => setShowVerletzungModal(false)}>
          <div style={{ background: 'var(--bg-card, #1e2130)', border: '2px solid rgba(99,102,241,0.3)', borderRadius: '1rem', maxWidth: '480px', width: 'calc(100% - 2rem)', margin: '2rem auto', padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: 'var(--primary, #6366f1)' }}>🤕 Verletzung — {verletzungMember.vorname} {verletzungMember.nachname}</h3>
              <button onClick={() => setShowVerletzungModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'inherit' }}>✕</button>
            </div>
            {verletzungError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.6rem', color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>{verletzungError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div><label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.3rem' }}>Datum</label><input type="date" value={verletzungForm.datum} onChange={e => setVerletzungForm(f => ({ ...f, datum: e.target.value }))} className="form-input" style={{ width: '100%' }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.3rem' }}>Art der Verletzung *</label><input type="text" value={verletzungForm.art} onChange={e => setVerletzungForm(f => ({ ...f, art: e.target.value }))} placeholder="z.B. Verstauchung, Prellung..." className="form-input" style={{ width: '100%' }} autoFocus /></div>
              <div><label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.3rem' }}>Körperregion</label>
                <select value={verletzungForm.koerperregion} onChange={e => setVerletzungForm(f => ({ ...f, koerperregion: e.target.value }))} className="form-input" style={{ width: '100%' }}>
                  <option value="">— wählen —</option>
                  {['Kopf / Gesicht','Schulter / Schlüsselbein','Arm / Ellbogen','Handgelenk / Hand','Finger','Rippen / Brustkorb','Rücken / Wirbelsäule','Hüfte / Becken','Oberschenkel','Knie','Schienbein / Wade','Sprunggelenk / Fuß','Zehen','Sonstiges'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div><label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.3rem' }}>Schwere</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[{ value: 'leicht', label: '🟡 Leicht' }, { value: 'mittel', label: '🟠 Mittel' }, { value: 'schwer', label: '🔴 Schwer' }].map(s => (
                    <button key={s.value} onClick={() => setVerletzungForm(f => ({ ...f, schwere: s.value }))} style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', background: verletzungForm.schwere === s.value ? 'rgba(99,102,241,0.2)' : 'transparent', border: verletzungForm.schwere === s.value ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.1)', color: 'inherit' }}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div><label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.3rem' }}>Wieder trainierbar ab</label><input type="date" value={verletzungForm.wieder_trainierbar_ab} onChange={e => setVerletzungForm(f => ({ ...f, wieder_trainierbar_ab: e.target.value }))} className="form-input" style={{ width: '100%' }} /></div>
              <div><label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.3rem' }}>Notizen</label><textarea value={verletzungForm.notizen} onChange={e => setVerletzungForm(f => ({ ...f, notizen: e.target.value }))} placeholder="Weitere Details..." className="form-input" rows={3} style={{ width: '100%', resize: 'vertical' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setShowVerletzungModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
              <button onClick={saveVerletzung} className="btn btn-primary" style={{ flex: 1 }} disabled={verletzungSaving}>{verletzungSaving ? 'Speichern...' : '✓ Speichern'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Anwesenheit;