import * as THREE from 'three'
import { damp } from '../../shared/math'

interface OccluderEntry {
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
  opacity: number
  target: number
}

/**
 * Selective roof/canopy occlusion for the aerial camera.
 * Only surfaces between the camera and its focus point fade, so the killer
 * cannot see every interior in the map at once.
 */
export class OcclusionController {
  private readonly entries: OccluderEntry[] = []
  private readonly raycaster = new THREE.Raycaster()
  private readonly direction = new THREE.Vector3()

  constructor(occluders: THREE.Mesh[]) {
    for (const mesh of occluders) {
      const source = mesh.material
      if (Array.isArray(source) || !(source instanceof THREE.MeshStandardMaterial)) continue
      const material = source.clone()
      material.transparent = true
      material.opacity = 1
      material.depthWrite = true
      mesh.material = material
      this.entries.push({ mesh, material, opacity: 1, target: 1 })
    }
  }

  update(cameraPosition: THREE.Vector3, focus: THREE.Vector3, active: boolean, dt: number): void {
    const hits = new Set<THREE.Object3D>()
    if (active) {
      this.direction.subVectors(focus, cameraPosition)
      const distance = this.direction.length()
      if (distance > 0.5) {
        this.raycaster.set(cameraPosition, this.direction.normalize())
        this.raycaster.far = distance + 0.5
        this.raycaster.near = 0.1
        const intersections = this.raycaster.intersectObjects(
          this.entries.map((entry) => entry.mesh),
          false,
        )
        for (const hit of intersections) hits.add(hit.object)
      }
    }

    for (const entry of this.entries) {
      entry.target = active && hits.has(entry.mesh) ? 0.14 : 1
      entry.opacity = damp(entry.opacity, entry.target, 8, dt)
      if (Math.abs(entry.opacity - entry.target) < 0.002) entry.opacity = entry.target
      entry.material.opacity = entry.opacity
      entry.material.depthWrite = entry.opacity > 0.96
      entry.mesh.castShadow = entry.opacity > 0.6
    }
  }

  restore(): void {
    for (const entry of this.entries) {
      entry.opacity = 1
      entry.target = 1
      entry.material.opacity = 1
      entry.material.depthWrite = true
      entry.mesh.castShadow = true
    }
  }
}
