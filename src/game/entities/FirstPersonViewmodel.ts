import * as THREE from 'three'
import type { SurvivorCharacter } from '../../shared/characters'
import { clamp, damp } from '../../shared/math'
import type { GameSettings } from '../../shared/settings'

/**
 * First-person hands/forearms. Real 3D geometry parented to the camera, so the
 * survivor is not just an invisible floating viewpoint.
 */
export class FirstPersonViewmodel {
  readonly group = new THREE.Group()
  private readonly armLeft: THREE.Group
  private readonly armRight: THREE.Group
  private phase = 0
  private swayX = 0
  private swayY = 0

  constructor(character: SurvivorCharacter) {
    const { palette } = character
    const sleeve = new THREE.MeshStandardMaterial({ color: palette.primary, roughness: 0.9 })
    const skin = new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.92 })
    const cuff = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.8 })

    this.armLeft = this.makeArm(sleeve, skin, cuff, -1)
    this.armRight = this.makeArm(sleeve, skin, cuff, 1)
    this.group.add(this.armLeft, this.armRight)
    this.group.name = 'FirstPersonViewmodel'
  }

  update(dt: number, speed: number, sprinting: boolean, crouch: number, settings: GameSettings): void {
    const speedFactor = clamp(speed / 5.6, 0, 1)
    if (!settings.reduceMotion) {
      this.phase += dt * (5 + speed * 2.2)
      this.swayX = damp(this.swayX, Math.sin(this.phase) * 0.015 * speedFactor, 8, dt)
      this.swayY = damp(this.swayY, Math.abs(Math.cos(this.phase)) * 0.012 * speedFactor, 8, dt)
    }
    const sprintDrop = sprinting ? -0.035 : 0
    const crouchDrop = crouch * -0.04
    this.group.position.set(this.swayX, -0.34 + this.swayY + sprintDrop + crouchDrop, -0.48)
    this.group.rotation.z = this.swayX * 2.2
    this.group.rotation.x = sprinting ? -0.08 : 0
    this.armLeft.rotation.x = -0.55 + this.swayY * 2
    this.armRight.rotation.x = -0.55 - this.swayY * 2
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible
  }

  private makeArm(
    sleeve: THREE.Material,
    skin: THREE.Material,
    cuff: THREE.Material,
    side: -1 | 1,
  ): THREE.Group {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.25, -0.02, 0)
    pivot.rotation.y = side * -0.16
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.1, 0.38), sleeve)
    forearm.position.set(0, 0, -0.14)
    forearm.rotation.x = 0.08
    pivot.add(forearm)
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.105, 0.055), cuff)
    band.position.set(0, 0, -0.31)
    pivot.add(band)
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.13), skin)
    hand.position.set(0, 0.005, -0.39)
    hand.rotation.x = 0.12
    pivot.add(hand)
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 0.075), skin)
    thumb.position.set(side * -0.055, 0.03, -0.39)
    thumb.rotation.z = side * 0.4
    pivot.add(thumb)
    return pivot
  }
}
