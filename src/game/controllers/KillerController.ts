import { KILLER } from '../../shared/constants'
import type { CollisionQuery } from '../../shared/collision'
import { dampAngle } from '../../shared/math'
import { stepMovement, type MoveState } from '../../shared/net/movement'
import type { Input } from '../core/Input'
import type { KillerVisual } from '../entities/KillerVisual'

const KILLER_PROFILE = {
  walkSpeed: KILLER.walkSpeed,
  sprintSpeed: KILLER.sprintSpeed,
  crouchSpeed: KILLER.walkSpeed,
  acceleration: KILLER.acceleration,
}

/**
 * Ground-level killer body. The aerial camera is a separate rig; the body is
 * what the server will eventually validate for attacks and interactions.
 */
export class KillerController {
  state: MoveState
  readonly visual: KillerVisual
  speed = 0
  moving = false
  private stepDistance = 0
  private facingYaw: number

  constructor(visual: KillerVisual, spawn: { x: number; z: number; yaw: number }) {
    this.visual = visual
    this.state = { x: spawn.x, z: spawn.z, yaw: spawn.yaw, velocityX: 0, velocityZ: 0 }
    this.facingYaw = spawn.yaw
    this.visual.group.position.set(spawn.x, 0, spawn.z)
    this.visual.group.rotation.y = spawn.yaw
  }

  update(dt: number, input: Input, yaw: number, world: CollisionQuery, onFootstep: (speed: number) => void): void {
    const axes = input.movementAxes
    this.state.yaw = yaw
    const result = stepMovement(
      this.state,
      { forward: axes.forward, right: axes.right, sprint: false, crouch: false },
      dt,
      world,
      KILLER_PROFILE,
      KILLER.radius,
      KILLER.height,
    )
    this.state = result.state
    this.speed = result.speed
    this.moving = result.moving

    if (result.moving) {
      const targetYaw = Math.atan2(-result.state.velocityX, -result.state.velocityZ)
      this.facingYaw = dampAngle(this.facingYaw, targetYaw, 12, dt)
      this.stepDistance += result.speed * dt
      if (this.stepDistance > 2.3) {
        this.stepDistance = 0
        onFootstep(result.speed)
      }
    }

    this.visual.group.position.set(this.state.x, 0, this.state.z)
    this.visual.group.rotation.y = this.facingYaw
    this.visual.update(dt, this.speed, this.moving)
  }
}
