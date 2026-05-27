import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Kein Verifizierungs-Token in der URL gefunden.');
      return;
    }
    axios.post('/auth/verify-email', { token })
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/login'), 3000);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Link ungültig oder abgelaufen. Bitte fordere einen neuen an.');
      });
  }, [token]);

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <img src="/dojo-logo.png" alt="DojoSoftware" style={{ height: 36, marginRight: 8 }} />
            <h1 className="title">E-Mail bestätigen</h1>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          {status === 'loading' && (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
              <p style={{ color: '#94a3b8' }}>Verifizierung läuft…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle size={56} style={{ color: '#4ade80', margin: '0 auto 1rem', display: 'block' }} />
              <p style={{ color: '#4ade80', fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                E-Mail erfolgreich bestätigt!
              </p>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
                Du wirst automatisch zum Login weitergeleitet…
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle size={56} style={{ color: '#f87171', margin: '0 auto 1rem', display: 'block' }} />
              <p style={{ color: '#f87171', fontWeight: 600, marginBottom: '0.75rem' }}>{message}</p>
              <button
                onClick={() => navigate('/login')}
                className="btn btn-primary"
                style={{ marginTop: '0.5rem' }}
              >
                Zum Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
