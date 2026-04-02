/**
 * localStorage-basierter Warenkorb-Hook
 * Schlüssel: shop_cart_${dojoId}
 */
import { useState, useCallback } from 'react';

export function useCart(dojoId) {
  const storageKey = `shop_cart_${dojoId}`;

  const getCart = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch {
      return [];
    }
  }, [storageKey]);

  const [cart, setCartState] = useState(getCart);

  const saveCart = useCallback((items) => {
    localStorage.setItem(storageKey, JSON.stringify(items));
    setCartState(items);
  }, [storageKey]);

  const addToCart = useCallback((produkt, optionen = {}, mitglied_id = null, personalisierung = null) => {
    const current = getCart();
    // Gleiche Produkt+Optionen Kombination zusammenführen
    const key = `${produkt.id}_${JSON.stringify(optionen)}`;
    const existing = current.find(item => item._key === key);

    if (existing) {
      saveCart(current.map(item =>
        item._key === key ? { ...item, menge: item.menge + 1 } : item
      ));
    } else {
      saveCart([...current, {
        _key: key,
        produkt_id: produkt.id,
        name: produkt.name,
        preis: parseFloat(produkt.preis),
        bild_url: produkt.bild_url || null,
        typ: produkt.typ || 'standard',
        menge: 1,
        optionen,
        mitglied_id,
        personalisierung
      }]);
    }
  }, [getCart, saveCart]);

  const updateMenge = useCallback((key, menge) => {
    const current = getCart();
    if (menge <= 0) {
      saveCart(current.filter(item => item._key !== key));
    } else {
      saveCart(current.map(item => item._key === key ? { ...item, menge } : item));
    }
  }, [getCart, saveCart]);

  const removeFromCart = useCallback((key) => {
    saveCart(getCart().filter(item => item._key !== key));
  }, [getCart, saveCart]);

  const clearCart = useCallback(() => {
    saveCart([]);
  }, [saveCart]);

  const getCartCount = useCallback(() => {
    return cart.reduce((sum, item) => sum + item.menge, 0);
  }, [cart]);

  const getCartTotal = useCallback((versandkostenfreiAb = 5000, standardVersand = 495) => {
    const zwischensumme = cart.reduce((sum, item) => sum + item.preis * item.menge * 100, 0);
    const versandkosten = zwischensumme >= versandkostenfreiAb ? 0 : standardVersand;
    return {
      zwischensumme_cent: Math.round(zwischensumme),
      versandkosten_cent: versandkosten,
      gesamt_cent: Math.round(zwischensumme) + versandkosten
    };
  }, [cart]);

  return {
    cart,
    addToCart,
    updateMenge,
    removeFromCart,
    clearCart,
    getCartCount,
    getCartTotal
  };
}
