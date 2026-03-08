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
import '../styles/BadgeDisplay.css';

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
      <div className="badge-display__loading">
        Lade Badges...
      </div>
    );
  }

  if (badges.length === 0) {
    return compact ? null : (
      <div className="badge-display__empty">
        Noch keine Auszeichnungen erhalten
      </div>
    );
  }

  if (compact) {
    // Kompakte Ansicht - nur Icons
    return (
      <div className="u-flex-wrap-gap">
        {badges.slice(0, 6).map((badge) => {
          const Icon = getIcon(badge.icon);
          return (
            <div
              key={badge.id}
              title={`${badge.name}: ${badge.beschreibung || ''}`}
              className="badge-display__compact-icon"
              style={{ '--badge-farbe': badge.farbe }}
            >
              <Icon size={16} color={badge.farbe} />
            </div>
          );
        })}
        {badges.length > 6 && (
          <div className="badge-display__compact-more">
            +{badges.length - 6}
          </div>
        )}
      </div>
    );
  }

  // Vollstaendige Ansicht
  return (
    <div className="badge-display__container">
      <h3 className="badge-display__title">
        <Trophy size={18} />
        Auszeichnungen ({badges.length})
      </h3>

      <div className="badge-display__grid">
        {badges.map((badge) => {
          const Icon = getIcon(badge.icon);
          return (
            <div
              key={badge.id}
              className="badge-display__card"
              style={{ '--badge-farbe': badge.farbe }}
            >
              <div className="badge-display__card-icon">
                <Icon size={24} color={badge.farbe} />
              </div>
              <div className="badge-display__card-name">
                {badge.name}
              </div>
              <div className="badge-display__card-date">
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
