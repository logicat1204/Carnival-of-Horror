import * as THREE from 'three'
import { KILLER_STUB, getSurvivor } from '../../shared/characters'
import { damp, dampAngle } from '../../shared/math'
import type { PlayerState } from '../../shared/net/protocol'
import { KillerVisual } from './KillerVisual'
import { SurvivorVisual } from './SurvivorVisual'

/**
 * Presentation for a remote network player. The authoritative server owns the
 * position; this class only smooths the 20 Hz snapshots so the 60 Hz render
 * loop does not visibly step.
 */
export class RemotePlayer {
  readonly id: string
  readonly role: PlayerState['role']
  private readonly visual: SurvivorVisual | KillerVisual
  private state: PlayerState
  private x: number
  private z: number
  private yaw: number
  private noiseTimer = 0

  constructor(state: PlayerState, scene: THREE.Scene) {
    this.id = state.id
    this.role = state.role
    this.state = state
    this.x = state.x
    this.z = state.z
    this.yaw = state.yaw
    this.visual =
      state.role === 'killer'
        ? new KillerVisual(KILLER_STUB)
        : new SurvivorVisual(getSurvivor(state.characterId))
    this.visual.group.position.set(state.x, 0, state.z)
    this.visual.group.rotation.y = state.yaw
    scene.add(this.visual.group)
  }

  setTarget(state: PlayerState): void {
    this.state = state
  }

  update(dt: number, onNoise: (x: number, z: number, intensity: number) => void): void {
    this.x = damp(this.x, this.state.x, 18, dt)
    this.z = damp(this.z, this.state.z, 18, dt)
    const movementYaw =
      this.role === 'killer' && this.state.speed > 0.2
        ? Math.atan2(-this.state.velocityX, -this.state.velocityZ)
        : this.state.yaw
    this.yaw = dampAngle(this.yaw, movementYaw, this.role === 'killer' ? 12 : 18, dt)
    this.visual.group.position.set(this.x, 0, this.z)
    this.visual.group.rotation.y = this.yaw
    if (this.role === 'killer') {
      this.visual.update(dt, this.state.speed, this.state.moving)
    } else {
      this.visual.update(dt, this.state.speed, this.state.sprinting, this.state.crouching)
    }

    if (this.role === 'survivor' && this.state.moving && this.state.sprinting) {
      this.noiseTimer -= dt
      if (this.noiseTimer <= 0) {
        this.noiseTimer = 0.95 + (this.id.charCodeAt(0) % 7) * 0.12
        onNoise(this.x, this.z, 0.85)
      }
    } else {
      this.noiseTimer = 0.2
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.visual.group)
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    this.visual.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      geometries.add(object.geometry)
      const list = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of list) materials.add(material)
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
  }
}
