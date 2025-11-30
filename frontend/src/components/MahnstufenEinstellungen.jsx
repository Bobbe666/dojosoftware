import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  AlertCircle,
  DollarSign,
  Calendar,
  Mail,
  FileText,
  Settings,
  ChevronDown,
  Plus,
  Trash2
} from "lucide-react";
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/MahnstufenEinstellungen.css";

const MahnstufenEinstellungen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [mahnstufen, setMahnstufen] = useState([
    {
      stufe: 1,
      bezeichnung: "1. Mahnung (Zahlungserinnerung)",
      tage_nach_faelligkeit: 14,
      mahngebuehr: 5.00,
      email_betreff: "Zahlungserinnerung - Offener Beitrag",
      email_text: "Sehr geehrte/r {vorname} {nachname},\n\nwir möchten Sie freundlich daran erinnern, dass folgender Beitrag noch offen ist:\n\nBetrag: {betrag} €\nFällig seit: {faelligkeitsdatum}\n\nBitte überweisen Sie den Betrag zeitnah auf unser Konto.\n\nMit freundlichen Grüßen\nIhr Dojo-Team",
      aktiv: true
    },
    {
      stufe: 2,
      bezeichnung: "2. Mahnung (Erste Mahnung)",
      tage_nach_faelligkeit: 28,
      mahngebuehr: 10.00,
      email_betreff: "2. Mahnung - Dringend: Offener Beitrag",
      email_text: "Sehr geehrte/r {vorname} {nachname},\n\nleider haben wir bisher keine Zahlung erhalten. Dies ist Ihre 2. Mahnung.\n\nBetrag: {betrag} €\nFällig seit: {faelligkeitsdatum}\nMahngebühr: {mahngebuehr} €\nGesamtbetrag: {gesamtbetrag} €\n\nBitte begleichen Sie den Betrag umgehend.\n\nMit freundlichen Grüßen\nIhr Dojo-Team",
      aktiv: true
    },
    {
      stufe: 3,
      bezeichnung: "3. Mahnung (Letzte Mahnung)",
      tage_nach_faelligkeit: 42,
      mahngebuehr: 15.00,
      email_betreff: "3. Mahnung - LETZTE ZAHLUNGSAUFFORDERUNG",
      email_text: "Sehr geehrte/r {vorname} {nachname},\n\ntrotz mehrfacher Aufforderung ist der fällige Betrag noch nicht eingegangen. Dies ist unsere letzte Mahnung vor rechtlichen Schritten.\n\nBetrag: {betrag} €\nFällig seit: {faelligkeitsdatum}\nMahngebühr: {mahngebuehr} €\nGesamtbetrag: {gesamtbetrag} €\n\nBitte zahlen Sie SOFORT, um weitere Maßnahmen zu vermeiden.\n\nMit freundlichen Grüßen\nIhr Dojo-Team",
      aktiv: true
    }
  ]);

  useEffect(() => {
    loadMahnstufenEinstellungen();
  }, []);

  const loadMahnstufenEinstellungen = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/mahnwesen/mahnstufen-einstellungen`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.length > 0) {
          setMahnstufen(data.data);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Mahnstufen-Einstellungen:', error);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!window.confirm('Mahnstufen-Einstellungen speichern?')) {
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`${config.apiBaseUrl}/mahnwesen/mahnstufen-einstellungen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mahnstufen })
      });

      if (!response.ok) {
        throw new Error('Fehler beim Speichern');
      }

      alert('Mahnstufen-Einstellungen erfolgreich gespeichert!');
      setSaving(false);
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern der Einstellungen');
      setSaving(false);
    }
  };

  const handleMahnstufenChange = (index, field, value) => {
    const newMahnstufen = [...mahnstufen];
    newMahnstufen[index][field] = value;
    setMahnstufen(newMahnstufen);
  };

  const toggleSection = (stufe) => {
    setCollapsedSections(prev => ({
      ...prev,
      [stufe]: !prev[stufe]
    }));
  };

  const handleAddMahnstufe = () => {
    const nextStufe = mahnstufen.length + 1;
    const newMahnstufe = {
      stufe: nextStufe,
      bezeichnung: `${nextStufe}. Mahnung`,
      tage_nach_faelligkeit: nextStufe * 14,
      mahngebuehr: nextStufe * 5.00,
      email_betreff: `${nextStufe}. Mahnung`,
      email_text: "Sehr geehrte/r {vorname} {nachname},\n\n...\n\nMit freundlichen Grüßen\nIhr Dojo-Team",
      aktiv: true
    };
    setMahnstufen([...mahnstufen, newMahnstufe]);
  };

  const handleDeleteMahnstufe = (index) => {
    if (!window.confirm('Mahnstufe wirklich löschen?')) {
      return;
    }
    const newMahnstufen = mahnstufen.filter((_, i) => i !== index);
    // Aktualisiere stufe-Nummern
    newMahnstufen.forEach((m, i) => {
      m.stufe = i + 1;
    });
    setMahnstufen(newMahnstufen);
  };

  if (loading) {
    return (
      <div className="mahnstufen-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Mahnstufen-Einstellungen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mahnstufen-container">
      {/* Header */}
      <div className="mahnstufen-header">
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/beitraege')}>
          <ArrowLeft size={20} />
          Zurück
        </button>
        <div>
          <h1>⚙️ Mahnstufen-Einstellungen</h1>
          <p>Konfiguriere die automatischen Mahnprozesse und Gebühren</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-success"
            onClick={handleAddMahnstufe}
          >
            <Plus size={20} />
            Mahnstufe hinzufügen
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={20} />
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="info-box">
        <AlertCircle size={24} />
        <div>
          <h3>Verfügbare Platzhalter für Email-Texte:</h3>
          <p>
            <strong>{'{vorname}'}</strong> - Vorname des Mitglieds |
            <strong>{' {nachname}'}</strong> - Nachname |
            <strong>{' {betrag}'}</strong> - Offener Betrag |
            <strong>{' {faelligkeitsdatum}'}</strong> - Fälligkeitsdatum |
            <strong>{' {mahngebuehr}'}</strong> - Mahngebühr |
            <strong>{' {gesamtbetrag}'}</strong> - Gesamt (Betrag + Gebühr)
          </p>
        </div>
      </div>

      {/* Mahnstufen */}
      {mahnstufen.map((mahnstufe, index) => (
        <div key={mahnstufe.stufe} className="mahnstufe-card">
          <div
            className="mahnstufe-header collapsible"
            onClick={() => toggleSection(mahnstufe.stufe)}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ transform: collapsedSections[mahnstufe.stufe] ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                <ChevronDown size={20} />
              </span>
              <h2>
                <FileText size={20} />
                Mahnstufe {mahnstufe.stufe} - {mahnstufe.bezeichnung}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }} onClick={(e) => e.stopPropagation()}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={mahnstufe.aktiv}
                  onChange={(e) => handleMahnstufenChange(index, 'aktiv', e.target.checked)}
                />
                Aktiv
              </label>
              <button
                className="btn btn-danger btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteMahnstufe(index);
                }}
                title="Mahnstufe löschen"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {!collapsedSections[mahnstufe.stufe] && (
          <div className="form-grid">
            {/* Bezeichnung */}
            <div className="form-group full-width">
              <label>
                <Settings size={16} />
                Bezeichnung
              </label>
              <input
                type="text"
                value={mahnstufe.bezeichnung}
                onChange={(e) => handleMahnstufenChange(index, 'bezeichnung', e.target.value)}
                placeholder="z.B. 1. Mahnung (Zahlungserinnerung)"
              />
            </div>

            {/* Tage nach Fälligkeit */}
            <div className="form-group">
              <label>
                <Calendar size={16} />
                Tage nach Fälligkeit
              </label>
              <input
                type="number"
                value={mahnstufe.tage_nach_faelligkeit}
                onChange={(e) => handleMahnstufenChange(index, 'tage_nach_faelligkeit', parseInt(e.target.value))}
                min="1"
                placeholder="14"
              />
              <small>Nach wie vielen Tagen die Mahnung erstellt wird</small>
            </div>

            {/* Mahngebühr */}
            <div className="form-group">
              <label>
                <DollarSign size={16} />
                Mahngebühr (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={mahnstufe.mahngebuehr}
                onChange={(e) => handleMahnstufenChange(index, 'mahngebuehr', parseFloat(e.target.value))}
                min="0"
                placeholder="5.00"
              />
              <small>Gebühr für diese Mahnstufe</small>
            </div>

            {/* Email Betreff */}
            <div className="form-group full-width">
              <label>
                <Mail size={16} />
                Email-Betreff
              </label>
              <input
                type="text"
                value={mahnstufe.email_betreff}
                onChange={(e) => handleMahnstufenChange(index, 'email_betreff', e.target.value)}
                placeholder="Zahlungserinnerung - Offener Beitrag"
              />
            </div>

            {/* Email Text */}
            <div className="form-group full-width">
              <label>
                <FileText size={16} />
                Email-Text
              </label>
              <textarea
                value={mahnstufe.email_text}
                onChange={(e) => handleMahnstufenChange(index, 'email_text', e.target.value)}
                rows="10"
                placeholder="Text der Email-Mahnung..."
              />
            </div>
          </div>
          )}
        </div>
      ))}

      {/* Save Button unten */}
      <div className="save-footer">
        <button
          className="btn btn-primary btn-large"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={20} />
          {saving ? 'Speichere Einstellungen...' : 'Alle Einstellungen speichern'}
        </button>
      </div>
    </div>
  );
};

export default MahnstufenEinstellungen;
