import {
  NET_PROTOCOL_VERSION,
  parseServerMessage,
  type ClientMessage,
  type MatchStart,
  type NetInput,
  type NetSnapshot,
  type RoomView,
  type ServerMessage,
} from '../shared/net/protocol'

const TOKEN_KEY = 'carnival.net.token'
const MAX_RECONNECT_ATTEMPTS = 6

export type NetworkStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'closed'

export type NetworkNotice = {
  kind: 'error' | 'info'
  message: string
}

/**
 * Browser WebSocket client. All movement is predicted locally for the own
 * player and corrected from authoritative snapshots; remote actors interpolate
 * between the same snapshots.
 */
export class NetworkClient {
  status: NetworkStatus = 'idle'
  clientId = ''
  token = ''
  room: RoomView | null = null
  latencyMs = 0
  lastSnapshot: NetSnapshot | null = null
  lastMatch: MatchStart | null = null

  onRoom: ((room: RoomView | null) => void) | null = null
  onMatchStart: ((match: MatchStart) => void) | null = null
  onSnapshot: ((snapshot: NetSnapshot) => void) | null = null
  onStatus: ((status: NetworkStatus) => void) | null = null
  onNotice: ((notice: NetworkNotice) => void) | null = null

  private socket: WebSocket | null = null
  private reconnectTimer: number | null = null
  private pingTimer: number | null = null
  private reconnectAttempts = 0
  private manualClose = false
  private pendingConnect: {
    resolve: () => void
    reject: (reason: Error) => void
  } | null = null

  constructor() {
    this.token = readToken()
  }

  connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN && this.status === 'connected') {
      return Promise.resolve()
    }
    this.manualClose = false
    this.reconnectAttempts = 0
    this.setStatus('connecting')
    return new Promise((resolve, reject) => {
      this.pendingConnect = { resolve, reject }
      this.openSocket()
    })
  }

  createRoom(profile: { name: string; role: 'survivor' | 'killer'; characterId: string }): void {
    this.send({ type: 'create_room', profile })
  }

  joinRoom(
    code: string,
    profile: { name: string; role: 'survivor' | 'killer'; characterId: string },
  ): void {
    this.send({ type: 'join_room', code, profile })
  }

  updateProfile(profile: {
    name: string
    role: 'survivor' | 'killer'
    characterId: string
  }): void {
    this.send({ type: 'update_profile', profile })
  }

  setReady(ready: boolean): void {
    this.send({ type: 'ready', ready })
  }

  startMatch(): void {
    this.send({ type: 'start_match' })
  }

  sendInput(input: NetInput): void {
    this.send({ type: 'input', input })
  }

  leaveRoom(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({ type: 'leave' })
    }
    this.token = ''
    writeToken('')
    this.room = null
    this.lastSnapshot = null
    this.lastMatch = null
    this.onRoom?.(null)
  }

  disconnect(): void {
    this.manualClose = true
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopPing()
    this.closeCurrentSocket()
    this.pendingConnect?.reject(new Error('Conexión cancelada.'))
    this.pendingConnect = null
    this.room = null
    this.lastSnapshot = null
    this.lastMatch = null
    this.setStatus('closed')
  }

  private closeCurrentSocket(): void {
    const socket = this.socket
    if (!socket) return
    this.socket = null
    socket.onopen = null
    socket.onmessage = null
    socket.onclose = null
    socket.onerror = null
    try {
      socket.close(1000, 'client_reset')
    } catch {
      // The socket may already be closing.
    }
  }

  private openSocket(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    let socket: WebSocket
    try {
      socket = new WebSocket(serverUrl())
    } catch (reason) {
      this.handleFailure(reason instanceof Error ? reason : new Error(String(reason)))
      return
    }
    this.socket = socket

    socket.onopen = () => {
      if (this.socket !== socket) return
      this.send({
        type: 'hello',
        protocol: NET_PROTOCOL_VERSION,
        token: this.token || undefined,
      })
    }

    socket.onmessage = (event) => {
      if (this.socket !== socket) return
      const message = parseServerMessage(String(event.data))
      if (!message) return
      this.handleMessage(message)
    }

    socket.onclose = () => {
      // Ignore a late close from a socket that was already replaced.
      if (this.socket !== socket) return
      const wasConnecting = this.pendingConnect !== null
      this.socket = null
      this.stopPing()
      if (this.manualClose) {
        this.setStatus('closed')
        return
      }
      if (wasConnecting) {
        this.pendingConnect?.reject(new Error('No se pudo abrir la conexión con el servidor.'))
        this.pendingConnect = null
        this.setStatus('closed')
        return
      }
      this.scheduleReconnect()
    }

    socket.onerror = () => {
      // onclose owns retries and user-visible errors.
    }
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome': {
        const hadSession = Boolean(this.room || this.lastMatch)
        this.token = message.token
        this.clientId = message.clientId
        writeToken(message.token)
        this.reconnectAttempts = 0
        this.pendingConnect?.resolve()
        this.pendingConnect = null
        if (hadSession && !message.resumed) {
          this.room = null
          this.lastSnapshot = null
          this.lastMatch = null
          this.onRoom?.(null)
          this.onNotice?.({
            kind: 'error',
            message: 'La sala anterior ya no existe en el servidor. Vuelve al menú.',
          })
          this.stopPing()
          this.closeCurrentSocket()
          this.setStatus('closed')
          return
        }
        this.setStatus('connected')
        this.startPing()
        return
      }
      case 'room':
        this.room = message.room
        this.onRoom?.(message.room)
        return
      case 'left_room':
        this.room = null
        this.lastSnapshot = null
        this.lastMatch = null
        this.onRoom?.(null)
        return
      case 'match_started':
        this.lastMatch = message.match
        this.onMatchStart?.(message.match)
        return
      case 'snapshot':
        this.lastSnapshot = message.snapshot
        this.onSnapshot?.(message.snapshot)
        return
      case 'pong':
        this.latencyMs = Math.max(0, Date.now() - message.clientTimeMs)
        return
      case 'session_expired':
        this.onNotice?.({ kind: 'info', message: message.message })
        return
      case 'error':
        this.onNotice?.({ kind: 'error', message: message.message })
        return
    }
  }

  private scheduleReconnect(): void {
    if (this.manualClose) return
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.setStatus('closed')
      this.onNotice?.({
        kind: 'error',
        message: 'Se agotaron los intentos de reconexión. Vuelve al menú.',
      })
      return
    }
    this.reconnectAttempts++
    this.setStatus('reconnecting')
    const delay = Math.min(5000, 450 * 2 ** this.reconnectAttempts)
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.openSocket()
    }, delay)
  }

  private handleFailure(reason: Error): void {
    this.pendingConnect?.reject(reason)
    this.pendingConnect = null
    this.setStatus('closed')
    this.onNotice?.({ kind: 'error', message: reason.message })
  }

  private startPing(): void {
    this.stopPing()
    this.pingTimer = window.setInterval(() => {
      this.send({ type: 'ping', clientTimeMs: Date.now() })
    }, 2000)
  }

  private stopPing(): void {
    if (this.pingTimer === null) return
    window.clearInterval(this.pingTimer)
    this.pingTimer = null
  }

  private setStatus(status: NetworkStatus): void {
    if (this.status === status) return
    this.status = status
    this.onStatus?.(status)
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return
    this.socket.send(JSON.stringify(message))
  }
}

function readToken(): string {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeToken(token: string): void {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Private mode can block storage; reconnect then depends on the open tab.
  }
}

function serverUrl(): string {
  const configured = import.meta.env.VITE_SERVER_URL as string | undefined
  if (configured) return configured
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.hostname || 'localhost'}:2567`
}
