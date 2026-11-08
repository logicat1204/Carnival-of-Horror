import { describe, expect, it } from 'vitest'
import { makeAABB, type CollisionQuery } from '../src/shared/collision'
import {
  IDLE_INPUT,
  stepMovement,
  type MoveInput,
  type MoveState,
} from '../src/shared/net/movement'

const PROFILE = {
  walkSpeed: 3.2,
  sprintSpeed: 5.7,
  crouchSpeed: 1.65,
  acceleration: 14,
}

const RADIUS = 0.35
const HEIGHT = 1.75
const DT = 1 / 60

const EMPTY_WORLD: CollisionQuery = {
  boxes: [],
  bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
}

function state(overrides: Partial<MoveState> = {}): MoveState {
  return { x: 0, z: 0, yaw: 0, velocityX: 0, velocityZ: 0, ...overrides }
}

function simulate(
  input: MoveInput,
  steps: number,
  world: CollisionQuery = EMPTY_WORLD,
  initial: MoveState = state(),
  profile = PROFILE,
) {
  let current = initial
  let last = stepMovement(current, IDLE_INPUT, DT, world, profile, RADIUS, HEIGHT)
  for (let i = 0; i < steps; i++) {
    last = stepMovement(current, input, DT, world, profile, RADIUS, HEIGHT)
    current = last.state
  }
  return { state: current, last }
}

describe('stepMovement', () => {
  it('moves toward -Z when pressing forward with yaw 0', () => {
    const { state: end } = simulate({ forward: 1, right: 0, sprint: false, crouch: false }, 30)
    expect(end.z).toBeLessThan(-0.5)
    expect(Math.abs(end.x)).toBeLessThan(1e-9)
    expect(end.yaw).toBe(0)
  })

  it('is deterministic for identical inputs and does not mutate the input state', () => {
    const initial = state({ x: 3, z: -4, yaw: 1.234 })
    const input: MoveInput = { forward: 1, right: -0.5, sprint: true, crouch: false }
    const a = simulate(input, 120, EMPTY_WORLD, initial)
    const b = simulate(input, 120, EMPTY_WORLD, initial)
    expect(a.state).toEqual(b.state)
    expect(initial).toEqual({ x: 3, z: -4, yaw: 1.234, velocityX: 0, velocityZ: 0 })
  })

  it('does not grant extra speed for diagonal input', () => {
    const cardinal = simulate({ forward: 1, right: 0, sprint: false, crouch: false }, 90)
    const diagonal = simulate({ forward: 1, right: 1, sprint: false, crouch: false }, 90)
    expect(diagonal.last.speed).toBeCloseTo(cardinal.last.speed, 4)
  })

  it('reaches walk, sprint and crouch target speeds', () => {
    const walk = simulate({ forward: 1, right: 0, sprint: false, crouch: false }, 120)
    const sprint = simulate({ forward: 1, right: 0, sprint: true, crouch: false }, 120)
    const crouch = simulate({ forward: 1, right: 0, sprint: false, crouch: true }, 120)
    const sprintCrouch = simulate({ forward: 1, right: 0, sprint: true, crouch: true }, 120)

    expect(walk.last.speed).toBeCloseTo(PROFILE.walkSpeed, 1)
    expect(sprint.last.speed).toBeCloseTo(PROFILE.sprintSpeed, 1)
    expect(crouch.last.speed).toBeCloseTo(PROFILE.crouchSpeed, 1)
    expect(sprintCrouch.last.speed).toBeCloseTo(PROFILE.crouchSpeed, 1)
    expect(sprint.last.sprinting).toBe(true)
    expect(crouch.last.crouching).toBe(true)
  })

  it('decelerates to rest and reports no movement when idle', () => {
    const moving = simulate({ forward: 1, right: 0, sprint: false, crouch: false }, 60)
    const { last } = simulate(IDLE_INPUT, 120, EMPTY_WORLD, moving.state)
    expect(last.speed).toBeCloseTo(0, 6)
    expect(last.moving).toBe(false)
  })

  it('stops at a wall instead of passing through it', () => {
    const wall = makeAABB('wall', 0, -3, 4, 1, 2)
    const world: CollisionQuery = { ...EMPTY_WORLD, boxes: [wall] }
    const { state: end, last } = simulate(
      { forward: 1, right: 0, sprint: true, crouch: false },
      180,
      world,
    )
    // Wall's south face is at z = -2.5; the circle must stay radius away.
    expect(end.z).toBeGreaterThanOrEqual(-2.5 + RADIUS - 1e-6)
    expect(last.collided).toBe(true)
  })

  it('stops at the world bounds', () => {
    const world: CollisionQuery = {
      boxes: [],
      bounds: { minX: -3, maxX: 3, minZ: -3, maxZ: 3 },
    }
    const { state: end } = simulate(
      { forward: 1, right: 0, sprint: true, crouch: false },
      300,
      world,
    )
    expect(end.z).toBeCloseTo(-3 + RADIUS, 6)
  })
})
