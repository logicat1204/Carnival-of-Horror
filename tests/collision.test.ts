import { describe, expect, it } from 'vitest'
import {
  makeAABB,
  overlapsY,
  pointInsideAABB,
  resolveCircleAABB,
  resolveCircleAgainstWorld,
  type AABB,
  type CollisionQuery,
} from '../src/shared/collision'

function world(boxes: AABB[], half = 50): CollisionQuery {
  return {
    boxes,
    bounds: { minX: -half, maxX: half, minZ: -half, maxZ: half },
  }
}

describe('makeAABB', () => {
  it('centers the box on x/z and grows height from baseY', () => {
    const box = makeAABB('crate', 4, -2, 2, 6, 3, 1, 'solid')
    expect(box).toEqual({
      id: 'crate',
      minX: 3,
      maxX: 5,
      minY: 1,
      maxY: 4,
      minZ: -5,
      maxZ: 1,
      tag: 'solid',
    })
  })
})

describe('overlapsY', () => {
  it('treats the bottom as inclusive and the top as exclusive', () => {
    const box = makeAABB('box', 0, 0, 1, 1, 2)
    expect(overlapsY(box, 0, 1.8)).toBe(true)
    expect(overlapsY(box, 1.9, 0.5)).toBe(true)
    expect(overlapsY(box, 2, 1)).toBe(false)
    expect(overlapsY(box, -1, 1)).toBe(false)
  })
})

describe('resolveCircleAABB', () => {
  const box = makeAABB('wall', 0, 0, 2, 2, 2)

  it('does not move a circle that is clear of the box', () => {
    expect(resolveCircleAABB(3, 3, 0.5, box)).toEqual({ x: 3, z: 3, hit: false })
  })

  it('pushes a circle out through the nearest face', () => {
    const result = resolveCircleAABB(1.2, 0, 0.5, box)
    expect(result.hit).toBe(true)
    expect(result.x).toBeCloseTo(1.5)
    expect(result.z).toBe(0)
  })

  it('pushes along both axes when overlapping a corner', () => {
    const result = resolveCircleAABB(1.15, 1.15, 0.5, box)
    expect(result.hit).toBe(true)
    // Distance from corner (1,1) must equal the radius.
    expect(Math.hypot(result.x - 1, result.z - 1)).toBeCloseTo(0.5)
    expect(result.x).toBeGreaterThan(1)
    expect(result.z).toBeGreaterThan(1)
  })

  it('escapes when the center is inside the box', () => {
    const result = resolveCircleAABB(0, 0, 0.5, box)
    expect(result.hit).toBe(true)
    expect(Math.abs(result.x)).toBeCloseTo(1.5)
    expect(result.z).toBe(0)
  })
})

describe('resolveCircleAgainstWorld', () => {
  it('resolves a wall and reports the contact', () => {
    const wall = makeAABB('wall', 0, -3, 4, 1, 2)
    const result = resolveCircleAgainstWorld(0, -2.8, 0.4, 0, 1.75, world([wall]))
    expect(result.collided).toBe(true)
    expect(result.contacts).toBeGreaterThan(0)
    expect(result.z).toBeCloseTo(-2.1)
  })

  it('clamps to the playable bounds and reports it', () => {
    const result = resolveCircleAgainstWorld(60, 0, 0.5, 0, 1.75, world([], 10))
    expect(result.collided).toBe(true)
    expect(result.x).toBeCloseTo(9.5)
  })

  it('does not collide with a box below the actor', () => {
    const low = makeAABB('low', 0, 0, 4, 4, 0.4)
    const result = resolveCircleAgainstWorld(0, 0, 0.4, 0.8, 1.75, world([low]))
    expect(result.collided).toBe(false)
    expect(result.x).toBe(0)
    expect(result.z).toBe(0)
  })

  it('resolves a concave corner using multiple passes', () => {
    const east = makeAABB('east', 1.5, 0, 1, 4, 2)
    const north = makeAABB('north', 0, -1.5, 4, 1, 2)
    const result = resolveCircleAgainstWorld(0.9, -0.9, 0.4, 0, 1.75, world([east, north]))
    expect(result.collided).toBe(true)
    expect(result.x).toBeLessThanOrEqual(1.0)
    expect(result.z).toBeGreaterThanOrEqual(-1.0)
  })
})

describe('pointInsideAABB', () => {
  it('honours the optional margin', () => {
    const box = makeAABB('box', 0, 0, 2, 2, 2)
    expect(pointInsideAABB(0, 0, box)).toBe(true)
    expect(pointInsideAABB(1.2, 0, box)).toBe(false)
    expect(pointInsideAABB(1.2, 0, box, 0.3)).toBe(true)
  })
})
