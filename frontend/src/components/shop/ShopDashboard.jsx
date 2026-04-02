import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useDojoContext } from '../../context/DojoContext';
import ShopProduktVerwaltung from './ShopProduktVerwaltung';
import ShopKategorienVerwaltung from './ShopKategorienVerwaltung';
import ShopBestellungenVerwaltung from './ShopBestellungenVerwaltung';
import ShopEinstellungen from './ShopEinstellungen';
import '../../styles/Shop.css';

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'produkte',  label: '📦 Produkte' },
  { id: 'kategorien', label: '🏷️ Kategorien' },
  { id: 'bestellungen', label: '🛒 Bestellungen' },
  { id: 'einstellungen', label: '⚙️ Einstellungen' },
];

export default function ShopDashboard() {
  const { user } = useAuth();
  const { dojos, activeDojo } = useDojoContext();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = (user?.role === 'admin' || user?.rolle === 'admin') && !user?.dojo_id;

  // Ermittle die Dojo-ID für den Shop:
  // - Regulärer Dojo-Admin: activeDojo.id
  // - Super-Admin im Shop-Modus: erstes/Haupt-Dojo aus der Dojo-Liste
  const shopDojoId = activeDojo?.id
    || (isSuperAdmin ? (dojos?.find(d => d.ist_hauptdojo)?.id || dojos?.[0]?.id || null) : null);

  // Shop-URL für öffentliche Vorschau
  const shopUrl = shopDojoId ? `/shop/${shopDojoId}` : '/shop/tda';

  // Query-Param für Super-Admin API-Aufrufe
  const dojoParam = (isSuperAdmin && shopDojoId) ? `?dojo_id=${shopDojoId}` : '';

  useEffect(() => {
    if (activeTab === 'dashboard') loadStats();
  }, [activeTab, shopDojoId]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/shop/admin/dashboard${dojoParam}`);
      setStats(data);
    } catch (err) {
      console.error('Shop-Dashboard Fehler:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatEur = (cent) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((cent || 0) / 100);

  return (
    <div className="shop-admin">
      {/* Tab-Navigation */}
      <div className="shop-admin-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`shop-admin-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}

        <a
          href={shopUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shop-admin-preview-btn"
        >
          🔗 Shop öffnen
        </a>
      </div>

      {/* Dashboard-Übersicht */}
      {activeTab === 'dashboard' && (
        <div className="shop-admin-content">
          <h2>Shop-Übersicht</h2>

          {loading ? (
            <div className="shop-loading">Lade Statistiken...</div>
          ) : stats ? (
            <>
              <div className="shop-kpi-grid">
                <div className="shop-kpi-card">
                  <div className="shop-kpi-value">{stats.stats?.bestellungen_heute || 0}</div>
                  <div className="shop-kpi-label">Bestellungen heute</div>
                </div>
                <div className="shop-kpi-card">
                  <div className="shop-kpi-value">{stats.stats?.bestellungen_woche || 0}</div>
                  <div className="shop-kpi-label">Diese Woche</div>
                </div>
                <div className="shop-kpi-card">
                  <div className="shop-kpi-value">{formatEur(stats.stats?.umsatz_monat_cent)}</div>
                  <div className="shop-kpi-label">Umsatz (30 Tage)</div>
                </div>
                <div className="shop-kpi-card shop-kpi-card--warn">
                  <div className="shop-kpi-value">{stats.stats?.offene_bestellungen || 0}</div>
                  <div className="shop-kpi-label">Offene Bestellungen</div>
                </div>
              </div>

              {stats.artikel_stats && (
                <div className="shop-kpi-grid" style={{ marginTop: '0.5rem' }}>
                  <div className="shop-kpi-card shop-kpi-card--subtle">
                    <div className="shop-kpi-value">{stats.artikel_stats.shop_aktiv_artikel || 0}</div>
                    <div className="shop-kpi-label">Produkte im Shop</div>
                  </div>
                  <div className="shop-kpi-card shop-kpi-card--subtle">
                    <div className="shop-kpi-value">{stats.artikel_stats.gesamt_artikel || 0}</div>
                    <div className="shop-kpi-label">Artikel gesamt</div>
                  </div>
                </div>
              )}

              {stats.top_produkte?.length > 0 && (
                <div className="shop-top-produkte">
                  <h3>Top-Produkte (30 Tage)</h3>
                  <table className="shop-table">
                    <thead>
                      <tr><th>Produkt</th><th>Verkauft</th><th>Umsatz</th></tr>
                    </thead>
                    <tbody>
                      {stats.top_produkte.map((p, i) => (
                        <tr key={i}>
                          <td>{p.produkt_name}</td>
                          <td>{p.verkauft}×</td>
                          <td>{formatEur(p.umsatz_cent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="shop-quick-actions">
                <button className="btn-primary" onClick={() => setActiveTab('bestellungen')}>
                  🛒 Bestellungen ansehen
                </button>
                <button className="btn-secondary" onClick={() => setActiveTab('produkte')}>
                  📦 Produkt hinzufügen
                </button>
              </div>
            </>
          ) : (
            <div className="shop-empty">Keine Daten verfügbar</div>
          )}
        </div>
      )}

      {activeTab === 'produkte' && <ShopProduktVerwaltung dojoId={shopDojoId} dojoParam={dojoParam} />}
      {activeTab === 'kategorien' && <ShopKategorienVerwaltung dojoId={shopDojoId} dojoParam={dojoParam} />}
      {activeTab === 'bestellungen' && <ShopBestellungenVerwaltung dojoId={shopDojoId} dojoParam={dojoParam} />}
      {activeTab === 'einstellungen' && <ShopEinstellungen dojoId={shopDojoId} dojoParam={dojoParam} />}
    </div>
  );
}
