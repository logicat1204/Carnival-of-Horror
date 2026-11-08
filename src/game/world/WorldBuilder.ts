import * as THREE from 'three'
import type { MapConfig } from '../../shared/maps/types'
import { getPlayableBounds, validateMapConfig } from '../../shared/maps/validate'
import type { QualityLevel } from '../../shared/settings'
import type { BuiltMap } from '../../maps/types'
import { getMapModule } from '../../maps/registry'
import { CollisionWorld } from './CollisionWorld'

export interface BuiltWorld {
  map: BuiltMap
  config: MapConfig
  collisionWorld: CollisionWorld
  colliderDebug: THREE.LineSegments
}

/**
 * Validates the selected map, builds its scene and derives the collision world.
 * This is the only entry point the game loop needs for map data.
 */
export function buildWorld(mapId: string, quality: QualityLevel): BuiltWorld {
  const module = getMapModule(mapId)
  const validation = validateMapConfig(module.config)
  if (!validation.valid) {
    const errors = validation.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => `- [${issue.code}] ${issue.path}: ${issue.message}`)
      .join('\n')
    throw new Error(`El mapa "${module.config.id}" no es válido:\n${errors}`)
  }

  const map = module.build({ quality })
  const bounds = getPlayableBounds(module.config)
  const collisionWorld = new CollisionWorld(map.colliders, bounds)
  const colliderDebug = createColliderDebug(map.colliders)
  colliderDebug.visible = false
  map.root.add(colliderDebug)

  return { map, config: module.config, collisionWorld, colliderDebug }
}

/** One merged wireframe mesh for every gameplay collider (F2 debug view). */
export function createColliderDebug(boxes: readonly { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }[]): THREE.LineSegments {
  const positions: number[] = []
  for (const box of boxes) {
    const x0 = box.minX
    const x1 = box.maxX
    const y0 = box.minY
    const y1 = box.maxY
    const z0 = box.minZ
    const z1 = box.maxZ
    const edges: Array<[number, number, number, number, number, number]> = [
      [x0, y0, z0, x1, y0, z0],
      [x1, y0, z0, x1, y0, z1],
      [x1, y0, z1, x0, y0, z1],
      [x0, y0, z1, x0, y0, z0],
      [x0, y1, z0, x1, y1, z0],
      [x1, y1, z0, x1, y1, z1],
      [x1, y1, z1, x0, y1, z1],
      [x0, y1, z1, x0, y1, z0],
      [x0, y0, z0, x0, y1, z0],
      [x1, y0, z0, x1, y1, z0],
      [x1, y0, z1, x1, y1, z1],
      [x0, y0, z1, x0, y1, z1],
    ]
    for (const edge of edges) positions.push(...edge)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const material = new THREE.LineBasicMaterial({
    color: '#58e0c0',
    transparent: true,
    opacity: 0.75,
    depthTest: false,
    depthWrite: false,
  })
  const lines = new THREE.LineSegments(geometry, material)
  lines.name = 'ColliderDebug'
  lines.renderOrder = 20
  return lines
}
