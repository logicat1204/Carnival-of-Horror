import type { AABB, CollisionQuery, WorldBounds } from '../../shared/collision'
import { resolveCircleAgainstWorld } from '../../shared/collision'

export class CollisionWorld implements CollisionQuery {
  readonly boxes: readonly AABB[]
  readonly bounds: WorldBounds

  constructor(boxes: readonly AABB[], bounds: WorldBounds) {
    this.boxes = boxes
    this.bounds = bounds
  }

  resolve(x: number, z: number, radius: number, bottomY: number, height: number) {
    return resolveCircleAgainstWorld(x, z, radius, bottomY, height, this)
  }
}
