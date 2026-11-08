import type { HealthState } from '../constants'

/**
 * Shared role and planning types. The live wire protocol is defined in
 * `protocol.ts` (version 3); these legacy snapshot shapes are kept only for
 * types that are still imported by the client, server and audio system.
 */

export type PlayerRole = 'survivor' | 'killer'
export type MatchPhase = 'lobby' | 'loading' | 'playing' | 'ended'
export type RoomStatus = 'waiting' | 'starting' | 'playing' | 'ended'

export interface LobbyMember {
  sessionId: string
  displayName: string
  role: PlayerRole | null
  characterId: string | null
  ready: boolean
  connected: boolean
}

export interface InputCommand {
  /** Monotonic sequence number, used to reject duplicate/reordered commands. */
  sequence: number
  /** Client tick at which the command was sampled. */
  clientTick: number
  forward: number
  right: number
  sprint: boolean
  crouch: boolean
  yaw: number
  pitch: number
  /** Optional one-shot intents; server validates cooldowns and range. */
  action?: 'interact' | 'attack' | 'ability' | 'drop'
}

export interface PlayerSnapshot {
  id: string
  role: PlayerRole
  characterId: string
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  health: HealthState
  crouching: boolean
  sprinting: boolean
  abilityCooldown: number
}

export interface MatchSnapshot {
  tick: number
  phase: MatchPhase
  serverTimeMs: number
  players: PlayerSnapshot[]
  generators: GeneratorSnapshot[]
  gates: ExitGateSnapshot[]
}

export interface GeneratorSnapshot {
  id: string
  progress: number
  required: number
  sabotaged: boolean
  repairedBy: string[]
}

export interface ExitGateSnapshot {
  id: string
  open: boolean
  progress: number
  powered: boolean
}

export type RoomEvent =
  | { type: 'player_joined'; member: LobbyMember }
  | { type: 'player_left'; sessionId: string; reason: 'left' | 'timeout' | 'kicked' }
  | { type: 'match_started'; snapshot: MatchSnapshot }
  | { type: 'match_ended'; winner: 'survivors' | 'killer'; escaped: string[]; eliminated: string[] }

export interface RoomConfig {
  roomName: string
  maxSurvivors: number
  requiredGenerators: number
  mapId: string
}
