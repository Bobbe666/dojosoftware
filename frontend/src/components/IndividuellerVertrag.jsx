import React, { useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import axios from 'axios';
import config from '../config/config.js';
import '../styles/IndividuellerVertrag.css';

const IndividuellerVertrag = () => {
  const { isAdmin } = useAuthContext();
  const [neuerTarif, setNeuerTarif] = useState({
    name: '',
    duration_months: '',
    mindestlaufzeit_monate: '',
    kuendigungsfrist_monate: '',
    price_cents: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Nur für Admins anzeigen
  if (!isAdmin()) {
    return null;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNeuerTarif(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    // Validierung
    if (!neuerTarif.name || !neuerTarif.duration_months || !neuerTarif.mindestlaufzeit_monate ||
        !neuerTarif.kuendigungsfrist_monate || !neuerTarif.price_cents) {
      setMessage({ text: 'Bitte alle Felder ausfüllen', type: 'error' });
      setLoading(false);
      return;
    }

    try {
      // Preis in Cent umrechnen (wenn in Euro eingegeben)
      const priceCents = Math.round(parseFloat(neuerTarif.price_cents) * 100);

      const response = await axios.post(`${config.apiBaseUrl}/tarife`, {
        name: neuerTarif.name,
        duration_months: parseInt(neuerTarif.duration_months),
        mindestlaufzeit_monate: parseInt(neuerTarif.mindestlaufzeit_monate),
        kuendigungsfrist_monate: parseInt(neuerTarif.kuendigungsfrist_monate),
        price_cents: priceCents,
        currency: 'EUR',
        billing_cycle: 'MONTHLY',
        payment_method: 'SEPA',
        active: true
      });

      if (response.data.success) {
        setMessage({ text: 'Individueller Tarif erfolgreich erstellt!', type: 'success' });
        // Formular zurücksetzen
        setNeuerTarif({
          name: '',
          duration_months: '',
          mindestlaufzeit_monate: '',
          kuendigungsfrist_monate: '',
          price_cents: ''
        });
      }
    } catch (error) {
      console.error('Fehler beim Erstellen des Tarifs:', error);
      setMessage({
        text: `Fehler: ${error.response?.data?.error || error.message}`,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="individueller-vertrag-container">
      <div className="page-header">
        <h1 className="page-title">Individuellen Tarif erstellen</h1>
        <p className="page-subtitle">Nur für Administratoren sichtbar</p>
      </div>

      <div className="vertrag-card">
        <form onSubmit={handleSubmit} className="vertrag-form">
          <div className="form-group">
            <label htmlFor="name">Vertragsname:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={neuerTarif.name}
              onChange={handleChange}
              placeholder="z.B. Individualtarif Max Mustermann"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="duration_months">Laufzeit (Monate):</label>
            <input
              type="number"
              id="duration_months"
              name="duration_months"
              value={neuerTarif.duration_months}
              onChange={handleChange}
              placeholder="z.B. 12"
              min="1"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="mindestlaufzeit_monate">Vertragsdauer (Monate):</label>
            <input
              type="number"
              id="mindestlaufzeit_monate"
              name="mindestlaufzeit_monate"
              value={neuerTarif.mindestlaufzeit_monate}
              onChange={handleChange}
              placeholder="z.B. 12"
              min="1"
              className="form-input"
            />
            <small className="form-hint">Mindestlaufzeit des Vertrags</small>
          </div>

          <div className="form-group">
            <label htmlFor="kuendigungsfrist_monate">Kündigungsfrist (Monate):</label>
            <input
              type="number"
              id="kuendigungsfrist_monate"
              name="kuendigungsfrist_monate"
              value={neuerTarif.kuendigungsfrist_monate}
              onChange={handleChange}
              placeholder="z.B. 3"
              min="0"
              className="form-input"
            />
            <small className="form-hint">Frist zur Kündigung vor Vertragsende</small>
          </div>

          <div className="form-group">
            <label htmlFor="price_cents">Monatlicher Beitrag (EUR):</label>
            <input
              type="number"
              id="price_cents"
              name="price_cents"
              value={neuerTarif.price_cents}
              onChange={handleChange}
              placeholder="z.B. 49.90"
              step="0.01"
              min="0"
              className="form-input"
            />
            <small className="form-hint">Wird automatisch in Cent umgerechnet</small>
          </div>

          {message.text && (
            <div className={`message message-${message.type}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Erstelle Tarif...' : 'Tarif erstellen'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default IndividuellerVertrag;
