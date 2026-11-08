import { getSurvivor } from '../src/shared/characters'
import {
  FIXED_DT,
  KILLER,
  SURVIVOR,
  type HealthState,
} from '../src/shared/constants'
import type { CollisionQuery } from '../src/shared/collision'
import { buildCarnivalColliders } from '../src/shared/maps/colliders'
import { getPlayableBounds, validateMapConfig } from '../src/shared/maps/validate'
import type { MapConfig } from '../src/shared/maps/types'
import { dexterityMultiplier, movementProfile, type MovementProfile } from '../src/shared/stats'
import { IDLE_INPUT, stepMovement } from '../src/shared/net/movement'
import {
  advanceObjectiveTimer,
  applyGateOpen,
  applyGeneratorRepair,
  createMatchResult,
  createObjectiveState,
  findObjectiveTarget,
  isAtOpenGate,
  isInteractionSuppressed,
  type MatchResult,
  type ObjectiveState,
} from '../src/shared/objectives'
import type { PlayerRole } from '../src/shared/net/contracts'
import {
  MAX_SURVIVORS,
  MIN_RECONNECT_GRACE_MS,
  sanitizeProfile,
  type LobbyProfile,
  type MatchStart,
  type NetInput,
  type NetSnapshot,
  type PlayerState,
  type RoomPhase,
  type RoomPlayer,
  type RoomView,
} from '../src/shared/net/protocol'
import carnivalConfig from '../src/maps/carnival/map.config.json'

const KILLER_PROFILE: MovementProfile = {
  walkSpeed: KILLER.walkSpeed,
  sprintSpeed: KILLER.sprintSpeed,
  crouchSpeed: KILLER.walkSpeed,
  acceleration: KILLER.acceleration,
}

const INPUT_STALE_MS = 300
const SNAPSHOT_EVERY_TICKS = 3

export interface InternalPlayer extends RoomPlayer {
  token: string
  socketId: string | null
  joinedAt: number
  disconnectedAt: number | null
  lastInputAt: number
  input: NetInput
  state: PlayerState
}

export interface RoomError {
  code: string
  message: string
}

export class CarnivalRoom {
  readonly code: string
  readonly config: MapConfig
  readonly world: CollisionQuery
  phase: RoomPhase = 'lobby'
  hostId = ''
  tick = 0
  startedAt = 0
  private readonly players = new Map<string, InternalPlayer>()
  private readonly closed: { value: boolean } = { value: false }
  private lastSnapshot: NetSnapshot | null = null
  private match: MatchStart | null = null
  private objectives: ObjectiveState
  private result: MatchResult | null = null
  private finalSnapshotSent = false

  constructor(code: string, config: MapConfig = carnivalConfig as unknown as MapConfig, world?: CollisionQuery) {
    this.code = code
    this.config = config
    const validation = validateMapConfig(config)
    if (!validation.valid) {
      throw new Error(`No se puede crear una sala con un mapa inválido: ${config.id}`)
    }
    this.objectives = createObjectiveState(config)
    this.world = world ?? {
      boxes: buildCarnivalColliders(config),
      bounds: getPlayableBounds(config),
    }
  }

  get isClosed(): boolean {
    return this.closed.value
  }

  get playerCount(): number {
    return this.players.size
  }

  get connectedCount(): number {
    let count = 0
    for (const player of this.players.values()) if (player.connected) count++
    return count
  }

  get host(): InternalPlayer | null {
    return this.players.get(this.hostId) ?? null
  }

  getPlayer(id: string): InternalPlayer | null {
    return this.players.get(id) ?? null
  }

  addPlayer(
    id: string,
    token: string,
    socketId: string,
    profile: LobbyProfile,
    now: number,
  ): InternalPlayer | RoomError {
    if (this.phase !== 'lobby') {
      return { code: 'room_in_progress', message: 'La partida ya ha comenzado.' }
    }
    const roleError = this.validateRoleChange(null, profile.role)
    if (roleError) return roleError
    if (this.players.size >= MAX_SURVIVORS + 1) {
      return { code: 'room_full', message: 'La sala está completa (5 jugadores).' }
    }
    const clean = sanitizeProfile(profile)
    if (!clean) return { code: 'bad_profile', message: 'Perfil de jugador inválido.' }

    const player: InternalPlayer = {
      id,
      token,
      socketId,
      name: clean.name,
      role: clean.role,
      characterId: clean.characterId,
      ready: false,
      connected: true,
      host: this.players.size === 0,
      joinedAt: now,
      disconnectedAt: null,
      lastInputAt: 0,
      input: { ...IDLE_INPUT, seq: 0, interact: false, yaw: 0, pitch: 0 },
      state: this.idleState(id, clean.role, clean.characterId, 0, 0, 0),
    }
    this.players.set(id, player)
    if (player.host) this.hostId = id
    return player
  }

