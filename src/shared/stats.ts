import { clamp } from './math'

/** Design stats are authored from 1 to 100. */
export interface CoreStats {
  speed: number
  physique: number
  dexterity: number
}

export interface MovementProfile {
  walkSpeed: number
  sprintSpeed: number
  crouchSpeed: number
  acceleration: number
}

const BASE = {
  walk: 3.2,
  sprint: 5.7,
  crouch: 1.65,
  acceleration: 14,
} as const

export function clampStat(value: number): number {
  return clamp(Math.round(value), 1, 100)
}

/**
 * Piecewise mapping keeps 50 neutral and reaches both documented endpoints.
 * A 95-speed character is ~4.5% faster than a 50-speed one, so route knowledge
 * still matters more than raw stats.
 */
function centeredMultiplier(value: number, low: number, high: number): number {
  const stat = clampStat(value)
  if (stat <= 50) return low + ((stat - 1) / 49) * (1 - low)
  return 1 + ((stat - 50) / 50) * (high - 1)
}

/** Speed scales x0.85..x1.05 around a neutral 50. */
export function speedMultiplier(stats: CoreStats): number {
  return centeredMultiplier(stats.speed, 0.85, 1.05)
}

/**
 * Physique is destined for stun power/resistance in Phase 4. The formula is
 * exposed and tested now so combat can reuse it later. Scales x0.7..x1.3.
 */
export function stunMultiplier(stats: CoreStats): number {
  return centeredMultiplier(stats.physique, 0.7, 1.3)
}

/** Dexterity drives repair/gate efficiency in Phase 3. Scales x0.75..x1.25. */
export function dexterityMultiplier(stats: CoreStats): number {
  return centeredMultiplier(stats.dexterity, 0.75, 1.25)
}

export function movementProfile(stats: CoreStats): MovementProfile {
  const multiplier = speedMultiplier(stats)
  return {
    walkSpeed: BASE.walk * multiplier,
    sprintSpeed: BASE.sprint * multiplier,
    crouchSpeed: BASE.crouch * multiplier,
    acceleration: BASE.acceleration,
  }
}
