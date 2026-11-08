import { SURVIVORS } from '../characters'
import type { HealthState } from '../constants'
import type { InteractionKind, MatchResult, ObjectiveState } from '../objectives'
import type { PlayerRole } from './contracts'

/** Wire protocol for the Phase 3 authoritative objective slice. */
export const NET_PROTOCOL_VERSION = 3
export const ROOM_CODE_LENGTH = 4
export const MAX_SURVIVORS = 4
export const MIN_RECONNECT_GRACE_MS = 25_000
export const SNAPSHOT_RATE = 20
export const INPUT_SEND_RATE = 30

export type RoomPhase = 'lobby' | 'playing' | 'ended'

export interface LobbyProfile {
  name: string
  role: PlayerRole
  characterId: string
}

export interface RoomPlayer {
  id: string
  name: string
  role: PlayerRole
  characterId: string
  ready: boolean
  connected: boolean
  host: boolean
}

export interface RoomView {
  code: string
  phase: RoomPhase
  hostId: string
  maxSurvivors: number
  /** Player id of the recipient; filled by the server for each connection. */
  you: string
  players: RoomPlayer[]
}

export interface PlayerState {
  id: string
  role: PlayerRole
  characterId: string
  x: number
  z: number
  yaw: number
  velocityX: number
  velocityZ: number
  speed: number
  moving: boolean
  sprinting: boolean
  crouching: boolean
  health: HealthState
  lastSeq: number
  action: InteractionKind | null
  escaped: boolean
}

export interface MatchStart {
  roomCode: string
  serverTick: number
  serverTimeMs: number
  players: PlayerState[]
  objectives: ObjectiveState
}

export interface NetSnapshot {
  tick: number
  serverTimeMs: number
  players: PlayerState[]
  objectives: ObjectiveState
  result: MatchResult | null
}

export interface NetInput {
  seq: number
  forward: number
  right: number
  sprint: boolean
  crouch: boolean
  interact: boolean
  yaw: number
  pitch: number
}

export type ClientMessage =
  | { type: 'hello'; protocol: number; token?: string }
  | { type: 'create_room'; profile: unknown }
  | { type: 'join_room'; code: string; profile: unknown }
  | { type: 'update_profile'; profile: unknown }
  | { type: 'ready'; ready: boolean }
  | { type: 'start_match' }
  | { type: 'input'; input: unknown }
  | { type: 'ping'; clientTimeMs: number }
  | { type: 'leave' }

export type ServerMessage =
  | { type: 'welcome'; protocol: number; clientId: string; token: string; resumed: boolean }
  | { type: 'room'; room: RoomView }
  | { type: 'left_room' }
  | { type: 'match_started'; match: MatchStart }
  | { type: 'snapshot'; snapshot: NetSnapshot }
  | { type: 'pong'; clientTimeMs: number; serverTimeMs: number }
  | { type: 'error'; code: string; message: string }
  | { type: 'session_expired'; message: string }

const ROLE_VALUES: readonly string[] = ['survivor', 'killer']
const SURVIVOR_IDS = new Set(SURVIVORS.map((character) => character.id))
const KILLER_ID = 'master_of_ceremonies'
const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}$/

export function sanitizeName(value: unknown): string {
  if (typeof value !== 'string') return 'Invitado'
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, 18)
  return clean.length >= 2 ? clean : 'Invitado'
}

export function sanitizeProfile(value: unknown): LobbyProfile | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.role !== 'string' || !ROLE_VALUES.includes(raw.role)) return null
  const role = raw.role as PlayerRole
  if (role === 'killer') {
    return { name: sanitizeName(raw.name), role, characterId: KILLER_ID }
  }
  if (typeof raw.characterId !== 'string' || !SURVIVOR_IDS.has(raw.characterId)) return null
  return { name: sanitizeName(raw.name), role, characterId: raw.characterId }
}