  reattach(id: string, socketId: string, now: number): InternalPlayer | RoomError {
    const player = this.players.get(id)
    if (!player) return { code: 'session_missing', message: 'La sesión ya no está en la sala.' }
    player.connected = true
    player.socketId = socketId
    player.disconnectedAt = null
    void now
    this.ensureHost()
    return player
  }

  disconnect(id: string, now: number, socketId?: string): boolean {
    const player = this.players.get(id)
    if (!player) return false
    // A late close event from a replaced socket must not kick the reconnected
    // player. The server compares socket ids before marking them offline.
    if (socketId && player.socketId && player.socketId !== socketId) return false
    player.connected = false
    player.socketId = null
    player.disconnectedAt = now
    player.ready = false
    if (this.phase !== 'playing') {
      this.players.delete(id)
    }
    this.ensureHost()
    if (this.players.size === 0) this.closed.value = true
    return true
  }

  updateProfile(id: string, profile: LobbyProfile): RoomError | null {
    if (this.phase !== 'lobby') {
      return { code: 'room_in_progress', message: 'No puedes cambiar de rol en partida.' }
    }
    const player = this.players.get(id)
    if (!player) return { code: 'not_in_room', message: 'No estás en esta sala.' }
    const clean = sanitizeProfile(profile)
    if (!clean) return { code: 'bad_profile', message: 'Perfil de jugador inválido.' }
    const roleError = this.validateRoleChange(id, clean.role)
    if (roleError) return roleError
    player.name = clean.name
    player.role = clean.role
    player.characterId = clean.characterId
    player.ready = false
    return null
  }

  setReady(id: string, ready: boolean): RoomError | null {
    const player = this.players.get(id)
    if (!player) return { code: 'not_in_room', message: 'No estás en esta sala.' }
    if (this.phase !== 'lobby') return { code: 'room_in_progress', message: 'La partida ya ha comenzado.' }
    player.ready = ready
    return null
  }

  start(id: string, now: number): MatchStart | RoomError {
    if (this.phase !== 'lobby') return { code: 'already_started', message: 'La partida ya ha comenzado.' }
    if (id !== this.hostId) return { code: 'not_host', message: 'Solo el anfitrión puede iniciar la partida.' }
    const players = [...this.players.values()].filter((player) => player.connected)
    const survivors = players.filter((player) => player.role === 'survivor')
    const killers = players.filter((player) => player.role === 'killer')
    if (killers.length !== 1) {
      return { code: 'need_killer', message: 'La sala necesita exactamente un asesino.' }
    }
    if (survivors.length < 1) {
      return { code: 'need_survivor', message: 'La sala necesita al menos un superviviente.' }
    }
    if (survivors.length > MAX_SURVIVORS) {
      return { code: 'too_many_survivors', message: `Máximo ${MAX_SURVIVORS} supervivientes.` }
    }
    if (players.some((player) => !player.ready)) {
      return { code: 'not_ready', message: 'Todos los jugadores deben estar listos.' }
    }

    this.phase = 'playing'
    this.startedAt = now
    this.tick = 0
    this.lastSnapshot = null
    this.result = null
    this.finalSnapshotSent = false
    this.objectives = createObjectiveState(this.config)
    survivors.sort((a, b) => a.joinedAt - b.joinedAt)
    survivors.forEach((player, index) => {
      const spawn = this.config.spawns.survivors[index % this.config.spawns.survivors.length]
      player.state = this.idleState(player.id, player.role, player.characterId, spawn.x, spawn.z, spawn.yaw)
      player.input = { ...IDLE_INPUT, seq: 0, interact: false, yaw: spawn.yaw, pitch: 0 }
      player.lastInputAt = 0
    })
    const killer = killers[0]
    const spawn = this.config.spawns.killer
    killer.state = this.idleState(killer.id, killer.role, killer.characterId, spawn.x, spawn.z, spawn.yaw)
    killer.input = { ...IDLE_INPUT, seq: 0, interact: false, yaw: spawn.yaw, pitch: 0 }
    killer.lastInputAt = 0

    this.match = {
      roomCode: this.code,
      serverTick: 0,
      serverTimeMs: Date.now(),
      players: players.map((player) => ({ ...player.state })),
      objectives: this.objectiveSnapshot(),
    }
    this.lastSnapshot = {
      tick: 0,
      serverTimeMs: Date.now(),
      players: this.snapshotPlayers(),
      objectives: this.objectiveSnapshot(),
      result: null,
    }
    return this.match
  }

