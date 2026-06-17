import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import config from '../config/config.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import { QRCodeSVG } from 'qrcode.react';
import { Building2, Check } from 'lucide-react';
import '../styles/RechnungErstellen.css';

const RechnungErstellen = () => {
  const { token } = useAuth();
  const { activeDojo, dojos, switchDojo } = useDojoContext();
  const location = useLocation();
  const navigate = useNavigate();
  const editMode = location.state?.editMode || false;
  const editRechnungData = location.state?.rechnung || null;

  // Dojo-Auswahl Modal State
  const [showDojoSelection, setShowDojoSelection] = useState(false);
  const [dojoSelectionDone, setDojoSelectionDone] = useState(false);
  const [dojoLogo, setDojoLogo] = useState(null);

  // Form Data
  const [mitglieder, setMitglieder] = useState([]);
  const [artikel, setArtikel] = useState([]);
  const [selectedMitglied, setSelectedMitglied] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bankDaten, setBankDaten] = useState({
    bank_name: '',
    iban: '',
    bic: '',
    kontoinhaber: ''
  });

  // Berechne Zahlungsfrist (7 Tage nach Belegdatum)
  const calculateZahlungsfrist = (belegdatum) => {
    if (!belegdatum) return '';
    const datum = new Date(belegdatum);
    datum.setDate(datum.getDate() + 7);
    return datum.toISOString().split('T')[0];
  };

  const [rechnungsDaten, setRechnungsDaten] = useState({
    rechnungsnummer: 'Wird geladen...',
    kundennummer: '',
    belegdatum: new Date().toISOString().split('T')[0],
    leistungsdatum: new Date().toISOString().split('T')[0],
    zahlungsfrist: calculateZahlungsfrist(new Date().toISOString().split('T')[0]),
    rabatt_prozent: 0,
    rabatt_auf_betrag: 0,
    skonto_prozent: 0,
    skonto_tage: 0
  });

  const [positionen, setPositionen] = useState([]);
  const [neuePosition, setNeuePosition] = useState({
    artikel_id: '',
    bezeichnung: '',
    artikelnummer: '',
    menge: 1,
    einzelpreis: 0,
    ust_prozent: 19,
    ist_rabattfaehig: false,
    rabatt_prozent: 0,
    freitext: '',
    leistungsdatum: ''
  });
  const [showRabattHinweis, setShowRabattHinweis] = useState(false);
  const [zeigArtikelNummer, setZeigArtikelNummer] = useState(true);

  // Varianten-Modal State
  const [showVariantenModal, setShowVariantenModal] = useState(false);
  const [selectedArtikelForVariant, setSelectedArtikelForVariant] = useState(null);
  const [selectedVariante, setSelectedVariante] = useState({ groesse: '', farbe: '', material: '', preiskategorie: '' });

  // Inline-Anlegen
  const [showNeuerArtikelModal, setShowNeuerArtikelModal] = useState(false);
  const [showNeuerKundeModal, setShowNeuerKundeModal] = useState(false);
  const [neuerArtikelForm, setNeuerArtikelForm] = useState({
    name: '', beschreibung: '', artikel_nummer: '',
    kategorie_id: '', verkaufspreis_euro: '', einkaufspreis_euro: '',
    mwst_prozent: 19, lagerbestand: '', mindestbestand: '', lager_tracking: false
  });
  const [neuerKundeForm, setNeuerKundeForm] = useState({
    ist_firma: false,
    firmenname: '', ust_id: '', ansprechpartner: '',
    vorname: '', nachname: '', geburtsdatum: '',
    strasse: '', hausnummer: '', plz: '', ort: '',
    email: '', telefon: ''
  });
  const [artikelGruppen, setArtikelGruppen] = useState([]);
  const [savingModal, setSavingModal] = useState(false);
  const [modalError, setModalError] = useState('');

  // Click-to-edit popup state
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showPositionPopup, setShowPositionPopup] = useState(false);
  const [editingPositionIndex, setEditingPositionIndex] = useState(null);
  const [showRabattSkontoPopup, setShowRabattSkontoPopup] = useState(false);
  const [showMetaPopup, setShowMetaPopup] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          loadMitglieder(),
          loadArtikel(),
          loadRechnungsnummer(rechnungsDaten.belegdatum),
          loadBankDaten()
        ]);
        setError(null);
      } catch (err) {
        console.error('Fehler beim Laden der Daten:', err);
        setError('Fehler beim Laden der Daten: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Zeige Dojo-Auswahl wenn mehrere Dojos vorhanden sind
  useEffect(() => {
    if (!dojoSelectionDone && dojos && dojos.length > 1 && activeDojo !== 'super-admin') {
      setShowDojoSelection(true);
    } else if (dojos && dojos.length <= 1) {
      setDojoSelectionDone(true);
    }
  }, [dojos, dojoSelectionDone]);

  // Edit-Mode: Formular mit bestehender Rechnung befüllen (nach mitglieder-Load)
  useEffect(() => {
    if (!editMode || !editRechnungData || loading) return;

    const r = editRechnungData;

    // Mitglied aus geladener Liste suchen
    if (r.mitglied_id && mitglieder.length > 0) {
      const found = mitglieder.find(m => m.mitglied_id === r.mitglied_id);
      if (found) setSelectedMitglied(found);
    }

    // Datumsfelder
    setRechnungsDaten(prev => ({
      ...prev,
      rechnungsnummer: r.rechnungsnummer,
      belegdatum: r.datum ? r.datum.split('T')[0] : prev.belegdatum,
      leistungsdatum: r.datum ? r.datum.split('T')[0] : prev.leistungsdatum,
      zahlungsfrist: r.faelligkeitsdatum ? r.faelligkeitsdatum.split('T')[0] : prev.zahlungsfrist,
    }));

    // Positionen aus DB-Format in Formular-Format umwandeln
    if (r.positionen && r.positionen.length > 0) {
      setPositionen(r.positionen.map((p, i) => ({
        artikel_id: '',
        pos: p.position_nr || i + 1,
        bezeichnung: p.bezeichnung || '',
        artikelnummer: p.artikelnummer || '',
        menge: parseFloat(p.menge) || 1,
        einzelpreis: parseFloat(p.einzelpreis) || 0,
        ust_prozent: parseFloat(p.mwst_satz) || 19,
        ist_rabattfaehig: false,
        rabatt_prozent: 0,
        freitext: p.beschreibung || '',
        leistungsdatum: ''
      })));
    }
  }, [editMode, editRechnungData, loading, mitglieder]);

  // Lade Bankdaten und Logo neu, wenn sich activeDojo ändert
  useEffect(() => {
    if (activeDojo && activeDojo !== 'super-admin') {
      console.log('🔄 activeDojo geändert, lade Bankdaten und Logo neu...');
      loadBankDaten();
      loadDojoLogo();
    }
  }, [activeDojo?.dojo_id, activeDojo?.id]);

  // Lade Dojo-Logo
  const loadDojoLogo = async () => {
    try {
      if (!activeDojo?.dojo_id && !activeDojo?.id) {
        setDojoLogo(null);
        return;
      }

      const dojoId = activeDojo.dojo_id || activeDojo.id;
      console.log('🖼️ Lade Logo für Dojo:', dojoId);

      const response = await axios.get(`/dojos/${dojoId}/logos`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Suche nach Haupt-Logo
      const logos = response.data || [];
      const hauptLogo = logos.find(l => l.logo_type === 'haupt');

      if (hauptLogo?.url) {
        console.log('✅ Haupt-Logo gefunden:', hauptLogo.url);
        setDojoLogo(hauptLogo.url);
      } else {
        console.log('⚠️ Kein Haupt-Logo vorhanden');
        setDojoLogo(null);
      }
    } catch (error) {
      console.error('Fehler beim Laden des Logos:', error);
      setDojoLogo(null);
    }
  };

  // Handle Dojo-Auswahl
  const handleDojoSelect = (dojo) => {
    switchDojo(dojo);
    setShowDojoSelection(false);
    setDojoSelectionDone(true);
  };

  // Debug: Logge Bankdaten, wenn sie sich ändern
  useEffect(() => {
    console.log('📊 bankDaten State geändert:', bankDaten);
  }, [bankDaten]);

  useEffect(() => {
    loadRechnungsnummer(rechnungsDaten.belegdatum);
  }, [rechnungsDaten.belegdatum]);

  // Berechne Skonto-Tage automatisch aus Zahlungsziel
  useEffect(() => {
    if (rechnungsDaten.belegdatum && rechnungsDaten.zahlungsfrist) {
      const belegdatum = new Date(rechnungsDaten.belegdatum);
      const zahlungsfrist = new Date(rechnungsDaten.zahlungsfrist);
      const diffTime = zahlungsfrist - belegdatum;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0) {
        setRechnungsDaten(prev => ({
          ...prev,
          skonto_tage: diffDays
        }));
      }
    }
  }, [rechnungsDaten.belegdatum, rechnungsDaten.zahlungsfrist]);

  const loadMitglieder = async () => {
    try {
      const response = await axios.get(`/mitglieder`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMitglieder(response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Mitglieder:', error);
    }
  };

  const loadArtikel = async () => {
    try {
      const dojoId = activeDojo?.dojo_id || activeDojo?.id;
      const url = dojoId ? `/artikel?dojo_id=${dojoId}` : `/artikel`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setArtikel(response.data.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Artikel:', error);
    }
  };

  const loadArtikelGruppen = async () => {
    try {
      const dojoId = activeDojo?.dojo_id || activeDojo?.id;
      const url = dojoId ? `/artikel/kategorien?dojo_id=${dojoId}` : `/artikel/kategorien`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setArtikelGruppen(res.data.data || res.data || []);
    } catch {}
  };

  const saveNeuerArtikel = async () => {
    if (!neuerArtikelForm.name.trim() || !neuerArtikelForm.verkaufspreis_euro || !neuerArtikelForm.kategorie_id) {
      setModalError('Bitte Name, Verkaufspreis und Kategorie ausfüllen.');
      return;
    }
    setSavingModal(true);
    setModalError('');
    try {
      const payload = { ...neuerArtikelForm };
      if (!payload.lagerbestand) delete payload.lagerbestand;
      if (!payload.mindestbestand) delete payload.mindestbestand;
      if (!payload.einkaufspreis_euro) delete payload.einkaufspreis_euro;
      if (!payload.artikel_nummer) delete payload.artikel_nummer;
      const res = await axios.post(`/artikel`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadArtikel();
      const newId = res.data?.artikel_id;
      if (newId) handleArtikelChange(String(newId));
      setShowNeuerArtikelModal(false);
      setNeuerArtikelForm({ name: '', beschreibung: '', artikel_nummer: '', kategorie_id: '', verkaufspreis_euro: '', einkaufspreis_euro: '', mwst_prozent: 19, lagerbestand: '', mindestbestand: '', lager_tracking: false });
    } catch (err) {
      setModalError(err.response?.data?.detail ? JSON.stringify(err.response.data.detail) : (err.response?.data?.error || 'Fehler beim Speichern.'));
    }
    setSavingModal(false);
  };

  const saveNeuerKunde = async () => {
    const { ist_firma, firmenname, vorname, nachname, geburtsdatum } = neuerKundeForm;
    if (ist_firma) {
      if (!firmenname.trim()) { setModalError('Bitte Firmenname ausfüllen.'); return; }
    } else {
      if (!vorname.trim() || !nachname.trim()) { setModalError('Bitte Vorname und Nachname ausfüllen.'); return; }
      if (!geburtsdatum) { setModalError('Bitte Geburtsdatum ausfüllen.'); return; }
    }
    setSavingModal(true);
    setModalError('');
    try {
      const dojoId = activeDojo?.dojo_id || activeDojo?.id;
      const payload = { ...neuerKundeForm, dojo_id: dojoId, ist_firma: ist_firma ? 1 : 0 };
      // Für Firmen: nachname = firmenname als Fallback (Backend-Pflichtfeld)
      if (ist_firma && !payload.nachname) payload.nachname = firmenname;
      if (ist_firma && !payload.vorname) payload.vorname = firmenname;
      const res = await axios.post(`/mitglieder`, payload, { headers: { Authorization: `Bearer ${token}` } });
      await loadMitglieder();
      const newId = res.data?.mitglied_id;
      if (newId) handleMitgliedChange(String(newId));
      setShowNeuerKundeModal(false);
      setNeuerKundeForm({ ist_firma: false, firmenname: '', ust_id: '', ansprechpartner: '', vorname: '', nachname: '', geburtsdatum: '', strasse: '', hausnummer: '', plz: '', ort: '', email: '', telefon: '' });
    } catch (err) {
      setModalError(err.response?.data?.error || err.response?.data?.message || 'Fehler beim Speichern.');
    }
    setSavingModal(false);
  };

  const openPositionEdit = (index) => {
    if (index === null) {
      setNeuePosition({ artikel_id: '', bezeichnung: '', artikelnummer: '', menge: 1, einzelpreis: 0, ust_prozent: 19, ist_rabattfaehig: false, rabatt_prozent: 0, freitext: '', leistungsdatum: '' });
    } else {
      setNeuePosition({ ...positionen[index] });
    }
    setEditingPositionIndex(index);
    setShowPositionPopup(true);
  };

  const savePositionEdit = () => {
    if (!neuePosition.bezeichnung || Number(neuePosition.menge) <= 0) return;
    if (editingPositionIndex === null) {
      setPositionen([...positionen, { ...neuePosition, pos: positionen.length + 1, menge: Number(neuePosition.menge), einzelpreis: Number(neuePosition.einzelpreis), ust_prozent: Number(neuePosition.ust_prozent), ist_rabattfaehig: neuePosition.ist_rabattfaehig, rabatt_prozent: Number(neuePosition.rabatt_prozent) || 0 }]);
    } else {
      const updated = [...positionen];
      updated[editingPositionIndex] = { ...neuePosition, pos: editingPositionIndex + 1, menge: Number(neuePosition.menge), einzelpreis: Number(neuePosition.einzelpreis), ust_prozent: Number(neuePosition.ust_prozent), ist_rabattfaehig: neuePosition.ist_rabattfaehig, rabatt_prozent: Number(neuePosition.rabatt_prozent) || 0 };
      setPositionen(updated);
    }
    setShowPositionPopup(false);
    setEditingPositionIndex(null);
    setNeuePosition({ artikel_id: '', bezeichnung: '', artikelnummer: '', menge: 1, einzelpreis: 0, ust_prozent: 19, ist_rabattfaehig: false, rabatt_prozent: 0, freitext: '', leistungsdatum: '' });
  };

  const loadBankDaten = async () => {
    try {
      console.log('🔍 loadBankDaten aufgerufen, activeDojo:', activeDojo);
      
      if (!activeDojo?.dojo_id && !activeDojo?.id) {
        console.log('⚠️ Keine dojo_id gefunden');
        return;
      }
      
      const dojoId = activeDojo.dojo_id || activeDojo.id;
      console.log('🔍 Lade Bankdaten für Dojo:', dojoId);
      
      // Versuche zuerst die Standard-Bank aus dojo_banken zu holen
      const response = await axios.get(`/dojo-banken/${dojoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('🔍 Bankdaten-Response:', response.data);
      
      if (response.data && response.data.length > 0) {
        // Suche Standard-Bank oder erste aktive Bank
        const standardBank = response.data.find(b => b.ist_standard && b.ist_aktiv && b.bank_typ === 'bank') ||
                            response.data.find(b => b.ist_aktiv && b.bank_typ === 'bank');
        
        console.log('🔍 Gefundene Standard-Bank:', standardBank);
        
        if (standardBank && standardBank.iban && standardBank.bic && standardBank.kontoinhaber) {
          const bankDatenNeu = {
            bank_name: standardBank.bank_name || '',
            iban: standardBank.iban.replace(/\s/g, '').toUpperCase(),
            bic: standardBank.bic.toUpperCase(),
            kontoinhaber: standardBank.kontoinhaber
          };
          console.log('✅ Bankdaten gesetzt:', bankDatenNeu);
          setBankDaten(bankDatenNeu);
          return;
        }
      }
      
      // Fallback: Verwende Bankdaten aus Dojo-Objekt (verschiedene Feldnamen prüfen)
      console.log('🔍 Prüfe Dojo-Objekt für Bankdaten:', {
        dojo_id: dojoId,
        bank_iban: activeDojo.bank_iban,
        iban: activeDojo.iban,
        bank_bic: activeDojo.bank_bic,
        bic: activeDojo.bic,
        bank_inhaber: activeDojo.bank_inhaber,
        inhaber: activeDojo.inhaber,
        dojoname: activeDojo.dojoname,
        allKeys: Object.keys(activeDojo)
      });
      
      const dojoIban = activeDojo.bank_iban || activeDojo.iban;
      const dojoBic = activeDojo.bank_bic || activeDojo.bic;
      const dojoInhaber = activeDojo.bank_inhaber || activeDojo.inhaber || activeDojo.dojoname;
      const dojoBankName = activeDojo.bank_name || '';
      
      console.log('🔍 Extrahierte Werte:', { dojoIban, dojoBic, dojoInhaber, dojoBankName });
      
      if (dojoIban && dojoBic && dojoInhaber) {
        const bankDatenNeu = {
          bank_name: dojoBankName,
          iban: dojoIban.replace(/\s/g, '').toUpperCase(),
          bic: dojoBic.toUpperCase(),
          kontoinhaber: dojoInhaber
        };
        console.log('✅ Bankdaten aus Dojo-Objekt gesetzt:', bankDatenNeu);
        setBankDaten(bankDatenNeu);
      } else {
        console.warn('⚠️ Keine Bankdaten gefunden. Verfügbare Felder:', {
          bank_iban: activeDojo.bank_iban,
          iban: activeDojo.iban,
          bank_bic: activeDojo.bank_bic,
          bic: activeDojo.bic,
          bank_inhaber: activeDojo.bank_inhaber,
          inhaber: activeDojo.inhaber,
          dojoname: activeDojo.dojoname
        });
        
        // Versuche Migration durchzuführen
        console.log('🔄 Versuche automatische Migration der Bankdaten...');
        try {
          const migrateResponse = await axios.post(`/dojo-banken/migrate`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('✅ Migration-Ergebnis:', migrateResponse.data);
          
          // Nach Migration erneut versuchen, Bankdaten zu laden
          if (migrateResponse.data.success) {
            const retryResponse = await axios.get(`/dojo-banken/${dojoId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (retryResponse.data && retryResponse.data.length > 0) {
              const standardBank = retryResponse.data.find(b => b.ist_standard && b.ist_aktiv && b.bank_typ === 'bank') ||
                                  retryResponse.data.find(b => b.ist_aktiv && b.bank_typ === 'bank');
              
              if (standardBank && standardBank.iban && standardBank.bic && standardBank.kontoinhaber) {
                const bankDatenNeu = {
                  bank_name: standardBank.bank_name || '',
                  iban: standardBank.iban.replace(/\s/g, '').toUpperCase(),
                  bic: standardBank.bic.toUpperCase(),
                  kontoinhaber: standardBank.kontoinhaber
                };
                console.log('✅ Bankdaten nach Migration gesetzt:', bankDatenNeu);
                setBankDaten(bankDatenNeu);
                return;
              }
            }
          }
        } catch (migrateError) {
          console.error('❌ Fehler bei der Migration:', migrateError);
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Bankdaten:', error);
      // Fallback: Verwende Bankdaten aus Dojo-Objekt (verschiedene Feldnamen prüfen)
      const dojoIban = activeDojo?.bank_iban || activeDojo?.iban;
      const dojoBic = activeDojo?.bank_bic || activeDojo?.bic;
      const dojoInhaber = activeDojo?.bank_inhaber || activeDojo?.inhaber || activeDojo?.dojoname;
      const dojoBankName = activeDojo?.bank_name || '';
      
      if (dojoIban && dojoBic && dojoInhaber) {
        const bankDatenNeu = {
          bank_name: dojoBankName,
          iban: dojoIban.replace(/\s/g, '').toUpperCase(),
          bic: dojoBic.toUpperCase(),
          kontoinhaber: dojoInhaber
        };
        console.log('✅ Bankdaten aus Dojo-Objekt (Fallback) gesetzt:', bankDatenNeu);
        setBankDaten(bankDatenNeu);
      }
    }
  };

  const loadRechnungsnummer = async (datum) => {
    try {
      const response = await axios.get(`/rechnungen/naechste-nummer`, {
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
      // Prüfe ob Artikel Varianten hat
      const hatVarianten = art.hat_varianten && (
        (art.varianten_groessen && art.varianten_groessen.length > 0) ||
        (art.varianten_farben && art.varianten_farben.length > 0) ||
        (art.varianten_material && art.varianten_material.length > 0) ||
        art.hat_preiskategorien
      );

      if (hatVarianten) {
        setSelectedArtikelForVariant(art);
        setSelectedVariante({ groesse: '', farbe: '', material: '', preiskategorie: '' });
        setShowVariantenModal(true);
      } else {
        setNeuePosition({
          ...neuePosition,
          artikel_id: art.artikel_id,
          bezeichnung: art.name,
          artikelnummer: art.artikel_nummer || '',
          einzelpreis: Number(art.verkaufspreis_cent) / 100,
          ust_prozent: Number(art.mwst_prozent) || 19
        });
      }
    }
  };

  // Variante auswählen und Position setzen
  const selectVariantAndSetPosition = () => {
    if (!selectedArtikelForVariant) return;

    const art = selectedArtikelForVariant;

    // Bestimme den Preis basierend auf Preiskategorie
    let preisCent = art.verkaufspreis_cent;
    if (art.hat_preiskategorien && selectedVariante.preiskategorie) {
      if (selectedVariante.preiskategorie === 'kids' && art.preis_kids_cent) {
        preisCent = art.preis_kids_cent;
      } else if (selectedVariante.preiskategorie === 'erwachsene' && art.preis_erwachsene_cent) {
        preisCent = art.preis_erwachsene_cent;
      }
    }

    // Erstelle Varianten-String für Bezeichnung
    const variantenText = [
      selectedVariante.groesse && `Gr. ${selectedVariante.groesse}`,
      selectedVariante.farbe,
      selectedVariante.material,
      selectedVariante.preiskategorie && (selectedVariante.preiskategorie === 'kids' ? 'Kids' : 'Erwachsene')
    ].filter(Boolean).join(', ');

    const bezeichnung = variantenText ? `${art.name} (${variantenText})` : art.name;

    // Erstelle eindeutige Varianten-ID
    const variantenKey = [
      selectedVariante.groesse,
      selectedVariante.farbe,
      selectedVariante.material,
      selectedVariante.preiskategorie
    ].filter(Boolean).join('-');
    const uniqueVariantId = `${art.artikel_id}-${variantenKey || 'default'}`;

    setNeuePosition({
      ...neuePosition,
      artikel_id: art.artikel_id,
      unique_variant_id: uniqueVariantId,
      bezeichnung: bezeichnung,
      artikelnummer: art.artikel_nummer || '',
      einzelpreis: Number(preisCent) / 100,
      ust_prozent: Number(art.mwst_prozent) || 19,
      variante: { ...selectedVariante }
    });

    setShowVariantenModal(false);
    setSelectedArtikelForVariant(null);
  };

  const addPosition = () => {
    if (!neuePosition.bezeichnung || neuePosition.menge <= 0) return;

    // Prüfe, ob der Artikel bereits in der Liste ist
    const existingIndex = positionen.findIndex(pos => {
      // Wenn unique_variant_id vorhanden ist, vergleiche danach (für Artikel mit Varianten)
      if (neuePosition.unique_variant_id && pos.unique_variant_id) {
        return pos.unique_variant_id === neuePosition.unique_variant_id;
      }
      // Wenn artikel_id vorhanden aber keine Varianten-ID, vergleiche nach ID + Bezeichnung + Preis
      if (neuePosition.artikel_id && pos.artikel_id) {
        return pos.artikel_id === neuePosition.artikel_id &&
               pos.bezeichnung === neuePosition.bezeichnung &&
               Number(pos.einzelpreis) === Number(neuePosition.einzelpreis);
      }
      // Fallback: vergleiche nach Bezeichnung und Einzelpreis
      return pos.bezeichnung === neuePosition.bezeichnung &&
             Number(pos.einzelpreis) === Number(neuePosition.einzelpreis);
    });

    if (existingIndex !== -1) {
      // Artikel existiert bereits - erhöhe nur die Menge
      const updatedPositionen = [...positionen];
      updatedPositionen[existingIndex] = {
        ...updatedPositionen[existingIndex],
        menge: Number(updatedPositionen[existingIndex].menge) + Number(neuePosition.menge)
      };
      setPositionen(updatedPositionen);
    } else {
      // Neuer Artikel - füge hinzu
      setPositionen([...positionen, {
        ...neuePosition,
        pos: positionen.length + 1,
        menge: Number(neuePosition.menge),
        einzelpreis: Number(neuePosition.einzelpreis),
        ust_prozent: Number(neuePosition.ust_prozent),
        ist_rabattfaehig: neuePosition.ist_rabattfaehig,
        rabatt_prozent: Number(neuePosition.rabatt_prozent) || 0,
        freitext: neuePosition.freitext || '',
        leistungsdatum: neuePosition.leistungsdatum || ''
      }]);
    }

    // Formular zurücksetzen
    setNeuePosition({
      artikel_id: '',
      bezeichnung: '',
      artikelnummer: '',
      menge: 1,
      einzelpreis: 0,
      ust_prozent: 19,
      ist_rabattfaehig: false,
      rabatt_prozent: 0,
      freitext: '',
      leistungsdatum: ''
    });
  };

  const removePosition = (index) => {
    const newPositionen = positionen.filter((_, i) => i !== index);
    setPositionen(newPositionen.map((pos, i) => ({ ...pos, pos: i + 1 })));
  };

  // Berechnungen
  const calculateZwischensumme = () => {
    return positionen.reduce((sum, pos) => {
      const bruttoPreis = Number(pos.einzelpreis) * Number(pos.menge);
      const rabattBetrag = pos.ist_rabattfaehig ? (bruttoPreis * Number(pos.rabatt_prozent) / 100) : 0;
      const nettoPreis = bruttoPreis - rabattBetrag;
      return sum + nettoPreis;
    }, 0);
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

  const calculateSkonto = () => {
    const summe = calculateSumme();
    if (rechnungsDaten.skonto_prozent > 0 && rechnungsDaten.skonto_tage > 0) {
      return (summe * rechnungsDaten.skonto_prozent) / 100;
    }
    return 0;
  };

  const calculateUSt = () => {
    const summe = calculateSumme(); // Nur Rabatt berücksichtigen, NICHT Skonto
    // Vereinfacht: nehmen wir an alle Positionen haben 19% USt
    return (summe * 19) / 100;
  };

  const calculateEndbetrag = () => {
    return calculateSumme() + calculateUSt(); // Nur Rabatt berücksichtigen, NICHT Skonto
  };

  // Formatiere Datum im Format dd.mm.yyyy
  const formatDateDDMMYYYY = (dateString, addDays = 0) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (addDays > 0) {
      date.setDate(date.getDate() + addDays);
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Generiere EPC QR-Code-String (SEPA Credit Transfer)
  const generateEPCQRCode = (betrag, mitSkonto = false) => {
    console.log('🔍 generateEPCQRCode aufgerufen:', { betrag, mitSkonto, bankDaten });
    
    const hasIban = bankDaten.iban && bankDaten.iban.trim() !== '';
    const hasBic = bankDaten.bic && bankDaten.bic.trim() !== '';
    const hasKontoinhaber = bankDaten.kontoinhaber && bankDaten.kontoinhaber.trim() !== '';
    
    if (!hasIban || !hasBic || !hasKontoinhaber) {
      console.warn('⚠️ Bankdaten unvollständig:', {
        iban: bankDaten.iban,
        bic: bankDaten.bic,
        kontoinhaber: bankDaten.kontoinhaber,
        hasIban,
        hasBic,
        hasKontoinhaber
      });
      return '';
    }

    if (!betrag || isNaN(betrag) || betrag <= 0) {
      console.warn('⚠️ Ungültiger Betrag:', betrag);
      return '';
    }

    // Verwende den übergebenen Betrag
    const verwendungszweck = `Rechnung ${rechnungsDaten.rechnungsnummer || ''}`.substring(0, 140);
    const referenz = rechnungsDaten.rechnungsnummer || '';
    
    // EPC QR-Code Format nach SEPA-Standard
    const epcString = [
      'BCD',                    // Service Tag
      '002',                    // Version
      '1',                      // Character Set (1 = UTF-8)
      'SCT',                    // Identification (SEPA Credit Transfer)
      bankDaten.bic.trim(),           // BIC (max 11 Zeichen)
      bankDaten.kontoinhaber.trim().substring(0, 70), // Name (max 70 Zeichen)
      bankDaten.iban.trim(),           // IBAN (max 34 Zeichen)
      `EUR${Number(betrag).toFixed(2)}`, // Betrag (EUR + Betrag)
      '',                       // Purpose (optional)
      verwendungszweck,         // Verwendungszweck (max 140 Zeichen)
      referenz.substring(0, 35), // Reference (max 35 Zeichen)
      '',                       // Text (optional)
      ''                        // End of data
    ].join('\n');

    console.log('✅ EPC QR-Code generiert (Länge:', epcString.length, '):', epcString.substring(0, 150) + '...');
    return epcString;
  };

  // Funktion: Extrahiere CSS für PDF-Generierung
  const getInvoiceCSS = (mitArtikelNummer = true) => {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }

      body {
        font-family: Arial, sans-serif;
        font-size: 10pt;
        line-height: 1.4;
        color: #000;
        background: white;
      }

      .invoice-page {
        background: white;
        max-width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 20mm;
        padding-bottom: 50mm;
        position: relative;
        font-family: Arial, sans-serif;
        font-size: 10pt;
        line-height: 1.4;
        color: #000000;
      }

      .invoice-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 3rem;
      }

      .company-info {
        flex: 1;
      }

      .company-small {
        font-size: 8pt;
        color: #666;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #000;
      }

      .recipient-address {
        margin-top: 1rem;
        line-height: 1.6;
      }

      .invoice-meta {
        text-align: right;
        min-width: 250px;
      }

      .logo-placeholder {
        width: 120px;
        height: 120px;
        border: 2px solid #000;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: auto;
        margin-bottom: 1rem;
        font-weight: bold;
        color: #666;
      }

      .invoice-logo {
        display: block;
        width: 90px;
        height: 90px;
        object-fit: cover;
        border-radius: 50%;
        margin-left: auto;
        margin-bottom: 1rem;
      }

      .invoice-numbers {
        font-size: 9pt;
        line-height: 1.8;
      }

      .invoice-title {
        margin-bottom: 2rem;
      }

      .invoice-title h1 {
        font-size: 18pt;
        font-weight: bold;
        margin: 0 0 0.5rem 0;
        color: #000000;
      }

      .page-number {
        text-align: right;
        font-size: 9pt;
        color: #666;
      }

      .invoice-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 2rem;
        font-size: 9pt;
      }

      .invoice-table thead {
        background: #f3f4f6;
        border-top: 1px solid #000;
        border-bottom: 1px solid #000;
      }

      .invoice-table th {
        padding: 0.5rem 0.25rem;
        text-align: left;
        font-weight: bold;
        font-size: 8pt;
      }

      .invoice-table th:nth-child(${mitArtikelNummer ? 3 : 2}),
      .invoice-table th:nth-child(${mitArtikelNummer ? 4 : 3}),
      .invoice-table th:nth-child(${mitArtikelNummer ? 6 : 5}),
      .invoice-table th:nth-child(${mitArtikelNummer ? 7 : 6}),
      .invoice-table th:nth-child(${mitArtikelNummer ? 8 : 7}) {
        text-align: right;
      }

      .invoice-table td {
        padding: 0.5rem 0.25rem;
        border-bottom: 1px solid #e5e7eb;
      }

      .invoice-table td:nth-child(${mitArtikelNummer ? 3 : 2}),
      .invoice-table td:nth-child(${mitArtikelNummer ? 4 : 3}),
      .invoice-table td:nth-child(${mitArtikelNummer ? 6 : 5}),
      .invoice-table td:nth-child(${mitArtikelNummer ? 7 : 6}),
      .invoice-table td:nth-child(${mitArtikelNummer ? 8 : 7}) {
        text-align: right;
      }

      .invoice-totals {
        margin-left: auto;
        width: 50%;
        font-size: 10pt;
      }

      .totals-row {
        display: flex;
        justify-content: space-between;
        padding: 0.4rem 0;
        border-bottom: 1px solid #e5e7eb;
      }

      .totals-row.total-final {
        font-weight: bold;
        font-size: 11pt;
        border-top: 2px solid #000;
        border-bottom: 2px solid #000;
        margin-top: 0.5rem;
        padding-top: 0.5rem;
      }

      .payment-terms {
        margin-top: 2rem;
        font-size: 9pt;
      }

      .payment-terms p {
        margin: 0.25rem 0;
      }

      .qr-code-title {
        color: #000000;
        font-size: 0.85rem;
        font-weight: bold;
        text-transform: uppercase;
        margin-bottom: 0.5rem;
      }

      .qr-codes-section {
        display: flex;
        gap: 2rem;
        justify-content: center;
        flex-wrap: nowrap;
        align-items: flex-start;
      }

      .qr-codes-section > div {
        flex: 1;
        min-width: 200px;
        text-align: center;
      }

      .rechnung-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 0.75rem 20mm 0.5rem 20mm;
        border-top: 1px solid rgba(0, 0, 0, 0.2);
        font-size: 7pt;
        color: #000000;
        line-height: 1.6;
        text-align: center;
        background: white;
      }

      .re-pdf-freitext {
        font-size: 8pt;
        color: #444;
        margin-top: 2px;
        white-space: pre-wrap;
        line-height: 1.35;
      }

      .re-pdf-leistungsdatum {
        font-size: 7.5pt;
        color: #666;
        margin-top: 1px;
        font-style: italic;
      }

      @page {
        margin: 0;
        size: A4 portrait;
      }

      @media print {
        body {
          margin: 0;
          padding: 0;
        }
      }
    `;
  };

  // Funktion: Serialisiere Vorschau zu HTML für PDF-Generierung
  const serializePreviewToHTML = () => {
    // Hole das DOM-Element der Vorschau
    const previewElement = document.querySelector('.invoice-page');
    if (!previewElement) {
      console.error('Vorschau-Element nicht gefunden');
      return null;
    }

    // Clone das Element
    const clone = previewElement.cloneNode(true);

    // Konvertiere alle QRCodeSVG zu Base64 Data URIs
    const qrCodeSvgs = clone.querySelectorAll('svg');
    qrCodeSvgs.forEach(svg => {
      try {
        // Serialisiere SVG zu String
        const svgData = new XMLSerializer().serializeToString(svg);

        // Konvertiere zu Base64
        const svgBase64 = btoa(unescape(encodeURIComponent(svgData)));
        const dataUri = `data:image/svg+xml;base64,${svgBase64}`;

        // Ersetze SVG durch IMG mit Data URI
        const img = document.createElement('img');
        img.src = dataUri;
        img.style.width = '150px';
        img.style.height = '150px';
        img.style.display = 'block';
        img.style.margin = '0 auto';

        // Ersetze im DOM
        svg.parentNode.replaceChild(img, svg);
      } catch (error) {
        console.error('Fehler bei QR-Code Konvertierung:', error);
      }
    });

    // Hole CSS und erstelle vollständiges HTML-Dokument
    const cssContent = getInvoiceCSS(zeigArtikelNummer);
    const fullHTML = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Rechnung ${rechnungsDaten.rechnungsnummer}</title>
  <style>${cssContent}</style>
</head>
<body>${clone.outerHTML}</body>
</html>`;

    return fullHTML;
  };

  const handleSpeichern = async () => {
    if (!selectedMitglied || positionen.length === 0) {
      alert('Bitte wählen Sie ein Mitglied und fügen Sie mindestens eine Position hinzu.');
      return;
    }

    const serializedHTML = serializePreviewToHTML();
    if (!serializedHTML) {
      alert('Fehler beim Erstellen der PDF-Vorschau');
      return;
    }

    const mappedPositionen = positionen.map(pos => {
      const bruttoPreis = Number(pos.einzelpreis) * Number(pos.menge);
      const rabattBetrag = pos.ist_rabattfaehig ? (bruttoPreis * Number(pos.rabatt_prozent) / 100) : 0;
      const nettoPreis = bruttoPreis - rabattBetrag;
      // Beschreibung/Leistungsdatum (Freitext) mitspeichern – z. B. der Leistungszeitraum/Monat
      const beschrTeile = [];
      if (pos.leistungsdatum) beschrTeile.push(`Leistungsdatum: ${pos.leistungsdatum}`);
      if (pos.freitext && pos.freitext.trim()) beschrTeile.push(pos.freitext.trim());
      return {
        bezeichnung: pos.bezeichnung,
        artikelnummer: pos.artikelnummer || null,
        menge: pos.menge,
        einzelpreis: pos.einzelpreis,
        gesamtpreis: nettoPreis,
        mwst_satz: pos.ust_prozent,
        beschreibung: beschrTeile.join(' · ') || null,
        ist_rabattfaehig: pos.ist_rabattfaehig || false,
        rabatt_prozent: pos.rabatt_prozent || 0
      };
    });

    try {
      if (editMode && editRechnungData) {
        // Bearbeiten: PUT
        const response = await axios.put(`/rechnungen/${editRechnungData.rechnung_id}`, {
          mitglied_id: selectedMitglied.mitglied_id,
          datum: rechnungsDaten.belegdatum,
          faelligkeitsdatum: rechnungsDaten.zahlungsfrist,
          beschreibung: 'Rechnung',
          notizen: '',
          positionen: mappedPositionen,
          mwst_satz: 19,
          pdfHtml: serializedHTML
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          alert(`Rechnung ${editRechnungData.rechnungsnummer} erfolgreich aktualisiert!`);
          navigate('/dashboard/rechnungen');
        }
      } else {
        // Neu erstellen: POST
        const rechnungData = {
          mitglied_id: selectedMitglied.mitglied_id,
          datum: rechnungsDaten.belegdatum,
          faelligkeitsdatum: rechnungsDaten.zahlungsfrist,
          art: 'sonstiges',
          beschreibung: 'Rechnung',
          notizen: '',
          positionen: mappedPositionen,
          mwst_satz: 19,
          pdfHtml: serializedHTML
        };

        const response = await axios.post(`/rechnungen`, rechnungData, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          alert(`Rechnung erfolgreich erstellt!\nRechnungsnummer: ${response.data.rechnungsnummer}`);
          setSelectedMitglied(null);
          setPositionen([]);
          const neueDatum = new Date().toISOString().split('T')[0];
          setRechnungsDaten({
            rechnungsnummer: 'Wird geladen...',
            kundennummer: '',
            belegdatum: neueDatum,
            leistungsdatum: neueDatum,
            zahlungsfrist: calculateZahlungsfrist(neueDatum),
            rabatt_prozent: 0,
            rabatt_auf_betrag: 0
          });
          loadRechnungsnummer(neueDatum);
        }
      }
    } catch (error) {
      const serverMsg = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Unbekannter Fehler';
      const status = error?.response?.status;
      console.error('Fehler beim Speichern:', error?.response?.data || error);
      alert(`Fehler beim ${editMode ? 'Aktualisieren' : 'Erstellen'} der Rechnung (${status}): ${serverMsg}`);
    }
  };

  if (loading) {
    return (
      <div className="rechnung-erstellen-container">
        <div className="re-state-center re-state-center--loading">
          Lade Daten...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rechnung-erstellen-container">
        <div className="re-state-center re-state-center--error">
          <h2>Fehler</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="re-btn-reload">
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }

  // Varianten-Modal Render Funktion
  const renderVariantenModal = () => {
    if (!showVariantenModal || !selectedArtikelForVariant) return null;

    const art = selectedArtikelForVariant;
    const hasGroessen = art.varianten_groessen && art.varianten_groessen.length > 0;
    const hasFarben = art.varianten_farben && art.varianten_farben.length > 0;
    const hasMaterial = art.varianten_material && art.varianten_material.length > 0;
    const hasPreiskategorien = art.hat_preiskategorien;

    // Bestimme verfügbare Größen basierend auf Preiskategorie
    let verfuegbareGroessen = art.varianten_groessen || [];
    if (hasPreiskategorien && selectedVariante.preiskategorie) {
      if (selectedVariante.preiskategorie === 'kids' && art.groessen_kids?.length > 0) {
        verfuegbareGroessen = art.groessen_kids;
      } else if (selectedVariante.preiskategorie === 'erwachsene' && art.groessen_erwachsene?.length > 0) {
        verfuegbareGroessen = art.groessen_erwachsene;
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
    let aktuellerPreis = art.verkaufspreis_cent / 100;
    if (hasPreiskategorien && selectedVariante.preiskategorie === 'kids' && art.preis_kids_cent) {
      aktuellerPreis = art.preis_kids_cent / 100;
    } else if (hasPreiskategorien && selectedVariante.preiskategorie === 'erwachsene' && art.preis_erwachsene_cent) {
      aktuellerPreis = art.preis_erwachsene_cent / 100;
    }

    return (
      <div className="varianten-modal-overlay" onClick={() => setShowVariantenModal(false)}>
        <div className="varianten-modal" onClick={(e) => e.stopPropagation()}>
          <div className="varianten-modal-header">
            <h3>{art.name}</h3>
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
                  {art.preis_kids_cent && (
                    <button
                      type="button"
                      className={`variante-btn ${selectedVariante.preiskategorie === 'kids' ? 'selected' : ''}`}
                      onClick={() => setSelectedVariante(prev => ({ ...prev, preiskategorie: 'kids', groesse: '' }))}
                    >
                      Kids - {(art.preis_kids_cent / 100).toFixed(2)}€
                    </button>
                  )}
                  {art.preis_erwachsene_cent && (
                    <button
                      type="button"
                      className={`variante-btn ${selectedVariante.preiskategorie === 'erwachsene' ? 'selected' : ''}`}
                      onClick={() => setSelectedVariante(prev => ({ ...prev, preiskategorie: 'erwachsene', groesse: '' }))}
                    >
                      Erwachsene - {(art.preis_erwachsene_cent / 100).toFixed(2)}€
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

            {/* Farben */}
            {hasFarben && (
              <div className="varianten-section">
                <label>Farbe:</label>
                <div className="varianten-options">
                  {art.varianten_farben.map((farbe, idx) => {
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

            {/* Material */}
            {hasMaterial && (
              <div className="varianten-section">
                <label>Material:</label>
                <div className="varianten-options">
                  {art.varianten_material.map((material, idx) => {
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

            <div className="varianten-preis">
              <span>Preis:</span>
              <span className="preis-wert">{aktuellerPreis.toFixed(2)}€</span>
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
              onClick={selectVariantAndSetPosition}
              disabled={!isComplete}
            >
              Auswählen
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rechnung-erstellen-container">
      {/* Action bar */}
      <div className="re-action-bar">
        <span className="re-action-title">
          {editMode ? `Rechnung bearbeiten — ${editRechnungData?.rechnungsnummer || ''}` : 'Rechnung erstellen'}
        </span>
        <div className="re-action-right">
          <label className="re-toggle-label">
            <input type="checkbox" checked={zeigArtikelNummer} onChange={e => setZeigArtikelNummer(e.target.checked)} className="re-pos-checkbox" />
            Artikelnummer
          </label>
          <button onClick={handleSpeichern} className="btn-save">
            {editMode ? 'Änderungen speichern' : 'Rechnung speichern'}
          </button>
        </div>
      </div>

        {/* Rechnungsvorschau — full width, click-to-edit */}
        <div className="rechnung-preview rechnung-preview--fullwidth">
          <div className="invoice-page">
            {/* Header */}
            <div className="invoice-header">
              <div className="company-info">
                <div className="company-small">
                  {activeDojo?.dojoname} | {activeDojo?.strasse} {activeDojo?.hausnummer} | {activeDojo?.plz} {activeDojo?.ort}
                </div>
                <div className="recipient-address re-editable" title="Empfänger wählen" onClick={() => { setCustomerSearch(''); setShowCustomerPopup(true); }}>
                  {selectedMitglied ? (
                    <>
                      {selectedMitglied.ist_firma ? (
                        <>
                          <div>{selectedMitglied.firmenname || `${selectedMitglied.vorname} ${selectedMitglied.nachname}`}</div>
                          {selectedMitglied.ansprechpartner && <div>z.Hd. {selectedMitglied.ansprechpartner}</div>}
                        </>
                      ) : (
                        <>
                          <div>Herrn/Frau</div>
                          <div>{selectedMitglied.vorname} {selectedMitglied.nachname}</div>
                        </>
                      )}
                      <div>{selectedMitglied.adresse || selectedMitglied.strasse} {selectedMitglied.hausnummer}</div>
                      <div>{selectedMitglied.plz} {selectedMitglied.ort}</div>
                    </>
                  ) : (
                    <div className="re-edit-hint">▸ Empfänger wählen</div>
                  )}
                </div>
              </div>
              <div className="invoice-meta re-editable" title="Datumsangaben bearbeiten" onClick={() => setShowMetaPopup(true)}>
                {dojoLogo ? (
                  <img
                    src={dojoLogo}
                    alt={activeDojo?.dojoname || 'Dojo Logo'}
                    className="invoice-logo re-invoice-logo"
                  />
                ) : (
                  <div className="logo-placeholder">{activeDojo?.dojoname?.substring(0, 3)?.toUpperCase() || 'LOGO'}</div>
                )}
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
              <h1 className="re-invoice-h1">Rechnung</h1>
              <div className="page-number">Seite 1 von 1</div>
            </div>

            {/* Positions Table */}
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Bezeichnung</th>
                  {zeigArtikelNummer && <th>Artikelnummer</th>}
                  <th>Menge</th>
                  <th>Einheit</th>
                  <th>Preis</th>
                  <th>Rabatt %</th>
                  <th>USt %</th>
                  <th>Betrag EUR</th>
                </tr>
              </thead>
              <tbody>
                {positionen.map((pos, index) => {
                  const bruttoPreis = Number(pos.einzelpreis) * Number(pos.menge);
                  const rabattBetrag = pos.ist_rabattfaehig ? (bruttoPreis * Number(pos.rabatt_prozent) / 100) : 0;
                  const nettoPreis = bruttoPreis - rabattBetrag;

                  return (
                    <tr key={index} className="re-pos-row re-editable" title="Position bearbeiten" onClick={() => openPositionEdit(index)}>
                      <td>{pos.pos}</td>
                      <td>
                        <div>{pos.bezeichnung}</div>
                        {pos.freitext && (
                          <div className="re-pdf-freitext">{pos.freitext}</div>
                        )}
                        {pos.leistungsdatum && (
                          <div className="re-pdf-leistungsdatum">Leistungsdatum: {formatDateDDMMYYYY(pos.leistungsdatum)}</div>
                        )}
                      </td>
                      {zeigArtikelNummer && <td>{pos.artikelnummer}</td>}
                      <td>{pos.menge}</td>
                      <td>Stk.</td>
                      <td>{Number(pos.einzelpreis).toFixed(2)}</td>
                      <td>{pos.ist_rabattfaehig ? `${Number(pos.rabatt_prozent).toFixed(2)} %` : '-'}</td>
                      <td>{Number(pos.ust_prozent).toFixed(2)} %</td>
                      <td>{nettoPreis.toFixed(2)}</td>
                    </tr>
                  );
                })}
                <tr className="re-add-position-row re-editable" onClick={() => openPositionEdit(null)}>
                  <td colSpan={zeigArtikelNummer ? 9 : 8} className="re-add-position-cell">+ Position hinzufügen</td>
                </tr>
              </tbody>
            </table>

            {/* Totals */}
            <div className="invoice-totals">
              <div className="totals-row">
                <span>Zwischensumme:</span>
                <span>{calculateZwischensumme().toFixed(2)}</span>
              </div>
              {rechnungsDaten.rabatt_prozent > 0 && (
                <div className="totals-row re-editable" title="Rabatt bearbeiten" onClick={() => setShowRabattSkontoPopup(true)}>
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
              {Number(rechnungsDaten.skonto_prozent) > 0 && Number(rechnungsDaten.skonto_tage) > 0 && (
                <div className="totals-row re-editable" title="Skonto bearbeiten" onClick={() => setShowRabattSkontoPopup(true)}>
                  <span>{Number(rechnungsDaten.skonto_prozent).toFixed(2)} % Skonto ({rechnungsDaten.skonto_tage} Tage):</span>
                  <span>-{calculateSkonto().toFixed(2)}</span>
                </div>
              )}
              <div className="re-rabatt-add-hint re-editable" title="Rabatt / Skonto bearbeiten" onClick={() => setShowRabattSkontoPopup(true)}>
                {rechnungsDaten.rabatt_prozent > 0 || rechnungsDaten.skonto_prozent > 0 ? '✎ Rabatt / Skonto' : '+ Rabatt / Skonto'}
              </div>
            </div>

            {/* Payment Terms und QR Codes nebeneinander */}
            <div className="re-payment-qr-row">
              {/* Payment Terms - Links */}
              <div className="payment-terms re-payment-terms">
                <p>Bitte beachten Sie unsere Zahlungsbedingung:</p>
                {rechnungsDaten.zahlungsfrist ? (
                  <>
                    {Number(rechnungsDaten.skonto_prozent) > 0 && Number(rechnungsDaten.skonto_tage) > 0 ? (
                      <p>
                        {Number(rechnungsDaten.skonto_prozent).toFixed(2)} % Skonto bei Zahlung innerhalb von {rechnungsDaten.skonto_tage} Tagen (bis zum {formatDateDDMMYYYY(rechnungsDaten.belegdatum, rechnungsDaten.skonto_tage)}). 
                        <br />
                        Ohne Abzug bis zum {formatDateDDMMYYYY(rechnungsDaten.zahlungsfrist)}. 
                        <br />
                        Skonto-Betrag: {calculateSkonto().toFixed(2)} €
                        <br />
                        Zu überweisender Betrag: {(calculateEndbetrag() - calculateSkonto()).toFixed(2)} €
                      </p>
                    ) : (
                      <p>Ohne Abzug bis zum {formatDateDDMMYYYY(rechnungsDaten.zahlungsfrist)}.</p>
                    )}
                  </>
                ) : (
                  <p>Ohne Abzug bis zum ___________.</p>
                )}
              </div>

              {/* QR Codes für Überweisung - Rechts */}
            {(() => {
              const hasIban = bankDaten.iban && bankDaten.iban.trim() !== '';
              const hasBic = bankDaten.bic && bankDaten.bic.trim() !== '';
              const hasKontoinhaber = bankDaten.kontoinhaber && bankDaten.kontoinhaber.trim() !== '';
              const hasBankData = hasIban && hasBic && hasKontoinhaber;
              
              console.log('🔍 QR-Code Anzeige-Check:', { 
                hasBankData, 
                hasIban, 
                hasBic, 
                hasKontoinhaber,
                iban: bankDaten.iban,
                bic: bankDaten.bic,
                kontoinhaber: bankDaten.kontoinhaber,
                bankDaten 
              });
              
              if (!hasBankData) {
                console.warn('⚠️ QR-Codes können nicht angezeigt werden - Bankdaten fehlen:', {
                  iban: bankDaten.iban,
                  bic: bankDaten.bic,
                  kontoinhaber: bankDaten.kontoinhaber,
                  ibanEmpty: !hasIban,
                  bicEmpty: !hasBic,
                  kontoinhaberEmpty: !hasKontoinhaber
                });
              }
              return hasBankData;
            })() ? (
              <div className="qr-codes-section re-qr-codes-section">
                {Number(rechnungsDaten.skonto_prozent) > 0 && Number(rechnungsDaten.skonto_tage) > 0 ? (
                  <>
                    {/* QR-Code mit Skonto */}
                    {(() => {
                      const betragMitSkonto = calculateEndbetrag() - calculateSkonto();
                      const qrCodeMitSkonto = generateEPCQRCode(betragMitSkonto, true);
                      if (!qrCodeMitSkonto || qrCodeMitSkonto.trim() === '') {
                        console.warn('⚠️ QR-Code mit Skonto konnte nicht generiert werden');
                        return null;
                      }
                      const skontoDatum = formatDateDDMMYYYY(rechnungsDaten.belegdatum, Number(rechnungsDaten.skonto_tage));
                      return (
                        <div className="re-qr-block">
                          <h4 className="qr-code-title re-qr-title">Zahlung mit Skonto</h4>
                          <div className="re-qr-wrap">
                            <QRCodeSVG 
                              value={qrCodeMitSkonto} 
                              size={70}
                              level="M"
                            />
                          </div>
                          <p className="re-qr-label--md">
                            Betrag: {betragMitSkonto.toFixed(2)} €
                          </p>
                          <p className="re-qr-label--sm">
                            bis zum {skontoDatum} zu zahlen
                          </p>
                        </div>
                      );
                    })()}
                    {/* QR-Code ohne Skonto */}
                    {(() => {
                      const betragOhneSkonto = calculateEndbetrag();
                      const qrCodeOhneSkonto = generateEPCQRCode(betragOhneSkonto, false);
                      if (!qrCodeOhneSkonto || qrCodeOhneSkonto.trim() === '') {
                        console.warn('⚠️ QR-Code ohne Skonto konnte nicht generiert werden');
                        return null;
                      }
                      const zahlungsfristDatum = formatDateDDMMYYYY(rechnungsDaten.zahlungsfrist);
                      return (
                        <div className="re-qr-block">
                          <h4 className="qr-code-title re-qr-title">Zahlung ohne Skonto</h4>
                          <div className="re-qr-wrap">
                            <QRCodeSVG 
                              value={qrCodeOhneSkonto} 
                              size={70}
                              level="M"
                            />
                          </div>
                          <p className="re-qr-label--md">
                            Betrag: {betragOhneSkonto.toFixed(2)} €
                          </p>
                          <p className="re-qr-label--sm">
                            ab {zahlungsfristDatum} zu zahlen
                          </p>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  /* QR-Code ohne Skonto (wenn kein Skonto definiert) */
                  (() => {
                    const betrag = calculateEndbetrag();
                    const qrCode = generateEPCQRCode(betrag, false);
                    if (!qrCode || qrCode.trim() === '') {
                      console.warn('⚠️ QR-Code konnte nicht generiert werden');
                      return null;
                    }
                    const zahlungsfristDatum = formatDateDDMMYYYY(rechnungsDaten.zahlungsfrist);
                    return (
                      <div className="re-qr-block">
                        <h4 className="qr-code-title re-qr-title">QR-Code für Überweisung</h4>
                        <div className="re-qr-wrap">
                          <QRCodeSVG 
                            value={qrCode} 
                            size={70}
                            level="M"
                          />
                        </div>
                        <p className="re-qr-label--md">
                          Betrag: {betrag.toFixed(2)} €
                        </p>
                        {zahlungsfristDatum && (
                          <p className="re-qr-label--sm">
                            bis zum {zahlungsfristDatum} zu zahlen
                          </p>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            ) : (
              <div className="re-no-bankdata">
                <p className="re-no-bankdata-text">
                  ⚠️ QR-Codes können nicht angezeigt werden. Bitte stellen Sie sicher, dass Bankdaten (IBAN, BIC, Kontoinhaber) in den Dojo-Einstellungen hinterlegt sind.
                </p>
              </div>
            )}
            </div>

            {/* Fußzeile mit Dojo-Daten und Bankdaten */}
            <div className="rechnung-footer re-footer">
              {/* Zeile 1: Dojo-Informationen */}
              <div className="re-footer-row">
                {[
                  activeDojo?.dojoname,
                  activeDojo?.strasse && activeDojo?.hausnummer ? `${activeDojo.strasse} ${activeDojo.hausnummer}` : null,
                  activeDojo?.plz && activeDojo?.ort ? `${activeDojo.plz} ${activeDojo.ort}` : null,
                  activeDojo?.email,
                  activeDojo?.homepage,
                  activeDojo?.telefon
                ].filter(Boolean).join(' | ')}
              </div>
              {/* Zeile 2: Bankdaten */}
              {bankDaten.iban && bankDaten.bic && bankDaten.kontoinhaber && (
                <div>
                  {[
                    bankDaten.bank_name,
                    bankDaten.kontoinhaber,
                    bankDaten.iban,
                    bankDaten.bic
                  ].filter(Boolean).join(' | ')}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* ── Customer selection popup ── */}
      {showCustomerPopup && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCustomerPopup(false); }}>
          <div className="re-inline-modal re-customer-popup">
            <h3>Empfänger wählen</h3>
            <div className="re-inline-create-row">
              <input autoFocus className="re-input-sm" style={{flex:1}} placeholder="Name suchen…"
                value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
              <button className="btn-inline-create" onClick={() => { setShowCustomerPopup(false); setModalError(''); setShowNeuerKundeModal(true); }}>+ Neu</button>
            </div>
            <div className="re-customer-list">
              {mitglieder.filter(m => {
                const q = customerSearch.toLowerCase();
                return !q || `${m.vorname} ${m.nachname}`.toLowerCase().includes(q) || (m.firmenname && m.firmenname.toLowerCase().includes(q));
              }).map(m => (
                <div key={m.mitglied_id}
                  className={`re-customer-item${selectedMitglied?.mitglied_id === m.mitglied_id ? ' selected' : ''}`}
                  onClick={() => { handleMitgliedChange(m.mitglied_id); setShowCustomerPopup(false); }}
                >
                  <div className="re-customer-name">{m.ist_firma ? (m.firmenname || `${m.vorname} ${m.nachname}`) : `${m.vorname} ${m.nachname}`}</div>
                  {(m.plz || m.ort) && <div className="re-customer-addr">{m.plz} {m.ort}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Position edit popup ── */}
      {showPositionPopup && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowPositionPopup(false); setEditingPositionIndex(null); } }}>
          <div className="re-inline-modal re-inline-modal--wide re-position-popup">
            <h3>{editingPositionIndex === null ? 'Position hinzufügen' : 'Position bearbeiten'}</h3>

            {/* Artikel auswählen oder gewählten Artikel anzeigen */}
            {neuePosition.artikel_id ? (
              <div className="re-selected-article-row">
                <div style={{flex:1}}>
                  <span className="re-selected-article-name">{neuePosition.bezeichnung}</span>
                  {neuePosition.artikelnummer && (
                    <span className="re-artikel-nr-badge">Nr. {neuePosition.artikelnummer}</span>
                  )}
                </div>
                <button type="button" className="re-clear-article-btn"
                  onClick={() => setNeuePosition(p => ({...p, artikel_id: '', bezeichnung: '', artikelnummer: '', einzelpreis: 0, ust_prozent: 19}))}>
                  × Artikel ändern
                </button>
              </div>
            ) : (
              <>
                <div className="re-inline-create-row">
                  <select autoFocus className="re-input-sm" style={{flex:1}}
                    onChange={e => handleArtikelChange(e.target.value)}
                    defaultValue="">
                    <option value="">Artikel wählen…</option>
                    {artikel.map(a => <option key={a.artikel_id} value={a.artikel_id}>{a.name} – {(a.verkaufspreis_cent/100).toFixed(2)} €</option>)}
                  </select>
                  <button className="btn-inline-create" onClick={() => { setModalError(''); loadArtikelGruppen(); setShowNeuerArtikelModal(true); }}>+ Neu</button>
                </div>
                <div className="re-modal-row">
                  <div className="re-modal-field">
                    <label>Freie Bezeichnung *</label>
                    <input className="re-input-sm" value={neuePosition.bezeichnung}
                      onChange={e => setNeuePosition(p => ({...p, bezeichnung: e.target.value}))} placeholder="z. B. Sonderleistung" />
                  </div>
                  <div className="re-modal-field">
                    <label>Artikelnummer</label>
                    <input className="re-input-sm" value={neuePosition.artikelnummer}
                      onChange={e => setNeuePosition(p => ({...p, artikelnummer: e.target.value}))} placeholder="optional" />
                  </div>
                </div>
              </>
            )}
            <div className="re-modal-row re-modal-row--3">
              <div className="re-modal-field">
                <label>Menge</label>
                <input className="re-input-sm" type="number" min="1" value={neuePosition.menge}
                  onChange={e => setNeuePosition(p => ({...p, menge: parseInt(e.target.value) || 1}))} />
              </div>
              <div className="re-modal-field">
                <label>Einzelpreis (€)</label>
                <input className="re-input-sm" type="number" step="0.01" min="0" value={neuePosition.einzelpreis}
                  onChange={e => setNeuePosition(p => ({...p, einzelpreis: parseFloat(e.target.value) || 0}))} />
              </div>
              <div className="re-modal-field">
                <label>USt.</label>
                <select className="re-input-sm" value={neuePosition.ust_prozent}
                  onChange={e => setNeuePosition(p => ({...p, ust_prozent: parseFloat(e.target.value)}))}>
                  <option value={19}>19 %</option>
                  <option value={7}>7 %</option>
                  <option value={0}>0 %</option>
                </select>
              </div>
            </div>
            <div className="re-modal-field">
              <label>Leistungsdatum</label>
              <input className="re-input-sm" type="date" value={neuePosition.leistungsdatum || ''}
                onChange={e => setNeuePosition(p => ({...p, leistungsdatum: e.target.value}))} />
            </div>
            <div className="re-modal-field">
              <label>Freitext (erscheint in PDF)</label>
              <textarea className="re-input-sm re-modal-textarea" rows={2}
                value={neuePosition.freitext || ''}
                onChange={e => setNeuePosition(p => ({...p, freitext: e.target.value}))}
                placeholder="Optionaler Zusatztext" />
            </div>
            <div className="re-modal-row" style={{alignItems:'center',gap:'1rem'}}>
              <label className="re-checkbox-label-wrap">
                <input type="checkbox" className="re-pos-checkbox"
                  checked={neuePosition.ist_rabattfaehig}
                  onChange={e => setNeuePosition(p => ({...p, ist_rabattfaehig: e.target.checked, rabatt_prozent: e.target.checked ? p.rabatt_prozent : 0}))} />
                <span>Rabattfähig</span>
              </label>
              {neuePosition.ist_rabattfaehig && (
                <div className="re-modal-field" style={{marginBottom:0}}>
                  <label>Rabatt %</label>
                  <input className="re-input-sm" type="number" min="0" max="100" step="0.5"
                    value={neuePosition.rabatt_prozent}
                    onChange={e => setNeuePosition(p => ({...p, rabatt_prozent: parseFloat(e.target.value) || 0}))} />
                </div>
              )}
            </div>
            {editingPositionIndex !== null && (
              <button className="re-btn-delete-position" onClick={() => { removePosition(editingPositionIndex); setShowPositionPopup(false); setEditingPositionIndex(null); }}>
                🗑 Position entfernen
              </button>
            )}
            <div className="re-modal-actions">
              <button className="btn-secondary" onClick={() => { setShowPositionPopup(false); setEditingPositionIndex(null); }}>Abbrechen</button>
              <button className="btn-primary" onClick={savePositionEdit} disabled={!neuePosition.bezeichnung}>
                {editingPositionIndex === null ? 'Hinzufügen' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice meta (dates) popup ── */}
      {showMetaPopup && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowMetaPopup(false); }}>
          <div className="re-inline-modal">
            <h3>Rechnungsdaten</h3>
            <div className="re-modal-row re-modal-row--3">
              <div className="re-modal-field">
                <label>Belegdatum</label>
                <input type="date" className="re-input-sm" value={rechnungsDaten.belegdatum}
                  onChange={e => { const nd = e.target.value; setRechnungsDaten(prev => ({...prev, belegdatum: nd, zahlungsfrist: calculateZahlungsfrist(nd)})); }} />
              </div>
              <div className="re-modal-field">
                <label>Leistungsdatum</label>
                <input type="date" className="re-input-sm" value={rechnungsDaten.leistungsdatum}
                  onChange={e => setRechnungsDaten(prev => ({...prev, leistungsdatum: e.target.value}))} />
              </div>
              <div className="re-modal-field">
                <label>Zahlungsfrist</label>
                <input type="date" className="re-input-sm" value={rechnungsDaten.zahlungsfrist}
                  onChange={e => setRechnungsDaten(prev => ({...prev, zahlungsfrist: e.target.value}))} />
              </div>
            </div>
            <div className="re-modal-actions">
              <button className="btn-primary" onClick={() => setShowMetaPopup(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rabatt / Skonto popup ── */}
      {showRabattSkontoPopup && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowRabattSkontoPopup(false); }}>
          <div className="re-inline-modal">
            <h3>Rabatt &amp; Skonto</h3>
            <div className="re-modal-row">
              <div className="re-modal-field">
                <label>Globaler Rabatt %</label>
                <input type="number" className="re-input-sm" min="0" max="100" step="0.01"
                  value={rechnungsDaten.rabatt_prozent}
                  onChange={e => setRechnungsDaten(prev => ({...prev, rabatt_prozent: parseFloat(e.target.value) || 0}))} />
              </div>
              <div className="re-modal-field">
                <label>Skonto %</label>
                <input type="number" className="re-input-sm" min="0" max="100" step="0.01"
                  value={rechnungsDaten.skonto_prozent}
                  onChange={e => setRechnungsDaten(prev => ({...prev, skonto_prozent: parseFloat(e.target.value) || 0}))} />
              </div>
            </div>
            <div className="re-modal-actions">
              <button className="btn-secondary" onClick={() => { setRechnungsDaten(prev => ({...prev, rabatt_prozent: 0, skonto_prozent: 0})); setShowRabattSkontoPopup(false); }}>Zurücksetzen</button>
              <button className="btn-primary" onClick={() => setShowRabattSkontoPopup(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Varianten-Modal */}
      {renderVariantenModal()}

      {/* Neuer Artikel Modal */}
      {showNeuerArtikelModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowNeuerArtikelModal(false); }}>
          <div className="re-inline-modal re-inline-modal--wide">
            <h3>Neuen Artikel anlegen</h3>
            {modalError && <div className="re-modal-error">{modalError}</div>}

            <div className="re-modal-field">
              <label>Bezeichnung *</label>
              <input className="re-input-sm" value={neuerArtikelForm.name}
                onChange={e => setNeuerArtikelForm(f => ({...f, name: e.target.value}))}
                placeholder="Artikelname" autoFocus />
            </div>

            <div className="re-modal-row">
              <div className="re-modal-field">
                <label>Artikelnummer</label>
                <input className="re-input-sm" value={neuerArtikelForm.artikel_nummer}
                  onChange={e => setNeuerArtikelForm(f => ({...f, artikel_nummer: e.target.value}))}
                  placeholder="Auto-generiert" />
              </div>
              <div className="re-modal-field">
                <label>Kategorie *</label>
                <select className="re-input-sm" value={neuerArtikelForm.kategorie_id}
                  onChange={e => setNeuerArtikelForm(f => ({...f, kategorie_id: e.target.value}))}>
                  <option value="">— wählen —</option>
                  {artikelGruppen.map(g => (
                    <option key={g.id || g.kategorie_id} value={g.id || g.kategorie_id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="re-modal-field">
              <label>Beschreibung</label>
              <textarea className="re-input-sm re-modal-textarea" rows={2}
                value={neuerArtikelForm.beschreibung}
                onChange={e => setNeuerArtikelForm(f => ({...f, beschreibung: e.target.value}))}
                placeholder="Optional" />
            </div>

            <div className="re-modal-row re-modal-row--3">
              <div className="re-modal-field">
                <label>Verkaufspreis (€) *</label>
                <input className="re-input-sm" type="number" step="0.01" min="0"
                  value={neuerArtikelForm.verkaufspreis_euro}
                  onChange={e => setNeuerArtikelForm(f => ({...f, verkaufspreis_euro: e.target.value}))}
                  placeholder="0,00" />
              </div>
              <div className="re-modal-field">
                <label>Einkaufspreis (€)</label>
                <input className="re-input-sm" type="number" step="0.01" min="0"
                  value={neuerArtikelForm.einkaufspreis_euro}
                  onChange={e => setNeuerArtikelForm(f => ({...f, einkaufspreis_euro: e.target.value}))}
                  placeholder="0,00" />
              </div>
              <div className="re-modal-field">
                <label>MwSt.</label>
                <select className="re-input-sm" value={neuerArtikelForm.mwst_prozent}
                  onChange={e => setNeuerArtikelForm(f => ({...f, mwst_prozent: parseFloat(e.target.value)}))}>
                  <option value={19}>19 %</option>
                  <option value={7}>7 %</option>
                  <option value={0}>0 %</option>
                </select>
              </div>
            </div>

            <div className="re-modal-row">
              <div className="re-modal-field">
                <label>Lagerbestand</label>
                <input className="re-input-sm" type="number" min="0"
                  value={neuerArtikelForm.lagerbestand}
                  onChange={e => setNeuerArtikelForm(f => ({...f, lagerbestand: e.target.value, lager_tracking: !!e.target.value}))}
                  placeholder="0" />
              </div>
              <div className="re-modal-field">
                <label>Mindestbestand</label>
                <input className="re-input-sm" type="number" min="0"
                  value={neuerArtikelForm.mindestbestand}
                  onChange={e => setNeuerArtikelForm(f => ({...f, mindestbestand: e.target.value}))}
                  placeholder="0" />
              </div>
            </div>

            <div className="re-modal-actions">
              <button className="btn-secondary" onClick={() => setShowNeuerArtikelModal(false)} disabled={savingModal}>Abbrechen</button>
              <button className="btn-primary" onClick={saveNeuerArtikel} disabled={savingModal}>
                {savingModal ? 'Wird gespeichert…' : 'Artikel anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Neuer Kunde Modal */}
      {showNeuerKundeModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowNeuerKundeModal(false); }}>
          <div className="re-inline-modal re-inline-modal--wide">
            <h3>Neuen Kunden anlegen</h3>

            {/* Typ-Toggle */}
            <div className="re-kunden-typ-toggle">
              <button
                className={`re-typ-btn${!neuerKundeForm.ist_firma ? ' active' : ''}`}
                onClick={() => setNeuerKundeForm(f => ({...f, ist_firma: false}))}
                type="button"
              >👤 Privatperson</button>
              <button
                className={`re-typ-btn${neuerKundeForm.ist_firma ? ' active' : ''}`}
                onClick={() => setNeuerKundeForm(f => ({...f, ist_firma: true}))}
                type="button"
              >🏢 Geschäftskunde</button>
            </div>

            {modalError && <div className="re-modal-error">{modalError}</div>}

            {neuerKundeForm.ist_firma ? (
              <>
                <div className="re-modal-field">
                  <label>Firmenname *</label>
                  <input className="re-input-sm" value={neuerKundeForm.firmenname}
                    onChange={e => setNeuerKundeForm(f => ({...f, firmenname: e.target.value}))}
                    placeholder="Muster GmbH" autoFocus />
                </div>
                <div className="re-modal-row">
                  <div className="re-modal-field">
                    <label>USt-IdNr.</label>
                    <input className="re-input-sm" value={neuerKundeForm.ust_id}
                      onChange={e => setNeuerKundeForm(f => ({...f, ust_id: e.target.value}))}
                      placeholder="DE123456789" />
                  </div>
                  <div className="re-modal-field">
                    <label>Ansprechpartner</label>
                    <input className="re-input-sm" value={neuerKundeForm.ansprechpartner}
                      onChange={e => setNeuerKundeForm(f => ({...f, ansprechpartner: e.target.value}))}
                      placeholder="Max Mustermann" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="re-modal-row">
                  <div className="re-modal-field">
                    <label>Vorname *</label>
                    <input className="re-input-sm" value={neuerKundeForm.vorname}
                      onChange={e => setNeuerKundeForm(f => ({...f, vorname: e.target.value}))}
                      placeholder="Vorname" autoFocus />
                  </div>
                  <div className="re-modal-field">
                    <label>Nachname *</label>
                    <input className="re-input-sm" value={neuerKundeForm.nachname}
                      onChange={e => setNeuerKundeForm(f => ({...f, nachname: e.target.value}))}
                      placeholder="Nachname" />
                  </div>
                </div>
                <div className="re-modal-field">
                  <label>Geburtsdatum *</label>
                  <input className="re-input-sm" type="date" value={neuerKundeForm.geburtsdatum}
                    onChange={e => setNeuerKundeForm(f => ({...f, geburtsdatum: e.target.value}))} />
                </div>
              </>
            )}

            <div className="re-modal-section-title">Adresse</div>
            <div className="re-modal-row re-modal-row--addr">
              <div className="re-modal-field re-modal-field--street">
                <label>Straße</label>
                <input className="re-input-sm" value={neuerKundeForm.strasse}
                  onChange={e => setNeuerKundeForm(f => ({...f, strasse: e.target.value}))}
                  placeholder="Musterstraße" />
              </div>
              <div className="re-modal-field re-modal-field--hausnr">
                <label>Nr.</label>
                <input className="re-input-sm" value={neuerKundeForm.hausnummer}
                  onChange={e => setNeuerKundeForm(f => ({...f, hausnummer: e.target.value}))}
                  placeholder="1a" />
              </div>
            </div>
            <div className="re-modal-row">
              <div className="re-modal-field re-modal-field--plz">
                <label>PLZ</label>
                <input className="re-input-sm" value={neuerKundeForm.plz}
                  onChange={e => setNeuerKundeForm(f => ({...f, plz: e.target.value}))}
                  placeholder="80331" />
              </div>
              <div className="re-modal-field">
                <label>Ort</label>
                <input className="re-input-sm" value={neuerKundeForm.ort}
                  onChange={e => setNeuerKundeForm(f => ({...f, ort: e.target.value}))}
                  placeholder="München" />
              </div>
            </div>

            <div className="re-modal-section-title">Kontakt</div>
            <div className="re-modal-row">
              <div className="re-modal-field">
                <label>E-Mail</label>
                <input className="re-input-sm" type="email" value={neuerKundeForm.email}
                  onChange={e => setNeuerKundeForm(f => ({...f, email: e.target.value}))}
                  placeholder="email@beispiel.de" />
              </div>
              <div className="re-modal-field">
                <label>Telefon</label>
                <input className="re-input-sm" value={neuerKundeForm.telefon}
                  onChange={e => setNeuerKundeForm(f => ({...f, telefon: e.target.value}))}
                  placeholder="+49 89 ..." />
              </div>
            </div>

            <div className="re-modal-actions">
              <button className="btn-secondary" onClick={() => setShowNeuerKundeModal(false)} disabled={savingModal}>Abbrechen</button>
              <button className="btn-primary" onClick={saveNeuerKunde} disabled={savingModal}>
                {savingModal ? 'Wird gespeichert…' : 'Kunden anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dojo-Auswahl Modal */}
      {showDojoSelection && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget && dojoSelectionDone) {
            setShowDojoSelection(false);
          }
        }}>
          <div className="modal-content dojo-selection-modal">
            <div className="modal-header">
              <h2><Building2 size={24} /> Dojo auswählen</h2>
            </div>
            <div className="modal-body">
              <p className="re-modal-intro">
                Für welches Dojo soll die Rechnung erstellt werden?
              </p>
              <div className="dojo-selection-grid">
                {dojos.filter(d => d && d.id).map((dojo) => (
                  <div
                    key={dojo.id}
                    className={`dojo-selection-card ${activeDojo?.id === dojo.id ? 'active' : ''}`}
                    onClick={() => handleDojoSelect(dojo)}
                  >
                    <div className="dojo-card-header">
                      <Building2 size={32} />
                      {activeDojo?.id === dojo.id && <Check size={20} className="check-icon" />}
                    </div>
                    <h3>{dojo.dojoname}</h3>
                    <p className="dojo-address">
                      {dojo.strasse} {dojo.hausnummer}<br />
                      {dojo.plz} {dojo.ort}
                    </p>
                    {dojo.steuer_status && (
                      <span className={`steuer-badge ${dojo.steuer_status}`}>
                        {dojo.steuer_status === 'kleinunternehmer' ? 'Kleinunternehmer' : 'Regelbesteuert'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RechnungErstellen;
