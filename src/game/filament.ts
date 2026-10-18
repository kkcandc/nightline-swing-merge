import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three'

const SEG = 14

export class Filament {
  readonly mesh: Mesh
  private readonly positions: Float32Array
  private readonly mat: MeshBasicMaterial

  constructor(color = 0xd7fbff) {
    const strips = 2
    const verts = strips * SEG * 2
    this.positions = new Float32Array(verts * 3)
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(this.positions, 3))
    const index: number[] = []
    for (let s = 0; s < strips; s++) {
      const base = s * SEG * 2
      for (let i = 0; i < SEG - 1; i++) {
        const a = base + i * 2
        const b = a + 1
        const c = a + 2
        const d = a + 3
        index.push(a, b, c, b, d, c)
      }
    }
    geo.setIndex(index)
    this.mat = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    })
    this.mesh = new Mesh(geo, this.mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2
    this.mesh.visible = false
  }

  hide(): void {
    this.mesh.visible = false
  }

  heat(amount: number): void {
    const t = Math.max(0, Math.min(1, amount))
    this.mat.color.copy(_cool).lerp(_hot, t)
  }

  draw(from: Vector3, to: Vector3, sag: number, opacity = 0.95, widthScale = 1): void {
    this.mesh.visible = true
    this.mat.opacity = opacity
    const axis = _axis.subVectors(to, from)
    const len = axis.length() || 1
    axis.multiplyScalar(1 / len)
    let side = _side.crossVectors(axis, _up)
    if (side.lengthSq() < 1e-4) side.crossVectors(axis, _alt)
    side.normalize()
    const scale = Math.max(0.2, widthScale)
    this.strip(0, from, to, sag, side, 0.16 * scale, 0)
    this.strip(1, from, to, sag * 0.65, side, 0.05 * scale, 0.22)
    const attr = this.mesh.geometry.getAttribute('position') as BufferAttribute
    attr.needsUpdate = true
  }

  private strip(index: number, from: Vector3, to: Vector3, sag: number, side: Vector3, width: number, offset: number): void {
    const base = index * SEG * 2
    for (let i = 0; i < SEG; i++) {
      const t = i / (SEG - 1)
      _p.lerpVectors(from, to, t)
      _p.y -= Math.sin(t * Math.PI) * sag
      _p.addScaledVector(side, offset)
      const w = width * Math.sin(t * Math.PI) * 0.65 + width * 0.45
      const o = (base + i * 2) * 3
      this.positions[o] = _p.x + side.x * w
      this.positions[o + 1] = _p.y + side.y * w
      this.positions[o + 2] = _p.z + side.z * w
      this.positions[o + 3] = _p.x - side.x * w
      this.positions[o + 4] = _p.y - side.y * w
      this.positions[o + 5] = _p.z - side.z * w
    }
  }
}

const _axis = new Vector3()
const _side = new Vector3()
const _up = new Vector3(0, 1, 0)
const _alt = new Vector3(1, 0, 0)
const _p = new Vector3()
const _cool = new Color(0xd7fbff)
const _hot = new Color(0xffffff)
