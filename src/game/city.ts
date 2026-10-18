import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeBox, type Collider, type ColliderTag } from './collision'
import { CANAL, CELL, PLACES, SPIRES, hash2 } from './course'

export type City = {
  colliders: Collider[]
  lights: Group[]
  clock: { hour: Group; minute: Group } | null
  waterTime: { value: number }
}

type Win = { x: number; y: number; z: number; sx: number; sy: number; ry: number; color: number }

const PAL: Record<string, number[]> = {
  mourning: [0xffb067, 0xff8d4a, 0xffd7ad],
  core: [0xffe2c4, 0xffb067, 0xfff4e4],
  nave: [0x9eb6ff, 0xd5e0ff, 0x6f8cff],
  cinder: [0xff7ad9, 0xffb067, 0xd16bff],
  wharf: [0x7dffe1, 0x9ee7ff, 0xffc27a],
  spire: [0xd2b6ff, 0xff7ad9, 0x9eb6ff],
}

export function buildCity(scene: Scene): City {
  const b = new Builder()
  const lights: Group[] = []

  b.colliders.push(makeBox(0, -6, 0, 1200, 12, 1200, 'ground'))
  addGround(scene)
  const waterTime = addWater(scene)

  for (let i = -5; i <= 5; i++) {
    for (let j = -5; j <= 5; j++) {
      const x = (i + 0.5) * CELL
      const z = (j + 0.5) * CELL
      const rng = mulberry(i * 3 + 2, j * 5 - 1)
      const district = districtOf(x, z)
      const w = district === 'wharf' ? 34 + rng() * 18 : 26 + rng() * 18
      const d = district === 'wharf' ? 16 + rng() * 12 : 24 + rng() * 16
      if (blocked(x, z, w, d)) continue
      block(b, x, z, w, d, district, rng)
    }
  }

  for (const spire of SPIRES) pinnacle(b, spire.x, spire.z, spire.h)
  for (let i = -4; i <= 4; i++) {
    for (let j = -4; j <= 4; j++) {
      if (((i + j) & 1) !== 0) continue
      const x = i * CELL
      const z = j * CELL
      if (blocked(x, z, 8, 8) || SPIRES.some((s) => Math.hypot(s.x - x, s.z - z) < 26)) continue
      pinnacle(b, x, z, 64 + hash2(i + 9, j - 4) * 48)
    }
  }

  bellforge(b, scene)
  cathedral(b)
  vesper(b)
  mourning(b)
  ashbridge(b)
  parapets(b)
  addLamps(scene)
  addSigns(scene)
  placeLabel(scene, 'BELLFORGE', 0, 158, 0)
  placeLabel(scene, 'HOLLOW NAVE', 0, 150, -236)
  placeLabel(scene, 'VESPER SPIRE', 222, 186, -18)
  placeLabel(scene, 'MOURNING GATE', -236, 28, 28)
  placeLabel(scene, 'ASHBRIDGE', 0, 42, 138)
  lights.push(searchlight(18, 96, 18), searchlight(0, 120, -236), searchlight(222, 150, -18))
  for (const light of lights) scene.add(light)

  flush(scene, b)
  return { colliders: b.colliders, lights, clock: b.clock, waterTime }
}

class Builder {
  readonly stone: BufferGeometry[] = []
  readonly dark: BufferGeometry[] = []
  readonly trim: BufferGeometry[] = []
  readonly glow: BufferGeometry[] = []
  readonly colliders: Collider[] = []
  readonly windows: Win[] = []
  clock: { hour: Group; minute: Group } | null = null

  box(list: BufferGeometry[], x: number, y: number, z: number, w: number, h: number, d: number, ry = 0): void {
    const g = new BoxGeometry(w, h, d)
    const m = new Matrix4().makeRotationY(ry)
    m.setPosition(x, y, z)
    g.applyMatrix4(m)
    list.push(g)
  }

