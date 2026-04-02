import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import '../../styles/PublicShop.css';

const STATUS_LABELS = {
  offen: 'Eingegangen',
  in_bearbeitung: 'In Bearbeitung',
  versendet: 'Versendet',
  abgeschlossen: 'Abgeschlossen',
  storniert: 'Storniert'
};

export default function PublicShopBestaetigung() {
  const { dojoId, bestellnummer } = useParams();
  const [bestellung, setBestellung] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`/shop/public/bestellung/${bestellnummer}`)
      .then(r => setBestellung(r.data))
      .catch(() => setError('Bestellung nicht gefunden'))
      .finally(() => setLoading(false));
  }, [bestellnummer]);

  const formatEur = (cent) => `${((cent || 0) / 100).toFixed(2)} €`;
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

  if (loading) return <div className="public-shop-loading"><div className="public-shop-spinner" /></div>;

  if (error) return (
    <div className="public-shop public-shop-warenkorb-empty">
      <h2>Bestellung nicht gefunden</h2>
      <p>{error}</p>
      <Link to={`/shop/${dojoId}`} className="public-shop-btn-primary">Zum Shop</Link>
    </div>
  );

  return (
    <div className="public-shop">
      <div className="public-shop-bestaetigung">
        <div className="public-shop-bestaetigung-icon">✅</div>
        <h1>Vielen Dank für deine Bestellung!</h1>
        <p className="public-shop-bestaetigung-nr">
          Bestellnummer: <strong>{bestellung.bestellnummer}</strong>
        </p>
        <p className="public-shop-bestaetigung-email">
          Eine Bestätigung wird an <strong>{bestellung.kunde_email}</strong> geschickt.
        </p>

        <div className="public-shop-bestaetigung-status">
          <span className={`public-shop-status-pill public-shop-status-${bestellung.status}`}>
            {STATUS_LABELS[bestellung.status] || bestellung.status}
          </span>
          {bestellung.bezahlt ? (
            <span className="public-shop-status-pill public-shop-status-bezahlt">✅ Bezahlt</span>
          ) : (
            <span className="public-shop-status-pill public-shop-status-ausstehend">⏳ Zahlung ausstehend</span>
          )}
        </div>

        {/* Artikel-Übersicht */}
        <div className="public-shop-bestaetigung-box">
          <h3>Bestellte Artikel</h3>
          {bestellung.positionen?.map((pos, i) => (
            <div key={i} className="public-shop-bestaetigung-item">
              <span>{pos.menge}× {pos.produkt_name}</span>
              {pos.produkt_variante && <span className="muted"> ({pos.produkt_variante})</span>}
              <span>{formatEur(pos.gesamtpreis_cent)}</span>
            </div>
          ))}
          <div className="public-shop-bestaetigung-total">
            <span>Versandkosten</span>
            <span>{bestellung.versandkosten_cent === 0 ? 'Kostenlos' : formatEur(bestellung.versandkosten_cent)}</span>
          </div>
          <div className="public-shop-bestaetigung-total public-shop-bestaetigung-total--gesamt">
            <strong>Gesamt</strong>
            <strong>{formatEur(bestellung.gesamtbetrag_cent)}</strong>
          </div>
        </div>

        {/* Lieferadresse */}
        <div className="public-shop-bestaetigung-box">
          <h3>Lieferadresse</h3>
          <p>
            {bestellung.kunde_name}<br />
            {bestellung.lieferadresse_strasse}<br />
            {bestellung.lieferadresse_plz} {bestellung.lieferadresse_ort}<br />
            {bestellung.lieferadresse_land}
          </p>
        </div>

        {/* Tracking */}
        {bestellung.tracking_nummer && (
          <div className="public-shop-bestaetigung-box">
            <h3>🚚 Versandinfo</h3>
            <p>
              {bestellung.versand_dienstleister && `${bestellung.versand_dienstleister}: `}
              <strong>{bestellung.tracking_nummer}</strong>
            </p>
          </div>
        )}

        {/* Rechnungshinweis */}
        {!bestellung.bezahlt && bestellung.zahlungsart === 'rechnung' && (
          <div className="public-shop-bestaetigung-hinweis">
            📄 <strong>Zahlung auf Rechnung:</strong> Du erhältst eine Rechnung per E-Mail. Bitte überweise den Betrag innerhalb von 14 Tagen.
          </div>
        )}

        <p className="public-shop-bestaetigung-date">Bestellt am {formatDate(bestellung.bestellt_am)}</p>

        <Link to={`/shop/${dojoId}`} className="public-shop-btn-primary" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
          Weiter einkaufen
        </Link>
      </div>
    </div>
  );
}
