import * as THREE from 'three'
import type { BuiltMap } from '../../maps/types'
import type {
  FenceConfig,
  MapConfig,
  ObstacleConfig,
  StructureConfig,
} from '../../shared/maps/types'
import {
  buildCarouselColliders,
  buildFenceColliders,
  buildFerrisWheelColliders,
  buildObstacleColliders,
  buildStallColliders,
  buildTentColliders,
  buildTicketBoothColliders,
} from '../../shared/maps/colliders'
import { seededRandom } from '../../shared/math'
import type { QualityLevel } from '../../shared/settings'
import rawConfig from './map.config.json'
import { MaterialLibrary } from '../../game/world/MaterialLibrary'
import {
  addBox,
  addBoxCollider,
  addBulb,
  addBunting,
  addCylinder,
  addCylinderBetween,
  addGlowSprite,
  addInstancedBulbs,
  addPuddle,
  addSign,
} from '../../game/world/sceneUtils'

const CONFIG = rawConfig as unknown as MapConfig

const MAX_POINT_LIGHTS: Record<QualityLevel, number> = {
  low: 4,
  medium: 8,
  high: 14,
}

interface FlickerLight {
  light: THREE.PointLight
  base: number
  phase: number
}

export function buildCarnivalMap(options: { quality: QualityLevel }): BuiltMap {
  const { quality } = options
  const root = new THREE.Group()
  root.name = 'CarnivalAbandonado'
  const materials = new MaterialLibrary()
  const colliders: BuiltMap['colliders'] = []
  const occluders: THREE.Mesh[] = []
  const pointLights: THREE.PointLight[] = []
  const flickers: FlickerLight[] = []
  const updaters: Array<(dt: number, elapsed: number) => void> = []

  const castShadows = quality !== 'low'
  root.userData.castShadows = castShadows

  buildAtmosphere(root, CONFIG, materials, quality)
  buildGround(root, materials)
  buildDebris(root, materials)

  for (const structure of CONFIG.structures) {
    switch (structure.kind) {
      case 'tent':
        buildTent(root, structure, materials, colliders, occluders, false)
        break
      case 'grand_tent':
        buildTent(root, structure, materials, colliders, occluders, true)
        break
      case 'stall':
        buildStall(root, structure, materials, colliders, occluders)
        break
      case 'carousel':
        buildCarousel(root, structure, materials, colliders, occluders, updaters)
        break
      case 'ferris_wheel':
        buildFerrisWheel(root, structure, materials, colliders, updaters)
        break
      case 'ticket_booth':
        buildTicketBooth(root, structure, materials, colliders)
        break
    }
  }

  for (const obstacle of CONFIG.obstacles) {
    buildObstacle(root, obstacle, materials, colliders)
  }

  for (const fence of CONFIG.fences) {
    buildFence(root, fence, materials, colliders)
  }

  // The visible objective machinery is built by ObjectiveVisuals once the
  // match state exists. Its solid footprint is part of the shared map data so
  // client prediction and the authoritative server resolve the same boxes.
  for (const generator of CONFIG.generatorSlots) {
    addBoxCollider(
      colliders,
      `generator-collider-${generator.id}`,
      generator.x,
      generator.z,
      1.9,
      1.6,
      0,
      1.45,
      'prop',
    )
  }

  buildLights(root, CONFIG, materials, pointLights, flickers, quality)

  const update = (dt: number, elapsed: number) => {
    for (const updater of updaters) updater(dt, elapsed)
    for (const flicker of flickers) {
      const noise =
        Math.sin(elapsed * 11 + flicker.phase) * 0.5 +
        Math.sin(elapsed * 4.3 + flicker.phase * 2.1) * 0.3 +
        Math.sin(elapsed * 23.7 + flicker.phase * 0.7) * 0.2
      const factor = 0.78 + 0.22 * (noise * 0.5 + 0.5)
      flicker.light.intensity = flicker.base * factor
    }
  }

  return {
    root,
    colliders,
    occluders,
    pointLights,
    update,
    dispose: () => materials.dispose(),
  }
}