  solid(x: number, y: number, z: number, w: number, h: number, d: number, tag: ColliderTag = 'solid'): void {
    this.colliders.push(makeBox(x, y, z, w, h, d, tag))
    this.box(this.stone, x, y, z, w, h, d)
  }

  cone(x: number, y: number, z: number, r: number, h: number): void {
    const g = new ConeGeometry(r, h, 5)
    g.applyMatrix4(new Matrix4().makeTranslation(x, y + h / 2, z))
    this.dark.push(g)
  }

  finial(x: number, y: number, z: number, r = 0.55): void {
    const g = new SphereGeometry(r, 8, 6)
    g.applyMatrix4(new Matrix4().makeTranslation(x, y, z))
    this.glow.push(g)
  }

  win(x: number, y: number, z: number, nx: number, nz: number, sx: number, sy: number, color: number): void {
    if (this.windows.length > 4000) return
    this.windows.push({
      x: x + nx * 0.16,
      y,
      z: z + nz * 0.16,
      sx,
      sy,
      ry: Math.atan2(nx, nz),
      color,
    })
  }
}

function flush(scene: Scene, b: Builder): void {
  const stoneMat = new MeshStandardMaterial({ color: 0x3a3746, roughness: 0.93, metalness: 0.05 })
  const darkMat = new MeshStandardMaterial({ color: 0x211e29, roughness: 0.88, metalness: 0.08 })
  const trimMat = new MeshStandardMaterial({ color: 0x736b7e, roughness: 0.48, metalness: 0.28 })
  const glowMat = new MeshBasicMaterial({ color: 0xd7c2ff })
  addMerged(scene, b.stone, stoneMat, true)
  addMerged(scene, b.dark, darkMat, true)
  addMerged(scene, b.trim, trimMat, true)
  addMerged(scene, b.glow, glowMat, false)

  if (!b.windows.length) return
  const win = new InstancedMesh(new BoxGeometry(1, 1, 0.08), new MeshBasicMaterial({ color: 0xffffff }), b.windows.length)
  win.frustumCulled = false
  const dummy = new Object3D()
  const color = new Color()
  b.windows.forEach((w, i) => {
    dummy.position.set(w.x, w.y, w.z)
    dummy.rotation.set(0, w.ry, 0)
    dummy.scale.set(w.sx, w.sy, 1)
    dummy.updateMatrix()
    win.setMatrixAt(i, dummy.matrix)
    win.setColorAt(i, color.setHex(w.color))
  })
  scene.add(win)
}

function addMerged(scene: Scene, list: BufferGeometry[], mat: MeshStandardMaterial | MeshBasicMaterial, shadow: boolean): void {
  if (!list.length) return
  const merged = mergeGeometries(list, false)
  for (const g of list) g.dispose()
  if (!merged) return
  merged.computeBoundingSphere()
  const mesh = new Mesh(merged, mat)
  mesh.castShadow = shadow
  mesh.receiveShadow = shadow
  scene.add(mesh)
}

function districtOf(x: number, z: number): string {
  if (z > 78) return 'wharf'
  if (x > 150) return 'spire'
  if (z < -140) return 'nave'
  if (x < -150) return 'mourning'
  if (z > 18) return 'cinder'
  return 'core'
}

function blocked(x: number, z: number, w: number, d: number): boolean {
  for (const place of PLACES) {
    if (Math.hypot(x - place.x, z - place.z) < place.clear) return true
  }
  const minX = x - w / 2
  const maxX = x + w / 2
  const minZ = z - d / 2
  const maxZ = z + d / 2
  const hitsCanal = !(maxX < CANAL.minX || minX > CANAL.maxX || maxZ < CANAL.minZ || minZ > CANAL.maxZ)
  if (hitsCanal) return true
  return SPIRES.some((s) => Math.hypot(s.x - x, s.z - z) < 16)
}

