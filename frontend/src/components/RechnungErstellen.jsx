import React, { useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config/config.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import '../styles/RechnungErstellen.css';

const RechnungErstellen = () => {
  const { token } = useAuth();
  const { activeDojo } = useDojoContext();

  // Form Data
  const [mitglieder, setMitglieder] = useState([]);
  const [artikel, setArtikel] = useState([]);
  const [selectedMitglied, setSelectedMitglied] = useState(null);

  const [rechnungsDaten, setRechnungsDaten] = useState({
    rechnungsnummer: 'Wird geladen...',
    kundennummer: '',
    belegdatum: new Date().toISOString().split('T')[0],
    leistungsdatum: new Date().toISOString().split('T')[0],
    zahlungsfrist: '',
    rabatt_prozent: 0,
    rabatt_auf_betrag: 0
  });

  const [positionen, setPositionen] = useState([]);
  const [neuePosition, setNeuePosition] = useState({
    artikel_id: '',
    bezeichnung: '',
    artikelnummer: '',
    menge: 1,
    einzelpreis: 0,
    ust_prozent: 19
  });

  useEffect(() => {
    loadMitglieder();
    loadArtikel();
    loadRechnungsnummer(rechnungsDaten.belegdatum);
  }, []);

  useEffect(() => {
    loadRechnungsnummer(rechnungsDaten.belegdatum);
  }, [rechnungsDaten.belegdatum]);

  const loadMitglieder = async () => {
    try {
      const response = await axios.get(`${config.apiBaseUrl}/mitglieder`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMitglieder(response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Mitglieder:', error);
    }
  };

  const loadArtikel = async () => {
    try {
      const response = await axios.get(`${config.apiBaseUrl}/artikel`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setArtikel(response.data.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Artikel:', error);
    }
  };

  const loadRechnungsnummer = async (datum) => {
    try {
      const response = await axios.get(`${config.apiBaseUrl}/rechnungen/naechste-nummer`, {
        params: { datum },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setRechnungsDaten(prev => ({
          ...prev,
          rechnungsnummer: response.data.rechnungsnummer
        }));
      }
    } catch (error) {
      console.error('Fehler beim Laden der Rechnungsnummer:', error);
      setRechnungsDaten(prev => ({
        ...prev,
        rechnungsnummer: 'Fehler beim Laden'
      }));
    }
  };

  const handleMitgliedChange = (mitglied_id) => {
    const mitglied = mitglieder.find(m => m.mitglied_id === parseInt(mitglied_id));
    setSelectedMitglied(mitglied);
    setRechnungsDaten({
      ...rechnungsDaten,
      kundennummer: mitglied?.mitglied_id || ''
    });
  };

  const handleArtikelChange = (artikel_id) => {
    const art = artikel.find(a => a.artikel_id === parseInt(artikel_id));
    if (art) {
      setNeuePosition({
        ...neuePosition,
        artikel_id: art.artikel_id,
        bezeichnung: art.name,
        artikelnummer: art.artikel_nummer || '',
        einzelpreis: art.verkaufspreis_cent / 100,
        ust_prozent: art.mwst_prozent || 19
      });
    }
  };

  const addPosition = () => {
    if (!neuePosition.bezeichnung || neuePosition.menge <= 0) return;

    setPositionen([...positionen, {
      ...neuePosition,
      pos: positionen.length + 1
    }]);

    setNeuePosition({
      artikel_id: '',
      bezeichnung: '',
      artikelnummer: '',
      menge: 1,
      einzelpreis: 0,
      ust_prozent: 19
    });
  };

  const removePosition = (index) => {
    const newPositionen = positionen.filter((_, i) => i !== index);
    setPositionen(newPositionen.map((pos, i) => ({ ...pos, pos: i + 1 })));
  };

  // Berechnungen
  const calculateZwischensumme = () => {
    return positionen.reduce((sum, pos) => sum + (pos.einzelpreis * pos.menge), 0);
  };

  const calculateRabatt = () => {
    const zwischensumme = calculateZwischensumme();
    if (rechnungsDaten.rabatt_prozent > 0) {
      const rabattBasis = rechnungsDaten.rabatt_auf_betrag || zwischensumme;
      return (rabattBasis * rechnungsDaten.rabatt_prozent) / 100;
    }
    return 0;
  };

  const calculateSumme = () => {
    return calculateZwischensumme() - calculateRabatt();
  };

  const calculateUSt = () => {
    const summe = calculateSumme();
    // Vereinfacht: nehmen wir an alle Positionen haben 19% USt
    return (summe * 19) / 100;
  };

  const calculateEndbetrag = () => {
    return calculateSumme() + calculateUSt();
  };

  const handleSpeichern = async () => {
    if (!selectedMitglied || positionen.length === 0) {
      alert('Bitte wählen Sie ein Mitglied und fügen Sie mindestens eine Position hinzu.');
      return;
    }

    const rechnungData = {
      mitglied_id: selectedMitglied.mitglied_id,
      datum: rechnungsDaten.belegdatum,
      faelligkeitsdatum: rechnungsDaten.zahlungsfrist,
      art: 'Verkauf',
      beschreibung: 'Rechnung',
      notizen: '',
      positionen: positionen.map(pos => ({
        bezeichnung: pos.bezeichnung,
        menge: pos.menge,
        einzelpreis: pos.einzelpreis,
        gesamtpreis: pos.einzelpreis * pos.menge,
        mwst_satz: pos.ust_prozent
      })),
      mwst_satz: 19
    };

    try {
      const response = await axios.post(`${config.apiBaseUrl}/rechnungen`, rechnungData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        alert(`Rechnung erfolgreich erstellt!\nRechnungsnummer: ${response.data.rechnungsnummer}`);
        // Reset form
        setSelectedMitglied(null);
        setPositionen([]);
        const neueDatum = new Date().toISOString().split('T')[0];
        setRechnungsDaten({
          rechnungsnummer: 'Wird geladen...',
          kundennummer: '',
          belegdatum: neueDatum,
          leistungsdatum: neueDatum,
          zahlungsfrist: '',
          rabatt_prozent: 0,
          rabatt_auf_betrag: 0
        });
        // Lade die nächste Rechnungsnummer
        loadRechnungsnummer(neueDatum);
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Erstellen der Rechnung');
    }
  };

  return (
    <div className="rechnung-erstellen-container">
      <div className="rechnung-editor">
        {/* Eingabeformular */}
        <div className="rechnung-form">
          <h2>Neue Rechnung erstellen</h2>

          <div className="form-section">
            <h3>Kunde</h3>
            <select onChange={(e) => handleMitgliedChange(e.target.value)} value={selectedMitglied?.mitglied_id || ''}>
              <option value="">Bitte wählen...</option>
              {mitglieder.map(m => (
                <option key={m.mitglied_id} value={m.mitglied_id}>
                  {m.vorname} {m.nachname}
                </option>
              ))}
            </select>
          </div>

          <div className="form-section">
            <h3>Rechnungsdaten</h3>
            <div className="form-grid">
              <div>
                <label>Belegdatum</label>
                <input
                  type="date"
                  value={rechnungsDaten.belegdatum}
                  onChange={(e) => setRechnungsDaten({...rechnungsDaten, belegdatum: e.target.value})}
                />
              </div>
              <div>
                <label>Leistungsdatum</label>
                <input
                  type="date"
                  value={rechnungsDaten.leistungsdatum}
                  onChange={(e) => setRechnungsDaten({...rechnungsDaten, leistungsdatum: e.target.value})}
                />
              </div>
              <div>
                <label>Zahlungsfrist</label>
                <input
                  type="date"
                  value={rechnungsDaten.zahlungsfrist}
                  onChange={(e) => setRechnungsDaten({...rechnungsDaten, zahlungsfrist: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Position hinzufügen</h3>
            <div className="position-input">
              <select onChange={(e) => handleArtikelChange(e.target.value)} value={neuePosition.artikel_id}>
                <option value="">Artikel wählen...</option>
                {artikel.map(a => (
                  <option key={a.artikel_id} value={a.artikel_id}>
                    {a.name} - {(a.verkaufspreis_cent / 100).toFixed(2)} €
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Menge"
                value={neuePosition.menge}
                onChange={(e) => setNeuePosition({...neuePosition, menge: parseInt(e.target.value)})}
                min="1"
              />
              <button onClick={addPosition} className="btn-add">Hinzufügen</button>
            </div>
          </div>

          <div className="form-section">
            <h3>Rabatt</h3>
            <div className="form-grid">
              <div>
                <label>Rabatt %</label>
                <input
                  type="number"
                  value={rechnungsDaten.rabatt_prozent}
                  onChange={(e) => setRechnungsDaten({...rechnungsDaten, rabatt_prozent: parseFloat(e.target.value) || 0})}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <button onClick={handleSpeichern} className="btn-save">Rechnung speichern</button>
        </div>

        {/* Rechnungsvorschau */}
        <div className="rechnung-preview">
          <div className="invoice-page">
            {/* Header */}
            <div className="invoice-header">
              <div className="company-info">
                <div className="company-small">
                  {activeDojo?.dojoname} | {activeDojo?.adresse} | {activeDojo?.ort}
                </div>
                <div className="recipient-address">
                  {selectedMitglied ? (
                    <>
                      <div>Herrn/Frau</div>
                      <div>{selectedMitglied.vorname} {selectedMitglied.nachname}</div>
                      <div>{selectedMitglied.adresse}</div>
                      <div>{selectedMitglied.plz} {selectedMitglied.ort}</div>
                    </>
                  ) : (
                    <div style={{color: '#999'}}>Bitte Kunde wählen</div>
                  )}
                </div>
              </div>
              <div className="invoice-meta">
                <div className="logo-placeholder">LOGO</div>
                <div className="invoice-numbers">
                  <div>Rechnungs-Nr.: {rechnungsDaten.rechnungsnummer || 'wird generiert'}</div>
                  <div>Kundennummer: {rechnungsDaten.kundennummer}</div>
                  <div>Belegdatum: {rechnungsDaten.belegdatum}</div>
                  <div>Liefer-/Leistungsdatum: {rechnungsDaten.leistungsdatum}</div>
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="invoice-title">
              <h1>Rechnung</h1>
              <div className="page-number">Seite 1 von 1</div>
            </div>

            {/* Positions Table */}
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Bezeichnung</th>
                  <th>Artikelnummer</th>
                  <th>Menge</th>
                  <th>Einheit</th>
                  <th>Preis</th>
                  <th>USt</th>
                  <th>Betrag EUR</th>
                </tr>
              </thead>
              <tbody>
                {positionen.map((pos, index) => (
                  <tr key={index}>
                    <td>{pos.pos}</td>
                    <td>{pos.bezeichnung}</td>
                    <td>{pos.artikelnummer}</td>
                    <td>{pos.menge}</td>
                    <td>Stk.</td>
                    <td>{pos.einzelpreis.toFixed(2)}</td>
                    <td>{pos.ust_prozent.toFixed(2)} %</td>
                    <td>{(pos.einzelpreis * pos.menge).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="invoice-totals">
              <div className="totals-row">
                <span>Zwischensumme:</span>
                <span>{calculateZwischensumme().toFixed(2)}</span>
              </div>
              {rechnungsDaten.rabatt_prozent > 0 && (
                <div className="totals-row">
                  <span>{rechnungsDaten.rabatt_prozent.toFixed(2)} % Rabatt auf EUR {(rechnungsDaten.rabatt_auf_betrag || calculateZwischensumme()).toFixed(2)}:</span>
                  <span>-{calculateRabatt().toFixed(2)}</span>
                </div>
              )}
              <div className="totals-row">
                <span>Summe:</span>
                <span>{calculateSumme().toFixed(2)}</span>
              </div>
              <div className="totals-row">
                <span>19,00 % USt. auf EUR {calculateSumme().toFixed(2)}:</span>
                <span>{calculateUSt().toFixed(2)}</span>
              </div>
              <div className="totals-row total-final">
                <span>Endbetrag:</span>
                <span>{calculateEndbetrag().toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Terms */}
            <div className="payment-terms">
              <p>Bitte beachten Sie unsere Zahlungsbedingung:</p>
              <p>Ohne Abzug bis zum {rechnungsDaten.zahlungsfrist || '___________'}.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RechnungErstellen;