function buildAtmosphere(
  root: THREE.Group,
  config: MapConfig,
  materials: MaterialLibrary,
  quality: QualityLevel,
): void {
  const theme = config.theme
  const skyGeometry = new THREE.SphereGeometry(175, 24, 16)
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(theme.skyTop) },
      bottomColor: { value: new THREE.Color(theme.skyBottom) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 color = mix(bottomColor, topColor, smoothstep(-0.08, 0.7, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
  const sky = new THREE.Mesh(skyGeometry, skyMaterial)
  sky.name = 'Sky'
  root.add(sky)

  const starCount = quality === 'low' ? 140 : quality === 'medium' ? 260 : 420
  const random = seededRandom(4242)
  const positions = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const theta = random() * Math.PI * 2
    const phi = Math.acos(0.08 + random() * 0.92)
    const radius = 150
    positions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius
    positions[i * 3 + 1] = Math.cos(phi) * radius * 0.8 + 18
    positions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const starMaterial = new THREE.PointsMaterial({
    color: '#c9d4ff',
    size: 0.85,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.72,
    fog: false,
    depthWrite: false,
  })
  const stars = new THREE.Points(starGeometry, starMaterial)
  stars.name = 'Stars'
  root.add(stars)

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#d8e4ff', fog: false }),
  )
  moon.position.set(-72, 66, -112)
  root.add(moon)
  const moonGlowMaterial = new THREE.SpriteMaterial({
    map: materials.glow.map,
    color: '#8fb4ff',
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  })
  const moonGlow = new THREE.Sprite(moonGlowMaterial)
  moonGlow.position.copy(moon.position)
  moonGlow.scale.setScalar(34)
  root.add(moonGlow)

  const hemisphere = new THREE.HemisphereLight(
    theme.ambientColor,
    theme.groundColor,
    theme.ambientIntensity,
  )
  root.add(hemisphere)

  const moonLight = new THREE.DirectionalLight(theme.moonColor, theme.moonIntensity)
  moonLight.position.set(-30, 46, 24)
  moonLight.target.position.set(0, 0, 0)
  moonLight.castShadow = quality !== 'low'
  if (moonLight.castShadow) {
    moonLight.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024)
    moonLight.shadow.camera.left = -56
    moonLight.shadow.camera.right = 56
    moonLight.shadow.camera.top = 56
    moonLight.shadow.camera.bottom = -56
    moonLight.shadow.camera.near = 1
    moonLight.shadow.camera.far = 140
    moonLight.shadow.bias = -0.0006
    moonLight.shadow.normalBias = 0.03
  }
  root.add(moonLight)
  root.add(moonLight.target)
}

function buildGround(root: THREE.Group, materials: MaterialLibrary): void {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(112, 112), materials.dirt)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  ground.name = 'Ground'
  root.add(ground)

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(14.6, 48), materials.gravel)
  plaza.rotation.x = -Math.PI / 2
  plaza.position.y = 0.012
  plaza.receiveShadow = true
  root.add(plaza)

  const pathMaterial = materials.gravel
  const paths: Array<[number, number, number, number]> = [
    [0, -21, 5.2, 30],
    [0, 15, 5.2, 20],
    [-25, 0, 38, 4.4],
    [25, 0, 38, 4.4],
  ]
  for (const [x, z, width, depth] of paths) {
    const path = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), pathMaterial)
    path.rotation.x = -Math.PI / 2
    path.position.set(x, 0.011, z)
    path.receiveShadow = true
    root.add(path)
  }

  const ring = new THREE.Mesh(new THREE.RingGeometry(14.5, 15.1, 48), materials.stone)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.014
  ring.receiveShadow = true
  root.add(ring)

  for (const [x, z, r] of [
    [7, -7, 1.7],
    [-9, 9, 2.3],
    [19, -16, 1.4],
    [-20, 7, 1.1],
    [3, 29, 1.8],
  ] as const) {
    addPuddle(root, materials.water, x, z, r)
  }
}

