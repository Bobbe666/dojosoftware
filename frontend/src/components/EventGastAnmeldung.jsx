import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import '../styles/EventGastAnmeldung.css';

const EventGastAnmeldung = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({ vorname: '', nachname: '', email: '', telefon: '', anzahl: 1, bemerkung: '' });
  const [teilnehmer, setTeilnehmer] = useState([{ vorname: '', nachname: '', kategorie: 'erwachsener' }]);
  const [bestellMengen, setBestellMengen] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const addTeilnehmer = () => setTeilnehmer(p => [...p, { vorname: '', nachname: '', kategorie: 'erwachsener' }]);
  const removeTeilnehmer = (i) => setTeilnehmer(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : p);
  const updateTeilnehmer = (i, feld, wert) => setTeilnehmer(p => p.map((t, idx) => idx === i ? { ...t, [feld]: wert } : t));

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`/api/events/${eventId}/oeffentlich`);
        setEvent(res.data);
        const mengen = {};
        (res.data.bestelloptionen || []).forEach(o => { mengen[o.option_id] = 0; });
        setBestellMengen(mengen);
      } catch (err) {
        setError('Event nicht gefunden oder nicht mehr verfügbar.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  const formatDatum = (d) => d ? new Date(d).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '';

  const bestellSumme = event?.bestelloptionen?.reduce((sum, opt) => sum + (bestellMengen[opt.option_id] || 0) * parseFloat(opt.preis), 0) || 0;
  const preisErwachsener = parseFloat(event?.teilnahmegebuehr || 0);
  const preisKind = (event?.preis_kind != null && event?.preis_kind !== '') ? parseFloat(event.preis_kind) : preisErwachsener;
  const preisFor = (k) => k === 'kind' ? preisKind : preisErwachsener;
  const teilnahmeSumme = teilnehmer.reduce((s, t) => s + preisFor(t.kategorie), 0);
  const gesamtbetrag = teilnahmeSumme + bestellSumme;
  const hatTeilnahmegebuehr = preisErwachsener > 0 || preisKind > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const bestellungen = Object.entries(bestellMengen)
        .filter(([, menge]) => menge > 0)
        .map(([option_id, menge]) => ({ option_id: parseInt(option_id), menge }));

      const gueltigeTeilnehmer = teilnehmer
        .filter(t => t.vorname.trim() || t.nachname.trim())
        .map(t => ({ vorname: t.vorname.trim(), nachname: t.nachname.trim(), kategorie: t.kategorie }));

      // Kontaktname: eingegeben, sonst erster Teilnehmer
      const kontaktVorname = form.vorname.trim() || gueltigeTeilnehmer[0]?.vorname || 'Gast';
      const kontaktNachname = form.nachname.trim() || gueltigeTeilnehmer[0]?.nachname || '–';

      await axios.post(`/api/events/${eventId}/gast-anmelden`, {
        ...form,
        vorname: kontaktVorname,
        nachname: kontaktNachname,
        anzahl: gueltigeTeilnehmer.length || 1,
        teilnehmer: gueltigeTeilnehmer,
        bestellungen
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler bei der Anmeldung. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="ega-page"><div className="ega-card ega-card--center">Lade Event...</div></div>;
  if (error && !event) return <div className="ega-page"><div className="ega-card ega-card--center ega-card--error">{error}</div></div>;

  if (success) return (
    <div className="ega-page">
      <div className="ega-card ega-card--center">
        <div className="u-emoji-xl">✅</div>
        <h2 className="u-text-primary u-mb-05">Anmeldung erfolgreich!</h2>
        <p className="u-text-secondary">Du bist als Gast für <strong className="u-text-primary">{event.titel}</strong> angemeldet.</p>
      </div>
    </div>
  );

  return (
    <div className="ega-page">
      <div className="ega-card">
        <div className="ega-event-header">
          <div className="ega-event-emoji">🎟️</div>
          <h1 className="ega-event-title">{event.titel}</h1>
          <div className="ega-event-meta">
            📅 {formatDatum(event.datum)}
            {event.uhrzeit_beginn && ` · ${event.uhrzeit_beginn.substring(0, 5)}`}
            {event.ort && ` · 📍 ${event.ort}`}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ega-grid-2">
            <div className="ega-group">
              <label className="ega-label">Vorname</label>
              <input className="ega-input" value={form.vorname} onChange={e => setForm({ ...form, vorname: e.target.value })} />
            </div>
            <div className="ega-group">
              <label className="ega-label">Nachname</label>
              <input className="ega-input" value={form.nachname} onChange={e => setForm({ ...form, nachname: e.target.value })} />
            </div>
          </div>

          <div className="ega-group">
            <label className="ega-label">E-Mail</label>
            <input className="ega-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="ega-group">
            <label className="ega-label">Telefon</label>
            <input className="ega-input" value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} />
          </div>

          <div className="ega-order-box">
            <div className="ega-order-title">👥 Teilnehmer</div>
            {teilnehmer.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '10px', flexWrap: 'wrap' }}>
                <div className="ega-group" style={{ flex: '1 1 120px', margin: 0 }}>
                  {i === 0 && <label className="ega-label">Vorname</label>}
                  <input className="ega-input" placeholder="Vorname" value={t.vorname}
                    onChange={e => updateTeilnehmer(i, 'vorname', e.target.value)} />
                </div>
                <div className="ega-group" style={{ flex: '1 1 120px', margin: 0 }}>
                  {i === 0 && <label className="ega-label">Nachname</label>}
                  <input className="ega-input" placeholder="Nachname" value={t.nachname}
                    onChange={e => updateTeilnehmer(i, 'nachname', e.target.value)} />
                </div>
                <div className="ega-group" style={{ flex: '0 1 140px', margin: 0 }}>
                  {i === 0 && <label className="ega-label">Kategorie</label>}
                  <select className="ega-input" value={t.kategorie} onChange={e => updateTeilnehmer(i, 'kategorie', e.target.value)}>
                    <option value="erwachsener">Erwachsener{preisErwachsener > 0 ? ` · ${preisErwachsener.toFixed(2)} €` : ''}</option>
                    <option value="kind">Kind{preisKind > 0 ? ` · ${preisKind.toFixed(2)} €` : ''}</option>
                  </select>
                </div>
                {teilnehmer.length > 1 && (
                  <button type="button" onClick={() => removeTeilnehmer(i)} className="ega-qty-btn"
                    title="Person entfernen" style={{ flex: '0 0 auto' }}>✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addTeilnehmer} className="ega-qty-btn"
              style={{ width: 'auto', padding: '8px 14px', borderRadius: '8px' }}>+ Person hinzufügen</button>
            {hatTeilnahmegebuehr && teilnahmeSumme > 0 && (
              <div className="ega-order-total">
                <span>Teilnahmegebühr:</span><span className="u-text-accent">{teilnahmeSumme.toFixed(2)} €</span>
              </div>
            )}
          </div>

          {event.bestelloptionen?.length > 0 && (
            <div className="ega-order-box">
              <div className="ega-order-title">🍽️ Bestellung</div>
              {event.bestelloptionen.map(opt => (
                <div key={opt.option_id} className="ega-order-row">
                  <span className="ega-order-item-name">{opt.name} <span className="ega-order-item-price">{parseFloat(opt.preis).toFixed(2)} €/{opt.einheit}</span></span>
                  <div className="u-flex-row-sm">
                    <button type="button" onClick={() => setBestellMengen(p => ({ ...p, [opt.option_id]: Math.max(0, (p[opt.option_id] || 0) - 1) }))}
                      className="ega-qty-btn">−</button>
                    <span className="ega-qty-value">{bestellMengen[opt.option_id] || 0}</span>
                    <button type="button" onClick={() => setBestellMengen(p => ({ ...p, [opt.option_id]: (p[opt.option_id] || 0) + 1 }))}
                      className="ega-qty-btn">+</button>
                  </div>
                </div>
              ))}
              {bestellSumme > 0 && (
                <div className="ega-order-total">
                  <span>Bestellung:</span><span className="u-text-accent">{bestellSumme.toFixed(2)} €</span>
                </div>
              )}
            </div>
          )}

          <div className="ega-group">
            <label className="ega-label">Bemerkung (optional)</label>
            <textarea className="ega-input ega-input--textarea" rows="2" value={form.bemerkung} onChange={e => setForm({ ...form, bemerkung: e.target.value })} />
          </div>

          {gesamtbetrag > 0 && (
            <div className="ega-order-total" style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '8px' }}>
              <span>Gesamt:</span><span className="u-text-accent">{gesamtbetrag.toFixed(2)} €</span>
            </div>
          )}

          {error && <div className="ega-error-box">{error}</div>}

          <button type="submit" className="ega-submit-btn" disabled={submitting}>
            {submitting ? 'Wird angemeldet...' : '🎟️ Als Gast anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EventGastAnmeldung;
