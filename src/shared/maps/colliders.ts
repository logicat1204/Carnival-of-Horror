import { makeAABB, type AABB } from '../collision'
import type {
  FenceConfig,
  MapConfig,
  ObstacleConfig,
  StructureConfig,
} from './types'

/**
 * Pure collider derivation for the carnival map. The client scene and the
 * authoritative server both call these functions, so movement resolves against
 * exactly the same geometry. Keep this module free of Three.js/DOM imports.
 */
export function buildCarnivalColliders(config: MapConfig): AABB[] {
  const colliders: AABB[] = []

  for (const structure of config.structures) {
    switch (structure.kind) {
      case 'tent':
        colliders.push(...buildTentColliders(structure, false))
        break
      case 'grand_tent':
        colliders.push(...buildTentColliders(structure, true))
        break
      case 'stall':
        colliders.push(...buildStallColliders(structure))
        break
      case 'carousel':
        colliders.push(...buildCarouselColliders(structure))
        break
      case 'ferris_wheel':
        colliders.push(...buildFerrisWheelColliders(structure))
        break
      case 'ticket_booth':
        colliders.push(...buildTicketBoothColliders(structure))
        break
    }
  }

  for (const obstacle of config.obstacles) {
    colliders.push(...buildObstacleColliders(obstacle))
  }
  for (const fence of config.fences) {
    colliders.push(...buildFenceColliders(fence))
  }
  for (const generator of config.generatorSlots) {
    colliders.push(
      makeAABB(
        `generator-collider-${generator.id}`,
        generator.x,
        generator.z,
        1.9,
        1.6,
        1.45,
        0,
        'prop',
      ),
    )
  }

  return colliders
}

export function buildTentColliders(config: StructureConfig, grand: boolean): AABB[] {
  const colliders: AABB[] = []
  const wallHeight = config.height * 0.62
  const wallThickness = 0.28
  const doorWidth = grand ? 4.4 : 2.7
  const w = config.width
  const d = config.depth
  const frontPanelWidth = (w - doorWidth) / 2

  addLocalBox(colliders, `${config.id}-back`, config, 0, -d / 2, w, wallThickness, wallHeight, 'wall')
  addLocalBox(colliders, `${config.id}-left`, config, -w / 2, 0, wallThickness, d, wallHeight, 'wall')
  addLocalBox(colliders, `${config.id}-right`, config, w / 2, 0, wallThickness, d, wallHeight, 'wall')
  addLocalBox(
    colliders,
    `${config.id}-front-left`,
    config,
    -(doorWidth / 2 + frontPanelWidth / 2),
    d / 2,
    frontPanelWidth,
    wallThickness,
    wallHeight,
    'wall',
  )
  addLocalBox(
    colliders,
    `${config.id}-front-right`,
    config,
    doorWidth / 2 + frontPanelWidth / 2,
    d / 2,
    frontPanelWidth,
    wallThickness,
    wallHeight,
    'wall',
  )
  return colliders
}

export function buildStallColliders(config: StructureConfig): AABB[] {
  const colliders: AABB[] = []
  const w = config.width
  const d = config.depth
  addLocalBox(colliders, `${config.id}-counter`, config, 0, d / 2 - 0.42, w, 0.9, 1.1, 'prop')
  addLocalBox(colliders, `${config.id}-back`, config, 0, -d / 2 + 0.16, w, 0.3, 2.45, 'wall')
  addLocalBox(colliders, `${config.id}-left`, config, -w / 2 + 0.12, 0, 0.24, d, 2.45, 'wall')
  addLocalBox(colliders, `${config.id}-right`, config, w / 2 - 0.12, 0, 0.24, d, 2.45, 'wall')
  return colliders
}

export function buildCarouselColliders(config: StructureConfig): AABB[] {
  const colliders: AABB[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    colliders.push(
      makeAABB(
        `${config.id}-ring-${i}`,
        config.x + Math.cos(angle) * 4.4,
        config.z + Math.sin(angle) * 4.4,
        3.4,
        3.4,
        0.8,
        0,
        'platform',
      ),
    )
  }
  colliders.push(makeAABB(`${config.id}-core`, config.x, config.z, 6.2, 6.2, 0.8, 0, 'platform'))
  return colliders
}

export function buildFerrisWheelColliders(config: StructureConfig): AABB[] {
  return [makeAABB(`${config.id}-base`, config.x, config.z, 12, 6, 0.6, 0, 'platform')]
}

export function buildTicketBoothColliders(config: StructureConfig): AABB[] {
  return [
    makeAABB(
      config.id,
      config.x,
      config.z,
      config.width + 0.2,
      config.depth + 0.2,
      2.7,
      0,
      'wall',
    ),
  ]
}

export function buildObstacleColliders(config: ObstacleConfig): AABB[] {
  const colliders: AABB[] = []
  addLocalBox(
    colliders,
    config.id,
    config,
    0,
    0,
    config.width,
    config.depth,
    config.height,
    config.kind === 'barrel' ? 'prop' : 'obstacle',
  )
  return colliders
}

export function buildFenceColliders(config: FenceConfig): AABB[] {
  const dx = config.x2 - config.x1
  const dz = config.z2 - config.z1
  const length = Math.hypot(dx, dz)
  if (length < 0.01) return []
  const horizontal = Math.abs(dx) >= Math.abs(dz)
  return [
    makeAABB(
      config.id,
      (config.x1 + config.x2) / 2,
      (config.z1 + config.z2) / 2,
      horizontal ? length : 0.3,
      horizontal ? 0.3 : length,
      config.height,
      0,
      'fence',
    ),
  ]
}

/** Authored box in a structure's local space, rotated by a multiple of 90°. */
function addLocalBox(
  colliders: AABB[],
  id: string,
  config: { x: number; z: number; rotation: number },
  localX: number,
  localZ: number,
  width: number,
  depth: number,
  height: number,
  tag?: string,
): void {
  const radians = (config.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const worldX = config.x + localX * cos + localZ * sin
  const worldZ = config.z - localX * sin + localZ * cos
  const quarterTurn = Math.abs(Math.round(config.rotation / 90) % 2) === 1
  colliders.push(
    makeAABB(
      id,
      worldX,
      worldZ,
      quarterTurn ? depth : width,
      quarterTurn ? width : depth,
      height,
      0,
      tag,
    ),
  )
}