export function sanitizeRoomCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return ROOM_CODE_PATTERN.test(code) ? code : null
}

/** Returns a validated command or null when the payload is malformed. */
export function normalizeInput(value: unknown): NetInput | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const seq = raw.seq
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 0 || seq > 2_147_483_647) {
    return null
  }
  const forward = finiteNumber(raw.forward)
  const right = finiteNumber(raw.right)
  const yaw = finiteNumber(raw.yaw)
  const pitch = finiteNumber(raw.pitch)
  if (forward === null || right === null || yaw === null || pitch === null) return null
  return {
    seq,
    forward: clamp(forward, -1, 1),
    right: clamp(right, -1, 1),
    sprint: raw.sprint === true,
    crouch: raw.crouch === true,
    interact: raw.interact === true,
    yaw,
    pitch: clamp(pitch, -Math.PI / 2, Math.PI / 2),
  }
}

export function parseClientMessage(raw: string): ClientMessage | null {
  const parsed = parseObject(raw)
  if (!parsed || typeof parsed.type !== 'string') return null
  switch (parsed.type) {
    case 'hello':
      return {
        type: 'hello',
        protocol: typeof parsed.protocol === 'number' ? parsed.protocol : 0,
        token: typeof parsed.token === 'string' ? parsed.token : undefined,
      }
    case 'create_room':
      return { type: 'create_room', profile: parsed.profile }
    case 'join_room':
      return {
        type: 'join_room',
        code: typeof parsed.code === 'string' ? parsed.code : '',
        profile: parsed.profile,
      }
    case 'update_profile':
      return { type: 'update_profile', profile: parsed.profile }
    case 'ready':
      return { type: 'ready', ready: parsed.ready === true }
    case 'start_match':
      return { type: 'start_match' }
    case 'input':
      return { type: 'input', input: parsed.input }
    case 'ping':
      return {
        type: 'ping',
        clientTimeMs: typeof parsed.clientTimeMs === 'number' ? parsed.clientTimeMs : 0,
      }
    case 'leave':
      return { type: 'leave' }
    default:
      return null
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  const parsed = parseObject(raw)
  if (!parsed || typeof parsed.type !== 'string') return null
  switch (parsed.type) {
    case 'welcome':
      return {
        type: 'welcome',
        protocol: typeof parsed.protocol === 'number' ? parsed.protocol : 0,
        clientId: typeof parsed.clientId === 'string' ? parsed.clientId : '',
        token: typeof parsed.token === 'string' ? parsed.token : '',
        resumed: parsed.resumed === true,
      }
    case 'room':
      return parsed.room && typeof parsed.room === 'object'
        ? { type: 'room', room: parsed.room as RoomView }
        : null
    case 'left_room':
      return { type: 'left_room' }
    case 'match_started':
      return parsed.match && typeof parsed.match === 'object'
        ? { type: 'match_started', match: parsed.match as MatchStart }
        : null
    case 'snapshot':
      return parsed.snapshot && typeof parsed.snapshot === 'object'
        ? { type: 'snapshot', snapshot: parsed.snapshot as NetSnapshot }
        : null
    case 'pong':
      return {
        type: 'pong',
        clientTimeMs: typeof parsed.clientTimeMs === 'number' ? parsed.clientTimeMs : 0,
        serverTimeMs: typeof parsed.serverTimeMs === 'number' ? parsed.serverTimeMs : 0,
      }
    case 'error':
      return {
        type: 'error',
        code: typeof parsed.code === 'string' ? parsed.code : 'error',
        message: typeof parsed.message === 'string' ? parsed.message : 'Error de red.',
      }
    case 'session_expired':
      return {
        type: 'session_expired',
        message:
          typeof parsed.message === 'string'
            ? parsed.message
            : 'La sesión anterior ya no está disponible.',
      }
    default:
      return null
  }
}

function parseObject(raw: string): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.length > 16_384) return null
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
