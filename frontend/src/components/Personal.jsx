import React, { useContext, useState, useMemo, useEffect, useCallback } from "react";
import axios from "axios";
import "../styles/Personal.css";
import { DatenContext } from "@shared/DatenContext.jsx";

const MONATSNAMEN = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const Personal = () => {
  const { ladeAlleDaten } = useContext(DatenContext);

  const [personal, setPersonal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // View-Tabs
  const [activeView, setActiveView] = useState('personal'); // 'personal' | 'lohnabrechnung'

  // Lohnabrechnung State
  const now = new Date();
  const [lohnMonat, setLohnMonat]   = useState(now.getMonth() + 1);
  const [lohnJahr, setLohnJahr]     = useState(now.getFullYear());
  const [lohnData, setLohnData]     = useState([]);
  const [lohnGesamt, setLohnGesamt] = useState({ total_stunden: 0, total_lohn: 0 });
  const [lohnLoading, setLohnLoading] = useState(false);
  
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
    } catch (err) {
      setError("Fehler beim Laden der Personal-Daten: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Lohnabrechnung laden
  const ladeLohnabrechnung = useCallback(async () => {
    setLohnLoading(true);
    try {
      const res = await axios.get('/personalCheckin/lohnabrechnung', {
        params: { monat: lohnMonat, jahr: lohnJahr }
      });
      setLohnData(res.data.data || []);
      setLohnGesamt(res.data.gesamt || { total_stunden: 0, total_lohn: 0 });
    } catch (err) {
      setLohnData([]);
    } finally {
      setLohnLoading(false);
    }
  }, [lohnMonat, lohnJahr]);

  useEffect(() => {
    ladePersonalDaten();
  }, []);

  useEffect(() => {
    if (activeView === 'lohnabrechnung') ladeLohnabrechnung();
  }, [activeView, ladeLohnabrechnung]);

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

  const exportLohnCSV = () => {
    if (!lohnData.length) return;
    const header = ['Name', 'Position', 'Beschäftigung', 'Stundenlohn (€)', 'Schichten', 'Stunden', 'Lohn (€)'];
    const rows = lohnData.map(p => [
      `${p.vorname} ${p.nachname}`,
      p.position || '',
      p.beschaeftigungsart || '',
      parseFloat(p.stundenlohn || 0).toFixed(2),
      p.anzahl_schichten,
      parseFloat(p.total_stunden || 0).toFixed(2),
      parseFloat(p.total_lohn || 0).toFixed(2),
    ]);
    rows.push(['GESAMT', '', '', '', '', lohnGesamt.total_stunden, lohnGesamt.total_lohn]);
    const csv = [header, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Lohnabrechnung_${MONATSNAMEN[lohnMonat]}_${lohnJahr}.csv`;
    link.click();
  };

  if (loading) return <div className="personal-container-modern">Lade Personal-Daten...</div>;
  if (error) return <div className="personal-container-modern error">{error}</div>;

  return (
    <div className="personal-container-modern">
      <div className="personal-header">
        <h2>🧑‍💼 Personal-Verwaltung</h2>
        <p className="personal-subtitle">Mitarbeiter und Personalverwaltung</p>
      </div>

      {/* View-Tabs */}
      <div className="personal-view-tabs">
        <button
          className={`personal-view-tab${activeView === 'personal' ? ' personal-view-tab--active' : ''}`}
          onClick={() => setActiveView('personal')}
        >
          👥 Mitarbeiter
        </button>
        <button
          className={`personal-view-tab${activeView === 'lohnabrechnung' ? ' personal-view-tab--active' : ''}`}
          onClick={() => setActiveView('lohnabrechnung')}
        >
          💰 Lohnabrechnung
        </button>
      </div>

      {/* ═══ LOHNABRECHNUNG VIEW ═══ */}
      {activeView === 'lohnabrechnung' && (
        <div className="lohnabrechnung-view">
          {/* Periode-Auswahl */}
          <div className="lohn-period-bar">
            <div className="lohn-period-selectors">
              <select
                className="lohn-select"
                value={lohnMonat}
                onChange={e => setLohnMonat(parseInt(e.target.value))}
              >
                {MONATSNAMEN.slice(1).map((name, i) => (
                  <option key={i+1} value={i+1}>{name}</option>
                ))}
              </select>
              <select
                className="lohn-select"
                value={lohnJahr}
                onChange={e => setLohnJahr(parseInt(e.target.value))}
              >
                {[now.getFullYear() - 1, now.getFullYear()].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button className="lohn-btn lohn-btn--primary" onClick={ladeLohnabrechnung}>
                Laden
              </button>
            </div>
            <button className="lohn-btn lohn-btn--export" onClick={exportLohnCSV} disabled={!lohnData.length}>
              CSV Export
            </button>
          </div>

          {/* Zusammenfassung */}
          <div className="lohn-summary-cards">
            <div className="lohn-summary-card">
              <div className="lohn-summary-label">Mitarbeiter</div>
              <div className="lohn-summary-value">{lohnData.length}</div>
            </div>
            <div className="lohn-summary-card">
              <div className="lohn-summary-label">Gesamtstunden</div>
              <div className="lohn-summary-value">{lohnGesamt.total_stunden} h</div>
            </div>
            <div className="lohn-summary-card lohn-summary-card--highlight">
              <div className="lohn-summary-label">Gesamtlohn</div>
              <div className="lohn-summary-value">€ {parseFloat(lohnGesamt.total_lohn || 0).toFixed(2)}</div>
            </div>
          </div>

          {/* Tabelle */}
          {lohnLoading ? (
            <div className="lohn-loading">Berechne Lohnabrechnung…</div>
          ) : lohnData.length === 0 ? (
            <div className="lohn-empty">
              <p>Keine Arbeitszeiten für {MONATSNAMEN[lohnMonat]} {lohnJahr} erfasst.</p>
              <p className="lohn-hint">Zeiten werden über Personal Check-in erfasst.</p>
            </div>
          ) : (
            <div className="lohn-table-wrap">
              <table className="lohn-table">
                <thead>
                  <tr>
                    <th>Mitarbeiter</th>
                    <th>Position</th>
                    <th>Art</th>
                    <th>€/h</th>
                    <th>Schichten</th>
                    <th>Stunden</th>
                    <th>Lohn</th>
                    <th>Zeitraum</th>
                  </tr>
                </thead>
                <tbody>
                  {lohnData.map(p => (
                    <tr key={p.personal_id}>
                      <td className="lohn-name">{p.vorname} {p.nachname}</td>
                      <td>{p.position || '–'}</td>
                      <td>
                        <span className="lohn-art-badge">{p.beschaeftigungsart || '–'}</span>
                      </td>
                      <td className="lohn-number">€ {parseFloat(p.stundenlohn || 0).toFixed(2)}</td>
                      <td className="lohn-number">{p.anzahl_schichten}</td>
                      <td className="lohn-number lohn-stunden">{parseFloat(p.total_stunden || 0).toFixed(2)} h</td>
                      <td className="lohn-number lohn-betrag">€ {parseFloat(p.total_lohn || 0).toFixed(2)}</td>
                      <td className="lohn-zeitraum">
                        {p.erster_tag && p.letzter_tag
                          ? `${new Date(p.erster_tag).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} – ${new Date(p.letzter_tag).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
                          : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="lohn-total-row">
                    <td colSpan={5}>Gesamt</td>
                    <td className="lohn-number">{lohnGesamt.total_stunden} h</td>
                    <td className="lohn-number">€ {parseFloat(lohnGesamt.total_lohn || 0).toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ MITARBEITER VIEW ═══ */}
      {activeView !== 'lohnabrechnung' && (<>

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
      </>)}
    </div>
  );
};

export default Personal;