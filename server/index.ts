import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import {
  NET_PROTOCOL_VERSION,
  normalizeInput,
  parseClientMessage,
  sanitizeProfile,
  sanitizeRoomCode,
  type ServerMessage,
} from '../src/shared/net/protocol'
import type { CarnivalRoom } from './room'
import { RoomManager } from './roomManager'

const PORT = Number(process.env.PORT ?? 2567)
const HOST = process.env.HOST ?? '0.0.0.0'
const TICK_MS = 1000 / 60

interface Connection {
  socket: WebSocket
  socketId: string
  token: string
  playerId: string | null
  roomCode: string | null
  hello: boolean
}

const manager = new RoomManager()
const sockets = new Map<string, WebSocket>()

const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    response.end(
      JSON.stringify({
        ok: true,
        protocol: NET_PROTOCOL_VERSION,
        rooms: manager.roomCount,
        players: sockets.size,
      }),
    )
    return
  }
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  response.end('Carnival of... authoritative server')
})

const wss = new WebSocketServer({ server: httpServer, maxPayload: 16 * 1024 })

wss.on('connection', (socket) => {
  const connection: Connection = {
    socket,
    socketId: randomUUID(),
    token: randomUUID(),
    playerId: null,
    roomCode: null,
    hello: false,
  }

  socket.on('message', (data) => {
    handleMessage(connection, data.toString())
  })

  socket.on('close', () => {
    if (connection.playerId && connection.roomCode) {
      const playerId = connection.playerId
      const room = manager.disconnect(connection.token, playerId, connection.socketId)
      // A reconnect may already have replaced this socket. Only remove the
      // registry entry when it still belongs to the closing connection.
      if (sockets.get(playerId) === socket) sockets.delete(playerId)
      if (room) broadcastRoom(room)
    }
    connection.playerId = null
    connection.roomCode = null
  })

  socket.on('error', () => {
    // The close event performs the cleanup. Avoid logging noisy disconnects.
  })
})

function handleMessage(connection: Connection, raw: string): void {
  const message = parseClientMessage(raw)
  if (!message) {
    sendError(connection.socket, 'bad_message', 'Mensaje de red inválido.')
    return
  }

  if (message.type === 'hello') {
    if (message.protocol !== NET_PROTOCOL_VERSION) {
      sendError(
        connection.socket,
        'protocol_mismatch',
        `Versión de protocolo incompatible (${message.protocol} ≠ ${NET_PROTOCOL_VERSION}).`,
      )
      connection.socket.close()
      return
    }
    connection.hello = true
    if (message.token) {
      const resumed = manager.resume(message.token, connection.socketId)
      if (resumed && 'room' in resumed) {
        connection.token = message.token
        connection.playerId = resumed.player.id
        connection.roomCode = resumed.room.code
        sockets.set(resumed.player.id, connection.socket)
        send(connection.socket, {
          type: 'welcome',
          protocol: NET_PROTOCOL_VERSION,
          clientId: resumed.player.id,
          token: connection.token,
          resumed: true,
        })
        broadcastRoom(resumed.room)
        if (resumed.room.phase === 'playing') {
          const match = resumed.room.getMatch()
          if (match) send(connection.socket, { type: 'match_started', match })
          const snapshot = resumed.room.getLatestSnapshot()
          if (snapshot) send(connection.socket, { type: 'snapshot', snapshot })
        } else if (resumed.room.phase === 'ended') {
          const snapshot = resumed.room.getLatestSnapshot()
          if (snapshot) send(connection.socket, { type: 'snapshot', snapshot })
        }
        return
      }
      connection.token = randomUUID()
      send(connection.socket, {
        type: 'session_expired',
        message: 'La sesión anterior ya no está disponible. Se ha creado una nueva.',
      })
    }
    sendWelcome(connection, false)
    return
  }

  if (!connection.hello) {
    sendError(connection.socket, 'hello_required', 'Primero debes identificarte.')
    return
  }

  switch (message.type) {
    case 'create_room':
    case 'join_room': {
      if (connection.playerId) {
        sendError(connection.socket, 'already_in_room', 'Ya estás en una sala.')
        return
      }
      const profile = sanitizeProfile(message.profile)
      if (!profile) {
        sendError(connection.socket, 'bad_profile', 'Elige un rol y un personaje válidos.')
        return
      }
      const result =
        message.type === 'create_room'
          ? manager.createRoom(connection.token, connection.socketId, profile)
          : joinRoom(message.code, connection.token, connection.socketId, profile)
      if ('code' in result) {
        sendError(connection.socket, result.code, result.message)
        return
      }
      connection.playerId = result.player.id
      connection.roomCode = result.room.code
      sockets.set(result.player.id, connection.socket)
      send(connection.socket, {
        type: 'welcome',
        protocol: NET_PROTOCOL_VERSION,
        clientId: result.player.id,
        token: connection.token,
        resumed: false,
      })
      broadcastRoom(result.room)
      return
    }
    case 'update_profile': {
      const membership = getMembership(connection)
      if (!membership) return
      const profile = sanitizeProfile(message.profile)
      if (!profile) {
        sendError(connection.socket, 'bad_profile', 'Perfil de jugador inválido.')
        return
      }
      const error = membership.room.updateProfile(membership.player.id, profile)
      if (error) {
        sendError(connection.socket, error.code, error.message)
        return
      }
      broadcastRoom(membership.room)
      return
    }
    case 'ready': {
      const membership = getMembership(connection)
      if (!membership) return
      const error = membership.room.setReady(membership.player.id, message.ready)
      if (error) {
        sendError(connection.socket, error.code, error.message)
        return
      }
      broadcastRoom(membership.room)
      return
    }
    case 'start_match': {
      const membership = getMembership(connection)
      if (!membership) return
      const result = membership.room.start(membership.player.id, Date.now())
      if ('code' in result) {
        sendError(connection.socket, result.code, result.message)
        return
      }
      for (const player of membership.room.roomView().players) {
        if (!player.connected) continue
        const socket = sockets.get(player.id)
        if (socket) send(socket, { type: 'match_started', match: result })
      }
      broadcastRoom(membership.room)
      return
    }
    case 'input': {
      const membership = getMembership(connection)
      if (!membership) return
      const input = normalizeInput(message.input)
      if (!input) return
      membership.room.acceptInput(membership.player.id, input, Date.now())
      return
    }
    case 'ping': {
      send(connection.socket, {
        type: 'pong',
        clientTimeMs: message.clientTimeMs,
        serverTimeMs: Date.now(),
      })
      return
    }
    case 'leave': {
      if (!connection.playerId || !connection.roomCode) return
      const playerId = connection.playerId
      const room = manager.leave(connection.token, playerId, connection.socketId)
      if (sockets.get(playerId) === connection.socket) sockets.delete(playerId)
      connection.playerId = null
      connection.roomCode = null
      send(connection.socket, { type: 'left_room' })
      if (room) broadcastRoom(room)
      return
    }
  }
}

