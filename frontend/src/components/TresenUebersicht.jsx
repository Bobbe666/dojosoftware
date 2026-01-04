import React, { useState, useEffect, useMemo } from "react";
import "../styles/TresenUebersicht.css";
import config from '../config/config.js';

const aggregateAnwesendeByMitglied = (eintraege = []) => {
  const map = new Map();

  eintraege.forEach((person) => {
    if (!person) return;

    const schluessel = person.mitglied_id || `${person.full_name || ""}-${person.stundenplan_id || ""}`;
    if (!map.has(schluessel)) {
      const fullName =
        person.full_name ||
        `${person.vorname || ""} ${person.nachname || ""}`.trim();

      map.set(schluessel, {
        mitglied_id: person.mitglied_id,
        full_name: fullName,
        vorname: person.vorname,
        nachname: person.nachname,
        gurtfarbe: person.gurtfarbe,
        foto_pfad: person.foto_pfad,
        kurse: [],
        selbsteingechecktCount: 0,
        trainerHinzugefuegtCount: 0,
        selbst_checkin_time: person.selbst_checkin_time,
        checkout_time: person.checkout_time,
        trainer_hinzugefuegt_am: person.trainer_hinzugefuegt_am,
        anwesenheits_typ: person.anwesenheits_typ,
        erstesCheckinDatum: person.selbst_checkin_time || person.trainer_hinzugefuegt_am || null,
      });
    }

    const aggregiert = map.get(schluessel);
    aggregiert.kurse.push({
      kurs_name: person.kurs_name || 'Freies Training',
      kurs_zeit: person.kurs_zeit,
      anwesenheits_typ: person.anwesenheits_typ,
      selbst_checkin_time: person.selbst_checkin_time,
      trainer_hinzugefuegt_am: person.trainer_hinzugefuegt_am,
      checkout_time: person.checkout_time,
    });

    if (person.anwesenheits_typ === "selbst_eingecheckt") {
      aggregiert.selbsteingechecktCount += 1;
      if (!aggregiert.selbst_checkin_time && person.selbst_checkin_time) {
        aggregiert.selbst_checkin_time = person.selbst_checkin_time;
      }
    }

    if (person.anwesenheits_typ === "trainer_hinzugefuegt") {
      aggregiert.trainerHinzugefuegtCount += 1;
      if (!aggregiert.trainer_hinzugefuegt_am && person.trainer_hinzugefuegt_am) {
        aggregiert.trainer_hinzugefuegt_am = person.trainer_hinzugefuegt_am;
      }
    }
  });

  return Array.from(map.values()).map((person) => {
    const hatTrainerHinzugefuegt = person.trainerHinzugefuegtCount > 0;
    const hatSelbstEingecheckt = person.selbsteingechecktCount > 0;

    return {
      ...person,
      hatTrainerHinzugefuegt,
      hatSelbstEingecheckt,
      anwesenheits_typ: hatTrainerHinzugefuegt
        ? "trainer_hinzugefuegt"
        : hatSelbstEingecheckt
        ? "selbst_eingecheckt"
        : person.anwesenheits_typ,
    };
  });
};

