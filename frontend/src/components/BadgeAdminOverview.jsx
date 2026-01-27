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
  const [loading, setLoading] = useState(true);
  const [selectedPending, setSelectedPending] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [manualBadge, setManualBadge] = useState({ mitglied_id: null, badge_id: null });
  const [editingBadge, setEditingBadge] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('vergeben'); // 'vergeben' oder 'verwalten'

  useEffect(() => {
    loadData();
  }, [activeDojo]);

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
      // Nur dojo_id senden wenn ein spezifisches Dojo ausgewaehlt ist (nicht "Alle Dojos")
      const dojoParam = activeDojo?.id && activeDojo.id !== 'all' ? `dojo_id=${activeDojo.id}` : '';
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
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>Lade Daten...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: '#ef4444', marginBottom: '1rem' }}>Fehler: {error}</div>
        <button onClick={() => window.location.href = '/login'}
          style={{ background: '#ffd700', color: '#1a1a1a', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
          Zum Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      {/* Header mit Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#ffd700', margin: 0, fontSize: '1.25rem' }}>
            <Trophy size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Badge-Verwaltung
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setActiveTab('vergeben')}
            style={{
              background: activeTab === 'vergeben' ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${activeTab === 'vergeben' ? 'rgba(255, 215, 0, 0.5)' : 'rgba(255,255,255,0.2)'}`,
              color: activeTab === 'vergeben' ? '#ffd700' : 'rgba(255,255,255,0.7)',
              padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500
            }}>
            <Award size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Vergeben
          </button>
          <button onClick={() => setActiveTab('verwalten')}
            style={{
              background: activeTab === 'verwalten' ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${activeTab === 'verwalten' ? 'rgba(255, 215, 0, 0.5)' : 'rgba(255,255,255,0.2)'}`,
              color: activeTab === 'verwalten' ? '#ffd700' : 'rgba(255,255,255,0.7)',
              padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500
            }}>
            <Settings size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Verwalten
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '1rem', border: '1px solid rgba(255, 215, 0, 0.2)', textAlign: 'center' }}>
          <div style={{ color: '#ffd700', fontSize: '2rem', fontWeight: 700 }}>{data.summary.total_members || 0}</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Aktive Mitglieder</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '1rem', border: '1px solid rgba(34, 197, 94, 0.3)', textAlign: 'center' }}>
          <div style={{ color: '#22c55e', fontSize: '2rem', fontWeight: 700 }}>{data.badges.length}</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Verfuegbare Badges</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(249, 115, 22, 0.05))', borderRadius: '10px', padding: '1rem', border: '2px solid rgba(249, 115, 22, 0.4)', textAlign: 'center' }}>
          <div style={{ color: '#f97316', fontSize: '2rem', fontWeight: 700 }}>{data.summary.pending_awards || 0}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600 }}>Ausstehende Badges</div>
        </div>
      </div>

      {/* TAB: VERGEBEN */}
      {activeTab === 'vergeben' && (
        <>
          {/* Buttons */}
          <div style={{ marginBottom: '1rem' }}>
            <button onClick={() => setShowManualModal(true)}
              style={{ background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.1))', border: '1px solid rgba(255, 215, 0, 0.4)', color: '#ffd700', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <Plus size={18} /> Manuell verleihen
            </button>
          </div>

          {/* Pending Awards */}
          {data.pendingAwards.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.25rem', border: '1px solid rgba(249, 115, 22, 0.3)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ color: '#f97316', margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} /> Verdiente Badges zum Verleihen
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                    <input type="text" placeholder="Suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '0.4rem 0.75rem 0.4rem 2rem', color: 'white', fontSize: '0.85rem', width: '180px' }} />
                  </div>
                  <button onClick={handleSelectAllPending} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    {selectedPending.length === data.pendingAwards.length ? 'Keine' : 'Alle'} auswaehlen
                  </button>
                  {selectedPending.length > 0 && (
                    <button onClick={handleAwardSelected} style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', color: 'white', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Check size={16} /> {selectedPending.length} verleihen
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                {filteredPending.map((award, idx) => {
                  const key = `${award.mitglied_id}_${award.badge_id}`;
                  const isSelected = selectedPending.includes(key);
                  const Icon = getIcon(award.badge_icon);
                  return (
                    <div key={idx} onClick={() => handleSelectPending(award)}
                      style={{ background: isSelected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.75rem', border: isSelected ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'all 0.2s ease' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `linear-gradient(135deg, ${award.badge_farbe}40, ${award.badge_farbe}20)`, border: `2px solid ${award.badge_farbe}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={20} color={award.badge_farbe} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem' }}>{award.vorname} {award.nachname}</div>
                        <div style={{ color: award.badge_farbe, fontSize: '0.8rem', fontWeight: 500 }}>{award.badge_name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>{award.aktueller_wert} {award.kriterium}</div>
                      </div>
                      <div style={{ width: '24px', height: '24px', borderRadius: '4px', border: isSelected ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.2)', background: isSelected ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      {/* TAB: VERWALTEN */}
      {activeTab === 'verwalten' && (
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.25rem', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#ffd700', margin: 0, fontSize: '1rem' }}>Badge-Definitionen</h3>
            <button onClick={() => { setEditingBadge({ name: '', beschreibung: '', icon: 'award', farbe: '#FFD700', kategorie: 'special', kriterium_typ: '', kriterium_wert: null, aktiv: true }); setShowBadgeModal(true); }}
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <Plus size={16} /> Neuer Badge
            </button>
          </div>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {data.badges.map(badge => {
              const Icon = getIcon(badge.icon);
              return (
                <div key={badge.badge_id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: `linear-gradient(135deg, ${badge.farbe}40, ${badge.farbe}20)`, border: `2px solid ${badge.farbe}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={24} color={badge.farbe} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: badge.farbe, fontSize: '1rem' }}>{badge.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>{badge.beschreibung || 'Keine Beschreibung'}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      {badge.kategorie.toUpperCase()} | {badge.kriterium_typ ? `${badge.kriterium_wert} ${badge.kriterium_typ.replace('_', ' ')}` : 'Manuell'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => { setEditingBadge(badge); setShowBadgeModal(true); }}
                      style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#3b82f6', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}>
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteBadge(badge.badge_id)}
                      style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}>
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
        <div onClick={() => setShowManualModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '1.5rem', width: '400px', maxWidth: '90%', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
            <h3 style={{ color: '#ffd700', margin: '0 0 1rem 0' }}>Badge manuell verleihen</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Mitglied ({data.members?.length || 0} verfuegbar)</label>
              <select value={manualBadge.mitglied_id || ''} onChange={(e) => setManualBadge({ ...manualBadge, mitglied_id: e.target.value })}
                style={{ width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '0.6rem', color: 'white', fontSize: '0.9rem', cursor: 'pointer' }}>
                <option value="">Mitglied waehlen...</option>
                {data.members?.map(m => <option key={m.mitglied_id} value={m.mitglied_id}>{m.vorname} {m.nachname}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Badge</label>
              <select value={manualBadge.badge_id || ''} onChange={(e) => setManualBadge({ ...manualBadge, badge_id: e.target.value })}
                style={{ width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '0.6rem', color: 'white', fontSize: '0.9rem', cursor: 'pointer' }}>
                <option value="">Badge waehlen...</option>
                {data.badges?.map(b => <option key={b.badge_id} value={b.badge_id}>{b.name} ({b.kategorie})</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Kommentar (optional)</label>
              <input type="text" value={manualBadge.kommentar || ''} onChange={(e) => setManualBadge({ ...manualBadge, kommentar: e.target.value })} placeholder="Grund fuer die Auszeichnung..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '0.6rem', color: 'white', fontSize: '0.9rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowManualModal(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleManualAward} disabled={!manualBadge.mitglied_id || !manualBadge.badge_id}
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, opacity: (!manualBadge.mitglied_id || !manualBadge.badge_id) ? 0.5 : 1 }}>Verleihen</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Badge erstellen/bearbeiten */}
      {showBadgeModal && editingBadge && (
        <div onClick={() => setShowBadgeModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '1.5rem', width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
            <h3 style={{ color: '#ffd700', margin: '0 0 1rem 0' }}>{editingBadge.badge_id ? 'Badge bearbeiten' : 'Neuer Badge'}</h3>

            {/* Vorschau */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: `linear-gradient(135deg, ${editingBadge.farbe}40, ${editingBadge.farbe}20)`, border: `3px solid ${editingBadge.farbe}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {React.createElement(getIcon(editingBadge.icon), { size: 40, color: editingBadge.farbe })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Name *</label>
                <input type="text" value={editingBadge.name} onChange={(e) => setEditingBadge({ ...editingBadge, name: e.target.value })}
                  style={{ width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '0.6rem', color: 'white', fontSize: '0.9rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Kategorie *</label>
                <select value={editingBadge.kategorie} onChange={(e) => setEditingBadge({ ...editingBadge, kategorie: e.target.value })}
                  style={{ width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '0.6rem', color: 'white', fontSize: '0.9rem' }}>
                  {kategorieOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Beschreibung</label>
              <textarea value={editingBadge.beschreibung || ''} onChange={(e) => setEditingBadge({ ...editingBadge, beschreibung: e.target.value })} rows={2}
                style={{ width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '0.6rem', color: 'white', fontSize: '0.9rem', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Icon *</label>
                <select value={editingBadge.icon} onChange={(e) => setEditingBadge({ ...editingBadge, icon: e.target.value })}
                  style={{ width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '0.6rem', color: 'white', fontSize: '0.9rem' }}>
                  {iconOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Farbe *</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {farbeOptions.map(c => (
                    <div key={c} onClick={() => setEditingBadge({ ...editingBadge, farbe: c })}
                      style={{ width: '28px', height: '28px', borderRadius: '50%', background: c, cursor: 'pointer', border: editingBadge.farbe === c ? '3px solid white' : '2px solid rgba(255,255,255,0.2)' }} />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Kriterium</label>
                <select value={editingBadge.kriterium_typ || ''} onChange={(e) => setEditingBadge({ ...editingBadge, kriterium_typ: e.target.value || null })}
                  style={{ width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '0.6rem', color: 'white', fontSize: '0.9rem' }}>
                  {kriteriumOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {editingBadge.kriterium_typ && (
                <div>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Wert</label>
                  <input type="number" value={editingBadge.kriterium_wert || ''} onChange={(e) => setEditingBadge({ ...editingBadge, kriterium_wert: parseInt(e.target.value) || null })}
                    style={{ width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '0.6rem', color: 'white', fontSize: '0.9rem' }} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowBadgeModal(false); setEditingBadge(null); }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleSaveBadge}
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgeAdminOverview;