function joinRoom(code: string, token: string, socketId: string, profile: Parameters<typeof manager.joinRoom>[3]) {
  const cleanCode = sanitizeRoomCode(code)
  if (!cleanCode) {
    return { code: 'bad_code', message: 'El código debe tener 4 caracteres.' }
  }
  return manager.joinRoom(cleanCode, token, socketId, profile)
}

function getMembership(connection: Connection): { room: CarnivalRoom; player: { id: string } } | null {
  if (!connection.playerId || !connection.roomCode) {
    sendError(connection.socket, 'not_in_room', 'No estás en ninguna sala.')
    return null
  }
  const room = manager.roomByCode(connection.roomCode)
  if (!room) {
    sendError(connection.socket, 'room_missing', 'La sala ya no existe.')
    connection.playerId = null
    connection.roomCode = null
    return null
  }
  const player = room.getPlayer(connection.playerId)
  if (!player || player.socketId !== connection.socketId) {
    sendError(connection.socket, 'stale_socket', 'Esta conexión ya no controla la plaza.')
    connection.playerId = null
    connection.roomCode = null
    return null
  }
  return { room, player: { id: connection.playerId } }
}

function sendWelcome(connection: Connection, resumed: boolean): void {
  send(connection.socket, {
    type: 'welcome',
    protocol: NET_PROTOCOL_VERSION,
    clientId: connection.playerId ?? '',
    token: connection.token,
    resumed,
  })
}

function broadcastRoom(room: CarnivalRoom): void {
  for (const player of room.roomView().players) {
    if (!player.connected) continue
    const socket = sockets.get(player.id)
    if (!socket) continue
    send(socket, { type: 'room', room: room.roomView(player.id) })
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function sendError(socket: WebSocket, code: string, message: string): void {
  send(socket, { type: 'error', code, message })
}

let lastTick = Date.now()
setInterval(() => {
  const now = Date.now()
  const dt = Math.min(0.1, (now - lastTick) / 1000)
  lastTick = now
  // The room advances at a fixed 60 Hz cadence regardless of timer drift.
  const steps = Math.max(1, Math.min(4, Math.round(dt * 60)))
  for (let step = 0; step < steps; step++) {
    const snapshots = manager.tickRooms(now)
    for (const { room, snapshot } of snapshots) {
      if (!snapshot) continue
      for (const player of room.roomView().players) {
        if (!player.connected) continue
        const socket = sockets.get(player.id)
        if (socket) send(socket, { type: 'snapshot', snapshot })
      }
    }
  }
}, TICK_MS)

httpServer.listen(PORT, HOST, () => {
  console.log(`Carnival of... server listening on ws://${HOST}:${PORT} (protocol ${NET_PROTOCOL_VERSION})`)
})

function shutdown(): void {
  console.log('Stopping server...')
  wss.close()
  httpServer.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1500).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
