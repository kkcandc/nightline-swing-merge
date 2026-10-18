import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Vector3,
  type PerspectiveCamera,
} from 'three'
import { clamp } from './look'
import type { Player } from './player'

const TRAIL = 18
const DUST = 12

const side = new Vector3()
const dir = new Vector3()
const toCam = new Vector3()

/**
 * How deep the pendulum is in the fast, flat part of the arc.
 * 1 when the courier is low under the anchor and moving mostly sideways.
 */
export function swingArc(player: Player): number {
  if (!player.attached) return 0
  const drop = player.anchor.y - (player.pos.y + 1.2)
  const rope = Math.max(8, player.rope.length)
  const hang = clamp(drop / rope, 0, 1)
  const speed = player.vel.length()
  const horiz = Math.hypot(player.vel.x, player.vel.z)
  const vertical = Math.abs(player.vel.y) / (speed + 0.01)
  const low = hang > 0.35 ? clamp((hang - 0.35) / 0.45, 0, 1) : 0
  const flat = 1 - clamp((vertical - 0.08) / 0.4, 0, 1)
  const fast = clamp((horiz - 14) / 24, 0, 1)
  return low * flat * fast
}

/** Attach snap, arc-bottom stretch, release streak, and landing dust. */
export class SwingJuice {
  readonly trail: Mesh
  readonly dust: Group
  readonly flash: Mesh
  readonly ghostFrom = new Vector3()
  readonly ghostTo = new Vector3()
  readonly ghostDraw = new Vector3()
  pulse = 0
  release = 0
  arc = 0
  ghostLife = 0

  private readonly trailPos: Float32Array
  private readonly trailMat: MeshBasicMaterial
  private readonly flashMat: MeshBasicMaterial
  private readonly pts: Vector3[] = []
  private count = 0
  private flashLife = 0
  private readonly ghostVel = new Vector3()
  private readonly bits: { mesh: Mesh; vel: Vector3; life: number; max: number }[] = []

