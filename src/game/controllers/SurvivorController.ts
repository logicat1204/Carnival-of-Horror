import { SURVIVOR } from '../../shared/constants'
import type { CollisionQuery } from '../../shared/collision'
import { damp } from '../../shared/math'
import type { CoreStats } from '../../shared/stats'
import { movementProfile, type MovementProfile } from '../../shared/stats'
import { stepMovement, type MoveState } from '../../shared/net/movement'
import type { Input } from '../core/Input'
import type { FirstPersonCameraRig } from '../cameras/FirstPersonCameraRig'

export type HealthState = 'healthy' | 'injured' | 'incapacitated' | 'eliminated'

export interface SurvivorControllerOptions {
  characterId: string
  stats: CoreStats
  spawn: { x: number; z: number; yaw: number }
}

/**
 * Survivor movement intent -> shared deterministic sim.
 * Damage/health are modelled but not used until combat lands in Phase 3/4.
 */
export class SurvivorController {
  readonly characterId: string
  readonly profile: MovementProfile
  health: HealthState = 'healthy'
  state: MoveState
  crouchAmount = 0
  speed = 0
  sprinting = false
  crouching = false
  private stepDistance = 0

  constructor(options: SurvivorControllerOptions) {
    this.characterId = options.characterId
    this.profile = movementProfile(options.stats)
    this.state = {
      x: options.spawn.x,
      z: options.spawn.z,
      yaw: options.spawn.yaw,
      velocityX: 0,
      velocityZ: 0,
    }
  }

  update(
    dt: number,
    input: Input,
    rig: FirstPersonCameraRig,
    world: CollisionQuery,
    onFootstep: (speed: number, crouching: boolean) => void,
  ): void {
    this.state.yaw = rig.yaw
    const axes = input.movementAxes
    const crouching = input.crouching
    const result = stepMovement(
      this.state,
      {
        forward: axes.forward,
        right: axes.right,
        sprint: input.sprinting,
        crouch: crouching,
      },
      dt,
      world,
      this.profile,
      SURVIVOR.radius,
      SURVIVOR.height,
    )
    this.state = result.state
    this.speed = result.speed
    this.sprinting = result.sprinting
    this.crouching = result.crouching
    this.crouchAmount = damp(this.crouchAmount, crouching ? 1 : 0, SURVIVOR.crouchTransitionSpeed, dt)

    if (result.moving) {
      const stride = crouching ? 2.2 : result.sprinting ? 2.6 : 1.9
      this.stepDistance += result.speed * dt
      if (this.stepDistance >= stride) {
        this.stepDistance = 0
        onFootstep(result.speed, crouching)
      }
    } else {
      this.stepDistance = 0.6
    }
  }

  get eyeHeight(): number {
    return SURVIVOR.eyeHeight + (SURVIVOR.crouchEyeHeight - SURVIVOR.eyeHeight) * this.crouchAmount
  }
}
