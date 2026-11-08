import * as THREE from 'three'
import type { KillerStub } from '../../shared/characters'
import { clamp, damp } from '../../shared/math'

/** Tall, masked Phase 1 killer placeholders. Presentation only. */
export class KillerVisual {
  readonly group = new THREE.Group()
  private readonly body: THREE.Group
  private readonly leftLeg: THREE.Group
  private readonly rightLeg: THREE.Group
  private readonly coat: THREE.Mesh
  private phase = 0

  constructor(killer: KillerStub) {
    const { palette } = killer
    const coatMaterial = new THREE.MeshStandardMaterial({ color: palette.primary, roughness: 0.94 })
    const pants = new THREE.MeshStandardMaterial({ color: '#141114', roughness: 0.95 })
    const mask = new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.42 })
    const accent = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.55, metalness: 0.25 })
    const dark = new THREE.MeshStandardMaterial({ color: '#0d0b0e', roughness: 0.9 })

    this.body = new THREE.Group()
    this.group.add(this.body)

    this.coat = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.52, 1.25, 8), coatMaterial)
    this.coat.position.y = 1.05
    this.coat.castShadow = true
    this.body.add(this.coat)

    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.28, 0.4), coatMaterial)
    shoulders.position.y = 1.68
    shoulders.castShadow = true
    this.body.add(shoulders)

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mask)
    head.position.y = 1.9
    head.scale.set(0.94, 1.15, 0.9)
    head.castShadow = true
    this.body.add(head)

    const eyeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.02), dark)
    eyeLeft.position.set(-0.06, 1.93, -0.165)
    this.body.add(eyeLeft)
    const eyeRight = eyeLeft.clone()
    eyeRight.position.x = 0.06
    this.body.add(eyeRight)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.02), accent)
    mouth.position.set(0, 1.85, -0.17)
    this.body.add(mouth)

    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.035, 14), dark)
    hatBrim.position.y = 2.0
    this.body.add(hatBrim)
    const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.32, 12), dark)
    hatTop.position.y = 2.16
    hatTop.castShadow = true
    this.body.add(hatTop)
    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.212, 0.05, 12), accent)
    hatBand.position.y = 2.03
    this.body.add(hatBand)

    this.leftLeg = this.makeLeg(pants, -0.16)
    this.rightLeg = this.makeLeg(pants, 0.16)
    const armMaterial = coatMaterial
    for (const x of [-0.43, 0.43]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.82, 0.18), armMaterial)
      arm.position.set(x, 1.22, 0)
      arm.castShadow = true
      this.body.add(arm)
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), skinMaterial(palette.skin))
      hand.position.set(x, 0.79, -0.02)
      this.body.add(hand)
    }

    this.group.scale.setScalar(1.06)
  }

  update(dt: number, speed: number, moving: boolean): void {
    if (moving && speed > 0.1) {
      this.phase += dt * (3.6 + speed * 1.1)
    }
    const swing = clamp(speed / 4.4, 0, 1) * 0.5
    this.leftLeg.rotation.x = Math.sin(this.phase) * swing
    this.rightLeg.rotation.x = -Math.sin(this.phase) * swing
    this.body.position.y = damp(this.body.position.y, Math.abs(Math.sin(this.phase * 2)) * 0.03, 10, dt)
    this.coat.rotation.z = Math.sin(this.phase) * 0.025
  }

  private makeLeg(material: THREE.Material, x: number): THREE.Group {
    const pivot = new THREE.Group()
    pivot.position.set(x, 1.0, 0)
    this.body.add(pivot)
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.98, 0.22), material)
    leg.position.y = -0.49
    leg.castShadow = true
    pivot.add(leg)
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.32), material)
    shoe.position.set(0, -0.95, -0.05)
    pivot.add(shoe)
    return pivot
  }
}

function skinMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
}
