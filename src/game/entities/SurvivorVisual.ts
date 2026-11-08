import * as THREE from 'three'
import type { SurvivorCharacter } from '../../shared/characters'
import { clamp, damp, lerp } from '../../shared/math'

/**
 * Placeholder procedural survivor avatar. All gameplay collision is handled by
 * the shared circle/AABB sim; this class is presentation only and can be
 * replaced by a glTF rig without touching controllers (see 8.2 skin pipeline).
 */
export class SurvivorVisual {
  readonly group = new THREE.Group()
  private readonly torso: THREE.Mesh
  private readonly head: THREE.Group
  private readonly legLeft: THREE.Group
  private readonly legRight: THREE.Group
  private readonly armLeft: THREE.Group
  private readonly armRight: THREE.Group
  private readonly rootBody: THREE.Group
  private phase = 0
  private crouch = 0

  constructor(character: SurvivorCharacter) {
    const { palette, build } = character
    const skin = new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.9 })
    const hair = new THREE.MeshStandardMaterial({ color: palette.hair, roughness: 0.95 })
    const jacket = new THREE.MeshStandardMaterial({ color: palette.primary, roughness: 0.86 })
    const pants = new THREE.MeshStandardMaterial({ color: palette.secondary, roughness: 0.9 })
    const accent = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.8 })
    const shoe = new THREE.MeshStandardMaterial({ color: '#181513', roughness: 0.95 })
    const metal = new THREE.MeshStandardMaterial({ color: '#7f7562', roughness: 0.5, metalness: 0.4 })

    const torsoWidth = 0.42 + build.shoulders * 0.2
    const rootBody = new THREE.Group()
    this.rootBody = rootBody
    this.group.add(rootBody)

    this.torso = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth, 0.62, 0.28), jacket)
    this.torso.position.y = 1.28
    this.torso.castShadow = true
    rootBody.add(this.torso)

    const collar = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth * 0.55, 0.12, 0.3), accent)
    collar.position.set(0, 1.6, 0)
    collar.castShadow = true
    rootBody.add(collar)

    this.head = new THREE.Group()
    this.head.position.y = 1.78
    rootBody.add(this.head)
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 8), skin)
    skull.scale.set(1, 1.12, 0.94)
    skull.castShadow = true
    this.head.add(skull)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.05), skin)
    nose.position.set(0, -0.01, -0.16)
    this.head.add(nose)
    this.addHair(hair, build.hairStyle)

    this.legLeft = this.makeLimb(0.16, 0.82, 0.2, pants, -0.14, 0.95, 0)
    this.legRight = this.makeLimb(0.16, 0.82, 0.2, pants, 0.14, 0.95, 0)
    const shoeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.1, 0.29), shoe)
    shoeLeft.position.set(0, -0.78, -0.05)
    shoeLeft.castShadow = true
    this.legLeft.add(shoeLeft)
    const shoeRight = shoeLeft.clone()
    this.legRight.add(shoeRight)

    this.armLeft = this.makeLimb(0.13, 0.62, 0.15, jacket, -(torsoWidth / 2 + 0.08), 1.52, 0)
    this.armRight = this.makeLimb(0.13, 0.62, 0.15, jacket, torsoWidth / 2 + 0.08, 1.52, 0)
    const handLeft = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), skin)
    handLeft.position.y = -0.36
    this.armLeft.add(handLeft)
    const handRight = handLeft.clone()
    this.armRight.add(handRight)

    this.addAccessories(character, metal, accent, skin, hair)

    this.group.scale.setScalar(build.height / 1.86)
    this.group.userData.characterId = character.id
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible
  }

  update(dt: number, speed: number, sprinting: boolean, crouching = false): void {
    this.crouch = damp(this.crouch, crouching ? 1 : 0, 10, dt)
    const speedFactor = clamp(speed / 5.6, 0, 1)
    if (speedFactor > 0.03) this.phase += dt * (5 + speed * 1.65)
    const amplitude = speedFactor * (sprinting ? 0.85 : 0.6)
    const swing = Math.sin(this.phase) * amplitude
    this.legLeft.rotation.x = swing
    this.legRight.rotation.x = -swing
    this.armLeft.rotation.x = -swing * 0.85 + 0.05
    this.armRight.rotation.x = swing * 0.85 - 0.05
    this.rootBody.position.y = lerp(0, -0.32, this.crouch) + Math.abs(Math.sin(this.phase * 2)) * speedFactor * 0.025
    this.rootBody.rotation.x = lerp(0, 0.24, this.crouch) + speedFactor * 0.04
    this.torso.rotation.z = Math.sin(this.phase) * speedFactor * 0.035
    this.head.rotation.y = Math.sin(this.phase * 0.5) * 0.04
  }

  private makeLimb(
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): THREE.Group {
    const pivot = new THREE.Group()
    pivot.position.set(x, y, z)
    this.rootBody.add(pivot)
    const limb = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
    limb.position.y = -height / 2
    limb.castShadow = true
    pivot.add(limb)
    return pivot
  }

  private addHair(hair: THREE.Material, style: SurvivorCharacter['build']['hairStyle']): void {
    switch (style) {
      case 'long': {
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.5, 0.16), hair)
        back.position.set(0, -0.14, 0.12)
        back.castShadow = true
        this.head.add(back)
        break
      }
      case 'curly': {
        for (let i = 0; i < 7; i++) {
          const curl = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), hair)
          const angle = (i / 7) * Math.PI * 2
          curl.position.set(Math.cos(angle) * 0.11, 0.12 + (i % 2) * 0.03, Math.sin(angle) * 0.1)
          this.head.add(curl)
        }
        break
      }
      case 'bun': {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 6), hair)
        bun.position.set(0, 0.1, 0.15)
        this.head.add(bun)
        break
      }
      case 'buzz':
      case 'short':
      default: {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.162, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), hair)
        cap.position.y = 0.02
        cap.scale.set(1.01, 0.72, 1.01)
        this.head.add(cap)
        break
      }
    }
  }

  private addAccessories(
    character: SurvivorCharacter,
    metal: THREE.Material,
    accent: THREE.Material,
    skin: THREE.Material,
    hair: THREE.Material,
  ): void {
    for (const accessory of character.build.accessories) {
      switch (accessory) {
        case 'glasses': {
          const dark = new THREE.MeshStandardMaterial({ color: '#26211c', roughness: 0.35, metalness: 0.5 })
          for (const x of [-0.07, 0.07]) {
            const lens = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.02), dark)
            lens.position.set(x, 0.02, -0.155)
            this.head.add(lens)
          }
          const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.015), metal)
          bridge.position.set(0, 0.02, -0.16)
          this.head.add(bridge)
          break
        }
        case 'cap': {
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.09, 10), accent)
          cap.position.y = 0.14
          this.head.add(cap)
          const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.13), accent)
          brim.position.set(0, 0.1, -0.15)
          this.head.add(brim)
          break
        }
        case 'bandana': {
          const band = new THREE.Mesh(new THREE.CylinderGeometry(0.163, 0.163, 0.055, 10), accent)
          band.position.y = 0.1
          this.head.add(band)
          break
        }
        case 'toolbelt': {
          const belt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.3), accent)
          belt.position.y = 1.0
          this.rootBody.add(belt)
          const tool = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.24, 0.05), metal)
          tool.position.set(-0.22, 0.94, 0.05)
          tool.rotation.z = 0.2
          this.rootBody.add(tool)
          break
        }
        case 'backpack': {
          const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.17), accent)
          pack.position.set(0, 1.3, 0.23)
          pack.castShadow = true
          this.rootBody.add(pack)
          break
        }
        case 'headphones': {
          const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 5, 12, Math.PI), metal)
          band.rotation.z = Math.PI
          band.position.y = 0.12
          this.head.add(band)
          for (const x of [-0.16, 0.16]) {
            const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.035, 8), hair)
            cup.rotation.z = Math.PI / 2
            cup.position.set(x, 0.02, 0)
            this.head.add(cup)
          }
          break
        }
        default:
          void skin
      }
    }
  }
}