const TresenUebersicht = () => {
  const [anwesende, setAnwesende] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedDatum, setSelectedDatum] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suchbegriff, setSuchbegriff] = useState("");
  const [nurTrainerHinzugefuegt, setNurTrainerHinzugefuegt] = useState(false);

  // Automatisch laden beim Start
  useEffect(() => {
    loadTresenDaten(selectedDatum);
  }, [selectedDatum]);

  const loadTresenDaten = async (datum) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`📢 Lade Tresen-Daten für ${datum}...`);
      
      const response = await fetch(`${config.apiBaseUrl}/checkin/tresen/${datum}`);
      
      if (!response.ok) {
        const text = await response.text();
        console.error(`❌ HTTP ${response.status}: ${text.substring(0, 200)}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error(`❌ Ungültiger Content-Type: ${contentType}`);
        console.error(`Response: ${text.substring(0, 500)}`);
        throw new Error('Server hat kein JSON zurückgegeben');
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`📦 Rohe Daten vom Server:`, data);
        console.log(`📋 Anwesende Array:`, data.anwesende);
        console.log(`📊 Anzahl Anwesende:`, (data.anwesende || []).length);
        setAnwesende(data.anwesende || []);
        setStats(data.stats || {});
        console.log(`✅ ${(data.anwesende || []).length} Anwesende geladen`);
        console.log(`📊 Stats:`, data.stats);
        if ((data.anwesende || []).length > 0) {
          console.log(`👥 Erste 3 Anwesende:`, data.anwesende.slice(0, 3));
        }
      } else {
        setError(data.message || 'Fehler beim Laden der Daten');
        setAnwesende([]);
        setStats({});
      }
    } catch (error) {
      console.error("❌ Fehler beim Laden der Tresen-Daten:", error);
      setError(`Verbindungsfehler: ${error.message}`);
      setAnwesende([]);
      setStats({});
    } finally {
      setLoading(false);
    }
  };

  const handleDatumWechsel = (neuesDatum) => {
    setSelectedDatum(neuesDatum);
    setSuchbegriff("");
    setNurTrainerHinzugefuegt(false);
  };

  // Schnellzugriff auf heute/gestern/morgen
  const schnellzugriffDatum = (offset) => {
    const heute = new Date();
    heute.setDate(heute.getDate() + offset);
    const datum = heute.toISOString().split('T')[0];
    handleDatumWechsel(datum);
  };

  const getWochentagName = (datumStr) => {
    const datum = new Date(datumStr);
    const tage = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    return tage[datum.getDay()];
  };

  const filtereAnwesende = () => {
    const aggregierte = aggregateAnwesendeByMitglied(anwesende);
    const begriff = suchbegriff.trim().toLowerCase();

    return aggregierte.filter((person) => {
      const matchesSuche =
        !begriff ||
        person.full_name?.toLowerCase().includes(begriff) ||
        person.vorname?.toLowerCase().includes(begriff) ||
        person.nachname?.toLowerCase().includes(begriff) ||
        person.kurse?.some((kurs) =>
          kurs.kurs_name?.toLowerCase().includes(begriff)
        );

      const matchesTrainer = !nurTrainerHinzugefuegt || person.hatTrainerHinzugefuegt;

      return matchesSuche && matchesTrainer;
    });
  };

  const batchCheckin = async (mitgliedIds) => {
    try {
      setLoading(true);
      
      const response = await fetch(`${config.apiBaseUrl}/checkin/tresen/batch-checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mitglieder_ids: mitgliedIds,
          datum: selectedDatum
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Batch Check-in erfolgreich: ${result.results.length} Mitglieder`);
        // Daten neu laden
        await loadTresenDaten(selectedDatum);
      } else {
        setError(result.message || 'Fehler beim Batch Check-in');
      }
    } catch (error) {
      console.error("❌ Batch Check-in Fehler:", error);
      setError('Batch Check-in fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchCheckinTrainerHinzugefuegte = () => {
    const trainerHinzugefuegte = anwesende
      .filter(person => person.anwesenheits_typ === 'trainer_hinzugefuegt')
      .map(person => person.mitglied_id);
    
    if (trainerHinzugefuegte.length > 0) {
      if (confirm(`${trainerHinzugefuegte.length} Mitglieder nachträglich einchecken?`)) {
        batchCheckin(trainerHinzugefuegte);
      }
    }
  };

  const gefilterteAnwesende = useMemo(
    filtereAnwesende,
    [anwesende, suchbegriff, nurTrainerHinzugefuegt]
  );

  return (
    <div className="tresen-uebersicht-container">
      <div className="tresen-header">
        <h2>🏪 Tresen-Übersicht</h2>
        <p className="description">
          Alle heute anwesenden Mitglieder - eingecheckt oder vom Trainer hinzugefügt
        </p>
      </div>

      {/* Datum & Statistiken */}
      <div className="tresen-kontrollzeile">
        <div className="datum-kontrollen">
          <div className="datum-auswahl">
            <label>Datum:</label>
            <input 
              type="date" 
              value={selectedDatum} 
              onChange={(e) => handleDatumWechsel(e.target.value)} 
            />
            <span className="wochentag">
              {getWochentagName(selectedDatum)}
            </span>
          </div>

          <div className="schnellzugriff">
            <button onClick={() => schnellzugriffDatum(-1)}>⬅ Gestern</button>
            <button onClick={() => schnellzugriffDatum(0)}>📅 Heute</button>
            <button onClick={() => schnellzugriffDatum(1)}>Morgen ➡</button>
          </div>
        </div>

        <div className="stats-overview">
          <div className="stat-card total">
            <div className="stat-number">{stats.total_anwesend || 0}</div>
            <div className="stat-label">Gesamt</div>
          </div>
          <div className="stat-card eingecheckt">
            <div className="stat-number">{stats.selbst_eingecheckt || 0}</div>
            <div className="stat-label">📱 Eingecheckt</div>
          </div>
          <div className="stat-card trainer">
            <div className="stat-number">{stats.trainer_hinzugefuegt || 0}</div>
            <div className="stat-label">👨‍🏫 Trainer</div>
          </div>
          <div className="stat-card warnung">
            <div className="stat-number">{stats.brauchen_checkin || 0}</div>
            <div className="stat-label">⚠️ Offen</div>
          </div>
        </div>
      </div>

      {/* Filter und Suche */}
      <div className="filter-kontrollen">
        <div className="suche">
          <input
            type="text"
            placeholder="🔍 Name oder Kurs suchen..."
            value={suchbegriff}
            onChange={(e) => setSuchbegriff(e.target.value)}
            className="suchfeld"
          />
        </div>

        <div className="filter-optionen">
          <label className="filter-checkbox-label">
            <input
              type="checkbox"
              checked={nurTrainerHinzugefuegt}
              onChange={(e) => setNurTrainerHinzugefuegt(e.target.checked)}
            />
            Nur "brauchen Check-in" anzeigen
          </label>

          {stats.brauchen_checkin > 0 && (
            <button 
              className="batch-checkin-button"
              onClick={handleBatchCheckinTrainerHinzugefuegte}
              disabled={loading}
            >
              📱 Alle {stats.brauchen_checkin} nachträglich einchecken
            </button>
          )}
        </div>
      </div>

      {/* Fehler-Anzeige */}
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading">
          🔄 Lade...
        </div>
      )}

      {/* Anwesenheitsliste */}
      <div className="anwesende-liste">
        {!loading && gefilterteAnwesende.length === 0 && (
          <div className="keine-anwesende">
            {anwesende.length === 0
              ? "📭 Keine Anwesenden heute"
              : "📭 Keine Treffer für die aktuellen Filter"}
          </div>
        )}

        {gefilterteAnwesende.map((person) => {
          const personKey = person.mitglied_id || person.full_name;
          const trainerKurse =
            person.kurse?.filter(
              (kurs) => kurs.anwesenheits_typ === "trainer_hinzugefuegt"
            ) || [];
          const selbstEingecheckteKurse =
            person.kurse?.filter(
              (kurs) => kurs.anwesenheits_typ === "selbst_eingecheckt"
            ) || [];
          const anzeigeName =
            person.full_name ||
            `${person.vorname || ""} ${person.nachname || ""}`.trim();

          return (
            <div
              key={personKey}
              className={`person-card ${person.anwesenheits_typ || ""}`}
            >
              <div className="person-card-main">
                <div className="status-icon">
                  {person.hatTrainerHinzugefuegt ? "👨‍🏫" : "📱"}
                </div>

                <div className="person-info">
                  <div className="person-name">
                    <strong>{anzeigeName}</strong>
                    {person.gurtfarbe && (
                      <span className="gurtfarbe">{person.gurtfarbe}</span>
                    )}
                  </div>

                  {person.kurse?.length > 0 && (
                    <div className="kurs-tags">
                      {person.kurse.map((kurs, index) => (
                        <span
                          key={`${person.mitglied_id || index}-${
                            kurs.stundenplan_id || index
                          }`}
                          className={`kurs-tag ${
                            kurs.anwesenheits_typ === "trainer_hinzugefuegt"
                              ? "kurs-tag-trainer"
                              : "kurs-tag-checkin"
                          }`}
                        >
                          <span>{kurs.kurs_name || "Unbekannter Kurs"}</span>
                          {kurs.kurs_zeit && (
                            <span className="kurs-tag-zeit">{kurs.kurs_zeit}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="person-status">
                {selbstEingecheckteKurse.length > 0 && (
                  <div className="status-block success">
                    <div className="status-label">📱 Eingecheckt</div>
                    <ul className="kurs-status-list">
                      {selbstEingecheckteKurse.map((kurs, index) => (
                        <li key={`selbst-${personKey}-${index}`}>
                          {kurs.kurs_name || "Kurs"}
                          {kurs.selbst_checkin_time && (
                            <span className="kurs-status-zeit">
                              {" "}
                              ·{" "}
                              {new Date(
                                kurs.selbst_checkin_time
                              ).toLocaleTimeString("de-DE", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {trainerKurse.length > 0 && (
                  <div className="status-block warnung">
                    <div className="status-label warnung">
                      ⚠️ Bitte einchecken
                    </div>
                    <ul className="kurs-status-list">
                      {trainerKurse.map((kurs, index) => (
                        <li key={`trainer-${personKey}-${index}`}>
                          {kurs.kurs_name || "Kurs"}
                          {kurs.trainer_hinzugefuegt_am && (
                            <span className="kurs-status-zeit">
                              {" "}
                              ·{" "}
                              {new Date(
                                kurs.trainer_hinzugefuegt_am
                              ).toLocaleTimeString("de-DE", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <button
                      className="einzelner-checkin-button"
                      onClick={() => batchCheckin([person.mitglied_id])}
                      disabled={loading}
                    >
                      📱 Einchecken
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Refresh Button */}
      <div className="refresh-controls">
        <button 
          className="refresh-button"
          onClick={() => loadTresenDaten(selectedDatum)}
          disabled={loading}
        >
          🔄 Aktualisieren
        </button>
      </div>
    </div>
  );
};

export default TresenUebersicht;