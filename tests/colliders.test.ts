import { describe, expect, it } from 'vitest'
import { SURVIVOR } from '../src/shared/constants'
import { resolveCircleAgainstWorld } from '../src/shared/collision'
import { buildCarnivalColliders } from '../src/shared/maps/colliders'
import { getPlayableBounds } from '../src/shared/maps/validate'
import type { MapConfig } from '../src/shared/maps/types'
import carnivalConfig from '../src/maps/carnival/map.config.json'

const CONFIG = carnivalConfig as unknown as MapConfig

describe('shared carnival colliders', () => {
  it('derives the full collider set deterministically', () => {
    const a = buildCarnivalColliders(CONFIG)
    const b = buildCarnivalColliders(CONFIG)
    expect(a.length).toBeGreaterThan(60)
    expect(a.map((box) => box.id)).toEqual(b.map((box) => box.id))
    expect(new Set(a.map((box) => box.id)).size).toBe(a.length)
  })

  it('keeps every spawn outside the collision set', () => {
    const world = {
      boxes: buildCarnivalColliders(CONFIG),
      bounds: getPlayableBounds(CONFIG),
    }
    for (const spawn of CONFIG.spawns.survivors) {
      const result = resolveCircleAgainstWorld(
        spawn.x,
        spawn.z,
        SURVIVOR.radius,
        0,
        SURVIVOR.height,
        world,
      )
      expect(result.collided).toBe(false)
    }
    const killerSpawn = CONFIG.spawns.killer
    const killerResult = resolveCircleAgainstWorld(
      killerSpawn.x,
      killerSpawn.z,
      0.5,
      0,
      2.2,
      world,
    )
    expect(killerResult.collided).toBe(false)
  })

  it('builds the carousel as eight ring boxes plus the core', () => {
    const colliders = buildCarnivalColliders(CONFIG)
    const carousel = CONFIG.structures.find((structure) => structure.kind === 'carousel')
    expect(carousel).toBeDefined()
    if (!carousel) return
    const ring = colliders.filter((box) => box.id.startsWith(`${carousel.id}-ring-`))
    expect(ring).toHaveLength(8)
    expect(colliders.some((box) => box.id === `${carousel.id}-core`)).toBe(true)
  })

  it('leaves a real doorway in every tent', () => {
    const colliders = buildCarnivalColliders(CONFIG)
    const tent = CONFIG.structures.find((structure) => structure.kind === 'tent')
    expect(tent).toBeDefined()
    if (!tent) return
    const front = colliders
      .filter((box) => box.id.startsWith(`${tent.id}-front-`))
      .map((box) => box.id)
    expect(front).toHaveLength(2)
  })
})
