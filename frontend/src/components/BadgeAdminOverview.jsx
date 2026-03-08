/**
 * BADGE ADMIN OVERVIEW KOMPONENTE
 * ================================
 * Admin-Uebersicht zum Vergeben und Verwalten von Badges/Auszeichnungen
 */

import React, { useState, useEffect } from 'react';
import {
  Award, Star, Trophy, Medal, Crown, Flame, Target, Heart,
  Users, Swords, Zap, TrendingUp, Footprints, Layers, Brain, Shield,
  Check, X, Search, Plus, Clock, Edit2, Trash2, Settings
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';
import { getAuthToken } from '../utils/fetchWithAuth';
import '../styles/themes.css';
import '../styles/components.css';
import './BadgeAdminOverview.css';

// Icon-Mapping
const iconMap = {
  award: Award, star: Star, trophy: Trophy, medal: Medal, crown: Crown,
  flame: Flame, target: Target, heart: Heart, users: Users, swords: Swords,
  zap: Zap, 'trending-up': TrendingUp, footprints: Footprints, layers: Layers,
  brain: Brain, shield: Shield
};

const iconOptions = [
  { value: 'award', label: 'Award' },
  { value: 'star', label: 'Star' },
  { value: 'trophy', label: 'Trophy' },
  { value: 'medal', label: 'Medal' },
  { value: 'crown', label: 'Crown' },
  { value: 'flame', label: 'Flame' },
  { value: 'target', label: 'Target' },
  { value: 'heart', label: 'Heart' },
  { value: 'users', label: 'Users' },
  { value: 'swords', label: 'Swords' },
  { value: 'zap', label: 'Zap' },
  { value: 'trending-up', label: 'Trending Up' },
  { value: 'footprints', label: 'Footprints' },
  { value: 'layers', label: 'Layers' },
  { value: 'brain', label: 'Brain' },
  { value: 'shield', label: 'Shield' }
];

const kategorieOptions = [
  { value: 'training', label: 'Training' },
  { value: 'pruefung', label: 'Pruefung' },
  { value: 'skill', label: 'Skill' },
  { value: 'special', label: 'Spezial' }
];

const kriteriumOptions = [
  { value: '', label: 'Manuell (kein Kriterium)' },
  { value: 'trainings_anzahl', label: 'Anzahl Trainings' },
  { value: 'pruefung_bestanden', label: 'Pruefungen bestanden' },
  { value: 'skill_gemeistert', label: 'Skills gemeistert' }
];

const farbeOptions = [
  '#FFD700', '#22c55e', '#3b82f6', '#f97316', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f59e0b'
];

const BadgeAdminOverview = () => {
  const { activeDojo } = useDojoContext();
  const [data, setData] = useState({ members: [], badges: [], pendingAwards: [], summary: {} });
  const [awardedBadges, setAwardedBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAwarded, setLoadingAwarded] = useState(false);
  const [selectedPending, setSelectedPending] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [awardedSearchTerm, setAwardedSearchTerm] = useState('');
  const [awardedFilterKategorie, setAwardedFilterKategorie] = useState('');
  const [awardedFilterBadge, setAwardedFilterBadge] = useState('');
  const [awardedFilterZeitraum, setAwardedFilterZeitraum] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [manualBadge, setManualBadge] = useState({ mitglied_id: null, badge_id: null });
  const [editingBadge, setEditingBadge] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('vergeben'); // 'vergeben', 'verliehen' oder 'verwalten'

  useEffect(() => {
    loadData();
    loadAwardedBadges(); // Auch beim Start laden fuer die Stat-Card
  }, [activeDojo]);

  useEffect(() => {
    if (activeTab === 'verliehen') {
      loadAwardedBadges();
    }
  }, [activeTab]);

  const loadData = async () => {
    const token = getAuthToken();
    if (!token) {
      setError('Kein gueltiger Token gefunden. Bitte neu einloggen.');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Nur dojo_id senden wenn ein spezifisches Dojo ausgewaehlt ist (nicht "Alle Dojos" / super-admin)
      const isAllDojos = !activeDojo || activeDojo === 'super-admin' || activeDojo === 'all' || activeDojo?.id === 'all';
      const dojoParam = !isAllDojos && activeDojo?.id ? `dojo_id=${activeDojo.id}` : '';
      console.log('Badge loadData:', { activeDojo, isAllDojos, dojoParam });
      const response = await fetch(`/api/badges/admin/overview?${dojoParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else if (response.status === 403) {
        setError('Keine Berechtigung (403). Bitte neu einloggen.');
      } else {
        setError(`Server-Fehler: ${response.status}`);
      }
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      setError(`Netzwerkfehler: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAwardedBadges = async () => {
    const token = getAuthToken();
    if (!token) {
      console.error('loadAwardedBadges: Kein Token');
      return;
    }

    setLoadingAwarded(true);
    try {
      const isAllDojos = !activeDojo || activeDojo === 'super-admin' || activeDojo === 'all' || activeDojo?.id === 'all';
      const dojoParam = !isAllDojos && activeDojo?.id ? `dojo_id=${activeDojo.id}` : '';
      console.log('loadAwardedBadges:', { isAllDojos, dojoParam, activeDojo });

      const response = await fetch(`/api/badges/admin/awarded?${dojoParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('loadAwardedBadges response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('loadAwardedBadges result:', result);
        setAwardedBadges(result.awarded || []);
      } else {
        const errorText = await response.text();
        console.error('loadAwardedBadges error response:', response.status, errorText);
      }
    } catch (err) {
      console.error('Fehler beim Laden der verliehenen Badges:', err);
    } finally {
      setLoadingAwarded(false);
    }
  };

  const handleSelectPending = (award) => {
    const key = `${award.mitglied_id}_${award.badge_id}`;
    setSelectedPending(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllPending = () => {
    if (selectedPending.length === data.pendingAwards.length) {
      setSelectedPending([]);
    } else {
      setSelectedPending(data.pendingAwards.map(a => `${a.mitglied_id}_${a.badge_id}`));
    }
  };

  const handleAwardSelected = async () => {
    if (selectedPending.length === 0) return;
    const awards = selectedPending.map(key => {
      const [mitglied_id, badge_id] = key.split('_');
      return { mitglied_id: parseInt(mitglied_id), badge_id: parseInt(badge_id) };
    });

    try {
      const response = await fetch('/api/badges/admin/award-pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ awards, verliehen_von_name: 'Admin' })
      });
      if (response.ok) {
        setSelectedPending([]);
        loadData();
        loadAwardedBadges(); // Auch verliehene Badges aktualisieren
      }
    } catch (err) {
      console.error('Fehler beim Verleihen:', err);
    }
  };

  const handleManualAward = async () => {
    if (!manualBadge.mitglied_id || !manualBadge.badge_id) return;
    try {
      const response = await fetch(`/api/badges/mitglied/${manualBadge.mitglied_id}/${manualBadge.badge_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ verliehen_von_name: 'Admin', kommentar: manualBadge.kommentar })
      });
      if (response.ok) {
        setShowManualModal(false);
        setManualBadge({ mitglied_id: null, badge_id: null });
        loadData();
        loadAwardedBadges(); // Auch verliehene Badges aktualisieren
      }
    } catch (err) {
      console.error('Fehler beim manuellen Verleihen:', err);
    }
  };

  const handleSaveBadge = async () => {
    if (!editingBadge?.name || !editingBadge?.icon || !editingBadge?.farbe || !editingBadge?.kategorie) {
      alert('Bitte alle Pflichtfelder ausfuellen');
      return;
    }

    try {
      const isNew = !editingBadge.badge_id;
      const url = isNew ? '/api/badges' : `/api/badges/${editingBadge.badge_id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(editingBadge)
      });

      if (response.ok) {
        setShowBadgeModal(false);
        setEditingBadge(null);
        loadData();
      } else {
        const err = await response.json();
        alert(err.error || 'Fehler beim Speichern');
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
    }
  };

  const handleDeleteBadge = async (badge_id) => {
    if (!confirm('Badge wirklich deaktivieren?')) return;
    try {
      const response = await fetch(`/api/badges/${badge_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (response.ok) {
        loadData();
      }
    } catch (err) {
      console.error('Fehler beim Loeschen:', err);
    }
  };

  const getIcon = (iconName) => iconMap[iconName] || Award;

  const filteredPending = data.pendingAwards.filter(a =>
    `${a.vorname} ${a.nachname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.badge_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="ba-loading">Lade Daten...</div>;
  }

  if (error) {
    return (
      <div className="ba-error-wrap">
        <div className="ba-error-text">Fehler: {error}</div>
        <button onClick={() => window.location.href = '/login'}
          className="ba-btn-login">
          Zum Login
        </button>
      </div>
    );
  }

  return (
    <div className="ba-page">
      {/* Header mit Tabs */}
      <div className="ba-page-header">
        <div>
          <h2 className="ba-page-title">
            <Trophy size={24} className="ba-icon-inline" />
            Badge-Verwaltung
          </h2>
        </div>
        <div className="u-flex-gap-sm">
          <button onClick={() => setActiveTab('vergeben')}
            className={`bao-tab-btn${activeTab === 'vergeben' ? ' bao-tab-btn--active' : ''}`}>
            <Award size={16} className="ba-icon-inline" />
            Vergeben
          </button>
          <button onClick={() => setActiveTab('verliehen')}
            className={`bao-tab-btn bao-tab-btn--green${activeTab === 'verliehen' ? ' bao-tab-btn--green-active' : ''}`}>
            <Check size={16} className="ba-icon-inline" />
            Verliehen
          </button>
          <button onClick={() => setActiveTab('verwalten')}
            className={`bao-tab-btn${activeTab === 'verwalten' ? ' bao-tab-btn--active' : ''}`}>
            <Settings size={16} className="ba-icon-inline" />
            Verwalten
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="ba-stats-grid">
        <div className="ba-stat-card ba-stat-card--gold">
          <div className="ba-stat-value ba-stat-value--primary">{data.summary.total_members || 0}</div>
          <div className="ba-text-sm-muted">Aktive Mitglieder</div>
        </div>
        <div className="ba-stat-card ba-stat-card--blue">
          <div className="ba-stat-value ba-stat-value--info">{data.badges.length}</div>
          <div className="ba-text-sm-muted">Verfuegbare Badges</div>
        </div>
        <div className="ba-stat-card ba-stat-card--orange">
          <div className="ba-stat-value ba-stat-value--secondary">{data.summary.pending_awards || 0}</div>
          <div className="ba-stat-label--pending">Ausstehende Badges</div>
        </div>
        <div className="ba-stat-card ba-stat-card--green">
          <div className="ba-stat-value ba-stat-value--success">{awardedBadges.length}</div>
          <div className="ba-text-sm-muted">Verliehene Badges</div>
        </div>
      </div>

      {/* TAB: VERGEBEN */}
      {activeTab === 'vergeben' && (
        <>
          {/* Buttons */}
          <div className="ba-mb-1">
            <button onClick={() => setShowManualModal(true)}
              className="ba-btn-manual-award">
              <Plus size={18} /> Manuell verleihen
            </button>
          </div>

          {/* Pending Awards */}
          {data.pendingAwards.length > 0 && (
            <div className="ba-section-card ba-section-card--orange">
              <div className="ba-flex-header">
                <h3 className="ba-section-heading--orange">
                  <Clock size={18} /> Verdiente Badges zum Verleihen
                </h3>
                <div className="u-flex-gap-sm">
                  <div className="ba-relative">
                    <Search size={16} className="ba-input-icon" />
                    <input type="text" placeholder="Suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                      className="ba-pending-input" />
                  </div>
                  <button onClick={handleSelectAllPending} className="ba-btn-select-all">
                    {selectedPending.length === data.pendingAwards.length ? 'Keine' : 'Alle'} auswaehlen
                  </button>
                  {selectedPending.length > 0 && (
                    <button onClick={handleAwardSelected} className="ba-btn-award">
                      <Check size={16} /> {selectedPending.length} verleihen
                    </button>
                  )}
                </div>
              </div>
              <div className="ba-pending-grid">
                {filteredPending.map((award, idx) => {
                  const key = `${award.mitglied_id}_${award.badge_id}`;
                  const isSelected = selectedPending.includes(key);
                  const Icon = getIcon(award.badge_icon);
                  return (
                    <div key={idx} onClick={() => handleSelectPending(award)}
                      className={`bao-pending-item${isSelected ? ' bao-pending-item--selected' : ''}`}>
                      <div className="bao-badge-circle bao-badge-circle--40" style={{ '--bc': award.badge_farbe, '--bc1': `${award.badge_farbe}40`, '--bc2': `${award.badge_farbe}20` }}>
                        <Icon size={20} color={award.badge_farbe} />
                      </div>
                      <div className="u-flex-1-min0">
                        <div className="ba-label-bold">{award.vorname} {award.nachname}</div>
                        <div className="bao-badge-name" style={{ '--bc': award.badge_farbe }}>{award.badge_name}</div>
                        <div className="ba-badge-kriterium">{award.aktueller_wert} {award.kriterium}</div>
                      </div>
                      <div className={`bao-select-indicator${isSelected ? ' bao-select-indicator--selected' : ''}`}>
                        {isSelected && <Check size={16} color="white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB: VERLIEHEN */}
      {activeTab === 'verliehen' && (
        <div className="ba-section-card ba-section-card--green">
          <div className="ba-filters-row">
            <h3 className="ba-section-heading--green">
              <Check size={18} /> Verliehene Badges
              <span className="u-text-secondary-sm">({awardedBadges.length} gesamt)</span>
            </h3>
            <div className="ba-filters-inner">
              {/* Namenssuche */}
              <div className="ba-relative">
                <Search size={16} className="ba-input-icon" />
                <input type="text" placeholder="Name suchen..." value={awardedSearchTerm} onChange={(e) => setAwardedSearchTerm(e.target.value)}
                  className="ba-awarded-input" />
              </div>
              {/* Kategorie Filter */}
              <select value={awardedFilterKategorie} onChange={(e) => setAwardedFilterKategorie(e.target.value)}
                className="ba-btn-subtle">
                <option value="">Alle Kategorien</option>
                <option value="training">Training</option>
                <option value="pruefung">Pruefung</option>
                <option value="skill">Skill</option>
                <option value="special">Spezial</option>
              </select>
              {/* Badge Filter */}
              <select value={awardedFilterBadge} onChange={(e) => setAwardedFilterBadge(e.target.value)}
                className="ba-badge-filter-select">
                <option value="">Alle Badges</option>
                {data.badges?.map(b => <option key={b.badge_id} value={b.badge_id}>{b.name}</option>)}
              </select>
              {/* Zeitraum Filter */}
              <select value={awardedFilterZeitraum} onChange={(e) => setAwardedFilterZeitraum(e.target.value)}
                className="ba-btn-subtle">
                <option value="">Alle Zeitraeume</option>
                <option value="7">Letzte 7 Tage</option>
                <option value="30">Letzte 30 Tage</option>
                <option value="90">Letzte 3 Monate</option>
                <option value="365">Letztes Jahr</option>
              </select>
              {/* Reset Filter */}
              {(awardedSearchTerm || awardedFilterKategorie || awardedFilterBadge || awardedFilterZeitraum) && (
                <button onClick={() => { setAwardedSearchTerm(''); setAwardedFilterKategorie(''); setAwardedFilterBadge(''); setAwardedFilterZeitraum(''); }}
                  className="ba-btn-reset">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {loadingAwarded ? (
            <div className="ba-empty-state">Lade verliehene Badges...</div>
          ) : awardedBadges.length === 0 ? (
            <div className="ba-empty-state">Noch keine Badges verliehen</div>
          ) : (
            <div className="ba-awarded-grid">
              {awardedBadges
                .filter(a => {
                  // Namenssuche
                  const matchesSearch = !awardedSearchTerm ||
                    `${a.vorname} ${a.nachname}`.toLowerCase().includes(awardedSearchTerm.toLowerCase()) ||
                    a.badge_name.toLowerCase().includes(awardedSearchTerm.toLowerCase());
                  // Kategorie
                  const matchesKategorie = !awardedFilterKategorie || a.badge_kategorie === awardedFilterKategorie;
                  // Badge
                  const matchesBadge = !awardedFilterBadge || a.badge_id === parseInt(awardedFilterBadge);
                  // Zeitraum
                  let matchesZeitraum = true;
                  if (awardedFilterZeitraum) {
                    const days = parseInt(awardedFilterZeitraum);
                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - days);
                    matchesZeitraum = new Date(a.verliehen_am) >= cutoff;
                  }
                  return matchesSearch && matchesKategorie && matchesBadge && matchesZeitraum;
                })
                .map((award, idx) => {
                  const Icon = getIcon(award.badge_icon);
                  return (
                    <div key={idx}
                      className="ba-awarded-card">
                      <div className="bao-badge-circle bao-badge-circle--45" style={{ '--bc': award.badge_farbe, '--bc1': `${award.badge_farbe}40`, '--bc2': `${award.badge_farbe}20` }}>
                        <Icon size={22} color={award.badge_farbe} />
                      </div>
                      <div className="u-flex-1-min0">
                        <div className="ba-label-bold">{award.vorname} {award.nachname}</div>
                        <div className="bao-badge-name" style={{ '--bc': award.badge_farbe }}>{award.badge_name}</div>
                        <div className="ba-awarded-meta">
                          <span>{new Date(award.verliehen_am).toLocaleDateString('de-DE')}</span>
                          {award.verliehen_von_name && <span>von {award.verliehen_von_name}</span>}
                        </div>
                      </div>
                      <div className="ba-check-badge">
                        <Check size={14} color="#22c55e" />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB: VERWALTEN */}
      {activeTab === 'verwalten' && (
        <div className="ba-section-card ba-section-card--gold">
          <div className="ba-flex-header">
            <h3 className="ba-section-heading--primary">Badge-Definitionen</h3>
            <button onClick={() => { setEditingBadge({ name: '', beschreibung: '', icon: 'award', farbe: '#FFD700', kategorie: 'special', kriterium_typ: '', kriterium_wert: null, aktiv: true }); setShowBadgeModal(true); }}
              className="ba-btn-new-badge">
              <Plus size={16} /> Neuer Badge
            </button>
          </div>

          <div className="ba-badge-list">
            {data.badges.map(badge => {
              const Icon = getIcon(badge.icon);
              return (
                <div key={badge.badge_id} className="ba-badge-item">
                  <div className="bao-badge-circle bao-badge-circle--50" style={{ '--bc': badge.farbe, '--bc1': `${badge.farbe}40`, '--bc2': `${badge.farbe}20` }}>
                    <Icon size={24} color={badge.farbe} />
                  </div>
                  <div className="u-flex-1">
                    <div className="bao-badge-title" style={{ '--bc': badge.farbe }}>{badge.name}</div>
                    <div className="ba-text-sm-muted">{badge.beschreibung || 'Keine Beschreibung'}</div>
                    <div className="ba-badge-meta">
                      {badge.kategorie.toUpperCase()} | {badge.kriterium_typ ? `${badge.kriterium_wert} ${badge.kriterium_typ.replace('_', ' ')}` : 'Manuell'}
                    </div>
                  </div>
                  <div className="u-flex-gap-sm">
                    <button onClick={() => { setEditingBadge(badge); setShowBadgeModal(true); }}
                      className="ba-btn-edit">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteBadge(badge.badge_id)}
                      className="ba-btn-delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Manuell verleihen */}
      {showManualModal && (
        <div onClick={() => setShowManualModal(false)} className="ba-modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="ba-modal-card">
            <h3 className="ba-heading-primary">Badge manuell verleihen</h3>
            <div className="ba-mb-1">
              <label className="ba-field-label">Mitglied ({data.members?.length || 0} verfuegbar)</label>
              <select value={manualBadge.mitglied_id || ''} onChange={(e) => setManualBadge({ ...manualBadge, mitglied_id: e.target.value })}
                className="ba-input-pointer">
                <option value="">Mitglied waehlen...</option>
                {data.members?.slice().sort((a, b) => `${a.nachname} ${a.vorname}`.localeCompare(`${b.nachname} ${b.vorname}`)).map(m => <option key={m.mitglied_id} value={m.mitglied_id}>{m.nachname}, {m.vorname}</option>)}
              </select>
            </div>
            <div className="ba-mb-1">
              <label className="ba-field-label">Badge</label>
              <select value={manualBadge.badge_id || ''} onChange={(e) => setManualBadge({ ...manualBadge, badge_id: e.target.value })}
                className="ba-input-pointer">
                <option value="">Badge waehlen...</option>
                {data.badges?.map(b => <option key={b.badge_id} value={b.badge_id}>{b.name} ({b.kategorie})</option>)}
              </select>
            </div>
            <div className="ba-mb-15">
              <label className="ba-field-label">Kommentar (optional)</label>
              <input type="text" value={manualBadge.kommentar || ''} onChange={(e) => setManualBadge({ ...manualBadge, kommentar: e.target.value })} placeholder="Grund fuer die Auszeichnung..."
                className="ba-input-light" />
            </div>
            <div className="ba-flex-actions">
              <button onClick={() => setShowManualModal(false)} className="ba-btn-ghost">Abbrechen</button>
              <button onClick={handleManualAward} disabled={!manualBadge.mitglied_id || !manualBadge.badge_id}
                className="ba-btn-save-green">Verleihen</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Badge erstellen/bearbeiten */}
      {showBadgeModal && editingBadge && (
        <div onClick={() => setShowBadgeModal(false)} className="ba-modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="ba-modal-card--wide">
            <h3 className="ba-heading-primary">{editingBadge.badge_id ? 'Badge bearbeiten' : 'Neuer Badge'}</h3>

            {/* Vorschau */}
            <div className="ba-modal-preview">
              <div className="bao-badge-circle bao-badge-circle--80" style={{ '--bc': editingBadge.farbe, '--bc1': `${editingBadge.farbe}40`, '--bc2': `${editingBadge.farbe}20` }}>
                {React.createElement(getIcon(editingBadge.icon), { size: 40, color: editingBadge.farbe })}
              </div>
            </div>

            <div className="u-grid-2col">
              <div>
                <label className="ba-field-label">Name *</label>
                <input type="text" value={editingBadge.name} onChange={(e) => setEditingBadge({ ...editingBadge, name: e.target.value })}
                  className="ba-input" />
              </div>
              <div>
                <label className="ba-field-label">Kategorie *</label>
                <select value={editingBadge.kategorie} onChange={(e) => setEditingBadge({ ...editingBadge, kategorie: e.target.value })}
                  className="ba-input">
                  {kategorieOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="ba-mb-1">
              <label className="ba-field-label">Beschreibung</label>
              <textarea value={editingBadge.beschreibung || ''} onChange={(e) => setEditingBadge({ ...editingBadge, beschreibung: e.target.value })} rows={2}
                className="ba-textarea" />
            </div>

            <div className="u-grid-2col">
              <div>
                <label className="ba-field-label">Icon *</label>
                <select value={editingBadge.icon} onChange={(e) => setEditingBadge({ ...editingBadge, icon: e.target.value })}
                  className="ba-input">
                  {iconOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="ba-field-label">Farbe *</label>
                <div className="u-flex-wrap-gap">
                  {farbeOptions.map(c => (
                    <div key={c} onClick={() => setEditingBadge({ ...editingBadge, farbe: c })}
                      className={`bao-color-swatch${editingBadge.farbe === c ? ' bao-color-swatch--selected' : ''}`} style={{ '--swatch-color': c }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="ba-grid-2col-mb">
              <div>
                <label className="ba-field-label">Kriterium</label>
                <select value={editingBadge.kriterium_typ || ''} onChange={(e) => setEditingBadge({ ...editingBadge, kriterium_typ: e.target.value || null })}
                  className="ba-input">
                  {kriteriumOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {editingBadge.kriterium_typ && (
                <div>
                  <label className="ba-field-label">Wert</label>
                  <input type="number" value={editingBadge.kriterium_wert || ''} onChange={(e) => setEditingBadge({ ...editingBadge, kriterium_wert: parseInt(e.target.value) || null })}
                    className="ba-input" />
                </div>
              )}
            </div>

            <div className="ba-flex-actions">
              <button onClick={() => { setShowBadgeModal(false); setEditingBadge(null); }} className="ba-btn-ghost">Abbrechen</button>
              <button onClick={handleSaveBadge}
                className="ba-btn-save-green">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgeAdminOverview;
