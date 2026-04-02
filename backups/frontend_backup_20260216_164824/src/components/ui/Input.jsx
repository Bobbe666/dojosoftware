import React, { forwardRef } from 'react';
import './Input.css';

/**
 * Wiederverwendbare Input-Komponente
 */
export const Input = forwardRef(({
  type = 'text',
  label,
  error,
  helper,
  icon,
  iconRight,
  required = false,
  disabled = false,
  fullWidth = true,
  className = '',
  ...props
}, ref) => {
  const id = props.id || props.name;
  const hasError = !!error;

  return (
    <div className={`ds-form-group ${fullWidth ? 'ds-form-group--full' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="ds-form-label">
          {label}
          {required && <span className="ds-form-required">*</span>}
        </label>
      )}
      <div className={`ds-input-wrapper ${hasError ? 'ds-input-wrapper--error' : ''}`}>
        {icon && <span className="ds-input-icon ds-input-icon--left">{icon}</span>}
        <input
          ref={ref}
          id={id}
          type={type}
          className={`ds-input ${icon ? 'ds-input--with-icon-left' : ''} ${iconRight ? 'ds-input--with-icon-right' : ''}`}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
          {...props}
        />
        {iconRight && <span className="ds-input-icon ds-input-icon--right">{iconRight}</span>}
      </div>
      {error && (
        <span id={`${id}-error`} className="ds-form-error" role="alert">
          {error}
        </span>
      )}
      {helper && !error && (
        <span id={`${id}-helper`} className="ds-form-helper">
          {helper}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

/**
 * Textarea
 */
export const Textarea = forwardRef(({
  label,
  error,
  helper,
  required = false,
  disabled = false,
  rows = 4,
  fullWidth = true,
  className = '',
  ...props
}, ref) => {
  const id = props.id || props.name;
  const hasError = !!error;

  return (
    <div className={`ds-form-group ${fullWidth ? 'ds-form-group--full' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="ds-form-label">
          {label}
          {required && <span className="ds-form-required">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        className={`ds-textarea ${hasError ? 'ds-textarea--error' : ''}`}
        disabled={disabled}
        aria-invalid={hasError}
        {...props}
      />
      {error && (
        <span id={`${id}-error`} className="ds-form-error" role="alert">
          {error}
        </span>
      )}
      {helper && !error && (
        <span id={`${id}-helper`} className="ds-form-helper">
          {helper}
        </span>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

/**
 * Select
 */
export const Select = forwardRef(({
  label,
  error,
  helper,
  options = [],
  placeholder = 'Bitte wählen...',
  required = false,
  disabled = false,
  fullWidth = true,
  className = '',
  ...props
}, ref) => {
  const id = props.id || props.name;
  const hasError = !!error;

  return (
    <div className={`ds-form-group ${fullWidth ? 'ds-form-group--full' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="ds-form-label">
          {label}
          {required && <span className="ds-form-required">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={`ds-select ${hasError ? 'ds-select--error' : ''}`}
        disabled={disabled}
        aria-invalid={hasError}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${id}-error`} className="ds-form-error" role="alert">
          {error}
        </span>
      )}
      {helper && !error && (
        <span id={`${id}-helper`} className="ds-form-helper">
          {helper}
        </span>
      )}
    </div>
  );
});

Select.displayName = 'Select';

/**
 * Checkbox
 */
export const Checkbox = forwardRef(({
  label,
  error,
  disabled = false,
  className = '',
  ...props
}, ref) => {
  const id = props.id || props.name;

  return (
    <div className={`ds-checkbox-group ${className}`}>
      <label className="ds-checkbox-label">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="ds-checkbox"
          disabled={disabled}
          {...props}
        />
        <span className="ds-checkbox-indicator" />
        {label && <span className="ds-checkbox-text">{label}</span>}
      </label>
      {error && (
        <span className="ds-form-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';

export default Input;
