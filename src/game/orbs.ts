import {
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  Object3D,
  Scene,
  TorusGeometry,
  Vector3,
} from 'three'
import type { Collider } from './collision'
import { RINGS, ROOF_SEEDS } from './course'

export type Orb = { id: string; x: number; y: number; z: number }

const KEY = 'nightline-orbs-v1'

export function layoutOrbs(colliders: Collider[]): Orb[] {
  const orbs: Orb[] = []
  let n = 0
  const push = (x: number, y: number, z: number) => {
    orbs.push({ id: `s${n++}`, x, y, z })
  }
  for (let i = 0; i < RINGS.length - 1; i++) {
    const a = RINGS[i]!
    const b = RINGS[i + 1]!
    for (const t of [0.35, 0.68]) {
      const side = i % 2 === 0 ? 7 : -7
      push(a.x + (b.x - a.x) * t + side, a.y + (b.y - a.y) * t + 1.5, a.z + (b.z - a.z) * t)
    }
  }
  push(222, 132, -18)
  push(214, 78, -10)
  push(0, 70, -236)
  push(0, 48, 8)
  for (const seed of ROOF_SEEDS) push(seed.x, roofHeight(seed.x, seed.z, colliders), seed.z)
  for (const orb of orbs) liftOut(orb, colliders)
  return orbs
}

function liftOut(orb: Orb, colliders: Collider[]): void {
  for (const b of colliders) {
    if (b.tag === 'ground') continue
    const inside =
      orb.x > b.minX && orb.x < b.maxX && orb.z > b.minZ && orb.z < b.maxZ && orb.y > b.minY && orb.y < b.maxY
    if (inside) orb.y = b.maxY + 2.6
  }
}

function roofHeight(x: number, z: number, colliders: Collider[]): number {
  let y = 16
  for (const b of colliders) {
    if (b.tag === 'ground') continue
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue
    y = Math.max(y, b.maxY + 2.4)
  }
  return y
}

export class Orbs {
  readonly list: Orb[]
  readonly got = new Set<string>()
  private readonly mesh: InstancedMesh
  private readonly halo: InstancedMesh
  private readonly dummy = new Object3D()
  private chain = 0
  private last = 0

  constructor(scene: Scene, list: Orb[]) {
    this.list = list
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
      for (const id of saved) this.got.add(id)
    } catch {
      /* ignore broken or blocked storage */
    }
    const mat = new MeshBasicMaterial({ color: 0xffffff })
    this.mesh = new InstancedMesh(new OctahedronGeometry(0.55, 0), mat, list.length)
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.frustumCulled = false
    const haloMat = new MeshBasicMaterial({ color: 0xbffcf2, transparent: true, opacity: 0.35 })
    this.halo = new InstancedMesh(new TorusGeometry(0.95, 0.035, 6, 16), haloMat, list.length)
    this.halo.frustumCulled = false
    scene.add(this.mesh, this.halo)
    this.write(0)
  }

  get collected(): number {
    return this.got.size
  }

  get chainCount(): number {
    return this.chain
  }

  reset(): void {
    this.got.clear()
    this.chain = 0
    localStorage.removeItem(KEY)
    this.write(0)
  }

  update(pos: Vector3, now: number): number {
    let picked = 0
    for (let i = 0; i < this.list.length; i++) {
      const orb = this.list[i]!
      if (this.got.has(orb.id)) continue
      if (Math.hypot(pos.x - orb.x, pos.y + 1 - orb.y, pos.z - orb.z) < 2.7) {
        this.got.add(orb.id)
        picked++
        this.chain = now - this.last < 4.2 ? this.chain + 1 : 1
        this.last = now
      }
    }
    if (picked) this.save()
    this.write(now)
    return picked
  }

  dots(): { x: number; z: number; got: boolean }[] {
    return this.list.map((o) => ({ x: o.x, z: o.z, got: this.got.has(o.id) }))
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify([...this.got]))
    } catch {
      /* ignore blocked storage */
    }
  }

  private write(now: number): void {
    for (let i = 0; i < this.list.length; i++) {
      const orb = this.list[i]!
      const hidden = this.got.has(orb.id)
      const bob = Math.sin(now * 2 + i) * 0.35
      this.dummy.position.set(orb.x, orb.y + bob, orb.z)
      this.dummy.rotation.set(now * 0.8, now * 0.6, 0)
      this.dummy.scale.setScalar(hidden ? 0.001 : 1)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
      this.dummy.rotation.x = Math.PI / 2
      this.dummy.scale.setScalar(hidden ? 0.001 : 1)
      this.dummy.updateMatrix()
      this.halo.setMatrixAt(i, this.dummy.matrix)
      this.mesh.setColorAt(i, _c.set(0.75 + (i % 5) * 0.05, 1, 0.92))
    }
    this.mesh.instanceMatrix.needsUpdate = true
    this.halo.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }
}

const _c = new Color()
