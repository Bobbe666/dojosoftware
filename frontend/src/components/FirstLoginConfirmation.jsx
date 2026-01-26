import React, { useState, useEffect } from "react";
import { FileText, Shield, Home, CheckCircle, AlertTriangle, Loader } from "lucide-react";
import config from "../config";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import "./FirstLoginConfirmation.css";

/**
 * FirstLoginConfirmation Modal
 * Wird nach dem ersten Login eines importierten Mitglieds angezeigt
 * Erfordert Bestätigung von AGB, Datenschutz und Hausordnung
 */
const FirstLoginConfirmation = ({ isOpen, onClose, user, onConfirmed }) => {
  const [agbText, setAgbText] = useState("");
  const [datenschutzText, setDatenschutzText] = useState("");
  const [hausordnungText, setHausordnungText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const [agbAccepted, setAgbAccepted] = useState(false);
  const [datenschutzAccepted, setDatenschutzAccepted] = useState(false);
  const [hausordnungAccepted, setHausordnungAccepted] = useState(false);
  
  const [activeTab, setActiveTab] = useState("agb");

  // Lade Texte beim Öffnen
  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const dojoId = user?.dojo_id || 1;
      
      // AGB und Datenschutz laden
      const response = await fetchWithAuth(`${config.apiBaseUrl}/agb/${dojoId}`);
      if (response.ok) {
        const data = await response.json();
        setAgbText(data.agb_text || "AGB nicht verfügbar");
        setDatenschutzText(data.datenschutz_text || "Datenschutzerklärung nicht verfügbar");
      }
      
      // Hausordnung laden (falls vorhanden)
      try {
        const hausordnungResponse = await fetchWithAuth(`${config.apiBaseUrl}/dojo/${dojoId}/hausordnung`);
        if (hausordnungResponse.ok) {
          const hausData = await hausordnungResponse.json();
          setHausordnungText(hausData.hausordnung_text || getDefaultHausordnung());
        } else {
          setHausordnungText(getDefaultHausordnung());
        }
      } catch {
        setHausordnungText(getDefaultHausordnung());
      }
      
    } catch (err) {
      console.error("Fehler beim Laden der Dokumente:", err);
      setError("Dokumente konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  const getDefaultHausordnung = () => {
    return `Hausordnung des Dojos

1. Respektvolles Verhalten
   - Alle Mitglieder und Gäste werden mit Respekt behandelt
   - Pünktlichkeit zu den Trainingszeiten wird erwartet

2. Hygiene
   - Saubere Trainingskleidung ist Pflicht
   - Nach dem Training sind die Umkleiden ordentlich zu verlassen

3. Sicherheit
   - Anweisungen der Trainer sind zu befolgen
   - Schmuck ist vor dem Training abzulegen

4. Allgemeines
   - Das Dojo ist pfleglich zu behandeln
   - Fundsachen sind beim Trainer abzugeben`;
  };

  const handleSubmit = async () => {
    if (!agbAccepted || !datenschutzAccepted || !hausordnungAccepted) {
      setError("Bitte akzeptieren Sie alle Bedingungen");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/agb/import-confirmation/${user.mitglied_id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agb_akzeptiert: true,
            datenschutz_akzeptiert: true,
            hausordnung_akzeptiert: true,
            dojo_id: user.dojo_id || 1
          })
        }
      );

      if (response.ok) {
        onConfirmed && onConfirmed();
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || "Fehler beim Speichern");
      }
    } catch (err) {
      console.error("Fehler beim Bestätigen:", err);
      setError("Verbindungsfehler - bitte versuchen Sie es erneut");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const allAccepted = agbAccepted && datenschutzAccepted && hausordnungAccepted;

  return (
    <div className="first-login-overlay">
      <div className="first-login-modal">
        <div className="first-login-header">
          <AlertTriangle size={28} className="warning-icon" />
          <div>
            <h2>Willkommen bei uns!</h2>
            <p>Bitte bestätigen Sie die folgenden Dokumente, um fortzufahren</p>
          </div>
        </div>

        {loading ? (
          <div className="first-login-loading">
            <Loader className="spinner" size={32} />
            <p>Dokumente werden geladen...</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="first-login-tabs">
              <button
                className={`tab ${activeTab === "agb" ? "active" : ""} ${agbAccepted ? "accepted" : ""}`}
                onClick={() => setActiveTab("agb")}
              >
                <FileText size={18} />
                <span>AGB</span>
                {agbAccepted && <CheckCircle size={16} className="check-icon" />}
              </button>
              <button
                className={`tab ${activeTab === "datenschutz" ? "active" : ""} ${datenschutzAccepted ? "accepted" : ""}`}
                onClick={() => setActiveTab("datenschutz")}
              >
                <Shield size={18} />
                <span>Datenschutz</span>
                {datenschutzAccepted && <CheckCircle size={16} className="check-icon" />}
              </button>
              <button
                className={`tab ${activeTab === "hausordnung" ? "active" : ""} ${hausordnungAccepted ? "accepted" : ""}`}
                onClick={() => setActiveTab("hausordnung")}
              >
                <Home size={18} />
                <span>Hausordnung</span>
                {hausordnungAccepted && <CheckCircle size={16} className="check-icon" />}
              </button>
            </div>

            {/* Content */}
            <div className="first-login-content">
              {activeTab === "agb" && (
                <div className="document-section">
                  <div className="document-text" dangerouslySetInnerHTML={{ __html: agbText.replace(/\n/g, "<br>") }} />
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={agbAccepted}
                      onChange={(e) => setAgbAccepted(e.target.checked)}
                    />
                    <span>Ich habe die AGB gelesen und akzeptiere sie</span>
                  </label>
                </div>
              )}

              {activeTab === "datenschutz" && (
                <div className="document-section">
                  <div className="document-text" dangerouslySetInnerHTML={{ __html: datenschutzText.replace(/\n/g, "<br>") }} />
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={datenschutzAccepted}
                      onChange={(e) => setDatenschutzAccepted(e.target.checked)}
                    />
                    <span>Ich habe die Datenschutzerklärung gelesen und akzeptiere sie</span>
                  </label>
                </div>
              )}

              {activeTab === "hausordnung" && (
                <div className="document-section">
                  <div className="document-text" dangerouslySetInnerHTML={{ __html: hausordnungText.replace(/\n/g, "<br>") }} />
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={hausordnungAccepted}
                      onChange={(e) => setHausordnungAccepted(e.target.checked)}
                    />
                    <span>Ich habe die Hausordnung gelesen und akzeptiere sie</span>
                  </label>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="first-login-error">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="first-login-footer">
              <div className="acceptance-summary">
                <span className={agbAccepted ? "done" : ""}>AGB {agbAccepted ? "✓" : "○"}</span>
                <span className={datenschutzAccepted ? "done" : ""}>Datenschutz {datenschutzAccepted ? "✓" : "○"}</span>
                <span className={hausordnungAccepted ? "done" : ""}>Hausordnung {hausordnungAccepted ? "✓" : "○"}</span>
              </div>
              <button
                className="btn-confirm"
                onClick={handleSubmit}
                disabled={!allAccepted || submitting}
              >
                {submitting ? (
                  <>
                    <Loader className="spinner" size={18} />
                    Wird gespeichert...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Alle Bedingungen akzeptieren
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FirstLoginConfirmation;
