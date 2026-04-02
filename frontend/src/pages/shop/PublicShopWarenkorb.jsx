import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCart } from './useCart';
import '../../styles/PublicShop.css';

export default function PublicShopWarenkorb() {
  const { dojoId } = useParams();
  const navigate = useNavigate();
  const { cart, updateMenge, removeFromCart, getCartTotal } = useCart(dojoId);
  const [einstellungen, setEinstellungen] = useState(null);

  useEffect(() => {
    axios.get(`/shop/public/${dojoId}/einstellungen`)
      .then(r => setEinstellungen(r.data))
      .catch(() => {});
  }, [dojoId]);

  const totals = getCartTotal(
    einstellungen?.versandkostenfrei_ab_cent || 5000,
    einstellungen?.standard_versandkosten_cent || 495
  );

  const formatEur = (cent) => `${(cent / 100).toFixed(2)} €`;

  if (cart.length === 0) return (
    <div className="public-shop public-shop-warenkorb-empty">
      <h2>🛒 Dein Warenkorb ist leer</h2>
      <p>Entdecke unsere Produkte und füge sie deinem Warenkorb hinzu.</p>
      <Link to={`/shop/${dojoId}`} className="public-shop-btn-primary">Zum Shop</Link>
    </div>
  );

  return (
    <div className="public-shop">
      <header className="public-shop-header">
        <div className="public-shop-header-inner">
          <Link to={`/shop/${dojoId}`} className="public-shop-back">← Weiter einkaufen</Link>
          <h1>🛒 Warenkorb</h1>
        </div>
      </header>

      <div className="public-shop-warenkorb-layout">
        {/* Positionen */}
        <div className="public-shop-warenkorb-items">
          {cart.map(item => (
            <div key={item._key} className="public-shop-cart-item">
              {item.bild_url ? (
                <img src={item.bild_url} alt={item.name} className="public-shop-cart-img" />
              ) : (
                <div className="public-shop-cart-img-placeholder">📦</div>
              )}
              <div className="public-shop-cart-info">
                <span className="public-shop-cart-name">{item.name}</span>
                {item.optionen && Object.keys(item.optionen).length > 0 && (
                  <span className="public-shop-cart-optionen">
                    {Object.entries(item.optionen).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </span>
                )}
                <span className="public-shop-cart-preis-unit">{item.preis.toFixed(2)} € / Stk</span>
              </div>
              <div className="public-shop-cart-menge">
                <button onClick={() => updateMenge(item._key, item.menge - 1)}>−</button>
                <span>{item.menge}</span>
                <button onClick={() => updateMenge(item._key, item.menge + 1)}>+</button>
              </div>
              <div className="public-shop-cart-summe">
                <strong>{(item.preis * item.menge).toFixed(2)} €</strong>
                <button className="public-shop-cart-remove" onClick={() => removeFromCart(item._key)} title="Entfernen">✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Zusammenfassung */}
        <div className="public-shop-warenkorb-summary">
          <h3>Zusammenfassung</h3>
          <div className="public-shop-summary-row">
            <span>Zwischensumme</span>
            <span>{formatEur(totals.zwischensumme_cent)}</span>
          </div>
          <div className="public-shop-summary-row">
            <span>Versandkosten</span>
            <span>{totals.versandkosten_cent === 0 ? 'Kostenlos ✓' : formatEur(totals.versandkosten_cent)}</span>
          </div>
          {totals.versandkosten_cent > 0 && einstellungen && (
            <div className="public-shop-summary-hint">
              Noch {formatEur(einstellungen.versandkostenfrei_ab_cent - totals.zwischensumme_cent)} bis kostenloser Versand
            </div>
          )}
          <div className="public-shop-summary-total">
            <span>Gesamt</span>
            <strong>{formatEur(totals.gesamt_cent)}</strong>
          </div>
          <button
            className="public-shop-btn-primary"
            onClick={() => navigate(`/shop/${dojoId}/checkout`)}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            Zur Kasse →
          </button>
          <Link to={`/shop/${dojoId}`} className="public-shop-btn-secondary" style={{ width: '100%', marginTop: '0.5rem', textAlign: 'center' }}>
            Weiter einkaufen
          </Link>
        </div>
      </div>
    </div>
  );
}
