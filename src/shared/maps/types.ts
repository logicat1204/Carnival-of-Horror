/** Data contract for a playable map. Scenes are built by a map module. */

export interface MapPoint {
  id: string
  x: number
  z: number
}

export interface SpawnPoint extends MapPoint {
  yaw: number
}

export interface MapDimensions {
  width: number
  depth: number
  /** Meters kept free at the outer edge for the perimeter fence. */
  playableMargin: number
}

export interface MapTheme {
  skyTop: string
  skyBottom: string
  fogColor: string
  fogDensity: number
  ambientColor: string
  ambientIntensity: number
  moonColor: string
  moonIntensity: number
  groundColor: string
}

export type StructureKind =
  | 'tent'
  | 'grand_tent'
  | 'stall'
  | 'carousel'
  | 'ferris_wheel'
  | 'ticket_booth'

export interface StructureConfig {
  id: string
  kind: StructureKind
  label: string
  x: number
  z: number
  /** Yaw in degrees. Must be a multiple of 90 for AABB colliders. */
  rotation: number
  width: number
  depth: number
  height: number
  /** Palette index used by the scene module. */
  palette: number
}

export type ObstacleKind = 'crate' | 'barrel' | 'barricade' | 'plank_pile'

export interface ObstacleConfig {
  id: string
  kind: ObstacleKind
  x: number
  z: number
  rotation: number
  width: number
  depth: number
  height: number
}

export type FenceStyle = 'wood' | 'metal'

export interface FenceConfig {
  id: string
  x1: number
  z1: number
  x2: number
  z2: number
  height: number
  style: FenceStyle
}

export type LightKind = 'lantern' | 'string' | 'neon'

export interface LightConfig {
  id: string
  kind: LightKind
  x: number
  z: number
  y: number
  color: string
  intensity: number
  distance: number
  flicker: boolean
  /** String lights only: second endpoint. */
  x2?: number
  z2?: number
  y2?: number
}

export interface ExitGateConfig extends MapPoint {
  label: string
  /** Reserved for Phase 3: powered by repaired generators. */
  requiredGenerators: number
}

export interface AudioTheme {
  ambience: string
  intensity: number
}

export interface MapConfig {
  schemaVersion: number
  id: string
  name: string
  description: string
  dimensions: MapDimensions
  theme: MapTheme
  spawns: {
    survivors: SpawnPoint[]
    killer: SpawnPoint
  }
  /** Reserved for Phase 3. Validated now so map data stays coherent. */
  generatorSlots: MapPoint[]
  /** Reserved for Phase 3. */
  exitGates: ExitGateConfig[]
  structures: StructureConfig[]
  obstacles: ObstacleConfig[]
  fences: FenceConfig[]
  lights: LightConfig[]
  /** Reserved for Phase 4 (lockers, hiding spots). */
  hideSpots: MapPoint[]
  /** Reserved for Phase 4 (item spawn points). */
  itemSpawns: MapPoint[]
  audio: AudioTheme
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  path: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

export interface ValidationRequirements {
  minSurvivorSpawns: number
  minGenerators: number
  minExitGates: number
  minStructures: number
}

export const DEFAULT_VALIDATION_REQUIREMENTS: ValidationRequirements = {
  minSurvivorSpawns: 4,
  minGenerators: 1,
  minExitGates: 1,
  minStructures: 1,
}
