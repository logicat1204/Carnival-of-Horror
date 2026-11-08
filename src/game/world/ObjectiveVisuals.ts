import * as THREE from 'three'
import type { MapConfig } from '../../shared/maps/types'
import type { ObjectiveState } from '../../shared/objectives'
import { addBox, addCylinder } from './sceneUtils'

interface GeneratorVisual {
  id: string
  light: THREE.MeshBasicMaterial
  fill: THREE.Mesh
  fillMaterial: THREE.MeshBasicMaterial
  rotor: THREE.Mesh
}

interface GateVisual {
  id: string
  panel: THREE.Mesh
  light: THREE.MeshBasicMaterial
  fill: THREE.Mesh
  fillMaterial: THREE.MeshBasicMaterial
}

/**
 * Procedural objective props. The server owns all progress; this class only
 * mirrors it into lamps, bars and gate panels. It never decides whether a
 * generator is repaired or an exit is open.
 */
export class ObjectiveVisuals {
  readonly root = new THREE.Group()
  private readonly generators: GeneratorVisual[] = []
  private readonly gates: GateVisual[] = []
  private readonly elapsed = { value: 0 }

  constructor(config: MapConfig, parent: THREE.Object3D) {
    this.root.name = 'ObjectiveProps'
    parent.add(this.root)

    const metal = new THREE.MeshStandardMaterial({ color: '#4b4b4e', roughness: 0.56, metalness: 0.62 })
    const dark = new THREE.MeshStandardMaterial({ color: '#222124', roughness: 0.82, metalness: 0.32 })
    const track = new THREE.MeshStandardMaterial({ color: '#0f0d10', roughness: 0.9 })
    const gatePanel = new THREE.MeshStandardMaterial({
      color: '#4a1d24',
      roughness: 0.74,
      metalness: 0.28,
    })

    config.generatorSlots.forEach((slot, index) => {
      const group = new THREE.Group()
      group.name = `generator-${slot.id}`
      group.position.set(slot.x, 0, slot.z)
      this.root.add(group)

      addBox(group, metal, 1.9, 0.45, 1.6, 0, 0.225, 0)
      addBox(group, dark, 1.4, 1.05, 1.2, 0, 0.95, 0)
      addBox(group, metal, 0.3, 1.2, 0.3, -0.72, 1.35, -0.42)
      addBox(group, metal, 0.3, 1.2, 0.3, 0.72, 1.35, -0.42)
      addCylinder(group, dark, 0.42, 0.46, 0.7, 10, 0, 1.68, 0)
      addCylinder(group, metal, 0.54, 0.54, 0.12, 12, 0, 1.68, 0)
      const rotor = addCylinder(group, metal, 0.13, 0.13, 0.92, 6, 0, 1.95, 0)
      rotor.rotation.z = Math.PI / 2

      const lightMaterial = new THREE.MeshBasicMaterial({ color: '#b8343c' })
      addBox(group, lightMaterial, 0.34, 0.17, 0.14, 0, 1.36, 0.67)
      addBox(group, track, 1.55, 0.11, 0.08, 0, 1.12, 0.68)

      const fillMaterial = new THREE.MeshBasicMaterial({ color: '#d39b43' })
      const fill = addBox(group, fillMaterial, 1.5, 0.09, 0.1, -0.75, 1.12, 0.74)
      fill.position.x = -0.75
      fill.scale.x = 0.001

      // A small base plate makes the prop read as a machine rather than a box.
      addBox(group, track, 2.15, 0.08, 1.85, 0, 0.04, 0)

      this.generators.push({
        id: slot.id,
        light: lightMaterial,
        fill,
        fillMaterial,
        rotor,
      })
      void index
    })

    config.exitGates.forEach((gate) => {
      const group = new THREE.Group()
      group.name = `gate-${gate.id}`
      group.position.set(gate.x, 0, gate.z)
      this.root.add(group)

      addBox(group, metal, 0.4, 4.1, 0.4, 0, 2.05, -2.25)
      addBox(group, metal, 0.4, 4.1, 0.4, 0, 2.05, 2.25)
      addBox(group, metal, 0.4, 0.34, 4.9, 0, 4.08, 0)
      addBox(group, dark, 0.5, 0.16, 4.4, 0, 0.08, 0)

      const panel = addBox(group, gatePanel, 0.22, 3.35, 4.1, 0, 1.72, 0)
      const lightMaterial = new THREE.MeshBasicMaterial({ color: '#7d272d' })
      addBox(group, lightMaterial, 0.34, 0.2, 0.34, 0, 4.38, 0)
      addBox(group, track, 0.16, 0.12, 4.3, 0.32, 3.83, 0)

      const fillMaterial = new THREE.MeshBasicMaterial({ color: '#d39b43' })
      const fill = addBox(group, fillMaterial, 0.18, 0.1, 4.2, 0.34, 3.83, -2.1)
      fill.scale.z = 0.001

      this.gates.push({
        id: gate.id,
        panel,
        light: lightMaterial,
        fill,
        fillMaterial,
      })
    })
  }

  setState(state: ObjectiveState): void {
    for (const visual of this.generators) {
      const generator = state.generators.find((candidate) => candidate.id === visual.id)
      const progress = generator?.progress ?? 0
      const repaired = generator?.repaired ?? false
      const color = repaired ? '#55d38b' : progress > 0 ? '#e1ad4a' : '#b8343c'
      visual.light.color.set(color)
      visual.fillMaterial.color.set(color)
      visual.fill.scale.x = Math.max(0.001, progress)
      visual.fill.position.x = -0.75 + 0.75 * progress
      visual.rotor.rotation.y = progress * Math.PI * 8
    }

    for (const visual of this.gates) {
      const gate = state.gates.find((candidate) => candidate.id === visual.id)
      const progress = gate?.progress ?? 0
      const open = gate?.open ?? false
      const color = open ? '#55d38b' : state.powered ? '#e1ad4a' : '#7d272d'
      visual.light.color.set(color)
      visual.fillMaterial.color.set(color)
      visual.fill.scale.z = Math.max(0.001, progress)
      visual.fill.position.z = -2.1 + 2.1 * progress
      visual.panel.position.y = 1.72 + progress * 3.4
      visual.panel.visible = !open
    }
  }

  update(dt: number): void {
    this.elapsed.value += dt
    const pulse = 0.78 + Math.sin(this.elapsed.value * 3.2) * 0.18
    for (const visual of this.generators) {
      visual.rotor.rotation.x += dt * 0.35
      const progress = Math.max(0.001, visual.fill.scale.x)
      visual.rotor.rotation.y += dt * (0.25 + progress * 3.5) * pulse
    }
  }
}
