import { describe, expect, it } from 'vitest'
import {
  clampStat,
  dexterityMultiplier,
  movementProfile,
  speedMultiplier,
  stunMultiplier,
  type CoreStats,
} from '../src/shared/stats'

const stat = (speed: number, physique = 50, dexterity = 50): CoreStats => ({
  speed,
  physique,
  dexterity,
})

describe('clampStat', () => {
  it('rounds to an integer and clamps to 1..100', () => {
    expect(clampStat(50.4)).toBe(50)
    expect(clampStat(50.6)).toBe(51)
    expect(clampStat(-10)).toBe(1)
    expect(clampStat(500)).toBe(100)
  })
})

describe('derived multipliers', () => {
  it('is neutral at 50 for every stat', () => {
    expect(speedMultiplier(stat(50))).toBeCloseTo(1)
    expect(stunMultiplier(stat(50, 50))).toBeCloseTo(1)
    expect(dexterityMultiplier(stat(50, 50, 50))).toBeCloseTo(1)
  })

  it('hits the documented endpoints at 1 and 100', () => {
    expect(speedMultiplier(stat(1))).toBeCloseTo(0.85)
    expect(speedMultiplier(stat(100))).toBeCloseTo(1.05)
    expect(stunMultiplier(stat(50, 1))).toBeCloseTo(0.7)
    expect(stunMultiplier(stat(50, 100))).toBeCloseTo(1.3)
    expect(dexterityMultiplier(stat(50, 50, 1))).toBeCloseTo(0.75)
    expect(dexterityMultiplier(stat(50, 50, 100))).toBeCloseTo(1.25)
  })

  it('keeps the speed advantage narrow', () => {
    const slow = speedMultiplier(stat(55))
    const fast = speedMultiplier(stat(95))
    expect(fast / slow).toBeLessThan(1.05)
    expect(fast).toBeGreaterThan(slow)
  })

  it('is monotonic', () => {
    let previous = 0
    for (let value = 1; value <= 100; value++) {
      const current = speedMultiplier(stat(value))
      expect(current).toBeGreaterThanOrEqual(previous)
      previous = current
    }
  })

  it('clamps out-of-range authored stats before deriving', () => {
    expect(speedMultiplier(stat(1000))).toBeCloseTo(speedMultiplier(stat(100)))
    expect(speedMultiplier(stat(-5))).toBeCloseTo(speedMultiplier(stat(1)))
  })
})

describe('movementProfile', () => {
  it('scales the base speeds and keeps acceleration constant', () => {
    const profile = movementProfile(stat(100))
    expect(profile.walkSpeed).toBeCloseTo(3.2 * 1.05)
    expect(profile.sprintSpeed).toBeCloseTo(5.7 * 1.05)
    expect(profile.crouchSpeed).toBeCloseTo(1.65 * 1.05)
    expect(profile.acceleration).toBe(14)
  })
})
