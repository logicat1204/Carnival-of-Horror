import * as THREE from 'three'
import { makeAABB, type AABB } from '../../shared/collision'

export function addBoxCollider(
  colliders: AABB[],
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  baseY: number,
  height: number,
  tag?: string,
): void {
  colliders.push(makeAABB(id, x, z, width, depth, height, baseY, tag))
}

/**
 * Add a collider for a box authored in a structure's local space. Rotation must
 * be a multiple of 90° (the map validator enforces this) so the AABB is exact.
 */
export function addLocalCollider(
  colliders: AABB[],
  id: string,
  originX: number,
  originZ: number,
  rotationDeg: number,
  localX: number,
  localZ: number,
  width: number,
  depth: number,
  baseY: number,
  height: number,
  tag?: string,
): void {
  const radians = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const worldX = originX + localX * cos + localZ * sin
  const worldZ = originZ - localX * sin + localZ * cos
  const quarterTurn = Math.abs(Math.round(rotationDeg / 90) % 2) === 1
  addBoxCollider(
    colliders,
    id,
    worldX,
    worldZ,
    quarterTurn ? depth : width,
    quarterTurn ? width : depth,
    baseY,
    height,
    tag,
  )
}

export function addBox(
  parent: THREE.Object3D,
  material: THREE.Material,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  options: { castShadow?: boolean; receiveShadow?: boolean; name?: string } = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  mesh.castShadow = options.castShadow ?? true
  mesh.receiveShadow = options.receiveShadow ?? true
  if (options.name) mesh.name = options.name
  parent.add(mesh)
  return mesh
}

export function addCylinder(
  parent: THREE.Object3D,
  material: THREE.Material,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  x: number,
  y: number,
  z: number,
  options: { castShadow?: boolean; receiveShadow?: boolean } = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
  )
  mesh.position.set(x, y, z)
  mesh.castShadow = options.castShadow ?? true
  mesh.receiveShadow = options.receiveShadow ?? true
  parent.add(mesh)
  return mesh
}

const UP = new THREE.Vector3(0, 1, 0)

export function addCylinderBetween(
  parent: THREE.Object3D,
  material: THREE.Material,
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  segments = 6,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(to, from)
  const length = direction.length()
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material)
  mesh.position.copy(from).addScaledVector(direction, 0.5)
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize())
  mesh.castShadow = true
  parent.add(mesh)
  return mesh
}

export function addSign(
  parent: THREE.Object3D,
  material: THREE.Material,
  width: number,
  height: number,
  x: number,
  y: number,
  z: number,
  rotationY = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
  mesh.position.set(x, y, z)
  mesh.rotation.y = rotationY
  mesh.castShadow = false
  mesh.receiveShadow = false
  parent.add(mesh)
  return mesh
}

export function addBulb(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  radius = 0.09,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 6, 5), material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

export function addGlowSprite(
  parent: THREE.Object3D,
  material: THREE.SpriteMaterial,
  x: number,
  y: number,
  z: number,
  scale: number,
): THREE.Sprite {
  const sprite = new THREE.Sprite(material)
  sprite.position.set(x, y, z)
  sprite.scale.setScalar(scale)
  parent.add(sprite)
  return sprite
}

export function addInstancedBulbs(
  parent: THREE.Object3D,
  material: THREE.Material,
  points: THREE.Vector3[],
  radius: number,
): THREE.InstancedMesh {
  const geometry = new THREE.SphereGeometry(radius, 5, 4)
  const mesh = new THREE.InstancedMesh(geometry, material, points.length)
  const matrix = new THREE.Matrix4()
  points.forEach((point, index) => {
    matrix.makeTranslation(point.x, point.y, point.z)
    mesh.setMatrixAt(index, matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.castShadow = false
  mesh.receiveShadow = false
  parent.add(mesh)
  return mesh
}

/** Bunting triangles along a local X axis, used around tent entrances. */
export function addBunting(
  parent: THREE.Object3D,
  palette: { primary: string; secondary: string; trim: string },
  width: number,
  y: number,
  z: number,
  count = 9,
): void {
  const colors = [palette.primary, palette.trim, palette.secondary]
  const geometry = new THREE.ConeGeometry(0.13, 0.32, 3)
  const materials = colors.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide }),
  )
  for (let i = 0; i < count; i++) {
    const flag = new THREE.Mesh(geometry, materials[i % materials.length])
    flag.position.set(-width / 2 + (width / (count - 1)) * i, y, z)
    flag.rotation.z = Math.PI
    flag.castShadow = false
    parent.add(flag)
  }
}

export function addPuddle(parent: THREE.Object3D, material: THREE.Material, x: number, z: number, radius: number): void {
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(radius, 18), material)
  puddle.rotation.x = -Math.PI / 2
  puddle.position.set(x, 0.021, z)
  puddle.receiveShadow = true
  parent.add(puddle)
}
