import * as THREE from 'three'
import type { PlayerRole } from '../shared/net/contracts'
import type { GameSettings, QualityLevel } from '../shared/settings'
import {
  KILLER_STUB,
  SURVIVORS,
  getSurvivor,
  type SurvivorCharacter,
} from '../shared/characters'
import { RAD2DEG } from '../shared/math'
import { DEFAULT_MAP_ID } from '../maps/registry'
import type { MatchStart, NetSnapshot, PlayerState } from '../shared/net/protocol'
import type { NetworkClient, NetworkNotice, NetworkStatus } from '../net/NetworkClient'
import {
  advanceObjectiveTimer,
  applyGateOpen,
  applyGeneratorRepair,
  createMatchResult,
  createObjectiveState,
  findObjectiveTarget,
  isAtOpenGate,
  type MatchResult,
  type ObjectiveState,
  type ObjectiveTarget,
} from '../shared/objectives'
import { dexterityMultiplier } from '../shared/stats'
import { AudioSystem } from './core/AudioSystem'
import { GameLoop, type LoopStats } from './core/GameLoop'
import { Input } from './core/Input'
import { Viewport } from './core/Viewport'
import { AerialCameraRig, aerialBearing } from './cameras/AerialCameraRig'
import { FirstPersonCameraRig } from './cameras/FirstPersonCameraRig'
import { KillerController } from './controllers/KillerController'
import { SurvivorController } from './controllers/SurvivorController'
import { DebugBot, createDebugBots } from './entities/DebugBot'
import { FirstPersonViewmodel } from './entities/FirstPersonViewmodel'
import { KillerVisual } from './entities/KillerVisual'
import { RemotePlayer } from './entities/RemotePlayer'
import { OcclusionController } from './world/OcclusionController'
import { NoisePingSystem } from './world/NoisePingSystem'
import { ObjectiveVisuals } from './world/ObjectiveVisuals'
import { buildWorld, type BuiltWorld } from './world/WorldBuilder'

export interface GameNetworkSession {
  client: NetworkClient
  selfId: string
  match: MatchStart
}

export interface GameHudSnapshot {
  mode: PlayerRole
  characterId: string
  characterName: string
  profession: string
  health: 'healthy' | 'injured' | 'incapacitated' | 'eliminated'
  mapName: string
  paused: boolean
  pointerLocked: boolean
  quality: QualityLevel
  x: number
  z: number
  speed: number
  sprinting: boolean
  crouching: boolean
  cameraMode: 'first-person' | 'aerial'
  cameraHeight: number
  cameraFov: number
  aerialElevation: number
  aerialBearing: string
  panDistance: number
  focusX: number
  focusZ: number
  bots: number
  noisePings: number
  fps: number
  frameMs: number
  tick: number
  drawCalls: number
  triangles: number
  colliderCount: number
  debugVisible: boolean
  collidersVisible: boolean
  elapsed: number
  killerName: string
  online: boolean
  roomCode: string
  networkStatus: NetworkStatus
  networkPlayers: number
  latencyMs: number
  serverTick: number
  objective: ObjectiveState
  interactionTarget: ObjectiveTarget | null
  interactionActive: boolean
  matchResult: MatchResult | null
}

export interface GameOptions {
  container: HTMLElement
  role: PlayerRole
  characterId: string
  settings: GameSettings
  mapId?: string
  network?: GameNetworkSession
  onHud: (snapshot: GameHudSnapshot) => void
  onPauseChange: (paused: boolean) => void
  onPointerLockChange: (locked: boolean) => void
  onReady?: () => void
  onError?: (message: string) => void
}

/**
 * Client-side game orchestrator. Owns the render loop, local prediction sim,
 * camera rigs, objectives and debug sandbox. The authoritative server mirrors
 * this step function and feeds snapshots into prediction and interpolation.
 */
