import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Login fehlgeschlagen.'
      setError(msg)
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">💬</div>
        <h1 className="login-title">Dojo MSG</h1>
        <p className="login-sub">Mit deinem Dojo-Konto anmelden</p>

        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            className="login-input"
            placeholder="E-Mail oder Benutzername"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
          />
          <input
            type="password"
            className="login-input"
            placeholder="Passwort"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