function buildDebris(root: THREE.Group, materials: MaterialLibrary): void {
  const random = seededRandom(90210)
  const count = 90
  const geometry = new THREE.PlaneGeometry(1, 0.65)
  const mesh = new THREE.InstancedMesh(geometry, materials.paper, count)
  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  const position = new THREE.Vector3()
  const euler = new THREE.Euler()
  for (let i = 0; i < count; i++) {
    position.set((random() - 0.5) * 86, 0.035, (random() - 0.5) * 86)
    euler.set(-Math.PI / 2, 0, random() * Math.PI * 2)
    quaternion.setFromEuler(euler)
    const s = 0.2 + random() * 0.5
    scale.set(s, s, s)
    matrix.compose(position, quaternion, scale)
    mesh.setMatrixAt(i, matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.receiveShadow = true
  mesh.castShadow = false
  mesh.name = 'Debris'
  root.add(mesh)
}

function buildTent(
  root: THREE.Group,
  config: StructureConfig,
  materials: MaterialLibrary,
  colliders: BuiltMap['colliders'],
  occluders: THREE.Mesh[],
  grand: boolean,
): void {
  const group = new THREE.Group()
  group.name = config.id
  group.position.set(config.x, 0, config.z)
  group.rotation.y = THREE.MathUtils.degToRad(config.rotation)
  root.add(group)

  const palette = paletteOf(materials, config.palette)
  const wallHeight = config.height * 0.62
  const roofHeight = config.height - wallHeight
  const wallThickness = 0.28
  const doorWidth = grand ? 4.4 : 2.7
  const w = config.width
  const d = config.depth

  addBox(group, palette.wall, w, wallHeight, wallThickness, 0, wallHeight / 2, -d / 2 + wallThickness / 2, {
    name: `${config.id}-back-wall`,
  })
  addBox(group, palette.wall, wallThickness, wallHeight, d, -w / 2 + wallThickness / 2, wallHeight / 2, 0)
  addBox(group, palette.wall, wallThickness, wallHeight, d, w / 2 - wallThickness / 2, wallHeight / 2, 0)

  const frontPanelWidth = (w - doorWidth) / 2
  addBox(
    group,
    palette.wall,
    frontPanelWidth,
    wallHeight,
    wallThickness,
    -(doorWidth / 2 + frontPanelWidth / 2),
    wallHeight / 2,
    d / 2 - wallThickness / 2,
  )
  addBox(
    group,
    palette.wall,
    frontPanelWidth,
    wallHeight,
    wallThickness,
    doorWidth / 2 + frontPanelWidth / 2,
    wallHeight / 2,
    d / 2 - wallThickness / 2,
  )
  addBox(group, palette.wall, doorWidth + 0.4, 0.55, wallThickness, 0, wallHeight - 0.275, d / 2 - wallThickness / 2)

  for (const [x, z] of [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ] as const) {
    addCylinder(group, materials.wood, 0.13, 0.16, wallHeight + 0.55, 6, x, (wallHeight + 0.55) / 2, z)
  }
  addCylinder(group, materials.wood, 0.11, 0.13, wallHeight, 6, -doorWidth / 2, wallHeight / 2, d / 2)
  addCylinder(group, materials.wood, 0.11, 0.13, wallHeight, 6, doorWidth / 2, wallHeight / 2, d / 2)

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 20, 1), palette.roof)
  roof.position.set(0, wallHeight + roofHeight / 2 - 0.05, 0)
  roof.scale.set(w * 0.68, roofHeight, d * 0.68)
  roof.castShadow = true
  roof.receiveShadow = false
  roof.name = `${config.id}-roof`
  group.add(roof)
  occluders.push(roof)

  const valanceMaterial = palette.valance
  const valanceHeight = grand ? 0.85 : 0.65
  for (const [x, z, rot] of [
    [0, d / 2 + 0.02, 0],
    [0, -d / 2 - 0.02, 0],
    [-w / 2 - 0.02, 0, Math.PI / 2],
    [w / 2 + 0.02, 0, Math.PI / 2],
  ] as const) {
    const valance = new THREE.Mesh(
      new THREE.PlaneGeometry(rot === 0 ? w : d, valanceHeight),
      valanceMaterial,
    )
    valance.position.set(x, wallHeight - valanceHeight / 2 + 0.03, z)
    valance.rotation.y = rot
    valance.castShadow = false
    group.add(valance)
  }

  addSign(
    group,
    materials.sign(config.label, palette.trimColor),
    Math.min(w * 0.58, 6.4),
    grand ? 1.15 : 0.86,
    0,
    wallHeight - (grand ? 0.58 : 0.46),
    d / 2 + 0.33,
  )
  addBunting(group, {
    primary: palette.primary,
    secondary: palette.secondary,
    trim: palette.trimColor,
  }, w * 0.9, wallHeight - 0.12, d / 2 + 0.16, grand ? 13 : 9)

  const apexY = wallHeight + roofHeight - 0.1
  addCylinder(group, materials.metal, 0.05, 0.05, 1.9, 5, 0, apexY + 0.6, 0)
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 3), palette.trim)
  flag.position.set(0.3, apexY + 1.25, 0)
  flag.rotation.z = -Math.PI / 2
  group.add(flag)

  addBulb(group, materials.emissive('#ffc37a', 2.2), 0, wallHeight - 0.35, 0, grand ? 0.19 : 0.14)
  addGlowSprite(group, materials.glow, 0, wallHeight - 0.35, 0, grand ? 2.6 : 1.8)

  // Wall colliders with a real door gap, shared verbatim with the server.
  colliders.push(...buildTentColliders(config, grand))
}

