// =====================================================================================
// VERKAUF-KASSE KOMPONENTE - DOJOSOFTWARE KASSENSYSTEM
// =====================================================================================
// Touch-optimiertes Kassensystem für Bar- und Kartenzahlungen
// Deutsche rechtliche Grundlagen beachtet (GoBD, KassenSichV, TSE)
// =====================================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { X, ShoppingCart, User, CreditCard, Euro } from 'lucide-react';
import '../styles/VerkaufKasse.css';
import '../styles/CheckinSystem.css';

const aggregateCheckinsByMember = (checkins = []) => {
  const map = new Map();

  checkins.forEach((entry) => {
    if (!entry) return;

    const key =
      entry.mitglied_id ||
      `${entry.vorname || ''}-${entry.nachname || ''}-${entry.checkin_id}`;

    if (!map.has(key)) {
      map.set(key, {
        mitglied_id: entry.mitglied_id,
        vorname: entry.vorname,
        nachname: entry.nachname,
        full_name:
          entry.full_name ||
          `${entry.vorname || ''} ${entry.nachname || ''}`.trim(),
        mitgliedsnummer: entry.mitgliedsnummer,
        foto_pfad: entry.foto_pfad,
        gurtfarbe: entry.gurtfarbe,
        kurse: [],
        checkins: [],
        primaryCheckin: entry,
      });
    }

    const aggregiert = map.get(key);
    aggregiert.kurse.push({
      kurs_name: entry.kurs_name,
      kurs_zeit: entry.kurs_zeit,
      checkin_time: entry.checkin_time,
      stundenplan_id: entry.stundenplan_id,
      anwesenheits_typ: entry.anwesenheits_typ,
    });
    aggregiert.checkins.push(entry);

    if (
      entry.checkin_time &&
      (!aggregiert.primaryCheckin?.checkin_time ||
        new Date(entry.checkin_time) <
          new Date(aggregiert.primaryCheckin.checkin_time))
    ) {
      aggregiert.primaryCheckin = entry;
    }
  });

  return Array.from(map.values());
};

