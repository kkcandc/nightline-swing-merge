export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private wind: GainNode | null = null
  muted = false

  start(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.value = 0.8
    master.connect(ctx.destination)

    const bed = ctx.createGain()
    bed.gain.value = 0.03
    bed.connect(master)
    const a = ctx.createOscillator()
    const b = ctx.createOscillator()
    a.type = 'sine'
    b.type = 'triangle'
    a.frequency.value = 55
    b.frequency.value = 82.4
    a.connect(bed)
    b.connect(bed)
    a.start()
    b.start()

    const frames = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 700
    const wind = ctx.createGain()
    wind.gain.value = 0
    noise.connect(filter)
    filter.connect(wind)
    wind.connect(master)
    noise.start()

    this.ctx = ctx
    this.master = master
    this.wind = wind
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05)
  }

  setSpeed(speed: number): void {
    if (!this.wind || !this.ctx || this.muted) return
    const target = Math.min(0.16, Math.max(0, speed - 6) / 220)
    this.wind.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12)
  }

  attach(): void {
    this.noise(0.09, 900, 0.18)
    this.tone(240, 0.09, 'triangle', 0.08)
  }

  release(): void {
    this.tone(160, 0.12, 'sine', 0.05)
  }

  whiff(): void {
    this.noise(0.05, 1400, 0.05)
  }

  orb(): void {
    this.tone(680, 0.08, 'sine', 0.06)
    this.tone(920, 0.12, 'sine', 0.04)
  }

  ring(): void {
    this.tone(440, 0.18, 'sine', 0.06)
    this.tone(554, 0.2, 'triangle', 0.04)
    this.tone(659, 0.24, 'sine', 0.035)
  }

  finish(): void {
    ;[523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.28 + i * 0.05, 'triangle', 0.05))
  }

  bell(): void {
    this.tone(196, 1.4, 'sine', 0.04)
    this.tone(392, 1.1, 'sine', 0.02)
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number): void {
    if (!this.ctx || !this.master || this.muted) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noise(dur: number, freq: number, gain: number): void {
    if (!this.ctx || !this.master || this.muted) return
    const t = this.ctx.currentTime
    const frames = Math.floor(this.ctx.sampleRate * dur)
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(t)
  }
}
