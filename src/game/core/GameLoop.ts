import { FIXED_DT, MAX_CATCHUP_STEPS } from '../../shared/constants'

export interface LoopStats {
  fps: number
  frameMs: number
  tick: number
}

/**
 * Fixed-step simulation + free-running render loop.
 * The authoritative server runs the same fixed step at 60 Hz.
 */
export class GameLoop {
  private frameHandle = 0
  private lastTime = 0
  private accumulator = 0
  private tick = 0
  private running = false
  private readonly step: (dt: number) => void
  private readonly render: (alpha: number, elapsed: number) => void
  private readonly onStats?: (stats: LoopStats) => void
  private frames = 0
  private statsElapsed = 0
  private lastFrameMs = 0

  constructor(
    step: (dt: number) => void,
    render: (alpha: number, elapsed: number) => void,
    onStats?: (stats: LoopStats) => void,
  ) {
    this.step = step
    this.render = render
    this.onStats = onStats
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.accumulator = 0
    this.frameHandle = requestAnimationFrame(this.frame)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.frameHandle)
  }

  get elapsedTicks(): number {
    return this.tick
  }

  private frame = (now: number) => {
    if (!this.running) return
    const frameStart = performance.now()
    const delta = Math.min((now - this.lastTime) / 1000, 0.25)
    this.lastTime = now
    this.accumulator += delta

    let steps = 0
    while (this.accumulator >= FIXED_DT && steps < MAX_CATCHUP_STEPS) {
      this.step(FIXED_DT)
      this.accumulator -= FIXED_DT
      this.tick++
      steps++
    }
    if (steps === MAX_CATCHUP_STEPS && this.accumulator > FIXED_DT) {
      // Drop the backlog instead of spiralling on slow hardware.
      this.accumulator = 0
    }

    this.render(this.accumulator / FIXED_DT, now / 1000)
    this.lastFrameMs = performance.now() - frameStart

    this.frames++
    this.statsElapsed += delta
    if (this.statsElapsed >= 0.5) {
      if (this.onStats) {
        this.onStats({
          fps: this.frames / this.statsElapsed,
          frameMs: this.lastFrameMs,
          tick: this.tick,
        })
      }
      this.frames = 0
      this.statsElapsed = 0
    }

    this.frameHandle = requestAnimationFrame(this.frame)
  }
}
