import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Trash2,
  Edit,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from "lucide-react";
import { useDojoContext } from "../context/DojoContext";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/AutoLastschrift.css";

const API_BASE = window.API_BASE || "/api";

const AutoLastschriftTab = ({ embedded = false }) => {
  const { dojos, activeDojo } = useDojoContext();
  const [zeitplaene, setZeitplaene] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingZeitplan, setEditingZeitplan] = useState(null);
  const [expandedZeitplan, setExpandedZeitplan] = useState(null);
  const [ausfuehrungen, setAusfuehrungen] = useState({});
  const [executing, setExecuting] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    beschreibung: "",
    ausfuehrungstag: 1,
    ausfuehrungszeit: "06:00",
    typen: ["beitraege"], // Array für Mehrfachauswahl
    nur_faellige_bis_tag: "",
    aktiv: true,
    dojo_id: "" // Wird beim Öffnen des Modals gesetzt
  });

  // Aktuelles Dojo aus Context oder localStorage
  const currentDojoId = activeDojo?.id || localStorage.getItem("dojo_id");

  const loadZeitplaene = useCallback(async () => {
    try {
      setLoading(true);
      // Wenn "all" oder kein Dojo ausgewählt, lade alle Zeitpläne
      const queryDojoId = currentDojoId && currentDojoId !== "all" ? currentDojoId : "all";
      const response = await fetch(`${API_BASE}/lastschrift-zeitplaene?dojo_id=${queryDojoId}`);
      const data = await response.json();

      if (data.success) {
        setZeitplaene(data.zeitplaene || []);
      } else {
        setError(data.error || "Fehler beim Laden");
      }
    } catch (err) {
      setError("Verbindungsfehler: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [currentDojoId]);

  useEffect(() => {
    loadZeitplaene();
  }, [loadZeitplaene]);

  const loadAusfuehrungen = async (zeitplanId, zeitplanDojoId) => {
    try {
      const response = await fetch(
        `${API_BASE}/lastschrift-zeitplaene/${zeitplanId}/ausfuehrungen?dojo_id=${zeitplanDojoId}&limit=10`
      );
      const data = await response.json();

      if (data.success) {
        setAusfuehrungen(prev => ({
          ...prev,
          [zeitplanId]: data.ausfuehrungen || []
        }));
      }
    } catch (err) {
      console.error("Fehler beim Laden der Ausführungen:", err);
    }
  };

  const toggleExpand = (zeitplan) => {
    if (expandedZeitplan === zeitplan.zeitplan_id) {
      setExpandedZeitplan(null);
    } else {
      setExpandedZeitplan(zeitplan.zeitplan_id);
      if (!ausfuehrungen[zeitplan.zeitplan_id]) {
        loadAusfuehrungen(zeitplan.zeitplan_id, zeitplan.dojo_id);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = editingZeitplan
        ? `${API_BASE}/lastschrift-zeitplaene/${editingZeitplan.zeitplan_id}`
        : `${API_BASE}/lastschrift-zeitplaene`;

      const method = editingZeitplan ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          dojo_id: formData.dojo_id, // Verwende ausgewähltes Dojo aus Formular
          ausfuehrungszeit: formData.ausfuehrungszeit + ":00",
          nur_faellige_bis_tag: formData.nur_faellige_bis_tag || null,
          typ: formData.typen.join(",") // Konvertiere Array zu Komma-getrenntem String
        })
      });

      const data = await response.json();

      if (data.success) {
        setShowModal(false);
        setEditingZeitplan(null);
        resetForm();
        loadZeitplaene();
      } else {
        alert(data.error || "Fehler beim Speichern");
      }
    } catch (err) {
      alert("Fehler: " + err.message);
    }
  };

  const handleDelete = async (zeitplan) => {
    if (!window.confirm(`Zeitplan "${zeitplan.name}" wirklich löschen?`)) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/lastschrift-zeitplaene/${zeitplan.zeitplan_id}?dojo_id=${zeitplan.dojo_id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (data.success) {
        loadZeitplaene();
      } else {
        alert(data.error || "Fehler beim Löschen");
      }
    } catch (err) {
      alert("Fehler: " + err.message);
    }
  };

  const handleToggleAktiv = async (zeitplan) => {
    try {
      const response = await fetch(
        `${API_BASE}/lastschrift-zeitplaene/${zeitplan.zeitplan_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dojo_id: zeitplan.dojo_id,
            aktiv: !zeitplan.aktiv
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        loadZeitplaene();
      } else {
        alert(data.error || "Fehler beim Aktualisieren");
      }
    } catch (err) {
      alert("Fehler: " + err.message);
    }
  };

  const handleExecute = async (zeitplan) => {
    if (!window.confirm(`Zeitplan "${zeitplan.name}" jetzt ausführen?`)) {
      return;
    }

    setExecuting(zeitplan.zeitplan_id);

    try {
      const response = await fetch(
        `${API_BASE}/lastschrift-zeitplaene/${zeitplan.zeitplan_id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dojo_id: zeitplan.dojo_id })
        }
      );

      const data = await response.json();

      if (data.success) {
        alert(
          `Lastschriftlauf erfolgreich!\n\n` +
          `Verarbeitet: ${data.anzahl_verarbeitet}\n` +
          `Erfolgreich: ${data.anzahl_erfolgreich}\n` +
          `Betrag: ${(data.gesamtbetrag || 0).toFixed(2)} EUR`
        );
        loadZeitplaene();
        if (expandedZeitplan === zeitplan.zeitplan_id) {
          loadAusfuehrungen(zeitplan.zeitplan_id, zeitplan.dojo_id);
        }
      } else {
        alert(data.error || "Fehler bei der Ausführung");
      }
    } catch (err) {
      alert("Fehler: " + err.message);
    } finally {
      setExecuting(null);
    }
  };

  const openEditModal = (zeitplan) => {
    setEditingZeitplan(zeitplan);
    // Konvertiere typ String zu Array
    let typen = ["beitraege"];
    if (zeitplan.typ) {
      if (zeitplan.typ === "alle") {
        typen = ["beitraege", "rechnungen", "verkaeufe"];
      } else {
        typen = zeitplan.typ.split(",").filter(t => t);
      }
    }
    setFormData({
      name: zeitplan.name || "",
      beschreibung: zeitplan.beschreibung || "",
      ausfuehrungstag: zeitplan.ausfuehrungstag || 1,
      ausfuehrungszeit: zeitplan.ausfuehrungszeit?.substring(0, 5) || "06:00",
      typen: typen,
      nur_faellige_bis_tag: zeitplan.nur_faellige_bis_tag || "",
      aktiv: zeitplan.aktiv !== false,
      dojo_id: (zeitplan.dojo_id === null || zeitplan.dojo_id === 0) ? "all" : (zeitplan.dojo_id || "")
    });
    setShowModal(true);
  };

  const resetForm = () => {
    // Setze Standard-Dojo auf aktuell ausgewähltes (wenn nicht "all")
    const defaultDojoId = currentDojoId && currentDojoId !== "all" ? currentDojoId : (dojos.length > 0 ? dojos[0].id : "");
    setFormData({
      name: "",
      beschreibung: "",
      ausfuehrungstag: 1,
      ausfuehrungszeit: "06:00",
      typen: ["beitraege"],
      nur_faellige_bis_tag: "",
      aktiv: true,
      dojo_id: defaultDojoId
    });
  };

  // Helper: Dojo-Name finden
  const getDojoName = (dojoId) => {
    if (dojoId === "all" || dojoId === null || dojoId === 0 || dojoId === "0") return "Alle Dojos";
    const dojo = dojos.find(d => d.id == dojoId);
    return dojo ? dojo.dojoname : `Dojo ${dojoId}`;
  };

  const getTypLabel = (typ) => {
    const labels = {
      beitraege: "Beiträge",
      rechnungen: "Rechnungen",
      verkaeufe: "Verkäufe",
      alle: "Alle"
    };
    // Handle comma-separated types
    if (typ && typ.includes(",")) {
      const types = typ.split(",");
      if (types.length === 3) return "Alle";
      return types.map(t => labels[t] || t).join(", ");
    }
    return labels[typ] || typ;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "erfolg":
        return <CheckCircle size={16} className="text-success" />;
      case "teilweise":
        return <AlertCircle size={16} className="text-warning" />;
      case "fehler":
        return <XCircle size={16} className="text-danger" />;
      default:
        return null;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR"
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Lade Zeitpläne...</p>
      </div>
    );
  }

  return (
    <div className={`auto-lastschrift-container ${embedded ? "embedded" : ""}`}>
      <div className="section-header">
        <h2>
          <Calendar size={24} />
          Automatische Lastschriftläufe
        </h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setEditingZeitplan(null);
            setShowModal(true);
          }}
        >
          <Plus size={18} />
          Neuer Zeitplan
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
          <button onClick={loadZeitplaene} className="btn btn-sm btn-secondary ml-2">
            <RefreshCw size={14} /> Erneut versuchen
          </button>
        </div>
      )}

      {zeitplaene.length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>Keine Zeitpläne vorhanden</h3>
          <p>Erstellen Sie einen Zeitplan für automatische Lastschriftläufe.</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            <Plus size={18} /> Zeitplan erstellen
          </button>
        </div>
      ) : (
        <div className="zeitplaene-list">
          {zeitplaene.map((zeitplan) => (
            <div
              key={zeitplan.zeitplan_id}
              className={`zeitplan-card ${!zeitplan.aktiv ? "inactive" : ""}`}
            >
              <div className="zeitplan-header">
                <div className="zeitplan-info">
                  <div className="zeitplan-title">
                    <Calendar size={20} />
                    <h3>{zeitplan.name}</h3>
                    <span className={`badge ${zeitplan.aktiv ? "badge-success" : "badge-secondary"}`}>
                      {zeitplan.aktiv ? "Aktiv" : "Inaktiv"}
                    </span>
                  </div>
                  <div className="zeitplan-meta">
                    <span>
                      <Clock size={14} />
                      {zeitplan.ausfuehrungstag}. des Monats um{" "}
                      {zeitplan.ausfuehrungszeit?.substring(0, 5)} Uhr
                    </span>
                    <span className="badge badge-info">{getTypLabel(zeitplan.typ)}</span>
                    <span className="badge badge-secondary">{getDojoName(zeitplan.dojo_id)}</span>
                  </div>
                </div>

                <div className="zeitplan-actions">
                  <button
                    className="btn btn-sm btn-icon"
                    onClick={() => handleToggleAktiv(zeitplan)}
                    title={zeitplan.aktiv ? "Deaktivieren" : "Aktivieren"}
                  >
                    {zeitplan.aktiv ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    className="btn btn-sm btn-icon"
                    onClick={() => openEditModal(zeitplan)}
                    title="Bearbeiten"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    className="btn btn-sm btn-icon btn-danger"
                    onClick={() => handleDelete(zeitplan)}
                    title="Löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleExecute(zeitplan)}
                    disabled={executing === zeitplan.zeitplan_id}
                    title="Jetzt ausführen"
                  >
                    {executing === zeitplan.zeitplan_id ? (
                      <RefreshCw size={16} className="spinning" />
                    ) : (
                      <Play size={16} />
                    )}
                    Jetzt ausführen
                  </button>
                </div>
              </div>

              {/* Letzte Ausführung */}
              {zeitplan.letzte_ausfuehrung && (
                <div className="letzte-ausfuehrung">
                  <span className="label">Letzte Ausführung:</span>
                  <span className="date">{formatDate(zeitplan.letzte_ausfuehrung)}</span>
                  {getStatusIcon(zeitplan.letzte_ausfuehrung_status)}
                  <span className="count">{zeitplan.letzte_ausfuehrung_anzahl} Einzüge</span>
                  <span className="amount">{formatCurrency(zeitplan.letzte_ausfuehrung_betrag)}</span>
                </div>
              )}

              {/* Expand Button */}
              <button
                className="expand-btn"
                onClick={() => toggleExpand(zeitplan)}
              >
                {expandedZeitplan === zeitplan.zeitplan_id ? (
                  <>
                    <ChevronUp size={16} /> Weniger anzeigen
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} /> Historie anzeigen
                  </>
                )}
              </button>

              {/* Ausführungs-Historie */}
              {expandedZeitplan === zeitplan.zeitplan_id && (
                <div className="ausfuehrungen-liste">
                  <h4>Letzte Ausführungen</h4>
                  {!ausfuehrungen[zeitplan.zeitplan_id] ? (
                    <div className="loading-inline">Lade...</div>
                  ) : ausfuehrungen[zeitplan.zeitplan_id].length === 0 ? (
                    <p className="no-data">Noch keine Ausführungen</p>
                  ) : (
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Datum</th>
                          <th>Status</th>
                          <th>Verarbeitet</th>
                          <th>Erfolgreich</th>
                          <th>Betrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ausfuehrungen[zeitplan.zeitplan_id].map((a) => (
                          <tr key={a.ausfuehrung_id}>
                            <td>{formatDate(a.gestartet_am)}</td>
                            <td>
                              {getStatusIcon(a.status)}
                              <span className="ml-1">{a.status}</span>
                            </td>
                            <td>{a.anzahl_verarbeitet}</td>
                            <td>{a.anzahl_erfolgreich}</td>
                            <td>{formatCurrency(a.gesamtbetrag)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal für Erstellen/Bearbeiten */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingZeitplan ? "Zeitplan bearbeiten" : "Neuer Zeitplan"}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Dojo *</label>
                <select
                  value={formData.dojo_id}
                  onChange={(e) => setFormData({ ...formData, dojo_id: e.target.value })}
                  required
                >
                  <option value="">-- Dojo auswählen --</option>
                  <option value="all">Alle Dojos</option>
                  {dojos.map((dojo) => (
                    <option key={dojo.id} value={dojo.id}>
                      {dojo.dojoname}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="z.B. Monatsbeiträge Anfang"
                  required
                />
              </div>

              <div className="form-group">
                <label>Beschreibung</label>
                <textarea
                  value={formData.beschreibung}
                  onChange={(e) => setFormData({ ...formData, beschreibung: e.target.value })}
                  placeholder="Optionale Beschreibung..."
                  rows={2}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ausführungstag *</label>
                  <select
                    value={formData.ausfuehrungstag}
                    onChange={(e) =>
                      setFormData({ ...formData, ausfuehrungstag: parseInt(e.target.value) })
                    }
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}. des Monats
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Uhrzeit *</label>
                  <input
                    type="time"
                    value={formData.ausfuehrungszeit}
                    onChange={(e) =>
                      setFormData({ ...formData, ausfuehrungszeit: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Einzugstyp * (mehrere auswählbar)</label>
                <div className="checkbox-group">
                  {[
                    { value: "beitraege", label: "Beiträge" },
                    { value: "rechnungen", label: "Rechnungen" },
                    { value: "verkaeufe", label: "Verkäufe" }
                  ].map((option) => (
                    <label key={option.value} className="checkbox-option">
                      <input
                        type="checkbox"
                        value={option.value}
                        checked={formData.typen.includes(option.value)}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (e.target.checked) {
                            setFormData({ ...formData, typen: [...formData.typen, value] });
                          } else {
                            // Mindestens ein Typ muss ausgewählt sein
                            if (formData.typen.length > 1) {
                              setFormData({ ...formData, typen: formData.typen.filter(t => t !== value) });
                            }
                          }
                        }}
                      />
                      <span className="checkbox-text">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Nur Beiträge fällig bis Tag (optional)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.nur_faellige_bis_tag}
                  onChange={(e) =>
                    setFormData({ ...formData, nur_faellige_bis_tag: e.target.value })
                  }
                  placeholder="z.B. 15"
                />
                <small className="form-text">
                  Nur Beiträge einziehen, die bis zu diesem Tag des Monats fällig sind
                </small>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.aktiv}
                    onChange={(e) => setFormData({ ...formData, aktiv: e.target.checked })}
                  />
                  Zeitplan aktiv
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Abbrechen
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingZeitplan ? "Speichern" : "Erstellen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoLastschriftTab;
