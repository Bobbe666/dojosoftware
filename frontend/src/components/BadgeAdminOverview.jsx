/**
 * BADGE ADMIN OVERVIEW KOMPONENTE
 * ================================
 * Admin-Uebersicht zum Vergeben von Badges/Auszeichnungen
 */

import React, { useState, useEffect } from 'react';
import {
  Award, Star, Trophy, Medal, Crown, Flame, Target, Heart,
  Users, Swords, Zap, TrendingUp, Footprints, Layers, Brain, Shield,
  Check, X, Search, Filter, Plus, Clock
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';
import '../styles/themes.css';
import '../styles/components.css';

// Icon-Mapping
const iconMap = {
  award: Award, star: Star, trophy: Trophy, medal: Medal, crown: Crown,
  flame: Flame, target: Target, heart: Heart, users: Users, swords: Swords,
  zap: Zap, 'trending-up': TrendingUp, footprints: Footprints, layers: Layers,
  brain: Brain, shield: Shield
};

const BadgeAdminOverview = () => {
  const { getDojoFilterParam, activeDojo } = useDojoContext();
  const [data, setData] = useState({ members: [], badges: [], pendingAwards: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [selectedPending, setSelectedPending] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualBadge, setManualBadge] = useState({ mitglied_id: null, badge_id: null });

  useEffect(() => {
    loadData();
  }, [activeDojo]);

  const loadData = async () => {
    const token = localStorage.getItem('token');
    // Warte auf gültigen Token
    if (!token || token === 'null' || token === 'undefined') {
      console.log('Badge Admin: Warte auf Token...');
      setTimeout(loadData, 500);
      return;
    }

    setLoading(true);
    try {
      const dojoParam = activeDojo?.id ? `dojo_id=${activeDojo.id}` : '';
      const response = await fetch(`/api/badges/admin/overview?${dojoParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else if (response.status === 403) {
        console.error('Badge Admin: Keine Berechtigung - Token ungültig?');
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error);
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
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          awards,
          verliehen_von_name: 'Admin'
        })
      });

      if (response.ok) {
        setSelectedPending([]);
        loadData();
      }
    } catch (error) {
      console.error('Fehler beim Verleihen:', error);
    }
  };

  const handleManualAward = async () => {
    if (!manualBadge.mitglied_id || !manualBadge.badge_id) return;

    try {
      const response = await fetch(`/api/badges/mitglied/${manualBadge.mitglied_id}/${manualBadge.badge_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ verliehen_von_name: 'Admin', kommentar: manualBadge.kommentar })
      });

      if (response.ok) {
        setShowManualModal(false);
        setManualBadge({ mitglied_id: null, badge_id: null });
        loadData();
      }
    } catch (error) {
      console.error('Fehler beim manuellen Verleihen:', error);
    }
  };

  const getIcon = (iconName) => {
    const IconComponent = iconMap[iconName] || Award;
    return IconComponent;
  };

  const filteredPending = data.pendingAwards.filter(a =>
    `${a.vorname} ${a.nachname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.badge_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        Lade Daten...
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h2 style={{ color: '#ffd700', margin: 0, fontSize: '1.25rem' }}>
            <Trophy size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Badge-Verwaltung
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
            Vergeben Sie Auszeichnungen an Mitglieder
          </p>
        </div>
        <button
          onClick={() => setShowManualModal(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.1))',
            border: '1px solid rgba(255, 215, 0, 0.4)',
            color: '#ffd700',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 600
          }}
        >
          <Plus size={18} />
          Manuell verleihen
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
          padding: '1rem',
          border: '1px solid rgba(255, 215, 0, 0.2)',
          textAlign: 'center'
        }}>
          <div style={{ color: '#ffd700', fontSize: '2rem', fontWeight: 700 }}>
            {data.summary.total_members || 0}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
            Aktive Mitglieder
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
          padding: '1rem',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          textAlign: 'center'
        }}>
          <div style={{ color: '#22c55e', fontSize: '2rem', fontWeight: 700 }}>
            {data.badges.length}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
            Verfuegbare Badges
          </div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(249, 115, 22, 0.05))',
          borderRadius: '10px',
          padding: '1rem',
          border: '2px solid rgba(249, 115, 22, 0.4)',
          textAlign: 'center'
        }}>
          <div style={{ color: '#f97316', fontSize: '2rem', fontWeight: 700 }}>
            {data.summary.pending_awards || 0}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600 }}>
            Ausstehende Badges
          </div>
        </div>
      </div>

      {/* Pending Awards Section */}
      {data.pendingAwards.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '1.25rem',
          border: '1px solid rgba(249, 115, 22, 0.3)',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h3 style={{
              color: '#f97316',
              margin: 0,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Clock size={18} />
              Verdiente Badges zum Verleihen
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'rgba(255,255,255,0.4)'
                }} />
                <input
                  type="text"
                  placeholder="Suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '0.4rem 0.75rem 0.4rem 2rem',
                    color: 'white',
                    fontSize: '0.85rem',
                    width: '180px'
                  }}
                />
              </div>
              <button
                onClick={handleSelectAllPending}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.8)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                {selectedPending.length === data.pendingAwards.length ? 'Keine' : 'Alle'} auswaehlen
              </button>
              {selectedPending.length > 0 && (
                <button
                  onClick={handleAwardSelected}
                  style={{
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    border: 'none',
                    color: 'white',
                    padding: '0.4rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Check size={16} />
                  {selectedPending.length} verleihen
                </button>
              )}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '0.75rem',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {filteredPending.map((award, idx) => {
              const key = `${award.mitglied_id}_${award.badge_id}`;
              const isSelected = selectedPending.includes(key);
              const Icon = getIcon(award.badge_icon);

              return (
                <div
                  key={idx}
                  onClick={() => handleSelectPending(award)}
                  style={{
                    background: isSelected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    border: isSelected ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${award.badge_farbe}40, ${award.badge_farbe}20)`,
                    border: `2px solid ${award.badge_farbe}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={20} color={award.badge_farbe} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: '0.9rem'
                    }}>
                      {award.vorname} {award.nachname}
                    </div>
                    <div style={{
                      color: award.badge_farbe,
                      fontSize: '0.8rem',
                      fontWeight: 500
                    }}>
                      {award.badge_name}
                    </div>
                    <div style={{
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: '0.7rem'
                    }}>
                      {award.aktueller_wert} {award.kriterium}
                    </div>
                  </div>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    border: isSelected ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.2)',
                    background: isSelected ? '#22c55e' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isSelected && <Check size={16} color="white" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Badge Categories */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        padding: '1.25rem',
        border: '1px solid rgba(255, 215, 0, 0.2)'
      }}>
        <h3 style={{
          color: '#ffd700',
          margin: '0 0 1rem 0',
          fontSize: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Award size={18} />
          Verfuegbare Badges
        </h3>

        {['training', 'pruefung', 'skill', 'special'].map(kategorie => {
          const badges = data.badges.filter(b => b.kategorie === kategorie);
          if (badges.length === 0) return null;

          const kategorieNames = {
            training: 'Training',
            pruefung: 'Pruefungen',
            skill: 'Skills',
            special: 'Spezial'
          };

          return (
            <div key={kategorie} style={{ marginBottom: '1rem' }}>
              <div style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {kategorieNames[kategorie]}
              </div>
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap'
              }}>
                {badges.map(badge => {
                  const Icon = getIcon(badge.icon);
                  return (
                    <div
                      key={badge.badge_id}
                      title={`${badge.name}: ${badge.beschreibung || ''}\nKriterium: ${badge.kriterium_wert || 'Manuell'}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: `linear-gradient(135deg, ${badge.farbe}20, transparent)`,
                        borderRadius: '20px',
                        padding: '0.4rem 0.75rem',
                        border: `1px solid ${badge.farbe}50`
                      }}
                    >
                      <Icon size={14} color={badge.farbe} />
                      <span style={{
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: '0.75rem',
                        fontWeight: 500
                      }}>
                        {badge.name}
                      </span>
                      {badge.kriterium_wert && (
                        <span style={{
                          color: 'rgba(255,255,255,0.4)',
                          fontSize: '0.65rem'
                        }}>
                          ({badge.kriterium_wert})
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Award Modal */}
      {showManualModal && (
        <div
          onClick={() => setShowManualModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1a1a1a',
              borderRadius: '12px',
              padding: '1.5rem',
              width: '400px',
              maxWidth: '90%',
              border: '1px solid rgba(255, 215, 0, 0.3)'
            }}
          >
            <h3 style={{ color: '#ffd700', margin: '0 0 1rem 0' }}>
              Badge manuell verleihen
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.85rem',
                marginBottom: '0.5rem'
              }}>
                Mitglied ({data.members?.length || 0} verfuegbar)
              </label>
              <select
                value={manualBadge.mitglied_id || ''}
                onChange={(e) => setManualBadge({ ...manualBadge, mitglied_id: e.target.value })}
                style={{
                  width: '100%',
                  background: '#2a2a2a',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  padding: '0.6rem',
                  color: 'white',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <option value="" style={{ background: '#2a2a2a', color: 'white' }}>Mitglied waehlen...</option>
                {data.members && data.members.map(m => (
                  <option key={m.mitglied_id} value={m.mitglied_id} style={{ background: '#2a2a2a', color: 'white' }}>
                    {m.vorname} {m.nachname}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.85rem',
                marginBottom: '0.5rem'
              }}>
                Badge ({data.badges?.length || 0} verfuegbar)
              </label>
              <select
                value={manualBadge.badge_id || ''}
                onChange={(e) => setManualBadge({ ...manualBadge, badge_id: e.target.value })}
                style={{
                  width: '100%',
                  background: '#2a2a2a',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  padding: '0.6rem',
                  color: 'white',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <option value="" style={{ background: '#2a2a2a', color: 'white' }}>Badge waehlen...</option>
                {data.badges && data.badges.map(b => (
                  <option key={b.badge_id} value={b.badge_id} style={{ background: '#2a2a2a', color: 'white' }}>
                    {b.name} ({b.kategorie})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.85rem',
                marginBottom: '0.5rem'
              }}>
                Kommentar (optional)
              </label>
              <input
                type="text"
                value={manualBadge.kommentar || ''}
                onChange={(e) => setManualBadge({ ...manualBadge, kommentar: e.target.value })}
                placeholder="Grund fuer die Auszeichnung..."
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  padding: '0.6rem',
                  color: 'white',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowManualModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'rgba(255,255,255,0.7)',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleManualAward}
                disabled={!manualBadge.mitglied_id || !manualBadge.badge_id}
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  border: 'none',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  opacity: (!manualBadge.mitglied_id || !manualBadge.badge_id) ? 0.5 : 1
                }}
              >
                Verleihen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgeAdminOverview;
