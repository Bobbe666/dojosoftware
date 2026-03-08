/**
 * AbsenderProfileModal.jsx
 * =========================
 * Modal zum Erstellen und Bearbeiten von Absender-Profilen (Briefköpfe).
 * Typ: Dojo (Dunkelrot), Verband (Gold), Lizenzen (Gold).
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Building2, Phone, Globe, CreditCard, Palette, Download } from 'lucide-react';
import './AbsenderProfileModal.css';

const LEER = {
  typ: 'dojo',
  name: '',
  organisation: '',
  inhaber: '',
  strasse: '',
  hausnummer: '',
  plz: '',
  ort: '',
  land: 'Deutschland',
  telefon: '',
  email: '',
  internet: '',
  bank_name: '',
  bank_iban: '',
  bank_bic: '',
  bank_inhaber: '',
  logo_url: '',
  farbe_primaer: '#8B0000',
};

const TYP_FARBEN = { dojo: '#8B0000', verband: '#c9a227', lizenzen: '#c9a227' };

export default function AbsenderProfileModal({ profil = null, onClose, onSaved }) {
  const [form, setForm] = useState(profil ? { ...profil } : { ...LEER });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Farbe automatisch setzen wenn Typ wechselt und Farbe noch dem alten Typ entspricht
  function handleTypChange(neuerTyp) {
    setForm(f => {
      const farbeUnveraendert = Object.values(TYP_FARBEN).includes(f.farbe_primaer);
      return {
        ...f,
        typ: neuerTyp,
        farbe_primaer: farbeUnveraendert ? TYP_FARBEN[neuerTyp] : f.farbe_primaer,
      };
    });
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function ausDojo() {
    try {
      const res = await axios.post('/absender-profile/aus-dojo-einstellungen', { typ: form.typ });
      if (res.data.success) {
        onSaved && onSaved();
        onClose();
      }
    } catch (err) {
      setError('Fehler beim Laden der Dojo-Einstellungen');
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name ist Pflichtfeld'); return; }
    setSaving(true);
    setError('');
    try {
      if (profil?.id) {
        await axios.put(`/absender-profile/${profil.id}`, form);
      } else {
        await axios.post('/absender-profile', form);
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  const primaryColor = form.farbe_primaer || '#8B0000';

  return (
    <div className="apm-overlay">
      <div className="apm-card" style={{ '--pc': primaryColor, '--pc44': `${primaryColor}44` }}>
        {/* Header */}
        <div className="apm-header">
          <div className="apm-header-title">
            <Building2 size={18} />
            {profil?.id ? 'Absender-Profil bearbeiten' : 'Neues Absender-Profil'}
          </div>
          <button onClick={onClose} className="apm-close-btn">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="apm-body">

          {error && (
            <div className="apm-error">
              {error}
            </div>
          )}

          {/* Typ */}
          <div>
            <label className="apm-label">Kontext / Typ</label>
            <div className="apm-typ-row">
              {[
                { value: 'dojo', label: 'Dojo', farbe: '#8B0000' },
                { value: 'verband', label: 'Verband', farbe: '#c9a227' },
                { value: 'lizenzen', label: 'Lizenzen', farbe: '#c9a227' },
              ].map(({ value, label, farbe }) => (
                <label key={value}
                  className={`apm-typ-opt-label${form.typ === value ? ' apm-typ-opt-label--active' : ''}`}
                  style={{ '--typ-farbe': farbe }}
                >
                  <input type="radio" name="typ" value={value} checked={form.typ === value}
                    onChange={() => handleTypChange(value)} className="u-hidden" />
                  <span className="apm-color-dot" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Name + Organisation */}
          <div className="apm-grid-2">
            <div>
              <label className="apm-label">Profilname <span className="u-text-error">*</span></label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="z.B. Kampfkunstschule Schreiner"
                className="apm-input" />
            </div>
            <div>
              <label className="apm-label">Organisation (offiziell)</label>
              <input name="organisation" value={form.organisation || ''} onChange={handleChange} placeholder="Offizieller Organisationsname"
                className="apm-input" />
            </div>
          </div>

          {/* Inhaber */}
          <div>
            <label className="apm-label">Inhaber / Unterzeichner (für Signatur)</label>
            <input name="inhaber" value={form.inhaber || ''} onChange={handleChange} placeholder="Sascha Schreiner"
              className="apm-input" />
          </div>

          {/* Adresse */}
          <div>
            <label className="apm-label apm-label--icon">
              <Building2 size={13} /> Adresse
            </label>
            <div className="apm-grid-strasse">
              <input name="strasse" value={form.strasse || ''} onChange={handleChange} placeholder="Straße"
                className="apm-input" />
              <input name="hausnummer" value={form.hausnummer || ''} onChange={handleChange} placeholder="Nr."
                className="apm-input" />
            </div>
            <div className="apm-grid-plz">
              <input name="plz" value={form.plz || ''} onChange={handleChange} placeholder="PLZ"
                className="apm-input" />
              <input name="ort" value={form.ort || ''} onChange={handleChange} placeholder="Ort"
                className="apm-input" />
              <input name="land" value={form.land || ''} onChange={handleChange} placeholder="Land"
                className="apm-input" />
            </div>
          </div>

          {/* Kontakt */}
          <div>
            <label className="apm-label apm-label--icon">
              <Phone size={13} /> Kontakt
            </label>
            <div className="apm-grid-kontakt">
              <input name="telefon" value={form.telefon || ''} onChange={handleChange} placeholder="Telefon"
                className="apm-input" />
              <input name="email" value={form.email || ''} onChange={handleChange} placeholder="E-Mail" type="email"
                className="apm-input" />
            </div>
            <div className="apm-internet-row">
              <Globe size={14} className="apm-globe-icon" />
              <input name="internet" value={form.internet || ''} onChange={handleChange} placeholder="Webseite (www.meinedojo.de)"
                className="apm-input apm-input--flex" />
            </div>
          </div>

          {/* Bankdaten */}
          <div>
            <label className="apm-label apm-label--icon">
              <CreditCard size={13} /> Bankverbindung
            </label>
            <div className="apm-grid-bank-top">
              <input name="bank_name" value={form.bank_name || ''} onChange={handleChange} placeholder="Bank (z.B. Sparkasse)"
                className="apm-input" />
              <input name="bank_inhaber" value={form.bank_inhaber || ''} onChange={handleChange} placeholder="Kontoinhaber"
                className="apm-input" />
            </div>
            <div className="apm-grid-bank-bottom">
              <input name="bank_iban" value={form.bank_iban || ''} onChange={handleChange} placeholder="IBAN (DE12 3456 ...)"
                className="apm-input apm-input--mono" />
              <input name="bank_bic" value={form.bank_bic || ''} onChange={handleChange} placeholder="BIC"
                className="apm-input apm-input--mono" />
            </div>
          </div>

          {/* Farbe */}
          <div>
            <label className="apm-label apm-label--icon">
              <Palette size={13} /> Briefkopf-Primärfarbe
            </label>
            <div className="u-flex-row-lg">
              <input type="color" name="farbe_primaer" value={form.farbe_primaer || '#8B0000'}
                onChange={handleChange}
                className="apm-color-picker" />
              <input name="farbe_primaer" value={form.farbe_primaer || '#8B0000'}
                onChange={handleChange}
                placeholder="#8B0000"
                className="apm-input apm-input--mono apm-input--narrow" />
              <div className="u-flex-gap-sm">
                {['#8B0000', '#c9a227', '#1a5276', '#1e8449', '#424242'].map(f => (
                  <button key={f} onClick={() => setForm(p => ({ ...p, farbe_primaer: f }))}
                    className={`apm-swatch-btn${form.farbe_primaer === f ? ' apm-swatch-btn--active' : ''}`}
                    style={{ '--swatch-bg': f }} />
                ))}
              </div>
            </div>
            {/* Vorschau */}
            <div className="apm-color-preview">
              <div className="apm-color-preview-bar" />
              <div className="apm-color-preview-label">
                Briefkopf-Vorschau: {form.name || 'Profilname'} · {form.ort || 'Ort'}
              </div>
            </div>
          </div>

          {/* Auto-Befüllen aus Dojo */}
          {!profil?.id && (
            <div className="apm-autofill-banner">
              <span className="apm-autofill-text">
                Kontaktdaten aus den Dojo-Einstellungen automatisch befüllen?
              </span>
              <button onClick={ausDojo} className="apm-btn-autofill">
                <Download size={14} /> Aus Einstellungen laden
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="apm-footer">
          <button onClick={onClose} className="apm-btn-cancel">Abbrechen</button>
          <button onClick={handleSave} disabled={saving} className="apm-btn-save">
            {saving ? 'Speichern...' : (profil?.id ? 'Änderungen speichern' : 'Profil anlegen')}
          </button>
        </div>
      </div>
    </div>
  );
}
