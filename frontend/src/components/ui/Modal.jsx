import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Modal.css';

/**
 * Wiederverwendbare Modal-Komponente
 *
 * @param {boolean} isOpen - Modal geöffnet
 * @param {function} onClose - Schließen-Callback
 * @param {string} title - Modal-Titel
 * @param {string} size - sm, md, lg, xl, fullscreen
 * @param {boolean} closeOnOverlay - Bei Klick auf Overlay schließen
 * @param {boolean} closeOnEsc - Bei ESC schließen
 * @param {boolean} showClose - Schließen-Button anzeigen
 * @param {React.ReactNode} footer - Footer-Inhalt
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlay = true,
  closeOnEsc = true,
  showClose = true,
  footer,
  className = '',
}) => {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Focus Trap & ESC Handler
  useEffect(() => {
    if (!isOpen) return;

    // Store previous active element
    previousActiveElement.current = document.activeElement;

    // Focus modal
    modalRef.current?.focus();

    // ESC Handler
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && closeOnEsc) {
        onClose?.();
      }
    };

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus
      previousActiveElement.current?.focus();
    };
  }, [isOpen, closeOnEsc, onClose]);

  // Handle overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnOverlay) {
      onClose?.();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="ds-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={modalRef}
        className={`ds-modal ds-modal--${size} ${className}`}
        tabIndex={-1}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="ds-modal__header">
            {title && (
              <h2 id="modal-title" className="ds-modal__title">
                {title}
              </h2>
            )}
            {showClose && (
              <button
                type="button"
                className="ds-modal__close"
                onClick={onClose}
                aria-label="Schließen"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="ds-modal__body">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="ds-modal__footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Render to portal
  return createPortal(modalContent, document.body);
};

/**
 * Modal Header (für custom Header)
 */
export const ModalHeader = ({ children, className = '' }) => (
  <div className={`ds-modal__header ${className}`}>{children}</div>
);

/**
 * Modal Body
 */
export const ModalBody = ({ children, className = '' }) => (
  <div className={`ds-modal__body ${className}`}>{children}</div>
);

/**
 * Modal Footer
 */
export const ModalFooter = ({ children, className = '' }) => (
  <div className={`ds-modal__footer ${className}`}>{children}</div>
);

/**
 * Confirm Dialog
 */
export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Bestätigung',
  message,
  confirmText = 'Bestätigen',
  cancelText = 'Abbrechen',
  variant = 'danger',
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="ds-modal__message">{message}</p>
      <div className="ds-modal__actions">
        <button
          type="button"
          className="ds-btn ds-btn--ghost"
          onClick={onClose}
        >
          {cancelText}
        </button>
        <button
          type="button"
          className={`ds-btn ds-btn--${variant}`}
          onClick={() => {
            onConfirm?.();
            onClose?.();
          }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default Modal;
