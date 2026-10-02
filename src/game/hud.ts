export type HudMode = 'menu' | 'play' | 'pause'

export type HudFrame = {
  speed: number
  gliding: boolean
  diving: boolean
  attached: boolean
  stamina: number
  orbs: number
  orbTotal: number
  chain: number
  hint: string
  landmark: string
  time: number
  best: number | null
  running: boolean
  finished: boolean
  medal: string
  fps: number
  showFps: boolean
  px: number
  pz: number
  yaw: number
  rings: { x: number; z: number; next: boolean; done: boolean }[]
  dots: { x: number; z: number; got: boolean }[]
}

type Actions = {
  play: () => void
  resume: () => void
  restart: () => void
  resetOrbs: () => void
  toggleMute: () => void
  toggleRain: () => void
  sensitivity: (value: number) => void
}

export class Hud {
  private readonly map: HTMLCanvasElement
  private readonly mapCtx: CanvasRenderingContext2D
  private toastTimer = 0
  private lastToast = ''

  constructor(actions: Actions) {
    this.map = must('#map')
    const ctx = this.map.getContext('2d')
    if (!ctx) throw new Error('Map canvas unavailable')
    this.mapCtx = ctx
    must<HTMLButtonElement>('#play').addEventListener('click', () => actions.play())
    must<HTMLButtonElement>('#resume').addEventListener('click', () => actions.resume())
    must<HTMLButtonElement>('#restart').addEventListener('click', () => actions.restart())
    must<HTMLButtonElement>('#reset-orbs').addEventListener('click', () => actions.resetOrbs())
    must<HTMLButtonElement>('#mute').addEventListener('click', () => actions.toggleMute())
    must<HTMLButtonElement>('#rain').addEventListener('click', () => actions.toggleRain())
    must<HTMLInputElement>('#sens').addEventListener('input', (event) => {
      actions.sensitivity(Number((event.target as HTMLInputElement).value))
    })
    const coarse = window.matchMedia('(pointer: coarse)').matches
    must('#touch-note').hidden = !coarse
  }

  setMode(mode: HudMode): void {
    must('#menu').hidden = mode !== 'menu'
    must('#hud').hidden = mode === 'menu'
    must('#pause').hidden = mode !== 'pause'
    must('#crosshair').hidden = mode !== 'play'
    must('#brand').hidden = mode === 'menu'
  }

  setToggles(muted: boolean, rain: boolean): void {
    must('#mute').textContent = muted ? 'Sound off' : 'Sound on'
    must('#rain').textContent = rain ? 'Rain on' : 'Rain off'
  }

  showBest(best: number | null): void {
    must('#menu-best').textContent = best === null ? 'No circuit time yet.' : `Best circuit ${format(best / 1000)}`
  }

  toast(text: string): void {
    if (!text || text === this.lastToast) return
    this.lastToast = text
    this.toastTimer = 1.5
    const el = must('#toast')
    el.textContent = text
    el.classList.add('show')
  }

  tick(dt: number): void {
    if (this.toastTimer <= 0) return
    this.toastTimer -= dt
    if (this.toastTimer <= 0) {
      must('#toast').classList.remove('show')
      this.lastToast = ''
    }
  }

  update(frame: HudFrame): void {
    must('#speed').textContent = String(Math.round(frame.speed * 3.6))
    must('#state').textContent = frame.attached ? 'LINE' : frame.diving ? 'DIVE' : frame.gliding ? 'CAPE' : 'RUN'
    const bar = must<HTMLElement>('#stamina')
    bar.style.transform = `scaleX(${Math.max(0, Math.min(1, frame.stamina))})`
    must('#orbs').textContent = `${frame.orbs}/${frame.orbTotal}`
    must('#chain').textContent = frame.chain > 1 ? `Chain ${frame.chain}` : ''
    must('#hint').textContent = frame.hint
    must('#landmark').textContent = frame.finished ? 'Circuit clear' : frame.landmark
    must('#clock').textContent = frame.running || frame.finished ? format(frame.time) : '—:—'
    must('#best').textContent = frame.best === null ? 'BEST —' : `BEST ${format(frame.best / 1000)}`
    const banner = must('#banner')
    if (frame.finished) {
      banner.hidden = false
      banner.textContent = `${frame.medal}  ${format(frame.time)}`
    } else banner.hidden = true
    const fps = must('#fps')
    fps.hidden = !frame.showFps
    if (frame.showFps) fps.textContent = `${frame.fps.toFixed(0)} fps`
    this.drawMap(frame)
  }

  private drawMap(frame: HudFrame): void {
    const ctx = this.mapCtx
    const w = this.map.width
    const h = this.map.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(8, 7, 14, 0.72)'
    ctx.fillRect(0, 0, w, h)
    const scale = w / 860
    const X = (x: number) => w / 2 + x * scale
    const Z = (z: number) => h / 2 + z * scale
    ctx.strokeStyle = 'rgba(138, 246, 255, 0.18)'
    ctx.strokeRect(X(-390), Z(-390), 780 * scale, 780 * scale)
    ctx.fillStyle = 'rgba(70, 140, 160, 0.35)'
    ctx.fillRect(X(-390), Z(102), 780 * scale, 72 * scale)
    for (const dot of frame.dots) {
      ctx.fillStyle = dot.got ? 'rgba(255,255,255,0.15)' : '#d8fff4'
      ctx.fillRect(X(dot.x) - 1.5, Z(dot.z) - 1.5, 3, 3)
    }
    for (const ring of frame.rings) {
      ctx.strokeStyle = ring.next ? '#b8fff0' : ring.done ? 'rgba(255,255,255,0.15)' : 'rgba(127, 190, 200, 0.45)'
      ctx.beginPath()
      ctx.arc(X(ring.x), Z(ring.z), ring.next ? 4 : 2.5, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.save()
    ctx.translate(X(frame.px), Z(frame.pz))
    ctx.rotate(-frame.yaw)
    ctx.fillStyle = '#ffb067'
    ctx.beginPath()
    ctx.moveTo(0, -5)
    ctx.lineTo(3.5, 4)
    ctx.lineTo(-3.5, 4)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

function format(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.max(0, seconds - m * 60)
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}

function must<T extends HTMLElement>(sel: string): T {
  const el = document.querySelector(sel)
  if (!el) throw new Error(`Missing ${sel}`)
  return el as T
}
