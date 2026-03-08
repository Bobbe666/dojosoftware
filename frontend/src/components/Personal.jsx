import React, { useContext, useState, useMemo, useEffect } from "react";
import axios from "axios";
import config from '../config/config.js';
import "../styles/Personal.css";
import { DatenContext } from "@shared/DatenContext.jsx";

const Personal = () => {
  const { ladeAlleDaten } = useContext(DatenContext);
  
  const [personal, setPersonal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [neuerMitarbeiter, setNeuerMitarbeiter] = useState({
    personalnummer: "",
    vorname: "",
    nachname: "",
    position: "",
    beschaeftigungsart: "Vollzeit",
    einstellungsdatum: "",
    email: "",
    telefon: "",
    grundgehalt: "",
    stundenlohn: ""
  });
  
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  
  const [filterPosition, setFilterPosition] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Personal-Daten laden
  const ladePersonalDaten = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/personal`);
      setPersonal(response.data);
      console.log("✅ Personal-Daten geladen:", response.data.length);
    } catch (err) {
      console.error("❌ Fehler beim Laden der Personal-Daten:", err);
      setError("Fehler beim Laden der Personal-Daten: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    ladePersonalDaten();
  }, []);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedPersonal = useMemo(() => {
    return [...personal]
      .filter(p =>
        (!filterPosition || p.position.toLowerCase().includes(filterPosition.toLowerCase())) &&
        (!filterStatus || p.status === filterStatus)
      )
      .sort((a, b) => {
        if (!sortConfig.key) return 0;
        const aVal = a[sortConfig.key]?.toString().toLowerCase() || "";
        const bVal = b[sortConfig.key]?.toString().toLowerCase() || "";
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [personal, filterPosition, filterStatus, sortConfig]);

  const handleHinzufuegen = async () => {
    if (!neuerMitarbeiter.personalnummer || !neuerMitarbeiter.vorname || 
        !neuerMitarbeiter.nachname || !neuerMitarbeiter.position || 
        !neuerMitarbeiter.einstellungsdatum) {
      alert("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }

    try {
      await axios.post(`/personal`, neuerMitarbeiter);
      setNeuerMitarbeiter({
        personalnummer: "",
        vorname: "",
        nachname: "",
        position: "",
        beschaeftigungsart: "Vollzeit",
        einstellungsdatum: "",
        email: "",
        telefon: "",
        grundgehalt: "",
        stundenlohn: ""
      });
      ladePersonalDaten();
      alert("Mitarbeiter erfolgreich hinzugefügt!");
    } catch (err) {
      console.error("Fehler beim Hinzufügen:", err);
      alert("Fehler beim Hinzufügen des Mitarbeiters: " + (err.response?.data?.error || err.message));
    }
  };

  const handleBearbeiten = (person) => {
    setEditingId(person.personal_id);
    setEditingData({
      personalnummer: person.personalnummer,
      vorname: person.vorname,
      nachname: person.nachname,
      position: person.position,
      beschaeftigungsart: person.beschaeftigungsart,
      email: person.email || "",
      telefon: person.telefon || "",
      status: person.status
    });
  };

  const handleSpeichern = async (id) => {
    if (!editingData.vorname || !editingData.nachname || !editingData.position) {
      alert("Bitte Vor-/Nachname und Position ausfüllen.");
      return;
    }

    try {
      await axios.put(`/personal/${id}`, editingData);
      setEditingId(null);
      ladePersonalDaten();
      alert("Mitarbeiter erfolgreich aktualisiert!");
    } catch (err) {
      console.error("Fehler beim Speichern:", err);
      alert("Fehler beim Speichern: " + (err.response?.data?.error || err.message));
    }
  };

  const handleKuendigen = async (id) => {
    if (!window.confirm("Soll dieser Mitarbeiter wirklich gekündigt werden?")) return;

    try {
      await axios.delete(`/personal/${id}`);
      ladePersonalDaten();
      alert("Mitarbeiter erfolgreich gekündigt!");
    } catch (err) {
      console.error("Fehler beim Kündigen:", err);
      alert("Fehler beim Kündigen: " + (err.response?.data?.error || err.message));
    }
  };

  const formatGehalt = (gehalt) => {
    if (!gehalt) return "Nicht angegeben";
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(gehalt);
  };

  const formatDatum = (datum) => {
    if (!datum) return "Nicht angegeben";
    return new Date(datum).toLocaleDateString('de-DE');
  };

  if (loading) return <div className="personal-container-modern">Lade Personal-Daten...</div>;
  if (error) return <div className="personal-container-modern error">{error}</div>;

  return (
    <div className="personal-container-modern">
      <div className="personal-header">
        <h2>🧑‍💼 Personal-Verwaltung</h2>
        <p className="personal-subtitle">Mitarbeiter und Personalverwaltung</p>
      </div>

      {/* Filter + Export */}
      <div className="personal-controls">
        <div className="personal-filters">
          <div className="filter-group">
            <label>🎯 Position filtern:</label>
            <select 
              className="filter-select" 
              onChange={e => setFilterPosition(e.target.value)} 
              value={filterPosition}
            >
              <option value="">Alle Positionen</option>
              <option value="Trainer">Trainer</option>
              <option value="Leiter">Leiter</option>
              <option value="Rezeption">Rezeption</option>
              <option value="Reinigung">Reinigung</option>
            </select>
          </div>
          <div className="filter-group">
            <label>📊 Status filtern:</label>
            <select 
              className="filter-select" 
              onChange={e => setFilterStatus(e.target.value)} 
              value={filterStatus}
            >
              <option value="">Alle Status</option>
              <option value="aktiv">Aktiv</option>
              <option value="inaktiv">Inaktiv</option>
              <option value="beurlaubt">Beurlaubt</option>
            </select>
          </div>
        </div>
        <button className="export-button-modern" onClick={() => alert("CSV Export wird implementiert...")}>
          📊 CSV Export
        </button>
      </div>

      {/* Statistiken */}
      <div className="personal-stats">
        <div className="stat-card">
          <div className="stat-icon">🧑‍💼</div>
          <div className="stat-content">
            <div className="stat-number">{personal.length}</div>
            <div className="stat-label">Mitarbeiter</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-number">{sortedPersonal.length}</div>
            <div className="stat-label">Gefilterte Ergebnisse</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className="stat-number">{personal.filter(p => p.status === 'aktiv').length}</div>
            <div className="stat-label">Aktive Mitarbeiter</div>
          </div>
        </div>
      </div>

      {/* Personal-Liste als Cards */}
      <div className="personal-grid">
        {sortedPersonal.length > 0 ? (
          sortedPersonal.map((person, index) => (
            <div key={person.personal_id} className="personal-card" style={{animationDelay: `${index * 0.1}s`}}>
              <div className="personal-card-header">
                <div className="personal-status-badge" data-status={person.status}>
                  {editingId === person.personal_id ? (
                    <select
                      className="edit-select"
                      value={editingData.status || person.status}
                      onChange={(e) => setEditingData({ ...editingData, status: e.target.value })}
                    >
                      <option value="aktiv">Aktiv</option>
                      <option value="inaktiv">Inaktiv</option>
                      <option value="beurlaubt">Beurlaubt</option>
                    </select>
                  ) : (
                    person.status.charAt(0).toUpperCase() + person.status.slice(1)
                  )}
                </div>
                <div className="personal-actions">
                  {editingId === person.personal_id ? (
                    <>
                      <button 
                        className="action-btn save-btn" 
                        onClick={() => handleSpeichern(person.personal_id)}
                        title="Änderungen speichern"
                      >
                        ✅
                      </button>
                      <button 
                        className="action-btn cancel-btn" 
                        onClick={() => setEditingId(null)}
                        title="Bearbeitung abbrechen"
                      >
                        ❌
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        className="action-btn edit-btn" 
                        onClick={() => handleBearbeiten(person)}
                        title="Mitarbeiter bearbeiten"
                      >
                        ✏️
                      </button>
                      <button 
                        className="action-btn delete-btn" 
                        onClick={() => handleKuendigen(person.personal_id)}
                        title="Mitarbeiter kündigen"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="personal-card-content">
                <div className="personal-field">
                  <label>👤 Name:</label>
                  {editingId === person.personal_id ? (
                    <div className="personal-name-edit-row">
                      <input
                        type="text"
                        className="edit-input personal-name-input"
                        value={editingData.vorname}
                        onChange={(e) => setEditingData({ ...editingData, vorname: e.target.value })}
                        placeholder="Vorname"
                      />
                      <input
                        type="text"
                        className="edit-input personal-name-input"
                        value={editingData.nachname}
                        onChange={(e) => setEditingData({ ...editingData, nachname: e.target.value })}
                        placeholder="Nachname"
                      />
                    </div>
                  ) : (
                    <span className="personal-value">{person.vorname} {person.nachname}</span>
                  )}
                </div>

                <div className="personal-field">
                  <label>📋 Personal-Nr:</label>
                  <span className="personal-value">{person.personalnummer}</span>
                </div>

                <div className="personal-field">
                  <label>🎯 Position:</label>
                  {editingId === person.personal_id ? (
                    <input
                      type="text"
                      className="edit-input"
                      value={editingData.position}
                      onChange={(e) => setEditingData({ ...editingData, position: e.target.value })}
                      placeholder="Position"
                    />
                  ) : (
                    <span className="personal-value position-tag">{person.position}</span>
                  )}
                </div>

                <div className="personal-field">
                  <label>💼 Beschäftigung:</label>
                  {editingId === person.personal_id ? (
                    <select
                      className="edit-select"
                      value={editingData.beschaeftigungsart}
                      onChange={(e) => setEditingData({ ...editingData, beschaeftigungsart: e.target.value })}
                    >
                      <option value="Vollzeit">Vollzeit</option>
                      <option value="Teilzeit">Teilzeit</option>
                      <option value="Minijob">Minijob</option>
                      <option value="Praktikant">Praktikant</option>
                      <option value="Freelancer">Freelancer</option>
                    </select>
                  ) : (
                    <span className="personal-value">{person.beschaeftigungsart}</span>
                  )}
                </div>

                <div className="personal-field">
                  <label>📧 Kontakt:</label>
                  {editingId === person.personal_id ? (
                    <div className="personal-contact-edit-col">
                      <input
                        type="email"
                        className="edit-input"
                        value={editingData.email || ""}
                        onChange={(e) => setEditingData({ ...editingData, email: e.target.value })}
                        placeholder="E-Mail"
                      />
                      <input
                        type="tel"
                        className="edit-input"
                        value={editingData.telefon || ""}
                        onChange={(e) => setEditingData({ ...editingData, telefon: e.target.value })}
                        placeholder="Telefon"
                      />
                    </div>
                  ) : (
                    <div>
                      {person.email && <div className="contact-info">{person.email}</div>}
                      {person.telefon && <div className="contact-info">{person.telefon}</div>}
                    </div>
                  )}
                </div>

                <div className="personal-field">
                  <label>💰 Gehalt:</label>
                  <span className="personal-value">{formatGehalt(person.grundgehalt)}</span>
                </div>

                <div className="personal-field">
                  <label>⏰ Stundenlohn:</label>
                  <span className="personal-value">
                    {person.stundenlohn ? `€${parseFloat(person.stundenlohn).toFixed(2)}/h` : 'Nicht festgelegt'}
                  </span>
                </div>

                <div className="personal-field">
                  <label>📅 Einstellung:</label>
                  <span className="personal-value">{formatDatum(person.einstellungsdatum)}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-personal-message">
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>Keine Mitarbeiter gefunden</h3>
              <p>Mit den aktuellen Filtern wurden keine Mitarbeiter gefunden.</p>
            </div>
          </div>
        )}
      </div>

      {/* Formular für neuen Mitarbeiter */}
      <div className="neuer-mitarbeiter-card" style={{animationDelay: `${sortedPersonal.length * 0.1 + 0.3}s`}}>
        <div className="card-header">
          <h3>➕ Neuen Mitarbeiter hinzufügen</h3>
        </div>
        <div className="mitarbeiter-form-modern">
          <div className="form-group">
            <label>📋 Personal-Nr: *</label>
            <input
              type="text"
              className="form-input"
              placeholder="z.B. MA001, T01, R001"
              value={neuerMitarbeiter.personalnummer} 
              onChange={(e) => setNeuerMitarbeiter({ ...neuerMitarbeiter, personalnummer: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>👤 Vorname: *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Vorname eingeben"
              value={neuerMitarbeiter.vorname} 
              onChange={(e) => setNeuerMitarbeiter({ ...neuerMitarbeiter, vorname: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>👤 Nachname: *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Nachname eingeben"
              value={neuerMitarbeiter.nachname} 
              onChange={(e) => setNeuerMitarbeiter({ ...neuerMitarbeiter, nachname: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>🎯 Position: *</label>
            <input
              type="text"
              className="form-input"
              placeholder="z.B. Trainer, Rezeption, Dojo-Leiter"
              value={neuerMitarbeiter.position} 
              onChange={(e) => setNeuerMitarbeiter({ ...neuerMitarbeiter, position: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>💼 Beschäftigungsart: *</label>
            <select 
              className="form-select"
              value={neuerMitarbeiter.beschaeftigungsart} 
              onChange={(e) => setNeuerMitarbeiter({ ...neuerMitarbeiter, beschaeftigungsart: e.target.value })}
            >
              <option value="Vollzeit">Vollzeit</option>
              <option value="Teilzeit">Teilzeit</option>
              <option value="Minijob">Minijob</option>
              <option value="Praktikant">Praktikant</option>
              <option value="Freelancer">Freelancer</option>
            </select>
          </div>

          <div className="form-group">
            <label>📅 Einstellungsdatum: *</label>
            <input
              type="date"
              className="form-input"
              value={neuerMitarbeiter.einstellungsdatum} 
              onChange={(e) => setNeuerMitarbeiter({ ...neuerMitarbeiter, einstellungsdatum: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>📧 E-Mail:</label>
            <input
              type="email"
              className="form-input"
              placeholder="mitarbeiter@dojo.local"
              value={neuerMitarbeiter.email} 
              onChange={(e) => setNeuerMitarbeiter({ ...neuerMitarbeiter, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>📞 Telefon:</label>
            <input
              type="tel"
              className="form-input"
              placeholder="+49 123 456789"
              value={neuerMitarbeiter.telefon} 
              onChange={(e) => setNeuerMitarbeiter({ ...neuerMitarbeiter, telefon: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>💰 Grundgehalt (€):</label>
            <input
              type="number"
              className="form-input"
              placeholder="2500.00"
              step="0.01"
              value={neuerMitarbeiter.grundgehalt} 
              onChange={(e) => setNeuerMitarbeiter({ ...neuerMitarbeiter, grundgehalt: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>⏰ Stundenlohn (€/h):</label>
            <input
              type="number"
              className="form-input"
              placeholder="18.50"
              step="0.01"
              min="0"
              value={neuerMitarbeiter.stundenlohn} 
              onChange={(e) => setNeuerMitarbeiter({ ...neuerMitarbeiter, stundenlohn: e.target.value })}
            />
          </div>

          <button className="add-button-modern" onClick={handleHinzufuegen}>
            <span className="btn-icon">➕</span>
            Mitarbeiter hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
};

export default Personal;