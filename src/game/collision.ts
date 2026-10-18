import { Vector3 } from 'three'

export type ColliderTag = 'ground' | 'solid' | 'anchor'

export type Collider = {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
  tag: ColliderTag
}

export type RayHit = {
  t: number
  point: Vector3
  normal: Vector3
  box: Collider
}

export function makeBox(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  tag: ColliderTag = 'solid',
): Collider {
  return {
    minX: x - w / 2,
    maxX: x + w / 2,
    minY: y - h / 2,
    maxY: y + h / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    tag,
  }
}

export function raycast(
  origin: Vector3,
  dir: Vector3,
  boxes: Collider[],
  maxDist: number,
  allow?: (box: Collider) => boolean,
): RayHit | null {
  let bestT = maxDist
  let best: Collider | null = null
  for (const box of boxes) {
    if (allow && !allow(box)) continue
    const t = slab(origin, dir, box, bestT)
    if (t === null || t >= bestT) continue
    bestT = t
    best = box
  }
  if (!best) return null
  const point = origin.clone().addScaledVector(dir, bestT)
  return { t: bestT, point, normal: faceNormal(best, point), box: best }
}

function slab(o: Vector3, d: Vector3, b: Collider, maxDist: number): number | null {
  let tmin = 0
  let tmax = maxDist
  const mins = [b.minX, b.minY, b.minZ]
  const maxs = [b.maxX, b.maxY, b.maxZ]
  const oc = [o.x, o.y, o.z]
  const dc = [d.x, d.y, d.z]
  for (let i = 0; i < 3; i++) {
    const di = dc[i] ?? 0
    const oi = oc[i] ?? 0
    const mn = mins[i] ?? 0
    const mx = maxs[i] ?? 0
    if (Math.abs(di) < 1e-8) {
      if (oi < mn || oi > mx) return null
      continue
    }
    let t1 = (mn - oi) / di
    let t2 = (mx - oi) / di
    if (t1 > t2) {
      const tmp = t1
      t1 = t2
      t2 = tmp
    }
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return null
  }
  if (tmax < 0) return null
  const t = tmin >= 0 ? tmin : tmax
  if (t < 0 || t > maxDist) return null
  return t
}

function faceNormal(b: Collider, p: Vector3): Vector3 {
  const faces: [number, Vector3][] = [
    [Math.abs(p.x - b.minX), new Vector3(-1, 0, 0)],
    [Math.abs(p.x - b.maxX), new Vector3(1, 0, 0)],
    [Math.abs(p.y - b.minY), new Vector3(0, -1, 0)],
    [Math.abs(p.y - b.maxY), new Vector3(0, 1, 0)],
    [Math.abs(p.z - b.minZ), new Vector3(0, 0, -1)],
    [Math.abs(p.z - b.maxZ), new Vector3(0, 0, 1)],
  ]
  faces.sort((a, c) => a[0] - c[0])
  return faces[0]?.[1] ?? new Vector3(0, 1, 0)
}

function xzOverlap(pos: Vector3, radius: number, b: Collider): boolean {
  const cx = clamp(pos.x, b.minX, b.maxX)
  const cz = clamp(pos.z, b.minZ, b.maxZ)
  const dx = pos.x - cx
  const dz = pos.z - cz
  return dx * dx + dz * dz <= radius * radius + 1e-6
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}

export type ResolveResult = { grounded: boolean; tag: ColliderTag | null }

/**
 * Capsule approximated as a vertical cylinder. `pos` is the feet.
 * Vertical landing is solved before side pushes so roofs can be stood on.
 */
export function resolvePlayer(
  pos: Vector3,
  vel: Vector3,
  prevY: number,
  radius: number,
  height: number,
  boxes: Collider[],
): ResolveResult {
  let grounded = false
  let tag: ColliderTag | null = null
  let landY = -Infinity
  let landTag: ColliderTag | null = null

  for (const b of boxes) {
    if (!xzOverlap(pos, radius, b)) continue
    if (vel.y <= 0 && prevY >= b.maxY - 0.08 && pos.y <= b.maxY + 0.02 && b.maxY <= prevY + 0.15) {
      if (b.maxY > landY) {
        landY = b.maxY
        landTag = b.tag
      }
    }
    const head = pos.y + height
    const prevHead = prevY + height
    if (vel.y > 0 && prevHead <= b.minY + 0.05 && head >= b.minY && b.tag !== 'ground') {
      pos.y = b.minY - height - 0.01
      vel.y = Math.min(vel.y, 0)
    }
  }

  if (landY > -Infinity) {
    pos.y = landY
    vel.y = 0
    grounded = true
    tag = landTag
  }

  for (let pass = 0; pass < 2; pass++) {
    for (const b of boxes) {
      if (b.tag === 'ground') continue
      const feet = pos.y
      const head = pos.y + height
      if (feet >= b.maxY - 0.03) continue
      if (head <= b.minY + 0.01) continue

      const insideX = pos.x > b.minX && pos.x < b.maxX
      const insideZ = pos.z > b.minZ && pos.z < b.maxZ
      if (insideX && insideZ) {
        const left = pos.x - b.minX
        const right = b.maxX - pos.x
        const back = pos.z - b.minZ
        const front = b.maxZ - pos.z
        const m = Math.min(left, right, back, front)
        if (m === left) {
          pos.x = b.minX - radius
          vel.x = Math.min(vel.x, 0)
        } else if (m === right) {
          pos.x = b.maxX + radius
          vel.x = Math.max(vel.x, 0)
        } else if (m === back) {
          pos.z = b.minZ - radius
          vel.z = Math.min(vel.z, 0)
        } else {
          pos.z = b.maxZ + radius
          vel.z = Math.max(vel.z, 0)
        }
        continue
      }

      const cx = clamp(pos.x, b.minX, b.maxX)
      const cz = clamp(pos.z, b.minZ, b.maxZ)
      let dx = pos.x - cx
      let dz = pos.z - cz
      const d2 = dx * dx + dz * dz
      if (d2 >= radius * radius || d2 < 1e-10) continue
      const d = Math.sqrt(d2)
      const push = (radius - d) / d
      dx *= push
      dz *= push
      pos.x += dx
      pos.z += dz
      const nx = (pos.x - cx) || dx
      const nz = (pos.z - cz) || dz
      const nl = Math.hypot(nx, nz) || 1
      const fnx = nx / nl
      const fnz = nz / nl
      const vn = vel.x * fnx + vel.z * fnz
      if (vn < 0) {
        vel.x -= fnx * vn
        vel.z -= fnz * vn
      }
    }
  }

  return { grounded, tag }
}
