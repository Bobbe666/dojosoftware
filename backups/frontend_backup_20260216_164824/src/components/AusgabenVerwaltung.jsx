/**
 * Ausgaben-Verwaltung
 * ===================
 * Erfassen und Verwalten von Betriebsausgaben für die EÜR
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Calendar,
  Receipt,
  TrendingDown,
  Filter,
  Download,
  Home,
  Users,
  Box,
  Megaphone,
  Shield,
  Car,
  Phone,
  Laptop,
  GraduationCap,
  Wrench,
  Paperclip,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext.jsx';
import config from '../config/config';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/themes.css';
import '../styles/components.css';

const KATEGORIE_ICONS = {
  miete: Home,
  personal: Users,
  material: Box,
  marketing: Megaphone,
  versicherung: Shield,
  gebuehren: Receipt,
  fahrtkosten: Car,
  telefon: Phone,
  software: Laptop,
  fortbildung: GraduationCap,
  reparatur: Wrench,
  buero: Paperclip,
  sonstiges: MoreHorizontal
};

const KATEGORIE_LABELS = {
  miete: 'Miete & Nebenkosten',
  personal: 'Personalkosten',
  material: 'Material & Ausstattung',
  marketing: 'Marketing & Werbung',
  versicherung: 'Versicherungen',
  gebuehren: 'Gebühren & Beiträge',
  fahrtkosten: 'Fahrtkosten',
  telefon: 'Telefon & Internet',
  software: 'Software & Lizenzen',
  fortbildung: 'Fortbildung & Seminare',
  reparatur: 'Reparaturen & Wartung',
  buero: 'Büromaterial',
  sonstiges: 'Sonstige Ausgaben'
};

const AusgabenVerwaltung = () => {
  const { activeDojo } = useDojoContext();
  const [loading, setLoading] = useState(true);
  const [ausgaben, setAusgaben] = useState([]);
  const [summen, setSummen] = useState({ anzahl: 0, gesamt: 0 });
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [monat, setMonat] = useState(null);
  const [kategorieFilter, setKategorieFilter] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    datum: new Date().toISOString().split('T')[0],
    betrag: '',
    beschreibung: '',
    beleg_nummer: '',
    kategorie: 'sonstiges'
  });

  useEffect(() => {
    if (activeDojo) {
      loadAusgaben();
    }
  }, [activeDojo, jahr, monat, kategorieFilter]);

  const loadAusgaben = async () => {
    try {
      setLoading(true);
      const dojoId = activeDojo?.dojo_id || activeDojo?.id;
      let url = `${config.apiBaseUrl}/ausgaben?dojo_id=${dojoId}&jahr=${jahr}`;

      if (monat) url += `&monat=${monat}`;
      if (kategorieFilter) url += `&kategorie=${kategorieFilter}`;

      const response = await fetchWithAuth(url);
      const result = await response.json();

      if (result.success) {
        setAusgaben(result.ausgaben);
        setSummen(result.summen);
      }
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.betrag || !formData.beschreibung) {
      alert('Bitte Betrag und Beschreibung eingeben');
      return;
    }

    try {
      const dojoId = activeDojo?.dojo_id || activeDojo?.id;
      const url = editingId
        ? `${config.apiBaseUrl}/ausgaben/${editingId}`
        : `${config.apiBaseUrl}/ausgaben`;

      const method = editingId ? 'PUT' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          dojo_id: dojoId
        })
      });

      const result = await response.json();

      if (result.success) {
        setShowForm(false);
        setEditingId(null);
        setFormData({
          datum: new Date().toISOString().split('T')[0],
          betrag: '',
          beschreibung: '',
          beleg_nummer: '',
          kategorie: 'sonstiges'
        });
        loadAusgaben();
      } else {
        alert(result.error || 'Fehler beim Speichern');
      }
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Speichern');
    }
  };

  const handleEdit = (ausgabe) => {
    setFormData({
      datum: ausgabe.datum?.split('T')[0] || '',
      betrag: ausgabe.betrag?.toString() || '',
      beschreibung: ausgabe.beschreibung || '',
      beleg_nummer: ausgabe.beleg_nummer || '',
      kategorie: ausgabe.kategorie || 'sonstiges'
    });
    setEditingId(ausgabe.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Ausgabe wirklich löschen?')) return;

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/ausgaben/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        loadAusgaben();
      } else {
        alert(result.error || 'Fehler beim Löschen');
      }
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Löschen');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE');
  };

  const KategorieIcon = ({ kategorie }) => {
    const Icon = KATEGORIE_ICONS[kategorie] || MoreHorizontal;
    return <Icon size={16} />;
  };

  const monatsnamen = [
    'Alle Monate', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  return (
    <div className="ausgaben-verwaltung" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingDown size={24} />
            Ausgaben erfassen
          </h2>
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>
            Betriebsausgaben für die EÜR verwalten
          </p>
        </div>

        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({
              datum: new Date().toISOString().split('T')[0],
              betrag: '',
              beschreibung: '',
              beleg_nummer: '',
              kategorie: 'sonstiges'
            });
          }}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} />
          Neue Ausgabe
        </button>
      </div>

      {/* Filter */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Jahr */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => setJahr(j => j - 1)} className="btn btn-icon">
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontWeight: '600', minWidth: '50px', textAlign: 'center' }}>{jahr}</span>
          <button
            onClick={() => setJahr(j => j + 1)}
            className="btn btn-icon"
            disabled={jahr >= new Date().getFullYear()}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Monat */}
        <select
          value={monat || ''}
          onChange={(e) => setMonat(e.target.value ? parseInt(e.target.value) : null)}
          className="form-select"
          style={{ minWidth: '150px' }}
        >
          {monatsnamen.map((name, idx) => (
            <option key={idx} value={idx === 0 ? '' : idx}>{name}</option>
          ))}
        </select>

        {/* Kategorie */}
        <select
          value={kategorieFilter || ''}
          onChange={(e) => setKategorieFilter(e.target.value || null)}
          className="form-select"
          style={{ minWidth: '180px' }}
        >
          <option value="">Alle Kategorien</option>
          {Object.entries(KATEGORIE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Summen-Karte */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        border: '1px solid var(--border-primary)',
        display: 'flex',
        gap: '2rem',
        flexWrap: 'wrap'
      }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Anzahl Ausgaben</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{summen.anzahl}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gesamt</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--error)' }}>
            {formatCurrency(summen.gesamt)}
          </div>
        </div>
      </div>

      {/* Formular Modal */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '500px',
            margin: '1rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ margin: 0 }}>
                {editingId ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}
              </h3>
              <button onClick={() => setShowForm(false)} className="btn btn-icon">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Datum */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    Datum *
                  </label>
                  <input
                    type="date"
                    value={formData.datum}
                    onChange={(e) => setFormData({ ...formData, datum: e.target.value })}
                    className="form-input"
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Betrag */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    Betrag (EUR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.betrag}
                    onChange={(e) => setFormData({ ...formData, betrag: e.target.value })}
                    className="form-input"
                    placeholder="0,00"
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Kategorie */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    Kategorie
                  </label>
                  <select
                    value={formData.kategorie}
                    onChange={(e) => setFormData({ ...formData, kategorie: e.target.value })}
                    className="form-select"
                    style={{ width: '100%' }}
                  >
                    {Object.entries(KATEGORIE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Beschreibung */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    Beschreibung *
                  </label>
                  <input
                    type="text"
                    value={formData.beschreibung}
                    onChange={(e) => setFormData({ ...formData, beschreibung: e.target.value })}
                    className="form-input"
                    placeholder="z.B. Miete Januar 2026"
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Belegnummer */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    Belegnummer (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.beleg_nummer}
                    onChange={(e) => setFormData({ ...formData, beleg_nummer: e.target.value })}
                    className="form-input"
                    placeholder="z.B. RE-2026-001"
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <Save size={18} />
                    Speichern
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabelle */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-primary)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div className="loading-spinner"></div>
            <p>Lade Ausgaben...</p>
          </div>
        ) : ausgaben.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <TrendingDown size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <p>Keine Ausgaben für den gewählten Zeitraum</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Datum</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Kategorie</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Beschreibung</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Beleg</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Betrag</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600' }}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {ausgaben.map((ausgabe) => (
                  <tr
                    key={ausgabe.id}
                    style={{ borderBottom: '1px solid var(--border-secondary)' }}
                  >
                    <td style={{ padding: '0.75rem' }}>{formatDate(ausgabe.datum)}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <KategorieIcon kategorie={ausgabe.kategorie} />
                        {KATEGORIE_LABELS[ausgabe.kategorie] || ausgabe.kategorie}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{ausgabe.beschreibung}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                      {ausgabe.beleg_nummer || '-'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: 'var(--error)' }}>
                      {formatCurrency(ausgabe.betrag)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEdit(ausgabe)}
                          className="btn btn-icon"
                          title="Bearbeiten"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(ausgabe.id)}
                          className="btn btn-icon"
                          title="Löschen"
                          style={{ color: 'var(--error)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AusgabenVerwaltung;
