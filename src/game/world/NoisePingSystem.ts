import * as THREE from 'three'
import { clamp } from '../../shared/math'

interface PingSlot {
  group: THREE.Group
  materials: THREE.MeshBasicMaterial[]
  age: number
  life: number
  active: boolean
  intensity: number
}

/**
 * Short-lived, approximate noise markers for the killer's tactical view.
 * These are deliberately not exact survivor tracking: positions are emitted
 * with an offset and fade after ~2.5 s.
 */
export class NoisePingSystem {
  readonly group = new THREE.Group()
  private readonly slots: PingSlot[] = []
  private cursor = 0
  private visible = true

  constructor(parent: THREE.Object3D) {
    this.group.name = 'NoisePings'
    parent.add(this.group)
    const geometry = new THREE.RingGeometry(0.5, 0.62, 32)
    for (let i = 0; i < 10; i++) {
      const pingGroup = new THREE.Group()
      pingGroup.visible = false
      const materials: THREE.MeshBasicMaterial[] = []
      for (let ringIndex = 0; ringIndex < 2; ringIndex++) {
        const material = new THREE.MeshBasicMaterial({
          color: ringIndex === 0 ? '#ffd08a' : '#ff7b5c',
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
        const ring = new THREE.Mesh(geometry, material)
        ring.rotation.x = -Math.PI / 2
        pingGroup.add(ring)
        materials.push(material)
      }
      this.group.add(pingGroup)
      this.slots.push({ group: pingGroup, materials, age: 0, life: 2.5, active: false, intensity: 1 })
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    this.group.visible = visible
  }

  emit(x: number, z: number, intensity = 1): void {
    const slot = this.slots[this.cursor]
    this.cursor = (this.cursor + 1) % this.slots.length
    slot.active = true
    slot.age = 0
    slot.life = 2.4 + intensity * 0.3
    slot.intensity = clamp(intensity, 0.35, 1.3)
    slot.group.position.set(x, 0.045, z)
    slot.group.visible = this.visible
  }

  update(dt: number): void {
    for (const slot of this.slots) {
      if (!slot.active) continue
      slot.age += dt
      const t = slot.age / slot.life
      if (t >= 1) {
        slot.active = false
        slot.group.visible = false
        slot.materials.forEach((material) => {
          material.opacity = 0
        })
        continue
      }
      const radiusScale = 0.8 + t * 5.2
      slot.group.scale.setScalar(radiusScale)
      const fade = Math.pow(1 - t, 1.4) * slot.intensity
      const second = Math.max(0, (t - 0.18) / 0.82)
      slot.materials[0].opacity = 0.75 * fade
      slot.materials[1].opacity = second > 0 ? 0.45 * Math.pow(1 - second, 1.5) * slot.intensity : 0
      const ringMeshes = slot.group.children
      ringMeshes[1]?.scale.setScalar(second > 0 ? 1 + second * 0.35 : 0.001)
    }
  }

  get activeCount(): number {
    return this.slots.filter((slot) => slot.active).length
  }
}
