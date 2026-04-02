import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { useCart } from './useCart';
import '../../styles/PublicShop.css';

export default function PublicShop() {
  const { dojoId } = useParams();
  const [einstellungen, setEinstellungen] = useState(null);
  const [kategorien, setKategorien] = useState([]);
  const [allProdukte, setAllProdukte] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeKategorie, setActiveKategorie] = useState(null); // null = alle
  const [search, setSearch] = useState('');

  // Varianten-Modal
  const [showVariantenModal, setShowVariantenModal] = useState(false);
  const [selectedArtikel, setSelectedArtikel] = useState(null);
  const [selectedVariante, setSelectedVariante] = useState({ groesse: '', farbe: '', material: '', preiskategorie: '' });
  const [addedId, setAddedId] = useState(null);

  const { addToCart, getCartCount } = useCart(dojoId);

  // Client-seitige Suche auf bereits geladenen Produkten
  const produkte = search
    ? allProdukte.filter(p => {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) ||
               (p.artikel_nummer || '').toLowerCase().includes(q) ||
               (p.beschreibung || '').toLowerCase().includes(q);
      })
    : allProdukte;

  useEffect(() => {
    loadShop();
  }, [dojoId]);

  useEffect(() => {
    if (!loading) loadProdukte();
  }, [dojoId, activeKategorie]);

  const loadShop = async () => {
    try {
      const [einRes, katRes, prodRes] = await Promise.all([
        axios.get(`/shop/public/${dojoId}/einstellungen`),
        axios.get(`/shop/public/${dojoId}/kategorien`),
        axios.get(`/shop/public/${dojoId}/produkte`)
      ]);
      setEinstellungen(einRes.data);
      setKategorien(katRes.data);
      setAllProdukte(prodRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Shop nicht gefunden');
    } finally {
      setLoading(false);
    }
  };

  const loadProdukte = async () => {
    try {
      const params = activeKategorie ? `?gruppe=${activeKategorie}` : '';
      const { data } = await axios.get(`/shop/public/${dojoId}/produkte${params}`);
      setAllProdukte(data);
    } catch (err) {
      console.error(err);
    }
  };

  const hatVariantenFn = (art) =>
    art.hat_varianten && (
      (art.varianten_groessen?.length > 0) ||
      (art.varianten_farben?.length > 0) ||
      (art.varianten_material?.length > 0) ||
      art.hat_preiskategorien
    );

  const handleArtikelClick = (art) => {
    if (!art.verfuegbar) return;
    if (hatVariantenFn(art)) {
      setSelectedArtikel(art);
      setSelectedVariante({ groesse: '', farbe: '', material: '', preiskategorie: '' });
      setShowVariantenModal(true);
    } else {
      addToCart(art);
      setAddedId(art.id);
      setTimeout(() => setAddedId(null), 1500);
    }
  };

  const addVariantToCart = () => {
    if (!selectedArtikel) return;
    const art = selectedArtikel;
    const optionen = {};
    if (selectedVariante.groesse) optionen.groesse = selectedVariante.groesse;
    if (selectedVariante.farbe) optionen.farbe = selectedVariante.farbe;
    if (selectedVariante.material) optionen.material = selectedVariante.material;
    if (selectedVariante.preiskategorie) optionen.preiskategorie = selectedVariante.preiskategorie;

    let preis = art.preis;
    if (selectedVariante.preiskategorie === 'kids' && art.preis_kids_euro) preis = art.preis_kids_euro;
    if (selectedVariante.preiskategorie === 'erwachsene' && art.preis_erwachsene_euro) preis = art.preis_erwachsene_euro;

    addToCart({ ...art, preis }, optionen);
    setShowVariantenModal(false);
    setSelectedArtikel(null);
    setAddedId(art.id);
    setTimeout(() => setAddedId(null), 1500);
  };

  const currentPreis = selectedArtikel
    ? (selectedVariante.preiskategorie === 'kids' && selectedArtikel.preis_kids_euro
        ? selectedArtikel.preis_kids_euro
        : selectedVariante.preiskategorie === 'erwachsene' && selectedArtikel.preis_erwachsene_euro
          ? selectedArtikel.preis_erwachsene_euro
          : selectedArtikel.preis)
    : 0;

  if (loading) return (
    <div className="public-shop-loading">
      <div className="public-shop-spinner" />
      <p>Shop wird geladen...</p>
    </div>
  );

  if (error) return (
    <div className="public-shop-error-page">
      <h2>Shop nicht verfügbar</h2>
      <p>{error}</p>
    </div>
  );

  const cartCount = getCartCount();

  return (
    <div className="public-shop">
      {/* Header */}
      <header className="public-shop-header">
        <div className="public-shop-header-inner">
          <div className="public-shop-brand">
            {einstellungen?.shop_logo_url && (
              <img src={einstellungen.shop_logo_url} alt="Shop Logo" className="public-shop-logo" />
            )}
            <h1>{einstellungen?.shop_name || 'Shop'}</h1>
          </div>
          <Link to={`/shop/${dojoId}/warenkorb`} className="public-shop-cart-btn">
            🛒 Warenkorb
            {cartCount > 0 && <span className="public-shop-cart-badge">{cartCount}</span>}
          </Link>
        </div>
        {einstellungen?.shop_beschreibung && (
          <p className="public-shop-subtitle">{einstellungen.shop_beschreibung}</p>
        )}
      </header>

      {/* Versandhinweis */}
      {einstellungen && (
        <div className="public-shop-shipping-hint">
          🚚 Kostenloser Versand ab {(einstellungen.versandkostenfrei_ab_cent / 100).toFixed(2)} € ·
          Standard-Versand {(einstellungen.standard_versandkosten_cent / 100).toFixed(2)} €
        </div>
      )}

      {/* Kasse-Style Layout */}
      <div className="public-shop-kasse-layout">
        {/* Kategorien-Sidebar */}
        <div className="public-shop-kategorien-sidebar">
          <button
            className={`public-shop-kat-btn-kasse ${!activeKategorie ? 'active' : ''}`}
            onClick={() => setActiveKategorie(null)}
          >
            Alle Artikel
          </button>
          {(() => {
            const parents = kategorien.filter(k => !k.parent_id);
            const children = kategorien.filter(k => k.parent_id);
            // Wenn es keine Eltern-Gruppen gibt, alles flach anzeigen
            if (parents.length === 0) {
              return kategorien.map(kat => (
                <button
                  key={kat.id}
                  className={`public-shop-kat-btn-kasse ${activeKategorie === kat.id ? 'active' : ''}`}
                  style={{ '--kat-color': kat.farbe_hex }}
                  onClick={() => setActiveKategorie(kat.id)}
                >
                  {kat.icon && <span className="public-shop-kat-icon">{kat.icon}</span>}
                  {kat.name}
                </button>
              ));
            }
            // Zweistufig: Eltern-Gruppen als Header + Kinder eingerückt
            return parents.map(parent => {
              const kinder = children.filter(c => c.parent_id === parent.id);
              // Eltern-Gruppe ist direkt anklickbar wenn sie eigene Artikel hat
              return (
                <React.Fragment key={parent.id}>
                  {kinder.length > 0 ? (
                    // Eltern-Gruppe als Header (nicht anklickbar wenn nur Kinder)
                    <div className="public-shop-kat-group-header">
                      {parent.icon && <span>{parent.icon} </span>}
                      {parent.name}
                    </div>
                  ) : (
                    // Eltern-Gruppe hat eigene Artikel → anklickbar
                    <button
                      className={`public-shop-kat-btn-kasse ${activeKategorie === parent.id ? 'active' : ''}`}
                      style={{ '--kat-color': parent.farbe_hex }}
                      onClick={() => setActiveKategorie(parent.id)}
                    >
                      {parent.icon && <span className="public-shop-kat-icon">{parent.icon}</span>}
                      {parent.name}
                    </button>
                  )}
                  {kinder.map(kind => (
                    <button
                      key={kind.id}
                      className={`public-shop-kat-btn-kasse child ${activeKategorie === kind.id ? 'active' : ''}`}
                      style={{ '--kat-color': kind.farbe_hex || parent.farbe_hex }}
                      onClick={() => setActiveKategorie(kind.id)}
                    >
                      {kind.icon && <span className="public-shop-kat-icon">{kind.icon}</span>}
                      {kind.name}
                    </button>
                  ))}
                </React.Fragment>
              );
            });
          })()}
        </div>

        {/* Artikel-Bereich */}
        <div className="public-shop-artikel-section">
          {/* Suche */}
          <div className="public-shop-search-bar">
            <input
              type="text"
              placeholder="Artikel suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="public-shop-search"
            />
          </div>

          {/* Artikel-Grid */}
          {produkte.length === 0 ? (
            <div className="public-shop-empty">
              Keine Artikel gefunden{search ? ` für „${search}"` : ''}
            </div>
          ) : (
            <div className="public-shop-artikel-grid">
              {produkte.map(art => {
                const hatVarianten = hatVariantenFn(art);
                const isAdded = addedId === art.id;
                return (
                  <button
                    key={art.artikel_id}
                    className={`public-shop-artikel-btn ${!art.verfuegbar ? 'disabled' : ''} ${hatVarianten ? 'has-variants' : ''} ${isAdded ? 'added' : ''}`}
                    onClick={() => handleArtikelClick(art)}
                    disabled={!art.verfuegbar}
                  >
                    <div className="public-shop-artikel-bild">
                      {art.bild_url ? (
                        <img src={art.bild_url} alt={art.name} />
                      ) : (
                        <div className="public-shop-artikel-placeholder">📦</div>
                      )}
                      {hatVarianten && <span className="public-shop-variant-badge">Varianten</span>}
                    </div>
                    <div className="public-shop-artikel-info">
                      <div className="public-shop-artikel-name">{art.name}</div>
                      <div className="public-shop-artikel-preis">
                        {art.preis.toFixed(2)}€
                        {hatVarianten && art.hat_preiskategorien && (
                          <span className="public-shop-preis-hinweis"> (ab)</span>
                        )}
                      </div>
                      {art.lager_tracking && (
                        <div className={`public-shop-artikel-lager ${(art.lagerbestand ?? 0) <= 0 ? 'out' : ''}`}>
                          Lager: {art.lagerbestand ?? 0}
                        </div>
                      )}
                    </div>
                    {isAdded && <div className="public-shop-added-overlay">✓</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Varianten-Modal */}
      {showVariantenModal && selectedArtikel && (
        <div className="public-shop-modal-overlay" onClick={() => setShowVariantenModal(false)}>
          <div className="public-shop-modal" onClick={e => e.stopPropagation()}>
            <div className="public-shop-modal-header">
              <h3>{selectedArtikel.name}</h3>
              <button className="public-shop-modal-close" onClick={() => setShowVariantenModal(false)}>✕</button>
            </div>
            <div className="public-shop-modal-body">

              {/* Preiskategorien */}
              {selectedArtikel.hat_preiskategorien && (
                <div className="public-shop-variante-group">
                  <label>Preiskategorie</label>
                  <div className="public-shop-variante-options">
                    {selectedArtikel.preis_kids_euro && (
                      <button
                        className={`public-shop-variante-btn ${selectedVariante.preiskategorie === 'kids' ? 'selected' : ''}`}
                        onClick={() => setSelectedVariante(v => ({ ...v, preiskategorie: 'kids' }))}
                      >
                        Kids — {selectedArtikel.preis_kids_euro.toFixed(2)} €
                      </button>
                    )}
                    {selectedArtikel.preis_erwachsene_euro && (
                      <button
                        className={`public-shop-variante-btn ${selectedVariante.preiskategorie === 'erwachsene' ? 'selected' : ''}`}
                        onClick={() => setSelectedVariante(v => ({ ...v, preiskategorie: 'erwachsene' }))}
                      >
                        Erwachsene — {selectedArtikel.preis_erwachsene_euro.toFixed(2)} €
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Größen */}
              {selectedArtikel.varianten_groessen?.length > 0 && (
                <div className="public-shop-variante-group">
                  <label>Größe</label>
                  <div className="public-shop-variante-options">
                    {selectedArtikel.varianten_groessen.map(g => (
                      <button
                        key={g}
                        className={`public-shop-variante-btn ${selectedVariante.groesse === g ? 'selected' : ''}`}
                        onClick={() => setSelectedVariante(v => ({ ...v, groesse: v.groesse === g ? '' : g }))}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Farben */}
              {selectedArtikel.varianten_farben?.length > 0 && (
                <div className="public-shop-variante-group">
                  <label>Farbe</label>
                  <div className="public-shop-variante-options">
                    {selectedArtikel.varianten_farben.map(f => (
                      <button
                        key={f}
                        className={`public-shop-variante-btn ${selectedVariante.farbe === f ? 'selected' : ''}`}
                        onClick={() => setSelectedVariante(v => ({ ...v, farbe: v.farbe === f ? '' : f }))}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Material */}
              {selectedArtikel.varianten_material?.length > 0 && (
                <div className="public-shop-variante-group">
                  <label>Material</label>
                  <div className="public-shop-variante-options">
                    {selectedArtikel.varianten_material.map(m => (
                      <button
                        key={m}
                        className={`public-shop-variante-btn ${selectedVariante.material === m ? 'selected' : ''}`}
                        onClick={() => setSelectedVariante(v => ({ ...v, material: v.material === m ? '' : m }))}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="public-shop-variante-preis">
                Preis: <strong>{currentPreis.toFixed(2)} €</strong>
              </div>
            </div>

            <div className="public-shop-modal-footer">
              <button className="public-shop-btn-secondary" onClick={() => setShowVariantenModal(false)}>
                Abbrechen
              </button>
              <button
                className="public-shop-btn-primary"
                onClick={addVariantToCart}
                disabled={selectedArtikel.hat_preiskategorien && !selectedVariante.preiskategorie}
              >
                🛒 In den Warenkorb
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="public-shop-footer">
        <p>© {new Date().getFullYear()} {einstellungen?.shop_name}</p>
        {einstellungen?.impressum_zusatz && (
          <p className="public-shop-impressum">{einstellungen.impressum_zusatz}</p>
        )}
      </footer>
    </div>
  );
}
