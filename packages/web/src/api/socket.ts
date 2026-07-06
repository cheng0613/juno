import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function createSocket(token?: string): Socket {
  if (socket?.connected) return socket

  socket = io('/chat', {
    transports: ['websocket', 'polling'],
    auth: token ? { token } : undefined,
  })

  socket.on('connect', () => {
    console.log('[WS] connected')
  })

  socket.on('disconnect', (reason) => {
    console.log('[WS] disconnected:', reason)
  })

  socket.on('connect_error', (err) => {
    console.error('[WS] connection error:', err.message)
  })

  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}