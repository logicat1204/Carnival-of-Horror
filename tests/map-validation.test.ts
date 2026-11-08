import { describe, expect, it } from 'vitest'
import carnivalConfig from '../src/maps/carnival/map.config.json'
import { getPlayableBounds, validateMapConfig } from '../src/shared/maps/validate'
import type { MapConfig } from '../src/shared/maps/types'

const clone = (): MapConfig => JSON.parse(JSON.stringify(carnivalConfig)) as MapConfig

const codes = (config: MapConfig) => validateMapConfig(config).issues.map((issue) => issue.code)

describe('carnival map config', () => {
  it('is valid and error-free', () => {
    const result = validateMapConfig(clone())
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('has five survivor spawns, five generators and two exits reserved for later phases', () => {
    const config = clone()
    expect(config.spawns.survivors).toHaveLength(5)
    expect(config.generatorSlots).toHaveLength(5)
    expect(config.exitGates).toHaveLength(2)
  })

  it('computes playable bounds from dimensions and margin', () => {
    expect(getPlayableBounds(clone())).toEqual({
      minX: -46.8,
      maxX: 46.8,
      minZ: -46.8,
      maxZ: 46.8,
    })
  })
})

describe('validateMapConfig rejects broken data', () => {
  it('rejects a wrong schema version', () => {
    const config = clone()
    config.schemaVersion = 2
    expect(codes(config)).toContain('map.schema_version')
  })

  it('rejects duplicate entity ids across collections', () => {
    const config = clone()
    config.obstacles[0].id = config.structures[0].id
    expect(codes(config)).toContain('map.duplicate_id')
  })

  it('rejects spawn points outside the playable area', () => {
    const config = clone()
    config.spawns.survivors[0].x = 500
    expect(codes(config)).toContain('map.point_out_of_bounds')
  })

  it('rejects spawn points inside solid obstacles', () => {
    const config = clone()
    const obstacle = config.obstacles[0]
    config.spawns.survivors[0].x = obstacle.x
    config.spawns.survivors[0].z = obstacle.z
    expect(codes(config)).toContain('map.spawn_inside_obstacle')
  })

  it('rejects non-right-angle structures and obstacles', () => {
    const rotatedStructure = clone()
    rotatedStructure.structures[0].rotation = 45
    expect(codes(rotatedStructure)).toContain('map.structure_rotation')

    const rotatedObstacle = clone()
    rotatedObstacle.obstacles[0].rotation = 30
    expect(codes(rotatedObstacle)).toContain('map.obstacle_rotation')
  })

  it('rejects too few survivor spawns', () => {
    const config = clone()
    config.spawns.survivors = config.spawns.survivors.slice(0, 2)
    expect(codes(config)).toContain('map.survivor_spawns')
  })

  it('rejects non-numeric spawn yaw', () => {
    const config = clone()
    config.spawns.survivors[0].yaw = Number.NaN
    expect(codes(config)).toContain('map.spawn_yaw')
  })

  it('rejects a diagonal fence because AABB colliders need an axis', () => {
    const config = clone()
    config.fences[0].x2 = config.fences[0].x1 + 2
    config.fences[0].z2 = config.fences[0].z1 + 2
    expect(codes(config)).toContain('map.fence_axis')
  })

  it('rejects entities whose footprint leaves the physical map', () => {
    const config = clone()
    config.structures[0].x = 47
    expect(codes(config)).toContain('map.entity_out_of_bounds')
  })

  it('rejects a missing killer spawn', () => {
    const config = clone()
    // @ts-expect-error deliberately invalid runtime data
    delete config.spawns.killer
    expect(codes(config)).toContain('map.killer_spawn')
  })
})
