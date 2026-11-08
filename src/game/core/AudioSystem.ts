import type { PlayerRole } from '../../shared/net/contracts'

/**
 * Fully procedural ambience and footsteps (no binary audio assets yet).
 * Started from a user gesture because browsers block autoplay.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private droneGain: GainNode | null = null
  private windGain: GainNode | null = null
  private rumbleGain: GainNode | null = null
  private droneFilter: BiquadFilterNode | null = null
  private started = false
  private paused = false
  private volume = 0.55
  private role: PlayerRole = 'survivor'
  private chimeTimer: ReturnType<typeof setTimeout> | null = null
  private noiseBuffer: AudioBuffer | null = null
  private footLeft = false

  async start(volume: number): Promise<void> {
    this.volume = volume
    if (this.started && this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      return
    }
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    this.ctx = ctx
    try {
      await ctx.resume()
    } catch {
      // The next click will retry via resume().
    }

    this.master = ctx.createGain()
    this.master.gain.value = this.volume * 0.75
    this.master.connect(ctx.destination)

    this.droneFilter = ctx.createBiquadFilter()
    this.droneFilter.type = 'lowpass'
    this.droneFilter.frequency.value = 240
    this.droneFilter.Q.value = 0.8
    this.droneFilter.connect(this.master)

    this.droneGain = ctx.createGain()
    this.droneGain.gain.value = 0.055
    this.droneGain.connect(this.droneFilter)
    this.addDrone(49.5, 'sine', 0.7)
    this.addDrone(74.2, 'triangle', 0.28)
    this.addDrone(98.7, 'sine', 0.12)

    this.noiseBuffer = this.createNoiseBuffer(ctx, 4)
    const wind = ctx.createBufferSource()
    wind.buffer = this.noiseBuffer
    wind.loop = true
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 420
    windFilter.Q.value = 0.65
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0.05
    wind.connect(windFilter)
    windFilter.connect(this.windGain)
    this.windGain.connect(this.master)
    wind.start()

    const rumble = ctx.createOscillator()
    rumble.type = 'sine'
    rumble.frequency.value = 27
    const rumbleFilter = ctx.createBiquadFilter()
    rumbleFilter.type = 'lowpass'
    rumbleFilter.frequency.value = 80
    this.rumbleGain = ctx.createGain()
    this.rumbleGain.gain.value = 0.02
    rumble.connect(rumbleFilter)
    rumbleFilter.connect(this.rumbleGain)
    this.rumbleGain.connect(this.master)
    rumble.start()

    this.started = true
    this.applyRole()
    this.scheduleChime()
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        this.paused ? 0 : this.volume * 0.75,
        this.ctx.currentTime,
        0.08,
      )
    }
  }

  setRole(role: PlayerRole): void {
    this.role = role
    this.applyRole()
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        paused ? 0 : this.volume * 0.75,
        this.ctx.currentTime,
        0.12,
      )
    }
    if (paused) {
      if (this.chimeTimer) clearTimeout(this.chimeTimer)
      this.chimeTimer = null
    } else if (this.started) {
      this.scheduleChime()
    }
  }

  footstep(speed: number, crouching: boolean): void {
    if (!this.ctx || !this.master || this.paused || !this.noiseBuffer) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.playbackRate.value = 0.7 + Math.random() * 0.3
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    this.footLeft = !this.footLeft
    filter.frequency.value = crouching ? 240 : this.footLeft ? 380 : 520
    filter.Q.value = 1.1
    const gain = ctx.createGain()
    const level = (crouching ? 0.018 : 0.035) + Math.min(speed, 6) * 0.007
    gain.gain.setValueAtTime(level, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start(now, Math.random() * 2, 0.12)

    const thump = ctx.createOscillator()
    thump.type = 'sine'
    thump.frequency.setValueAtTime(this.footLeft ? 82 : 68, now)
    const thumpGain = ctx.createGain()
    thumpGain.gain.setValueAtTime(crouching ? 0.012 : 0.03, now)
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
    thump.connect(thumpGain)
    thumpGain.connect(this.master)
    thump.start(now)
    thump.stop(now + 0.1)
  }

  dispose(): void {
    if (this.chimeTimer) clearTimeout(this.chimeTimer)
    this.chimeTimer = null
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined)
    }
    this.ctx = null
    this.master = null
    this.started = false
  }

  private addDrone(frequency: number, type: OscillatorType, level: number): void {
    if (!this.ctx || !this.droneGain) return
    const oscillator = this.ctx.createOscillator()
    oscillator.type = type
    oscillator.frequency.value = frequency
    const gain = this.ctx.createGain()
    gain.gain.value = level
    oscillator.connect(gain)
    gain.connect(this.droneGain)
    oscillator.start()
  }

  private applyRole(): void {
    if (!this.ctx || !this.droneFilter || !this.rumbleGain || !this.windGain) return
    const now = this.ctx.currentTime
    if (this.role === 'killer') {
      this.droneFilter.frequency.setTargetAtTime(150, now, 0.4)
      this.rumbleGain.gain.setTargetAtTime(0.055, now, 0.4)
      this.windGain.gain.setTargetAtTime(0.028, now, 0.4)
    } else {
      this.droneFilter.frequency.setTargetAtTime(260, now, 0.4)
      this.rumbleGain.gain.setTargetAtTime(0.018, now, 0.4)
      this.windGain.gain.setTargetAtTime(0.055, now, 0.4)
    }
  }

  private scheduleChime(): void {
    if (!this.started || this.paused) return
    const delay = 14000 + Math.random() * 12000
    this.chimeTimer = setTimeout(() => {
      this.playDistantChime()
      this.scheduleChime()
    }, delay)
  }

  private playDistantChime(): void {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const notes = [392, 466.16, 587.33]
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency * (0.995 + Math.random() * 0.01)
      const gain = ctx.createGain()
      const start = now + index * 0.45 + Math.random() * 0.1
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.018, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.6)
      const pan = ctx.createStereoPanner()
      pan.pan.value = -0.6 + Math.random() * 1.2
      oscillator.connect(gain)
      gain.connect(pan)
      pan.connect(this.master!)
      oscillator.start(start)
      oscillator.stop(start + 2.8)
    })
  }

  private createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const frames = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) {
      data[i] = Math.random() * 2 - 1
    }
    return buffer
  }
}