function block(b: Builder, x: number, z: number, w: number, d: number, district: string, rng: () => number): void {
  const downtown = 1 - Math.min(1, Math.hypot(x, z) / 360)
  let h = 20 + rng() * 34 + downtown * 40
  if (district === 'wharf') h = 12 + rng() * 16
  else if (district === 'nave') h += 10
  if (rng() > 0.9) h += 18
  h = Math.min(h, district === 'wharf' ? 32 : 98)
  const palette = PAL[district] ?? PAL.core!
  const color = palette[Math.floor(rng() * palette.length) % palette.length] ?? 0xffb067

  b.solid(x, 1.1, z, w + 1.4, 2.2, d + 1.4)
  const shaft = Math.max(8, h * 0.7)
  b.solid(x, 2.2 + shaft / 2, z, w, shaft, d, h > 72 ? 'anchor' : 'solid')
  windows(b, x, 2.2 + shaft / 2, z, w, shaft, d, color, rng)
  if (h > 34) {
    const top = h * 0.22
    const tw = w * 0.66
    const td = d * 0.66
    const ty = 2.2 + shaft + top / 2
    b.solid(x, ty, z, tw, top, td)
    b.cone(x, ty + top / 2, z, Math.min(tw, td) * 0.28, top * 1.1)
    b.box(b.trim, x, 2.2 + shaft, z, w + 0.8, 1.1, d + 0.8)
    if (rng() > 0.45) {
      for (const [sx, sz] of corners(w, d)) {
        b.box(b.dark, x + sx, ty + top * 0.2, z + sz, 2.4, top * 0.8, 2.4)
        b.cone(x + sx, ty + top * 0.55, z + sz, 1.3, top * 0.7)
      }
    }
  } else {
    b.box(b.dark, x, 2.2 + shaft + 0.4, z, w * 0.92, 1.2, d * 0.92)
  }
  if (district === 'cinder' || district === 'wharf') {
    if (rng() > 0.55) b.finial(x, h + 4, z, 0.4)
  }
}

function pinnacle(b: Builder, x: number, z: number, h: number): void {
  b.solid(x, h / 2, z, 3.1, h, 3.1, 'anchor')
  b.box(b.trim, x, h * 0.62, z, 4.4, 1.3, 4.4)
  b.box(b.dark, x, 2.2, z, 5.2, 4.4, 5.2)
  b.cone(x, h, z, 2.2, h * 0.16)
  b.finial(x, h + h * 0.16, z, 0.7)
  for (let k = 0; k < 5; k++) {
    b.win(x + 1.65, h * (0.22 + k * 0.14), z, 1, 0, 0.35, 2.8, 0xffe1b5)
  }
}

function corners(w: number, d: number): [number, number][] {
  return [
    [w * 0.38, d * 0.38],
    [w * 0.38, -d * 0.38],
    [-w * 0.38, d * 0.38],
    [-w * 0.38, -d * 0.38],
  ]
}

function windows(b: Builder, x: number, y: number, z: number, w: number, h: number, d: number, color: number, rng: () => number): void {
  const rows = Math.max(1, Math.floor((h - 3) / 8))
  const cols = Math.max(1, Math.floor(w / 7))
  for (let row = 0; row < rows; row++) {
    const wy = y - h / 2 + 3.2 + row * ((h - 4) / rows)
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.22) continue
      const wx = x - w / 2 + (c + 0.5) * (w / cols)
      const tint = rng() > 0.85 ? 0x9ecbff : color
      b.win(wx, wy, z + d / 2, 0, 1, 1.15, 2.15, tint)
      if (rng() > 0.35) b.win(wx, wy, z - d / 2, 0, -1, 1.15, 2.15, tint)
    }
  }
}

