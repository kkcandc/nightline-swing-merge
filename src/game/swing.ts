import { Vector3 } from 'three'
import { raycast, type Collider } from './collision'
import { TUNE } from './tune'

export type Rope = { length: number; zip: number }

const radial = new Vector3()
const tangent = new Vector3()
const offset = new Vector3()

/**
 * Pendulum step on the chest point. The rope only pulls when taut.
 * Looking along `wish` steers the tangent; pump adds extra along that steer.
 */
export function stepSwing(
  point: Vector3,
  vel: Vector3,
  anchor: Vector3,
  rope: Rope,
  dt: number,
  wish: Vector3,
  pump: number,
  reel: number,
): void {
  if (reel > 0) rope.zip = Math.max(TUNE.minRope, rope.zip - TUNE.reel * reel * dt)
  if (reel < 0) rope.zip = Math.min(TUNE.maxRope, rope.zip + TUNE.pay * -reel * dt)

  if (rope.length > rope.zip) {
    rope.length = Math.max(rope.zip, rope.length - Math.max(TUNE.reel, 36) * dt)
  } else {
    rope.length = rope.zip
  }

  offset.copy(point).sub(anchor)
  const dist = offset.length()
  if (dist < 1e-4) return
  radial.copy(offset).multiplyScalar(1 / dist)

  vel.y -= TUNE.gravity * dt

  if (wish.lengthSq() > 1e-6) {
    tangent.copy(wish).addScaledVector(radial, -wish.dot(radial))
    const mag = tangent.length()
    if (mag > 0.05) {
      tangent.multiplyScalar(1 / mag)
      const accel = TUNE.steer + Math.max(0, pump) * TUNE.pump
      vel.addScaledVector(tangent, accel * Math.min(1, mag) * dt)
    }
  }
  if (pump < 0) vel.multiplyScalar(Math.max(0, 1 + pump * 1.4 * dt))

  vel.multiplyScalar(Math.max(0, 1 - TUNE.swingDrag * dt))
  point.addScaledVector(vel, dt)
  constrain(point, vel, anchor, rope.length)
}

export function constrain(point: Vector3, vel: Vector3, anchor: Vector3, length: number): void {
  offset.copy(point).sub(anchor)
  const dist = offset.length()
  if (dist <= length + 0.001 || dist < 1e-4) return
  radial.copy(offset).multiplyScalar(1 / dist)
  point.copy(anchor).addScaledVector(radial, length)
  const outward = vel.dot(radial)
  if (outward > 0) vel.addScaledVector(radial, -outward)
}

const rayDirs: Vector3[] = []
const aimPoint = new Vector3()
const toHit = new Vector3()

function buildRays(forward: Vector3, right: Vector3, up: Vector3): Vector3[] {
  rayDirs.length = 0
  const ups = [0, 0.14, 0.28, 0.42]
  const sides = [0, -0.18, 0.18]
  for (const u of ups) {
    for (const s of sides) {
      if (u === 0 && s !== 0) continue
      const d = forward.clone().addScaledVector(up, u).addScaledVector(right, s)
      if (d.lengthSq() < 1e-6) continue
      rayDirs.push(d.normalize())
    }
  }
  return rayDirs
}

/** Pick a filament anchor. Center aim wins when it hits something usable. */
export function findAnchor(
  origin: Vector3,
  forward: Vector3,
  right: Vector3,
  up: Vector3,
  boxes: Collider[],
  playerFeet: Vector3,
): Vector3 | null {
  const rays = buildRays(forward, right, up)
  let bestScore = -Infinity
  let best: Vector3 | null = null

  rays.forEach((dir, index) => {
    const hit = raycast(origin, dir, boxes, TUNE.webRange, (b) => b.tag !== 'ground')
    if (!hit) return
    const point = aimPoint.copy(hit.point)
    if (Math.abs(hit.normal.y) < 0.55) {
      point.y = Math.min(hit.box.maxY - 0.45, point.y + 11)
    }
    point.addScaledVector(hit.normal, 0.55)

    const dist = point.distanceTo(playerFeet)
    if (dist < TUNE.minWeb || dist > TUNE.webRange) return
    if (point.y < playerFeet.y + 1.5) return

    toHit.copy(point).sub(origin)
    const toLen = toHit.length() || 1
    toHit.multiplyScalar(1 / toLen)

    let score = 46 - Math.abs(dist - 40) * 0.55
    score += Math.min(40, point.y - playerFeet.y) * 0.75
    score += forward.dot(toHit) * 42
    if (hit.box.tag === 'anchor') score += 26
    if (hit.normal.y > 0.75) score -= 8
    if (index === 0) score += 38

    if (score > bestScore) {
      bestScore = score
      best = point.clone()
    }
  })

  return best
}
