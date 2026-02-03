// ============================================================================
// VERBAND SHOP - Tiger & Dragon Association International
// ============================================================================
// Shop für Pässe, Urkunden und Verbandsmaterial
// - Produktkatalog mit Kategorien
// - Warenkorb-System
// - Checkout & Bestellungen

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingCart, Package, Award, FileText, CreditCard, Trash2,
  Plus, Minus, Check, ChevronRight, X, Search, Filter,
  Download, Truck, Clock, Euro, Shield, Star, Tag,
  BookOpen, Medal, ScrollText, BadgeCheck, Loader2, AlertCircle,
  Edit3, Save, ChevronDown, Settings
} from 'lucide-react';
import StripeCheckout from './StripeCheckout';
import '../styles/VerbandShop.css';

// Icon-Mapping für dynamische Kategorien
const ICON_MAP = {
  'BadgeCheck': BadgeCheck,
  'Award': Award,
  'Medal': Medal,
  'ScrollText': ScrollText,
  'Package': Package,
  'FileText': FileText,
  'BookOpen': BookOpen,
  'Star': Star,
  'Tag': Tag
};

const VerbandShop = () => {
  const { token, user } = useAuth();

  // State
  const [produkte, setProdukte] = useState([]);
  const [kategorien, setKategorien] = useState([]);
  const [selectedKategorie, setSelectedKategorie] = useState('alle');
  const [searchTerm, setSearchTerm] = useState('');
  const [warenkorb, setWarenkorb] = useState([]);
  const [showWarenkorb, setShowWarenkorb] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showProduktDetail, setShowProduktDetail] = useState(null);
  const [selectedOptionen, setSelectedOptionen] = useState({});
  const [bestellungErfolgreich, setBestellungErfolgreich] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);

  // Admin State
  const isAdmin = user?.role === 'admin';
  const [showProduktEditor, setShowProduktEditor] = useState(false);
  const [editingProdukt, setEditingProdukt] = useState(null);
  const [savingProdukt, setSavingProdukt] = useState(false);
  const [expandedKategorie, setExpandedKategorie] = useState(null);
  const [allKategorien, setAllKategorien] = useState([]); // Für Admin-Dropdown

  // Checkout Form State
  const [checkoutData, setCheckoutData] = useState({
    vorname: user?.vorname || '',
    nachname: user?.nachname || '',
    email: user?.email || '',
    strasse: '',
    plz: '',
    ort: '',
    land: 'Deutschland',
    telefon: '',
    anmerkungen: '',
    zahlungsart: 'rechnung'
  });

  // Daten aus API laden
  useEffect(() => {
    const loadShopData = async () => {
      try {
        setLoadingData(true);
        setError(null);

        // Kategorien und Produkte parallel laden
        // WICHTIG: Relative Pfade verwenden, da axios.defaults.baseURL bereits /api ist
        const [katResponse, prodResponse] = await Promise.all([
          axios.get('/shop/kategorien'),
          axios.get('/shop/produkte')
        ]);

        // Kategorien mit Icons mappen
        const mappedKategorien = [];
        katResponse.data.forEach(kat => {
          // Hauptkategorie hinzufügen
          if (!kat.parent_id) {
            mappedKategorien.push({
              id: kat.slug,
              dbId: kat.id,
              name: kat.name,
              icon: ICON_MAP[kat.icon] || Package,
              color: kat.farbe,
              isParent: true
            });
            // Unterkategorien hinzufügen
            if (kat.children && kat.children.length > 0) {
              kat.children.forEach(child => {
                const IconComponent = ICON_MAP[child.icon] || Package;
                mappedKategorien.push({
                  id: child.slug,
                  dbId: child.id,
                  name: child.name,
                  icon: IconComponent,
                  color: child.farbe,
                  parentDbId: kat.id,
                  parentSlug: kat.slug,
                  isChild: true
                });
              });
            }
          }
        });
        setKategorien(mappedKategorien);

        // Alle Kategorien flat speichern für Admin-Dropdown
        const flatKategorien = [];
        katResponse.data.forEach(kat => {
          flatKategorien.push({ id: kat.id, name: kat.name, slug: kat.slug, parent_id: null });
          if (kat.children) {
            kat.children.forEach(child => {
              flatKategorien.push({ id: child.id, name: `${kat.name} → ${child.name}`, slug: child.slug, parent_id: kat.id });
            });
          }
        });
        setAllKategorien(flatKategorien);

        // Produkte mappen - inkl. Parent-Kategorie für Filterung
        const mappedProdukte = prodResponse.data.map(p => ({
          id: p.id,
          dbId: p.id,
          kategorie_id: p.kategorie_id,
          kategorie: p.kategorie_slug,
          parentKategorie: p.parent_kategorie_id ?
            katResponse.data.find(k => k.id === p.parent_kategorie_id)?.slug : null,
          sku: p.sku,
          name: p.name,
          beschreibung: p.beschreibung,
          preis: parseFloat(p.preis),
          bild: p.bild_url,
          details: p.details || [],
          optionen: p.optionen || null,
          lieferzeit: p.lieferzeit,
          featured: p.featured === 1,
          aktiv: p.aktiv
        }));
        setProdukte(mappedProdukte);

      } catch (err) {
        console.error('Fehler beim Laden der Shop-Daten:', err);
        setError('Shop-Daten konnten nicht geladen werden');
      } finally {
        setLoadingData(false);
      }
    };

    loadShopData();
  }, []);

  // Warenkorb aus localStorage laden
  useEffect(() => {
    const savedCart = localStorage.getItem('tda_shop_warenkorb');
    if (savedCart) {
      try {
        setWarenkorb(JSON.parse(savedCart));
      } catch (e) {
        console.error('Fehler beim Laden des Warenkorbs:', e);
      }
    }
  }, []);

  // Warenkorb in localStorage speichern
  useEffect(() => {
    localStorage.setItem('tda_shop_warenkorb', JSON.stringify(warenkorb));
  }, [warenkorb]);

  // Produkte filtern - inkl. Unterkategorien bei Parent-Auswahl
  const gefilterteProdukte = produkte.filter(p => {
    const matchKategorie = selectedKategorie === 'alle' ||
      p.kategorie === selectedKategorie ||
      p.parentKategorie === selectedKategorie; // Zeige auch Produkte aus Unterkategorien
    const matchSearch = searchTerm === '' ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.beschreibung.toLowerCase().includes(searchTerm.toLowerCase());
    return matchKategorie && matchSearch;
  });

  // Featured Produkte
  const featuredProdukte = produkte.filter(p => p.featured);

  // Warenkorb Funktionen
  const addToCart = (produkt, optionen = {}) => {
    const cartItem = {
      id: `${produkt.id}-${Date.now()}`,
      produktId: produkt.id,
      name: produkt.name,
      preis: produkt.preis,
      menge: 1,
      optionen: optionen,
      bild: produkt.bild
    };

    setWarenkorb(prev => [...prev, cartItem]);
    setShowProduktDetail(null);
    setSelectedOptionen({});
  };

  const updateCartItemMenge = (itemId, neueMenge) => {
    if (neueMenge < 1) {
      removeFromCart(itemId);
      return;
    }
    setWarenkorb(prev => prev.map(item =>
      item.id === itemId ? { ...item, menge: neueMenge } : item
    ));
  };

  const removeFromCart = (itemId) => {
    setWarenkorb(prev => prev.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    setWarenkorb([]);
  };

  // Berechnung
  const warenkorbSumme = warenkorb.reduce((sum, item) => sum + (item.preis * item.menge), 0);
  const warenkorbAnzahl = warenkorb.reduce((sum, item) => sum + item.menge, 0);
  const versandkosten = warenkorbSumme >= 50 ? 0 : 4.95;
  const gesamtSumme = warenkorbSumme + versandkosten;

  // Checkout Handler
  const handleCheckout = async () => {
    const bestellung = {
      positionen: warenkorb.map(item => ({
        produkt_id: item.produktId,
        menge: item.menge,
        optionen: item.optionen
      })),
      lieferadresse: {
        vorname: checkoutData.vorname,
        nachname: checkoutData.nachname,
        strasse: checkoutData.strasse,
        plz: checkoutData.plz,
        ort: checkoutData.ort,
        land: checkoutData.land,
        telefon: checkoutData.telefon
      },
      rechnungsadresse: {
        vorname: checkoutData.vorname,
        nachname: checkoutData.nachname,
        email: checkoutData.email,
        strasse: checkoutData.strasse,
        plz: checkoutData.plz,
        ort: checkoutData.ort,
        land: checkoutData.land
      },
      anmerkungen: checkoutData.anmerkungen,
      zahlungsart: checkoutData.zahlungsart
    };

    // Bei Stripe-Zahlung: Modal öffnen
    if (checkoutData.zahlungsart === 'stripe') {
      setPendingOrder(bestellung);
      setShowStripePayment(true);
      setShowCheckout(false);
      return;
    }

    // Ansonsten normale Bestellung
    await submitOrder(bestellung);
  };

  const submitOrder = async (bestellung, paymentIntentId = null) => {
    setLoading(true);

    try {
      // Füge Payment Intent ID hinzu wenn vorhanden
      if (paymentIntentId) {
        bestellung.stripe_payment_intent_id = paymentIntentId;
        bestellung.bezahlt = true;
      }

      await axios.post('/shop/bestellungen', bestellung, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Erfolg
      setBestellungErfolgreich(true);
      clearCart();
      setShowCheckout(false);
      setShowStripePayment(false);
      setPendingOrder(null);

    } catch (error) {
      console.error('Bestellfehler:', error);
      alert('Fehler bei der Bestellung. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ADMIN FUNKTIONEN
  // ============================================================================

  // Neues Produkt erstellen
  const handleNeuesProdukt = () => {
    setEditingProdukt({
      id: null,
      sku: '',
      name: '',
      beschreibung: '',
      preis: 0,
      kategorie_id: allKategorien[0]?.id || 1,
      details: [],
      optionen: null,
      lieferzeit: '3-5 Werktage',
      featured: false,
      aktiv: true
    });
    setShowProduktEditor(true);
  };

  // Produkt bearbeiten
  const handleEditProdukt = (produkt) => {
    setEditingProdukt({
      id: produkt.dbId || produkt.id,
      sku: produkt.sku || '',
      name: produkt.name,
      beschreibung: produkt.beschreibung,
      preis: produkt.preis,
      kategorie_id: produkt.kategorie_id,
      details: produkt.details || [],
      optionen: produkt.optionen,
      lieferzeit: produkt.lieferzeit || '3-5 Werktage',
      featured: produkt.featured,
      aktiv: produkt.aktiv !== false
    });
    setShowProduktEditor(true);
  };

  // Produkt speichern
  const handleSaveProdukt = async () => {
    if (!editingProdukt.name || !editingProdukt.sku) {
      alert('Name und SKU sind erforderlich');
      return;
    }

    setSavingProdukt(true);
    try {
      const payload = {
        ...editingProdukt,
        details: editingProdukt.details || [],
        optionen: editingProdukt.optionen || null
      };

      if (editingProdukt.id) {
        // Update
        await axios.put(`/shop/admin/produkte/${editingProdukt.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Create
        await axios.post('/shop/admin/produkte', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // Daten neu laden
      const prodResponse = await axios.get('/shop/produkte');
      const katResponse = await axios.get('/shop/kategorien');

      const mappedProdukte = prodResponse.data.map(p => ({
        id: p.id,
        dbId: p.id,
        kategorie_id: p.kategorie_id,
        kategorie: p.kategorie_slug,
        parentKategorie: p.parent_kategorie_id ?
          katResponse.data.find(k => k.id === p.parent_kategorie_id)?.slug : null,
        sku: p.sku,
        name: p.name,
        beschreibung: p.beschreibung,
        preis: parseFloat(p.preis),
        bild: p.bild_url,
        details: p.details || [],
        optionen: p.optionen || null,
        lieferzeit: p.lieferzeit,
        featured: p.featured === 1,
        aktiv: p.aktiv
      }));
      setProdukte(mappedProdukte);

      setShowProduktEditor(false);
      setEditingProdukt(null);
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert('Fehler beim Speichern des Produkts');
    } finally {
      setSavingProdukt(false);
    }
  };

  // Produkt löschen
  const handleDeleteProdukt = async (produktId) => {
    if (!confirm('Produkt wirklich löschen?')) return;

    try {
      await axios.delete(`/shop/admin/produkte/${produktId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Aus State entfernen
      setProdukte(prev => prev.filter(p => p.id !== produktId && p.dbId !== produktId));
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      alert('Fehler beim Löschen des Produkts');
    }
  };

  // Details-Array bearbeiten
  const handleDetailChange = (index, value) => {
    const newDetails = [...(editingProdukt.details || [])];
    newDetails[index] = value;
    setEditingProdukt(prev => ({ ...prev, details: newDetails }));
  };

  const handleAddDetail = () => {
    setEditingProdukt(prev => ({
      ...prev,
      details: [...(prev.details || []), '']
    }));
  };

  const handleRemoveDetail = (index) => {
    setEditingProdukt(prev => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== index)
    }));
  };

  // Kategorie Icon Component
  const KategorieIcon = ({ kategorie, size = 20 }) => {
    const kat = kategorien.find(k => k.id === kategorie);
    if (!kat) return <Package size={size} />;
    const Icon = kat.icon;
    return <Icon size={size} style={{ color: kat.color }} />;
  };

  // ============================================================================
  // RENDER: Produkt-Karte
  // ============================================================================
  const ProduktKarte = ({ produkt }) => (
    <div
      className={`shop-produkt-karte ${produkt.featured ? 'featured' : ''}`}
      onClick={() => setShowProduktDetail(produkt)}
    >
      {produkt.featured && (
        <div className="featured-badge">
          <Star size={12} /> Beliebt
        </div>
      )}
      {/* Admin Buttons */}
      {isAdmin && (
        <div className="admin-buttons">
          <button
            className="btn-admin-edit"
            onClick={(e) => { e.stopPropagation(); handleEditProdukt(produkt); }}
            title="Bearbeiten"
          >
            <Edit3 size={14} />
          </button>
          <button
            className="btn-admin-delete"
            onClick={(e) => { e.stopPropagation(); handleDeleteProdukt(produkt.dbId || produkt.id); }}
            title="Löschen"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
      <div className="produkt-bild">
        <KategorieIcon kategorie={produkt.kategorie} size={48} />
      </div>
      <div className="produkt-info">
        <span className="produkt-kategorie">
          {kategorien.find(k => k.id === produkt.kategorie)?.name}
        </span>
        <h3 className="produkt-name">{produkt.name}</h3>
        <p className="produkt-beschreibung">{produkt.beschreibung}</p>
        <div className="produkt-footer">
          <span className="produkt-preis">{produkt.preis.toFixed(2)} €</span>
          <button
            className="btn-add-cart"
            onClick={(e) => {
              e.stopPropagation();
              if (produkt.optionen) {
                setShowProduktDetail(produkt);
              } else {
                addToCart(produkt);
              }
            }}
          >
            <ShoppingCart size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER: Produkt-Detail Modal
  // ============================================================================
  const ProduktDetailModal = ({ produkt }) => (
    <div className="modal-overlay" onClick={() => setShowProduktDetail(null)}>
      <div className="modal-content produkt-detail-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setShowProduktDetail(null)}>
          <X size={24} />
        </button>

        <div className="produkt-detail-grid">
          <div className="produkt-detail-bild">
            <KategorieIcon kategorie={produkt.kategorie} size={120} />
          </div>

          <div className="produkt-detail-info">
            <span className="produkt-kategorie-badge">
              {kategorien.find(k => k.id === produkt.kategorie)?.name}
            </span>
            <h2>{produkt.name}</h2>
            <p className="produkt-detail-beschreibung">{produkt.beschreibung}</p>

            {produkt.details && (
              <ul className="produkt-details-liste">
                {produkt.details.map((detail, i) => (
                  <li key={i}><Check size={14} /> {detail}</li>
                ))}
              </ul>
            )}

            {produkt.optionen && (
              <div className="produkt-optionen">
                {produkt.optionen.map((option, i) => (
                  <div key={i} className="option-gruppe">
                    <label>{option.name}</label>
                    <select
                      value={selectedOptionen[option.name] || ''}
                      onChange={(e) => setSelectedOptionen(prev => ({
                        ...prev,
                        [option.name]: e.target.value
                      }))}
                    >
                      <option value="">Bitte wählen...</option>
                      {option.werte.map((wert, j) => (
                        <option key={j} value={wert}>{wert}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="produkt-detail-footer">
              <div className="produkt-meta">
                <span className="lieferzeit">
                  <Truck size={14} /> {produkt.lieferzeit}
                </span>
              </div>
              <div className="produkt-kaufen">
                <span className="preis-gross">{produkt.preis.toFixed(2)} €</span>
                <button
                  className="btn-kaufen"
                  onClick={() => {
                    if (produkt.optionen) {
                      const alleOptionen = produkt.optionen.every(
                        opt => selectedOptionen[opt.name]
                      );
                      if (!alleOptionen) {
                        alert('Bitte alle Optionen auswählen');
                        return;
                      }
                    }
                    addToCart(produkt, selectedOptionen);
                  }}
                >
                  <ShoppingCart size={18} /> In den Warenkorb
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER: Warenkorb Sidebar
  // ============================================================================
  const WarenkorbSidebar = () => (
    <div className={`warenkorb-sidebar ${showWarenkorb ? 'open' : ''}`}>
      <div className="warenkorb-header">
        <h3><ShoppingCart size={20} /> Warenkorb</h3>
        <button className="btn-close" onClick={() => setShowWarenkorb(false)}>
          <X size={20} />
        </button>
      </div>

      {warenkorb.length === 0 ? (
        <div className="warenkorb-leer">
          <ShoppingCart size={48} />
          <p>Ihr Warenkorb ist leer</p>
        </div>
      ) : (
        <>
          <div className="warenkorb-items">
            {warenkorb.map(item => (
              <div key={item.id} className="warenkorb-item">
                <div className="item-info">
                  <span className="item-name">{item.name}</span>
                  {Object.keys(item.optionen).length > 0 && (
                    <span className="item-optionen">
                      {Object.entries(item.optionen).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </span>
                  )}
                  <span className="item-preis">{item.preis.toFixed(2)} €</span>
                </div>
                <div className="item-actions">
                  <div className="menge-control">
                    <button onClick={() => updateCartItemMenge(item.id, item.menge - 1)}>
                      <Minus size={14} />
                    </button>
                    <span>{item.menge}</span>
                    <button onClick={() => updateCartItemMenge(item.id, item.menge + 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <button className="btn-remove" onClick={() => removeFromCart(item.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="warenkorb-summe">
            <div className="summe-zeile">
              <span>Zwischensumme</span>
              <span>{warenkorbSumme.toFixed(2)} €</span>
            </div>
            <div className="summe-zeile">
              <span>Versand</span>
              <span>{versandkosten === 0 ? 'Kostenlos' : `${versandkosten.toFixed(2)} €`}</span>
            </div>
            {warenkorbSumme < 50 && (
              <div className="versand-hinweis">
                <Truck size={14} /> Noch {(50 - warenkorbSumme).toFixed(2)} € bis zum kostenlosen Versand
              </div>
            )}
            <div className="summe-zeile total">
              <span>Gesamt</span>
              <span>{gesamtSumme.toFixed(2)} €</span>
            </div>
          </div>

          <div className="warenkorb-actions">
            <button className="btn-checkout" onClick={() => {
              setShowWarenkorb(false);
              setShowCheckout(true);
            }}>
              Zur Kasse <ChevronRight size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );

  // ============================================================================
  // RENDER: Checkout Modal
  // ============================================================================
  const CheckoutModal = () => (
    <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
      <div className="modal-content checkout-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setShowCheckout(false)}>
          <X size={24} />
        </button>

        <h2><CreditCard size={24} /> Bestellung abschließen</h2>

        <div className="checkout-grid">
          {/* Lieferadresse */}
          <div className="checkout-section">
            <h3><Truck size={18} /> Lieferadresse</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Vorname *</label>
                <input
                  type="text"
                  value={checkoutData.vorname}
                  onChange={e => setCheckoutData(prev => ({ ...prev, vorname: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Nachname *</label>
                <input
                  type="text"
                  value={checkoutData.nachname}
                  onChange={e => setCheckoutData(prev => ({ ...prev, nachname: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group full">
                <label>E-Mail *</label>
                <input
                  type="email"
                  value={checkoutData.email}
                  onChange={e => setCheckoutData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group full">
                <label>Straße & Hausnummer *</label>
                <input
                  type="text"
                  value={checkoutData.strasse}
                  onChange={e => setCheckoutData(prev => ({ ...prev, strasse: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>PLZ *</label>
                <input
                  type="text"
                  value={checkoutData.plz}
                  onChange={e => setCheckoutData(prev => ({ ...prev, plz: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Ort *</label>
                <input
                  type="text"
                  value={checkoutData.ort}
                  onChange={e => setCheckoutData(prev => ({ ...prev, ort: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Land</label>
                <select
                  value={checkoutData.land}
                  onChange={e => setCheckoutData(prev => ({ ...prev, land: e.target.value }))}
                >
                  <option value="Deutschland">Deutschland</option>
                  <option value="Österreich">Österreich</option>
                  <option value="Schweiz">Schweiz</option>
                </select>
              </div>
              <div className="form-group">
                <label>Telefon</label>
                <input
                  type="tel"
                  value={checkoutData.telefon}
                  onChange={e => setCheckoutData(prev => ({ ...prev, telefon: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Zahlungsart */}
          <div className="checkout-section">
            <h3><CreditCard size={18} /> Zahlungsart</h3>
            <div className="zahlungsarten">
              <label className={`zahlungsart ${checkoutData.zahlungsart === 'rechnung' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="zahlungsart"
                  value="rechnung"
                  checked={checkoutData.zahlungsart === 'rechnung'}
                  onChange={e => setCheckoutData(prev => ({ ...prev, zahlungsart: e.target.value }))}
                />
                <FileText size={20} />
                <div>
                  <span className="za-name">Rechnung</span>
                  <span className="za-info">Zahlung nach Erhalt der Ware</span>
                </div>
              </label>
              <label className={`zahlungsart ${checkoutData.zahlungsart === 'vorkasse' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="zahlungsart"
                  value="vorkasse"
                  checked={checkoutData.zahlungsart === 'vorkasse'}
                  onChange={e => setCheckoutData(prev => ({ ...prev, zahlungsart: e.target.value }))}
                />
                <Euro size={20} />
                <div>
                  <span className="za-name">Vorkasse</span>
                  <span className="za-info">Überweisung vor Versand</span>
                </div>
              </label>
              <label className={`zahlungsart ${checkoutData.zahlungsart === 'stripe' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="zahlungsart"
                  value="stripe"
                  checked={checkoutData.zahlungsart === 'stripe'}
                  onChange={e => setCheckoutData(prev => ({ ...prev, zahlungsart: e.target.value }))}
                />
                <CreditCard size={20} />
                <div>
                  <span className="za-name">Kreditkarte</span>
                  <span className="za-info">Sofortige Zahlung mit Karte</span>
                </div>
              </label>
            </div>
          </div>

          {/* Bestellübersicht */}
          <div className="checkout-section bestellung-uebersicht">
            <h3><Package size={18} /> Ihre Bestellung</h3>
            <div className="bestellung-items">
              {warenkorb.map(item => (
                <div key={item.id} className="bestellung-item">
                  <span className="item-menge">{item.menge}x</span>
                  <span className="item-name">{item.name}</span>
                  <span className="item-preis">{(item.preis * item.menge).toFixed(2)} €</span>
                </div>
              ))}
            </div>
            <div className="bestellung-summen">
              <div className="summe-zeile">
                <span>Zwischensumme</span>
                <span>{warenkorbSumme.toFixed(2)} €</span>
              </div>
              <div className="summe-zeile">
                <span>Versand</span>
                <span>{versandkosten === 0 ? 'Kostenlos' : `${versandkosten.toFixed(2)} €`}</span>
              </div>
              <div className="summe-zeile total">
                <span>Gesamtsumme</span>
                <span>{gesamtSumme.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Anmerkungen */}
          <div className="checkout-section full">
            <label>Anmerkungen zur Bestellung</label>
            <textarea
              value={checkoutData.anmerkungen}
              onChange={e => setCheckoutData(prev => ({ ...prev, anmerkungen: e.target.value }))}
              placeholder="Besondere Wünsche oder Hinweise..."
              rows={3}
            />
          </div>
        </div>

        <div className="checkout-footer">
          <p className="agb-hinweis">
            <Shield size={14} /> Mit der Bestellung akzeptieren Sie unsere AGB und Datenschutzerklärung.
          </p>
          <button
            className="btn-bestellen"
            onClick={handleCheckout}
            disabled={loading || !checkoutData.vorname || !checkoutData.nachname ||
                     !checkoutData.email || !checkoutData.strasse || !checkoutData.plz || !checkoutData.ort}
          >
            {loading ? (
              <><Loader2 size={18} className="spin" /> Wird verarbeitet...</>
            ) : (
              <>Kostenpflichtig bestellen ({gesamtSumme.toFixed(2)} €)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER: Bestellung Erfolgreich
  // ============================================================================
  const BestellungErfolgreichModal = () => (
    <div className="modal-overlay">
      <div className="modal-content erfolg-modal">
        <div className="erfolg-icon">
          <Check size={48} />
        </div>
        <h2>Bestellung erfolgreich!</h2>
        <p>Vielen Dank für Ihre Bestellung. Sie erhalten in Kürze eine Bestätigung per E-Mail.</p>
        <div className="erfolg-info">
          <div className="info-item">
            <Clock size={18} />
            <span>Bearbeitung: 1-2 Werktage</span>
          </div>
          <div className="info-item">
            <Truck size={18} />
            <span>Lieferung: 3-7 Werktage</span>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setBestellungErfolgreich(false)}>
          Weiter einkaufen
        </button>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER: Produkt Editor Modal (Admin)
  // ============================================================================
  const ProduktEditorModal = () => (
    <div className="modal-overlay" onClick={() => setShowProduktEditor(false)}>
      <div className="modal-content produkt-editor-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setShowProduktEditor(false)}>
          <X size={24} />
        </button>

        <h2>
          <Settings size={24} />
          {editingProdukt?.id ? 'Produkt bearbeiten' : 'Neues Produkt'}
        </h2>

        <div className="editor-form">
          <div className="form-row">
            <div className="form-group">
              <label>Artikelnummer (SKU) *</label>
              <input
                type="text"
                value={editingProdukt?.sku || ''}
                onChange={e => setEditingProdukt(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="z.B. URK-KAR-001"
              />
            </div>
            <div className="form-group">
              <label>Kategorie *</label>
              <select
                value={editingProdukt?.kategorie_id || ''}
                onChange={e => setEditingProdukt(prev => ({ ...prev, kategorie_id: parseInt(e.target.value) }))}
              >
                {allKategorien.map(kat => (
                  <option key={kat.id} value={kat.id}>{kat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Produktname *</label>
            <input
              type="text"
              value={editingProdukt?.name || ''}
              onChange={e => setEditingProdukt(prev => ({ ...prev, name: e.target.value }))}
              placeholder="z.B. Karate Kyu-Urkunde"
            />
          </div>

          <div className="form-group">
            <label>Beschreibung</label>
            <textarea
              value={editingProdukt?.beschreibung || ''}
              onChange={e => setEditingProdukt(prev => ({ ...prev, beschreibung: e.target.value }))}
              rows={3}
              placeholder="Produktbeschreibung..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Preis (€) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editingProdukt?.preis || 0}
                onChange={e => setEditingProdukt(prev => ({ ...prev, preis: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="form-group">
              <label>Lieferzeit</label>
              <input
                type="text"
                value={editingProdukt?.lieferzeit || ''}
                onChange={e => setEditingProdukt(prev => ({ ...prev, lieferzeit: e.target.value }))}
                placeholder="z.B. 3-5 Werktage"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Details (Aufzählungspunkte)</label>
            <div className="details-list">
              {(editingProdukt?.details || []).map((detail, index) => (
                <div key={index} className="detail-item">
                  <input
                    type="text"
                    value={detail}
                    onChange={e => handleDetailChange(index, e.target.value)}
                    placeholder="z.B. DIN A4 Format"
                  />
                  <button type="button" onClick={() => handleRemoveDetail(index)} className="btn-remove-detail">
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={handleAddDetail} className="btn-add-detail">
                <Plus size={16} /> Detail hinzufügen
              </button>
            </div>
          </div>

          <div className="form-row checkboxes">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={editingProdukt?.featured || false}
                onChange={e => setEditingProdukt(prev => ({ ...prev, featured: e.target.checked }))}
              />
              <span>Hervorgehoben (Featured)</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={editingProdukt?.aktiv !== false}
                onChange={e => setEditingProdukt(prev => ({ ...prev, aktiv: e.target.checked }))}
              />
              <span>Aktiv (sichtbar im Shop)</span>
            </label>
          </div>
        </div>

        <div className="editor-footer">
          <button className="btn-cancel" onClick={() => setShowProduktEditor(false)}>
            Abbrechen
          </button>
          <button className="btn-save" onClick={handleSaveProdukt} disabled={savingProdukt}>
            {savingProdukt ? (
              <><Loader2 size={18} className="spin" /> Speichern...</>
            ) : (
              <><Save size={18} /> Speichern</>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // HAUPTRENDER
  // ============================================================================

  // Loading State
  if (loadingData) {
    return (
      <div className="verband-shop">
        <div className="shop-loading">
          <Loader2 size={48} className="spin" />
          <p>Shop wird geladen...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="verband-shop">
        <div className="shop-error">
          <AlertCircle size={48} />
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Erneut versuchen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="verband-shop">
      {/* Header mit Suche und Warenkorb */}
      <div className="shop-header">
        <div className="shop-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Produkte suchen..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          className="btn-warenkorb"
          onClick={() => setShowWarenkorb(true)}
        >
          <ShoppingCart size={20} />
          {warenkorbAnzahl > 0 && (
            <span className="warenkorb-badge">{warenkorbAnzahl}</span>
          )}
        </button>
      </div>

      {/* Kategorien */}
      <div className="shop-kategorien">
        <button
          className={`kategorie-btn ${selectedKategorie === 'alle' ? 'active' : ''}`}
          onClick={() => setSelectedKategorie('alle')}
        >
          <Package size={18} />
          <span>Alle</span>
        </button>
        {kategorien.filter(kat => kat.isParent).map(kat => {
          const subKategorien = kategorien.filter(sub => sub.parentDbId === kat.dbId);
          const hasSubKategorien = subKategorien.length > 0;

          return (
            <div key={kat.id} className="kategorie-gruppe">
              {hasSubKategorien ? (
                // Dropdown für Kategorien mit Unterkategorien
                <div className="kategorie-dropdown">
                  <button
                    className={`kategorie-btn parent has-dropdown ${selectedKategorie === kat.id || subKategorien.some(s => s.id === selectedKategorie) ? 'active' : ''}`}
                    onClick={() => setExpandedKategorie(expandedKategorie === kat.id ? null : kat.id)}
                    style={{ '--kat-color': kat.color }}
                  >
                    <kat.icon size={18} />
                    <span>{kat.name}</span>
                    <ChevronDown size={14} className={`dropdown-arrow ${expandedKategorie === kat.id ? 'open' : ''}`} />
                  </button>
                  {expandedKategorie === kat.id && (
                    <div className="dropdown-menu">
                      <button
                        className={`dropdown-item ${selectedKategorie === kat.id ? 'active' : ''}`}
                        onClick={() => { setSelectedKategorie(kat.id); setExpandedKategorie(null); }}
                      >
                        Alle {kat.name}
                      </button>
                      {subKategorien.map(sub => {
                        const SubIcon = sub.icon;
                        return (
                          <button
                            key={sub.id}
                            className={`dropdown-item ${selectedKategorie === sub.id ? 'active' : ''}`}
                            onClick={() => { setSelectedKategorie(sub.id); setExpandedKategorie(null); }}
                            style={{ '--kat-color': sub.color }}
                          >
                            <SubIcon size={14} />
                            {sub.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                // Normale Kategorie ohne Unterkategorien
                <button
                  className={`kategorie-btn ${selectedKategorie === kat.id ? 'active' : ''}`}
                  onClick={() => setSelectedKategorie(kat.id)}
                  style={{ '--kat-color': kat.color }}
                >
                  <kat.icon size={18} />
                  <span>{kat.name}</span>
                </button>
              )}
            </div>
          );
        })}

        {/* Admin: Neues Produkt Button */}
        {isAdmin && (
          <button className="kategorie-btn admin-btn" onClick={handleNeuesProdukt}>
            <Plus size={18} />
            <span>Neu</span>
          </button>
        )}
      </div>

      {/* Featured Produkte (nur bei "Alle") */}
      {selectedKategorie === 'alle' && searchTerm === '' && (
        <div className="shop-featured">
          <h2><Star size={20} /> Beliebte Produkte</h2>
          <div className="featured-grid">
            {featuredProdukte.map(produkt => (
              <ProduktKarte key={produkt.id} produkt={produkt} />
            ))}
          </div>
        </div>
      )}

      {/* Produkt-Grid */}
      <div className="shop-produkte">
        {selectedKategorie !== 'alle' && (
          <h2>
            <KategorieIcon kategorie={selectedKategorie} size={24} />
            {kategorien.find(k => k.id === selectedKategorie)?.name}
          </h2>
        )}
        {searchTerm && (
          <p className="search-results">
            {gefilterteProdukte.length} Ergebnis(se) für "{searchTerm}"
          </p>
        )}
        <div className="produkte-grid">
          {gefilterteProdukte.map(produkt => (
            <ProduktKarte key={produkt.id} produkt={produkt} />
          ))}
        </div>
        {gefilterteProdukte.length === 0 && (
          <div className="keine-produkte">
            <Package size={48} />
            <p>Keine Produkte gefunden</p>
          </div>
        )}
      </div>

      {/* Versand-Info */}
      <div className="shop-versand-info">
        <div className="info-item">
          <Truck size={24} />
          <div>
            <strong>Kostenloser Versand</strong>
            <span>ab 50 € Bestellwert</span>
          </div>
        </div>
        <div className="info-item">
          <Shield size={24} />
          <div>
            <strong>Sichere Zahlung</strong>
            <span>Rechnung oder Vorkasse</span>
          </div>
        </div>
        <div className="info-item">
          <Clock size={24} />
          <div>
            <strong>Schnelle Lieferung</strong>
            <span>3-7 Werktage</span>
          </div>
        </div>
      </div>

      {/* Modals & Sidebars */}
      {showProduktDetail && <ProduktDetailModal produkt={showProduktDetail} />}
      <WarenkorbSidebar />
      {showCheckout && <CheckoutModal />}
      {bestellungErfolgreich && <BestellungErfolgreichModal />}

      {/* Stripe Payment Modal */}
      {showStripePayment && pendingOrder && (
        <div className="modal-overlay" onClick={() => setShowStripePayment(false)}>
          <div className="modal-content checkout-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowStripePayment(false)}>
              <X size={24} />
            </button>
            <h2><CreditCard size={24} /> Kartenzahlung</h2>
            <StripeCheckout
              amount={Math.round(gesamtSumme * 100)}
              description={`Shop-Bestellung: ${warenkorb.length} Artikel`}
              reference={`shop-order-${Date.now()}`}
              referenceType="shop"
              onSuccess={(paymentIntent) => submitOrder(pendingOrder, paymentIntent.id)}
              onCancel={() => {
                setShowStripePayment(false);
                setShowCheckout(true);
              }}
              successMessage="Zahlung erfolgreich! Ihre Bestellung wird bearbeitet."
            />
          </div>
        </div>
      )}
      {showProduktEditor && <ProduktEditorModal />}

      {/* Overlay für Warenkorb */}
      {showWarenkorb && (
        <div className="sidebar-overlay" onClick={() => setShowWarenkorb(false)} />
      )}
    </div>
  );
};

export default VerbandShop;
