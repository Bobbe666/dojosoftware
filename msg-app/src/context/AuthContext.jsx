import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../api.js'
import { destroySocket } from '../socket.js'

const AuthContext = createContext(null)

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [overrideDojoId, setOverrideDojoId] = useState(() => {
    const stored = localStorage.getItem('msg_dojo_id')
    return stored ? parseInt(stored, 10) : null
  })

  useEffect(() => {
    const token = localStorage.getItem('msg_token')
    if (token) {
      const payload = parseJwt(token)
      if (payload && payload.exp * 1000 > Date.now() && payload.msg_app_enabled !== false) {
        setUser(payload)
      } else {
        localStorage.removeItem('msg_token')
      }
    }
    setLoading(false)
  }, [])

  // Token + optionale Dojo-ID aus URL-Parameter übernehmen (Dashboard-Link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    const urlDojoId = params.get('dojo_id')
    if (urlToken) {
      const payload = parseJwt(urlToken)
      if (payload && payload.exp * 1000 > Date.now()) {
        localStorage.setItem('msg_token', urlToken)
        setUser(payload)
      }
    }
    if (urlDojoId) {
      const parsed = parseInt(urlDojoId, 10)
      if (!isNaN(parsed)) {
        localStorage.setItem('msg_dojo_id', parsed)
        setOverrideDojoId(parsed)
      }
    }
    if (urlToken || urlDojoId) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const login = async (emailOrUsername, password) => {
    const isEmail = emailOrUsername.includes('@')
    const res = await api.post('/auth/login', isEmail
      ? { email: emailOrUsername, password }
      : { email: emailOrUsername, username: emailOrUsername, password }
    )
    const { token, user: userData } = res.data
    if (!token) throw new Error('Kein Token erhalten')
    const payload = parseJwt(token)
    if (payload?.msg_app_enabled === false) {
      throw new Error('Kein Zugang zur Msg-App. Bitte wende dich an den Administrator.')
    }
    localStorage.setItem('msg_token', token)
    setUser(payload || userData)
    return payload || userData
  }

  const logout = () => {
    localStorage.removeItem('msg_token')
    destroySocket()
    setUser(null)
  }

  // Hilfsfunktionen aus dem JWT
  // supervisor hat in der Msg-App Trainer-Rechte
  const isAdmin = ['admin', 'super_admin'].includes(user?.role) || ['admin', 'super_admin'].includes(user?.rolle)
  const isTrainer = ['trainer', 'supervisor'].includes(user?.role) || ['trainer', 'supervisor'].includes(user?.rolle)
  const isMember = !isAdmin && !isTrainer
  const memberType = isAdmin ? 'admin' : isTrainer ? 'trainer' : 'mitglied'
  const memberId = isMember ? user?.mitglied_id : user?.id
  // Reguläre Admins/Trainer/Mitglieder: dojo_id aus Token
  // Super-Admin: dojo_id aus Dashboard-Link (?dojo_id=) oder localStorage
  const dojoId = user?.dojo_id || overrideDojoId || null
  const displayName = user ? `${user.vorname || ''} ${user.nachname || user.username || ''}`.trim() : ''

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isTrainer, isMember, memberType, memberId, dojoId, displayName }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
