import * as THREE from 'three'
import { FPS_CAMERA, SURVIVOR } from '../../shared/constants'
import { clamp, damp, lerp } from '../../shared/math'
import type { GameSettings } from '../../shared/settings'
import type { Input } from '../core/Input'

export interface SurvivorCameraContext {
  x: number
  z: number
  crouchAmount: number
  speed: number
  sprinting: boolean
}

/**
 * First-person survivor camera: mouse look, crouch eye height, sprint FOV and
 * subtle head bob. Rendering-only: movement is resolved by the shared sim.
 */
export class FirstPersonCameraRig {
  yaw = 0
  pitch = 0
  private bobPhase = 0
  private currentFov: number = FPS_CAMERA.defaultFov
  private eyeOffset = 0
  private initialized = false

  applyLook(input: Input, settings: GameSettings): void {
    const { dx, dy } = input.consumeLook()
    const sensitivity = FPS_CAMERA.mouseSensitivity * settings.sensitivity
    this.yaw -= dx * sensitivity
    const invert = settings.invertY ? -1 : 1
    this.pitch = clamp(
      this.pitch - dy * sensitivity * invert,
      FPS_CAMERA.minPitch,
      FPS_CAMERA.maxPitch,
    )
  }

  reset(yaw: number): void {
    this.yaw = yaw
    this.pitch = 0
    this.bobPhase = 0
    this.eyeOffset = 0
    this.initialized = false
  }

  update(
    camera: THREE.PerspectiveCamera,
    context: SurvivorCameraContext,
    settings: GameSettings,
    dt: number,
  ): void {
    const targetEye = lerp(SURVIVOR.eyeHeight, SURVIVOR.crouchEyeHeight, context.crouchAmount)
    this.eyeOffset = damp(this.eyeOffset, targetEye, 12, dt)

    const speedFactor = clamp(context.speed / SURVIVOR.sprintSpeed, 0, 1)
    if (!settings.reduceMotion && speedFactor > 0.05) {
      this.bobPhase += dt * (7 + context.speed * 1.1)
    }
    const bobAmount = settings.reduceMotion ? 0 : speedFactor * (context.sprinting ? 0.055 : 0.032)
    const bobY = Math.sin(this.bobPhase * 2) * bobAmount
    const bobX = Math.cos(this.bobPhase) * bobAmount * 0.55
    const lateral = Math.sin(this.bobPhase) * bobAmount * 0.2

    if (!this.initialized) {
      camera.position.set(context.x, this.eyeOffset, context.z)
      this.initialized = true
    } else {
      camera.position.x = damp(camera.position.x, context.x + lateral, 24, dt)
      camera.position.z = damp(camera.position.z, context.z, 24, dt)
      camera.position.y = this.eyeOffset + bobY
    }
    camera.rotation.set(this.pitch, this.yaw, bobX * 0.4, 'YXZ')

    let targetFov = settings.fov
    if (context.sprinting && context.speed > 4.2) targetFov += FPS_CAMERA.sprintFovBoost
    if (context.crouchAmount > 0.5) targetFov -= 3
    this.currentFov = damp(this.currentFov, targetFov, 8, dt)
    if (Math.abs(camera.fov - this.currentFov) > 0.01) {
      camera.fov = this.currentFov
      camera.updateProjectionMatrix()
    }
  }
}
