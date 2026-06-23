// =====================================================================================
// CHAT ERROR BOUNDARY
// Fängt Render-Fehler im Chat ab, damit NICHT die ganze App schwarz wird.
// Zeigt einen Wiederherstellen-Button statt eines Komplett-Absturzes.
// =====================================================================================

import React from 'react';

class ChatErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Fehler still protokollieren – darf die App nicht weiter stören
    try { console.error('[ChatErrorBoundary]', error, info?.componentStack); } catch (_) {}
  }

  handleReset = () => {
    this.setState({ hasError: false });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 14, padding: '2rem', textAlign: 'center', minHeight: 200, color: 'var(--text-secondary, #64748b)'
        }}>
          <div style={{ fontSize: 32 }}>🥋</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>Der Chat konnte kurz nicht geladen werden.</div>
          <div style={{ fontSize: 14 }}>Tippe auf „Erneut versuchen" – die App muss nicht neu gestartet werden.</div>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: 4, padding: '0.55rem 1.4rem', borderRadius: 8, border: 'none',
              background: '#4f7cff', color: '#fff', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Erneut versuchen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ChatErrorBoundary;
