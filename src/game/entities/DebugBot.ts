import * as THREE from 'three'
import type { SurvivorCharacter } from '../../shared/characters'
import { SURVIVOR } from '../../shared/constants'
import { resolveCircleAgainstWorld, type CollisionQuery } from '../../shared/collision'
import { seededRandom } from '../../shared/math'
import type { MovementProfile } from '../../shared/stats'
import { movementProfile } from '../../shared/stats'
import { IDLE_INPUT, stepMovement, type MoveState } from '../../shared/net/movement'
import { SurvivorVisual } from '../entities/SurvivorVisual'

export interface BotSpawn {
  x: number
  z: number
  yaw: number
}

/**
 * LAB-ONLY wandering survivor used to test the killer camera, occlusion and
 * noise pings. It is not a network player and never pretends to be one.
 */
export class DebugBot {
  readonly id: string
  readonly character: SurvivorCharacter
  readonly visual: SurvivorVisual
  private readonly profile: MovementProfile
  private readonly random: () => number
  private state: MoveState
  private target = { x: 0, z: 0 }
  private phaseTimer = 0
  private noiseTimer = 0
  private stuckTimer = 0
  private lastX: number
  private lastZ: number
  private currentSpeed = 0
  private currentSprinting = false

  constructor(
    id: string,
    character: SurvivorCharacter,
    spawn: BotSpawn,
    seed: number,
    private readonly world: CollisionQuery,
  ) {
    this.id = id
    this.character = character
    this.visual = new SurvivorVisual(character)
    this.profile = movementProfile(character.stats)
    this.random = seededRandom(seed)
    this.state = { x: spawn.x, z: spawn.z, yaw: spawn.yaw, velocityX: 0, velocityZ: 0 }
    this.lastX = spawn.x
    this.lastZ = spawn.z
    this.phaseTimer = 2 + this.random() * 4
    this.pickTarget()
    this.syncVisual()
  }

  get x(): number {
    return this.state.x
  }

  get z(): number {
    return this.state.z
  }

  get speed(): number {
    return this.currentSpeed
  }

  update(dt: number, onNoise: (x: number, z: number, intensity: number) => void): void {
    const dx = this.target.x - this.state.x
    const dz = this.target.z - this.state.z
    const distance = Math.hypot(dx, dz)
    if (distance < 1.4) this.pickTarget()

    this.phaseTimer -= dt
    if (this.phaseTimer <= 0) {
      this.currentSprinting = !this.currentSprinting
      this.phaseTimer = this.currentSprinting ? 1.8 + this.random() * 2.2 : 3.5 + this.random() * 4
      if (this.currentSprinting) this.noiseTimer = 0.6
    }

    const desiredYaw = Math.atan2(-dx, -dz)
    this.state.yaw = desiredYaw
    const result = stepMovement(
      this.state,
      {
        ...IDLE_INPUT,
        forward: 1,
        sprint: this.currentSprinting,
      },
      dt,
      this.world,
      {
        walkSpeed: this.profile.walkSpeed * 0.68,
        sprintSpeed: this.profile.sprintSpeed * 0.66,
        crouchSpeed: this.profile.crouchSpeed,
        acceleration: this.profile.acceleration * 0.8,
      },
      SURVIVOR.radius,
      SURVIVOR.height,
    )
    this.state = result.state
    this.currentSpeed = result.speed
    this.currentSprinting = result.sprinting

    const moved = Math.hypot(this.state.x - this.lastX, this.state.z - this.lastZ)
    if (moved < 0.01 && distance > 1.8) {
      this.stuckTimer += dt
      if (this.stuckTimer > 1.1) {
        this.pickTarget()
        this.stuckTimer = 0
      }
    } else {
      this.stuckTimer = 0
    }
    this.lastX = this.state.x
    this.lastZ = this.state.z

    if (this.currentSprinting) {
      this.noiseTimer -= dt
      if (this.noiseTimer <= 0) {
        this.noiseTimer = 2.2 + this.random() * 0.9
        onNoise(
          this.state.x + (this.random() - 0.5) * 2.2,
          this.state.z + (this.random() - 0.5) * 2.2,
          1,
        )
      }
    }

    this.syncVisual()
  }

  private pickTarget(): void {
    const { bounds } = this.world
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = bounds.minX + 3 + this.random() * Math.max(1, bounds.maxX - bounds.minX - 6)
      const z = bounds.minZ + 3 + this.random() * Math.max(1, bounds.maxZ - bounds.minZ - 6)
      const resolved = resolveCircleAgainstWorld(
        x,
        z,
        SURVIVOR.radius,
        0,
        SURVIVOR.height,
        this.world,
      )
      if (!resolved.collided && Math.hypot(x - this.state.x, z - this.state.z) > 6) {
        this.target = { x, z }
        return
      }
    }
    this.target = { x: 0, z: 26 }
  }

  private syncVisual(): void {
    this.visual.group.position.set(this.state.x, 0, this.state.z)
    this.visual.group.rotation.y = this.state.yaw
    this.visual.update(1 / 60, this.currentSpeed, this.currentSprinting, false)
  }
}

export function createDebugBots(
  characters: SurvivorCharacter[],
  spawns: BotSpawn[],
  world: CollisionQuery,
  parent: THREE.Object3D,
): DebugBot[] {
  return characters.slice(0, Math.min(characters.length, spawns.length)).map((character, index) => {
    const bot = new DebugBot(`bot-${index + 1}`, character, spawns[index], 1337 + index * 97, world)
    parent.add(bot.visual.group)
    return bot
  })
}
