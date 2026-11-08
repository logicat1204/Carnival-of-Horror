import { randomInt, randomUUID } from 'node:crypto'
import type { LobbyProfile } from '../src/shared/net/protocol'
import { CarnivalRoom, type InternalPlayer, type RoomError } from './room'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export interface RoomMembership {
  room: CarnivalRoom
  player: InternalPlayer
}

interface TokenRecord {
  roomCode: string
  playerId: string
}

/** In-memory room registry. A real deployment would externalize this. */
export class RoomManager {
  private readonly rooms = new Map<string, CarnivalRoom>()
  private readonly tokens = new Map<string, TokenRecord>()

  get roomCount(): number {
    return this.rooms.size
  }

  createRoom(
    token: string,
    socketId: string,
    profile: LobbyProfile,
    now = Date.now(),
  ): RoomMembership | RoomError {
    const code = this.generateCode()
    const room = new CarnivalRoom(code)
    this.rooms.set(code, room)
    const result = room.addPlayer(randomUUID(), token, socketId, profile, now)
    if ('code' in result) {
      this.rooms.delete(code)
      return result
    }
    this.tokens.set(token, { roomCode: code, playerId: result.id })
    return { room, player: result }
  }

  joinRoom(
    code: string,
    token: string,
    socketId: string,
    profile: LobbyProfile,
    now = Date.now(),
  ): RoomMembership | RoomError {
    const room = this.rooms.get(code)
    if (!room) return { code: 'room_not_found', message: 'No existe ninguna sala con ese código.' }
    if (room.isClosed) {
      this.rooms.delete(code)
      return { code: 'room_closed', message: 'La sala ya no está disponible.' }
    }
    const result = room.addPlayer(randomUUID(), token, socketId, profile, now)
    if ('code' in result) return result
    this.tokens.set(token, { roomCode: code, playerId: result.id })
    return { room, player: result }
  }

  resume(token: string, socketId: string, now = Date.now()): RoomMembership | RoomError | null {
    const record = this.tokens.get(token)
    if (!record) return null
    const room = this.rooms.get(record.roomCode)
    if (!room) {
      this.tokens.delete(token)
      return null
    }
    const result = room.reattach(record.playerId, socketId, now)
    if ('code' in result) {
      this.tokens.delete(token)
      return result
    }
    return { room, player: result }
  }

  leave(token: string, playerId: string, socketId?: string): CarnivalRoom | null {
    const record = this.tokens.get(token)
    const room = record ? this.rooms.get(record.roomCode) : null
    if (!room) return null
    // A late message from a replaced socket must not remove the new session.
    if (!room.disconnect(playerId, Date.now(), socketId)) return null
    this.tokens.delete(token)
    if (room.isClosed || room.playerCount === 0) {
      this.rooms.delete(room.code)
    }
    return room
  }

  /** Keeps the token during a match so the player can reconnect. */
  disconnect(token: string, playerId: string, socketId?: string): CarnivalRoom | null {
    const record = this.tokens.get(token)
    const room = record ? this.rooms.get(record.roomCode) : null
    if (!room) return null
    if (!room.disconnect(playerId, Date.now(), socketId)) return null
    if (room.phase !== 'playing') {
      this.tokens.delete(token)
      if (room.playerCount === 0) this.rooms.delete(room.code)
    }
    return room
  }

  roomByCode(code: string): CarnivalRoom | null {
    return this.rooms.get(code) ?? null
  }

  tickRooms(now = Date.now()): Array<{ room: CarnivalRoom; snapshot: ReturnType<CarnivalRoom['maybeSnapshot']> }> {
    const snapshots: Array<{ room: CarnivalRoom; snapshot: ReturnType<CarnivalRoom['maybeSnapshot']> }> = []
    for (const [code, room] of this.rooms) {
      room.tickStep(now)
      const snapshot = room.maybeSnapshot()
      if (snapshot) snapshots.push({ room, snapshot })
      if (room.isClosed || (room.phase === 'lobby' && room.playerCount === 0)) {
        this.rooms.delete(code)
        this.pruneTokens(code)
      }
    }
    return snapshots
  }

  private pruneTokens(code: string): void {
    for (const [token, record] of this.tokens) {
      if (record.roomCode === code) this.tokens.delete(token)
    }
  }

  private generateCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = ''
      for (let i = 0; i < 4; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
      if (!this.rooms.has(code)) return code
    }
    throw new Error('No se pudo generar un código de sala único.')
  }
}
