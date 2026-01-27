// 📁 Datei: AnwesenheitGrid.jsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/AnwesenheitGrid.css";

const statusFarben = {
  anwesend: "#4caf50",
  verspätet: "#ffc107",
  entschuldigt: "#2196f3",
  unentschuldigt: "#f44336",
  abgebrochen: "#9e9e9e",
};

const AnwesenheitGrid = () => {
  const [daten, setDaten] = useState([]);
  const [kurse, setKurse] = useState([]);
  const [filterKurs, setFilterKurs] = useState("");
  const [datumVon, setDatumVon] = useState("");
  const [datumBis, setDatumBis] = useState("");

  useEffect(() => {
    axios.get("/kurse")
      .then((res) => setKurse(res.data))
      .catch(() => setKurse([]));
  }, []);

  useEffect(() => {
    const params = {};
    if (filterKurs) params.kurs_id = filterKurs;
    if (datumVon) params.datum_von = datumVon;
    if (datumBis) params.datum_bis = datumBis;

    axios.get("/anwesenheitProtokoll/uebersicht", { params })
      .then((res) => setDaten(res.data))
      .catch(() => setDaten([]));
  }, [filterKurs, datumVon, datumBis]);

  // Gruppieren nach datum + kurs
  const gruppiert = {};
  daten.forEach((eintrag) => {
    const key = `${eintrag.datum}_${eintrag.kurs_id}`;
    if (!gruppiert[key]) {
      gruppiert[key] = {
        datum: eintrag.datum,
        kursname: eintrag.kursname,
        uhrzeit: eintrag.uhrzeit_start,
        teilnehmer: [],
      };
    }
    gruppiert[key].teilnehmer.push(eintrag);
  });

  const gruppenArray = Object.values(gruppiert);

  return (
    <div className="anwesenheit-grid-container">
      <h2>Anwesenheitsübersicht</h2>

      <div className="filterleiste">
        <select value={filterKurs} onChange={(e) => setFilterKurs(e.target.value)}>
          <option value="">Alle Kurse</option>
          {kurse.map((k) => (
            <option key={k.kurs_id} value={k.kurs_id}>{k.kursname}</option>
          ))}
        </select>

        <input type="date" value={datumVon} onChange={(e) => setDatumVon(e.target.value)} />
        <input type="date" value={datumBis} onChange={(e) => setDatumBis(e.target.value)} />
      </div>

      <div className="grid-wrapper">
        {gruppenArray.length === 0 ? (
          <p>Keine Daten gefunden.</p>
        ) : (
          gruppenArray.map((gruppe, index) => (
            <div className="kurs-kachel" key={index}>
              <h3>{gruppe.kursname}</h3>
              <p>{gruppe.datum} – {gruppe.uhrzeit}</p>
              <div className="teilnehmer-liste">
                {gruppe.teilnehmer.map((t, i) => (
                  <div
                    key={i}
                    className="teilnehmer-box"
                    style={{ backgroundColor: statusFarben[t.status] || "#eee" }}
                    title={`${t.vorname} ${t.name} – ${t.status}${t.bemerkung ? ` (${t.bemerkung})` : ""}`}
                  >
                    {t.vorname} {t.name}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AnwesenheitGrid;