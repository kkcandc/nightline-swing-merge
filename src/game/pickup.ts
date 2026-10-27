import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  TorusGeometry,
  Vector3,
  type PerspectiveCamera,
} from 'three'

const SPARKS = 18

type Spark = {
  mesh: Mesh
  dir: Vector3
  origin: Vector3
  life: number
  max: number
  reach: number
  travel: boolean
}

/** Signal orbs collapse into a short burst when they merge into the score. */
export class PickupJuice {
  readonly group = new Group()
  private readonly bits: Spark[] = []
  private readonly ring: Mesh
  private readonly ringMat: MeshBasicMaterial
  private ringLife = 0
  private ringMax = 0.48
  private ringStill = false

  constructor() {
    const geo = new OctahedronGeometry(0.28, 0)
    for (let i = 0; i < SPARKS; i++) {
      const mat = new MeshBasicMaterial({
        color: 0xe7fffb,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        fog: false,
      })
      const mesh = new Mesh(geo, mat)
      mesh.visible = false
      mesh.frustumCulled = false
      mesh.renderOrder = 5
      this.group.add(mesh)
      this.bits.push({
        mesh,
        dir: new Vector3(0, 1, 0),
        origin: new Vector3(),
        life: 0,
        max: 1,
        reach: 1,
        travel: false,
      })
    }
    this.ringMat = new MeshBasicMaterial({
      color: 0xbffcf6,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    })
    this.ring = new Mesh(new TorusGeometry(1, 0.045, 6, 22), this.ringMat)
    this.ring.visible = false
    this.ring.frustumCulled = false
    this.ring.renderOrder = 5
    this.group.add(this.ring)
  }

  burst(x: number, y: number, z: number, chain: number): void {
    const reduced = motionReduced()
    const want = reduced ? 1 : Math.min(SPARKS, 10 + Math.min(8, Math.max(0, chain - 1) * 2))
    const idle = this.bits.filter((bit) => bit.life <= 0)
    const use = idle.length >= want ? idle.slice(0, want) : this.bits.slice(0, want)
    for (let i = 0; i < use.length; i++) {
      const bit = use[i]!
      bit.origin.set(x, y, z)
      bit.life = reduced ? 0.32 : 0.62
      bit.max = bit.life
      bit.travel = !reduced
      bit.reach = reduced ? 0 : 2.1 + Math.random() * 2.4 + Math.min(chain, 8) * 0.22
      aim(bit.dir, i, use.length)
      bit.mesh.visible = true
      bit.mesh.position.copy(bit.origin)
      bit.mesh.scale.setScalar(reduced ? 0.85 : 0.35)
      const mat = bit.mesh.material as MeshBasicMaterial
      mat.color.setHex(sparkColor(chain, i))
      mat.opacity = reduced ? 0.9 : 0.95
    }
    this.ring.position.set(x, y, z)
    this.ringStill = reduced
    this.ringMax = reduced ? 0.32 : 0.5
    this.ringLife = this.ringMax
    this.ring.visible = true
    this.ring.scale.setScalar(reduced ? 1.15 : 0.2)
    this.ringMat.color.setHex(chain >= 4 ? 0xffc98a : 0xc8fff6)
    this.ringMat.opacity = 0.9
  }

  update(dt: number, camera: PerspectiveCamera): void {
    for (const bit of this.bits) {
      if (bit.life <= 0) continue
      bit.life = Math.max(0, bit.life - dt)
      if (bit.life <= 0) {
        bit.mesh.visible = false
        continue
      }
      const t = 1 - bit.life / bit.max
      const mat = bit.mesh.material as MeshBasicMaterial
      if (!bit.travel) {
        bit.mesh.position.copy(bit.origin)
        bit.mesh.scale.setScalar(0.9)
        mat.opacity = t < 0.12 ? t / 0.12 : bit.life / bit.max
        continue
      }
      let radius: number
      if (t < 0.18) radius = 1.25 * (1 - t / 0.18)
      else radius = ((t - 0.18) / 0.82) * bit.reach
      bit.mesh.position.copy(bit.origin).addScaledVector(bit.dir, radius)
      const swell = t < 0.18 ? 0.2 + t * 3 : 0.85 * (0.35 + bit.life / bit.max)
      bit.mesh.scale.setScalar(swell)
      mat.opacity = Math.min(1, bit.life / bit.max + 0.15)
    }
    this.writeRing(dt, camera)
  }

  sample(): { reduced: boolean; alive: number; traveling: number } {
    let alive = 0
    let traveling = 0
    for (const bit of this.bits) {
      if (bit.life <= 0) continue
      alive++
      if (bit.travel) traveling++
    }
    return { reduced: motionReduced(), alive, traveling }
  }

  private writeRing(dt: number, camera: PerspectiveCamera): void {
    if (this.ringLife <= 0) {
      this.ring.visible = false
      return
    }
    this.ringLife = Math.max(0, this.ringLife - dt)
    const t = 1 - this.ringLife / this.ringMax
    if (this.ringStill) {
      this.ring.scale.setScalar(1.15)
      this.ringMat.opacity = this.ringLife / this.ringMax
      return
    }
    this.ring.quaternion.copy(camera.quaternion)
    this.ring.scale.setScalar(0.2 + t * 3.6)
    this.ringMat.opacity = (1 - t) * 0.9
  }
}

function motionReduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function aim(out: Vector3, index: number, count: number): void {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const y = count <= 1 ? 0.15 : 1 - (index / (count - 1)) * 2
  const ring = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = index * golden
  out.set(Math.cos(theta) * ring, Math.abs(y) * 0.82 + 0.18, Math.sin(theta) * ring).normalize()
}

function sparkColor(chain: number, index: number): number {
  if (chain >= 5) return index % 2 === 0 ? 0xfff1d4 : 0xffb067
  if (chain >= 3) return index % 2 === 0 ? 0xffd7a8 : 0x9af7ff
  return index % 2 === 0 ? 0xf3fffd : 0x8af6ff
}
