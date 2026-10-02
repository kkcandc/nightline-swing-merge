import { Euler, Quaternion, Vector3 } from 'three'

const euler = new Euler(0, 0, 0, 'YXZ')
const scratchQ = new Quaternion()

/** Camera / aim orientation. Yaw turns around Y, pitch tilts up. */
export function lookQuaternion(yaw: number, pitch: number, out = new Quaternion()): Quaternion {
  euler.set(pitch, yaw, 0, 'YXZ')
  return out.setFromEuler(euler)
}

export function lookDirection(yaw: number, pitch: number, out = new Vector3()): Vector3 {
  lookQuaternion(yaw, pitch, scratchQ)
  return out.set(0, 0, -1).applyQuaternion(scratchQ)
}

export function lookRight(yaw: number, pitch: number, out = new Vector3()): Vector3 {
  lookQuaternion(yaw, pitch, scratchQ)
  return out.set(1, 0, 0).applyQuaternion(scratchQ)
}

export function lookUp(yaw: number, pitch: number, out = new Vector3()): Vector3 {
  lookQuaternion(yaw, pitch, scratchQ)
  return out.set(0, 1, 0).applyQuaternion(scratchQ)
}

/** Inverse of lookDirection for pitches inside ±90°. */
export function yawPitchFromDirection(dir: Vector3): { yaw: number; pitch: number } {
  // lookDirection yields x = -sin(yaw)cos(pitch), z = -cos(yaw)cos(pitch).
  const yaw = Math.atan2(-dir.x, -dir.z)
  const pitch = Math.asin(clamp(dir.y, -1, 1))
  return { yaw, pitch }
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let delta = target - current
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return current + delta * (1 - Math.exp(-lambda * dt))
}

export function flatOf(dir: Vector3, out = new Vector3()): Vector3 {
  out.set(dir.x, 0, dir.z)
  if (out.lengthSq() < 1e-8) out.set(0, 0, -1)
  else out.normalize()
  return out
}
