export interface InputCallbacks {
  onPointerLockChange?: (locked: boolean) => void
  onEscape?: () => void
  onWindowBlur?: () => void
  onKeyDown?: (code: string, event: KeyboardEvent) => void
}

export interface LookDelta {
  dx: number
  dy: number
}

/**
 * Keyboard/mouse input with pointer lock. Mouse deltas are accumulated and
 * consumed exactly once per rendered frame by the active camera rig.
 */
export class Input {
  private readonly canvas: HTMLCanvasElement
  private readonly callbacks: InputCallbacks
  private readonly down = new Set<string>()
  private readonly pressed = new Set<string>()
  private lookX = 0
  private lookY = 0
  private wheel = 0
  private locked = false
  private disposed = false
  private readonly abort = new AbortController()

  constructor(canvas: HTMLCanvasElement, callbacks: InputCallbacks = {}) {
    this.canvas = canvas
    this.callbacks = callbacks
    const options = { signal: this.abort.signal }

    window.addEventListener('keydown', this.onKeyDown, options)
    window.addEventListener('keyup', this.onKeyUp, options)
    window.addEventListener('blur', this.onBlur, options)
    document.addEventListener('pointerlockchange', this.onPointerLockChange, options)
    document.addEventListener('mousemove', this.onMouseMove, options)
    this.canvas.addEventListener('wheel', this.onWheel, { ...options, passive: false })
    this.canvas.addEventListener('mousedown', this.onMouseDown, options)
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault(), options)
  }

  get pointerLocked(): boolean {
    return this.locked
  }

  requestPointerLock(): Promise<void> {
    if (this.locked) return Promise.resolve()
    try {
      const result = this.canvas.requestPointerLock()
      return result instanceof Promise ? result : Promise.resolve()
    } catch (error) {
      return Promise.reject(error)
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
  }

  isDown(code: string): boolean {
    return this.down.has(code)
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code)
  }

  consumeLook(): LookDelta {
    const dx = this.lookX
    const dy = this.lookY
    this.lookX = 0
    this.lookY = 0
    return { dx, dy }
  }

  consumeWheel(): number {
    const wheel = this.wheel
    this.wheel = 0
    return wheel
  }

  /** Call after the fixed-step update so one-shot presses do not repeat. */
  endFrame(): void {
    this.pressed.clear()
  }

  clear(): void {
    this.down.clear()
    this.pressed.clear()
    this.lookX = 0
    this.lookY = 0
    this.wheel = 0
  }

  get movementAxes(): { forward: number; right: number } {
    let forward = 0
    let right = 0
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) forward += 1
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) forward -= 1
    if (this.down.has('KeyD') || this.down.has('ArrowRight')) right += 1
    if (this.down.has('KeyA') || this.down.has('ArrowLeft')) right -= 1
    return { forward, right }
  }

  get sprinting(): boolean {
    return this.down.has('ShiftLeft') || this.down.has('ShiftRight')
  }

  get crouching(): boolean {
    return this.down.has('ControlLeft') || this.down.has('ControlRight') || this.down.has('KeyC')
  }

  get interacting(): boolean {
    return this.down.has('KeyE')
  }

  get panning(): boolean {
    return this.down.has('AltLeft') || this.down.has('AltRight')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.abort.abort()
    this.clear()
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      this.callbacks.onEscape?.()
    }
    if (event.code === 'Tab') return
    if (!event.repeat) this.pressed.add(event.code)
    this.down.add(event.code)
    if (
      event.code === 'AltLeft' ||
      event.code === 'AltRight' ||
      event.code === 'F2' ||
      event.code === 'F3' ||
      event.code.startsWith('Arrow')
    ) {
      event.preventDefault()
    }
    this.callbacks.onKeyDown?.(event.code, event)
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.down.delete(event.code)
  }

  private onBlur = () => {
    this.clear()
    this.callbacks.onWindowBlur?.()
  }

  private onPointerLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas
    if (!this.locked) {
      this.lookX = 0
      this.lookY = 0
    }
    this.callbacks.onPointerLockChange?.(this.locked)
  }

  private onMouseMove = (event: MouseEvent) => {
    if (!this.locked) return
    this.lookX += event.movementX
    this.lookY += event.movementY
  }

  private onWheel = (event: WheelEvent) => {
    if (!this.locked) return
    event.preventDefault()
    this.wheel += event.deltaY
  }

  private onMouseDown = (event: MouseEvent) => {
    if (event.button === 1) event.preventDefault()
  }
}
