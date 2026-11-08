import type * as THREE from 'three'
import type { AABB } from '../shared/collision'
import type { MapConfig } from '../shared/maps/types'
import type { QualityLevel } from '../shared/settings'

export interface BuiltMap {
  root: THREE.Group
  colliders: AABB[]
  /** Roofs/canopies that become translucent when they block the killer camera. */
  occluders: THREE.Mesh[]
  pointLights: THREE.PointLight[]
  /** Animated scenery (ferris wheel, bulbs). Called once per rendered frame. */
  update: (dt: number, elapsed: number) => void
  /** Releases textures/materials owned by the map's material library. */
  dispose: () => void
}

export interface MapBuildOptions {
  quality: QualityLevel
}

export interface MapModule {
  config: MapConfig
  build: (options: MapBuildOptions) => BuiltMap
}