function bellforge(b: Builder, scene: Scene): void {
  b.solid(0, 4, 0, 28, 8, 28)
  b.solid(0, 46, 0, 16, 76, 16, 'anchor')
  b.solid(0, 90, 0, 11, 18, 11, 'anchor')
  b.cone(0, 99, 0, 5.5, 48)
  b.finial(0, 150, 0, 1.3)
  for (const [sx, sz] of [[9, 9], [9, -9], [-9, 9], [-9, -9]] as const) {
    b.solid(sx, 82, sz, 4.2, 28, 4.2, 'anchor')
    b.cone(sx, 96, sz, 2.1, 16)
    b.finial(sx, 114, sz, 0.45)
  }
  const face = new Mesh(
    new CylinderGeometry(3.2, 3.2, 0.3, 24),
    new MeshStandardMaterial({ color: 0xe7d7b4, roughness: 0.45, metalness: 0.15 }),
  )
  face.rotation.x = Math.PI / 2
  face.position.set(0, 64, 8.35)
  scene.add(face)

  const pivot = new Group()
  pivot.position.set(0, 64, 8.55)
  const hour = new Group()
  const minute = new Group()
  const handMat = new MeshStandardMaterial({ color: 0x1a120c, roughness: 0.4, metalness: 0.4 })
  const hourMesh = new Mesh(new BoxGeometry(0.16, 2.1, 0.08), handMat)
  hourMesh.position.y = 0.85
  const minuteMesh = new Mesh(new BoxGeometry(0.1, 2.9, 0.06), handMat)
  minuteMesh.position.y = 1.15
  hour.add(hourMesh)
  minute.add(minuteMesh)
  pivot.add(hour, minute)
  scene.add(pivot)
  b.clock = { hour, minute }
}

function cathedral(b: Builder): void {
  const z = -236
  b.solid(0, 15, z, 34, 30, 90)
  b.solid(0, 13, z, 78, 24, 26)
  b.solid(0, 62, z, 14, 108, 14, 'anchor')
  b.cone(0, 116, z, 6.5, 34)
  b.finial(0, 154, z, 1.1)
  b.solid(-22, 30, z - 34, 10, 60, 10, 'anchor')
  b.solid(22, 30, z - 34, 10, 60, 10, 'anchor')
  b.cone(-22, 60, z - 34, 4, 18)
  b.cone(22, 60, z - 34, 4, 18)
  for (let i = -3; i <= 3; i++) {
    const bz = z + i * 16
    strut(b, -20, 18, bz, 0.7)
    strut(b, 20, 18, bz, -0.7)
  }
  for (let row = 0; row < 6; row++) {
    b.win(0, 10 + row * 6, z + 45.2, 0, 1, 1.4, 4.2, 0x9eb6ff)
  }
}

function strut(b: Builder, x: number, y: number, z: number, lean: number): void {
  const g = new BoxGeometry(1.4, 16, 1.4)
  const m = new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationZ(lean))
  g.applyMatrix4(m)
  b.dark.push(g)
}

function vesper(b: Builder): void {
  b.solid(222, 9, -18, 22, 18, 22)
  b.solid(222, 80, -18, 10.5, 142, 10.5, 'anchor')
  b.cone(222, 151, -18, 5, 30)
  b.finial(222, 184, -18, 1.6)
  b.box(b.trim, 222, 40, -18, 14, 1.4, 14)
  b.box(b.trim, 222, 78, -18, 13, 1.2, 13)
  b.box(b.trim, 222, 116, -18, 12, 1.2, 12)
  for (let k = 0; k < 8; k++) b.win(227.4, 24 + k * 14, -18, 1, 0, 0.45, 4.5, 0xd2b6ff)
}

function mourning(b: Builder): void {
  b.solid(-236, 8, 6, 4.2, 16, 4.2, 'anchor')
  b.solid(-236, 8, 50, 4.2, 16, 4.2, 'anchor')
  b.box(b.trim, -236, 16.4, 28, 5.2, 2.4, 48)
  b.finial(-236, 18, 6, 0.4)
  b.finial(-236, 18, 50, 0.4)
}

function ashbridge(b: Builder): void {
  const z0 = CANAL.minZ
  const z1 = CANAL.maxZ
  const mid = (z0 + z1) / 2
  const span = z1 - z0 + 8
  b.solid(0, 16, z0, 8, 32, 8, 'anchor')
  b.solid(0, 16, z1, 8, 32, 8, 'anchor')
  b.solid(0, 31, mid, 8, 1.5, span)
  b.box(b.trim, -3.4, 32.2, mid, 0.45, 1.2, span)
  b.box(b.trim, 3.4, 32.2, mid, 0.45, 1.2, span)
  b.cone(0, 32, z0, 3.2, 10)
  b.cone(0, 32, z1, 3.2, 10)
  b.finial(0, 44, z0, 0.5)
  b.finial(0, 44, z1, 0.5)
}

function parapets(b: Builder): void {
  const gaps: [number, number][] = [
    [-16, 16],
    [200, 236],
  ]
  lip(b, CANAL.minZ, gaps)
  lip(b, CANAL.maxZ, gaps)
}

function lip(b: Builder, z: number, gaps: [number, number][]): void {
  const spans: [number, number][] = []
  let cursor = -370
  const stops = [...gaps].sort((a, c) => a[0] - c[0])
  for (const [a, c] of stops) {
    if (a > cursor) spans.push([cursor, a])
    cursor = Math.max(cursor, c)
  }
  if (cursor < 370) spans.push([cursor, 370])
  for (const [a, c] of spans) {
    if (c - a < 6) continue
    b.solid((a + c) / 2, 0.4, z, c - a, 0.8, 0.85)
  }
}

function addGround(scene: Scene): void {
  const tex = cityTexture()
  const mat = new MeshStandardMaterial({
    map: tex,
    color: 0x9aa0b0,
    roughness: 0.32,
    metalness: 0.42,
  })
  const mesh = new Mesh(new PlaneGeometry(980, 980), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -0.05
  mesh.receiveShadow = true
  scene.add(mesh)
}

function cityTexture(): CanvasTexture {
  const size = 2048
  const world = 980
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  if (!g) {
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    return tex
  }
  g.fillStyle = '#171821'
  g.fillRect(0, 0, size, size)
  const px = (v: number) => ((v + world / 2) / world) * size
  g.fillStyle = '#101118'
  for (let i = -7; i <= 7; i++) {
    const p = px(i * CELL)
    const band = (18 / world) * size
    g.fillRect(p - band / 2, 0, band, size)
    g.fillRect(0, p - band / 2, size, band)
  }
  g.fillStyle = '#070c12'
  g.fillRect(px(CANAL.minX), px(CANAL.minZ), px(CANAL.maxX) - px(CANAL.minX), px(CANAL.maxZ) - px(CANAL.minZ))
  g.strokeStyle = 'rgba(180, 170, 150, 0.18)'
  g.lineWidth = 2
  for (const place of PLACES) {
    g.beginPath()
    g.arc(px(place.x), px(place.z), (place.clear * 0.35 / world) * size, 0, Math.PI * 2)
    g.stroke()
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function addWater(scene: Scene): { value: number } {
  const time = { value: 0 }
  const mat = new ShaderMaterial({
    transparent: true,
    uniforms: { uTime: time },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float w = sin(vUv.x * 90.0 + uTime * 1.4) * sin(vUv.y * 46.0 - uTime);
        vec3 col = mix(vec3(0.015, 0.03, 0.045), vec3(0.05, 0.16, 0.18), w * 0.5 + 0.5);
        col += vec3(0.25, 0.55, 0.6) * smoothstep(0.72, 1.0, w);
        gl_FragColor = vec4(col, 0.88);
      }
    `,
  })
  const mesh = new Mesh(new PlaneGeometry(CANAL.maxX - CANAL.minX, CANAL.maxZ - CANAL.minZ), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set((CANAL.minX + CANAL.maxX) / 2, 0.04, (CANAL.minZ + CANAL.maxZ) / 2)
  scene.add(mesh)
  return time
}

function addLamps(scene: Scene): void {
  const spots: [number, number][] = []
  for (let x = -280; x <= 200; x += 34) spots.push([x, 28])
  for (let z = -280; z <= 80; z += 36) {
    if (z > CANAL.minZ - 8 && z < CANAL.maxZ + 8) continue
    spots.push([0, z])
  }
  const poles = new InstancedMesh(
    new CylinderGeometry(0.1, 0.16, 6.5, 6),
    new MeshStandardMaterial({ color: 0x2a2832, roughness: 0.6, metalness: 0.4 }),
    spots.length,
  )
  const bulbs = new InstancedMesh(
    new SphereGeometry(0.28, 8, 8),
    new MeshBasicMaterial({ color: 0xffc58a }),
    spots.length,
  )
  bulbs.frustumCulled = false
  const dummy = new Object3D()
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, 3.25, z)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    poles.setMatrixAt(i, dummy.matrix)
    dummy.position.set(x, 6.7, z)
    dummy.updateMatrix()
    bulbs.setMatrixAt(i, dummy.matrix)
  })
  scene.add(poles, bulbs)
}

function addSigns(scene: Scene): void {
  const signs: [string, number, number, number, number, string][] = [
    ['CINDER ROW', 48, 16, 78, 0, '#ff8ad4'],
    ['IRONWHARF', 150, 12, 86, 0.4, '#8dffe4'],
    ['RAINMARKET', -88, 14, 70, -0.6, '#ffb067'],
    ['SABLE POST', -200, 11, 78, 0.2, '#f2e6d4'],
    ['THREAD & CO', 96, 18, -40, Math.PI, '#d2b6ff'],
    ['LOW BELL', -30, 20, -78, 0.8, '#9eb6ff'],
    ['VESPER REACH', 70, 24, 36, -0.4, '#f7f1ff'],
  ]
  for (const [text, x, y, z, ry, color] of signs) {
    const mesh = signMesh(text, color)
    mesh.position.set(x, y, z)
    mesh.rotation.y = ry
    scene.add(mesh)
  }
}

function signMesh(text: string, color: string): Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const g = canvas.getContext('2d')
  if (g) {
    g.clearRect(0, 0, 512, 128)
    g.font = '700 58px Georgia, serif'
    g.fillStyle = color
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.shadowColor = color
    g.shadowBlur = 18
    g.fillText(text, 256, 64)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: DoubleSide })
  const mesh = new Mesh(new PlaneGeometry(12, 3), mat)
  return mesh
}

function placeLabel(scene: Scene, text: string, x: number, y: number, z: number): void {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const g = canvas.getContext('2d')
  if (g) {
    g.font = '600 50px Georgia, serif'
    g.fillStyle = 'rgba(244, 236, 224, 0.92)'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 256, 64)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  sprite.position.set(x, y, z)
  sprite.scale.set(26, 6.5, 1)
  scene.add(sprite)
}

function searchlight(x: number, y: number, z: number): Group {
  const group = new Group()
  const cone = new Mesh(
    new ConeGeometry(16, 78, 18, 1, true),
    new MeshBasicMaterial({
      color: 0xc5d4ff,
      transparent: true,
      opacity: 0.045,
      side: DoubleSide,
      depthWrite: false,
    }),
  )
  cone.geometry.translate(0, -39, 0)
  cone.rotation.x = 0.62
  group.add(cone)
  group.position.set(x, y, z)
  return group
}

function mulberry(i: number, j: number): () => number {
  let seed = Math.imul(i * 97 + j * 13 + 5, 1103515245) + 12345
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), 1664525) + 1013904223
    return ((seed >>> 0) % 100000) / 100000
  }
}
