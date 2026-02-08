import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { Building2, Check, Search, X, Loader2, Save, Eye, Download, CheckCircle, BookOpen } from 'lucide-react';
import '../styles/RechnungErstellen.css';

const VerbandRechnungErstellen = ({ token: propToken }) => {
  const { token: contextToken } = useAuth();
  const token = propToken || contextToken;

  // View Mode: 'erstellen' oder 'ansehen'
  const [viewMode, setViewMode] = useState('erstellen');

  // Organisation ist immer TDA (keine Auswahl mehr nötig)
  const [selectedOrganisation] = useState({
    id: 'tda',
    name: 'Tiger & Dragon Association International',
    adresse: 'Ohmstr. 14, 84137 Vilsbiburg',
    typ: 'verband'
  });

  // Form Data
  const [empfaenger, setEmpfaenger] = useState({ verbandsmitglieder: [], softwareNutzer: [], dojoMitglieder: [] });
  const [artikel, setArtikel] = useState([]);
  const [selectedEmpfaenger, setSelectedEmpfaenger] = useState(null);
  const [empfaengerTyp, setEmpfaengerTyp] = useState('dojo_mitglied');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  // Manuelle Empfängerdaten
  const [manuellName, setManuellName] = useState('');
  const [manuellAdresse, setManuellAdresse] = useState('');
  const [manuellEmail, setManuellEmail] = useState('');

  // TDA Bankdaten
  const [bankDaten] = useState({
    bank_name: 'Sparkasse Niederbayern-Mitte',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    kontoinhaber: 'Tiger & Dragon Association International'
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
    rabatt_prozent: 0
  });
  const [showRabattHinweis, setShowRabattHinweis] = useState(false);

  // Vorschau Modal
  const [showVorschauModal, setShowVorschauModal] = useState(false);
  const [vorschauUrl, setVorschauUrl] = useState('');

  // Bestehende Rechnungen
  const [rechnungen, setRechnungen] = useState([]);

  // API Helper
  const getApi = () => axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${token}` }
  });


  // Daten laden beim Start
  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  // Skonto-Tage automatisch berechnen
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [empfaengerRes, nummernRes, rechnungenRes, artikelRes] = await Promise.all([
        getApi().get('/verband-rechnungen/empfaenger'),
        getApi().get('/verband-rechnungen/nummernkreis'),
        getApi().get('/verband-rechnungen'),
        getApi().get('/artikel?dojo_id=2')
      ]);

      if (empfaengerRes.data.success) setEmpfaenger(empfaengerRes.data.empfaenger);
      if (nummernRes.data.success) setRechnungsDaten(prev => ({ ...prev, rechnungsnummer: nummernRes.data.rechnungsnummer }));
      if (rechnungenRes.data.success) setRechnungen(rechnungenRes.data.rechnungen);
      const artikelData = artikelRes.data?.data || artikelRes.data || [];
      setArtikel(Array.isArray(artikelData) ? artikelData : []);
      setError(null);
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleEmpfaengerSelect = (emp, typ) => {
    setSelectedEmpfaenger(emp);
    setEmpfaengerTyp(typ);
    setRechnungsDaten(prev => ({ ...prev, kundennummer: emp.id || '' }));
    setSearchTerm('');
  };

  const getFilteredEmpfaenger = () => {
    let list = [];
    if (empfaengerTyp === 'verbandsmitglied') list = empfaenger.verbandsmitglieder || [];
    else if (empfaengerTyp === 'software_nutzer') list = empfaenger.softwareNutzer || [];
    else if (empfaengerTyp === 'dojo_mitglied') list = empfaenger.dojoMitglieder || [];

    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(e =>
      e.name?.toLowerCase().includes(term) ||
      e.email?.toLowerCase().includes(term) ||
      e.dojo_name?.toLowerCase().includes(term)
    );
  };

  const handleArtikelChange = (artikel_id) => {
    const art = artikel.find(a => (a.artikel_id || a.id) === parseInt(artikel_id));
    if (art) {
      const preis = art.verkaufspreis_cent ? art.verkaufspreis_cent / 100 : (art.preis || 0);
      setNeuePosition({
        ...neuePosition,
        artikel_id: art.artikel_id || art.id,
        bezeichnung: art.name || art.bezeichnung,
        artikelnummer: art.artikel_nummer || '',
        einzelpreis: preis,
        ust_prozent: art.mwst_prozent || 19
      });
    }
  };

  const addPosition = () => {
    if (!neuePosition.bezeichnung || neuePosition.menge <= 0) return;

    // Prüfe ob Artikel bereits existiert
    const existingIndex = positionen.findIndex(pos =>
      pos.artikel_id === neuePosition.artikel_id &&
      pos.bezeichnung === neuePosition.bezeichnung &&
      Number(pos.einzelpreis) === Number(neuePosition.einzelpreis)
    );

    if (existingIndex !== -1) {
      const updatedPositionen = [...positionen];
      updatedPositionen[existingIndex] = {
        ...updatedPositionen[existingIndex],
        menge: Number(updatedPositionen[existingIndex].menge) + Number(neuePosition.menge)
      };
      setPositionen(updatedPositionen);
    } else {
      setPositionen([...positionen, {
        ...neuePosition,
        pos: positionen.length + 1,
        menge: Number(neuePosition.menge),
        einzelpreis: Number(neuePosition.einzelpreis),
        ust_prozent: Number(neuePosition.ust_prozent),
        ist_rabattfaehig: neuePosition.ist_rabattfaehig,
        rabatt_prozent: Number(neuePosition.rabatt_prozent) || 0
      }]);
    }

    setNeuePosition({
      artikel_id: '',
      bezeichnung: '',
      artikelnummer: '',
      menge: 1,
      einzelpreis: 0,
      ust_prozent: 19,
      ist_rabattfaehig: false,
      rabatt_prozent: 0
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
      return sum + (bruttoPreis - rabattBetrag);
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
    const summe = calculateSumme();
    return (summe * 19) / 100;
  };

  const calculateEndbetrag = () => {
    return calculateSumme() + calculateUSt();
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

  // EPC QR-Code generieren
  const generateEPCQRCode = (betrag) => {
    if (!bankDaten.iban || !bankDaten.bic || !bankDaten.kontoinhaber || !betrag || betrag <= 0) {
      return '';
    }

    const verwendungszweck = `Rechnung ${rechnungsDaten.rechnungsnummer || ''}`.substring(0, 140);

    return [
      'BCD',
      '002',
      '1',
      'SCT',
      bankDaten.bic.trim(),
      bankDaten.kontoinhaber.trim().substring(0, 70),
      bankDaten.iban.replace(/\s/g, '').toUpperCase(),
      `EUR${Number(betrag).toFixed(2)}`,
      '',
      verwendungszweck,
      rechnungsDaten.rechnungsnummer?.substring(0, 35) || '',
      '',
      ''
    ].join('\n');
  };

  const handleSpeichern = async () => {
    if (!selectedEmpfaenger && empfaengerTyp !== 'manuell') {
      setError('Bitte wählen Sie einen Kunden aus');
      return;
    }
    if (empfaengerTyp === 'manuell' && !manuellName) {
      setError('Bitte geben Sie einen Namen ein');
      return;
    }
    if (positionen.length === 0) {
      setError('Bitte fügen Sie mindestens eine Position hinzu');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const data = {
        empfaenger_typ: empfaengerTyp,
        empfaenger_id: selectedEmpfaenger?.id || null,
        empfaenger_name: empfaengerTyp === 'manuell' ? manuellName : selectedEmpfaenger?.name,
        empfaenger_adresse: empfaengerTyp === 'manuell' ? manuellAdresse : selectedEmpfaenger?.adresse,
        empfaenger_email: empfaengerTyp === 'manuell' ? manuellEmail : selectedEmpfaenger?.email,
        rechnungsdatum: rechnungsDaten.belegdatum,
        leistungsdatum: rechnungsDaten.leistungsdatum,
        faelligkeitsdatum: rechnungsDaten.zahlungsfrist,
        rabatt_prozent: rechnungsDaten.rabatt_prozent,
        skonto_prozent: rechnungsDaten.skonto_prozent,
        skonto_tage: rechnungsDaten.skonto_tage,
        positionen: positionen.map(pos => ({
          bezeichnung: pos.bezeichnung,
          menge: pos.menge,
          einzelpreis: pos.einzelpreis,
          mwst_satz: pos.ust_prozent,
          ist_rabattfaehig: pos.ist_rabattfaehig,
          rabatt_prozent: pos.rabatt_prozent
        }))
      };

      const response = await getApi().post('/verband-rechnungen', data);

      if (response.data.success) {
        setSuccess(`Rechnung ${response.data.rechnungsnummer} erfolgreich erstellt!`);
        setVorschauUrl(`/api/verband-rechnungen/${response.data.rechnung_id}/pdf`);
        setShowVorschauModal(true);

        // Reset form
        setSelectedEmpfaenger(null);
        setManuellName('');
        setManuellAdresse('');
        setManuellEmail('');
        setPositionen([]);

        const numRes = await getApi().get('/verband-rechnungen/nummernkreis');
        if (numRes.data.success) setRechnungsDaten(prev => ({ ...prev, rechnungsnummer: numRes.data.rechnungsnummer }));
        loadData();
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern der Rechnung');
    } finally {
      setSaving(false);
    }
  };

  // Download-Funktion für Rechnungen (öffnet Print-Dialog)
  const handleDownloadRechnung = (rechnungId) => {
    window.open(`/api/verband-rechnungen/${rechnungId}/pdf?print=1`, '_blank');
  };

  // Rechnung ansehen (HTML in neuem Tab öffnen)
  const handleViewRechnung = (rechnungId) => {
    window.open(`/api/verband-rechnungen/${rechnungId}/pdf`, '_blank');
  };

  // Status-Badge Farbe
  const getStatusColor = (status) => {
    switch (status) {
      case 'bezahlt': return { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.5)', text: '#22c55e' };
      case 'offen': return { bg: 'rgba(234, 179, 8, 0.2)', border: 'rgba(234, 179, 8, 0.5)', text: '#eab308' };
      case 'ueberfaellig': return { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.5)', text: '#ef4444' };
      case 'storniert': return { bg: 'rgba(107, 114, 128, 0.2)', border: 'rgba(107, 114, 128, 0.5)', text: '#6b7280' };
      default: return { bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.3)', text: '#fff' };
    }
  };

  // Rechnung als bezahlt markieren (OHNE EÜR-Eintrag)
  const handleMarkAsBezahlt = async (rechnungId) => {
    try {
      const response = await getApi().put(`/verband-rechnungen/${rechnungId}/status`, {
        status: 'bezahlt',
        bezahlt_am: new Date().toISOString().split('T')[0]
      });

      if (response.data.success) {
        setSuccess('Rechnung als bezahlt markiert');
        loadData(); // Liste neu laden
      }
    } catch (err) {
      console.error('Fehler beim Markieren:', err);
      setError('Fehler beim Markieren als bezahlt');
    }
  };

  // Rechnung in EÜR buchen (erstellt Beleg in buchhaltung_belege)
  const handleEuerZuordnen = async (rechnung) => {
    try {
      const response = await getApi().post(`/verband-rechnungen/${rechnung.rechnung_id}/euer-buchen`);

      if (response.data.success) {
        setSuccess(`Rechnung ${rechnung.rechnungsnummer} in EÜR gebucht (Beleg ${response.data.beleg_nummer})`);
        loadData();
      }
    } catch (err) {
      console.error('Fehler beim EÜR-Buchen:', err);
      setError(err.response?.data?.error || 'Fehler beim Buchen in EÜR');
    }
  };

  if (loading) {
    return (
      <div className="rechnung-erstellen-container">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#ffffff' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <p>Lade Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rechnung-erstellen-container">
      {/* View Mode Toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '1rem',
        background: 'rgba(26, 26, 46, 0.95)',
        borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
        marginBottom: '1rem'
      }}>
        <button
          onClick={() => setViewMode('erstellen')}
          style={{
            padding: '0.6rem 1.5rem',
            background: viewMode === 'erstellen' ? 'linear-gradient(135deg, #c9a227, #a68519)' : 'rgba(255, 255, 255, 0.05)',
            border: viewMode === 'erstellen' ? 'none' : '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '8px',
            color: viewMode === 'erstellen' ? '#000' : '#ffd700',
            cursor: 'pointer',
            fontWeight: viewMode === 'erstellen' ? '600' : '400',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Save size={18} />
          Rechnung erstellen
        </button>
        <button
          onClick={() => setViewMode('ansehen')}
          style={{
            padding: '0.6rem 1.5rem',
            background: viewMode === 'ansehen' ? 'linear-gradient(135deg, #c9a227, #a68519)' : 'rgba(255, 255, 255, 0.05)',
            border: viewMode === 'ansehen' ? 'none' : '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '8px',
            color: viewMode === 'ansehen' ? '#000' : '#ffd700',
            cursor: 'pointer',
            fontWeight: viewMode === 'ansehen' ? '600' : '400',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Eye size={18} />
          Rechnungen ansehen
        </button>
      </div>

      {/* Rechnungen Liste */}
      {viewMode === 'ansehen' ? (
        <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{
            background: 'rgba(26, 26, 46, 0.95)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Building2 size={24} style={{ color: '#ffd700' }} />
                TDA Rechnungen
              </h2>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                {rechnungen.length} Rechnungen
              </span>
            </div>

            {rechnungen.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
                Keine Rechnungen vorhanden
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 215, 0, 0.2)' }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#ffd700', fontWeight: '600', fontSize: '0.85rem' }}>Rechnungs-Nr.</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#ffd700', fontWeight: '600', fontSize: '0.85rem' }}>Datum</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#ffd700', fontWeight: '600', fontSize: '0.85rem' }}>Empfänger</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#ffd700', fontWeight: '600', fontSize: '0.85rem' }}>Betrag</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#ffd700', fontWeight: '600', fontSize: '0.85rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#ffd700', fontWeight: '600', fontSize: '0.85rem' }}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rechnungen.map((rechnung) => {
                      const statusColors = getStatusColor(rechnung.status);
                      return (
                        <tr key={rechnung.rechnung_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: '0.75rem 1rem', color: '#fff', fontFamily: 'monospace' }}>
                            {rechnung.rechnungsnummer}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.8)' }}>
                            {rechnung.rechnungsdatum ? formatDateDDMMYYYY(rechnung.rechnungsdatum) : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.8)' }}>
                            {rechnung.empfaenger_name || '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#fff', fontWeight: '500' }}>
                            {Number(rechnung.summe_brutto || 0).toFixed(2)} €
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.75rem',
                              background: statusColors.bg,
                              border: `1px solid ${statusColors.border}`,
                              borderRadius: '12px',
                              color: statusColors.text,
                              fontSize: '0.8rem',
                              fontWeight: '500',
                              textTransform: 'capitalize'
                            }}>
                              {rechnung.status || 'offen'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleViewRechnung(rechnung.rechnung_id)}
                                title="Ansehen"
                                style={{
                                  padding: '0.4rem',
                                  background: 'rgba(255, 215, 0, 0.1)',
                                  border: '1px solid rgba(255, 215, 0, 0.3)',
                                  borderRadius: '6px',
                                  color: '#ffd700',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => handleDownloadRechnung(rechnung.rechnung_id)}
                                title="Drucken/PDF"
                                style={{
                                  padding: '0.4rem',
                                  background: 'rgba(99, 102, 241, 0.1)',
                                  border: '1px solid rgba(99, 102, 241, 0.3)',
                                  borderRadius: '6px',
                                  color: '#6366f1',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Download size={16} />
                              </button>
                              {rechnung.status !== 'bezahlt' && (
                                <button
                                  onClick={() => handleMarkAsBezahlt(rechnung.rechnung_id)}
                                  title="Als bezahlt markieren"
                                  style={{
                                    padding: '0.4rem',
                                    background: 'rgba(34, 197, 94, 0.1)',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    borderRadius: '6px',
                                    color: '#22c55e',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <CheckCircle size={16} />
                                </button>
                              )}
                              {!rechnung.euer_gebucht && (
                                <button
                                  onClick={() => handleEuerZuordnen(rechnung)}
                                  title="In EÜR buchen"
                                  style={{
                                    padding: '0.4rem',
                                    background: 'rgba(168, 85, 247, 0.1)',
                                    border: '1px solid rgba(168, 85, 247, 0.3)',
                                    borderRadius: '6px',
                                    color: '#a855f7',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <BookOpen size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.75rem 1rem', borderRadius: '8px', marginTop: '1rem', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="rechnung-editor">
          {/* Eingabeformular */}
          <div className="rechnung-form">
            <h2>NEUE RECHNUNG ERSTELLEN</h2>

          {/* Kunde */}
          <div className="form-section">
            <h3>KUNDE</h3>
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { id: 'dojo_mitglied', label: 'Mitglieder' },
                { id: 'verbandsmitglied', label: 'Verband' },
                { id: 'software_nutzer', label: 'Software' },
                { id: 'manuell', label: 'Manuell' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setEmpfaengerTyp(tab.id); setSelectedEmpfaenger(null); }}
                  style={{
                    padding: '0.3rem 0.5rem',
                    fontSize: '0.7rem',
                    background: empfaengerTyp === tab.id ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${empfaengerTyp === tab.id ? '#ffd700' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '4px',
                    color: empfaengerTyp === tab.id ? '#ffd700' : '#aaa',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {empfaengerTyp !== 'manuell' ? (
              <select
                onChange={(e) => {
                  const emp = getFilteredEmpfaenger().find(em => em.id === parseInt(e.target.value));
                  if (emp) handleEmpfaengerSelect(emp, empfaengerTyp);
                }}
                value={selectedEmpfaenger?.id || ''}
              >
                <option value="">Bitte wählen...</option>
                {getFilteredEmpfaenger().map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.dojo_name ? `(${emp.dojo_name})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <input type="text" value={manuellName} onChange={(e) => setManuellName(e.target.value)} placeholder="Name / Firma *" />
                <textarea value={manuellAdresse} onChange={(e) => setManuellAdresse(e.target.value)} placeholder="Adresse" rows={2} style={{ resize: 'none' }} />
                <input type="email" value={manuellEmail} onChange={(e) => setManuellEmail(e.target.value)} placeholder="E-Mail" />
              </div>
            )}
          </div>

          {/* Rechnungsdaten */}
          <div className="form-section">
            <h3>RECHNUNGSDATEN</h3>
            <div className="form-grid">
              <div>
                <label>Belegdatum</label>
                <input
                  type="date"
                  value={rechnungsDaten.belegdatum}
                  onChange={(e) => setRechnungsDaten({
                    ...rechnungsDaten,
                    belegdatum: e.target.value,
                    zahlungsfrist: calculateZahlungsfrist(e.target.value)
                  })}
                />
              </div>
              <div>
                <label>Leistungsdatum</label>
                <input
                  type="date"
                  value={rechnungsDaten.leistungsdatum}
                  onChange={(e) => setRechnungsDaten({ ...rechnungsDaten, leistungsdatum: e.target.value })}
                />
              </div>
              <div>
                <label>Zahlungsfrist</label>
                <input
                  type="date"
                  value={rechnungsDaten.zahlungsfrist}
                  onChange={(e) => setRechnungsDaten({ ...rechnungsDaten, zahlungsfrist: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Position hinzufügen */}
          <div className="form-section">
            <h3>POSITION HINZUFÜGEN</h3>
            <div className="position-input">
              <select onChange={(e) => handleArtikelChange(e.target.value)} value={neuePosition.artikel_id}>
                <option value="">Artikel wählen...</option>
                {artikel.map(a => (
                  <option key={a.artikel_id || a.id} value={a.artikel_id || a.id}>
                    {a.name || a.bezeichnung}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={neuePosition.menge}
                onChange={(e) => setNeuePosition({ ...neuePosition, menge: parseInt(e.target.value) || 1 })}
                min="1"
                style={{ width: '60px' }}
              />
              <button onClick={addPosition} className="btn-add">Hinzufügen</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                type="checkbox"
                id="rabattfaehig"
                checked={neuePosition.ist_rabattfaehig}
                onChange={(e) => setNeuePosition({ ...neuePosition, ist_rabattfaehig: e.target.checked })}
                style={{ width: '14px', height: '14px' }}
              />
              <label htmlFor="rabattfaehig" className="checkbox-label">Rabattfähig</label>
            </div>

            {/* Hinzugefügte Positionen */}
            {positionen.length > 0 && (
              <div style={{ marginTop: '0.75rem', maxHeight: '150px', overflowY: 'auto' }}>
                {positionen.map((pos, index) => (
                  <div key={index} className="position-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="position-item-text">
                        <strong>{pos.bezeichnung}</strong> - {pos.menge}x {pos.einzelpreis.toFixed(2)} €
                        {pos.ist_rabattfaehig && pos.rabatt_prozent > 0 && (
                          <span style={{ color: '#ffd700', marginLeft: '0.5rem' }}>(-{pos.rabatt_prozent}%)</span>
                        )}
                      </div>
                      <button
                        onClick={() => removePosition(index)}
                        style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '4px', color: '#ef4444', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', padding: 0 }}
                      >
                        ×
                      </button>
                    </div>
                    {pos.ist_rabattfaehig && (
                      <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label className="rabatt-label">Rabatt %:</label>
                        <input
                          type="number"
                          className="rabatt-input"
                          value={pos.rabatt_prozent}
                          onChange={(e) => {
                            const updatedPositionen = [...positionen];
                            updatedPositionen[index] = { ...pos, rabatt_prozent: parseFloat(e.target.value) || 0 };
                            setPositionen(updatedPositionen);
                          }}
                          min="0"
                          max="100"
                          step="0.01"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rabatt & Skonto */}
          <div className="form-section">
            <h3>RABATT & SKONTO</h3>
            <div className="form-grid">
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <label>Rabatt %</label>
                  <button
                    type="button"
                    onClick={() => setShowRabattHinweis(!showRabattHinweis)}
                    style={{
                      background: 'rgba(255, 215, 0, 0.2)',
                      border: '1px solid rgba(255, 215, 0, 0.4)',
                      borderRadius: '50%',
                      color: '#ffd700',
                      width: '14px',
                      height: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      padding: 0
                    }}
                  >
                    ?
                  </button>
                </div>
                <input
                  type="number"
                  value={rechnungsDaten.rabatt_prozent}
                  onChange={(e) => setRechnungsDaten({ ...rechnungsDaten, rabatt_prozent: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              <div>
                <label>Skonto %</label>
                <input
                  type="number"
                  value={rechnungsDaten.skonto_prozent}
                  onChange={(e) => setRechnungsDaten({ ...rechnungsDaten, skonto_prozent: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              <div>
                <label>Skonto Tage</label>
                <input
                  type="number"
                  value={rechnungsDaten.skonto_tage}
                  readOnly
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', cursor: 'not-allowed' }}
                />
              </div>
            </div>
          </div>

          {/* Rabatt Hinweis Modal */}
          {showRabattHinweis && (
            <>
              <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 9999,
                padding: '1rem',
                background: 'rgba(255, 215, 0, 0.98)',
                border: '2px solid #ffd700',
                borderRadius: '8px',
                color: '#000',
                fontSize: '0.85rem',
                maxWidth: '320px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
              }}>
                <strong>Globaler Rabatt:</strong> Dieser Rabatt wird auf die gesamte Rechnung angewendet.
                <br /><br />
                Für <strong>einzelne Positionen</strong> können Sie den Rabatt oben in der Positionsliste festlegen.
                <button
                  onClick={() => setShowRabattHinweis(false)}
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.4rem 0.75rem',
                    background: '#000',
                    color: '#ffd700',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  Verstanden
                </button>
              </div>
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 9998
              }} onClick={() => setShowRabattHinweis(false)} />
            </>
          )}

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.5rem', borderRadius: '6px', marginTop: '0.5rem', fontSize: '0.8rem' }}>
              {error}
            </div>
          )}

          <button onClick={handleSpeichern} className="btn-save" disabled={saving}>
            {saving ? 'Speichern...' : 'Rechnung speichern'}
          </button>
        </div>

        {/* Rechnungsvorschau */}
        <div className="rechnung-preview">
          <div className="invoice-page">
            {/* Header */}
            <div className="invoice-header">
              <div className="company-info">
                <div className="company-small">
                  {selectedOrganisation?.name} | {selectedOrganisation?.adresse}
                </div>
                <div className="recipient-address">
                  {selectedEmpfaenger ? (
                    <>
                      <div>Herrn/Frau</div>
                      <div>{selectedEmpfaenger.name}</div>
                      {selectedEmpfaenger.adresse && selectedEmpfaenger.adresse.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </>
                  ) : empfaengerTyp === 'manuell' && manuellName ? (
                    <>
                      <div>Herrn/Frau</div>
                      <div>{manuellName}</div>
                      {manuellAdresse && manuellAdresse.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </>
                  ) : (
                    <div style={{ color: '#999' }}>Bitte Kunde wählen</div>
                  )}
                </div>
              </div>
              <div className="invoice-meta">
                <div className="logo-placeholder">TDA</div>
                <div className="invoice-numbers">
                  <div>Rechnungs-Nr.: {rechnungsDaten.rechnungsnummer}</div>
                  <div>Kundennummer: {rechnungsDaten.kundennummer || '-'}</div>
                  <div>Belegdatum: {rechnungsDaten.belegdatum}</div>
                  <div>Liefer-/Leistungsdatum: {rechnungsDaten.leistungsdatum}</div>
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="invoice-title">
              <h1>RECHNUNG</h1>
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
                    <tr key={index}>
                      <td>{pos.pos}</td>
                      <td>{pos.bezeichnung}</td>
                      <td>{pos.artikelnummer || '-'}</td>
                      <td>{pos.menge}</td>
                      <td>Stk.</td>
                      <td>{Number(pos.einzelpreis).toFixed(2)}</td>
                      <td>{pos.ist_rabattfaehig ? `${Number(pos.rabatt_prozent).toFixed(2)} %` : '-'}</td>
                      <td>{Number(pos.ust_prozent).toFixed(2)} %</td>
                      <td>{nettoPreis.toFixed(2)}</td>
                    </tr>
                  );
                })}
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
                  <span>{rechnungsDaten.rabatt_prozent.toFixed(2)} % Rabatt:</span>
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

            {/* Payment Terms und QR Codes */}
            <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', alignItems: 'flex-start' }}>
              <div className="payment-terms" style={{ flex: '1', minWidth: '300px' }}>
                <p>Bitte beachten Sie unsere Zahlungsbedingung:</p>
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
              </div>

              {/* QR Codes */}
              {calculateEndbetrag() > 0 && (
                <div className="qr-codes-section" style={{ flex: '0 0 auto', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'nowrap', alignItems: 'flex-start', width: Number(rechnungsDaten.skonto_prozent) > 0 ? '180px' : '90px', marginRight: '5mm' }}>
                  {Number(rechnungsDaten.skonto_prozent) > 0 && Number(rechnungsDaten.skonto_tage) > 0 ? (
                    <>
                      {/* QR-Code mit Skonto */}
                      <div style={{ textAlign: 'center', flex: '0 0 auto', width: '90px' }}>
                        <h4 className="qr-code-title" style={{ marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#000', textTransform: 'uppercase' }}>Zahlung mit Skonto</h4>
                        <div style={{ padding: '0.3rem', background: '#fff', display: 'inline-block', borderRadius: '4px' }}>
                          <QRCodeSVG
                            value={generateEPCQRCode(calculateEndbetrag() - calculateSkonto())}
                            size={70}
                            level="M"
                          />
                        </div>
                        <p style={{ marginTop: '0', fontSize: '0.75rem', color: '#000', fontWeight: '600' }}>
                          Betrag: {(calculateEndbetrag() - calculateSkonto()).toFixed(2)} €
                        </p>
                        <p style={{ marginTop: '0', fontSize: '0.7rem', color: '#000' }}>
                          bis zum {formatDateDDMMYYYY(rechnungsDaten.belegdatum, rechnungsDaten.skonto_tage)}
                        </p>
                      </div>
                      {/* QR-Code ohne Skonto */}
                      <div style={{ textAlign: 'center', flex: '0 0 auto', width: '90px' }}>
                        <h4 className="qr-code-title" style={{ marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#000', textTransform: 'uppercase' }}>Zahlung ohne Skonto</h4>
                        <div style={{ padding: '0.3rem', background: '#fff', display: 'inline-block', borderRadius: '4px' }}>
                          <QRCodeSVG
                            value={generateEPCQRCode(calculateEndbetrag())}
                            size={70}
                            level="M"
                          />
                        </div>
                        <p style={{ marginTop: '0', fontSize: '0.75rem', color: '#000', fontWeight: '600' }}>
                          Betrag: {calculateEndbetrag().toFixed(2)} €
                        </p>
                        <p style={{ marginTop: '0', fontSize: '0.7rem', color: '#000' }}>
                          ab {formatDateDDMMYYYY(rechnungsDaten.zahlungsfrist)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', flex: '0 0 auto', width: '90px' }}>
                      <h4 className="qr-code-title" style={{ marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#000', textTransform: 'uppercase' }}>QR-Code für Überweisung</h4>
                      <div style={{ padding: '0.3rem', background: '#fff', display: 'inline-block', borderRadius: '4px' }}>
                        <QRCodeSVG
                          value={generateEPCQRCode(calculateEndbetrag())}
                          size={70}
                          level="M"
                        />
                      </div>
                      <p style={{ marginTop: '0', fontSize: '0.75rem', color: '#000', fontWeight: '600' }}>
                        Betrag: {calculateEndbetrag().toFixed(2)} €
                      </p>
                      <p style={{ marginTop: '0', fontSize: '0.7rem', color: '#000' }}>
                        bis zum {formatDateDDMMYYYY(rechnungsDaten.zahlungsfrist)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="rechnung-footer" style={{
              position: 'absolute',
              bottom: '0',
              left: '20mm',
              right: '20mm',
              paddingTop: '0.75rem',
              paddingBottom: '0.5rem',
              borderTop: '1px solid rgba(0, 0, 0, 0.2)',
              fontSize: '7pt',
              color: '#000',
              lineHeight: '1.6',
              textAlign: 'center'
            }}>
              <div style={{ marginBottom: '0.3rem' }}>
                {selectedOrganisation?.name} | {selectedOrganisation?.adresse} | info@tda-intl.org | www.tda-intl.org
              </div>
              <div>
                {bankDaten.bank_name} | {bankDaten.kontoinhaber} | {bankDaten.iban} | {bankDaten.bic}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Vorschau Modal */}
      {showVorschauModal && (
        <div className="modal-overlay" onClick={() => setShowVorschauModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1a1a2e', border: '1px solid rgba(201, 162, 39, 0.3)', borderRadius: '12px', width: '900px', height: '85vh', maxWidth: '90vw', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ color: '#fff', margin: 0 }}>Rechnung erstellt</h3>
              <button onClick={() => setShowVorschauModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <iframe src={vorschauUrl} title="Rechnung Vorschau" style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button onClick={() => setShowVorschauModal(false)} style={{ padding: '0.6rem 1rem', background: 'transparent', border: '1px solid rgba(201, 162, 39, 0.5)', color: '#c9a227', borderRadius: '6px', cursor: 'pointer' }}>Schließen</button>
              <button onClick={() => window.open(vorschauUrl + '?print=1', '_blank')} style={{ padding: '0.6rem 1rem', background: 'linear-gradient(135deg, #c9a227, #a68519)', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} /> PDF herunterladen
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default VerbandRechnungErstellen;