export class Game {
  readonly viewport: Viewport
  readonly world: BuiltWorld
  readonly character: SurvivorCharacter
  private readonly options: GameOptions
  private readonly input: Input
  private readonly loop: GameLoop
  private readonly audio = new AudioSystem()
  private readonly survivor: SurvivorController
  private readonly killer: KillerController
  private readonly bots: DebugBot[]
  private readonly fpRig = new FirstPersonCameraRig()
  private readonly aerialRig = new AerialCameraRig()
  private readonly viewmodel: FirstPersonViewmodel
  private readonly killerVisual: KillerVisual
  private readonly occlusion: OcclusionController
  private readonly pings: NoisePingSystem
  private readonly objectiveVisuals: ObjectiveVisuals
  private readonly localObjectives: ObjectiveState | null
  private objectiveState: ObjectiveState
  private interactionTarget: ObjectiveTarget | null = null
  private matchResult: MatchResult | null = null
  private readonly networkSession?: GameNetworkSession
  private readonly remotePlayers = new Map<string, RemotePlayer>()
  private mode: PlayerRole
  private settings: GameSettings
  private paused = false
  private pointerLocked = false
  private hasEverLocked = false
  private debugVisible: boolean
  private collidersVisible = false
  private elapsed = 0
  private hudTimer = 0
  private stats: LoopStats = { fps: 0, frameMs: 0, tick: 0 }
  private destroyed = false
  private readonly lastRenderTime = { value: 0 }
  private netSequence = 0
  private netSendAccumulator = 0
  private networkStatus: NetworkStatus = 'connected'
  private networkPlayers = 0
  private latencyMs = 0
  private roomCode = ''
  private serverTick = 0

  constructor(options: GameOptions) {
    this.options = options
    this.settings = { ...options.settings }
    this.networkSession = options.network
    const networkSelf = options.network?.match.players.find(
      (player) => player.id === options.network?.selfId,
    )
    this.mode = networkSelf?.role ?? options.role
    this.debugVisible = options.settings.showDebugOnStart
    this.character = getSurvivor(
      networkSelf?.role === 'survivor' ? networkSelf.characterId : options.characterId,
    )
    this.roomCode = options.network?.match.roomCode ?? ''
    this.networkStatus = options.network?.client.status ?? 'connected'
    this.serverTick = options.network?.match.serverTick ?? 0

    this.viewport = new Viewport(options.container, options.settings.quality)
    try {
      this.world = buildWorld(options.mapId ?? DEFAULT_MAP_ID, options.settings.quality)
    } catch (error) {
      this.viewport.dispose()
      throw error
    }

    const { scene, camera } = this.viewport
    const theme = this.world.config.theme
    scene.fog = new THREE.FogExp2(theme.fogColor, theme.fogDensity)
    scene.background = new THREE.Color(theme.skyTop)
    scene.add(this.world.map.root)
    scene.add(camera)

    this.localObjectives = options.network ? null : createObjectiveState(this.world.config)
    this.objectiveState =
      options.network?.match.objectives ??
      this.localObjectives ??
      createObjectiveState(this.world.config)
    this.objectiveVisuals = new ObjectiveVisuals(this.world.config, scene)
    this.objectiveVisuals.setState(this.objectiveState)

    const survivorSpawn =
      networkSelf?.role === 'survivor' ? networkSelf : this.world.config.spawns.survivors[0]
    this.survivor = new SurvivorController({
      characterId: this.character.id,
      stats: this.character.stats,
      spawn: { x: survivorSpawn.x, z: survivorSpawn.z, yaw: survivorSpawn.yaw },
    })

    const killerSpawn =
      networkSelf?.role === 'killer' ? networkSelf : this.world.config.spawns.killer
    this.killerVisual = new KillerVisual(KILLER_STUB)
    this.killerVisual.group.visible = this.mode === 'killer'
    scene.add(this.killerVisual.group)
    this.killer = new KillerController(this.killerVisual, {
      x: killerSpawn.x,
      z: killerSpawn.z,
      yaw: killerSpawn.yaw,
    })

    if (this.networkSession) {
      for (const state of this.networkSession.match.players) {
        if (state.id === this.networkSession.selfId) continue
        this.remotePlayers.set(state.id, new RemotePlayer(state, scene))
      }
    }

    const botSpawns = this.world.config.spawns.survivors.slice(1, 5)
    const botCharacters = SURVIVORS.filter((character) => character.id !== this.character.id).slice(0, 4)
    this.bots = this.networkSession
      ? []
      : createDebugBots(botCharacters, botSpawns, this.world.collisionWorld, scene)

    this.viewmodel = new FirstPersonViewmodel(this.character)
    this.viewmodel.setVisible(this.mode === 'survivor')
    camera.add(this.viewmodel.group)

    this.occlusion = new OcclusionController(this.world.map.occluders)
    this.pings = new NoisePingSystem(scene)
    this.pings.setVisible(this.mode === 'killer')

    this.world.colliderDebug.visible = this.collidersVisible

    this.input = new Input(this.viewport.renderer.domElement, {
      onPointerLockChange: (locked) => this.handlePointerLockChange(locked),
      onEscape: () => {
        if (!this.paused) this.pause()
      },
      onWindowBlur: () => {
        if (!this.paused) this.pause()
      },
    })

    this.audio.setVolume(this.settings.masterVolume)
    this.audio.setRole(this.mode)

    if (this.networkSession) {
      const client = this.networkSession.client
      client.onSnapshot = this.handleNetworkSnapshot
      client.onStatus = this.handleNetworkStatus
      client.onNotice = this.handleNetworkNotice
      this.networkPlayers = client.room?.players.filter((player) => player.connected).length ?? 0
      this.latencyMs = client.latencyMs
      if (client.lastSnapshot) this.handleNetworkSnapshot(client.lastSnapshot)
      this.flushNetworkInput(true)
    }

    this.primeModeCamera()

    this.loop = new GameLoop(this.step, this.render, (stats) => {
      this.stats = stats
    })
    this.loop.start()
    this.emitHud()
    options.onReady?.()
  }

