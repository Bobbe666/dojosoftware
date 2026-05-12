// =====================================================================================
// BESTELLUNGEN TAB - ARTIKEL BESTELLSYSTEM
// =====================================================================================
// Bestellungen beim Lieferanten mit PDF-Generierung
// =====================================================================================

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import GiBestellvorlage from './GiBestellvorlage';
import { useDojoContext } from '../context/DojoContext';
import '../styles/BestellungenTab.css';

const STATUS_LABELS_DOJO = {
  bestellt: 'Bestellt', bestaetigt: 'Bestätigt', geliefert: 'Geliefert', storniert: 'Storniert',
};

const BestellungenTab = () => {
  const { activeDojo } = useDojoContext();

  // =====================================================================================
  // STATE
  // =====================================================================================

  const [activeSubTab, setActiveSubTab] = useState('shop');

  // Dojo-Bestellungen (gi_bestellungen)
  const [dojoBestellungen, setDojoBestellungen] = useState([]);
  const [dojoLoading, setDojoLoading] = useState(false);
  const [giOverlay, setGiOverlay] = useState(null); // { vorlage, editingId, formdata }

  const [lowStockItems, setLowStockItems] = useState([]);
  const [bestellungen, setBestellungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal States
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBestellung, setSelectedBestellung] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Neues Bestellformular
  const [orderForm, setOrderForm] = useState({
    lieferant_name: 'Pakistan Supplier',
    lieferant_land: 'Pakistan',
    lieferant_email: '',
    lieferant_telefon: '',
    bemerkungen: '',
    positionen: []
  });

  // =====================================================================================
  // API CALLS
  // =====================================================================================

  const apiCall = async (endpoint, options = {}) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/artikel-bestellungen${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // Artikel mit niedrigem Bestand laden
  const loadLowStockItems = useCallback(async () => {
    try {
      const response = await apiCall('/low-stock');
      setLowStockItems(response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Low-Stock-Artikel:', error);
    }
  }, []);

  // Bestellungen laden
  const loadBestellungen = useCallback(async () => {
    try {
      const response = await apiCall('');
      setBestellungen(response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Bestellungen:', error);
      setError('Fehler beim Laden der Bestellungen');
    }
  }, []);

  // Alles laden
  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadLowStockItems(), loadBestellungen()]);
    setLoading(false);
  }, [loadLowStockItems, loadBestellungen]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadDojoBestellungen = useCallback(async () => {
    const djId = activeDojo?.id;
    if (!djId) return;
    setDojoLoading(true);
    try {
      const res = await axios.get(`/gi-bestellungen?dojo_id=${djId}`);
      setDojoBestellungen(res.data?.data || []);
    } catch {}
    finally { setDojoLoading(false); }
  }, [activeDojo?.id]);

  useEffect(() => {
    if (activeSubTab === 'dojo') loadDojoBestellungen();
  }, [activeSubTab, loadDojoBestellungen]);

  const openGiBestellung = async (b) => {
    const djId = activeDojo?.id;
    try {
      let vorlage = null;
      if (b.vorlage_id && djId) {
        const res = await axios.get(`/bestellvorlagen/${b.vorlage_id}?dojo_id=${djId}`);
        vorlage = res.data?.data || null;
      }
      const formdata = typeof b.formdata === 'string' ? JSON.parse(b.formdata) : b.formdata;
      setGiOverlay({ vorlage, editingId: b.bestellung_id, formdata });
    } catch {}
  };

  // =====================================================================================
  // HANDLERS
  // =====================================================================================

  // Bestellung erstellen
  const handleCreateOrder = async () => {
    if (orderForm.positionen.length === 0) {
      alert('Bitte mindestens einen Artikel hinzufuegen');
      return;
    }

    try {
      setLoading(true);
      const response = await apiCall('', {
        method: 'POST',
        body: JSON.stringify(orderForm)
      });

      if (response.success) {
        setShowOrderModal(false);
        setOrderForm({
          lieferant_name: 'Pakistan Supplier',
          lieferant_land: 'Pakistan',
          lieferant_email: '',
          lieferant_telefon: '',
          bemerkungen: '',
          positionen: []
        });
        loadData();

        // PDF direkt generieren
        if (response.bestellung_id) {
          handleGeneratePdf(response.bestellung_id);
        }
      }
    } catch (error) {
      setError('Fehler beim Erstellen der Bestellung: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Artikel zum Bestellformular hinzufuegen
  const handleAddToOrder = (artikel) => {
    // Pruefe ob bereits in der Liste
    const existingIndex = orderForm.positionen.findIndex(p => p.artikel_id === artikel.artikel_id);

    if (existingIndex >= 0) {
      return; // Bereits hinzugefuegt
    }

    // Groessen ermitteln
    const allSizes = [];
    if (artikel.varianten_groessen && artikel.varianten_groessen.length > 0) {
      allSizes.push(...artikel.varianten_groessen);
    } else if (artikel.hat_preiskategorien) {
      if (artikel.groessen_kids) allSizes.push(...artikel.groessen_kids);
      if (artikel.groessen_erwachsene) allSizes.push(...artikel.groessen_erwachsene);
    }

    // Standard-Groessen falls keine definiert
    const defaultSizes = allSizes.length > 0 ? allSizes : ['S', 'M', 'L', 'XL', 'XXL'];

    // Initiale Mengen basierend auf niedrigem Bestand
    const groessenMengen = {};
    defaultSizes.forEach(size => {
      const currentStock = artikel.varianten_bestand?.[size] || 0;
      // Wenn Bestand < 2, schlage Auffuellung auf 10 vor
      groessenMengen[size] = currentStock < 2 ? Math.max(10 - currentStock, 5) : 0;
    });

    const neuePosition = {
      artikel_id: artikel.artikel_id,
      artikel_name: artikel.artikel_name,
      artikel_nummer: artikel.artikel_nummer,
      beschreibung: artikel.beschreibung || '',
      bild_url: artikel.bild_url || null,
      groessen_mengen: groessenMengen,
      stueckpreis_euro: artikel.einkaufspreis_euro || 0,
      bemerkung: ''
    };

    setOrderForm(prev => ({
      ...prev,
      positionen: [...prev.positionen, neuePosition]
    }));
  };

  // Menge fuer eine Groesse aendern
  const handleQuantityChange = (positionIndex, size, value) => {
    const newPositionen = [...orderForm.positionen];
    newPositionen[positionIndex].groessen_mengen[size] = parseInt(value) || 0;
    setOrderForm(prev => ({ ...prev, positionen: newPositionen }));
  };

  // Position entfernen
  const handleRemovePosition = (positionIndex) => {
    setOrderForm(prev => ({
      ...prev,
      positionen: prev.positionen.filter((_, i) => i !== positionIndex)
    }));
  };

  // Drucken (Browser-Druckdialog)
  const handlePrint = (bestellung) => {
    const formatDate = (d) => new Date(d).toLocaleDateString('de-DE');
    const b = bestellung;

    const itemRows = (b.positionen || []).map((pos, idx) => {
      const gm = pos.groessen_mengen || {};
      const sorted = Object.entries(gm)
        .filter(([, q]) => (parseInt(q) || 0) > 0)
        .sort((a, b) => {
          const an = parseInt(a[0]), bn = parseInt(b[0]);
          if (!isNaN(an) && !isNaN(bn)) return an - bn;
          if (!isNaN(an)) return -1;
          if (!isNaN(bn)) return 1;
          return a[0].localeCompare(b[0]);
        });

      const sizeHeaders = sorted.map(([s]) => `<th>${s}</th>`).join('');
      const sizeQtys = sorted.map(([, q]) => `<td><strong>${q}</strong></td>`).join('');
      const total = sorted.reduce((s, [, q]) => s + (parseInt(q) || 0), 0);

      const imgSrc = pos.bild_url ? (window.location.origin + pos.bild_url) : null;
      return `
        <div class="article-block">
          <div class="article-header">
            ${imgSrc ? `<img class="article-img" src="${imgSrc}" alt="${pos.artikel_name}" onerror="this.style.display='none'" />` : ''}
            <div class="article-header-text">
              <div class="article-title">${idx + 1}. ${pos.artikel_name}${pos.artikel_nummer ? ` <span class="art-nr">Art.-Nr: ${pos.artikel_nummer}</span>` : ''}</div>
              ${pos.beschreibung ? `<div class="article-desc">${pos.beschreibung}</div>` : ''}
            </div>
          </div>
          <table class="size-table">
            <thead><tr>${sizeHeaders}<th class="total-col">Gesamt</th>${pos.stueckpreis_euro > 0 ? '<th>Stückpreis</th><th>Summe</th>' : ''}</tr></thead>
            <tbody><tr>${sizeQtys}<td class="total-col"><strong>${total}</strong></td>${pos.stueckpreis_euro > 0 ? `<td>${pos.stueckpreis_euro?.toFixed(2)} €</td><td><strong>${pos.positions_preis_euro?.toFixed(2)} €</strong></td>` : ''}</tr></tbody>
          </table>
          ${pos.bemerkung ? `<div class="pos-note">Hinweis: ${pos.bemerkung}</div>` : ''}
        </div>`;
    }).join('');

    const totalVal = (b.positionen || []).reduce((s, p) => s + (p.positions_preis_euro || 0), 0);
    const totalPcs = (b.positionen || []).reduce((s, p) => {
      const gm = p.groessen_mengen || {};
      return s + Object.values(gm).reduce((a, q) => a + (parseInt(q) || 0), 0);
    }, 0);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bestellung ${b.bestellnummer}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; padding: 20mm; }
  h1 { font-size: 22pt; text-align: center; margin-bottom: 4px; }
  .order-no { text-align: center; font-size: 11pt; color: #444; margin-bottom: 16px; }
  .header-grid { display: flex; gap: 40px; margin-bottom: 20px; border-top: 2px solid #000; border-bottom: 1px solid #ccc; padding: 12px 0; }
  .header-grid > div { flex: 1; }
  .header-grid h3 { font-size: 8pt; text-transform: uppercase; color: #777; margin-bottom: 4px; }
  .header-grid p { font-size: 10pt; line-height: 1.5; }
  h2 { font-size: 13pt; border-bottom: 2px solid #000; padding-bottom: 4px; margin: 16px 0 10px; }
  .article-block { margin-bottom: 16px; page-break-inside: avoid; }
  .article-header { display: flex; gap: 12px; align-items: flex-start; background: #f0f0f0; padding: 6px 8px; }
  .article-img { width: 72px; height: 72px; object-fit: contain; border: 1px solid #ddd; background: #fff; flex-shrink: 0; }
  .article-header-text { flex: 1; }
  .article-title { font-size: 11pt; font-weight: bold; }
  .art-nr { font-weight: normal; font-size: 9pt; color: #666; margin-left: 8px; }
  .article-desc { font-size: 9pt; color: #444; border-left: 3px solid #ccc; padding-left: 6px; margin-top: 4px; }
  .size-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  .size-table th { background: #222; color: #fff; padding: 4px 6px; font-size: 9pt; text-align: center; }
  .size-table td { border: 1px solid #ddd; padding: 5px 6px; text-align: center; font-size: 10pt; }
  .total-col { background: #f5f5f5; font-weight: bold; }
  .pos-note { font-size: 8pt; color: #888; font-style: italic; padding: 2px 8px; }
  .totals { text-align: right; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
  .totals p { font-size: 12pt; }
  .remarks { margin-top: 16px; border: 1px solid #ccc; padding: 10px; }
  .remarks h3 { font-size: 10pt; margin-bottom: 4px; }
  .signature-row { display: flex; justify-content: space-between; margin-top: 40px; }
  .signature-box { width: 45%; border-top: 1px solid #000; padding-top: 4px; font-size: 9pt; color: #444; }
  .footer { margin-top: 20px; font-size: 8pt; color: #888; text-align: center; border-top: 1px solid #ddd; padding-top: 6px; }
  @media print { body { padding: 10mm; } }
</style></head><body>
<h1>PURCHASE ORDER</h1>
<div class="order-no">Order No: ${b.bestellnummer} &nbsp;|&nbsp; Date: ${formatDate(b.erstellt_am)}</div>
<div class="header-grid">
  <div><h3>From</h3><p><strong>${b.dojo_name || 'Martial Arts Academy'}</strong></p></div>
  <div><h3>To (Supplier)</h3>
    <p><strong>${b.lieferant_name || ''}</strong><br>${b.lieferant_land || ''}
    ${b.lieferant_email ? `<br>${b.lieferant_email}` : ''}
    ${b.lieferant_telefon ? `<br>${b.lieferant_telefon}` : ''}</p>
  </div>
</div>
<h2>Order Items</h2>
${itemRows}
<div class="totals">
  <p>Total Pieces: <strong>${totalPcs}</strong>${totalVal > 0 ? `&nbsp;&nbsp;|&nbsp;&nbsp;Total Value: <strong>${totalVal.toFixed(2)} EUR</strong>` : ''}</p>
</div>
${b.bemerkungen ? `<div class="remarks"><h3>Remarks / Special Instructions:</h3><p>${b.bemerkungen}</p></div>` : ''}
<div class="signature-row">
  <div class="signature-box">Authorized Signature</div>
  <div class="signature-box">Date</div>
</div>
<div class="footer">Please confirm receipt and provide expected dispatch date &amp; tracking. Generated: ${new Date().toLocaleString('de-DE')}</div>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  // PDF generieren
  const handleGeneratePdf = async (bestellungId) => {
    try {
      setPdfLoading(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/artikel-bestellungen/${bestellungId}/pdf`, {
        method: 'POST'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `order_${bestellungId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('PDF-Generierung fehlgeschlagen');
      }
    } catch (error) {
      setError('Fehler beim Generieren des PDFs: ' + error.message);
    } finally {
      setPdfLoading(false);
    }
  };

  // Bestellung anzeigen
  const handleViewOrder = async (bestellungId) => {
    try {
      const response = await apiCall(`/${bestellungId}`);
      if (response.success) {
        setSelectedBestellung(response.data);
        setShowDetailModal(true);
      }
    } catch (error) {
      setError('Fehler beim Laden der Bestellung');
    }
  };

  // Status aendern
  const handleStatusChange = async (bestellungId, newStatus) => {
    try {
      await apiCall(`/${bestellungId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus })
      });
      loadBestellungen();
      if (selectedBestellung?.bestellung_id === bestellungId) {
        handleViewOrder(bestellungId);
      }
    } catch (error) {
      setError('Fehler beim Aendern des Status');
    }
  };

  // =====================================================================================
  // RENDER HELPERS
  // =====================================================================================

  const getStatusBadge = (status) => {
    const statusConfig = {
      entwurf: { label: 'Entwurf', color: 'var(--text-muted)' },
      gesendet: { label: 'Gesendet', color: 'var(--warning)' },
      bestaetigt: { label: 'Bestaetigt', color: 'var(--info)' },
      versendet: { label: 'Versendet', color: '#8b5cf6' },
      geliefert: { label: 'Geliefert', color: 'var(--success)' },
      storniert: { label: 'Storniert', color: 'var(--error)' }
    };

    const config = statusConfig[status] || { label: status, color: 'var(--text-muted)' };

    return (
      <span
        className="status-badge"
        style={{ '--badge-color': config.color }}
      >
        {config.label}
      </span>
    );
  };

  // =====================================================================================
  // RENDER
  // =====================================================================================

  if (loading && bestellungen.length === 0) {
    return (
      <div className="bestellungen-tab">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Daten werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bestellungen-tab">

      {/* GI-Bestellvorlage Overlay */}
      {giOverlay && (
        <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-main,#0f0f1a)', zIndex: 20, overflowY: 'auto', padding: '1.25rem', borderRadius: 'inherit' }}>
          <GiBestellvorlage
            vorlage={giOverlay.vorlage}
            initEditingId={giOverlay.editingId}
            initFormdata={giOverlay.formdata}
            onClose={() => { setGiOverlay(null); loadDojoBestellungen(); }}
          />
        </div>
      )}

      {/* Sub-Tab Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
        <button
          onClick={() => setActiveSubTab('shop')}
          style={{ padding: '0.35rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
            background: activeSubTab === 'shop' ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
            color: activeSubTab === 'shop' ? 'rgba(212,175,55,1)' : 'rgba(255,255,255,0.5)',
            borderBottom: activeSubTab === 'shop' ? '2px solid rgba(212,175,55,0.7)' : '2px solid transparent',
          }}
        >Kunden / Shop</button>
        <button
          onClick={() => setActiveSubTab('dojo')}
          style={{ padding: '0.35rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
            background: activeSubTab === 'dojo' ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
            color: activeSubTab === 'dojo' ? 'rgba(212,175,55,1)' : 'rgba(255,255,255,0.5)',
            borderBottom: activeSubTab === 'dojo' ? '2px solid rgba(212,175,55,0.7)' : '2px solid transparent',
          }}
        >Dojo-Bestellungen (GI)</button>
      </div>

      {/* ── DOJO-BESTELLUNGEN TAB ── */}
      {activeSubTab === 'dojo' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Dojo-Bestellungen (Karate-Gi)</h2>
            <button onClick={loadDojoBestellungen} style={{ padding: '0.3rem 0.8rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', cursor: 'pointer' }}>
              Aktualisieren
            </button>
          </div>
          {dojoLoading ? (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', padding: '1rem 0' }}>Lädt…</div>
          ) : dojoBestellungen.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem', padding: '1rem 0' }}>
              Noch keine Dojo-Bestellungen. Bestellungen werden beim PDF-Generieren in der GI-Bestellvorlage gespeichert.
            </div>
          ) : (
            <div className="bestellungen-table-container">
              <table className="bestellungen-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Vorlage</th>
                    <th>Lieferant</th>
                    <th>Bestelldatum</th>
                    <th>Lieferdatum</th>
                    <th>Status</th>
                    <th>Gespeichert</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {dojoBestellungen.map(b => (
                    <tr key={b.bestellung_id}>
                      <td className="order-number" style={{ fontFamily: 'monospace', color: 'rgba(212,175,55,0.8)' }}>
                        #{String(b.bestellung_id).padStart(4, '0')}
                      </td>
                      <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                        {b.vorlage_id ? `Vorlage #${b.vorlage_id}` : '—'}
                      </td>
                      <td>{b.lieferant_name || b.lieferant_firmenname || '—'}</td>
                      <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>{b.bestelldatum || '—'}</td>
                      <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>{b.lieferdatum || '—'}</td>
                      <td>
                        <select
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', borderRadius: '4px', fontSize: '0.75rem', padding: '0.15rem 0.3rem' }}
                          value={b.status}
                          onChange={async (e) => {
                            try {
                              await axios.patch(`/gi-bestellungen/${b.bestellung_id}/status?dojo_id=${activeDojo?.id}`, { status: e.target.value });
                              setDojoBestellungen(prev => prev.map(x => x.bestellung_id === b.bestellung_id ? { ...x, status: e.target.value } : x));
                            } catch {}
                          }}
                        >
                          {Object.entries(STATUS_LABELS_DOJO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                        {b.erstellt_am ? new Date(b.erstellt_am).toLocaleDateString('de-DE') : '—'}
                      </td>
                      <td className="actions">
                        <button className="action-btn view" onClick={() => openGiBestellung(b)}>Öffnen</button>
                        <button className="action-btn" style={{ color: 'rgba(255,80,80,0.7)', background: 'none', border: '1px solid rgba(255,80,80,0.2)' }}
                          onClick={async () => {
                            if (!window.confirm(`Bestellung #${String(b.bestellung_id).padStart(4,'0')} wirklich löschen?`)) return;
                            try {
                              await axios.delete(`/gi-bestellungen/${b.bestellung_id}?dojo_id=${activeDojo?.id}`);
                              setDojoBestellungen(prev => prev.filter(x => x.bestellung_id !== b.bestellung_id));
                            } catch {}
                          }}
                        >Löschen</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SHOP-BESTELLUNGEN TAB ── */}
      {activeSubTab === 'shop' && <>

      {/* Fehler-Anzeige */}
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError(null)}>x</button>
        </div>
      )}

      {/* Low Stock Warning */}
      {lowStockItems.length > 0 && (
        <div className="low-stock-warning">
          <div className="warning-header">
            <span className="warning-icon">!</span>
            <h3>Niedriger Lagerbestand - Nachbestellung empfohlen</h3>
            <span className="warning-count">{lowStockItems.length} Artikel</span>
          </div>

          <div className="low-stock-grid">
            {lowStockItems.slice(0, 6).map(item => (
              <div key={item.artikel_id} className="low-stock-item">
                <div className="item-info">
                  <span className="item-name bt-item-name">
                    {item.artikel_name || 'Unbenannter Artikel'}
                  </span>
                  {item.artikel_nummer && (
                    <span className="item-number bt-item-number">
                      #{item.artikel_nummer}
                    </span>
                  )}
                </div>

                <div className="item-stock u-mt-05">
                  {item.hat_varianten && item.low_sizes ? (
                    <div className="size-stock">
                      {item.low_sizes.slice(0, 3).map(({ size, qty }) => (
                        <span key={size} className="size-badge critical">
                          {size}: {qty}
                        </span>
                      ))}
                      {item.low_sizes.length > 3 && (
                        <span className="size-badge more">+{item.low_sizes.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    <span className="stock-count critical bt-stock-critical">
                      Bestand: {item.lagerbestand}
                    </span>
                  )}
                </div>

                <button
                  className="add-to-order-btn"
                  onClick={() => {
                    handleAddToOrder(item);
                    setShowOrderModal(true);
                  }}
                  title="Zur Bestellung hinzufuegen"
                >
                  +
                </button>
              </div>
            ))}
          </div>

          {lowStockItems.length > 6 && (
            <button
              className="show-all-btn"
              onClick={() => setShowOrderModal(true)}
            >
              Alle {lowStockItems.length} Artikel anzeigen
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="bestellungen-header">
        <h2>Bestellungen</h2>
        <button
          className="new-order-btn"
          onClick={() => setShowOrderModal(true)}
        >
          + Neue Bestellung
        </button>
      </div>

      {/* Bestellungen Liste */}
      <div className="bestellungen-table-container">
        <table className="bestellungen-table">
          <thead>
            <tr>
              <th>Bestellnummer</th>
              <th>Lieferant</th>
              <th>Positionen</th>
              <th>Betrag</th>
              <th>Status</th>
              <th>Erstellt</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {bestellungen.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-row">
                  Keine Bestellungen vorhanden
                </td>
              </tr>
            ) : (
              bestellungen.map(bestellung => (
                <tr key={bestellung.bestellung_id}>
                  <td className="order-number">{bestellung.bestellnummer}</td>
                  <td>
                    {bestellung.lieferant_name}
                    <br />
                    <small>{bestellung.lieferant_land}</small>
                  </td>
                  <td>{bestellung.anzahl_positionen} Artikel</td>
                  <td className="amount">{bestellung.gesamtbetrag_euro?.toFixed(2)} EUR</td>
                  <td>{getStatusBadge(bestellung.status)}</td>
                  <td>
                    {new Date(bestellung.erstellt_am).toLocaleDateString('de-DE')}
                  </td>
                  <td className="actions">
                    <button
                      className="action-btn view"
                      onClick={() => handleViewOrder(bestellung.bestellung_id)}
                      title="Details"
                    >
                      Details
                    </button>
                    <button
                      className="action-btn pdf"
                      onClick={() => handleGeneratePdf(bestellung.bestellung_id)}
                      disabled={pdfLoading}
                      title="PDF"
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Neues Bestellung Modal */}
      {showOrderModal && (
        <div className="modal-overlay" onClick={() => setShowOrderModal(false)}>
          <div className="om-modal" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="om-modal__header">
              <div className="om-modal__title-group">
                <span className="om-modal__title">Neue Bestellung</span>
                <span className="om-modal__count">
                  {orderForm.positionen.length} {orderForm.positionen.length === 1 ? 'Position' : 'Positionen'}
                </span>
              </div>
              <button className="om-modal__close" onClick={() => setShowOrderModal(false)}>✕</button>
            </div>

            {/* Two-column body */}
            <div className="om-modal__body">

              {/* LEFT: Lieferant + Bemerkungen */}
              <div className="om-col">
                <p className="om-col__label">Lieferant</p>

                <div className="om-field">
                  <label className="om-field__label">Name</label>
                  <input className="om-field__input" type="text"
                    value={orderForm.lieferant_name}
                    onChange={e => setOrderForm(prev => ({ ...prev, lieferant_name: e.target.value }))}
                  />
                </div>
                <div className="om-field">
                  <label className="om-field__label">Land</label>
                  <input className="om-field__input" type="text"
                    value={orderForm.lieferant_land}
                    onChange={e => setOrderForm(prev => ({ ...prev, lieferant_land: e.target.value }))}
                  />
                </div>
                <div className="om-field">
                  <label className="om-field__label">E-Mail</label>
                  <input className="om-field__input" type="email"
                    value={orderForm.lieferant_email}
                    onChange={e => setOrderForm(prev => ({ ...prev, lieferant_email: e.target.value }))}
                  />
                </div>
                <div className="om-field">
                  <label className="om-field__label">Telefon</label>
                  <input className="om-field__input" type="text"
                    value={orderForm.lieferant_telefon}
                    onChange={e => setOrderForm(prev => ({ ...prev, lieferant_telefon: e.target.value }))}
                  />
                </div>

                <p className="om-col__label" style={{marginTop:'1.25rem'}}>Bemerkungen</p>
                <textarea className="om-field__textarea"
                  rows="4"
                  placeholder="Hinweise für den Lieferanten..."
                  value={orderForm.bemerkungen}
                  onChange={e => setOrderForm(prev => ({ ...prev, bemerkungen: e.target.value }))}
                />
              </div>

              {/* RIGHT: Artikel-Auswahl + Positionen */}
              <div className="om-col om-col--right">
                {/* Nachzubestellende Artikel als Chips */}
                {lowStockItems.length > 0 && (
                  <>
                    <p className="om-col__label">Verfügbare Artikel</p>
                    <div className="om-chips">
                      {lowStockItems.map(item => {
                        const isAdded = orderForm.positionen.some(p => p.artikel_id === item.artikel_id);
                        return (
                          <button
                            key={item.artikel_id}
                            className={`om-chip ${isAdded ? 'om-chip--added' : ''}`}
                            onClick={() => !isAdded && handleAddToOrder(item)}
                            disabled={isAdded}
                          >
                            {isAdded && <span className="om-chip__check">✓</span>}
                            <span>{item.artikel_name}</span>
                            <span className="om-chip__stock">Bestand: {item.lagerbestand}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Bestellpositionen */}
                <p className="om-col__label" style={{marginTop: lowStockItems.length > 0 ? '1.25rem' : 0}}>
                  Positionen
                </p>
                {orderForm.positionen.length === 0 ? (
                  <div className="om-empty">
                    Noch keine Artikel hinzugefügt
                  </div>
                ) : (
                  <div className="om-positions">
                    {orderForm.positionen.map((position, posIndex) => (
                      <div key={posIndex} className="om-position">
                        <div className="om-position__head">
                          {position.bild_url && (
                            <img src={position.bild_url} alt={position.artikel_name}
                              className="om-position__img"
                              onError={e => e.target.style.display='none'}
                            />
                          )}
                          <span className="om-position__name">{position.artikel_name}</span>
                          {position.artikel_nummer && (
                            <span className="om-position__nr">#{position.artikel_nummer}</span>
                          )}
                          <button className="om-position__remove" onClick={() => handleRemovePosition(posIndex)}>✕</button>
                        </div>

                        {Object.keys(position.groessen_mengen).length > 0 && (
                          <div className="om-position__sizes">
                            {Object.entries(position.groessen_mengen).map(([size, qty]) => (
                              <div key={size} className="om-position__size-row">
                                <span className="om-position__size-label">{size}</span>
                                <input className="om-position__size-input" type="number" min="0"
                                  value={qty}
                                  onChange={e => handleQuantityChange(posIndex, size, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="om-position__meta">
                          <div className="om-field om-field--inline">
                            <label className="om-field__label">Stückpreis €</label>
                            <input className="om-field__input" type="number" step="0.01"
                              value={position.stueckpreis_euro}
                              onChange={e => {
                                const p = [...orderForm.positionen];
                                p[posIndex].stueckpreis_euro = parseFloat(e.target.value) || 0;
                                setOrderForm(prev => ({ ...prev, positionen: p }));
                              }}
                            />
                          </div>
                          <div className="om-field om-field--inline">
                            <label className="om-field__label">Anmerkung</label>
                            <input className="om-field__input" type="text" placeholder="Hinweise..."
                              value={position.bemerkung}
                              onChange={e => {
                                const p = [...orderForm.positionen];
                                p[posIndex].bemerkung = e.target.value;
                                setOrderForm(prev => ({ ...prev, positionen: p }));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="om-modal__footer">
              <button className="om-btn om-btn--cancel" onClick={() => setShowOrderModal(false)}>
                Abbrechen
              </button>
              <button className="om-btn om-btn--submit" onClick={handleCreateOrder}
                disabled={orderForm.positionen.length === 0}>
                Bestellung erstellen & PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedBestellung && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Order {selectedBestellung.bestellnummer}</h2>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>x</button>
            </div>

            <div className="modal-body">
              {/* Status */}
              <div className="detail-section">
                <div className="status-row">
                  <span>Status:</span>
                  {getStatusBadge(selectedBestellung.status)}
                </div>

                <div className="status-actions">
                  {selectedBestellung.status === 'entwurf' && (
                    <button onClick={() => handleStatusChange(selectedBestellung.bestellung_id, 'gesendet')}>
                      Mark as Sent
                    </button>
                  )}
                  {selectedBestellung.status === 'gesendet' && (
                    <button onClick={() => handleStatusChange(selectedBestellung.bestellung_id, 'bestaetigt')}>
                      Mark as Confirmed
                    </button>
                  )}
                  {selectedBestellung.status === 'bestaetigt' && (
                    <button onClick={() => handleStatusChange(selectedBestellung.bestellung_id, 'versendet')}>
                      Mark as Shipped
                    </button>
                  )}
                  {selectedBestellung.status === 'versendet' && (
                    <button onClick={() => handleStatusChange(selectedBestellung.bestellung_id, 'geliefert')}>
                      Mark as Delivered
                    </button>
                  )}
                </div>
              </div>

              {/* Lieferant */}
              <div className="detail-section">
                <h3>Supplier</h3>
                <p><strong>{selectedBestellung.lieferant_name}</strong></p>
                <p>{selectedBestellung.lieferant_land}</p>
                {selectedBestellung.lieferant_email && <p>Email: {selectedBestellung.lieferant_email}</p>}
                {selectedBestellung.lieferant_telefon && <p>Phone: {selectedBestellung.lieferant_telefon}</p>}
              </div>

              {/* Positionen */}
              <div className="detail-section">
                <h3>Order Items</h3>
                <table className="detail-table">
                  <thead>
                    <tr>
                      <th>Article</th>
                      <th>Sizes & Quantities</th>
                      <th>Total Qty</th>
                      <th>Unit Price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBestellung.positionen?.map((pos, idx) => (
                      <tr key={idx}>
                        <td>
                          <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                            {pos.bild_url && (
                              <img
                                src={pos.bild_url}
                                alt={pos.artikel_name}
                                style={{width:52,height:52,objectFit:'contain',border:'1px solid var(--border-color)',borderRadius:4,background:'var(--bg-secondary)',flexShrink:0}}
                                onError={e => e.target.style.display='none'}
                              />
                            )}
                            <div>
                              <div>{pos.artikel_name}</div>
                              {pos.artikel_nummer && <small style={{color:'var(--text-muted)'}}>#{pos.artikel_nummer}</small>}
                              {pos.beschreibung && <div style={{fontSize:'0.8em',color:'var(--text-muted)',marginTop:3}}>{pos.beschreibung}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="size-list">
                            {Object.entries(pos.groessen_mengen || {})
                              .filter(([_, qty]) => (parseInt(qty)||0) > 0)
                              .sort((a, b) => {
                                const an = parseInt(a[0]), bn = parseInt(b[0]);
                                if (!isNaN(an) && !isNaN(bn)) return an - bn;
                                if (!isNaN(an)) return -1;
                                if (!isNaN(bn)) return 1;
                                return a[0].localeCompare(b[0]);
                              })
                              .map(([size, qty]) => (
                                <span key={size} className="size-badge">
                                  {size}: {qty}
                                </span>
                              ))
                            }
                          </div>
                        </td>
                        <td>{pos.gesamt_menge}</td>
                        <td>{pos.stueckpreis_euro?.toFixed(2)} EUR</td>
                        <td>{pos.positions_preis_euro?.toFixed(2)} EUR</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" className="total-label">TOTAL:</td>
                      <td className="total-value">{selectedBestellung.gesamtbetrag_euro?.toFixed(2)} EUR</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Bemerkungen */}
              {selectedBestellung.bemerkungen && (
                <div className="detail-section">
                  <h3>Remarks</h3>
                  <p>{selectedBestellung.bemerkungen}</p>
                </div>
              )}

              {/* Daten */}
              <div className="detail-section dates">
                <div>Created: {new Date(selectedBestellung.erstellt_am).toLocaleString('de-DE')}</div>
                {selectedBestellung.gesendet_am && (
                  <div>Sent: {new Date(selectedBestellung.gesendet_am).toLocaleString('de-DE')}</div>
                )}
                {selectedBestellung.geliefert_am && (
                  <div>Delivered: {new Date(selectedBestellung.geliefert_am).toLocaleString('de-DE')}</div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="close-btn-footer" onClick={() => setShowDetailModal(false)}>
                Schließen
              </button>
              <button
                className="print-btn"
                onClick={() => handlePrint(selectedBestellung)}
                title="Druckansicht öffnen"
              >
                Drucken
              </button>
              <button
                className="pdf-btn"
                onClick={() => handleGeneratePdf(selectedBestellung.bestellung_id)}
                disabled={pdfLoading}
              >
                {pdfLoading ? 'Generiere...' : 'PDF herunterladen'}
              </button>
            </div>
          </div>
        </div>
      )}

      </> /* end activeSubTab === 'shop' */}

    </div>
  );
};

export default BestellungenTab;
