/**
 * BADGE DISPLAY KOMPONENTE
 * ========================
 * Zeigt Badges/Auszeichnungen eines Mitglieds an
 */

import React, { useState, useEffect } from 'react';
import {
  Award, Star, Trophy, Medal, Crown, Flame, Target, Heart,
  Users, Swords, Zap, TrendingUp, Footprints, Layers, Brain, Shield
} from 'lucide-react';

// Icon-Mapping
const iconMap = {
  award: Award,
  star: Star,
  trophy: Trophy,
  medal: Medal,
  crown: Crown,
  flame: Flame,
  target: Target,
  heart: Heart,
  users: Users,
  swords: Swords,
  zap: Zap,
  'trending-up': TrendingUp,
  footprints: Footprints,
  layers: Layers,
  brain: Brain,
  shield: Shield
};

const BadgeDisplay = ({ mitgliedId, compact = false }) => {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mitgliedId) {
      loadBadges();
    }
  }, [mitgliedId]);

  const loadBadges = async () => {
    try {
      const response = await fetch(`/api/badges/mitglied/${mitgliedId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBadges(data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName) => {
    const IconComponent = iconMap[iconName] || Award;
    return IconComponent;
  };

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        Lade Badges...
      </div>
    );
  }

  if (badges.length === 0) {
    return compact ? null : (
      <div style={{
        padding: '1rem',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.5)',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
        border: '1px dashed rgba(255,255,255,0.1)'
      }}>
        Noch keine Auszeichnungen erhalten
      </div>
    );
  }

  if (compact) {
    // Kompakte Ansicht - nur Icons
    return (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {badges.slice(0, 6).map((badge) => {
          const Icon = getIcon(badge.icon);
          return (
            <div
              key={badge.id}
              title={`${badge.name}: ${badge.beschreibung || ''}`}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${badge.farbe}40, ${badge.farbe}20)`,
                border: `2px solid ${badge.farbe}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = `0 0 12px ${badge.farbe}60`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Icon size={16} color={badge.farbe} />
            </div>
          );
        })}
        {badges.length > 6 && (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.7)'
          }}>
            +{badges.length - 6}
          </div>
        )}
      </div>
    );
  }

  // Vollstaendige Ansicht
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '12px',
      padding: '1rem',
      border: '1px solid rgba(255, 215, 0, 0.2)'
    }}>
      <h3 style={{
        fontSize: '0.9rem',
        color: '#ffd700',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Trophy size={18} />
        Auszeichnungen ({badges.length})
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '0.75rem'
      }}>
        {badges.map((badge) => {
          const Icon = getIcon(badge.icon);
          return (
            <div
              key={badge.id}
              style={{
                background: `linear-gradient(135deg, ${badge.farbe}15, transparent)`,
                borderRadius: '10px',
                padding: '0.75rem',
                border: `1px solid ${badge.farbe}40`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 4px 16px ${badge.farbe}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${badge.farbe}40, ${badge.farbe}20)`,
                border: `2px solid ${badge.farbe}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 16px ${badge.farbe}40`
              }}>
                <Icon size={24} color={badge.farbe} />
              </div>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.9)',
                textAlign: 'center'
              }}>
                {badge.name}
              </div>
              <div style={{
                fontSize: '0.65rem',
                color: 'rgba(255,255,255,0.5)',
                textAlign: 'center'
              }}>
                {new Date(badge.verliehen_am).toLocaleDateString('de-DE')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BadgeDisplay;