  get currentMode(): PlayerRole {
    return this.mode
  }

  get isPaused(): boolean {
    return this.paused
  }

  get characterName(): string {
    return this.character.name
  }

  requestPointerLock(): Promise<void> {
    return this.input.requestPointerLock()
  }

  async startAudio(): Promise<void> {
    await this.audio.start(this.settings.masterVolume)
  }

  pause(): void {
    if (this.paused || this.destroyed || this.matchResult) return
    this.paused = true
    this.input.clear()
    this.input.exitPointerLock()
    this.flushNetworkInput(true)
    this.audio.setPaused(true)
    this.options.onPauseChange(true)
    this.emitHud()
  }

  resume(): void {
    if (!this.paused || this.destroyed || this.matchResult) return
    this.paused = false
    this.audio.setPaused(false)
    this.options.onPauseChange(false)
    this.emitHud()
    this.requestPointerLock().catch(() => {
      this.options.onError?.('El navegador bloqueó la captura del ratón. Haz clic de nuevo para continuar.')
    })
  }

  switchMode(): void {
    if (this.destroyed) return
    if (this.networkSession) {
      this.options.onError?.('El rol está fijado por la sala en línea. Cambia de rol en el lobby.')
      return
    }
    this.mode = this.mode === 'survivor' ? 'killer' : 'survivor'
    this.audio.setRole(this.mode)
    this.killerVisual.group.visible = this.mode === 'killer'
    this.viewmodel.setVisible(this.mode === 'survivor')
    this.pings.setVisible(this.mode === 'killer')
    if (this.mode === 'survivor') this.occlusion.restore()
    this.primeModeCamera()
    this.emitHud()
  }

  toggleDebug(): void {
    this.debugVisible = !this.debugVisible
    this.emitHud()
  }

  toggleColliders(): void {
    this.collidersVisible = !this.collidersVisible
    this.world.colliderDebug.visible = this.collidersVisible
    this.emitHud()
  }

  updateSettings(settings: GameSettings): void {
    const previousQuality = this.settings.quality
    this.settings = { ...settings }
    this.audio.setVolume(settings.masterVolume)
    if (previousQuality !== settings.quality) {
      this.viewport.applyQuality(settings.quality)
      this.applyShadowQuality(settings.quality)
    }
    this.emitHud()
  }

