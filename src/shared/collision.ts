import { clamp } from './math'

/**
 * Axis-aligned collider in world space. Y is inclusive at the bottom and
 * exclusive at the top. Colliders are static for Phase 1; dynamic actors must
 * not be inserted here (they need server-side resolution in the authoritative room).
 */
export interface AABB {
  id: string
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
  tag?: string
}

export interface WorldBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface CollisionQuery {
  boxes: readonly AABB[]
  bounds: WorldBounds
}

export interface CircleResolveResult {
  x: number
  z: number
  collided: boolean
  contacts: number
}

export function makeAABB(
  id: string,
  centerX: number,
  centerZ: number,
  width: number,
  depth: number,
  height: number,
  baseY = 0,
  tag?: string,
): AABB {
  return {
    id,
    minX: centerX - width / 2,
    maxX: centerX + width / 2,
    minY: baseY,
    maxY: baseY + height,
    minZ: centerZ - depth / 2,
    maxZ: centerZ + depth / 2,
    tag,
  }
}

export function overlapsY(box: AABB, bottomY: number, height: number): boolean {
  return box.maxY > bottomY + 0.001 && box.minY < bottomY + height - 0.001
}

/** Push a circle out of one AABB. Returns the corrected center. */
export function resolveCircleAABB(
  x: number,
  z: number,
  radius: number,
  box: AABB,
): { x: number; z: number; hit: boolean } {
  const closestX = clamp(x, box.minX, box.maxX)
  const closestZ = clamp(z, box.minZ, box.maxZ)
  const dx = x - closestX
  const dz = z - closestZ
  const distSq = dx * dx + dz * dz

  if (distSq >= radius * radius) {
    return { x, z, hit: false }
  }

  if (distSq > 1e-10) {
    const dist = Math.sqrt(distSq)
    const push = radius - dist
    return { x: x + (dx / dist) * push, z: z + (dz / dist) * push, hit: true }
  }

  // Center is inside the box: exit through the nearest face.
  const toLeft = x - box.minX
  const toRight = box.maxX - x
  const toFront = z - box.minZ
  const toBack = box.maxZ - z
  const min = Math.min(toLeft, toRight, toFront, toBack)

  if (min === toLeft) return { x: box.minX - radius, z, hit: true }
  if (min === toRight) return { x: box.maxX + radius, z, hit: true }
  if (min === toFront) return { x, z: box.minZ - radius, hit: true }
  return { x, z: box.maxZ + radius, hit: true }
}

/**
 * Resolve a vertical capsule/cylinder against static boxes and world bounds.
 * Multiple iterations handle concave corners. Used by both survivor and killer.
 */
export function resolveCircleAgainstWorld(
  x: number,
  z: number,
  radius: number,
  bottomY: number,
  height: number,
  world: CollisionQuery,
  iterations = 4,
): CircleResolveResult {
  let px = x
  let pz = z
  let collided = false
  let contacts = 0

  for (let pass = 0; pass < iterations; pass++) {
    let passHit = false
    for (const box of world.boxes) {
      if (!overlapsY(box, bottomY, height)) continue
      const result = resolveCircleAABB(px, pz, radius, box)
      if (result.hit) {
        px = result.x
        pz = result.z
        passHit = true
        contacts++
      }
    }
    if (!passHit) break
    collided = true
  }

  const clampedX = clamp(px, world.bounds.minX + radius, world.bounds.maxX - radius)
  const clampedZ = clamp(pz, world.bounds.minZ + radius, world.bounds.maxZ - radius)
  if (clampedX !== px || clampedZ !== pz) {
    collided = true
    px = clampedX
    pz = clampedZ
  }

  return { x: px, z: pz, collided, contacts }
}

export function pointInsideAABB(x: number, z: number, box: AABB, margin = 0): boolean {
  return (
    x >= box.minX - margin &&
    x <= box.maxX + margin &&
    z >= box.minZ - margin &&
    z <= box.maxZ + margin
  )
}