const VerkaufKasse = ({ kunde, onClose }) => {
  // =====================================================================================
  // STATE MANAGEMENT
  // =====================================================================================
  
  const [artikel, setArtikel] = useState([]);
  const [kategorien, setKategorien] = useState([]);
  const [warenkorb, setWarenkorb] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Kassen-States
  const [zahlungsart, setZahlungsart] = useState('bar');
  const [gegebenBetrag, setGegebenBetrag] = useState('');
  const [kundeName, setKundeName] = useState(kunde ? `${kunde.vorname} ${kunde.nachname}` : '');
  const [mitgliedId, setMitgliedId] = useState(kunde ? kunde.mitglied_id : '');
  const [bemerkung, setBemerkung] = useState('');
  
  // UI States
  const [selectedKategorie, setSelectedKategorie] = useState(null);
  const [showZahlung, setShowZahlung] = useState(false);
  const [verkaufErfolgreich, setVerkaufErfolgreich] = useState(false);
  const [letzterVerkauf, setLetzterVerkauf] = useState(null);
  const [checkinsHeute, setCheckinsHeute] = useState([]);
  const [selectedMitglied, setSelectedMitglied] = useState(null);

  const aggregierteCheckins = useMemo(
    () => aggregateCheckinsByMember(checkinsHeute),
    [checkinsHeute]
  );

  const aktivePerson = selectedMitglied || kunde;

  const selectMitglied = (mitglied) => {
    if (!mitglied) {
      setSelectedMitglied(null);
      if (!kunde) {
        setKundeName('');
        setMitgliedId('');
      }
      return;
    }

    const name =
      mitglied.full_name ||
      `${mitglied.vorname || ''} ${mitglied.nachname || ''}`.trim();
    setSelectedMitglied(mitglied);
    setKundeName(name);
    setMitgliedId(mitglied.mitglied_id || '');
  };

  useEffect(() => {
    if (kunde) {
      selectMitglied(kunde);
    }
  }, [kunde]);

  useEffect(() => {
    if (!selectedMitglied?.mitglied_id) return;
    const match = aggregierteCheckins.find(
      (person) => person.mitglied_id === selectedMitglied.mitglied_id
    );
    if (match && match !== selectedMitglied) {
      selectMitglied(match);
    }
  }, [aggregierteCheckins]);

  // =====================================================================================
  // API FUNCTIONS
  // =====================================================================================
  
  const apiCall = async (endpoint, options = {}) => {
    try {
      const response = await fetch(`/api${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };
  
  // Artikel für Kasse laden
  const loadKassenArtikel = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/artikel/kasse');
      setArtikel(response.data || []);
      
      // Kategorien extrahieren
      const kategorienList = response.data?.map(kat => ({
        kategorie_id: kat.kategorie_id,
        name: kat.name,
        farbe_hex: kat.farbe_hex,
        icon: kat.icon,
        artikel: kat.artikel
      })) || [];
      setKategorien(kategorienList);
    } catch (error) {
      setError('Fehler beim Laden der Artikel: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadHeutigeCheckins = async () => {
    try {
      const response = await apiCall('/checkin/today');
      const list = response.checkins || [];
      setCheckinsHeute(list);
    } catch (error) {
      console.error('Fehler beim Laden der Check-ins für die Kasse:', error);
    }
  };
  
  // Verkauf durchführen
  const durchfuehrenVerkauf = async () => {
    try {
      if (warenkorb.length === 0) {
        setError('Warenkorb ist leer');
        return;
      }
      
      const verkaufData = {
        mitglied_id: mitgliedId || null,
        kunde_name: kundeName || null,
        artikel: warenkorb.map(item => ({
          artikel_id: item.artikel_id,
          menge: item.menge,
          einzelpreis_cent: item.einzelpreis_cent
        })),
        zahlungsart,
        gegeben_cent: zahlungsart === 'bar' ? Math.round(parseFloat(gegebenBetrag) * 100) : null,
        bemerkung: bemerkung || null,
        verkauft_von_name: 'Kassierer' // TODO: Echten Benutzer verwenden
      };
      
      const response = await apiCall('/verkaeufe', {
        method: 'POST',
        body: JSON.stringify(verkaufData)
      });
      
      if (response.success) {
        setLetzterVerkauf(response);
        setVerkaufErfolgreich(true);
        setWarenkorb([]);
        setGegebenBetrag('');
        setKundeName('');
        setMitgliedId('');
        setBemerkung('');
        setShowZahlung(false);
        setError(null);
        
        // Nach 3 Sekunden zur Kasse zurückkehren
        setTimeout(() => {
          setVerkaufErfolgreich(false);
          setLetzterVerkauf(null);
        }, 3000);
      } else {
        setError(response.error || 'Fehler beim Verkauf');
      }
    } catch (error) {
      setError('Fehler beim Verkauf: ' + error.message);
    }
  };
  
  // =====================================================================================
  // WARENKORB FUNCTIONS
  // =====================================================================================
  
  const addToWarenkorb = (artikelItem) => {
    if (!artikelItem.verfuegbar) {
      setError('Artikel nicht verfügbar');
      return;
    }
    
    setWarenkorb(prev => {
      const existingItem = prev.find(item => item.artikel_id === artikelItem.artikel_id);
      
      if (existingItem) {
        return prev.map(item =>
          item.artikel_id === artikelItem.artikel_id
            ? { ...item, menge: item.menge + 1 }
            : item
        );
      } else {
        return [...prev, {
          ...artikelItem,
          menge: 1
        }];
      }
    });
  };
  
  const removeFromWarenkorb = (artikelId) => {
    setWarenkorb(prev => prev.filter(item => item.artikel_id !== artikelId));
  };
  
  const updateMenge = (artikelId, neueMenge) => {
    if (neueMenge <= 0) {
      removeFromWarenkorb(artikelId);
      return;
    }
    
    setWarenkorb(prev =>
      prev.map(item =>
        item.artikel_id === artikelId
          ? { ...item, menge: neueMenge }
          : item
      )
    );
  };
  
  const clearWarenkorb = () => {
    setWarenkorb([]);
  };
  
  // =====================================================================================
  // CALCULATIONS
  // =====================================================================================
  
  const warenkorbSumme = warenkorb.reduce((sum, item) => sum + (item.brutto_cent * item.menge), 0);
  const warenkorbSummeEuro = warenkorbSumme / 100;
  
  const rueckgeld = zahlungsart === 'bar' && gegebenBetrag 
    ? Math.max(0, parseFloat(gegebenBetrag) - warenkorbSummeEuro)
    : 0;
  
  // =====================================================================================
  // EFFECTS
  // =====================================================================================
  
  useEffect(() => {
    loadKassenArtikel();
    loadHeutigeCheckins();
  }, []);
  
  // =====================================================================================
  // RENDER FUNCTIONS
  // =====================================================================================
  
  const renderArtikelGrid = () => {
    const kategorie = selectedKategorie 
      ? kategorien.find(kat => kat.kategorie_id === selectedKategorie)
      : null;
    
    const artikelList = kategorie ? kategorie.artikel : 
      kategorien.flatMap(kat => kat.artikel);
    
    return (
      <div className="artikel-grid">
        {artikelList.map(artikel => (
          <button
            key={artikel.artikel_id}
            className={`artikel-button ${!artikel.verfuegbar ? 'disabled' : ''}`}
            onClick={() => addToWarenkorb(artikel)}
            disabled={!artikel.verfuegbar}
          >
            <div className="artikel-bild">
              {artikel.bild_url ? (
                <img src={artikel.bild_url} alt={artikel.name} />
              ) : (
                <div className="artikel-placeholder">📦</div>
              )}
            </div>
            <div className="artikel-info">
              <div className="artikel-name">{artikel.name}</div>
              <div className="artikel-preis">
                {artikel.verkaufspreis_euro.toFixed(2)}€
              </div>
              {artikel.lager_tracking && (
                <div className="artikel-lager">
                  Lager: {artikel.lagerbestand}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  };
  
  const renderWarenkorb = () => (
    <div className="warenkorb">
      <div className="warenkorb-header">
        <h3>Warenkorb</h3>
        <button 
          className="btn btn-sm btn-danger"
          onClick={clearWarenkorb}
          disabled={warenkorb.length === 0}
        >
          🗑️ Leeren
        </button>
      </div>
      
      <div className="warenkorb-items">
        {warenkorb.map(item => (
          <div key={item.artikel_id} className="warenkorb-item">
            <div className="item-info">
              <div className="item-name">{item.name}</div>
              <div className="item-preis">
                {(item.einzelpreis_cent / 100).toFixed(2)}€
              </div>
            </div>
            
            <div className="item-menge">
              <button 
                className="btn btn-sm"
                onClick={() => updateMenge(item.artikel_id, item.menge - 1)}
              >
                -
              </button>
              <span className="menge">{item.menge}</span>
              <button 
                className="btn btn-sm"
                onClick={() => updateMenge(item.artikel_id, item.menge + 1)}
              >
                +
              </button>
            </div>
            
            <div className="item-summe">
              {(item.brutto_cent * item.menge / 100).toFixed(2)}€
            </div>
            
            <button 
              className="btn btn-sm btn-danger"
              onClick={() => removeFromWarenkorb(item.artikel_id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      
      {warenkorb.length > 0 && (
        <div className="warenkorb-summe">
          <div className="summe-row">
            <span>Zwischensumme:</span>
            <span>{warenkorbSummeEuro.toFixed(2)}€</span>
          </div>
          <div className="summe-row total">
            <span>Gesamt:</span>
            <span>{warenkorbSummeEuro.toFixed(2)}€</span>
          </div>
        </div>
      )}
    </div>
  );
  
  const renderZahlung = () => (
    <div className="zahlung-modal">
      <div className="zahlung-content">
        <h3>Zahlung</h3>
        
        <div className="zahlungsart-selection">
          <label className="zahlungsart-option">
            <input
              type="radio"
              name="zahlungsart"
              value="bar"
              checked={zahlungsart === 'bar'}
              onChange={(e) => setZahlungsart(e.target.value)}
            />
            <span>💵 Bar</span>
          </label>
          
          <label className="zahlungsart-option">
            <input
              type="radio"
              name="zahlungsart"
              value="karte"
              checked={zahlungsart === 'karte'}
              onChange={(e) => setZahlungsart(e.target.value)}
            />
            <span>💳 Karte</span>
          </label>
          
          <label className="zahlungsart-option">
            <input
              type="radio"
              name="zahlungsart"
              value="digital"
              checked={zahlungsart === 'digital'}
              onChange={(e) => setZahlungsart(e.target.value)}
            />
            <span>📱 Digital</span>
          </label>
        </div>
        
        {zahlungsart === 'bar' && (
          <div className="bar-zahlung">
            <div className="form-group">
              <label>Gegebener Betrag (€):</label>
              <input
                type="number"
                value={gegebenBetrag}
                onChange={(e) => setGegebenBetrag(e.target.value)}
                step="0.01"
                min={warenkorbSummeEuro}
                placeholder={warenkorbSummeEuro.toFixed(2)}
              />
            </div>
            
            {rueckgeld > 0 && (
              <div className="rueckgeld">
                Rückgeld: <strong>{rueckgeld.toFixed(2)}€</strong>
              </div>
            )}
          </div>
        )}
        
        <div className="form-group">
          <label>Kunde (optional):</label>
          <input
            type="text"
            value={kundeName}
            onChange={(e) => setKundeName(e.target.value)}
            placeholder="Name des Kunden"
          />
        </div>
        
        <div className="form-group">
          <label>Mitgliedsnummer (optional):</label>
          <input
            type="text"
            value={mitgliedId}
            onChange={(e) => setMitgliedId(e.target.value)}
            placeholder="Mitgliedsnummer"
          />
        </div>
        
        <div className="form-group">
          <label>Bemerkung (optional):</label>
          <textarea
            value={bemerkung}
            onChange={(e) => setBemerkung(e.target.value)}
            placeholder="Zusätzliche Informationen"
            rows="2"
          />
        </div>
        
        <div className="zahlung-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => setShowZahlung(false)}
          >
            Abbrechen
          </button>
          <button 
            className="btn btn-primary"
            onClick={durchfuehrenVerkauf}
            disabled={zahlungsart === 'bar' && parseFloat(gegebenBetrag) < warenkorbSummeEuro}
          >
            Verkauf abschließen
          </button>
        </div>
      </div>
    </div>
  );
  
  const renderErfolg = () => (
    <div className="erfolg-modal">
      <div className="erfolg-content">
        <div className="erfolg-icon">✅</div>
        <h3>Verkauf erfolgreich!</h3>
        <p>Bon-Nummer: <strong>{letzterVerkauf?.bon_nummer}</strong></p>
        <p>Betrag: <strong>{letzterVerkauf?.brutto_gesamt_euro?.toFixed(2)}€</strong></p>
        {letzterVerkauf?.rueckgeld_euro > 0 && (
          <p>Rückgeld: <strong>{letzterVerkauf.rueckgeld_euro.toFixed(2)}€</strong></p>
        )}
        <button 
          className="btn btn-primary"
          onClick={() => setVerkaufErfolgreich(false)}
        >
          Weiter verkaufen
        </button>
      </div>
    </div>
  );
  
  // =====================================================================================
  // MAIN RENDER
  // =====================================================================================
  
  if (loading) {
    return (
      <div className="verkauf-kasse">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Kasse wird geladen...</p>
        </div>
      </div>
    );
  }
  
  if (verkaufErfolgreich) {
    return renderErfolg();
  }
  
  return (
    <div className="checkin-system">
      {/* Header im Check-in Terminal Stil */}
      <div className="checkin-header">
        <div className="checkin-header-content">
          <div className="step-header">
            <div className="checkin-logo">
              <ShoppingCart size={24} />
            </div>
            <div>
              <h1 className="checkin-title">Kassensystem</h1>
              <div className="checkin-subtitle">
                <span>Verkauf für {kundeName}</span>
                <span>•</span>
                <span>{new Date().toLocaleDateString('de-DE', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
            </div>
          </div>
          
          {/* Schließen-Button */}
          <button 
            className="close-kasse-button"
            onClick={onClose}
            title="Zurück zum Check-in Terminal"
          >
            <X size={24} />
            <span>Schließen</span>
          </button>
        </div>
      </div>
      
      <div className="checkin-container compact">
        {aktivePerson?.kurse?.length > 0 && (
          <div className="kasse-kunde-kurse">
            <div className="kasse-kunde-kurse-header">
              <span className="kasse-kunde-name">
                {aktivePerson.full_name ||
                  `${aktivePerson.vorname || ''} ${aktivePerson.nachname || ''}`.trim()}
              </span>
              {selectedMitglied && (
                <button
                  type="button"
                  className="kasse-kunde-reset"
                  onClick={() => selectMitglied(null)}
                >
                  Auswahl entfernen
                </button>
              )}
            </div>
            <div className="kasse-kurs-tag-liste">
              {aktivePerson.kurse.map((kurs, index) => (
                <span
                  key={`${aktivePerson.mitglied_id || index}-${kurs.kurs_name || index}`}
                  className={`kasse-kurs-tag ${
                    kurs.anwesenheits_typ === 'trainer_hinzugefuegt'
                      ? 'trainer'
                      : 'checkin'
                  }`}
                >
                  <span className="name">{kurs.kurs_name || 'Kurs'}</span>
                  {kurs.kurs_zeit && <span className="zeit">{kurs.kurs_zeit}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {aggregierteCheckins.length > 0 && (
          <div className="kasse-checkins-leiste">
            <div className="kasse-checkins-header">
              <h3>Heute eingecheckt</h3>
              <span>{aggregierteCheckins.length}</span>
            </div>
            <div className="kasse-checkins-grid">
              {aggregierteCheckins.map((person) => {
                const name =
                  person.full_name ||
                  `${person.vorname || ''} ${person.nachname || ''}`.trim() ||
                  'Unbekannt';
                const aktiv =
                  selectedMitglied?.mitglied_id &&
                  selectedMitglied.mitglied_id === person.mitglied_id;
                const initials =
                  (person.vorname?.[0] || '') + (person.nachname?.[0] || '');
                return (
                  <button
                    key={person.mitglied_id || name}
                    type="button"
                    className={`kasse-checkin-card ${aktiv ? 'active' : ''}`}
                    onClick={() => selectMitglied(person)}
                  >
                    <div className="avatar">
                      {person.foto_pfad ? (
                        <img
                          src={`http://localhost:3002/${person.foto_pfad}`}
                          alt={name}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        initials || '👤'
                      )}
                    </div>
                    <div className="info">
                      <div className="name">{name}</div>
                      {person.kurse?.length > 0 && (
                        <div className="kurse">
                          {person.kurse.slice(0, 2).map((kurs, index) => (
                            <span
                              key={`${person.mitglied_id || index}-kurs-${index}`}
                              className={`kasse-kurs-tag mini ${
                                kurs.anwesenheits_typ === 'trainer_hinzugefuegt'
                                  ? 'trainer'
                                  : 'checkin'
                              }`}
                            >
                              <span className="name">
                                {kurs.kurs_name || 'Kurs'}
                              </span>
                            </span>
                          ))}
                          {person.kurse.length > 2 && (
                            <span className="mehr">
                              +{person.kurse.length - 2} weitere
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="message error">
            <X size={24} />
            <span>{error}</span>
          </div>
        )}
        
        {/* Kassen-Layout */}
        <div className="kasse-layout">
        {/* Kategorien */}
        <div className="kategorien-sidebar">
          <button
            className={`kategorie-button ${!selectedKategorie ? 'active' : ''}`}
            onClick={() => setSelectedKategorie(null)}
          >
            Alle Artikel
          </button>
          {kategorien.map(kat => (
            <button
              key={kat.kategorie_id}
              className={`kategorie-button ${selectedKategorie === kat.kategorie_id ? 'active' : ''}`}
              onClick={() => setSelectedKategorie(kat.kategorie_id)}
              style={{ borderLeftColor: kat.farbe_hex }}
            >
              <span className="kategorie-icon">{kat.icon}</span>
              {kat.name}
            </button>
          ))}
        </div>
        
        {/* Artikel Grid */}
        <div className="artikel-section">
          {renderArtikelGrid()}
        </div>
        
        {/* Warenkorb */}
        <div className="warenkorb-section">
          {renderWarenkorb()}
          
          {warenkorb.length > 0 && (
            <button 
              className="btn btn-primary btn-large"
              onClick={() => setShowZahlung(true)}
            >
              Zur Kasse ({warenkorbSummeEuro.toFixed(2)}€)
            </button>
          )}
        </div>
        </div>
        
        {/* Zahlungsmodal */}
        {showZahlung && renderZahlung()}
      </div>
    </div>
  );
};

export default VerkaufKasse;