  recenterAerialCamera(): void {
    this.aerialRig.recenter()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.networkSession) {
      const client = this.networkSession.client
      if (client.onSnapshot === this.handleNetworkSnapshot) client.onSnapshot = null
      if (client.onStatus === this.handleNetworkStatus) client.onStatus = null
      if (client.onNotice === this.handleNetworkNotice) client.onNotice = null
    }
    for (const remote of this.remotePlayers.values()) {
      remote.dispose(this.viewport.scene)
    }
    this.remotePlayers.clear()
    this.loop.stop()
    this.input.exitPointerLock()
    this.input.dispose()
    this.audio.dispose()
    disposeObjectTree(this.viewport.scene)
    this.world.map.dispose()
    this.viewport.dispose()
  }

  private step = (dt: number): void => {
    this.handleShortcuts()
    if (!this.paused && !this.destroyed && !this.matchResult) {
      this.elapsed += dt
      if (this.mode === 'survivor') {
        this.updateSurvivor(dt)
      } else {
        this.updateKiller(dt)
      }
      this.updateLocalObjectives(dt)
      this.updateInteractionTarget()
      this.updateRemotePlayers(dt)
      this.updateNetworkSend(dt)
      for (const bot of this.bots) {
        bot.update(dt, (x, z, intensity) => this.pings.emit(x, z, intensity))
      }
      this.pings.update(dt)
    }

    this.hudTimer += dt
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0
      this.emitHud()
    }
    this.input.endFrame()
  }

  private render = (): void => {
    if (this.destroyed) return
    const now = performance.now() / 1000
    const dt = this.lastRenderTime.value === 0 ? 1 / 60 : Math.min(now - this.lastRenderTime.value, 0.05)
    this.lastRenderTime.value = now
    this.world.map.update(dt, now)
    this.objectiveVisuals.update(dt)
    if (this.mode === 'killer' && !this.paused) {
      this.occlusion.update(this.viewport.camera.position, this.aerialRig.focus, true, dt)
    }
    this.viewport.render()
  }

  private updateSurvivor(dt: number): void {
    this.fpRig.applyLook(this.input, this.settings)
    this.survivor.update(dt, this.input, this.fpRig, this.world.collisionWorld, (speed, crouching) => {
      this.audio.footstep(speed, crouching)
    })
    this.fpRig.update(
      this.viewport.camera,
      {
        x: this.survivor.state.x,
        z: this.survivor.state.z,
        crouchAmount: this.survivor.crouchAmount,
        speed: this.survivor.speed,
        sprinting: this.survivor.sprinting,
      },
      this.settings,
      dt,
    )
    this.viewmodel.update(
      dt,
      this.survivor.speed,
      this.survivor.sprinting,
      this.survivor.crouchAmount,
      this.settings,
    )
  }

  private updateKiller(dt: number): void {
    this.aerialRig.applyLook(this.input, this.settings)
    this.killer.update(dt, this.input, this.aerialRig.yaw, this.world.collisionWorld, (speed) => {
      this.audio.footstep(speed, false)
    })
    this.aerialRig.update(this.viewport.camera, this.killer.state.x, this.killer.state.z, dt)
  }

  private updateLocalObjectives(dt: number): void {
    const objectives = this.localObjectives
    if (!objectives || this.matchResult) return

    const expired = advanceObjectiveTimer(objectives, dt)
    if (this.mode === 'survivor') {
      const target = findObjectiveTarget(objectives, this.survivor.state.x, this.survivor.state.z)
      if (this.input.interacting && !this.input.sprinting && target) {
        const rate = dexterityMultiplier(this.character.stats)
        if (target.kind === 'generator') {
          applyGeneratorRepair(objectives, target.id, dt, rate)
        } else {
          applyGateOpen(objectives, target.id, dt, rate)
        }
      }

      if (isAtOpenGate(objectives, this.survivor.state.x, this.survivor.state.z)) {
        this.finishLocalMatch('survivors', 'escaped')
      }
    }

    if (!this.matchResult && expired) {
      this.finishLocalMatch('killer', 'timeout')
    }

    this.objectiveState = objectives
    this.objectiveVisuals.setState(objectives)
  }

  private updateInteractionTarget(): void {
    if (this.matchResult || this.mode !== 'survivor') {
      this.interactionTarget = null
      return
    }
    this.interactionTarget = findObjectiveTarget(
      this.objectiveState,
      this.survivor.state.x,
      this.survivor.state.z,
    )
  }

  private finishLocalMatch(winner: MatchResult['winner'], reason: MatchResult['reason']): void {
    const objectives = this.localObjectives
    if (!objectives || this.matchResult) return
    this.matchResult = createMatchResult(
      objectives,
      winner,
      reason,
      winner === 'survivors' ? 1 : 0,
    )
    this.interactionTarget = null
    this.input.exitPointerLock()
    this.audio.setPaused(true)
    this.emitHud()
  }

  private applyNetworkResult(result: MatchResult): void {
    if (this.matchResult) return
    this.matchResult = result
    this.interactionTarget = null
    this.input.exitPointerLock()
    this.audio.setPaused(true)
    this.emitHud()
  }

  private handleShortcuts(): void {
    if (this.input.wasPressed('F3')) this.toggleDebug()
    if (this.input.wasPressed('F2')) this.toggleColliders()
    if (this.paused) return
    if (!this.networkSession && this.input.wasPressed('KeyV')) this.switchMode()
    if (this.mode === 'killer' && this.input.wasPressed('KeyR')) this.aerialRig.recenter()
  }

  private updateRemotePlayers(dt: number): void {
    for (const remote of this.remotePlayers.values()) {
      remote.update(dt, (x, z, intensity) => {
        if (this.mode === 'killer') this.pings.emit(x, z, intensity)
      })
    }
  }

  private updateNetworkSend(dt: number): void {
    if (!this.networkSession) return
    this.netSendAccumulator += dt
    if (this.netSendAccumulator < 1 / 30) return
    this.netSendAccumulator = 0
    this.flushNetworkInput(false)
  }

  private flushNetworkInput(idle: boolean): void {
    const session = this.networkSession
    if (!session || session.client.status === 'closed') return
    const axes = idle ? { forward: 0, right: 0 } : this.input.movementAxes
    this.netSequence++
    session.client.sendInput({
      seq: this.netSequence,
      forward: axes.forward,
      right: axes.right,
      sprint: !idle && this.mode === 'survivor' && this.input.sprinting,
      crouch: !idle && this.mode === 'survivor' && this.input.crouching,
      interact: !idle && this.mode === 'survivor' && this.input.interacting,
      yaw: this.mode === 'survivor' ? this.fpRig.yaw : this.aerialRig.yaw,
      pitch: this.mode === 'survivor' ? this.fpRig.pitch : 0,
    })
  }

  private handleNetworkSnapshot = (snapshot: NetSnapshot): void => {
    const session = this.networkSession
    if (!session) return
    this.serverTick = snapshot.tick
    this.networkPlayers = snapshot.players.length
    this.latencyMs = session.client.latencyMs
    if (snapshot.objectives) {
      this.objectiveState = snapshot.objectives
      this.objectiveVisuals.setState(snapshot.objectives)
    }
    this.updateInteractionTarget()
    if (snapshot.result) this.applyNetworkResult(snapshot.result)
    const seen = new Set<string>()
    for (const state of snapshot.players) {
      if (state.id === session.selfId) {
        this.correctLocalPlayer(state)
        continue
      }
      seen.add(state.id)
      const existing = this.remotePlayers.get(state.id)
      if (existing) existing.setTarget(state)
      else this.remotePlayers.set(state.id, new RemotePlayer(state, this.viewport.scene))
    }
    for (const [id, remote] of this.remotePlayers) {
      if (seen.has(id)) continue
      remote.dispose(this.viewport.scene)
      this.remotePlayers.delete(id)
    }
    this.emitHud()
  }

  private correctLocalPlayer(server: PlayerState): void {
    const state = this.mode === 'survivor' ? this.survivor.state : this.killer.state
    const error = Math.hypot(server.x - state.x, server.z - state.z)
    if (error <= 0.6) return
    state.x = server.x
    state.z = server.z
    state.velocityX = server.velocityX
    state.velocityZ = server.velocityZ
  }

  private handleNetworkStatus = (status: NetworkStatus): void => {
    this.networkStatus = status
    if (status === 'closed' && !this.destroyed) {
      this.options.onError?.('Se perdió la conexión con el servidor autoritativo.')
    }
    this.emitHud()
  }

  private handleNetworkNotice = (notice: NetworkNotice): void => {
    if (notice.kind === 'error') this.options.onError?.(notice.message)
    this.emitHud()
  }

  private primeModeCamera(): void {
    const camera = this.viewport.camera
    if (this.mode === 'survivor') {
      this.fpRig.reset(this.survivor.state.yaw)
      this.fpRig.update(
        camera,
        {
          x: this.survivor.state.x,
          z: this.survivor.state.z,
          crouchAmount: this.survivor.crouchAmount,
          speed: 0,
          sprinting: false,
        },
        this.settings,
        1,
      )
      this.viewmodel.update(0, 0, false, 0, this.settings)
    } else {
      this.aerialRig.reset(this.killer.state.yaw)
      this.aerialRig.update(camera, this.killer.state.x, this.killer.state.z, 1)
      this.occlusion.update(camera.position, this.aerialRig.focus, true, 1)
    }
  }

  private handlePointerLockChange(locked: boolean): void {
    this.pointerLocked = locked
    if (locked) this.hasEverLocked = true
    this.options.onPointerLockChange(locked)
    if (!locked && this.hasEverLocked && !this.paused && !this.destroyed && !this.matchResult) {
      this.pause()
    }
    this.emitHud()
  }

  private applyShadowQuality(quality: QualityLevel): void {
    this.viewport.scene.traverse((object) => {
      if (!(object instanceof THREE.DirectionalLight)) return
      object.castShadow = quality !== 'low'
      if (quality === 'low') return
      const size = quality === 'high' ? 2048 : 1024
      if (object.shadow.mapSize.x !== size) {
        object.shadow.mapSize.set(size, size)
        object.shadow.map?.dispose()
        object.shadow.map = null
      }
    })
  }

  private emitHud(): void {
    if (this.destroyed) return
    const survivor = this.survivor
    const killer = this.killer
    const isSurvivor = this.mode === 'survivor'
    const camera = this.viewport.camera
    const renderer = this.viewport.renderer
    this.options.onHud({
      mode: this.mode,
      characterId: this.character.id,
      characterName: this.character.name,
      profession: this.character.profession,
      health: survivor.health,
      mapName: this.world.config.name,
      paused: this.paused,
      pointerLocked: this.pointerLocked,
      quality: this.settings.quality,
      x: isSurvivor ? survivor.state.x : killer.state.x,
      z: isSurvivor ? survivor.state.z : killer.state.z,
      speed: isSurvivor ? survivor.speed : killer.speed,
      sprinting: isSurvivor ? survivor.sprinting : false,
      crouching: isSurvivor ? survivor.crouching : false,
      cameraMode: isSurvivor ? 'first-person' : 'aerial',
      cameraHeight: camera.position.y,
      cameraFov: camera.fov,
      aerialElevation: this.aerialRig.elevation * RAD2DEG,
      aerialBearing: aerialBearing(this.aerialRig.yaw),
      panDistance: this.aerialRig.panDistance,
      focusX: this.aerialRig.focusX,
      focusZ: this.aerialRig.focusZ,
      bots: this.bots.length,
      noisePings: this.pings.activeCount,
      fps: this.stats.fps,
      frameMs: this.stats.frameMs,
      tick: this.stats.tick,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      colliderCount: this.world.map.colliders.length,
      debugVisible: this.debugVisible,
      collidersVisible: this.collidersVisible,
      elapsed: this.elapsed,
      killerName: KILLER_STUB.name,
      online: Boolean(this.networkSession),
      roomCode: this.roomCode,
      networkStatus: this.networkStatus,
      networkPlayers: this.networkPlayers,
      latencyMs: this.latencyMs,
      serverTick: this.serverTick,
      objective: this.objectiveState,
      interactionTarget: this.interactionTarget,
      interactionActive:
        Boolean(this.interactionTarget) &&
        this.input.interacting &&
        !this.input.sprinting &&
        !this.matchResult,
      matchResult: this.matchResult,
    })
  }
}

function disposeObjectTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      if (object.geometry) geometries.add(object.geometry)
      const materialList = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materialList) {
        if (!material) continue
        materials.add(material)
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value)
        }
      }
    }
    if (object instanceof THREE.Sprite) {
      materials.add(object.material)
      if (object.material.map) textures.add(object.material.map)
    }
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
  for (const texture of textures) texture.dispose()
}
