import {
  resolveCircleAgainstWorld,
  type CollisionQuery,
} from '../collision'
import { damp, normalize2 } from '../math'

/** Input is normalized to [-1, 1] by the controller before reaching the sim. */
export interface MoveInput {
  forward: number
  right: number
  sprint: boolean
  crouch: boolean
}

export interface MoveState {
  x: number
  z: number
  yaw: number
  velocityX: number
  velocityZ: number
}

export interface MovementProfileLike {
  walkSpeed: number
  sprintSpeed: number
  crouchSpeed: number
  acceleration: number
}

export interface StepMovementResult {
  state: MoveState
  speed: number
  targetSpeed: number
  moving: boolean
  sprinting: boolean
  crouching: boolean
  collided: boolean
}

export const IDLE_INPUT: MoveInput = {
  forward: 0,
  right: 0,
  sprint: false,
  crouch: false,
}

/**
 * Deterministic movement step. Shared with the future authoritative server.
 * yaw follows Three.js convention: yaw 0 looks toward -Z.
 */
export function stepMovement(
  state: MoveState,
  input: MoveInput,
  dt: number,
  world: CollisionQuery,
  profile: MovementProfileLike,
  radius: number,
  height: number,
): StepMovementResult {
  const forward = clampInput(input.forward)
  const right = clampInput(input.right)
  const crouching = input.crouch
  const sprinting = input.sprint && !crouching

  // Opposite keys cancel; diagonal input must not grant extra speed.
  let direction = { x: 0, z: 0 }
  if (forward !== 0 || right !== 0) {
    const sin = Math.sin(state.yaw)
    const cos = Math.cos(state.yaw)
    // forward = (-sin, -cos), right = (cos, -sin)
    direction = normalize2(
      -sin * forward + cos * right,
      -cos * forward - sin * right,
    )
  }

  const targetSpeed =
    forward === 0 && right === 0
      ? 0
      : crouching
        ? profile.crouchSpeed
        : sprinting
          ? profile.sprintSpeed
          : profile.walkSpeed

  const targetVX = direction.x * targetSpeed
  const targetVZ = direction.z * targetSpeed
  let vx = damp(state.velocityX, targetVX, profile.acceleration, dt)
  let vz = damp(state.velocityZ, targetVZ, profile.acceleration, dt)

  if (targetSpeed === 0 && Math.abs(vx) < 0.001 && Math.abs(vz) < 0.001) {
    vx = 0
    vz = 0
  }

  const oldX = state.x
  const oldZ = state.z
  const resolved = resolveCircleAgainstWorld(
    state.x + vx * dt,
    state.z + vz * dt,
    radius,
    0,
    height,
    world,
  )

  const actualVX = (resolved.x - oldX) / dt
  const actualVZ = (resolved.z - oldZ) / dt
  const speed = Math.hypot(actualVX, actualVZ)

  return {
    state: {
      x: resolved.x,
      z: resolved.z,
      yaw: state.yaw,
      velocityX: actualVX,
      velocityZ: actualVZ,
    },
    speed,
    targetSpeed,
    moving: speed > 0.05,
    sprinting: sprinting && speed > 0.05,
    crouching,
    collided: resolved.collided,
  }
}

function clampInput(value: number): number {
  return value < -1 ? -1 : value > 1 ? 1 : value
}
