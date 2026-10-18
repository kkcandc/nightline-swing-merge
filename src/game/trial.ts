import {
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three'
import { RINGS, type RingDef } from './course'

const BEST = 'nightline-best-ms-v1'

export function medalFor(ms: number): string {
  if (ms < 110_000) return 'Filament'
  if (ms < 150_000) return 'Lantern'
  return 'Clear'
}

export class Trial {
  index = 0
  time = 0
  running = false
  finished = false
  best: number | null
  justRing = false
  justFinish = false
  private readonly rings: Group[] = []
  private readonly labels: Sprite[] = []
  private readonly beacon: Mesh
  private readonly nextMat: MeshBasicMaterial
  private readonly idleMat: MeshBasicMaterial

  constructor(scene: Scene) {
    let saved = Number.NaN
    try {
      saved = Number(localStorage.getItem(BEST) ?? '')
    } catch {
      saved = Number.NaN
    }
    this.best = Number.isFinite(saved) && saved > 0 ? saved : null
    this.nextMat = new MeshBasicMaterial({ color: 0xb8fff0 })
    this.idleMat = new MeshBasicMaterial({ color: 0x5f7c86, transparent: true, opacity: 0.55 })
    RINGS.forEach((ring, i) => {
      const group = new Group()
      group.position.set(ring.x, ring.y, ring.z)
      const next = RINGS[i + 1]
      const dir = new Vector3(
        (next?.x ?? ring.x) - ring.x,
        (next?.y ?? ring.y + 20) - ring.y,
        (next?.z ?? ring.z) - ring.z,
      )
      if (dir.lengthSq() < 1) dir.set(0, 1, 0)
      dir.normalize()
      group.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), dir)
      const torus = new Mesh(new TorusGeometry(ring.r, 0.18, 8, 28), i === 0 ? this.nextMat : this.idleMat)
      group.add(torus)
      scene.add(group)
      this.rings.push(group)
      const sprite = makeLabel(ring.name)
      sprite.position.set(ring.x, ring.y + ring.r + 3.2, ring.z)
      sprite.visible = i === 0
      scene.add(sprite)
      this.labels.push(sprite)
    })
    this.beacon = new Mesh(
      new CylinderGeometry(0.35, 0.35, 80, 8, 1, true),
      new MeshBasicMaterial({
        color: 0x9dfff0,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: DoubleSide,
      }),
    )
    this.beacon.frustumCulled = false
    scene.add(this.beacon)
    this.placeBeacon()
  }

  reset(): void {
    this.index = 0
    this.time = 0
    this.running = false
    this.finished = false
    this.style()
    this.placeBeacon()
  }

  update(dt: number, pos: Vector3): void {
    this.justRing = false
    this.justFinish = false
    const spin = this.rings[this.index]?.children[0]
    if (spin) spin.rotation.z += dt * 0.8
    if (this.running && !this.finished) this.time += dt
    const ring = RINGS[this.index]
    if (!ring || this.finished) return
    const d = Math.hypot(pos.x - ring.x, pos.y + 1.1 - ring.y, pos.z - ring.z)
    if (d < ring.r) this.advance()
  }

  private advance(): void {
    this.index += 1
    this.justRing = true
    if (!this.running) this.running = true
    if (this.index >= RINGS.length) {
      this.finished = true
      this.running = false
      this.justFinish = true
      const ms = this.time * 1000
      if (this.best === null || ms < this.best) {
        this.best = ms
        try {
          localStorage.setItem(BEST, String(Math.round(ms)))
        } catch {
          /* ignore blocked storage */
        }
      }
    }
    this.style()
    this.placeBeacon()
  }

  private style(): void {
    this.rings.forEach((group, i) => {
      const mesh = group.children[0] as Mesh
      mesh.material = i === this.index ? this.nextMat : this.idleMat
      group.visible = i >= this.index
      const label = this.labels[i]
      if (label) label.visible = i === this.index
    })
    this.beacon.visible = this.index < RINGS.length
  }

  private placeBeacon(): void {
    const ring = RINGS[this.index]
    if (!ring) return
    this.beacon.position.set(ring.x, ring.y + 36, ring.z)
  }

  get current(): RingDef | undefined {
    return RINGS[this.index]
  }
}

function makeLabel(text: string): Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const g = canvas.getContext('2d')
  if (g) {
    g.clearRect(0, 0, 512, 128)
    g.font = '600 56px Georgia, serif'
    g.fillStyle = '#f3ecdf'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 256, 64)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = 'srgb'
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  sprite.scale.set(18, 4.5, 1)
  return sprite
}
