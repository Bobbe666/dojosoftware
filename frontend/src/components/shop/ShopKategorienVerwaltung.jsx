import React, { useState, useEffect } from 'react';
import axios from 'axios';

const EMPTY_KAT = {
  name: '', beschreibung: '', icon: '', farbe: '#3B82F6',
  sortierung: 0, parent_id: '', aktiv: true
};

export default function ShopKategorienVerwaltung({ dojoParam = '' }) {
  const [kategorien, setKategorien] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editKat, setEditKat] = useState(null);
  const [form, setForm] = useState(EMPTY_KAT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, [dojoParam]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/shop/admin/kategorien${dojoParam}`);
      setKategorien(data);
    } catch (err) {
      setError('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditKat(null);
    setForm(EMPTY_KAT);
    setError('');
    setShowModal(true);
  };

  const openEdit = (k) => {
    setEditKat(k);
    setForm({
      name: k.name, beschreibung: k.beschreibung || '',
      icon: k.icon || '', farbe: k.farbe || '#3B82F6',
      sortierung: k.sortierung || 0, parent_id: k.parent_id || '', aktiv: !!k.aktiv
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      setError('Name ist ein Pflichtfeld');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, parent_id: form.parent_id || null };
      if (editKat) {
        await axios.put(`/shop/admin/kategorien/${editKat.id}${dojoParam}`, payload);
      } else {
        await axios.post(`/shop/admin/kategorien${dojoParam}`, payload);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Kategorie "${name}" deaktivieren?`)) return;
    try {
      await axios.delete(`/shop/admin/kategorien/${id}${dojoParam}`);
      loadData();
    } catch (err) {
      alert('Fehler beim Deaktivieren');
    }
  };

  // Hierarchisch gruppiert anzeigen
  const parents = kategorien.filter(k => !k.parent_id);
  const children = kategorien.filter(k => k.parent_id);

  if (loading) return <div className="shop-loading">Lade Kategorien...</div>;

  return (
    <div className="shop-admin-content">
      <div className="shop-admin-header">
        <h2>Kategorien ({kategorien.length})</h2>
        <button className="btn-primary" onClick={openCreate}>+ Kategorie hinzufügen</button>
      </div>

      <div className="shop-table-wrap">
        <table className="shop-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Übergeordnet</th>
              <th>Produkte</th>
              <th>Sortierung</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {parents.map(k => (
              <React.Fragment key={k.id}>
                <tr>
                  <td>
                    <span style={{ color: k.farbe || '#3B82F6' }}>{k.icon && `${k.icon} `}</span>
                    <strong>{k.name}</strong>
                  </td>
                  <td><code>{k.slug}</code></td>
                  <td>—</td>
                  <td>{k.produkt_anzahl}</td>
                  <td>{k.sortierung}</td>
                  <td><span className={`shop-status ${k.aktiv ? 'shop-status--aktiv' : 'shop-status--inaktiv'}`}>{k.aktiv ? 'Aktiv' : 'Inaktiv'}</span></td>
                  <td>
                    <button className="btn-sm btn-secondary" onClick={() => openEdit(k)}>Bearbeiten</button>
                    {k.aktiv && k.produkt_anzahl === 0 && (
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(k.id, k.name)}>Deaktivieren</button>
                    )}
                  </td>
                </tr>
                {children.filter(c => c.parent_id === k.id).map(c => (
                  <tr key={c.id} style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <td style={{ paddingLeft: '2rem' }}>
                      <span style={{ color: c.farbe || '#3B82F6' }}>{c.icon && `${c.icon} `}</span>
                      └ {c.name}
                    </td>
                    <td><code>{c.slug}</code></td>
                    <td>{k.name}</td>
                    <td>{c.produkt_anzahl}</td>
                    <td>{c.sortierung}</td>
                    <td><span className={`shop-status ${c.aktiv ? 'shop-status--aktiv' : 'shop-status--inaktiv'}`}>{c.aktiv ? 'Aktiv' : 'Inaktiv'}</span></td>
                    <td>
                      <button className="btn-sm btn-secondary" onClick={() => openEdit(c)}>Bearbeiten</button>
                      {c.aktiv && c.produkt_anzahl === 0 && (
                        <button className="btn-sm btn-danger" onClick={() => handleDelete(c.id, c.name)}>Deaktivieren</button>
                      )}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {kategorien.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Keine Kategorien vorhanden</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Kategorie-Modal */}
      {showModal && (
        <div className="shop-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="shop-modal" onClick={e => e.stopPropagation()}>
            <div className="shop-modal-header">
              <h3>{editKat ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h3>
              <button className="shop-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="shop-modal-body">
              {error && <div className="shop-error">{error}</div>}
              <div className="shop-form-grid">
                <div className="shop-form-group">
                  <label>Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Kategoriename"
                  />
                </div>
                <div className="shop-form-group">
                  <label>Icon (Emoji)</label>
                  <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="📋" maxLength={4} />
                </div>
                <div className="shop-form-group">
                  <label>Farbe</label>
                  <input type="color" value={form.farbe} onChange={e => setForm(f => ({ ...f, farbe: e.target.value }))} />
                </div>
                <div className="shop-form-group">
                  <label>Übergeordnete Kategorie</label>
                  <select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                    <option value="">— Hauptkategorie —</option>
                    {parents.filter(k => !editKat || k.id !== editKat.id).map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </div>
                <div className="shop-form-group">
                  <label>Sortierung</label>
                  <input type="number" value={form.sortierung} onChange={e => setForm(f => ({ ...f, sortierung: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="shop-form-group shop-form-group--full">
                  <label>Beschreibung</label>
                  <textarea rows={2} value={form.beschreibung} onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))} />
                </div>
                <div className="shop-form-group">
                  <label>
                    <input type="checkbox" checked={form.aktiv} onChange={e => setForm(f => ({ ...f, aktiv: e.target.checked }))} />
                    {' '}Aktiv
                  </label>
                </div>
              </div>
            </div>
            <div className="shop-modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Abbrechen</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
