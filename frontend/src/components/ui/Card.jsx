import React from 'react';
import './Card.css';

/**
 * Wiederverwendbare Card-Komponente
 *
 * @param {string} variant - default, glass, elevated, outlined
 * @param {boolean} hoverable - Hover-Effekt
 * @param {boolean} clickable - Klickbar (Cursor)
 * @param {React.ReactNode} header - Header-Inhalt
 * @param {React.ReactNode} footer - Footer-Inhalt
 */
export const Card = ({
  children,
  variant = 'default',
  hoverable = false,
  clickable = false,
  header,
  footer,
  className = '',
  onClick,
  ...props
}) => {
  const classes = [
    'ds-card',
    `ds-card--${variant}`,
    hoverable && 'ds-card--hoverable',
    clickable && 'ds-card--clickable',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick} {...props}>
      {header && <div className="ds-card__header">{header}</div>}
      <div className="ds-card__body">{children}</div>
      {footer && <div className="ds-card__footer">{footer}</div>}
    </div>
  );
};

/**
 * Stat Card für Dashboard-Statistiken
 */
export const StatCard = ({
  icon,
  label,
  value,
  trend,
  trendUp,
  className = '',
  onClick,
}) => {
  return (
    <Card
      variant="glass"
      hoverable
      clickable={!!onClick}
      onClick={onClick}
      className={`ds-stat-card ${className}`}
    >
      {icon && <div className="ds-stat-card__icon">{icon}</div>}
      <div className="ds-stat-card__content">
        <span className="ds-stat-card__value">{value}</span>
        <span className="ds-stat-card__label">{label}</span>
      </div>
      {trend && (
        <div className={`ds-stat-card__trend ${trendUp ? 'ds-stat-card__trend--up' : 'ds-stat-card__trend--down'}`}>
          {trendUp ? '↑' : '↓'} {trend}
        </div>
      )}
    </Card>
  );
};

/**
 * Nav Card für Dashboard-Navigation
 */
export const NavCard = ({
  icon,
  title,
  description,
  count,
  badge,
  badgeVariant = 'default',
  featured = false,
  onClick,
  className = '',
}) => {
  return (
    <Card
      variant={featured ? 'elevated' : 'default'}
      hoverable
      clickable
      onClick={onClick}
      className={`ds-nav-card ${featured ? 'ds-nav-card--featured' : ''} ${className}`}
    >
      {badge && (
        <span className={`ds-nav-card__badge ds-badge ds-badge--${badgeVariant}`}>
          {badge}
        </span>
      )}
      <div className="ds-nav-card__content">
        <div className="ds-nav-card__header">
          {icon && <span className="ds-nav-card__icon">{icon}</span>}
          <h3 className="ds-nav-card__title">
            {title}
            {count !== undefined && (
              <span className="ds-nav-card__count">({count})</span>
            )}
          </h3>
        </div>
        {description && (
          <p className="ds-nav-card__description">{description}</p>
        )}
      </div>
      <span className="ds-nav-card__arrow">→</span>
    </Card>
  );
};

export default Card;