  constructor() {
    this.trailPos = new Float32Array(TRAIL * 2 * 3)
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(this.trailPos, 3))
    const index: number[] = []
    for (let i = 0; i < TRAIL - 1; i++) {
      const a = i * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    geo.setIndex(index)
    this.trailMat = new MeshBasicMaterial({
      color: 0xc6fbff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    })
    this.trail = new Mesh(geo, this.trailMat)
    this.trail.frustumCulled = false
    this.trail.renderOrder = 3
    this.trail.visible = false
    for (let i = 0; i < TRAIL; i++) this.pts.push(new Vector3())

    this.flashMat = new MeshBasicMaterial({
      color: 0xf4feff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
    this.flash = new Mesh(new OctahedronGeometry(0.7, 0), this.flashMat)
    this.flash.frustumCulled = false
    this.flash.renderOrder = 4
    this.flash.visible = false

    this.dust = new Group()
    const puff = new PlaneGeometry(1, 1)
    for (let i = 0; i < DUST; i++) {
      const mat = new MeshBasicMaterial({
        color: i % 2 === 0 ? 0xd9d2c6 : 0xb7c6ce,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: DoubleSide,
        fog: false,
      })
      const mesh = new Mesh(puff, mat)
      mesh.visible = false
      mesh.frustumCulled = false
      mesh.renderOrder = 3
      this.dust.add(mesh)
      this.bits.push({ mesh, vel: new Vector3(), life: 0, max: 1 })
    }
  }

  sync(player: Player): void {
    this.arc = swingArc(player)
  }

  onAttach(anchor: Vector3): void {
    this.pulse = 1
    this.flashLife = 0.28
    this.flash.visible = true
    this.flash.position.copy(anchor)
    this.count = 0
  }

  onRelease(from: Vector3, to: Vector3, vel: Vector3): void {
    this.ghostFrom.copy(from)
    this.ghostTo.copy(to)
    this.ghostDraw.copy(from)
    this.ghostVel.copy(vel)
    this.ghostLife = 0.42
    this.release = 1
    this.pulse = 0
  }

  onLand(origin: Vector3, impact: number): void {
    for (let i = 0; i < this.bits.length; i++) {
      const bit = this.bits[i]!
      const angle = (i / this.bits.length) * Math.PI * 2 + Math.random() * 0.4
      const speed = (2.4 + Math.random() * 4.2) * (0.4 + impact)
      bit.vel.set(Math.cos(angle) * speed, 1.6 + Math.random() * 3.4 * (0.35 + impact), Math.sin(angle) * speed)
      bit.life = 0.34 + Math.random() * 0.16
      bit.max = bit.life
      bit.mesh.visible = true
      bit.mesh.position.copy(origin)
      bit.mesh.position.y += 0.2
      bit.mesh.scale.setScalar(0.28 + impact * 1.15 + (i % 3) * 0.12)
      const mat = bit.mesh.material as MeshBasicMaterial
      mat.opacity = 0.15 + impact * 0.7
    }
  }

  update(dt: number, player: Player, hand: Vector3, camera: PerspectiveCamera): void {
    this.pulse = Math.max(0, this.pulse - dt * 3.5)
    this.release = Math.max(0, this.release - dt * 2.15)
    if (this.ghostLife > 0) {
      this.ghostLife = Math.max(0, this.ghostLife - dt)
      const peeled = 0.42 - this.ghostLife
      this.ghostDraw.copy(this.ghostFrom).addScaledVector(this.ghostVel, peeled * 0.28)
      this.ghostDraw.y -= peeled * 7
    }

    if (player.attached) {
      if (this.count === 0 || this.pts[0]!.distanceTo(hand) > 0.42) {
        for (let i = TRAIL - 1; i > 0; i--) this.pts[i]!.copy(this.pts[i - 1]!)
        this.pts[0]!.copy(hand)
        this.count = Math.min(TRAIL, this.count + 1)
      }
    } else if (this.release <= 0) {
      this.count = 0
    }

    this.writeTrail(player, camera)
    this.writeFlash(dt)
    this.writeDust(dt, camera)
  }

  lineWidth(): number {
    const ring = 1 + Math.sin(this.pulse * 21) * this.pulse * 0.28
    return (1 + this.pulse * 2.5 + this.arc * 1.45) * ring
  }

  lineSag(base: number): number {
    const tight = Math.min(1, this.pulse * 0.96 + this.arc * 0.82)
    const ring = Math.sin(this.pulse * 24) * this.pulse * 0.65
    return Math.max(0, base * (1 - tight) + ring)
  }

  lineHeat(): number {
    return Math.min(1, this.pulse + this.arc * 0.9)
  }

  private writeTrail(player: Player, camera: PerspectiveCamera): void {
    const show = this.count > 2 && (this.release > 0 || (player.attached && this.arc > 0.22))
    this.trail.visible = show
    if (!show) return
    const width = (0.14 + this.arc * 0.72) * (player.attached ? 1 : 1 + this.release * 2.4)
    this.trailMat.opacity = player.attached ? 0.2 + this.arc * 0.75 : Math.min(0.95, this.release)
    const cam = camera.position
    for (let i = 0; i < TRAIL; i++) {
      const p = this.pts[Math.min(i, this.count - 1)]!
      const next = this.pts[Math.min(i + 1, this.count - 1)]!
      dir.subVectors(p, next)
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0)
      else dir.normalize()
      toCam.subVectors(cam, p)
      side.crossVectors(dir, toCam)
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
      else side.normalize()
      const fade = 1 - i / (TRAIL - 1)
      const w = width * (0.2 + fade)
      const o = i * 6
      this.trailPos[o] = p.x + side.x * w
      this.trailPos[o + 1] = p.y + side.y * w
      this.trailPos[o + 2] = p.z + side.z * w
      this.trailPos[o + 3] = p.x - side.x * w
      this.trailPos[o + 4] = p.y - side.y * w
      this.trailPos[o + 5] = p.z - side.z * w
    }
    const attr = this.trail.geometry.getAttribute('position') as BufferAttribute
    attr.needsUpdate = true
  }

  private writeFlash(dt: number): void {
    if (this.flashLife <= 0) {
      this.flash.visible = false
      return
    }
    this.flashLife = Math.max(0, this.flashLife - dt)
    const t = this.flashLife / 0.28
    this.flash.visible = t > 0.02
    this.flash.scale.setScalar(1.4 + (1 - t) * 8.5)
    this.flashMat.opacity = t * 0.95
  }

  private writeDust(dt: number, camera: PerspectiveCamera): void {
    for (const bit of this.bits) {
      if (bit.life <= 0) {
        bit.mesh.visible = false
        continue
      }
      bit.life = Math.max(0, bit.life - dt)
      bit.vel.y -= 10 * dt
      bit.mesh.position.addScaledVector(bit.vel, dt)
      bit.mesh.lookAt(camera.position)
      const k = bit.life / bit.max
      const mat = bit.mesh.material as MeshBasicMaterial
      mat.opacity = k * 0.78
      const base = bit.mesh.scale.x
      bit.mesh.scale.setScalar(base + dt * 1.4)
    }
  }
}
