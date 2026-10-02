import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { clamp, damp, dampAngle, yawPitchFromDirection } from './look'

const coat = new MeshStandardMaterial({ color: 0x1b1722, roughness: 0.78, metalness: 0.06 })
const cloth = new MeshStandardMaterial({ color: 0x121018, roughness: 0.86, metalness: 0.04 })
const maskMat = new MeshStandardMaterial({ color: 0x0c0b10, roughness: 0.42, metalness: 0.18 })
const leather = new MeshStandardMaterial({ color: 0x4a3028, roughness: 0.7, metalness: 0.08 })
const visorMat = new MeshBasicMaterial({ color: 0xffb15a })
const capeMat = new MeshStandardMaterial({
  color: 0x16121c,
  emissive: new Color(0x6d34a4),
  emissiveIntensity: 0.28,
  roughness: 0.72,
  metalness: 0.05,
  side: 2,
})

const wL = new Vector3()
const wR = new Vector3()
const velN = new Vector3()
const wind = new Vector3()

export type Pose = {
  pos: Vector3
  vel: Vector3
  yaw: number
  grounded: boolean
  swinging: boolean
  gliding: boolean
  diving: boolean
  anchor: Vector3 | null
}

export class Character {
  readonly group = new Group()
  private readonly inner = new Group()
  private readonly shoulderL = new Group()
  private readonly shoulderR = new Group()
  private readonly armL = new Group()
  private readonly armR = new Group()
  private readonly legL = new Group()
  private readonly legR = new Group()
  private readonly hand = new Group()
  private readonly cape: Cape
  private face = 0
  private phase = 0
  readonly handWorld = new Vector3()

  constructor() {
    this.group.add(this.inner)
    this.shoulderL.position.set(-0.28, 1.4, 0)
    this.shoulderR.position.set(0.28, 1.4, 0)
    this.inner.add(this.shoulderL, this.shoulderR)
    this.armL.position.set(0, 0, 0)
    this.armR.position.set(0, 0, 0)
    this.shoulderL.add(this.armL)
    this.shoulderR.add(this.armR)
    this.hand.position.set(0, -0.55, -0.05)
    this.armR.add(this.hand)

    const add = (geo: BufferGeometry, mat: MeshStandardMaterial | MeshBasicMaterial, x: number, y: number, z: number, parent: Group = this.inner) => {
      const mesh = new Mesh(geo, mat)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      parent.add(mesh)
      return mesh
    }

    add(new BoxGeometry(0.16, 0.46, 0.16), cloth, 0, -0.22, 0, this.legL)
    add(new BoxGeometry(0.16, 0.46, 0.16), cloth, 0, -0.22, 0, this.legR)
    add(new BoxGeometry(0.17, 0.12, 0.22), maskMat, 0, -0.46, -0.02, this.legL)
    add(new BoxGeometry(0.17, 0.12, 0.22), maskMat, 0, -0.46, -0.02, this.legR)
    this.legL.position.set(-0.12, 0.78, 0)
    this.legR.position.set(0.12, 0.78, 0)
    this.inner.add(this.legL, this.legR)

    add(new BoxGeometry(0.46, 0.48, 0.28), coat, 0, 0.72, 0)
    add(new BoxGeometry(0.4, 0.42, 0.26), coat, 0, 1.12, 0)
    add(new BoxGeometry(0.5, 0.06, 0.3), leather, 0, 0.5, 0)
    add(new BoxGeometry(0.18, 0.22, 0.1), leather, -0.24, 0.92, 0.02)
    add(new BoxGeometry(0.12, 0.46, 0.12), coat, 0, -0.24, 0, this.armL)
    add(new BoxGeometry(0.12, 0.46, 0.12), coat, 0, -0.24, 0, this.armR)
    add(new SphereGeometry(0.22, 12, 10), cloth, 0, 1.6, 0.02)
    add(new SphereGeometry(0.2, 10, 8), cloth, 0, 1.48, 0.06).scale.set(1.15, 0.7, 1.05)
    add(new BoxGeometry(0.2, 0.2, 0.08), maskMat, 0, 1.56, -0.1)
    const visor = add(new BoxGeometry(0.2, 0.035, 0.04), visorMat, 0, 1.58, -0.15)
    visor.castShadow = false
    this.cape = new Cape()
  }

  get capeMesh(): Mesh {
    return this.cape.mesh
  }

