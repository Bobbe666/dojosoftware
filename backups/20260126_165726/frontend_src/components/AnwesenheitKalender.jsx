// 📁 Datei: AnwesenheitKalender.jsx

import React, { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../styles/AnwesenheitKalender.css";
import axios from "axios";

const AnwesenheitKalender = () => {
  const [value, setValue] = useState(new Date());
  const [eintraege, setEintraege] = useState([]);
  const [auswahl, setAuswahl] = useState([]);

  useEffect(() => {
    axios.get("/anwesenheitProtokoll/uebersicht")
      .then((res) => setEintraege(res.data))
      .catch(() => setEintraege([]));
  }, []);

  const datenSet = new Set(eintraege.map(e => e.datum));

  const tileContent = ({ date, view }) => {
    if (view === "month") {
      const d = date.toISOString().split("T")[0];
      if (datenSet.has(d)) {
        return <div className="kalender-punkt" title="Anwesenheit vorhanden" />;
      }
    }
    return null;
  };

  const handleDateClick = (date) => {
    const d = date.toISOString().split("T")[0];
    const gefiltert = eintraege.filter(e => e.datum === d);
    setAuswahl(gefiltert);
    setValue(date);
  };

  return (
    <div className="kalender-container">
      <h2>Kalenderansicht</h2>

      <Calendar
        onChange={handleDateClick}
        value={value}
        tileContent={tileContent}
      />

      {auswahl.length > 0 && (
        <div className="kalender-details">
          <h3>Details für {value.toISOString().split("T")[0]}</h3>
          <ul>
            {auswahl.map((eintrag, idx) => (
              <li key={idx}>
                <strong>{eintrag.kursname}</strong> – {eintrag.uhrzeit_start} – {eintrag.vorname} {eintrag.name} ({eintrag.status})
                {eintrag.bemerkung && <> – "{eintrag.bemerkung}"</>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AnwesenheitKalender;