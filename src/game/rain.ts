import { AdditiveBlending, BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, Vector3 } from 'three'

const COUNT = 1800

export class Rain {
  readonly lines: LineSegments
  private readonly positions: Float32Array
  private readonly speeds: Float32Array
  enabled = true

  constructor() {
    this.positions = new Float32Array(COUNT * 2 * 3)
    this.speeds = new Float32Array(COUNT)
    const origin = new Vector3()
    for (let i = 0; i < COUNT; i++) {
      this.speeds[i] = 18 + Math.random() * 22
      this.seed(i, origin)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(this.positions, 3))
    this.lines = new LineSegments(
      geo,
      new LineBasicMaterial({
        color: 0xb9c8e6,
        transparent: true,
        opacity: 0.28,
        blending: AdditiveBlending,
      }),
    )
    this.lines.frustumCulled = false
  }

  private seed(i: number, center: Vector3): void {
    const x = center.x + (Math.random() - 0.5) * 78
    const y = center.y + 4 + Math.random() * 36
    const z = center.z + (Math.random() - 0.5) * 78
    const o = i * 6
    this.positions[o] = x
    this.positions[o + 1] = y
    this.positions[o + 2] = z
    this.positions[o + 3] = x + 0.2
    this.positions[o + 4] = y - 1.05
    this.positions[o + 5] = z + 0.08
  }

  update(dt: number, center: Vector3): void {
    this.lines.visible = this.enabled
    if (!this.enabled) return
    for (let i = 0; i < COUNT; i++) {
      const o = i * 6
      const drop = (this.speeds[i] ?? 20) * dt
      const y = (this.positions[o + 1] ?? 0) - drop
      this.positions[o + 1] = y
      this.positions[o + 4] = y - 1.05
      if (y < center.y - 8) this.seed(i, center)
    }
    const attr = this.lines.geometry.getAttribute('position') as BufferAttribute
    attr.needsUpdate = true
  }
}