function buildStall(
  root: THREE.Group,
  config: StructureConfig,
  materials: MaterialLibrary,
  colliders: BuiltMap['colliders'],
  occluders: THREE.Mesh[],
): void {
  const group = new THREE.Group()
  group.name = config.id
  group.position.set(config.x, 0, config.z)
  group.rotation.y = THREE.MathUtils.degToRad(config.rotation)
  root.add(group)

  const palette = paletteOf(materials, config.palette)
  const w = config.width
  const d = config.depth
  const h = config.height

  addBox(group, materials.darkWood, w, 1.05, 0.7, 0, 0.525, d / 2 - 0.42)
  addBox(group, materials.wood, w - 0.25, 0.12, 0.85, 0, 1.08, d / 2 - 0.42)
  addBox(group, palette.wall, w, 2.45, 0.24, 0, 1.225, -d / 2 + 0.16)
  addBox(group, materials.wood, 0.18, 2.45, d, -w / 2 + 0.12, 1.225, 0)
  addBox(group, materials.wood, 0.18, 2.45, d, w / 2 - 0.12, 1.225, 0)

  for (const [x, z] of [
    [-w / 2 + 0.12, d / 2 - 0.12],
    [w / 2 - 0.12, d / 2 - 0.12],
    [-w / 2 + 0.12, -d / 2 + 0.12],
    [w / 2 - 0.12, -d / 2 + 0.12],
  ] as const) {
    addCylinder(group, materials.wood, 0.075, 0.09, h, 6, x, h / 2, z)
  }

  const awning = addBox(group, palette.roof, w + 0.55, 0.14, d + 0.75, 0, h - 0.22, 0.1)
  occluders.push(awning)
  addBox(group, palette.valance, w + 0.55, 0.5, 0.06, 0, h - 0.51, d / 2 + 0.46)

  addSign(
    group,
    materials.sign(config.label, palette.trimColor),
    Math.min(w * 0.72, 3.4),
    0.82,
    0,
    2.55,
    d / 2 + 0.33,
  )

  addShelves(group, palette, materials, w, d)
  addBulb(group, materials.emissive('#ffd9a0', 2.4), -0.7, h - 0.38, 0.15, 0.075)
  addBulb(group, materials.emissive('#ffd9a0', 2.4), 0, h - 0.38, 0.15, 0.075)
  addBulb(group, materials.emissive('#ffd9a0', 2.4), 0.7, h - 0.38, 0.15, 0.075)
  addGlowSprite(group, materials.glow, 0, h - 0.4, 0.15, 1.7)

  colliders.push(...buildStallColliders(config))
}

function addShelves(
  group: THREE.Group,
  palette: CarnivalPaletteMaterials,
  materials: MaterialLibrary,
  w: number,
  d: number,
): void {
  const goods = [
    new THREE.BoxGeometry(0.34, 0.42, 0.3),
    new THREE.CylinderGeometry(0.16, 0.16, 0.38, 8),
    new THREE.SphereGeometry(0.19, 8, 6),
  ]
  const colors = [palette.trim, palette.wall, materials.wood]
  for (let i = 0; i < 6; i++) {
    const geometry = goods[i % goods.length]
    const source = colors[i % colors.length]
    const material = new THREE.MeshStandardMaterial({
      color: source.color.clone(),
      roughness: 0.8,
    })
    const item = new THREE.Mesh(geometry, material)
    item.position.set(-w / 2 + 0.55 + (i % 3) * 0.55, 1.25, -d / 2 + 0.55)
    item.castShadow = true
    group.add(item)
  }
}

