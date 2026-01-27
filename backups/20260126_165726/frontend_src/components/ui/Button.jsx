import React from 'react';
import './Button.css';

/**
 * Wiederverwendbare Button-Komponente
 *
 * @param {string} variant - primary, secondary, success, danger, warning, info, ghost
 * @param {string} size - sm, md, lg
 * @param {boolean} loading - Zeigt Lade-Spinner
 * @param {boolean} disabled - Deaktiviert Button
 * @param {boolean} fullWidth - Volle Breite
 * @param {React.ReactNode} icon - Icon vor dem Text
 * @param {React.ReactNode} iconRight - Icon nach dem Text
 * @param {string} type - button, submit, reset
 */
export const Button = ({
  children,
  variant = 'default',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconRight,
  type = 'button',
  className = '',
  onClick,
  ...props
}) => {
  const classes = [
    'ds-btn',
    `ds-btn--${variant}`,
    `ds-btn--${size}`,
    fullWidth && 'ds-btn--full',
    loading && 'ds-btn--loading',
    disabled && 'ds-btn--disabled',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <span className="ds-btn__spinner" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" className="ds-btn__spinner-icon">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" />
          </svg>
        </span>
      )}
      {!loading && icon && <span className="ds-btn__icon">{icon}</span>}
      {children && <span className="ds-btn__text">{children}</span>}
      {!loading && iconRight && <span className="ds-btn__icon ds-btn__icon--right">{iconRight}</span>}
    </button>
  );
};

/**
 * Icon-Only Button
 */
export const IconButton = ({
  children,
  variant = 'ghost',
  size = 'md',
  label,
  ...props
}) => {
  return (
    <Button
      variant={variant}
      size={size}
      className="ds-btn--icon-only"
      aria-label={label}
      {...props}
    >
      {children}
    </Button>
  );
};

/**
 * Button Group
 */
export const ButtonGroup = ({ children, className = '' }) => {
  return (
    <div className={`ds-btn-group ${className}`}>
      {children}
    </div>
  );
};

export default Button;