  acceptInput(id: string, input: NetInput, now: number): void {
    if (this.phase !== 'playing') return
    const player = this.players.get(id)
    if (!player || !player.connected || player.state.escaped) return
    if (input.seq <= player.input.seq) return
    player.input = input
    player.lastInputAt = now
  }

  /** Advances the authoritative simulation one fixed step. */
  tickStep(now: number): void {
    if (this.phase !== 'playing') return
    this.tick++
    const staleBefore = now - INPUT_STALE_MS
    for (const player of this.players.values()) {
      if (!player.connected || player.state.escaped) continue
      const active = player.lastInputAt >= staleBefore
      const input = active
        ? player.input
        : { ...IDLE_INPUT, seq: player.input.seq, interact: false, yaw: player.state.yaw, pitch: 0 }
      const character = player.role === 'survivor' ? getSurvivor(player.characterId) : null
      const profile = character ? movementProfile(character.stats) : KILLER_PROFILE
      const radius = player.role === 'survivor' ? SURVIVOR.radius : KILLER.radius
      const height = player.role === 'survivor' ? SURVIVOR.height : KILLER.height
      const result = stepMovement(
        player.state,
        { ...input, forward: input.forward, right: input.right },
        FIXED_DT,
        this.world,
        profile,
        radius,
        height,
      )
      player.state = {
        ...player.state,
        x: result.state.x,
        z: result.state.z,
        yaw: input.yaw,
        velocityX: result.state.velocityX,
        velocityZ: result.state.velocityZ,
        speed: result.speed,
        moving: result.moving,
        sprinting: result.sprinting,
        crouching: result.crouching,
        lastSeq: input.seq,
      }
    }

    this.stepObjectives(staleBefore)
    const expired = advanceObjectiveTimer(this.objectives, FIXED_DT)
    if (!this.result && expired) {
      this.finishMatch('killer', 'timeout')
    }
    this.prune(now)
  }

  private stepObjectives(staleBefore: number): void {
    const killer = [...this.players.values()].find(
      (player) => player.connected && player.role === 'killer' && !player.state.escaped,
    )
    const survivors = [...this.players.values()].filter(
      (player) => player.connected && player.role === 'survivor' && !player.state.escaped,
    )

    for (const player of survivors) {
      const active = player.lastInputAt >= staleBefore
      const input = active
        ? player.input
        : { ...IDLE_INPUT, seq: player.input.seq, yaw: player.state.yaw, pitch: 0, interact: false }
      let action: PlayerState['action'] = null

      if (active && input.interact && !input.sprint) {
        const suppressed = killer
          ? isInteractionSuppressed(killer.state.x, killer.state.z, player.state.x, player.state.z)
          : false
        if (!suppressed) {
          const target = findObjectiveTarget(this.objectives, player.state.x, player.state.z)
          if (target) {
            action = target.kind
            const character = getSurvivor(player.characterId)
            const rate = dexterityMultiplier(character.stats)
            if (target.kind === 'generator') {
              applyGeneratorRepair(this.objectives, target.id, FIXED_DT, rate)
            } else {
              applyGateOpen(this.objectives, target.id, FIXED_DT, rate)
            }
          }
        }
      }

      player.state = { ...player.state, action }
      if (!this.result && isAtOpenGate(this.objectives, player.state.x, player.state.z)) {
        player.state = {
          ...player.state,
          escaped: true,
          action: null,
          velocityX: 0,
          velocityZ: 0,
          speed: 0,
          moving: false,
        }
      }
    }

    const escapedSurvivors = [...this.players.values()].filter(
      (player) => player.role === 'survivor' && player.state.escaped,
    ).length
    if (!this.result && escapedSurvivors > 0) {
      this.finishMatch('survivors', 'escaped', escapedSurvivors)
    }
  }

