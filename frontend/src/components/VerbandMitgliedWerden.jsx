// ============================================================================
// VERBAND MITGLIED WERDEN - Öffentliche Anmeldeseite
// TDA International - Verbandsmitgliedschaft Registrierung
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, User, Check, X, Euro, Calendar, Mail, Phone, MapPin,
  CreditCard, FileText, Shield, ChevronRight, ChevronLeft, Award,
  Percent, Gift, AlertCircle, CheckCircle, Loader
} from 'lucide-react';
import config from '../config/config.js';

const VerbandMitgliedWerden = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [einstellungen, setEinstellungen] = useState({});
  const [vorteile, setVorteile] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    typ: '', // 'dojo' | 'einzel'
    // Dojo-Daten
    dojo_name: '',
    dojo_inhaber: '',
    dojo_strasse: '',
    dojo_plz: '',
    dojo_ort: '',
    dojo_land: 'Deutschland',
    dojo_email: '',
    dojo_telefon: '',
    dojo_website: '',
    dojo_mitglieder_anzahl: '',
    // Einzelperson-Daten
    vorname: '',
    nachname: '',
    geburtsdatum: '',
    strasse: '',
    plz: '',
    ort: '',
    land: 'Deutschland',
    email: '',
    telefon: '',
    // SEPA-Daten
    zahlungsart: 'rechnung',
    iban: '',
    bic: '',
    kontoinhaber: '',
    bank_name: '',
    // Akzeptanz
    agb_accepted: false,
    dsgvo_accepted: false,
    widerrufsrecht_acknowledged: false,
    notizen: ''
  });

  // Signature Canvas
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState(null);

  // Load Einstellungen und Vorteile
  useEffect(() => {
    loadPublicConfig();
    loadVorteile();
  }, []);

  const loadPublicConfig = async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/verbandsmitgliedschaften/public/config`);
      const data = await res.json();
      if (data.success !== false) {
        setEinstellungen(data);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Konfiguration:', err);
      // Fallback-Werte
      setEinstellungen({
        preis_dojo: 99,
        preis_einzel: 49,
        verband_name: 'Tiger & Dragon Association International'
      });
    }
  };

  const loadVorteile = async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/verbandsmitgliedschaften/public/vorteile`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setVorteile(data);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Vorteile:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const selectTyp = (typ) => {
    setFormData(prev => ({ ...prev, typ }));
    setCurrentStep(2);
  };

  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => prev + 1);
      setError('');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
    setError('');
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 2:
        if (formData.typ === 'dojo') {
          if (!formData.dojo_name || !formData.dojo_inhaber || !formData.dojo_email) {
            setError('Bitte füllen Sie alle Pflichtfelder aus.');
            return false;
          }
        } else {
          if (!formData.vorname || !formData.nachname || !formData.email) {
            setError('Bitte füllen Sie alle Pflichtfelder aus.');
            return false;
          }
        }
        if (!validateEmail(formData.typ === 'dojo' ? formData.dojo_email : formData.email)) {
          setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
          return false;
        }
        return true;
      case 3:
        if (formData.zahlungsart === 'lastschrift') {
          if (!formData.iban || !formData.kontoinhaber) {
            setError('Bitte füllen Sie die SEPA-Daten aus.');
            return false;
          }
          if (!validateIBAN(formData.iban)) {
            setError('Bitte geben Sie eine gültige IBAN ein.');
            return false;
          }
        }
        return true;
      case 4:
        if (!formData.agb_accepted || !formData.dsgvo_accepted || !formData.widerrufsrecht_acknowledged) {
          setError('Bitte akzeptieren Sie alle erforderlichen Bedingungen.');
          return false;
        }
        if (!signatureData) {
          setError('Bitte unterschreiben Sie im Unterschriftsfeld.');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateIBAN = (iban) => {
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,}$/.test(cleanIban) && cleanIban.length >= 15;
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;

    setLoading(true);
    setError('');

    try {
      const submitData = {
        ...formData,
        unterschrift_digital: signatureData,
        unterschrift_datum: new Date().toISOString()
      };

      const res = await fetch(`${config.apiBaseUrl}/verbandsmitgliedschaften/public/anmeldung`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setCurrentStep(5);
      } else {
        setError(data.error || 'Fehler bei der Anmeldung. Bitte versuchen Sie es erneut.');
      }
    } catch (err) {
      console.error('Fehler bei der Anmeldung:', err);
      setError('Netzwerkfehler. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  // Canvas Signature Methods
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  };

  useEffect(() => {
    if (currentStep === 4) {
      setTimeout(initCanvas, 100);
    }
  }, [currentStep]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCanvasCoords(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      setSignatureData(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    setSignatureData(null);
    initCanvas();
  };

  // ============================================================================
  // RENDER STEPS
  // ============================================================================

  const renderStep1 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>Mitgliedschaftstyp wählen</h2>
      <p style={styles.stepSubtitle}>Wählen Sie die Art der Mitgliedschaft</p>

      <div style={styles.typCards}>
        <div style={styles.typCard} onClick={() => selectTyp('dojo')}>
          <div style={styles.typIcon}><Building2 size={48} /></div>
          <h3 style={styles.typTitle}>Dojo-Mitgliedschaft</h3>
          <p style={styles.typPrice}>{einstellungen.preis_dojo || 99} € / Jahr</p>
          <p style={styles.typDesc}>Für Kampfkunstschulen und Vereine</p>
          <ul style={styles.typFeatures}>
            <li><Check size={16} /> Offizieller TDA-Dojo-Status</li>
            <li><Check size={16} /> Graduierungslizenzen</li>
            <li><Check size={16} /> Turnierveranstaltungen</li>
            <li><Check size={16} /> Seminare & Workshops</li>
          </ul>
          <button style={styles.typButton}>
            Dojo anmelden <ChevronRight size={20} />
          </button>
        </div>

        <div style={styles.typCard} onClick={() => selectTyp('einzel')}>
          <div style={styles.typIcon}><User size={48} /></div>
          <h3 style={styles.typTitle}>Einzelmitgliedschaft</h3>
          <p style={styles.typPrice}>{einstellungen.preis_einzel || 49} € / Jahr</p>
          <p style={styles.typDesc}>Für einzelne Kampfkünstler</p>
          <ul style={styles.typFeatures}>
            <li><Check size={16} /> Persönlicher Mitgliedsausweis</li>
            <li><Check size={16} /> Rabatte auf Seminare</li>
            <li><Check size={16} /> Turnierrabatte</li>
            <li><Check size={16} /> Newsletter & News</li>
          </ul>
          <button style={styles.typButton}>
            Jetzt anmelden <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {vorteile.length > 0 && (
        <div style={styles.vorteileSection}>
          <h3 style={styles.vorteileTitle}><Gift size={20} /> Mitglieder-Vorteile</h3>
          {/* Vorteile temporär ausgeblendet
          <div style={styles.vorteileGrid}>
            {vorteile.slice(0, 4).map((v, i) => (
              <div key={i} style={styles.vorteilCard}>
                <Percent size={24} color="#ffd700" />
                <span>{v.titel}</span>
                {v.rabatt_prozent && <strong>-{v.rabatt_prozent}%</strong>}
              </div>
            ))}
          </div>
          */}
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>
        {formData.typ === 'dojo' ? 'Dojo-Informationen' : 'Persönliche Daten'}
      </h2>
      <p style={styles.stepSubtitle}>Bitte füllen Sie alle Pflichtfelder aus</p>

      {formData.typ === 'dojo' ? (
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Dojo-Name *</label>
            <input
              type="text"
              name="dojo_name"
              value={formData.dojo_name}
              onChange={handleChange}
              style={styles.input}
              placeholder="z.B. Tiger Dojo München"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Inhaber / Schulleiter *</label>
            <input
              type="text"
              name="dojo_inhaber"
              value={formData.dojo_inhaber}
              onChange={handleChange}
              style={styles.input}
              placeholder="Vor- und Nachname"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>E-Mail *</label>
            <input
              type="email"
              name="dojo_email"
              value={formData.dojo_email}
              onChange={handleChange}
              style={styles.input}
              placeholder="dojo@beispiel.de"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Telefon</label>
            <input
              type="tel"
              name="dojo_telefon"
              value={formData.dojo_telefon}
              onChange={handleChange}
              style={styles.input}
              placeholder="+49 123 456789"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Straße</label>
            <input
              type="text"
              name="dojo_strasse"
              value={formData.dojo_strasse}
              onChange={handleChange}
              style={styles.input}
              placeholder="Musterstraße 123"
            />
          </div>
          <div style={styles.formGroupRow}>
            <div style={styles.formGroupSmall}>
              <label style={styles.label}>PLZ</label>
              <input
                type="text"
                name="dojo_plz"
                value={formData.dojo_plz}
                onChange={handleChange}
                style={styles.input}
                placeholder="12345"
              />
            </div>
            <div style={styles.formGroupLarge}>
              <label style={styles.label}>Ort</label>
              <input
                type="text"
                name="dojo_ort"
                value={formData.dojo_ort}
                onChange={handleChange}
                style={styles.input}
                placeholder="München"
              />
            </div>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Website</label>
            <input
              type="url"
              name="dojo_website"
              value={formData.dojo_website}
              onChange={handleChange}
              style={styles.input}
              placeholder="https://www.meindojo.de"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Ungefähre Mitgliederzahl</label>
            <input
              type="number"
              name="dojo_mitglieder_anzahl"
              value={formData.dojo_mitglieder_anzahl}
              onChange={handleChange}
              style={styles.input}
              placeholder="z.B. 50"
            />
          </div>
        </div>
      ) : (
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Vorname *</label>
            <input
              type="text"
              name="vorname"
              value={formData.vorname}
              onChange={handleChange}
              style={styles.input}
              placeholder="Max"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Nachname *</label>
            <input
              type="text"
              name="nachname"
              value={formData.nachname}
              onChange={handleChange}
              style={styles.input}
              placeholder="Mustermann"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>E-Mail *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              style={styles.input}
              placeholder="max@beispiel.de"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Telefon</label>
            <input
              type="tel"
              name="telefon"
              value={formData.telefon}
              onChange={handleChange}
              style={styles.input}
              placeholder="+49 123 456789"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Geburtsdatum</label>
            <input
              type="date"
              name="geburtsdatum"
              value={formData.geburtsdatum}
              onChange={handleChange}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Straße</label>
            <input
              type="text"
              name="strasse"
              value={formData.strasse}
              onChange={handleChange}
              style={styles.input}
              placeholder="Musterstraße 123"
            />
          </div>
          <div style={styles.formGroupRow}>
            <div style={styles.formGroupSmall}>
              <label style={styles.label}>PLZ</label>
              <input
                type="text"
                name="plz"
                value={formData.plz}
                onChange={handleChange}
                style={styles.input}
                placeholder="12345"
              />
            </div>
            <div style={styles.formGroupLarge}>
              <label style={styles.label}>Ort</label>
              <input
                type="text"
                name="ort"
                value={formData.ort}
                onChange={handleChange}
                style={styles.input}
                placeholder="München"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>Zahlungsinformationen</h2>
      <p style={styles.stepSubtitle}>Wählen Sie Ihre bevorzugte Zahlungsart</p>

      <div style={styles.zahlungsarten}>
        <label style={{
          ...styles.zahlungsartCard,
          borderColor: formData.zahlungsart === 'rechnung' ? '#ffd700' : 'rgba(255,255,255,0.1)'
        }}>
          <input
            type="radio"
            name="zahlungsart"
            value="rechnung"
            checked={formData.zahlungsart === 'rechnung'}
            onChange={handleChange}
            style={{ display: 'none' }}
          />
          <FileText size={32} color={formData.zahlungsart === 'rechnung' ? '#ffd700' : '#888'} />
          <span style={styles.zahlungsartTitle}>Rechnung</span>
          <span style={styles.zahlungsartDesc}>Zahlung per Überweisung</span>
        </label>

        <label style={{
          ...styles.zahlungsartCard,
          borderColor: formData.zahlungsart === 'lastschrift' ? '#ffd700' : 'rgba(255,255,255,0.1)'
        }}>
          <input
            type="radio"
            name="zahlungsart"
            value="lastschrift"
            checked={formData.zahlungsart === 'lastschrift'}
            onChange={handleChange}
            style={{ display: 'none' }}
          />
          <CreditCard size={32} color={formData.zahlungsart === 'lastschrift' ? '#ffd700' : '#888'} />
          <span style={styles.zahlungsartTitle}>SEPA-Lastschrift</span>
          <span style={styles.zahlungsartDesc}>Bequem & automatisch</span>
        </label>
      </div>

      {formData.zahlungsart === 'lastschrift' && (
        <div style={styles.sepaSection}>
          <h3 style={styles.sectionTitle}><CreditCard size={20} /> SEPA-Bankverbindung</h3>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Kontoinhaber *</label>
              <input
                type="text"
                name="kontoinhaber"
                value={formData.kontoinhaber}
                onChange={handleChange}
                style={styles.input}
                placeholder="Max Mustermann"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>IBAN *</label>
              <input
                type="text"
                name="iban"
                value={formData.iban}
                onChange={handleChange}
                style={styles.input}
                placeholder="DE89 3704 0044 0532 0130 00"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>BIC</label>
              <input
                type="text"
                name="bic"
                value={formData.bic}
                onChange={handleChange}
                style={styles.input}
                placeholder="COBADEFFXXX"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Bank</label>
              <input
                type="text"
                name="bank_name"
                value={formData.bank_name}
                onChange={handleChange}
                style={styles.input}
                placeholder="Commerzbank"
              />
            </div>
          </div>
        </div>
      )}

      <div style={styles.preisSummary}>
        <div style={styles.preisRow}>
          <span>{formData.typ === 'dojo' ? 'Dojo-Mitgliedschaft' : 'Einzelmitgliedschaft'}</span>
          <strong>{formData.typ === 'dojo' ? (einstellungen.preis_dojo || 99) : (einstellungen.preis_einzel || 49)} € / Jahr</strong>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div style={styles.stepContent}>
      <h2 style={styles.stepTitle}>Bestätigung & Unterschrift</h2>
      <p style={styles.stepSubtitle}>Bitte akzeptieren Sie die Bedingungen und unterschreiben Sie</p>

      <div style={styles.checkboxGroup}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="agb_accepted"
            checked={formData.agb_accepted}
            onChange={handleChange}
            style={styles.checkbox}
          />
          <span>Ich akzeptiere die <a href="#" style={styles.link}>Allgemeinen Geschäftsbedingungen</a> *</span>
        </label>

        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="dsgvo_accepted"
            checked={formData.dsgvo_accepted}
            onChange={handleChange}
            style={styles.checkbox}
          />
          <span>Ich akzeptiere die <a href="#" style={styles.link}>Datenschutzerklärung</a> *</span>
        </label>

        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="widerrufsrecht_acknowledged"
            checked={formData.widerrufsrecht_acknowledged}
            onChange={handleChange}
            style={styles.checkbox}
          />
          <span>Ich wurde über mein <a href="#" style={styles.link}>Widerrufsrecht</a> informiert *</span>
        </label>
      </div>

      <div style={styles.signatureSection}>
        <h3 style={styles.sectionTitle}><Shield size={20} /> Digitale Unterschrift</h3>
        <p style={styles.signatureHint}>Bitte unterschreiben Sie mit der Maus oder dem Finger im Feld unten</p>

        <div style={styles.canvasWrapper}>
          <canvas
            ref={canvasRef}
            width={460}
            height={150}
            style={styles.canvas}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {signatureData && (
            <div style={styles.signatureCheck}>
              <CheckCircle size={24} color="#10b981" />
            </div>
          )}
        </div>

        <button type="button" onClick={clearSignature} style={styles.clearButton}>
          <X size={16} /> Unterschrift löschen
        </button>
      </div>

      <div style={styles.summaryBox}>
        <h3 style={styles.summaryTitle}>Zusammenfassung</h3>
        <div style={styles.summaryRow}>
          <span>Mitgliedschaftstyp:</span>
          <strong>{formData.typ === 'dojo' ? 'Dojo-Mitgliedschaft' : 'Einzelmitgliedschaft'}</strong>
        </div>
        <div style={styles.summaryRow}>
          <span>{formData.typ === 'dojo' ? 'Dojo:' : 'Name:'}</span>
          <strong>{formData.typ === 'dojo' ? formData.dojo_name : `${formData.vorname} ${formData.nachname}`}</strong>
        </div>
        <div style={styles.summaryRow}>
          <span>E-Mail:</span>
          <strong>{formData.typ === 'dojo' ? formData.dojo_email : formData.email}</strong>
        </div>
        <div style={styles.summaryRow}>
          <span>Zahlungsart:</span>
          <strong>{formData.zahlungsart === 'lastschrift' ? 'SEPA-Lastschrift' : 'Rechnung'}</strong>
        </div>
        <div style={{ ...styles.summaryRow, ...styles.summaryTotal }}>
          <span>Jahresbeitrag:</span>
          <strong style={{ color: '#ffd700', fontSize: '1.2rem' }}>
            {formData.typ === 'dojo' ? (einstellungen.preis_dojo || 99) : (einstellungen.preis_einzel || 49)} €
          </strong>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div style={styles.successContent}>
      <div style={styles.successIcon}>
        <CheckCircle size={80} color="#10b981" />
      </div>
      <h2 style={styles.successTitle}>Anmeldung erfolgreich!</h2>
      <p style={styles.successText}>
        Vielen Dank für Ihre Anmeldung bei der Tiger & Dragon Association International.
      </p>
      <p style={styles.successText}>
        Sie erhalten in Kürze eine Bestätigungs-E-Mail mit allen weiteren Informationen
        an <strong>{formData.typ === 'dojo' ? formData.dojo_email : formData.email}</strong>.
      </p>
      <div style={styles.successActions}>
        <button onClick={() => navigate('/')} style={styles.primaryButton}>
          Zur Startseite
        </button>
      </div>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <img
          src="/api/dojo-logos/2/haupt"
          alt="TDA International"
          style={styles.logo}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <h1 style={styles.title}>Tiger & Dragon Association International</h1>
        <p style={styles.subtitle}>Verbandsmitgliedschaft</p>
      </div>

      {currentStep < 5 && (
        <div style={styles.progressBar}>
          {[1, 2, 3, 4].map(step => (
            <div key={step} style={{
              ...styles.progressStep,
              ...(currentStep >= step ? styles.progressStepActive : {})
            }}>
              {currentStep > step ? <Check size={16} /> : step}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div style={styles.content}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
      </div>

      {currentStep > 1 && currentStep < 5 && (
        <div style={styles.navigation}>
          <button onClick={prevStep} style={styles.secondaryButton}>
            <ChevronLeft size={20} /> Zurück
          </button>

          {currentStep < 4 ? (
            <button onClick={nextStep} style={styles.primaryButton}>
              Weiter <ChevronRight size={20} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} style={styles.primaryButton}>
              {loading ? <><Loader size={20} className="spin" /> Wird gesendet...</> : 'Anmeldung abschließen'}
            </button>
          )}
        </div>
      )}

      <div style={styles.footer}>
        <p>© 2026 Tiger & Dragon Association International</p>
      </div>
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 50%, #1a0a0a 100%)',
    color: '#fff',
    padding: '2rem',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem'
  },
  logo: {
    width: '120px',
    height: '120px',
    objectFit: 'contain',
    borderRadius: '50%',
    marginBottom: '1rem',
    border: '3px solid rgba(255, 215, 0, 0.5)',
    boxShadow: '0 0 30px rgba(255, 215, 0, 0.3)'
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: '700',
    color: '#ffd700',
    margin: '0 0 0.5rem 0'
  },
  subtitle: {
    fontSize: '1.1rem',
    color: 'rgba(255,255,255,0.7)',
    margin: 0
  },
  progressBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    marginBottom: '2rem'
  },
  progressStep: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    color: '#888',
    transition: 'all 0.3s'
  },
  progressStepActive: {
    background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
    color: '#000'
  },
  content: {
    maxWidth: '900px',
    margin: '0 auto',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '20px',
    padding: '2rem',
    border: '1px solid rgba(255,215,0,0.2)'
  },
  stepContent: {
    animation: 'fadeIn 0.3s ease'
  },
  stepTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    marginBottom: '0.5rem',
    color: '#fff'
  },
  stepSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '2rem'
  },
  typCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem'
  },
  typCard: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '16px',
    padding: '2rem',
    border: '1px solid rgba(255,215,0,0.2)',
    cursor: 'pointer',
    transition: 'all 0.3s',
    textAlign: 'center'
  },
  typIcon: {
    color: '#ffd700',
    marginBottom: '1rem'
  },
  typTitle: {
    fontSize: '1.3rem',
    fontWeight: '600',
    marginBottom: '0.5rem'
  },
  typPrice: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#ffd700',
    marginBottom: '0.5rem'
  },
  typDesc: {
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '1rem'
  },
  typFeatures: {
    listStyle: 'none',
    padding: 0,
    margin: '1rem 0',
    textAlign: 'left'
  },
  typButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '1rem',
    background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
    border: 'none',
    borderRadius: '10px',
    color: '#000',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '1rem'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem'
  },
  formGroup: {
    marginBottom: '0.5rem'
  },
  formGroupRow: {
    display: 'flex',
    gap: '1rem'
  },
  formGroupSmall: {
    flex: '0 0 100px'
  },
  formGroupLarge: {
    flex: 1
  },
  label: {
    display: 'block',
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '0.5rem'
  },
  input: {
    width: '100%',
    padding: '0.8rem 1rem',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '1rem',
    transition: 'border-color 0.3s'
  },
  zahlungsarten: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem'
  },
  zahlungsartCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1.5rem',
    background: 'rgba(0,0,0,0.3)',
    border: '2px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  zahlungsartTitle: {
    fontWeight: '600',
    fontSize: '1rem'
  },
  zahlungsartDesc: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.6)'
  },
  sepaSection: {
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem'
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1.1rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#ffd700'
  },
  preisSummary: {
    background: 'rgba(255,215,0,0.1)',
    borderRadius: '12px',
    padding: '1.5rem',
    border: '1px solid rgba(255,215,0,0.3)'
  },
  preisRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '1.1rem'
  },
  checkboxGroup: {
    marginBottom: '2rem'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    marginBottom: '1rem',
    cursor: 'pointer'
  },
  checkbox: {
    width: '20px',
    height: '20px',
    accentColor: '#ffd700',
    marginTop: '2px'
  },
  link: {
    color: '#ffd700',
    textDecoration: 'underline'
  },
  signatureSection: {
    marginBottom: '2rem'
  },
  signatureHint: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '1rem'
  },
  canvasWrapper: {
    position: 'relative',
    display: 'inline-block'
  },
  canvas: {
    border: '2px solid rgba(255,255,255,0.2)',
    borderRadius: '12px',
    background: '#fff',
    cursor: 'crosshair',
    touchAction: 'none',
    maxWidth: '100%'
  },
  signatureCheck: {
    position: 'absolute',
    top: '10px',
    right: '10px'
  },
  clearButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer'
  },
  summaryBox: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '12px',
    padding: '1.5rem'
  },
  summaryTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  },
  summaryTotal: {
    marginTop: '0.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid rgba(255,215,0,0.3)',
    borderBottom: 'none'
  },
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    maxWidth: '900px',
    margin: '2rem auto 0'
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem 2rem',
    background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
    border: 'none',
    borderRadius: '10px',
    color: '#000',
    fontWeight: '600',
    fontSize: '1rem',
    cursor: 'pointer'
  },
  secondaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem 2rem',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: '600',
    fontSize: '1rem',
    cursor: 'pointer'
  },
  successContent: {
    textAlign: 'center',
    padding: '2rem'
  },
  successIcon: {
    marginBottom: '1.5rem'
  },
  successTitle: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#10b981',
    marginBottom: '1rem'
  },
  successText: {
    fontSize: '1.1rem',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '1rem'
  },
  successActions: {
    marginTop: '2rem'
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    maxWidth: '900px',
    margin: '0 auto 1rem',
    padding: '1rem',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    borderRadius: '10px',
    color: '#fca5a5'
  },
  vorteileSection: {
    marginTop: '2rem',
    padding: '1.5rem',
    background: 'rgba(255,215,0,0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255,215,0,0.2)'
  },
  vorteileTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1.1rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#ffd700'
  },
  vorteileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem'
  },
  vorteilCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '8px'
  },
  footer: {
    textAlign: 'center',
    marginTop: '3rem',
    padding: '1.5rem',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.9rem'
  }
};

export default VerbandMitgliedWerden;
