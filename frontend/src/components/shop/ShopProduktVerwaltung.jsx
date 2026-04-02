import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../../styles/ArtikelVerwaltung.css';

const LEER_FORM = {
  name: '',
  artikel_nummer: '',
  beschreibung: '',
  preis: '',
  artikelgruppe_id: '',
  bild_url: '',
  lager_tracking: false,
  lagerbestand: 0,
  sichtbar_kasse: true,
};

function LagerStatus({ art }) {
  if (!art.aktiv) return <span className="lager-status archived">Archiviert</span>;
  if (!art.lager_tracking) return <span className="lager-status unlimited">Unbegrenzt</span>;
  if ((art.lagerbestand ?? 0) <= 0) return <span className="lager-status out-of-stock">Ausverkauft</span>;
  return <span className="lager-status in-stock">Verfügbar</span>;
}

export default function ShopProduktVerwaltung({ dojoId, dojoParam = '' }) {
  const [artikel, setArtikel] = useState([]);
  const [gruppen, setGruppen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editArtikel, setEditArtikel] = useState(null);
  const [form, setForm] = useState(LEER_FORM);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedGruppe, setSelectedGruppe] = useState(null); // null=alle, id=gruppe, 'none'=ohne

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [artRes, katRes] = await Promise.all([
        axios.get(`/shop/admin/produkte${dojoParam}`),
        axios.get(`/shop/admin/kategorien${dojoParam}`)
      ]);
      setArtikel(artRes.data.filter(a => a.shop_aktiv));
      setGruppen(katRes.data);
    } catch {
      setError('Fehler beim Laden der Produkte');
    } finally {
      setLoading(false);
    }
  }, [dojoParam]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditArtikel(null);
    setForm(LEER_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (a) => {
    setEditArtikel(a);
    setForm({
      name: a.name,
      artikel_nummer: a.artikel_nummer || '',
      beschreibung: a.beschreibung || '',
      preis: (a.verkaufspreis_cent / 100).toFixed(2),
      artikelgruppe_id: a.kategorie_id ? String(a.kategorie_id) : '',
      bild_url: a.bild_url || '',
      lager_tracking: !!a.lager_tracking,
      lagerbestand: a.lager_tracking ? (a.lagerbestand ?? 0) : 0,
      sichtbar_kasse: a.sichtbar_kasse !== 0,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Name ist Pflichtfeld'); return; }
    if (!form.preis || isNaN(parseFloat(form.preis))) { setFormError('Preis fehlt oder ungültig'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        artikelgruppe_id: form.artikelgruppe_id ? parseInt(form.artikelgruppe_id, 10) : null,
        lagerbestand: form.lager_tracking ? parseInt(form.lagerbestand, 10) : 0,
      };
      if (editArtikel) {
        await axios.put(`/shop/admin/produkte/${editArtikel.artikel_id}${dojoParam}`, payload);
      } else {
        await axios.post(`/shop/admin/produkte${dojoParam}`, payload);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromShop = async (art) => {
    if (!window.confirm(`"${art.name}" aus dem Shop entfernen?\n(Bleibt in der Artikelverwaltung erhalten)`)) return;
    try {
      await axios.delete(`/shop/admin/produkte/${art.artikel_id}${dojoParam}`);
      setArtikel(prev => prev.filter(a => a.artikel_id !== art.artikel_id));
    } catch {
      alert('Fehler beim Entfernen');
    }
  };

  const handleToggleKasse = async (art) => {
    if (toggling) return;
    setToggling(art.artikel_id);
    try {
      await axios.put(`/shop/admin/produkte/${art.artikel_id}${dojoParam}`, {
        name: art.name,
        artikel_nummer: art.artikel_nummer,
        beschreibung: art.beschreibung,
        preis: art.verkaufspreis_cent / 100,
        artikelgruppe_id: art.kategorie_id || null,
        bild_url: art.bild_url,
        lager_tracking: art.lager_tracking,
        lagerbestand: art.lagerbestand,
        sichtbar_kasse: !art.sichtbar_kasse,
      });
      setArtikel(prev => prev.map(a =>
        a.artikel_id === art.artikel_id ? { ...a, sichtbar_kasse: !a.sichtbar_kasse } : a
      ));
    } catch {
      alert('Fehler beim Ändern');
    } finally {
      setToggling(null);
    }
  };

  // Gruppen-Zählung basierend auf kategorie_id
  const gruppenMitAnzahl = gruppen.map(g => ({
    ...g,
    count: artikel.filter(a => String(a.kategorie_id) === String(g.id)).length
  })).filter(g => g.count > 0);

  const ohneGruppeCount = artikel.filter(a => !a.kategorie_id).length;

  // Filter
  const filtered = artikel.filter(a => {
    if (selectedGruppe === 'none' && a.kategorie_id) return false;
    if (selectedGruppe !== null && selectedGruppe !== 'none' && String(a.kategorie_id) !== String(selectedGruppe)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !(a.artikel_nummer || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return <div className="shop-loading">Lade Produkte...</div>;

  return (
    <div className="shop-admin-content">
      {/* Header */}
      <div className="shop-admin-header">
        <div>
          <h2>Shop-Produkte ({filtered.length})</h2>
          <p className="shop-admin-subtitle">
            Produkte hier anlegen — "Im Dojo-Shop (Kasse)" macht sie auch im internen System sichtbar
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Produkt hinzufügen</button>
      </div>

      {error && <div className="shop-error">{error}</div>}

      {/* ArtikelVerwaltung-style Layout */}
      <div className="av-layout">

        {/* Sidebar: Artikelgruppen */}
        <aside className="av-sidebar">
          <div className="av-sidebar-title">Artikelgruppen</div>

          <button
            className={`av-sidebar-item ${selectedGruppe === null ? 'active' : ''}`}
            onClick={() => setSelectedGruppe(null)}
          >
            <span>Alle Artikel</span>
            <span className="av-sidebar-count">{artikel.length}</span>
          </button>

          {gruppenMitAnzahl.map(g => (
            <button
              key={g.id}
              className={`av-sidebar-item ${selectedGruppe == g.id ? 'active' : ''}`}
              onClick={() => setSelectedGruppe(g.id)}
            >
              <span>{g.icon ? `${g.icon} ` : ''}{g.name}</span>
              <span className="av-sidebar-count">{g.count}</span>
            </button>
          ))}

          {ohneGruppeCount > 0 && (
            <button
              className={`av-sidebar-item ${selectedGruppe === 'none' ? 'active' : ''}`}
              onClick={() => setSelectedGruppe('none')}
            >
              <span>Ohne Gruppe</span>
              <span className="av-sidebar-count">{ohneGruppeCount}</span>
            </button>
          )}
        </aside>

        {/* Hauptinhalt */}
        <div className="av-content">

          {/* Suchleiste */}
          <div className="controls-section">
            <div className="search-filters">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Produkt suchen..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <span className="search-icon">🔍</span>
              </div>
            </div>
          </div>

          {/* Tabelle */}
          <div className="artikel-table-container">
            <table className="artikel-table">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>Preis</th>
                  <th>Bestand</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Im Kasse</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <p>Keine Produkte im Shop.</p>
                        <button className="sub-tab-btn" onClick={openCreate}>
                          Erstes Produkt anlegen
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(a => (
                  <tr key={a.artikel_id}>
                    {/* Produkt-Info */}
                    <td className="artikel-info">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        {a.bild_url && (
                          <img
                            src={a.bild_url}
                            alt=""
                            style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0, marginTop: 2 }}
                          />
                        )}
                        <div>
                          <div className="artikel-name">{a.name}</div>
                          {a.artikel_nummer && (
                            <div className="artikel-details">#{a.artikel_nummer}</div>
                          )}
                          <div className="artikel-badges">
                            {a.kategorie_name && (
                              <span className="artikelgruppe-badge">{a.kategorie_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Preis */}
                    <td className="preis-cell">
                      {(a.verkaufspreis_cent / 100).toFixed(2)} €
                    </td>

                    {/* Bestand */}
                    <td className="lager-info">
                      <div className="lagerbestand">
                        {a.lager_tracking ? (a.lagerbestand ?? 0) : '∞'}
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <LagerStatus art={a} />
                    </td>

                    {/* Im Kasse */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className={`shop-toggle-btn ${a.sichtbar_kasse ? 'shop-toggle-btn--on' : ''}`}
                        onClick={() => handleToggleKasse(a)}
                        disabled={toggling === a.artikel_id}
                        title={a.sichtbar_kasse ? 'Im Kassensystem sichtbar' : 'Nicht im Kassensystem'}
                      >
                        {toggling === a.artikel_id ? '...' : a.sichtbar_kasse ? '🟢' : '⚫'}
                      </button>
                    </td>

                    {/* Aktionen */}
                    <td className="actions">
                      <button
                        className="av-btn-sm"
                        onClick={() => openEdit(a)}
                        title="Bearbeiten"
                      >
                        ✏️
                      </button>
                      <button
                        className="av-btn-sm"
                        onClick={() => handleRemoveFromShop(a)}
                        title="Aus Shop entfernen"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Produkt-Modal */}
      {showModal && (
        <div className="shop-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="shop-modal shop-modal--lg" onClick={e => e.stopPropagation()}>
            <div className="shop-modal-header">
              <h3>{editArtikel ? 'Produkt bearbeiten' : 'Neues Produkt'}</h3>
              <button className="shop-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="shop-modal-body">
              {formError && <div className="shop-error">{formError}</div>}

              <div className="shop-form-grid">
                <div className="shop-form-group shop-form-group--full">
                  <label>Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Produktname"
                    autoFocus
                  />
                </div>

                <div className="shop-form-group">
                  <label>Artikel-Nr.</label>
                  <input
                    value={form.artikel_nummer}
                    onChange={e => setForm(f => ({ ...f, artikel_nummer: e.target.value }))}
                    placeholder="z.B. GI-001"
                  />
                </div>

                <div className="shop-form-group">
                  <label>Gruppe</label>
                  <select
                    value={form.artikelgruppe_id}
                    onChange={e => setForm(f => ({ ...f, artikelgruppe_id: e.target.value }))}
                  >
                    <option value="">— Keine Gruppe —</option>
                    {gruppen.map(g => (
                      <option key={g.id} value={String(g.id)}>
                        {g.icon ? `${g.icon} ` : ''}{g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="shop-form-group">
                  <label>Preis (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.preis}
                    onChange={e => setForm(f => ({ ...f, preis: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>

                <div className="shop-form-group shop-form-group--full">
                  <label>Bild-URL</label>
                  <input
                    value={form.bild_url}
                    onChange={e => setForm(f => ({ ...f, bild_url: e.target.value }))}
                    placeholder="https://..."
                  />
                  {form.bild_url && (
                    <img
                      src={form.bild_url}
                      alt="Vorschau"
                      style={{ marginTop: 6, maxHeight: 80, borderRadius: 4, objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}
                </div>

                <div className="shop-form-group shop-form-group--full">
                  <label>Beschreibung</label>
                  <textarea
                    rows={3}
                    value={form.beschreibung}
                    onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
                    placeholder="Kurze Produktbeschreibung..."
                  />
                </div>

                <div className="shop-form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.lager_tracking}
                      onChange={e => setForm(f => ({ ...f, lager_tracking: e.target.checked }))}
                    />
                    Lagerbestand tracken
                  </label>
                  {form.lager_tracking && (
                    <input
                      type="number"
                      min="0"
                      value={form.lagerbestand}
                      onChange={e => setForm(f => ({ ...f, lagerbestand: e.target.value }))}
                      placeholder="Anzahl"
                      style={{ marginTop: 6 }}
                    />
                  )}
                </div>

                <div className="shop-form-group shop-form-kasse">
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.sichtbar_kasse}
                      onChange={e => setForm(f => ({ ...f, sichtbar_kasse: e.target.checked }))}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <span>
                      <strong>Im Dojo-Shop (Kasse) anzeigen</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Produkt auch im internen Kassensystem sichtbar
                      </div>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="shop-modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Abbrechen</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Speichert...' : editArtikel ? 'Speichern' : 'Produkt anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
