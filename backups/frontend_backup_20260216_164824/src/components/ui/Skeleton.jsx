import React from 'react';
import './Skeleton.css';

/**
 * Skeleton - Einheitliche Loading-Platzhalter Komponente
 * 
 * Varianten:
 * - text: Einzeilige Text-Zeile
 * - title: Größerer Titel
 * - avatar: Runder Avatar-Platzhalter
 * - thumbnail: Quadratisches Bild
 * - card: Volle Karten-Vorschau
 * - table-row: Tabellenzeile
 * - button: Button-Form
 * - input: Input-Feld Form
 */

export const Skeleton = ({ 
  variant = 'text', 
  width, 
  height, 
  className = '',
  count = 1,
  style = {}
}) => {
  const baseClass = 'skeleton';
  const variantClass = `skeleton-${variant}`;
  
  const customStyle = {
    ...style,
    ...(width && { width }),
    ...(height && { height }),
  };

  if (count > 1) {
    return (
      <div className="skeleton-group">
        {Array.from({ length: count }).map((_, i) => (
          <div 
            key={i} 
            className={`${baseClass} ${variantClass} ${className}`}
            style={customStyle}
          />
        ))}
      </div>
    );
  }

  return (
    <div 
      className={`${baseClass} ${variantClass} ${className}`}
      style={customStyle}
    />
  );
};

/**
 * SkeletonCard - Vorgefertigte Karten-Skeleton
 */
export const SkeletonCard = ({ showAvatar = true, lines = 3 }) => (
  <div className="skeleton-card">
    {showAvatar && (
      <div className="skeleton-card-header">
        <Skeleton variant="avatar" />
        <div className="skeleton-card-header-text">
          <Skeleton variant="title" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
    )}
    <div className="skeleton-card-body">
      <Skeleton variant="text" count={lines} />
    </div>
  </div>
);

/**
 * SkeletonTable - Vorgefertigte Tabellen-Skeleton
 */
export const SkeletonTable = ({ rows = 5, columns = 4 }) => (
  <div className="skeleton-table">
    <div className="skeleton-table-header">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} variant="text" width={`${80 + Math.random() * 40}px`} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="skeleton-table-row">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton 
            key={colIndex} 
            variant="text" 
            width={`${60 + Math.random() * 60}px`} 
          />
        ))}
      </div>
    ))}
  </div>
);

/**
 * SkeletonProfile - Mitglieder-Profil Skeleton
 */
export const SkeletonProfile = () => (
  <div className="skeleton-profile">
    <div className="skeleton-profile-header">
      <Skeleton variant="avatar" width="120px" height="120px" />
      <div className="skeleton-profile-info">
        <Skeleton variant="title" width="200px" />
        <Skeleton variant="text" width="150px" />
        <Skeleton variant="text" width="180px" />
      </div>
    </div>
    <div className="skeleton-profile-stats">
      <Skeleton variant="card" width="100px" height="60px" />
      <Skeleton variant="card" width="100px" height="60px" />
      <Skeleton variant="card" width="100px" height="60px" />
    </div>
    <div className="skeleton-profile-content">
      <Skeleton variant="text" count={5} />
    </div>
  </div>
);

/**
 * SkeletonList - Listen-Skeleton
 */
export const SkeletonList = ({ items = 5, showAvatar = false }) => (
  <div className="skeleton-list">
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="skeleton-list-item">
        {showAvatar && <Skeleton variant="avatar" width="40px" height="40px" />}
        <div className="skeleton-list-item-content">
          <Skeleton variant="text" width={`${60 + Math.random() * 30}%`} />
          <Skeleton variant="text" width={`${40 + Math.random() * 20}%`} height="12px" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * LoadingSpinner - Spinner für Buttons und kleine Bereiche
 */
export const LoadingSpinner = ({ size = 'medium', color = 'currentColor' }) => {
  const sizeMap = {
    small: '16px',
    medium: '24px',
    large: '32px',
  };
  
  return (
    <svg 
      className="loading-spinner"
      width={sizeMap[size]} 
      height={sizeMap[size]} 
      viewBox="0 0 24 24"
      style={{ color }}
    >
      <circle 
        className="loading-spinner-track"
        cx="12" 
        cy="12" 
        r="10" 
        fill="none" 
        strokeWidth="3"
      />
      <circle 
        className="loading-spinner-head"
        cx="12" 
        cy="12" 
        r="10" 
        fill="none" 
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * LoadingButton - Button mit integriertem Loading-State
 */
export const LoadingButton = ({ 
  children, 
  loading = false, 
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  variant = 'primary',
  ...props 
}) => (
  <button
    type={type}
    className={`btn btn-${variant} loading-button ${loading ? 'is-loading' : ''} ${className}`}
    disabled={disabled || loading}
    onClick={onClick}
    {...props}
  >
    {loading && <LoadingSpinner size="small" />}
    <span className={loading ? 'loading-button-text' : ''}>{children}</span>
  </button>
);

/**
 * LoadingOverlay - Overlay für größere Bereiche
 */
export const LoadingOverlay = ({ message = 'Wird geladen...' }) => (
  <div className="loading-overlay">
    <div className="loading-overlay-content">
      <LoadingSpinner size="large" />
      <p>{message}</p>
    </div>
  </div>
);

export default Skeleton;