  private finishMatch(
    winner: MatchResult['winner'],
    reason: MatchResult['reason'],
    escapedSurvivors = 0,
  ): void {
    if (this.result) return
    this.result = createMatchResult(this.objectives, winner, reason, escapedSurvivors)
    this.phase = 'ended'
    for (const player of this.players.values()) {
      player.state = {
        ...player.state,
        action: null,
        moving: false,
        speed: 0,
        velocityX: 0,
        velocityZ: 0,
      }
    }
  }

  private objectiveSnapshot(): ObjectiveState {
    return {
      ...this.objectives,
      generators: this.objectives.generators.map((generator) => ({ ...generator })),
      gates: this.objectives.gates.map((gate) => ({ ...gate })),
    }
  }

  /** Called at the snapshot cadence; returns null when there is nothing new. */
  maybeSnapshot(): NetSnapshot | null {
    if (this.phase === 'ended' && this.result && !this.finalSnapshotSent) {
      this.finalSnapshotSent = true
      this.lastSnapshot = {
        tick: this.tick,
        serverTimeMs: Date.now(),
        players: this.snapshotPlayers(),
        objectives: this.objectiveSnapshot(),
        result: { ...this.result },
      }
      return this.lastSnapshot
    }
    if (this.phase !== 'playing' || this.tick % SNAPSHOT_EVERY_TICKS !== 0) return null
    this.lastSnapshot = {
      tick: this.tick,
      serverTimeMs: Date.now(),
      players: this.snapshotPlayers(),
      objectives: this.objectiveSnapshot(),
      result: null,
    }
    return this.lastSnapshot
  }

  getMatch(): MatchStart | null {
    return this.match
  }

  getObjectives(): ObjectiveState {
    return this.objectiveSnapshot()
  }

  getLatestSnapshot(): NetSnapshot | null {
    return this.lastSnapshot
  }

  roomView(you = ''): RoomView {
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      maxSurvivors: MAX_SURVIVORS,
      you,
      players: [...this.players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((player) => ({
          id: player.id,
          name: player.name,
          role: player.role,
          characterId: player.characterId,
          ready: player.ready,
          connected: player.connected,
          host: player.id === this.hostId,
        })),
    }
  }

  grantHostIfMissing(): void {
    this.ensureHost()
  }

  private prune(now: number): void {
    if (this.phase !== 'playing') return
    for (const [id, player] of this.players) {
      if (player.connected || player.disconnectedAt === null) continue
      if (now - player.disconnectedAt > MIN_RECONNECT_GRACE_MS) {
        this.players.delete(id)
      }
    }
    this.ensureHost()
    if (this.players.size === 0) this.closed.value = true
  }

  private ensureHost(): void {
    if (this.hostId && this.players.get(this.hostId)?.connected) return
    const next = [...this.players.values()].find((player) => player.connected)
    this.hostId = next?.id ?? ''
    for (const player of this.players.values()) player.host = player.id === this.hostId
  }

  private validateRoleChange(playerId: string | null, role: PlayerRole): RoomError | null {
    let survivors = 0
    let killers = 0
    for (const player of this.players.values()) {
      if (player.id === playerId) continue
      if (player.role === 'survivor') survivors++
      else killers++
    }
    if (role === 'killer' && killers >= 1) {
      return { code: 'killer_taken', message: 'Ya hay un asesino en la sala.' }
    }
    if (role === 'survivor' && survivors >= MAX_SURVIVORS) {
      return { code: 'survivors_full', message: `Ya hay ${MAX_SURVIVORS} supervivientes.` }
    }
    return null
  }

  private idleState(
    id: string,
    role: PlayerRole,
    characterId: string,
    x: number,
    z: number,
    yaw: number,
  ): PlayerState {
    return {
      id,
      role,
      characterId,
      x,
      z,
      yaw,
      velocityX: 0,
      velocityZ: 0,
      speed: 0,
      moving: false,
      sprinting: false,
      crouching: false,
      health: 'healthy' as HealthState,
      lastSeq: 0,
      action: null,
      escaped: false,
    }
  }

  private snapshotPlayers(): PlayerState[] {
    return [...this.players.values()]
      .filter((player) => player.connected)
      .map((player) => ({ ...player.state }))
  }
}
