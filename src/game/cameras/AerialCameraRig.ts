import * as THREE from 'three'
import { AERIAL_CAMERA } from '../../shared/constants'
import { clamp, damp, normalize2 } from '../../shared/math'
import type { GameSettings } from '../../shared/settings'
import type { Input } from '../core/Input'

/**
 * Killer camera: elevated tactical orbit around a focus point that follows the
 * killer, with a bounded free-pan radius. It is powerful but not omniscient:
 * the camera distance is capped, panning is clamped and roofs fade selectively.
 */
export class AerialCameraRig {
  yaw = 0
  elevation: number = AERIAL_CAMERA.defaultElevation
  distance: number = AERIAL_CAMERA.defaultDistance
  private targetDistance: number = AERIAL_CAMERA.defaultDistance
  private panX = 0
  private panZ = 0
  private readonly currentFocus = new THREE.Vector3()
  private readonly targetFocus = new THREE.Vector3()
  private readonly desiredPosition = new THREE.Vector3()
  private initialized = false
  private currentFov: number = 58

  applyLook(input: Input, settings: GameSettings): void {
    const { dx, dy } = input.consumeLook()
    const sensitivity = 0.0021 * settings.sensitivity
    const invert = settings.invertY ? -1 : 1

    if (input.panning) {
      const forward = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }
      const right = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) }
      const scale = AERIAL_CAMERA.panSensitivity * settings.sensitivity * (this.distance / 30)
      this.panX += (forward.x * -dy + right.x * dx) * scale
      this.panZ += (forward.z * -dy + right.z * dx) * scale
      const length = Math.hypot(this.panX, this.panZ)
      if (length > AERIAL_CAMERA.panRadius) {
        this.panX = (this.panX / length) * AERIAL_CAMERA.panRadius
        this.panZ = (this.panZ / length) * AERIAL_CAMERA.panRadius
      }
    } else {
      this.yaw -= dx * sensitivity
      this.elevation = clamp(
        this.elevation - dy * sensitivity * invert,
        AERIAL_CAMERA.minElevation,
        AERIAL_CAMERA.maxElevation,
      )
    }

    const wheel = input.consumeWheel()
    if (wheel !== 0) {
      this.targetDistance = clampAerialDistance(
        this.targetDistance + Math.sign(wheel) * AERIAL_CAMERA.zoomStep,
      )
    }
  }

  reset(yaw: number): void {
    this.yaw = yaw
    this.elevation = AERIAL_CAMERA.defaultElevation
    this.targetDistance = AERIAL_CAMERA.defaultDistance
    this.distance = AERIAL_CAMERA.defaultDistance
    this.panX = 0
    this.panZ = 0
    this.initialized = false
  }

  recenter(): void {
    this.panX = 0
    this.panZ = 0
  }

  get panDistance(): number {
    return Math.hypot(this.panX, this.panZ)
  }

  get focus(): THREE.Vector3 {
    return this.currentFocus
  }

  get focusX(): number {
    return this.currentFocus.x
  }

  get focusZ(): number {
    return this.currentFocus.z
  }

  update(camera: THREE.PerspectiveCamera, killerX: number, killerZ: number, dt: number): void {
    this.distance = damp(this.distance, this.targetDistance, 7, dt)
    this.targetFocus.set(killerX + this.panX, 0.9, killerZ + this.panZ)

    if (!this.initialized) {
      this.currentFocus.copy(this.targetFocus)
    } else {
      this.currentFocus.x = damp(this.currentFocus.x, this.targetFocus.x, AERIAL_CAMERA.followLambda, dt)
      this.currentFocus.z = damp(this.currentFocus.z, this.targetFocus.z, AERIAL_CAMERA.followLambda, dt)
    }

    const cosElevation = Math.cos(this.elevation)
    this.desiredPosition.set(
      this.currentFocus.x + Math.sin(this.yaw) * cosElevation * this.distance,
      this.currentFocus.y + Math.sin(this.elevation) * this.distance,
      this.currentFocus.z + Math.cos(this.yaw) * cosElevation * this.distance,
    )

    if (!this.initialized) {
      camera.position.copy(this.desiredPosition)
      this.initialized = true
    } else {
      camera.position.x = damp(camera.position.x, this.desiredPosition.x, 9, dt)
      camera.position.y = damp(camera.position.y, this.desiredPosition.y, 9, dt)
      camera.position.z = damp(camera.position.z, this.desiredPosition.z, 9, dt)
    }
    camera.lookAt(this.currentFocus)

    this.currentFov = damp(this.currentFov, 58, 6, dt)
    if (Math.abs(camera.fov - this.currentFov) > 0.01) {
      camera.fov = this.currentFov
      camera.updateProjectionMatrix()
    }
  }

  /** Movement axes relative to the camera yaw (WASD goes "up" the screen). */
  movementBasis(): { forwardX: number; forwardZ: number; rightX: number; rightZ: number } {
    return {
      forwardX: -Math.sin(this.yaw),
      forwardZ: -Math.cos(this.yaw),
      rightX: Math.cos(this.yaw),
      rightZ: -Math.sin(this.yaw),
    }
  }
}

/**
 * Hard limit for the tactical zoom. Keeping the killer at least 28 m away
 * preserves the value of interiors and makes the camera powerful without
 * turning it into an omniscient scope.
 */
export function clampAerialDistance(distance: number): number {
  return clamp(distance, AERIAL_CAMERA.minDistance, AERIAL_CAMERA.maxDistance)
}

/** Convenience for HUD labels. */
export function aerialBearing(yaw: number): string {
  const direction = normalize2(-Math.sin(yaw), -Math.cos(yaw))
  if (Math.abs(direction.x) > Math.abs(direction.z)) return direction.x > 0 ? 'E' : 'O'
  return direction.z > 0 ? 'S' : 'N'
}
