import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (!socket) {
    const token = localStorage.getItem('msg_token')
    const isLocalDev = window.location.hostname === 'localhost'
    const serverUrl = isLocalDev ? 'http://localhost:5001' : 'https://dojo.tda-intl.org'

    socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => console.log('[MSG] Socket connected'))
    socket.on('disconnect', () => console.log('[MSG] Socket disconnected'))
    socket.on('connect_error', (e) => console.warn('[MSG] Socket error:', e.message))
  }
  return socket
}

export function destroySocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
