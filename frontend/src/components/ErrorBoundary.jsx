import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

/**
 * Error Boundary Component
 * Fängt JavaScript-Fehler in Child-Komponenten ab und zeigt Fallback-UI
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error für Debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Optional: Error an Backend senden
    this.reportError(error, errorInfo);
  }

  reportError = async (error, errorInfo) => {
    try {
      // Nur in Production an Backend senden
      if (import.meta.env.PROD) {
        await fetch('/api/errors/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo?.componentStack,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          })
        });
      }
    } catch (e) {
      // Fehler beim Reporting ignorieren
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconContainer}>
              <AlertTriangle size={64} color="#ef4444" />
            </div>

            <h1 style={styles.title}>Etwas ist schiefgelaufen</h1>

            <p style={styles.message}>
              Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut
              oder kontaktieren Sie den Support, wenn das Problem weiterhin besteht.
            </p>

            <div style={styles.buttonContainer}>
              <button onClick={this.handleReload} style={styles.primaryButton}>
                <RefreshCw size={18} />
                Seite neu laden
              </button>

              <button onClick={this.handleGoHome} style={styles.secondaryButton}>
                <Home size={18} />
                Zur Startseite
              </button>
            </div>

            {isDev && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>
                  <Bug size={16} />
                  Technische Details (nur Development)
                </summary>
                <div style={styles.errorDetails}>
                  <p style={styles.errorMessage}>
                    <strong>Fehler:</strong> {this.state.error.message}
                  </p>
                  <pre style={styles.stackTrace}>
                    {this.state.error.stack}
                  </pre>
                  {this.state.errorInfo?.componentStack && (
                    <>
                      <p style={styles.errorMessage}>
                        <strong>Komponenten-Stack:</strong>
                      </p>
                      <pre style={styles.stackTrace}>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    backgroundColor: '#0f172a',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '600px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid #334155'
  },
  iconContainer: {
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: '16px'
  },
  message: {
    fontSize: '16px',
    color: '#94a3b8',
    lineHeight: '1.6',
    marginBottom: '32px'
  },
  buttonContainer: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#0f172a',
    backgroundColor: '#fbbf24',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  secondaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#e2e8f0',
    backgroundColor: 'transparent',
    border: '2px solid #475569',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  details: {
    marginTop: '32px',
    textAlign: 'left'
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#334155',
    borderRadius: '8px',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px'
  },
  errorDetails: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#1a1a2e',
    borderRadius: '8px',
    border: '1px solid #ef4444'
  },
  errorMessage: {
    color: '#fca5a5',
    fontSize: '14px',
    marginBottom: '8px'
  },
  stackTrace: {
    fontSize: '12px',
    color: '#94a3b8',
    overflow: 'auto',
    maxHeight: '200px',
    padding: '12px',
    backgroundColor: '#0f172a',
    borderRadius: '4px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  }
};

export default ErrorBoundary;