  update(dt: number, pose: Pose): void {
    const speed = Math.hypot(pose.vel.x, pose.vel.z)
    let face = pose.yaw
    if (pose.diving && pose.vel.length() > 6) {
      velN.copy(pose.vel).normalize()
      face = yawPitchFromDirection(velN).yaw
    } else if (speed > 2.4) {
      velN.set(pose.vel.x, 0, pose.vel.z).normalize()
      face = yawPitchFromDirection(velN).yaw
    }
    this.face = dampAngle(this.face, face, pose.swinging ? 8 : 11, dt)
    this.group.position.copy(pose.pos)
    this.group.rotation.y = this.face

    const spread = pose.gliding ? 0.58 : 0.28
    this.shoulderL.position.x = -spread
    this.shoulderR.position.x = spread

    let lean = 0
    if (pose.diving) lean = 0.95
    else if (pose.gliding) lean = 0.42
    else if (pose.swinging) lean = 0.22
    this.inner.rotation.x = damp(this.inner.rotation.x, lean, 8, dt)
    this.inner.rotation.z = damp(this.inner.rotation.z, clamp(-pose.vel.x * 0.01, -0.25, 0.25), 6, dt)

    if (pose.grounded && speed > 1.2) this.phase += dt * speed * 1.6
    const swing = pose.grounded ? Math.sin(this.phase) * Math.min(0.7, speed * 0.06) : 0
    this.legL.rotation.x = swing
    this.legR.rotation.x = -swing

    if (pose.swinging && pose.anchor) {
      this.armR.rotation.x = damp(this.armR.rotation.x, -2.35, 10, dt)
      this.armR.rotation.z = damp(this.armR.rotation.z, -0.35, 10, dt)
      this.armL.rotation.x = damp(this.armL.rotation.x, -0.4, 8, dt)
      this.armL.rotation.z = damp(this.armL.rotation.z, 0.2, 8, dt)
    } else if (pose.gliding) {
      this.armR.rotation.x = damp(this.armR.rotation.x, -0.5, 8, dt)
      this.armL.rotation.x = damp(this.armL.rotation.x, -0.5, 8, dt)
      this.armR.rotation.z = damp(this.armR.rotation.z, -1.15, 8, dt)
      this.armL.rotation.z = damp(this.armL.rotation.z, 1.15, 8, dt)
    } else {
      this.armR.rotation.x = damp(this.armR.rotation.x, -swing * 0.8, 10, dt)
      this.armL.rotation.x = damp(this.armL.rotation.x, swing * 0.8, 10, dt)
      this.armR.rotation.z = damp(this.armR.rotation.z, 0.08, 8, dt)
      this.armL.rotation.z = damp(this.armL.rotation.z, -0.08, 8, dt)
    }

    capeMat.emissiveIntensity = pose.gliding ? 1.35 : pose.diving ? 0.15 : 0.32
    this.group.updateMatrixWorld(true)
    this.hand.getWorldPosition(this.handWorld)
    this.shoulderL.getWorldPosition(wL)
    this.shoulderR.getWorldPosition(wR)
    this.cape.step(dt, wL, wR, pose.vel, pose.gliding)
  }
}

class Cape {
  readonly mesh: Mesh
  private readonly left: Vector3[] = []
  private readonly right: Vector3[] = []
  private readonly prevL: Vector3[] = []
  private readonly prevR: Vector3[] = []
  private ready = false
  private readonly positions: Float32Array

  constructor() {
    const n = 5
    for (let i = 0; i < n; i++) {
      this.left.push(new Vector3())
      this.right.push(new Vector3())
      this.prevL.push(new Vector3())
      this.prevR.push(new Vector3())
    }
    this.positions = new Float32Array(n * 2 * 3)
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(this.positions, 3))
    const index: number[] = []
    for (let i = 0; i < n - 1; i++) {
      const a = i
      const b = i + n
      const c = i + 1
      const d = i + 1 + n
      index.push(a, b, c, c, b, d)
    }
    geo.setIndex(index)
    this.mesh = new Mesh(geo, capeMat)
    this.mesh.frustumCulled = false
    this.mesh.castShadow = false
  }

  step(dt: number, left: Vector3, right: Vector3, vel: Vector3, glide: boolean): void {
    const n = this.left.length
    const h = Math.min(dt, 1 / 30)
    if (!this.ready) {
      for (let i = 0; i < n; i++) {
        this.left[i]!.copy(left)
        this.right[i]!.copy(right)
        this.prevL[i]!.copy(left)
        this.prevR[i]!.copy(right)
      }
      this.ready = true
    }
    wind.set(-vel.x * 0.55, -7.5 - vel.y * 0.15, -vel.z * 0.55)
    if (glide) wind.y += 10
    const dampen = glide ? 0.9 : 0.82
    const integrate = (pts: Vector3[], prev: Vector3[], pin: Vector3) => {
      for (let i = 1; i < n; i++) {
        const p = pts[i]!
        const q = prev[i]!
        const nx = p.x + (p.x - q.x) * dampen + wind.x * h * h
        const ny = p.y + (p.y - q.y) * dampen + wind.y * h * h
        const nz = p.z + (p.z - q.z) * dampen + wind.z * h * h
        q.copy(p)
        p.set(nx, ny, nz)
      }
      pts[0]!.copy(pin)
      prev[0]!.copy(pin)
    }
    integrate(this.left, this.prevL, left)
    integrate(this.right, this.prevR, right)
    const seg = glide ? 0.2 : 0.16
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < n - 1; i++) {
        constrain(this.left[i]!, this.left[i + 1]!, seg)
        constrain(this.right[i]!, this.right[i + 1]!, seg)
      }
      const width = glide ? 0.95 : 0.46
      for (let i = 0; i < n; i++) constrain(this.left[i]!, this.right[i]!, width * (1 - i * 0.08))
      this.left[0]!.copy(left)
      this.right[0]!.copy(right)
    }
    for (let i = 0; i < n; i++) {
      const L = this.left[i]!
      const R = this.right[i]!
      this.positions[i * 3] = L.x
      this.positions[i * 3 + 1] = L.y
      this.positions[i * 3 + 2] = L.z
      const o = (i + n) * 3
      this.positions[o] = R.x
      this.positions[o + 1] = R.y
      this.positions[o + 2] = R.z
    }
    const attr = this.mesh.geometry.getAttribute('position') as BufferAttribute
    attr.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
  }
}

function constrain(a: Vector3, b: Vector3, rest: number): void {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  const dist = Math.hypot(dx, dy, dz) || 1
  const diff = (dist - rest) / dist
  const ox = dx * diff * 0.5
  const oy = dy * diff * 0.5
  const oz = dz * diff * 0.5
  a.x += ox
  a.y += oy
  a.z += oz
  b.x -= ox
  b.y -= oy
  b.z -= oz
}
