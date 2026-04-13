// 📁 Datei: AnwesenheitDashboard.jsx

import React, { useState } from "react";
import AnwesenheitGrid from "./AnwesenheitGrid";
import AnwesenheitKalender from "./AnwesenheitKalender";
// 🔜 Diese folgen bald:
// import AnwesenheitExport from "./AnwesenheitExport";
// import AnwesenheitStatistik from "./AnwesenheitStatistik";
import "../styles/AnwesenheitDashboard.css";

const AnwesenheitDashboard = () => {
  const [view, setView] = useState("grid");

  return (
    <div className="dashboard-container">
      <h1>Anwesenheits-Dashboard</h1>

      <div className="dashboard-nav">
        <button onClick={() => setView("grid")} className={view === "grid" ? "active" : ""}>🧱 Übersicht</button>
        <button onClick={() => setView("kalender")} className={view === "kalender" ? "active" : ""}>📆 Kalender</button>
        {/* Statistik und Export folgen — noch in Entwicklung */}
        {/* <button onClick={() => setView("statistik")} className={view === "statistik" ? "active" : ""}>📊 Statistik</button> */}
        {/* <button onClick={() => setView("export")} className={view === "export" ? "active" : ""}>📤 Export</button> */}
      </div>

      <div className="dashboard-content">
        {view === "grid" && <AnwesenheitGrid />}
        {view === "kalender" && <AnwesenheitKalender />}
        {view === "statistik" && <p>📊 Statistik folgt...</p>}
        {view === "export" && <p>📤 Export-Funktion folgt...</p>}
      </div>
    </div>
  );
};

export default AnwesenheitDashboard;