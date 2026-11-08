import * as THREE from 'three'
import type { QualityLevel } from '../../shared/settings'

/**
 * Owns the WebGL renderer, scene and camera. Gameplay never touches renderer
 * internals except through applyQuality()/render().
 */
export class Viewport {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  private readonly container: HTMLElement
  private readonly resizeObserver: ResizeObserver
  private quality: QualityLevel

  constructor(container: HTMLElement, quality: QualityLevel) {
    this.container = container
    this.quality = quality
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.shadowMap.enabled = quality !== 'low'
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.className = 'game-canvas'
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.05, 230)
    this.camera.rotation.order = 'YXZ'

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    window.addEventListener('resize', this.resize)
    this.applyQuality(quality)
    this.resize()
  }

  applyQuality(quality: QualityLevel): void {
    this.quality = quality
    this.renderer.shadowMap.enabled = quality !== 'low'
    this.renderer.setPixelRatio(
      quality === 'high'
        ? Math.min(window.devicePixelRatio || 1, 2)
        : quality === 'medium'
          ? Math.min(window.devicePixelRatio || 1, 1.5)
          : 1,
    )
    this.resize()
  }

  get currentQuality(): QualityLevel {
    return this.quality
  }

  resize = (): void => {
    const width = this.container.clientWidth || window.innerWidth
    const height = this.container.clientHeight || window.innerHeight
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.resizeObserver.disconnect()
    window.removeEventListener('resize', this.resize)
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
