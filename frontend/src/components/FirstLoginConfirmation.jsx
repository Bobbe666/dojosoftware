import React, { useState, useEffect } from "react";
import { FileText, Shield, Home, CheckCircle, AlertTriangle, Loader, Scroll } from "lucide-react";
import config from "../config";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import "./FirstLoginConfirmation.css";

/**
 * FirstLoginConfirmation Modal
 * Wird nach dem ersten Login oder bei neuen Dokumenten-Versionen angezeigt
 * Erfordert Bestaetigung von AGB, Datenschutz, Dojo-Regeln und Hausordnung
 */
const FirstLoginConfirmation = ({ isOpen, onClose, user, onConfirmed }) => {
  const [agbText, setAgbText] = useState("");
  const [datenschutzText, setDatenschutzText] = useState("");
  const [dojoRegelnText, setDojoRegelnText] = useState("");
  const [hausordnungText, setHausordnungText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [agbAccepted, setAgbAccepted] = useState(false);
  const [datenschutzAccepted, setDatenschutzAccepted] = useState(false);
  const [dojoRegelnAccepted, setDojoRegelnAccepted] = useState(false);
  const [hausordnungAccepted, setHausordnungAccepted] = useState(false);

  const [activeTab, setActiveTab] = useState("agb");

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const dojoId = user?.dojo_id || 1;

      const response = await fetchWithAuth(`${config.apiBaseUrl}/agb/${dojoId}`);
      if (response.ok) {
        const data = await response.json();
        setAgbText(data.agb_text || getDefaultAGB());
        setDatenschutzText(data.dsgvo_text || getDefaultDatenschutz());
        setDojoRegelnText(data.dojo_regeln_text || getDefaultDojoRegeln());
        setHausordnungText(data.hausordnung_text || getDefaultHausordnung());
      }
    } catch (err) {
      console.error("Fehler beim Laden der Dokumente:", err);
      setError("Dokumente konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  const getDefaultAGB = () => {
    return `Allgemeine Geschaeftsbedingungen

1. Geltungsbereich
Diese AGB gelten fuer alle Mitgliedschaften und Leistungen des Dojos.

2. Mitgliedschaft
Die Mitgliedschaft beginnt mit der Annahme des Aufnahmeantrags.

3. Beitraege
Die Beitraege sind monatlich im Voraus zu entrichten.

4. Kuendigung
Die Kuendigung ist schriftlich moeglich.`;
  };

  const getDefaultDatenschutz = () => {
    return `Datenschutzerklaerung

1. Datenerhebung
Wir erheben nur die fuer die Mitgliedschaft notwendigen Daten.

2. Datenspeicherung
Ihre Daten werden sicher gespeichert und nicht an Dritte weitergegeben.

3. Ihre Rechte
Sie haben das Recht auf Auskunft, Berichtigung und Loeschung Ihrer Daten.`;
  };

  const getDefaultDojoRegeln = () => {
    return `Dojo-Regeln

1. Respekt
Behandeln Sie alle Trainingspartner mit Respekt.

2. Puenktlichkeit
Erscheinen Sie puenktlich zum Training.

3. Hygiene
Tragen Sie saubere Trainingskleidung.

4. Sicherheit
Befolgen Sie die Anweisungen der Trainer.`;
  };

  const getDefaultHausordnung = () => {
    return `Hausordnung

1. Allgemeines
Das Dojo ist ein Ort der Ruhe und Konzentration.

2. Umkleiden
Bitte verlassen Sie die Umkleiden ordentlich.

3. Fundsachen
Fundsachen bitte beim Trainer abgeben.

4. Wertsachen
Fuer Wertsachen wird keine Haftung uebernommen.`;
  };

  const handleSubmit = async () => {
    if (!agbAccepted || !datenschutzAccepted || !dojoRegelnAccepted || !hausordnungAccepted) {
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
            dojo_regeln_akzeptiert: true,
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
      console.error("Fehler beim Bestaetigen:", err);
      setError("Verbindungsfehler - bitte versuchen Sie es erneut");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const allAccepted = agbAccepted && datenschutzAccepted && dojoRegelnAccepted && hausordnungAccepted;

  const tabs = [
    { id: "agb", label: "AGB", icon: FileText, accepted: agbAccepted },
    { id: "datenschutz", label: "Datenschutz", icon: Shield, accepted: datenschutzAccepted },
    { id: "dojoregeln", label: "Dojo-Regeln", icon: Scroll, accepted: dojoRegelnAccepted },
    { id: "hausordnung", label: "Hausordnung", icon: Home, accepted: hausordnungAccepted },
  ];

  return (
    <div className="first-login-overlay">
      <div className="first-login-modal">
        <div className="first-login-header">
          <AlertTriangle size={28} className="warning-icon" />
          <div>
            <h2>Willkommen!</h2>
            <p>Bitte bestaetigen Sie die folgenden Dokumente</p>
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
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`tab ${activeTab === tab.id ? "active" : ""} ${tab.accepted ? "accepted" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <tab.icon size={18} />
                  <span>{tab.label}</span>
                  {tab.accepted && <CheckCircle size={16} className="check-icon" />}
                </button>
              ))}
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
                    <span>Ich habe die Datenschutzerklaerung gelesen und akzeptiere sie</span>
                  </label>
                </div>
              )}

              {activeTab === "dojoregeln" && (
                <div className="document-section">
                  <div className="document-text" dangerouslySetInnerHTML={{ __html: dojoRegelnText.replace(/\n/g, "<br>") }} />
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={dojoRegelnAccepted}
                      onChange={(e) => setDojoRegelnAccepted(e.target.checked)}
                    />
                    <span>Ich habe die Dojo-Regeln gelesen und akzeptiere sie</span>
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
                <span className={dojoRegelnAccepted ? "done" : ""}>Regeln {dojoRegelnAccepted ? "✓" : "○"}</span>
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