type CarnivalPaletteMaterials = ReturnType<MaterialLibrary['palette']>

function buildCarousel(
  root: THREE.Group,
  config: StructureConfig,
  materials: MaterialLibrary,
  colliders: BuiltMap['colliders'],
  occluders: THREE.Mesh[],
  updaters: Array<(dt: number, elapsed: number) => void>,
): void {
  const group = new THREE.Group()
  group.name = config.id
  group.position.set(config.x, 0, config.z)
  root.add(group)
  const palette = paletteOf(materials, config.palette)

  addCylinder(group, materials.stone, 5.15, 5.35, 0.72, 24, 0, 0.36, 0)
  addCylinder(group, materials.darkWood, 5.3, 5.3, 0.14, 24, 0, 0.79, 0)

  const rotor = new THREE.Group()
  rotor.name = `${config.id}-rotor`
  group.add(rotor)

  addCylinder(rotor, palette.trim, 0.34, 0.48, 4.6, 10, 0, 3.05, 0)
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2
    addCylinder(rotor, materials.metal, 0.065, 0.075, 4.25, 6, Math.cos(angle) * 4.35, 2.92, Math.sin(angle) * 4.35)
  }

  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1), palette.roof)
  canopy.position.set(0, 6.02, 0)
  canopy.scale.set(6.15, 2.1, 6.15)
  canopy.castShadow = true
  canopy.name = `${config.id}-canopy`
  rotor.add(canopy)
  occluders.push(canopy)

  const canopyEdge = new THREE.Mesh(
    new THREE.CylinderGeometry(6.08, 6.08, 0.52, 24, 1, true),
    palette.valance,
  )
  canopyEdge.position.set(0, 4.96, 0)
  rotor.add(canopyEdge)

  const rim = new THREE.Mesh(new THREE.TorusGeometry(5.95, 0.09, 5, 32), palette.trim)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 5.25
  rotor.add(rim)

  const bulbPoints: THREE.Vector3[] = []
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2
    bulbPoints.push(new THREE.Vector3(Math.cos(angle) * 6.06, 5.16, Math.sin(angle) * 6.06))
  }
  addInstancedBulbs(rotor, materials.emissive('#ffd9a0', 2.8), bulbPoints, 0.075)

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.22
    addCarouselHorse(rotor, materials, palette, Math.cos(angle) * 3.55, Math.sin(angle) * 3.55, angle, i)
  }

  updaters.push((dt) => {
    rotor.rotation.y += dt * 0.045
  })

  colliders.push(...buildCarouselColliders(config))
}

function addCarouselHorse(
  parent: THREE.Group,
  materials: MaterialLibrary,
  palette: CarnivalPaletteMaterials,
  x: number,
  z: number,
  angle: number,
  index: number,
): void {
  const horse = new THREE.Group()
  horse.position.set(x, 0, z)
  horse.rotation.y = -angle + (index % 2 === 0 ? Math.PI / 2 : -Math.PI / 2)
  parent.add(horse)

  addCylinder(horse, materials.metal, 0.045, 0.045, 3.7, 5, 0, 2.75, 0)
  const bodyColor = index % 2 === 0 ? '#d8c7a3' : '#6d5742'
  const bodyMaterial = materials.emissive(bodyColor, 0.06)
  addBox(horse, bodyMaterial, 1.05, 0.42, 0.36, 0, 1.72, 0)
  addBox(horse, bodyMaterial, 0.4, 0.26, 0.28, 0.52, 1.94, 0)
  addBox(horse, bodyMaterial, 0.28, 0.46, 0.26, 0.58, 2.16, 0)
  addBox(horse, materials.darkWood, 1.05, 0.1, 0.4, 0, 1.94, 0)
  for (const [lx, lz] of [
    [-0.36, -0.12],
    [0.36, -0.12],
    [-0.36, 0.12],
    [0.36, 0.12],
  ] as const) {
    addBox(horse, bodyMaterial, 0.12, 0.62, 0.12, lx, 1.36, lz)
  }
  addBox(horse, palette.trim, 0.5, 0.08, 0.46, 0.05, 1.93, 0)
}

function buildFerrisWheel(
  root: THREE.Group,
  config: StructureConfig,
  materials: MaterialLibrary,
  colliders: BuiltMap['colliders'],
  updaters: Array<(dt: number, elapsed: number) => void>,
): void {
  const group = new THREE.Group()
  group.name = config.id
  group.position.set(config.x, 0, config.z)
  root.add(group)
  const palette = paletteOf(materials, config.palette)
  const centerY = 11

  addBox(group, materials.stone, 12, 0.55, 6, 0, 0.275, 0)
  const hub = new THREE.Vector3(0, centerY, 0)
  for (const [x, z] of [
    [-4.4, -2.2],
    [4.4, -2.2],
    [-4.4, 2.2],
    [4.4, 2.2],
  ] as const) {
    addCylinderBetween(group, materials.rust, new THREE.Vector3(x, 0.35, z), hub, 0.17, 6)
  }
  addCylinderBetween(
    group,
    materials.metal,
    new THREE.Vector3(-4.4, 1.2, 2.2),
    new THREE.Vector3(4.4, 1.2, 2.2),
    0.1,
    6,
  )

  const wheel = new THREE.Group()
  wheel.position.copy(hub)
  group.add(wheel)

  const wheelRadius = 8.4
  for (const z of [-0.65, 0.65]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius, 0.16, 6, 48), materials.rust)
    ring.position.z = z
    wheel.add(ring)
  }
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2
    const rimPoint = new THREE.Vector3(Math.cos(angle) * wheelRadius, Math.sin(angle) * wheelRadius, 0)
    addCylinderBetween(wheel, materials.metal, new THREE.Vector3(0, 0, -0.65), rimPoint.clone().setZ(-0.65), 0.055, 4)
    addCylinderBetween(wheel, materials.metal, new THREE.Vector3(0, 0, 0.65), rimPoint.clone().setZ(0.65), 0.055, 4)
  }
  addCylinder(wheel, materials.metal, 0.55, 0.55, 1.7, 12, 0, 0, 0).rotation.x = Math.PI / 2

  const gondolas: THREE.Group[] = []
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const gondola = new THREE.Group()
    gondola.position.set(Math.cos(angle) * wheelRadius, Math.sin(angle) * wheelRadius, 0)
    wheel.add(gondola)
    gondolas.push(gondola)
    addBox(gondola, materials.metal, 0.08, 0.65, 0.08, 0, -0.32, 0)
    addBox(gondola, i % 2 === 0 ? palette.trim : materials.rust, 0.95, 0.7, 0.8, 0, -0.98, 0)
    addBox(gondola, materials.canvasDark, 1.0, 0.1, 0.85, 0, -0.6, 0)
    addBulb(gondola, materials.emissive('#ffb45e', 1.8), 0, -0.7, 0.42, 0.055)
  }

  const bulbPoints: THREE.Vector3[] = []
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2
    bulbPoints.push(new THREE.Vector3(Math.cos(angle) * wheelRadius, Math.sin(angle) * wheelRadius, 0.82))
  }
  addInstancedBulbs(wheel, materials.emissive('#ffd08a', 2.6), bulbPoints, 0.065)

  let wheelAngle = 0
  updaters.push((dt) => {
    wheelAngle += dt * 0.035
    wheel.rotation.z = wheelAngle
    for (const gondola of gondolas) gondola.rotation.z = -wheelAngle
  })

  addSign(
    group,
    materials.sign('RUEDA', palette.trimColor),
    4.2,
    0.9,
    0,
    2.2,
    3.15,
  )

  colliders.push(...buildFerrisWheelColliders(config))
}

function buildTicketBooth(
  root: THREE.Group,
  config: StructureConfig,
  materials: MaterialLibrary,
  colliders: BuiltMap['colliders'],
): void {
  const group = new THREE.Group()
  group.name = config.id
  group.position.set(config.x, 0, config.z)
  group.rotation.y = THREE.MathUtils.degToRad(config.rotation)
  root.add(group)
  const palette = paletteOf(materials, config.palette)
  const w = config.width
  const d = config.depth

  addBox(group, materials.darkWood, w, 2.65, d, 0, 1.325, 0)
  addBox(group, palette.wall, w + 0.4, 0.22, d + 0.4, 0, 2.76, 0)
  addBox(group, palette.roof, w + 0.8, 0.14, d + 0.8, 0, 2.95, 0)
  addBox(group, materials.glass, w * 0.58, 0.85, 0.08, 0, 1.78, d / 2 + 0.02, { castShadow: false })
  for (let i = 0; i < 4; i++) {
    addBox(group, materials.metal, 0.045, 0.9, 0.1, -w * 0.26 + i * (w * 0.52) / 3, 1.78, d / 2 + 0.07, {
      castShadow: false,
    })
  }
  addBox(group, materials.wood, w * 0.7, 0.09, 0.42, 0, 1.27, d / 2 + 0.2)
  addSign(
    group,
    materials.sign(config.label, palette.trimColor),
    Math.min(w * 0.7, 2.3),
    0.5,
    0,
    2.38,
    d / 2 + 0.18,
  )
  addBulb(group, materials.emissive('#ffd9a0', 2.2), 0, 2.0, -0.5, 0.075)

  colliders.push(...buildTicketBoothColliders(config))
}

function buildObstacle(
  root: THREE.Group,
  config: ObstacleConfig,
  materials: MaterialLibrary,
  colliders: BuiltMap['colliders'],
): void {
  const group = new THREE.Group()
  group.name = config.id
  group.position.set(config.x, 0, config.z)
  group.rotation.y = THREE.MathUtils.degToRad(config.rotation)
  root.add(group)
  const { width: w, depth: d, height: h } = config

  switch (config.kind) {
    case 'crate': {
      addBox(group, materials.wood, w, h, d, 0, h / 2, 0)
      addBox(group, materials.darkWood, w + 0.08, 0.1, 0.1, 0, h - 0.08, d / 2)
      addBox(group, materials.darkWood, w + 0.08, 0.1, 0.1, 0, h - 0.08, -d / 2)
      addBox(group, materials.darkWood, 0.1, h, 0.1, w / 2, h / 2, d / 2)
      addBox(group, materials.darkWood, 0.1, h, 0.1, -w / 2, h / 2, d / 2)
      break
    }
    case 'barrel': {
      addCylinder(group, materials.rust, w / 2, w / 2.1, h, 10, 0, h / 2, 0)
      for (const y of [h * 0.25, h * 0.75]) {
        addCylinder(group, materials.metal, w / 2 + 0.035, w / 2 + 0.035, 0.08, 10, 0, y, 0)
      }
      break
    }
    case 'barricade': {
      for (const x of [-w / 2 + 0.16, w / 2 - 0.16]) {
        addBox(group, materials.wood, 0.16, h, 0.22, x, h / 2, 0)
      }
      addBox(group, materials.wood, w, 0.24, 0.14, 0, h * 0.68, 0)
      addBox(group, materials.darkWood, w, 0.2, 0.14, 0, h * 0.35, 0)
      for (let i = 0; i < 4; i++) {
        addBox(group, materials.paper, 0.22, 0.3, 0.02, -w / 2 + 0.4 + i * 0.6, h * 0.48, 0.09)
      }
      break
    }
    case 'plank_pile': {
      for (let i = 0; i < 4; i++) {
        const plank = addBox(
          group,
          i % 2 === 0 ? materials.wood : materials.darkWood,
          w,
          0.16,
          d / 4,
          0,
          0.12 + i * 0.18,
          -d / 3 + (i % 2) * 0.18,
        )
        plank.rotation.y = (i - 1.5) * 0.05
      }
      break
    }
  }

  colliders.push(...buildObstacleColliders(config))
}

function buildFence(
  root: THREE.Group,
  config: FenceConfig,
  materials: MaterialLibrary,
  colliders: BuiltMap['colliders'],
): void {
  const dx = config.x2 - config.x1
  const dz = config.z2 - config.z1
  const length = Math.hypot(dx, dz)
  if (length < 0.01) return
  const midX = (config.x1 + config.x2) / 2
  const midZ = (config.z1 + config.z2) / 2
  const angle = Math.atan2(-dz, dx)
  const group = new THREE.Group()
  group.name = config.id
  group.position.set(midX, 0, midZ)
  group.rotation.y = angle
  root.add(group)

  const material = config.style === 'metal' ? materials.rust : materials.wood
  const postCount = Math.max(2, Math.ceil(length / 2.2) + 1)
  for (let i = 0; i < postCount; i++) {
    const x = -length / 2 + (length / (postCount - 1)) * i
    addBox(group, material, 0.12, config.height, 0.12, x, config.height / 2, 0)
  }
  const railHeights = config.style === 'metal'
    ? [config.height * 0.3, config.height * 0.85]
    : [config.height * 0.35, config.height * 0.65, config.height * 0.95]
  for (const y of railHeights) {
    addBox(group, material, length, config.style === 'metal' ? 0.06 : 0.1, 0.08, 0, y, 0)
  }
  if (config.style === 'metal') {
    addBox(group, materials.metal, length, 0.04, 0.04, 0, config.height * 0.55, 0)
  }

  colliders.push(...buildFenceColliders(config))
}

function buildLights(
  root: THREE.Group,
  config: MapConfig,
  materials: MaterialLibrary,
  pointLights: THREE.PointLight[],
  flickers: FlickerLight[],
  quality: QualityLevel,
): void {
  const budget = MAX_POINT_LIGHTS[quality]
  const sorted = [...config.lights].sort((a, b) => b.intensity - a.intensity)
  const litIds = new Set(sorted.slice(0, budget).map((light) => light.id))

  config.lights.forEach((light, index) => {
    const bulbMaterial = materials.emissive(light.color, 2.4)
    const group = new THREE.Group()
    group.name = light.id
    group.position.set(light.x, 0, light.z)
    root.add(group)

    let lightPosition = new THREE.Vector3(light.x, light.y, light.z)
    if (light.kind === 'string' && light.x2 !== undefined && light.z2 !== undefined) {
      const y2 = light.y2 ?? light.y
      const segments = 16
      const points: THREE.Vector3[] = []
      for (let i = 0; i <= segments; i++) {
        const t = i / segments
        const sag = 0.85 * 4 * t * (1 - t)
        points.push(
          new THREE.Vector3(
            THREE.MathUtils.lerp(light.x, light.x2, t),
            THREE.MathUtils.lerp(light.y, y2, t) - sag,
            THREE.MathUtils.lerp(light.z, light.z2, t),
          ),
        )
      }
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
      const line = new THREE.Line(
        lineGeometry,
        new THREE.LineBasicMaterial({ color: '#4b3b2a', transparent: true, opacity: 0.9 }),
      )
      root.add(line)
      addInstancedBulbs(
        root,
        bulbMaterial,
        points.filter((_, i) => i % 2 === 0),
        0.075,
      )
      const mid = points[Math.floor(points.length / 2)]
      lightPosition = mid
      addGlowSprite(root, materials.glow, mid.x, mid.y, mid.z, 2.2)
    } else if (light.kind === 'neon') {
      addSign(
        root,
        materials.sign('CARNIVAL', light.color),
        6.2,
        1.45,
        light.x,
        light.y,
        light.z,
      )
      addGlowSprite(root, materials.glow, light.x, light.y, light.z, 4.2)
    } else {
      addCylinder(root, materials.metal, 0.02, 0.02, 0.55, 4, light.x, light.y + 0.5, light.z, {
        castShadow: false,
      })
      addBulb(root, bulbMaterial, light.x, light.y, light.z, 0.12)
      addGlowSprite(root, materials.glow, light.x, light.y, light.z, 2.1)
    }

    if (litIds.has(light.id)) {
      const pointLight = new THREE.PointLight(light.color, light.intensity * 3.2, light.distance * 1.8, 1.8)
      pointLight.position.copy(lightPosition)
      pointLight.castShadow = false
      root.add(pointLight)
      pointLights.push(pointLight)
      if (light.flicker) {
        flickers.push({
          light: pointLight,
          base: light.intensity * 3.2,
          phase: index * 1.37,
        })
      }
    }
  })
}

function paletteOf(materials: MaterialLibrary, index: number): CarnivalPaletteMaterials {
  return materials.palette(index)
}

/** Exposed for tests/tooling that want to inspect the authored theme. */
export const CARNIVAL_THEME = CONFIG.theme
