import { describe, expect, it } from 'vitest'
import { AERIAL_CAMERA } from '../src/shared/constants'
import { clampAerialDistance } from '../src/game/cameras/AerialCameraRig'

describe('killer aerial zoom', () => {
  it('clamps zoom-in to the safe minimum distance', () => {
    expect(clampAerialDistance(1)).toBe(AERIAL_CAMERA.minDistance)
    expect(AERIAL_CAMERA.minDistance).toBeGreaterThanOrEqual(28)
  })

  it('clamps zoom-out to the tactical maximum', () => {
    expect(clampAerialDistance(999)).toBe(AERIAL_CAMERA.maxDistance)
  })

  it('keeps the default inside the allowed range', () => {
    expect(AERIAL_CAMERA.defaultDistance).toBeGreaterThan(AERIAL_CAMERA.minDistance)
    expect(AERIAL_CAMERA.defaultDistance).toBeLessThan(AERIAL_CAMERA.maxDistance)
  })

  it('limits the overall magnification to less than 2x', () => {
    expect(AERIAL_CAMERA.maxDistance / AERIAL_CAMERA.minDistance).toBeLessThan(2)
  })
})
