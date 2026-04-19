// =====================================================================================
// VERKAUF-KASSE KOMPONENTE - DOJOSOFTWARE KASSENSYSTEM
// =====================================================================================
// Touch-optimiertes Kassensystem für Bar- und Kartenzahlungen
// Deutsche rechtliche Grundlagen beachtet (GoBD, KassenSichV, TSE)
// =====================================================================================

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, ShoppingCart, User, CreditCard, Euro, Smartphone } from 'lucide-react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import config from '../config/config.js';
import { useDojoContext } from '../context/DojoContext';
import SumUpCheckout from './SumUpCheckout';
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

const VerkaufKasse = ({ kunde, onClose, checkin_id }) => {
  // =====================================================================================
  // DOJO CONTEXT
  // =====================================================================================
  const { activeDojo } = useDojoContext();
  const navigate = useNavigate();

  // Eingeloggter Benutzer aus JWT
  const kassiererName = useMemo(() => {
    try {
      const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
      if (!token) return 'Kassierer';
      const decoded = jwtDecode(token);
      if (decoded.vorname && decoded.nachname) return `${decoded.vorname} ${decoded.nachname}`;
      return decoded.name || decoded.username || decoded.email || 'Kassierer';
    } catch {
      return 'Kassierer';
    }
  }, []);

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

  // Startup-Dialog State
  const [showStartDialog, setShowStartDialog] = useState(!kunde);
  const [startModus, setStartModus] = useState(null); // null | 'bar' | 'kundenkonto'
  const [mitgliederSuche, setMitgliederSuche] = useState('');
  const [mitgliederResults, setMitgliederResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Mitglieder-Rabatt Dialog
  const [rabattDialog, setRabattDialog] = useState(null); // { artikelItem }

  // Warenkorb-Item Editing
  const [editingItemId, setEditingItemId] = useState(null);

  // Manueller Rabatt
  const [manualRabatt, setManualRabatt] = useState({ aktiv: false, typ: 'prozent', wert: '' });

  // Varianten-Modal State
  const [showVariantenModal, setShowVariantenModal] = useState(false);
  const [selectedArtikelForVariant, setSelectedArtikelForVariant] = useState(null);
  const [selectedVariante, setSelectedVariante] = useState({ groesse: '', farbe: '', material: '', preiskategorie: '' });
  const [replacingItemId, setReplacingItemId] = useState(null); // unique_id des Warenkorb-Items das ersetzt wird

  // SumUp State
  const [sumupAvailable, setSumupAvailable] = useState(false);
  const [showSumupCheckout, setShowSumupCheckout] = useState(false);

  const aggregierteCheckins = useMemo(
    () => aggregateCheckinsByMember(checkinsHeute),
    [checkinsHeute]
  );

  // Ref für kasse-layout: Höhe wird per JS gesetzt damit grid-template-rows: 1fr
  // korrekt auflöst – unabhängig vom Eltern-Layout (Dashboard, Checkin-App etc.)
  // showStartDialog in Dependencies: kasse-layout existiert erst wenn Dialog weg ist.
  const kasseLayoutRef = useRef(null);
  useLayoutEffect(() => {
    const el = kasseLayoutRef.current;
    if (!el) return; // kasse-layout noch nicht im DOM (z.B. showStartDialog=true)
    // Höhe direkt setzen – kein requestAnimationFrame nötig,
    // da useLayoutEffect nach DOM-Commit läuft (element ist positioniert)
    const top = el.getBoundingClientRect().top;
    const available = window.innerHeight - top;
    if (available > 100) {
      el.style.setProperty('height', `${available}px`, 'important');
    }
    const setHeight = () => {
      if (!kasseLayoutRef.current) return;
      const t = kasseLayoutRef.current.getBoundingClientRect().top;
      const h = window.innerHeight - t;
      if (h > 100) kasseLayoutRef.current.style.setProperty('height', `${h}px`, 'important');
    };
    window.addEventListener('resize', setHeight);
    return () => window.removeEventListener('resize', setHeight);
  }, [showStartDialog, aggregierteCheckins.length]);

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

  const searchMitglieder = async (term) => {
    if (!term || term.length < 2) { setMitgliederResults([]); return; }
    setSearchLoading(true);
    try {
      // Super-Admin: activeDojo?.id liefert die gewählte Dojo-ID
      // getSecureDojoId() liest dojo_id aus Query-Param für Super-Admin
      const dojoId = activeDojo?.id;
      const dojoParam = dojoId ? `&dojo_id=${dojoId}` : '';
      const res = await apiCall(`/mitglieder?search=${encodeURIComponent(term)}&limit=10${dojoParam}`);
      // Response ist direktes Array (kein Wrapper-Objekt)
      setMitgliederResults(Array.isArray(res) ? res : (res.mitglieder || res.data || []));
    } catch { setMitgliederResults([]); }
    finally { setSearchLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => searchMitglieder(mitgliederSuche), 300);
    return () => clearTimeout(t);
  }, [mitgliederSuche]);

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
      const API_BASE = config.apiBaseUrl;
      const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        // Try to get the error message from the response body
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          // If response body is not JSON, use the default error message
        }
        throw new Error(errorMessage);
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

      const artikelListe = warenkorb.map(item => ({
        artikel_id: item.artikel_id,
        menge: item.menge,
        einzelpreis_cent: Math.round((item.verkaufspreis_euro || 0) * 100)
      }));
      // Manuellen Rabatt inline berechnen (TDZ-sicher bei Vite-Prod-Build)
      const _base = warenkorb.reduce((s, i) => s + (i.verkaufspreis_euro || 0) * i.menge, 0);
      const _rabatt = manualRabatt.aktiv && manualRabatt.wert
        ? (manualRabatt.typ === 'prozent'
          ? Math.min(_base * (parseFloat(manualRabatt.wert) || 0) / 100, _base)
          : Math.min(parseFloat(manualRabatt.wert) || 0, _base))
        : 0;
      if (_rabatt > 0) {
        artikelListe.push({
          artikel_id: null,
          name: manualRabatt.typ === 'prozent'
            ? `Nachlass ${parseFloat(manualRabatt.wert)}%`
            : 'Nachlass',
          menge: 1,
          einzelpreis_cent: -Math.round(_rabatt * 100),
          mwst_prozent: 0
        });
      }
      const verkaufData = {
        mitglied_id: mitgliedId || null,
        kunde_name: kundeName || null,
        artikel: artikelListe,
        zahlungsart,
        gegeben_cent: zahlungsart === 'bar' ? Math.round(parseFloat(gegebenBetrag) * 100) : null,
        bemerkung: bemerkung || null,
        verkauft_von_name: kassiererName,
        dojo_id: activeDojo?.id || null,
        checkin_id: checkin_id || null
      };

      const response = await apiCall('/verkaeufe', {
        method: 'POST',
        body: JSON.stringify(verkaufData)
      });

      if (response.success) {
        const _clearKey = aktivePerson?.mitglied_id ? `vk_warenkorb_${aktivePerson.mitglied_id}` : null;
        if (_clearKey) localStorage.removeItem(_clearKey);
        setLetzterVerkauf(response);
        setVerkaufErfolgreich(true);
        setWarenkorb([]);
        setGegebenBetrag('');
        setKundeName('');
        setMitgliedId('');
        setBemerkung('');
        setManualRabatt({ aktiv: false, typ: 'prozent', wert: '' });
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

  // Verkauf mit SumUp-Zahlung abschließen
  const durchfuehrenVerkaufMitSumUp = async (sumupResult) => {
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
          einzelpreis_cent: Math.round((item.verkaufspreis_euro || 0) * 100)
        })),
        zahlungsart: 'sumup',
        gegeben_cent: null,
        bemerkung: bemerkung || null,
        verkauft_von_name: kassiererName,
        dojo_id: activeDojo?.id || null,
        checkin_id: checkin_id || null,
        // SumUp-spezifische Daten
        sumup_checkout_id: sumupResult.checkoutId,
        sumup_transaction_id: sumupResult.transactionId
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
        setShowSumupCheckout(false);
        setError(null);

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
  
  // Prüft ob Artikel Varianten hat und öffnet ggf. Modal
  const handleArtikelClick = (artikelItem) => {
    if (!artikelItem.verfuegbar) {
      setError('Artikel nicht verfügbar');
      return;
    }

    // Prüfe ob Artikel Varianten hat
    const hatVarianten = artikelItem.hat_varianten && (
      (artikelItem.varianten_groessen && artikelItem.varianten_groessen.length > 0) ||
      (artikelItem.varianten_farben && artikelItem.varianten_farben.length > 0) ||
      (artikelItem.varianten_material && artikelItem.varianten_material.length > 0) ||
      artikelItem.hat_preiskategorien
    );

    if (hatVarianten) {
      setSelectedArtikelForVariant(artikelItem);
      setSelectedVariante({ groesse: '', farbe: '', material: '', preiskategorie: '' });
      setShowVariantenModal(true);
    } else {
      addToWarenkorb(artikelItem);
    }
  };

  // Fügt Artikel mit ausgewählter Variante zum Warenkorb hinzu
  const addVariantToWarenkorb = () => {
    if (!selectedArtikelForVariant) return;

    const artikel = selectedArtikelForVariant;

    // Erstelle eindeutige ID für Variante
    const variantenKey = [
      selectedVariante.groesse,
      selectedVariante.farbe,
      selectedVariante.material,
      selectedVariante.preiskategorie
    ].filter(Boolean).join('-');

    const uniqueId = `${artikel.artikel_id}-${variantenKey || 'default'}`;

    // Bestimme den Preis basierend auf Preiskategorie
    let preisCent = artikel.verkaufspreis_cent;
    let preisEuro = artikel.verkaufspreis_euro;

    if (artikel.hat_preiskategorien && selectedVariante.preiskategorie) {
      if (selectedVariante.preiskategorie === 'kids' && artikel.preis_kids_cent) {
        preisCent = artikel.preis_kids_cent;
        preisEuro = artikel.preis_kids_euro;
      } else if (selectedVariante.preiskategorie === 'erwachsene' && artikel.preis_erwachsene_cent) {
        preisCent = artikel.preis_erwachsene_cent;
        preisEuro = artikel.preis_erwachsene_euro;
      }
    }

    // Erstelle Varianten-String für Anzeige
    const variantenText = [
      selectedVariante.groesse && `Gr. ${selectedVariante.groesse}`,
      selectedVariante.farbe,
      selectedVariante.material,
      selectedVariante.preiskategorie && (selectedVariante.preiskategorie === 'kids' ? 'Kids' : 'Erwachsene')
    ].filter(Boolean).join(', ');

    const artikelMitVariante = {
      ...artikel,
      unique_id: uniqueId,
      verkaufspreis_cent: preisCent,
      verkaufspreis_euro: preisEuro,
      name: variantenText ? `${artikel.name} (${variantenText})` : artikel.name,
      original_name: artikel.name,
      variante: { ...selectedVariante }
    };

    setShowVariantenModal(false);
    setSelectedArtikelForVariant(null);

    // Variante ersetzen (Warenkorb-Item editieren)
    if (replacingItemId) {
      setWarenkorb(prev => prev.map(item =>
        (item.unique_id === replacingItemId || String(item.artikel_id) === replacingItemId)
          ? { ...artikelMitVariante, menge: item.menge }
          : item
      ));
      setReplacingItemId(null);
      return;
    }

    // Rabatt-Check (wie bei normalem addToWarenkorb)
    if (aktivePerson?.mitglied_id && artikel.mitglieder_rabatt_wert > 0) {
      setRabattDialog({ artikelItem: artikelMitVariante });
      return;
    }

    setWarenkorb(prev => {
      const existingItem = prev.find(item => item.unique_id === uniqueId);
      if (existingItem) {
        return prev.map(item =>
          item.unique_id === uniqueId ? { ...item, menge: item.menge + 1 } : item
        );
      }
      return [...prev, { ...artikelMitVariante, menge: 1 }];
    });
  };

  const addToWarenkorbDirect = (artikelItem) => {
    if (!artikelItem.verfuegbar) {
      setError('Artikel nicht verfügbar');
      return;
    }

    setWarenkorb(prev => {
      const existingItem = prev.find(item => item.artikel_id === artikelItem.artikel_id && !item.unique_id);

      if (existingItem) {
        return prev.map(item =>
          item.artikel_id === artikelItem.artikel_id && !item.unique_id
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
  
  const addToWarenkorb = (artikelItem) => {
    // Mitglieder-Rabatt: nur anzeigen wenn Mitglied ausgewählt und Rabatt vorhanden
    if (aktivePerson?.mitglied_id && artikelItem.mitglieder_rabatt_wert > 0) {
      setRabattDialog({ artikelItem });
      return;
    }
    addToWarenkorbDirect(artikelItem);
  };

  const applyRabattAndAdd = (withRabatt) => {
    if (!rabattDialog) return;
    const item = rabattDialog.artikelItem;
    if (withRabatt && item.mitglieder_rabatt_typ === 'prozent') {
      const discount = item.mitglieder_rabatt_wert / 100;
      const discountedCent = Math.round(item.verkaufspreis_cent * (1 - discount));
      const discountedEuro = discountedCent / 100;
      addToWarenkorbDirect({
        ...item,
        verkaufspreis_cent: discountedCent,
        verkaufspreis_euro: discountedEuro,
        rabatt_angewendet: item.mitglieder_rabatt_wert,
        original_preis_euro: item.verkaufspreis_euro,
      });
    } else {
      addToWarenkorbDirect(item);
    }
    setRabattDialog(null);
  };

  const removeFromWarenkorb = (artikelId, uniqueId = null) => {
    setWarenkorb(prev => prev.filter(item => {
      if (uniqueId) {
        return item.unique_id !== uniqueId;
      }
      return item.artikel_id !== artikelId || item.unique_id;
    }));
  };

  const updateMenge = (artikelId, neueMenge, uniqueId = null) => {
    if (neueMenge <= 0) {
      removeFromWarenkorb(artikelId, uniqueId);
      return;
    }

    setWarenkorb(prev =>
      prev.map(item => {
        if (uniqueId) {
          return item.unique_id === uniqueId ? { ...item, menge: neueMenge } : item;
        }
        return (item.artikel_id === artikelId && !item.unique_id)
          ? { ...item, menge: neueMenge }
          : item;
      })
    );
  };
  
  const getStorageKey = (personId) =>
    personId ? `vk_warenkorb_${personId}` : null;

  const clearWarenkorb = () => {
    const key = getStorageKey(aktivePerson?.mitglied_id);
    if (key) localStorage.removeItem(key);
    setWarenkorb([]);
  };

  // Variante eines Warenkorb-Items ändern
  const handleEditVariant = (item) => {
    setSelectedArtikelForVariant(item);
    setSelectedVariante(item.variante || { groesse: '', farbe: '', material: '', preiskategorie: '' });
    setReplacingItemId(item.unique_id || String(item.artikel_id));
    setShowVariantenModal(true);
    setEditingItemId(null);
  };
  
  // =====================================================================================
  // CALCULATIONS
  // =====================================================================================

  // Berechne Summen gruppiert nach Steuersatz
  const steuerBerechnung = warenkorb.reduce((acc, item) => {
    const mwstSatz = item.mwst_prozent || 19;
    const brutto = (item.verkaufspreis_euro || 0) * item.menge;
    const netto = brutto / (1 + mwstSatz / 100);
    const steuer = brutto - netto;

    if (!acc[mwstSatz]) {
      acc[mwstSatz] = { netto: 0, steuer: 0, brutto: 0 };
    }

    acc[mwstSatz].netto += netto;
    acc[mwstSatz].steuer += steuer;
    acc[mwstSatz].brutto += brutto;

    return acc;
  }, {});

  const warenkorbSummeEuro = warenkorb.reduce((sum, item) =>
    sum + ((item.verkaufspreis_euro || 0) * item.menge), 0);

  const gesamtNetto = Object.values(steuerBerechnung).reduce((sum, s) => sum + s.netto, 0);
  const gesamtSteuer = Object.values(steuerBerechnung).reduce((sum, s) => sum + s.steuer, 0);

  const rabattBetrag = (() => {
    if (!manualRabatt.aktiv || !manualRabatt.wert) return 0;
    const wert = parseFloat(manualRabatt.wert) || 0;
    if (manualRabatt.typ === 'prozent') return Math.min(warenkorbSummeEuro * wert / 100, warenkorbSummeEuro);
    return Math.min(wert, warenkorbSummeEuro);
  })();
  const effektivSumme = warenkorbSummeEuro - rabattBetrag;

  const rueckgeld = zahlungsart === 'bar' && gegebenBetrag
    ? Math.max(0, parseFloat(gegebenBetrag) - effektivSumme)
    : 0;
  
  // =====================================================================================
  // EFFECTS
  // =====================================================================================
  
  useEffect(() => {
    loadKassenArtikel();
    loadHeutigeCheckins();
  }, []);

  // Warenkorb aus localStorage laden wenn Person bekannt wird
  useEffect(() => {
    const personId = aktivePerson?.mitglied_id;
    if (!personId) return;
    try {
      const saved = localStorage.getItem(`vk_warenkorb_${personId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWarenkorb(parsed);
        }
      }
    } catch {}
  }, [aktivePerson?.mitglied_id]);

  // Warenkorb in localStorage speichern wenn er sich ändert
  useEffect(() => {
    const personId = aktivePerson?.mitglied_id;
    if (!personId) return;
    if (warenkorb.length === 0) {
      localStorage.removeItem(`vk_warenkorb_${personId}`);
    } else {
      try {
        localStorage.setItem(`vk_warenkorb_${personId}`, JSON.stringify(warenkorb));
      } catch {}
    }
  }, [warenkorb, aktivePerson?.mitglied_id]);

  // Zahlung Modal: gegebenBetrag vorausfüllen wenn Modal öffnet
  useEffect(() => {
    if (showZahlung && zahlungsart === 'bar') {
      setGegebenBetrag(effektivSumme.toFixed(2));
    }
  }, [showZahlung]); // eslint-disable-line

  // SumUp Verfügbarkeit prüfen
  useEffect(() => {
    const checkSumup = async () => {
      const dojoId = activeDojo?.id || activeDojo;
      if (!dojoId) return;
      try {
        const response = await axios.get(`/sumup/status?dojo_id=${dojoId}`);
        setSumupAvailable(response.data?.active && response.data?.configured);
      } catch (err) {
        setSumupAvailable(false);
      }
    };
    checkSumup();
  }, [activeDojo]);
  
  // =====================================================================================
  // MITGLIED WECHSELN
  // =====================================================================================

  const mitgliedWechseln = () => {
    setSelectedMitglied(null);
    setKundeName('');
    setMitgliedId('');
    setWarenkorb([]);
    setManualRabatt({ aktiv: false, typ: 'prozent', wert: '' });
    setMitgliederSuche('');
    setMitgliederResults([]);
    setStartModus(null);
    setShowStartDialog(true);
  };

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
        {artikelList.map(artikel => {
          const hatVarianten = artikel.hat_varianten && (
            (artikel.varianten_groessen && artikel.varianten_groessen.length > 0) ||
            (artikel.varianten_farben && artikel.varianten_farben.length > 0) ||
            (artikel.varianten_material && artikel.varianten_material.length > 0) ||
            artikel.hat_preiskategorien
          );

          return (
            <button
              key={artikel.artikel_id}
              className={`artikel-button ${!artikel.verfuegbar ? 'disabled' : ''} ${hatVarianten ? 'has-variants' : ''}`}
              onClick={() => handleArtikelClick(artikel)}
              disabled={!artikel.verfuegbar}
            >
              <div className="artikel-bild">
                {artikel.bild_url ? (
                  <img src={artikel.bild_url} alt={artikel.name} />
                ) : (
                  <div className="artikel-placeholder">📦</div>
                )}
                {hatVarianten && <span className="variant-badge">Varianten</span>}
              </div>
              <div className="artikel-info">
                <div className="artikel-name">{artikel.name}</div>
                <div className="artikel-preis">
                  {artikel.verkaufspreis_euro.toFixed(2)}€
                  {hatVarianten && artikel.hat_preiskategorien && (
                    <span className="preis-hinweis"> (ab)</span>
                  )}
                </div>
                {artikel.lager_tracking && (
                  <div className="artikel-lager">
                    Lager: {artikel.lagerbestand}
                  </div>
                )}
              </div>
            </button>
          );
        })}
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
        {warenkorb.map(item => {
          const itemKey = item.unique_id || String(item.artikel_id);
          const isEditing = editingItemId === itemKey;
          return (
            <div
              key={itemKey}
              className={`warenkorb-item${isEditing ? ' warenkorb-item--editing' : ''}`}
              onClick={() => setEditingItemId(isEditing ? null : itemKey)}
            >
              <div className="item-info">
                <div className="item-name">
                  {item.name}
                  {item.rabatt_angewendet > 0 && (
                    <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', background: 'rgba(255,215,0,0.2)', color: 'var(--gold,#ffd700)', borderRadius: '4px', padding: '0.1rem 0.35rem' }}>
                      -{item.rabatt_angewendet}%
                    </span>
                  )}
                </div>
                <div className="item-details">
                  <span className="item-preis">
                    {item.verkaufspreis_euro?.toFixed(2) || '0.00'}€
                    {item.original_preis_euro && (
                      <span style={{ marginLeft: '0.3rem', textDecoration: 'line-through', fontSize: '0.78rem', opacity: 0.5 }}>
                        {item.original_preis_euro.toFixed(2)}€
                      </span>
                    )}
                  </span>
                  {!isEditing && (
                    <>
                      <span className="item-separator">×</span>
                      <span className="item-menge-display">{item.menge}</span>
                    </>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="item-menge-controls" onClick={e => e.stopPropagation()}>
                  <button className="item-menge-btn" onClick={() => updateMenge(item.artikel_id, item.menge - 1, item.unique_id)}>−</button>
                  <span className="item-menge-val">{item.menge}</span>
                  <button className="item-menge-btn" onClick={() => updateMenge(item.artikel_id, item.menge + 1, item.unique_id)}>+</button>
                  {item.hat_varianten && item.unique_id && (
                    <button className="item-menge-btn item-variant-btn" onClick={() => handleEditVariant(item)} title="Variante ändern">↻</button>
                  )}
                </div>
              ) : (
                <div className="item-summe">
                  {((item.verkaufspreis_euro || 0) * item.menge).toFixed(2)}€
                </div>
              )}

              <button
                className="item-remove-btn"
                onClick={e => { e.stopPropagation(); removeFromWarenkorb(item.artikel_id, item.unique_id); }}
                title="Entfernen"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {warenkorb.length === 0 && (
        <div className="warenkorb-empty">
          <span>Warenkorb leer</span>
        </div>
      )}

      {warenkorb.length > 0 && (
        <div className="warenkorb-summe">
          {/* Manueller Rabatt */}
          {!manualRabatt.aktiv ? (
            <button
              className="wk-rabatt-btn"
              onClick={() => setManualRabatt(r => ({ ...r, aktiv: true }))}
            >
              % Rabatt hinzufügen
            </button>
          ) : (
            <div className="wk-rabatt-row">
              <div className="wk-rabatt-inputs">
                <button
                  className={`wk-rabatt-typ${manualRabatt.typ === 'prozent' ? ' active' : ''}`}
                  onClick={() => setManualRabatt(r => ({ ...r, typ: 'prozent', wert: '' }))}
                >%</button>
                <button
                  className={`wk-rabatt-typ${manualRabatt.typ === 'betrag' ? ' active' : ''}`}
                  onClick={() => setManualRabatt(r => ({ ...r, typ: 'betrag', wert: '' }))}
                >€</button>
                <input
                  type="number"
                  min="0"
                  max={manualRabatt.typ === 'prozent' ? 100 : undefined}
                  step="0.01"
                  className="wk-rabatt-input"
                  placeholder={manualRabatt.typ === 'prozent' ? '0 %' : '0.00 €'}
                  value={manualRabatt.wert}
                  onChange={e => setManualRabatt(r => ({ ...r, wert: e.target.value }))}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
                <button
                  className="wk-rabatt-clear"
                  onClick={() => setManualRabatt({ aktiv: false, typ: 'prozent', wert: '' })}
                >×</button>
              </div>
              {rabattBetrag > 0 && (
                <div className="summe-row wk-rabatt-display">
                  <span>Nachlass</span>
                  <span style={{ color: '#22c55e' }}>−{rabattBetrag.toFixed(2)}€</span>
                </div>
              )}
            </div>
          )}

          <div className="summe-row">
            <span>Netto:</span>
            <span>{(gesamtNetto * (effektivSumme / warenkorbSummeEuro || 1)).toFixed(2)}€</span>
          </div>
          {Object.keys(steuerBerechnung).sort().map(mwstSatz => (
            <div key={mwstSatz} className="summe-row tax">
              <span>MwSt. {parseFloat(mwstSatz).toFixed(0)}%:</span>
              <span>{(steuerBerechnung[mwstSatz].steuer * (effektivSumme / warenkorbSummeEuro || 1)).toFixed(2)}€</span>
            </div>
          ))}
          <div className="summe-row total">
            <span>Gesamt (Brutto):</span>
            <span>{effektivSumme.toFixed(2)}€</span>
          </div>
        </div>
      )}

      {warenkorb.length > 0 && (
        <div className="warenkorb-checkout">
          <button
            className="btn btn-primary btn-large"
            onClick={() => setShowZahlung(true)}
          >
            Zur Kasse ({effektivSumme.toFixed(2)}€)
          </button>
        </div>
      )}
    </div>
  );
  
  const renderZahlung = () => (
    <div className="zahlung-modal" onClick={() => setShowZahlung(false)}>
      <div className="zahlung-content" onClick={e => e.stopPropagation()}>
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
              value="lastschrift"
              checked={zahlungsart === 'lastschrift'}
              onChange={(e) => setZahlungsart(e.target.value)}
            />
            <span>💳 Lastschrift</span>
          </label>

          {sumupAvailable && (
            <label className="zahlungsart-option sumup">
              <input
                type="radio"
                name="zahlungsart"
                value="sumup"
                checked={zahlungsart === 'sumup'}
                onChange={(e) => setZahlungsart(e.target.value)}
              />
              <span><Smartphone size={16} className="vk-icon-inline" /> SumUp Terminal</span>
            </label>
          )}
        </div>
        
        {zahlungsart === 'bar' && (
          <div className="bar-zahlung">
            <div className="betrag-row">
              <div className="form-group">
                <label>Zu zahlen (€):</label>
                <input
                  type="text"
                  value={effektivSumme.toFixed(2)}
                  readOnly
                  className="betrag-readonly"
                />
              </div>

              <div className="form-group">
                <label>Gegebener Betrag (€):</label>
                <input
                  type="number"
                  value={gegebenBetrag}
                  onChange={(e) => setGegebenBetrag(e.target.value)}
                  step="0.01"
                  min={effektivSumme}
                  placeholder={effektivSumme.toFixed(2)}
                />
              </div>

              <div className="form-group">
                <label>Rückgeld (€):</label>
                <div className="rueckgeld-inline">
                  {rueckgeld > 0 ? rueckgeld.toFixed(2) : '0.00'}
                </div>
              </div>
            </div>
          </div>
        )}

        {zahlungsart === 'sumup' && (
          <div className="sumup-zahlung">
            <SumUpCheckout
              amount={effektivSumme}
              description={`Verkauf ${warenkorb.length} Artikel`}
              dojoId={activeDojo?.id || activeDojo}
              mitgliedId={mitgliedId}
              zahlungstyp="verkauf"
              onSuccess={(result) => {
                // Verkauf mit SumUp-Daten abschließen
                durchfuehrenVerkaufMitSumUp(result);
              }}
              onError={(error) => {
                setError('SumUp Zahlung fehlgeschlagen: ' + error);
              }}
              onCancel={() => {
                setZahlungsart('bar');
              }}
            />
          </div>
        )}

        <div className="zahlung-form-section">
          <div className="kunde-mitglied-row">
            <div className="form-group">
              <label>Kunde:</label>
              <input
                type="text"
                value={kundeName}
                onChange={(e) => setKundeName(e.target.value)}
                placeholder="Name des Kunden"
              />
            </div>

            <div className="form-group">
              <label>Mitgliedsnummer:</label>
              <input
                type="text"
                value={mitgliedId}
                onChange={(e) => setMitgliedId(e.target.value)}
                placeholder="Mitgliedsnummer"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Bemerkung:</label>
            <textarea
              value={bemerkung}
              onChange={(e) => setBemerkung(e.target.value)}
              placeholder="Zusätzliche Informationen"
              rows="2"
            />
          </div>
        </div>
        
        <div className="zahlung-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowZahlung(false)}
          >
            Abbrechen
          </button>
          {zahlungsart !== 'sumup' && (
            <button
              className="btn btn-primary"
              onClick={durchfuehrenVerkauf}
              disabled={zahlungsart === 'bar' && !!gegebenBetrag && parseFloat(gegebenBetrag) < effektivSumme}
            >
              Verkauf abschließen
            </button>
          )}
        </div>
      </div>
    </div>
  );
  
  const renderErfolg = () => {
    const personName = aktivePerson
      ? (aktivePerson.full_name || `${aktivePerson.vorname || ''} ${aktivePerson.nachname || ''}`.trim())
      : (kundeName || null);
    return (
      <div className="erfolg-modal">
        <div className="erfolg-content">
          <div className="erfolg-icon">✅</div>
          <h3>Verkauf erfolgreich!</h3>
          {personName && <p className="erfolg-person">{personName}</p>}
          <p>Bon-Nummer: <strong>{letzterVerkauf?.bon_nummer}</strong></p>
          <p>Betrag: <strong>{letzterVerkauf?.brutto_gesamt_euro?.toFixed(2)}€</strong></p>
          {letzterVerkauf?.rueckgeld_euro > 0 && (
            <p>Rückgeld: <strong>{letzterVerkauf.rueckgeld_euro.toFixed(2)}€</strong></p>
          )}
          <div className="erfolg-actions">
            <button
              className="btn btn-primary"
              onClick={() => setVerkaufErfolgreich(false)}
            >
              Weiter {personName ? `(${personName})` : ''}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setVerkaufErfolgreich(false); mitgliedWechseln(); }}
            >
              Mitglied wechseln
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderVariantenModal = () => {
    if (!showVariantenModal || !selectedArtikelForVariant) return null;

    const artikel = selectedArtikelForVariant;
    const hasGroessen = artikel.varianten_groessen && artikel.varianten_groessen.length > 0;
    const hasFarben = artikel.varianten_farben && artikel.varianten_farben.length > 0;
    const hasMaterial = artikel.varianten_material && artikel.varianten_material.length > 0;
    const hasPreiskategorien = artikel.hat_preiskategorien;

    // Bestimme verfügbare Größen basierend auf Preiskategorie
    let verfuegbareGroessen = artikel.varianten_groessen || [];
    if (hasPreiskategorien && selectedVariante.preiskategorie) {
      if (selectedVariante.preiskategorie === 'kids' && artikel.groessen_kids?.length > 0) {
        verfuegbareGroessen = artikel.groessen_kids;
      } else if (selectedVariante.preiskategorie === 'erwachsene' && artikel.groessen_erwachsene?.length > 0) {
        verfuegbareGroessen = artikel.groessen_erwachsene;
      }
    }

    // Prüfe ob alle erforderlichen Varianten ausgewählt sind
    const isComplete = (
      (!hasGroessen || selectedVariante.groesse) &&
      (!hasFarben || selectedVariante.farbe) &&
      (!hasMaterial || selectedVariante.material) &&
      (!hasPreiskategorien || selectedVariante.preiskategorie)
    );

    // Berechne aktuellen Preis
    let aktuellerPreis = artikel.verkaufspreis_euro;
    if (hasPreiskategorien && selectedVariante.preiskategorie === 'kids' && artikel.preis_kids_euro) {
      aktuellerPreis = artikel.preis_kids_euro;
    } else if (hasPreiskategorien && selectedVariante.preiskategorie === 'erwachsene' && artikel.preis_erwachsene_euro) {
      aktuellerPreis = artikel.preis_erwachsene_euro;
    }

    return (
      <div className="varianten-modal-overlay" onClick={() => setShowVariantenModal(false)}>
        <div className="varianten-modal" onClick={(e) => e.stopPropagation()}>
          <div className="varianten-modal-header">
            <h3>{artikel.name}</h3>
            <button
              className="modal-close-btn"
              onClick={() => setShowVariantenModal(false)}
            >
              ×
            </button>
          </div>

          <div className="varianten-modal-content">
            {/* Preiskategorie (Kids/Erwachsene) */}
            {hasPreiskategorien && (
              <div className="varianten-section">
                <label>Preiskategorie:</label>
                <div className="varianten-options">
                  {artikel.preis_kids_cent && (
                    <button
                      type="button"
                      className={`variante-btn ${selectedVariante.preiskategorie === 'kids' ? 'selected' : ''}`}
                      onClick={() => setSelectedVariante(prev => ({ ...prev, preiskategorie: 'kids', groesse: '' }))}
                    >
                      Kids - {artikel.preis_kids_euro?.toFixed(2)}€
                    </button>
                  )}
                  {artikel.preis_erwachsene_cent && (
                    <button
                      type="button"
                      className={`variante-btn ${selectedVariante.preiskategorie === 'erwachsene' ? 'selected' : ''}`}
                      onClick={() => setSelectedVariante(prev => ({ ...prev, preiskategorie: 'erwachsene', groesse: '' }))}
                    >
                      Erwachsene - {artikel.preis_erwachsene_euro?.toFixed(2)}€
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Größen */}
            {hasGroessen && verfuegbareGroessen.length > 0 && (
              <div className="varianten-section">
                <label>Größe:</label>
                <div className="varianten-options groessen-grid">
                  {verfuegbareGroessen.map(groesse => (
                    <button
                      key={groesse}
                      type="button"
                      className={`variante-btn ${selectedVariante.groesse === groesse ? 'selected' : ''}`}
                      onClick={() => setSelectedVariante(prev => ({ ...prev, groesse }))}
                    >
                      {groesse}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Farbe + Material in einer Zeile */}
            {(hasFarben || hasMaterial) && (
              <div style={{ display: 'grid', gridTemplateColumns: hasFarben && hasMaterial ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                {hasFarben && (
                  <div className="varianten-section" style={{ marginBottom: 0 }}>
                    <label>Farbe:</label>
                    <div className="varianten-options">
                      {artikel.varianten_farben.map((farbe, idx) => {
                        const farbeName = typeof farbe === 'object' ? farbe.name : farbe;
                        const farbeHex = typeof farbe === 'object' ? farbe.hex : null;
                        return (
                          <button
                            key={farbeName || idx}
                            type="button"
                            className={`variante-btn ${selectedVariante.farbe === farbeName ? 'selected' : ''}`}
                            onClick={() => setSelectedVariante(prev => ({ ...prev, farbe: farbeName }))}
                            style={farbeHex ? { borderLeftColor: farbeHex, borderLeftWidth: '4px' } : {}}
                          >
                            {farbeName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {hasMaterial && (
                  <div className="varianten-section" style={{ marginBottom: 0 }}>
                    <label>Material:</label>
                    <div className="varianten-options">
                      {artikel.varianten_material.map((material, idx) => {
                        const materialName = typeof material === 'object' ? material.name : material;
                        return (
                          <button
                            key={materialName || idx}
                            type="button"
                            className={`variante-btn ${selectedVariante.material === materialName ? 'selected' : ''}`}
                            onClick={() => setSelectedVariante(prev => ({ ...prev, material: materialName }))}
                          >
                            {materialName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="varianten-preis">
              <span>Preis:</span>
              <span className="preis-wert">{aktuellerPreis?.toFixed(2)}€</span>
            </div>
          </div>

          <div className="varianten-modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setShowVariantenModal(false)}
            >
              Abbrechen
            </button>
            <button
              className="btn btn-primary"
              onClick={addVariantToWarenkorb}
              disabled={!isComplete}
            >
              In den Warenkorb
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =====================================================================================
  // MAIN RENDER
  // =====================================================================================
  
  if (loading) {
    return createPortal(
      <div className="verkauf-kasse vk-fullscreen">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Kasse wird geladen...</p>
        </div>
      </div>,
      document.body
    );
  }
  
  if (verkaufErfolgreich) {
    return renderErfolg();
  }

  if (showStartDialog) {
    return createPortal(
      <div className="checkin-system vk-fullscreen vk-start-overlay">
        <div className="vk-start-dialog">
          <div className="vk-start-header">
            <button className="vk-start-back" style={{ marginRight: '0.5rem' }} onClick={() => onClose ? onClose() : navigate(-1)}>←</button>
            <ShoppingCart size={28} />
            <h2>Verkauf starten</h2>
          </div>

          {!startModus && (
            <div className="vk-start-choices">
              <button className="vk-start-btn vk-start-btn--bar" onClick={() => setShowStartDialog(false)}>
                <span className="vk-start-btn-icon">💵</span>
                <span className="vk-start-btn-label">Bar / Karte</span>
                <span className="vk-start-btn-sub">Direktzahlung, kein Mitglied</span>
              </button>
              <button className="vk-start-btn vk-start-btn--konto" onClick={() => setStartModus('kundenkonto')}>
                <span className="vk-start-btn-icon">👤</span>
                <span className="vk-start-btn-label">Kundenkonto</span>
                <span className="vk-start-btn-sub">Mitglied auswählen &amp; zuordnen</span>
              </button>
            </div>
          )}

          {startModus === 'kundenkonto' && (
            <div className="vk-start-search">
              <input
                type="text"
                className="vk-start-search-input"
                placeholder="Mitglied suchen (Name, Nummer…)"
                value={mitgliederSuche}
                onChange={e => setMitgliederSuche(e.target.value)}
                autoFocus
              />
              {searchLoading && <div className="vk-start-search-loading">Suche…</div>}
              <div className="vk-start-results">
                {mitgliederResults.map(m => (
                  <button
                    key={m.mitglied_id}
                    className="vk-start-result-row"
                    onClick={() => {
                      selectMitglied({ ...m, full_name: `${m.vorname} ${m.nachname}` });
                      setShowStartDialog(false);
                    }}
                  >
                    <span className="vk-start-result-name">{m.vorname} {m.nachname}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {m.mitgliedsnummer && <span className="vk-start-result-nr">#{m.mitgliedsnummer}</span>}
                      {(() => {
                        try {
                          const saved = localStorage.getItem(`vk_warenkorb_${m.mitglied_id}`);
                          if (saved) {
                            const items = JSON.parse(saved);
                            if (Array.isArray(items) && items.length > 0) {
                              return <span style={{ fontSize: '0.72rem', background: 'rgba(255,215,0,0.2)', color: '#ffd700', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>🛒 {items.length} offen</span>;
                            }
                          }
                        } catch {}
                        return null;
                      })()}
                    </div>
                  </button>
                ))}
                {mitgliederSuche.length >= 2 && !searchLoading && mitgliederResults.length === 0 && (
                  <div className="vk-start-no-results">Kein Mitglied gefunden</div>
                )}
              </div>
              <button className="vk-start-back" onClick={() => { setStartModus(null); setMitgliederSuche(''); setMitgliederResults([]); }}>
                ← Zurück
              </button>
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="checkin-system vk-fullscreen">
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
                <span>{new Date().toLocaleDateString('de-DE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
            </div>
          </div>

          {/* Aktuelles Mitglied / Modus Anzeige */}
          <div className="vk-aktives-mitglied">
            <User size={16} className="vk-icon-inline" />
            <span className="vk-aktives-mitglied-name">
              {aktivePerson
                ? (aktivePerson.full_name || `${aktivePerson.vorname || ''} ${aktivePerson.nachname || ''}`.trim() || kundeName || 'Mitglied')
                : (kundeName || 'Barkauf / Karte')}
            </span>
            <button
              className="vk-mitglied-wechseln-btn"
              onClick={mitgliedWechseln}
              title="Mitglied oder Modus wechseln"
            >
              Wechseln
            </button>
          </div>

          {/* Schließen-Button */}
          <button
            className="close-kasse-button"
            onClick={() => onClose ? onClose() : navigate(-1)}
            title="Zurück zum Check-in Terminal"
          >
            <X size={24} />
            <span>Schließen</span>
          </button>
        </div>
      </div>
      
      <div className="checkin-container compact">
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
                          src={`${config.imageBaseUrl}/${person.foto_pfad}`}
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
        <div className="kasse-layout" ref={kasseLayoutRef}>
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
              style={{ '--kat-color': kat.farbe_hex }}
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
        </div>
        </div>
        
        {/* Zahlungsmodal */}
        {showZahlung && renderZahlung()}

        {/* Varianten-Modal */}
        {renderVariantenModal()}

        {/* Mitglieder-Rabatt Dialog */}
        {rabattDialog && (
          <div className="varianten-modal-overlay" onClick={() => applyRabattAndAdd(false)}>
            <div className="varianten-modal" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
              <div className="varianten-modal-header">
                <h3>Mitglieder-Rabatt</h3>
                <button className="modal-close-btn" onClick={() => applyRabattAndAdd(false)}>×</button>
              </div>
              <div className="varianten-modal-content" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🏷️</div>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.35rem', color: 'var(--text-primary, #fff)' }}>
                  <strong>{rabattDialog.artikelItem.name}</strong>
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary, rgba(255,255,255,0.7))', marginBottom: '0.9rem' }}>
                  Für <strong>{aktivePerson.vorname} {aktivePerson.nachname}</strong> ist ein Mitglieder-Rabatt von{' '}
                  <strong style={{ color: 'var(--gold, #ffd700)' }}>
                    {rabattDialog.artikelItem.mitglieder_rabatt_wert}%
                  </strong> hinterlegt.
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary, rgba(255,255,255,0.6))', marginBottom: '0.5rem' }}>
                  {rabattDialog.artikelItem.verkaufspreis_euro?.toFixed(2)}€ → <strong style={{ color: 'var(--gold, #ffd700)' }}>
                    {(rabattDialog.artikelItem.verkaufspreis_euro * (1 - rabattDialog.artikelItem.mitglieder_rabatt_wert / 100)).toFixed(2)}€
                  </strong>
                </p>
              </div>
              <div className="varianten-modal-actions">
                <button className="btn btn-secondary" onClick={() => applyRabattAndAdd(false)}>
                  Ohne Rabatt
                </button>
                <button className="btn btn-primary" onClick={() => applyRabattAndAdd(true)}>
                  ✓ Rabatt anwenden
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default VerkaufKasse;