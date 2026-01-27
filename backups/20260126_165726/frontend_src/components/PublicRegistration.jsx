import React, { useState, useEffect } from "react";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/PublicRegistration.css";
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';


const PublicRegistration = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [availableTarife, setAvailableTarife] = useState([]);

  // Familien-Registrierung State
  const [familyMode, setFamilyMode] = useState(false);
  const [showFamilyQuestion, setShowFamilyQuestion] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [addingFamilyMember, setAddingFamilyMember] = useState(false);
  const [newFamilyMember, setNewFamilyMember] = useState({
    vorname: "",
    nachname: "",
    geburtsdatum: "",
    geschlecht: "",
    email: "",
    password: "",
    passwordConfirm: ""
  });

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    vorname: "",
    nachname: "",
    geburtsdatum: "",
    geschlecht: "",
    strasse: "",
    hausnummer: "",
    plz: "",
    ort: "",
    telefon: "",
    iban: "",
    bic: "",
    bank_name: "",
    kontoinhaber: "",
    tarif_id: "",
    billing_cycle: "monatlich",
    payment_method: "lastschrift",
    vertragsbeginn: "",
    buddy_einladungen: {
      gruppe_erstellen: false,
      gruppe_name: "",
      freunde: [
        { email: "", name: "" },
        { email: "", name: "" },
        { email: "", name: "" }
      ]
    },
    gesundheitsfragen: {
      vorerkrankungen: "nein",
      medikamente: "nein",
      herzprobleme: "nein",
      rueckenprobleme: "nein",
      gelenkprobleme: "nein",
      sonstige_einschraenkungen: "",
      notfallkontakt_name: "",
      notfallkontakt_telefon: "",
      hausarzt_name: "",
      hausarzt_telefon: ""
    },
    agb_accepted: false,
    dsgvo_accepted: false,
    widerrufsrecht_acknowledged: false,
    kuendigungshinweise_acknowledged: false
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    fetchPublicTarife();
  }, []);

  const fetchPublicTarife = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/public/tarife`);
      const data = await response.json();
      if (data.success) {
        setAvailableTarife(data.data);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Tarife:', err);
    }
  };

  // Hilfsfunktion: Prüft ob jemand unter 18 ist
  const isMinor = (geburtsdatum) => {
    if (!geburtsdatum) return false;
    const today = new Date();
    const birthDate = new Date(geburtsdatum);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age < 18;
  };

  // Familienmitglied hinzufügen
  const addFamilyMember = async () => {
    // Validierung
    if (!newFamilyMember.vorname || !newFamilyMember.nachname || !newFamilyMember.geburtsdatum ||
        !newFamilyMember.geschlecht || !newFamilyMember.email || !newFamilyMember.password) {
      setError("Bitte füllen Sie alle Pflichtfelder aus.");
      return;
    }
    if (newFamilyMember.password !== newFamilyMember.passwordConfirm) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    if (newFamilyMember.password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    // E-Mail darf nicht bereits verwendet werden
    if (newFamilyMember.email === formData.email ||
        familyMembers.some(m => m.email === newFamilyMember.email)) {
      setError("Diese E-Mail-Adresse wird bereits verwendet.");
      return;
    }

    setLoading(true);
    try {
      // Backend-API aufrufen um Familienmitglied zu registrieren
      const response = await fetchWithAuth(`${config.apiBaseUrl}/public/register/family/member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hauptmitglied_email: formData.email,
          vorname: newFamilyMember.vorname,
          nachname: newFamilyMember.nachname,
          geburtsdatum: newFamilyMember.geburtsdatum,
          geschlecht: newFamilyMember.geschlecht,
          email: newFamilyMember.email,
          password: newFamilyMember.password
        })
      });

      const data = await response.json();

      if (data.success) {
        setFamilyMembers(prev => [...prev, { ...newFamilyMember, familiePosition: data.data.familiePosition }]);
        setNewFamilyMember({
          vorname: "",
          nachname: "",
          geburtsdatum: "",
          geschlecht: "",
          email: "",
          password: "",
          passwordConfirm: ""
        });
        setAddingFamilyMember(false);
        setError("");
      } else {
        setError(data.error || "Fehler beim Hinzufügen des Familienmitglieds");
      }
    } catch (err) {
      console.error("Fehler beim Hinzufügen des Familienmitglieds:", err);
      setError("Verbindungsfehler. Bitte versuchen Sie es später erneut.");
    } finally {
      setLoading(false);
    }
  };

  // Familienmitglied entfernen
  const removeFamilyMember = async (index) => {
    const member = familyMembers[index];
    if (!member) return;

    // Aus lokalem State entfernen (optimistisch)
    setFamilyMembers(prev => prev.filter((_, i) => i !== index));

    // TODO: Backend-Call zum Entfernen könnte hier hinzugefügt werden
    // Da die Registrierung noch nicht abgeschlossen ist, reicht lokales Entfernen
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    setError("");
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.email || !formData.password || !formData.passwordConfirm) {
          setError("Bitte füllen Sie alle Felder aus.");
          return false;
        }
        if (formData.password !== formData.passwordConfirm) {
          setError("Passwörter stimmen nicht überein.");
          return false;
        }
        if (formData.password.length < 8) {
          setError("Passwort muss mindestens 8 Zeichen lang sein.");
          return false;
        }
        break;
      case 2:
        const requiredFields = ['vorname', 'nachname', 'geburtsdatum', 'geschlecht', 'strasse', 'hausnummer', 'plz', 'ort', 'telefon'];
        for (let field of requiredFields) {
          if (!formData[field]) {
            setError(`Bitte füllen Sie das Feld "${field}" aus.`);
            return false;
          }
        }
        break;
      case 3:
        if (!formData.iban || !formData.bic || !formData.bank_name || !formData.kontoinhaber) {
          setError("Bitte füllen Sie alle Bankdaten aus.");
          return false;
        }
        break;
      case 4:
        if (!formData.tarif_id || !formData.vertragsbeginn) {
          setError("Bitte wählen Sie einen Tarif und Vertragsbeginn.");
          return false;
        }
        break;
      case 5:
        // Buddy-Schritt ist optional - keine Validierung erforderlich
        break;
      case 6:
        if (!formData.gesundheitsfragen.notfallkontakt_name || !formData.gesundheitsfragen.notfallkontakt_telefon) {
          setError("Bitte geben Sie einen Notfallkontakt an.");
          return false;
        }
        break;
      case 7:
        if (!formData.agb_accepted || !formData.dsgvo_accepted ||
            !formData.widerrufsrecht_acknowledged || !formData.kuendigungshinweise_acknowledged) {
          setError("Bitte akzeptieren Sie alle erforderlichen Bedingungen.");
          return false;
        }
        break;
    }
    return true;
  };

  const handleNextStep = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);
    setError("");

    try {
      let endpoint = "";
      let payload = {};

      switch (currentStep) {
        case 1:
          endpoint = "/public/register/step1";
          payload = { email: formData.email, password: formData.password };
          break;
        case 2:
          endpoint = "/public/register/step2";
          payload = {
            email: formData.email,
            vorname: formData.vorname,
            nachname: formData.nachname,
            geburtsdatum: formData.geburtsdatum,
            geschlecht: formData.geschlecht,
            strasse: formData.strasse,
            hausnummer: formData.hausnummer,
            plz: formData.plz,
            ort: formData.ort,
            telefon: formData.telefon
          };
          break;
        case 3:
          endpoint = "/public/register/step3";
          payload = {
            email: formData.email,
            iban: formData.iban,
            bic: formData.bic,
            bank_name: formData.bank_name,
            kontoinhaber: formData.kontoinhaber
          };
          break;
        case 4:
          endpoint = "/public/register/step4";
          payload = {
            email: formData.email,
            tarif_id: formData.tarif_id,
            billing_cycle: formData.billing_cycle,
            payment_method: formData.payment_method,
            vertragsbeginn: formData.vertragsbeginn
          };
          break;
        case 5:
          // Buddy-Schritt: Optional - springe einfach zum nächsten Schritt
          setCurrentStep(currentStep + 1);
          setLoading(false);
          return;
        case 6:
          endpoint = "/public/register/step5";
          payload = {
            email: formData.email,
            gesundheitsfragen: formData.gesundheitsfragen
          };
          break;
        case 7:
          endpoint = "/public/register/step6";
          payload = {
            email: formData.email,
            agb_accepted: formData.agb_accepted,
            dsgvo_accepted: formData.dsgvo_accepted,
            widerrufsrecht_acknowledged: formData.widerrufsrecht_acknowledged,
            kuendigungshinweise_acknowledged: formData.kuendigungshinweise_acknowledged
          };
          break;
      }

      const response = await fetchWithAuth(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        if (currentStep === 7) {
          setSuccess("Registrierung erfolgreich abgeschlossen! Sie erhalten eine Bestätigungs-Email.");
          setTimeout(() => onClose(), 3000);
        } else if (currentStep === 1) {
          setSuccess("Registrierung gestartet. Bitte prüfen Sie Ihre E-Mails zur Verifizierung.");
          setTimeout(() => {
            setCurrentStep(2);
            setSuccess("");
          }, 2000);
        } else if (currentStep === 2) {
          // Nach Schritt 2: Familien-Frage anzeigen
          setShowFamilyQuestion(true);
        } else {
          setCurrentStep(currentStep + 1);
        }
      } else {
        setError(data.error || "Ein Fehler ist aufgetreten.");
      }
    } catch (err) {
      setError("Verbindungsfehler. Bitte versuchen Sie es später erneut.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError("");
    }
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  const renderStep = () => {
    // Familien-Schritt hat Vorrang wenn aktiv
    if (showFamilyQuestion) {
      return renderFamilyStep();
    }

    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderBuddyStep();
      case 6:
        return renderStep5();
      case 7:
        return renderStep6();
      default:
        return null;
    }
  };

  const renderStep1 = () => (
    <div className="registration-step">
      <h3>Schritt 1: Grundregistrierung</h3>
      <p>Erstellen Sie Ihr Konto mit E-Mail und Passwort.</p>

      <div className="form-group">
        <label>E-Mail-Adresse *</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange("email", e.target.value)}
          placeholder="ihre.email@beispiel.de"
          required
        />
      </div>

      <div className="form-group">
        <label>Passwort * (mindestens 8 Zeichen)</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => handleInputChange("password", e.target.value)}
          placeholder="Sicheres Passwort"
          required
        />
      </div>

      <div className="form-group">
        <label>Passwort bestätigen *</label>
        <input
          type="password"
          value={formData.passwordConfirm}
          onChange={(e) => handleInputChange("passwordConfirm", e.target.value)}
          placeholder="Passwort wiederholen"
          required
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="registration-step">
      <h3>Schritt 2: Persönliche Daten</h3>
      <p>Bitte geben Sie Ihre persönlichen Daten ein.</p>

      <div className="form-row">
        <div className="form-group">
          <label>Vorname *</label>
          <input
            type="text"
            value={formData.vorname}
            onChange={(e) => handleInputChange("vorname", e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Nachname *</label>
          <input
            type="text"
            value={formData.nachname}
            onChange={(e) => handleInputChange("nachname", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Geburtsdatum *</label>
          <input
            type="date"
            value={formData.geburtsdatum}
            onChange={(e) => handleInputChange("geburtsdatum", e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Geschlecht *</label>
          <select
            value={formData.geschlecht}
            onChange={(e) => handleInputChange("geschlecht", e.target.value)}
            required
          >
            <option value="">Bitte wählen</option>
            <option value="m">Männlich</option>
            <option value="w">Weiblich</option>
            <option value="d">Divers</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group flex-3">
          <label>Straße *</label>
          <input
            type="text"
            value={formData.strasse}
            onChange={(e) => handleInputChange("strasse", e.target.value)}
            required
          />
        </div>
        <div className="form-group flex-1">
          <label>Hausnummer *</label>
          <input
            type="text"
            value={formData.hausnummer}
            onChange={(e) => handleInputChange("hausnummer", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>PLZ *</label>
          <input
            type="text"
            value={formData.plz}
            onChange={(e) => handleInputChange("plz", e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Ort *</label>
          <input
            type="text"
            value={formData.ort}
            onChange={(e) => handleInputChange("ort", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label>Telefon *</label>
        <input
          type="tel"
          value={formData.telefon}
          onChange={(e) => handleInputChange("telefon", e.target.value)}
          placeholder="+49 123 456789"
          required
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="registration-step">
      <h3>Schritt 3: Bankdaten</h3>
      <p>Für die automatische Beitragszahlung benötigen wir Ihre Bankverbindung.</p>

      <div className="form-group">
        <label>IBAN *</label>
        <input
          type="text"
          value={formData.iban}
          onChange={(e) => handleInputChange("iban", e.target.value.toUpperCase())}
          placeholder="DE89 3704 0044 0532 0130 00"
          required
        />
      </div>

      <div className="form-group">
        <label>BIC *</label>
        <input
          type="text"
          value={formData.bic}
          onChange={(e) => handleInputChange("bic", e.target.value.toUpperCase())}
          placeholder="COBADEFFXXX"
          required
        />
      </div>

      <div className="form-group">
        <label>Bank Name *</label>
        <input
          type="text"
          value={formData.bank_name}
          onChange={(e) => handleInputChange("bank_name", e.target.value)}
          placeholder="Commerzbank AG"
          required
        />
      </div>

      <div className="form-group">
        <label>Kontoinhaber *</label>
        <input
          type="text"
          value={formData.kontoinhaber}
          onChange={(e) => handleInputChange("kontoinhaber", e.target.value)}
          placeholder="Max Mustermann"
          required
        />
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="registration-step">
      <h3>Schritt 4: Tarifauswahl</h3>
      <p>Wählen Sie Ihren gewünschten Tarif und Zahlungsweise.</p>

      <div className="tariff-selection">
        {availableTarife.map(tarif => (
          <div
            key={tarif.id}
            className={`tariff-card ${formData.tarif_id === tarif.id ? 'selected' : ''}`}
            onClick={() => handleInputChange("tarif_id", tarif.id)}
          >
            <h4>{tarif.name}</h4>
            <div className="price">{tarif.price_euros} € / Monat</div>
            <p>{tarif.beschreibung}</p>
          </div>
        ))}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Zahlungsrhythmus *</label>
          <select
            value={formData.billing_cycle}
            onChange={(e) => handleInputChange("billing_cycle", e.target.value)}
            required
          >
            <option value="monatlich">Monatlich</option>
            <option value="vierteljährlich">Vierteljährlich</option>
            <option value="halbjährlich">Halbjährlich</option>
            <option value="jährlich">Jährlich</option>
          </select>
        </div>
        <div className="form-group">
          <label>Zahlungsart *</label>
          <select
            value={formData.payment_method}
            onChange={(e) => handleInputChange("payment_method", e.target.value)}
            required
          >
            <option value="lastschrift">SEPA-Lastschrift</option>
            <option value="überweisung">Überweisung</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Gewünschter Vertragsbeginn *</label>
        <input
          type="date"
          value={formData.vertragsbeginn}
          onChange={(e) => handleInputChange("vertragsbeginn", e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          required
        />
      </div>
    </div>
  );

  const renderBuddyStep = () => {
    const updateFriend = (index, field, value) => {
      const newFreunde = [...formData.buddy_einladungen.freunde];
      newFreunde[index][field] = value;
      handleInputChange("buddy_einladungen.freunde", newFreunde);
    };

    const addFriend = () => {
      if (formData.buddy_einladungen.freunde.length < 5) {
        const newFreunde = [...formData.buddy_einladungen.freunde, { email: "", name: "" }];
        handleInputChange("buddy_einladungen.freunde", newFreunde);
      }
    };

    const removeFriend = (index) => {
      const newFreunde = formData.buddy_einladungen.freunde.filter((_, i) => i !== index);
      handleInputChange("buddy_einladungen.freunde", newFreunde);
    };

    return (
      <div className="registration-step">
        <h3>Schritt 5: Freunde einladen (Optional)</h3>
        <p>Möchten Sie Freunde zu dieser Mitgliedschaft einladen? Erstellen Sie eine Buddy-Gruppe und profitieren Sie gemeinsam!</p>

        <div className="buddy-invitation-section">
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.buddy_einladungen.gruppe_erstellen}
                onChange={(e) => handleInputChange("buddy_einladungen.gruppe_erstellen", e.target.checked)}
              />
              <span className="checkmark"></span>
              Ja, ich möchte eine Buddy-Gruppe erstellen und Freunde einladen
            </label>
          </div>

          {formData.buddy_einladungen.gruppe_erstellen && (
            <>
              <div className="form-group">
                <label>Gruppen-Name (Optional)</label>
                <input
                  type="text"
                  value={formData.buddy_einladungen.gruppe_name}
                  onChange={(e) => handleInputChange("buddy_einladungen.gruppe_name", e.target.value)}
                  placeholder="z.B. 'Karate-Freunde', 'Büro-Team', etc."
                />
              </div>

              <div className="buddy-friends-section">
                <h4>Freunde einladen:</h4>
                <p className="form-help">Ihre Freunde erhalten eine Einladungs-Email mit einem Link zur Registrierung.</p>

                {formData.buddy_einladungen.freunde.map((friend, index) => (
                  <div key={index} className="friend-input-row">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Name</label>
                        <input
                          type="text"
                          value={friend.name}
                          onChange={(e) => updateFriend(index, "name", e.target.value)}
                          placeholder="Name des Freundes"
                        />
                      </div>
                      <div className="form-group">
                        <label>E-Mail</label>
                        <input
                          type="email"
                          value={friend.email}
                          onChange={(e) => updateFriend(index, "email", e.target.value)}
                          placeholder="freund@beispiel.de"
                        />
                      </div>
                      <div className="form-group remove-button-group">
                        {formData.buddy_einladungen.freunde.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-remove"
                            onClick={() => removeFriend(index)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {formData.buddy_einladungen.freunde.length < 5 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-add-friend"
                    onClick={addFriend}
                  >
                    + Weiteren Freund hinzufügen
                  </button>
                )}
              </div>

              <div className="buddy-info">
                <h4>💡 Buddy-Gruppen Vorteile:</h4>
                <ul>
                  <li>Gemeinsam trainieren macht mehr Spaß</li>
                  <li>Gegenseitige Motivation und Unterstützung</li>
                  <li>Mögliche Gruppenrabatte (je nach Tarif)</li>
                  <li>Gemeinsame Fortschritte verfolgen</li>
                </ul>
              </div>
            </>
          )}

          {!formData.buddy_einladungen.gruppe_erstellen && (
            <div className="skip-buddy-info">
              <p>Kein Problem! Sie können auch später noch Freunde einladen oder einer bestehenden Gruppe beitreten.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStep5 = () => (
    <div className="registration-step">
      <h3>Schritt 6: Gesundheitsfragen</h3>
      <p>Diese Angaben helfen uns dabei, das Training optimal für Sie zu gestalten.</p>

      <div className="health-questions">
        <div className="form-group">
          <label>Haben Sie Vorerkrankungen?</label>
          <select
            value={formData.gesundheitsfragen.vorerkrankungen}
            onChange={(e) => handleInputChange("gesundheitsfragen.vorerkrankungen", e.target.value)}
          >
            <option value="nein">Nein</option>
            <option value="ja">Ja</option>
          </select>
        </div>

        <div className="form-group">
          <label>Nehmen Sie regelmäßig Medikamente?</label>
          <select
            value={formData.gesundheitsfragen.medikamente}
            onChange={(e) => handleInputChange("gesundheitsfragen.medikamente", e.target.value)}
          >
            <option value="nein">Nein</option>
            <option value="ja">Ja</option>
          </select>
        </div>

        <div className="form-group">
          <label>Haben Sie Herzprobleme?</label>
          <select
            value={formData.gesundheitsfragen.herzprobleme}
            onChange={(e) => handleInputChange("gesundheitsfragen.herzprobleme", e.target.value)}
          >
            <option value="nein">Nein</option>
            <option value="ja">Ja</option>
          </select>
        </div>

        <div className="form-group">
          <label>Haben Sie Rückenprobleme?</label>
          <select
            value={formData.gesundheitsfragen.rueckenprobleme}
            onChange={(e) => handleInputChange("gesundheitsfragen.rueckenprobleme", e.target.value)}
          >
            <option value="nein">Nein</option>
            <option value="ja">Ja</option>
          </select>
        </div>

        <div className="form-group">
          <label>Haben Sie Gelenkprobleme?</label>
          <select
            value={formData.gesundheitsfragen.gelenkprobleme}
            onChange={(e) => handleInputChange("gesundheitsfragen.gelenkprobleme", e.target.value)}
          >
            <option value="nein">Nein</option>
            <option value="ja">Ja</option>
          </select>
        </div>

        <div className="form-group">
          <label>Sonstige Einschränkungen oder Besonderheiten</label>
          <textarea
            value={formData.gesundheitsfragen.sonstige_einschraenkungen}
            onChange={(e) => handleInputChange("gesundheitsfragen.sonstige_einschraenkungen", e.target.value)}
            placeholder="Bitte beschreiben Sie weitere gesundheitliche Besonderheiten..."
            rows="3"
          />
        </div>

        <h4>Notfallkontakt</h4>
        <div className="form-row">
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              value={formData.gesundheitsfragen.notfallkontakt_name}
              onChange={(e) => handleInputChange("gesundheitsfragen.notfallkontakt_name", e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Telefon *</label>
            <input
              type="tel"
              value={formData.gesundheitsfragen.notfallkontakt_telefon}
              onChange={(e) => handleInputChange("gesundheitsfragen.notfallkontakt_telefon", e.target.value)}
              required
            />
          </div>
        </div>

        <h4>Hausarzt (optional)</h4>
        <div className="form-row">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={formData.gesundheitsfragen.hausarzt_name}
              onChange={(e) => handleInputChange("gesundheitsfragen.hausarzt_name", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Telefon</label>
            <input
              type="tel"
              value={formData.gesundheitsfragen.hausarzt_telefon}
              onChange={(e) => handleInputChange("gesundheitsfragen.hausarzt_telefon", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Familien-Schritt: Frage ob weitere Mitglieder + Formular
  const renderFamilyStep = () => {
    // Handler für Familienmitglied-Eingabefeld
    const handleFamilyMemberChange = (field, value) => {
      setNewFamilyMember(prev => ({ ...prev, [field]: value }));
      setError("");
    };

    // Ohne weitere Familienmitglieder fortfahren
    const continueWithoutFamily = () => {
      setShowFamilyQuestion(false);
      setFamilyMode(false);
      setCurrentStep(3);
    };

    // Familie aktivieren
    const activateFamilyMode = () => {
      setFamilyMode(true);
      setAddingFamilyMember(true);
    };

    // Familienmitglied speichern und weiteres hinzufügen
    const saveAndAddMore = () => {
      addFamilyMember();
      setAddingFamilyMember(true);
    };

    // Familien-Registrierung abschließen und zu Bankdaten gehen
    const finishFamilyAndContinue = () => {
      if (addingFamilyMember && newFamilyMember.vorname) {
        // Falls Formular ausgefüllt, erst speichern
        addFamilyMember();
      }
      setShowFamilyQuestion(false);
      setAddingFamilyMember(false);
      setCurrentStep(3);
    };

    return (
      <div className="registration-step family-step">
        <h3>Familien-Registrierung</h3>

        {/* Initiale Frage */}
        {!familyMode && familyMembers.length === 0 && (
          <div className="family-question">
            <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
              Möchten Sie weitere Familienmitglieder anmelden?
            </p>
            <div className="info-box" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <p style={{ margin: 0 }}>
                <strong>Familienmitglieder teilen Adresse und Bankverbindung</strong>, erhalten aber jeweils ein eigenes Konto und einen eigenen Vertrag.
                Ab dem 2. Familienmitglied gilt ein Familien-Rabatt.
              </p>
            </div>
            <div className="family-choice-buttons" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={activateFamilyMode}
              >
                Ja, weitere Mitglieder anmelden
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={continueWithoutFamily}
              >
                Nein, nur mich anmelden
              </button>
            </div>
          </div>
        )}

        {/* Familien-Übersicht */}
        {(familyMode || familyMembers.length > 0) && (
          <div className="family-overview">
            {/* Hauptmitglied anzeigen */}
            <div className="family-member-card hauptmitglied" style={{ padding: '1rem', marginBottom: '1rem', border: '2px solid var(--color-primary)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)' }}>
              <span style={{ display: 'inline-block', padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '4px', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                Hauptmitglied (voller Beitrag)
              </span>
              <h4 style={{ margin: '0.5rem 0' }}>{formData.vorname} {formData.nachname}</h4>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{formData.email}</p>
            </div>

            {/* Weitere Familienmitglieder */}
            {familyMembers.map((member, index) => (
              <div key={index} className="family-member-card" style={{ padding: '1rem', marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', position: 'relative' }}>
                <span style={{ display: 'inline-block', padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-success)', color: 'white', borderRadius: '4px', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  {index + 2}. Familienmitglied (mit Rabatt)
                </span>
                {isMinor(member.geburtsdatum) && (
                  <span style={{ display: 'inline-block', marginLeft: '0.5rem', padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-warning)', color: 'white', borderRadius: '4px', fontSize: '0.75rem' }}>
                    Minderjährig
                  </span>
                )}
                <h4 style={{ margin: '0.5rem 0' }}>{member.vorname} {member.nachname}</h4>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{member.email}</p>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  onClick={() => removeFamilyMember(index)}
                >
                  Entfernen
                </button>
              </div>
            ))}

            {/* Neues Familienmitglied Formular */}
            {addingFamilyMember && (
              <div className="family-member-form" style={{ padding: '1.5rem', border: '2px dashed var(--border-color)', borderRadius: '8px', marginBottom: '1rem' }}>
                <h4 style={{ marginTop: 0 }}>Neues Familienmitglied ({familyMembers.length + 2}. Mitglied)</h4>

                <div className="form-row">
                  <div className="form-group">
                    <label>Vorname *</label>
                    <input
                      type="text"
                      value={newFamilyMember.vorname}
                      onChange={(e) => handleFamilyMemberChange("vorname", e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Nachname *</label>
                    <input
                      type="text"
                      value={newFamilyMember.nachname}
                      onChange={(e) => handleFamilyMemberChange("nachname", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Geburtsdatum *</label>
                    <input
                      type="date"
                      value={newFamilyMember.geburtsdatum}
                      onChange={(e) => handleFamilyMemberChange("geburtsdatum", e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Geschlecht *</label>
                    <select
                      value={newFamilyMember.geschlecht}
                      onChange={(e) => handleFamilyMemberChange("geschlecht", e.target.value)}
                      required
                    >
                      <option value="">Bitte wählen</option>
                      <option value="m">Männlich</option>
                      <option value="w">Weiblich</option>
                      <option value="d">Divers</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>E-Mail-Adresse * (für eigenes Konto)</label>
                  <input
                    type="email"
                    value={newFamilyMember.email}
                    onChange={(e) => handleFamilyMemberChange("email", e.target.value)}
                    placeholder="familienmitglied@beispiel.de"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Passwort * (mindestens 8 Zeichen)</label>
                    <input
                      type="password"
                      value={newFamilyMember.password}
                      onChange={(e) => handleFamilyMemberChange("password", e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Passwort bestätigen *</label>
                    <input
                      type="password"
                      value={newFamilyMember.passwordConfirm}
                      onChange={(e) => handleFamilyMemberChange("passwordConfirm", e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Hinweis für geteilte Daten */}
                <div className="info-box" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.9rem' }}>
                  <p style={{ margin: 0 }}>
                    <strong>Hinweis:</strong> Adresse und Bankverbindung werden vom Hauptmitglied übernommen.
                  </p>
                </div>

                {/* Hinweis für Minderjährige */}
                {isMinor(newFamilyMember.geburtsdatum) && (
                  <div className="info-box" style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#fff3cd', borderRadius: '6px', fontSize: '0.9rem' }}>
                    <p style={{ margin: 0 }}>
                      Da dieses Mitglied minderjährig ist, wird <strong>{formData.vorname} {formData.nachname}</strong> als Erziehungsberechtigte/r hinterlegt.
                    </p>
                  </div>
                )}

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={addFamilyMember}
                  >
                    Hinzufügen
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setAddingFamilyMember(false);
                      setNewFamilyMember({
                        vorname: "", nachname: "", geburtsdatum: "",
                        geschlecht: "", email: "", password: "", passwordConfirm: ""
                      });
                    }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Aktionen */}
            {!addingFamilyMember && (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAddingFamilyMember(true)}
                >
                  + Weiteres Familienmitglied hinzufügen
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={finishFamilyAndContinue}
                >
                  Weiter zu Bankdaten
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderStep6 = () => (
    <div className="registration-step">
      <h3>Schritt 7: Rechtliche Zustimmungen</h3>
      <p>Bitte lesen und akzeptieren Sie die folgenden Bedingungen.</p>

      <div className="legal-agreements">
        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.agb_accepted}
              onChange={(e) => handleInputChange("agb_accepted", e.target.checked)}
              required
            />
            <span className="checkmark"></span>
            Ich akzeptiere die <a href="/agb" target="_blank">Allgemeinen Geschäftsbedingungen (AGB)</a> *
          </label>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.dsgvo_accepted}
              onChange={(e) => handleInputChange("dsgvo_accepted", e.target.checked)}
              required
            />
            <span className="checkmark"></span>
            Ich stimme der <a href="/datenschutz" target="_blank">Datenschutzerklärung (DSGVO)</a> zu *
          </label>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.widerrufsrecht_acknowledged}
              onChange={(e) => handleInputChange("widerrufsrecht_acknowledged", e.target.checked)}
              required
            />
            <span className="checkmark"></span>
            Ich habe die <a href="/widerrufsrecht" target="_blank">Widerrufsbelehrung</a> zur Kenntnis genommen *
          </label>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.kuendigungshinweise_acknowledged}
              onChange={(e) => handleInputChange("kuendigungshinweise_acknowledged", e.target.checked)}
              required
            />
            <span className="checkmark"></span>
            Ich habe die <strong>Kündigungshinweise</strong> zur Kenntnis genommen: <br/>
            <em>Die Kündigung muss <strong>3 Monate vor Ablauf der Vertragslaufzeit</strong> schriftlich erfolgen.
            Eine Kündigung ist nicht zum jeweiligen Monatsende, sondern nur zum Ende der vereinbarten Laufzeit möglich.</em> *
          </label>
        </div>
      </div>

      <div className="completion-info">
        <h4>🎉 Fast geschafft!</h4>
        <p>Nach dem Absenden wird Ihre Registrierung manuell geprüft und freigeschaltet.
        Sie erhalten eine Bestätigungs-E-Mail mit weiteren Informationen.</p>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay">
      {/* Überschreibende Styles für Inputs - höchste Spezifität */}
      <style>{`
        .modal-overlay .modal-content.registration-modal input[type="text"],
        .modal-overlay .modal-content.registration-modal input[type="email"],
        .modal-overlay .modal-content.registration-modal input[type="password"],
        .modal-overlay .modal-content.registration-modal input[type="date"],
        .modal-overlay .modal-content.registration-modal input[type="tel"],
        .modal-overlay .modal-content.registration-modal input[type="number"],
        .modal-overlay .modal-content.registration-modal textarea,
        .modal-overlay .modal-content.registration-modal select,
        .registration-modal input[type="text"],
        .registration-modal input[type="email"],
        .registration-modal input[type="password"],
        .registration-modal input[type="date"],
        .registration-modal input[type="tel"],
        .registration-modal input[type="number"],
        .registration-modal textarea,
        .registration-modal select,
        input[type="text"].reg-input,
        input[type="email"].reg-input,
        input[type="password"].reg-input,
        input[type="date"].reg-input {
          background: #ffffff !important;
          background-color: #ffffff !important;
          background-image: none !important;
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          border: 2px solid #cccccc !important;
          border-radius: 8px !important;
          padding: 0.8rem !important;
          font-size: 1rem !important;
          caret-color: #000000 !important;
        }
        .modal-overlay .modal-content.registration-modal input:focus,
        .modal-overlay .modal-content.registration-modal select:focus,
        .modal-overlay .modal-content.registration-modal textarea:focus,
        .registration-modal input:focus,
        .registration-modal select:focus,
        .registration-modal textarea:focus {
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          border-color: #ffd700 !important;
          outline: none !important;
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.3) !important;
        }
        .registration-modal input::placeholder,
        .registration-modal textarea::placeholder {
          color: #888888 !important;
          -webkit-text-fill-color: #888888 !important;
          opacity: 1 !important;
        }
        .registration-modal select option {
          background: #ffffff !important;
          color: #000000 !important;
        }
      `}</style>
      <div className="modal-content registration-modal">
        <div className="modal-header">
          <h2>Mitgliedschaft beantragen</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <div className="progress-text">
            Schritt {currentStep} von {totalSteps} ({Math.round(progressPercentage)}%)
          </div>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {renderStep()}
        </div>

        {/* Footer-Buttons verstecken wenn Familien-Schritt aktiv (hat eigene Buttons) */}
        {!showFamilyQuestion && (
          <div className="modal-footer">
            <div className="button-group">
              {currentStep > 1 && (
                <button
                  className="btn btn-secondary"
                  onClick={handlePrevStep}
                  disabled={loading}
                >
                  Zurück
                </button>
              )}

              <button
                className="btn btn-primary"
                onClick={handleNextStep}
                disabled={loading}
              >
                {loading ? "Wird verarbeitet..." :
                 currentStep === totalSteps ? "Registrierung abschließen" : "Weiter"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicRegistration;