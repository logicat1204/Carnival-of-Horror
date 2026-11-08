import * as THREE from 'three'
import {
  makeDirtTexture,
  makeGlowTexture,
  makeGravelTexture,
  makeSignTexture,
  makeStripeTexture,
  makeTentValanceTexture,
  makeWoodTexture,
} from './ProceduralTextures'

export interface CarnivalPalette {
  id: string
  primary: string
  secondary: string
  trim: string
  accent: string
}

export const CARNIVAL_PALETTES: readonly CarnivalPalette[] = [
  { id: 'crimson', primary: '#7d1f2e', secondary: '#d9c7a4', trim: '#e0b15c', accent: '#3a1017' },
  { id: 'teal', primary: '#1f4f4f', secondary: '#c9b58f', trim: '#d7a94e', accent: '#122a2a' },
  { id: 'violet', primary: '#3d2555', secondary: '#d8c39c', trim: '#c89b4a', accent: '#1d102a' },
  { id: 'olive', primary: '#4b3f22', secondary: '#c3aa7c', trim: '#b9863e', accent: '#241d0f' },
  { id: 'midnight', primary: '#233a5e', secondary: '#c9b28c', trim: '#d8b15f', accent: '#101c2e' },
] as const

export interface PaletteMaterials {
  primary: string
  secondary: string
  trimColor: string
  accent: string
  wall: THREE.MeshStandardMaterial
  roof: THREE.MeshStandardMaterial
  valance: THREE.MeshStandardMaterial
  trim: THREE.MeshStandardMaterial
}

export class MaterialLibrary {
  readonly palettes: PaletteMaterials[]
  readonly dirt: THREE.MeshStandardMaterial
  readonly gravel: THREE.MeshStandardMaterial
  readonly wood: THREE.MeshStandardMaterial
  readonly darkWood: THREE.MeshStandardMaterial
  readonly metal: THREE.MeshStandardMaterial
  readonly rust: THREE.MeshStandardMaterial
  readonly canvasDark: THREE.MeshStandardMaterial
  readonly stone: THREE.MeshStandardMaterial
  readonly glass: THREE.MeshStandardMaterial
  readonly water: THREE.MeshStandardMaterial
  readonly rope: THREE.MeshStandardMaterial
  readonly black: THREE.MeshStandardMaterial
  readonly paper: THREE.MeshStandardMaterial
  readonly glow: THREE.SpriteMaterial

  private readonly textures: THREE.Texture[] = []
  private readonly signCache = new Map<string, THREE.MeshStandardMaterial>()
  private readonly emissiveCache = new Map<string, THREE.MeshStandardMaterial>()

  constructor() {
    const dirtTexture = this.track(makeDirtTexture('#241f19', '#5a4a35'))
    const gravelTexture = this.track(makeGravelTexture('#3c3529', '#7b6b51'))
    const woodTexture = this.track(makeWoodTexture())
    const glowTexture = this.track(makeGlowTexture())

    this.dirt = new THREE.MeshStandardMaterial({ map: dirtTexture, roughness: 0.97, metalness: 0.02 })
    this.gravel = new THREE.MeshStandardMaterial({ map: gravelTexture, roughness: 0.95, metalness: 0 })
    this.wood = new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.88, metalness: 0.02 })
    this.darkWood = new THREE.MeshStandardMaterial({ map: woodTexture, color: '#6b5544', roughness: 0.92 })
    this.metal = new THREE.MeshStandardMaterial({ color: '#4c4a4a', roughness: 0.55, metalness: 0.65 })
    this.rust = new THREE.MeshStandardMaterial({ color: '#6b3b28', roughness: 0.82, metalness: 0.35 })
    this.canvasDark = new THREE.MeshStandardMaterial({ color: '#1b1416', roughness: 0.98, side: THREE.DoubleSide })
    this.stone = new THREE.MeshStandardMaterial({ color: '#4d473f', roughness: 0.94 })
    this.glass = new THREE.MeshStandardMaterial({
      color: '#8fb0b2',
      roughness: 0.18,
      metalness: 0.25,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    })
    this.water = new THREE.MeshStandardMaterial({ color: '#0a1114', roughness: 0.18, metalness: 0.8 })
    this.rope = new THREE.MeshStandardMaterial({ color: '#8a7552', roughness: 1 })
    this.black = new THREE.MeshStandardMaterial({ color: '#0c0a0b', roughness: 0.9 })
    this.paper = new THREE.MeshStandardMaterial({ color: '#b9a98a', roughness: 1, side: THREE.DoubleSide })
    this.glow = new THREE.SpriteMaterial({
      map: glowTexture,
      color: '#ffbf73',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.palettes = CARNIVAL_PALETTES.map((palette) => {
      const stripe = this.track(makeStripeTexture(palette.primary, palette.secondary, 10))
      const valanceTexture = this.track(makeTentValanceTexture(palette.primary, palette.trim))
      return {
        primary: palette.primary,
        secondary: palette.secondary,
        trimColor: palette.trim,
        accent: palette.accent,
        wall: new THREE.MeshStandardMaterial({
          map: stripe,
          roughness: 0.94,
          metalness: 0,
          side: THREE.DoubleSide,
        }),
        roof: new THREE.MeshStandardMaterial({
          map: stripe,
          roughness: 0.9,
          metalness: 0.02,
          side: THREE.DoubleSide,
        }),
        valance: new THREE.MeshStandardMaterial({
          map: valanceTexture,
          roughness: 0.9,
          side: THREE.DoubleSide,
          transparent: false,
        }),
        trim: new THREE.MeshStandardMaterial({ color: palette.trim, roughness: 0.62, metalness: 0.15 }),
      }
    })
  }

  palette(index: number): PaletteMaterials {
    return this.palettes[((index % this.palettes.length) + this.palettes.length) % this.palettes.length]
  }

  sign(text: string, accent: string): THREE.MeshStandardMaterial {
    const key = `${text}::${accent}`
    const cached = this.signCache.get(key)
    if (cached) return cached
    const texture = this.track(makeSignTexture(text, accent))
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.72,
      metalness: 0.05,
      emissive: new THREE.Color(accent),
      emissiveIntensity: 0.08,
      side: THREE.DoubleSide,
    })
    this.signCache.set(key, material)
    return material
  }

  emissive(color: string, intensity = 1): THREE.MeshStandardMaterial {
    const key = `${color}::${intensity}`
    const cached = this.emissiveCache.get(key)
    if (cached) return cached
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: intensity,
      roughness: 0.4,
      metalness: 0.1,
    })
    this.emissiveCache.set(key, material)
    return material
  }

  private track<T extends THREE.Texture>(texture: T): T {
    this.textures.push(texture)
    return texture
  }

  dispose(): void {
    for (const texture of this.textures) texture.dispose()
    this.textures.length = 0
    for (const material of Object.values(this)) {
      if (material instanceof THREE.Material) material.dispose()
    }
    for (const palette of this.palettes) {
      palette.wall.dispose()
      palette.roof.dispose()
      palette.valance.dispose()
      palette.trim.dispose()
    }
    for (const material of this.signCache.values()) material.dispose()
    for (const material of this.emissiveCache.values()) material.dispose()
    this.signCache.clear()
    this.emissiveCache.clear()
  }
}
