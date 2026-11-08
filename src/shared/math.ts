/**
 * Small, dependency-free math helpers shared by client and (future) server.
 * Deliberately deterministic: no Math.random, no time-dependent functions.
 */

export const TAU = Math.PI * 2
export const DEG2RAD = Math.PI / 180
export const RAD2DEG = 180 / Math.PI

export interface Vec2 {
  x: number
  z: number
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/** Frame-rate independent exponential smoothing. */
export function damp(from: number, to: number, lambda: number, dt: number): number {
  return lerp(from, to, 1 - Math.exp(-lambda * dt))
}

export function length2(x: number, z: number): number {
  return Math.sqrt(x * x + z * z)
}

export function normalize2(x: number, z: number): Vec2 {
  const len = length2(x, z)
  if (len < 1e-8) return { x: 0, z: 0 }
  return { x: x / len, z: z / len }
}

/** Shortest signed angular difference in radians, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let delta = (to - from) % TAU
  if (delta > Math.PI) delta -= TAU
  if (delta <= -Math.PI) delta += TAU
  return delta
}

export function dampAngle(from: number, to: number, lambda: number, dt: number): number {
  return from + angleDelta(from, to) * (1 - Math.exp(-lambda * dt))
}

/** Deterministic PRNG (mulberry32). Used by debug bots and decoration scatter. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Converts a rotation in degrees to the nearest right angle (0, 90, 180, 270). */
export function snapRightAngle(degrees: number): number {
  const normalized = ((degrees % 360) + 360) % 360
  return Math.round(normalized / 90) * 90 % 360
}
