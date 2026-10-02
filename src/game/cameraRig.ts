import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { raycast, type Collider } from './collision'
import { clamp, damp, lookDirection, lookQuaternion, lookRight, lookUp } from './look'
import type { Player } from './player'
import { TUNE } from './tune'

const desired = new Vector3()
const lookAt = new Vector3()
const forward = new Vector3()
const right = new Vector3()
const up = new Vector3()
const outward = new Vector3()
const rayDir = new Vector3()

export class CameraRig {
  readonly camera: PerspectiveCamera
  private pos = new Vector3()
  private ready = false
  private roll = 0
  private fov: number
  private shake = 0
  private fovKick = 0

  constructor(aspect: number) {
    this.fov = TUNE.fov
    this.camera = new PerspectiveCamera(this.fov, aspect, 0.12, 1800)
  }

  kick(): void {
    this.shake = Math.min(1, this.shake + 0.7)
    this.fovKick = 7
  }

  snap(player: Player, boxes: Collider[]): void {
    this.ready = false
    this.roll = 0
    this.update(1 / 30, player, boxes)
    this.ready = true
  }

  update(dt: number, player: Player, boxes: Collider[]): void {
    lookDirection(player.yaw, player.pitch, forward)
    lookRight(player.yaw, player.pitch, right)
    lookUp(player.yaw, player.pitch, up)

    const speed = player.vel.length()
    const speedT = clamp(speed / 40, 0, 1)
    lookAt.copy(player.pos)
    lookAt.y += 1.48
    lookAt.addScaledVector(player.vel, 0.11)

    const dist = MathUtils.lerp(TUNE.cameraDist, TUNE.cameraDistFast, speedT)
    desired.copy(lookAt).addScaledVector(forward, -dist).addScaledVector(up, TUNE.cameraHeight * 0.35)

    if (player.attached) {
      outward.copy(player.pos).sub(player.anchor)
      outward.y = 0
      if (outward.lengthSq() > 4) desired.addScaledVector(outward.normalize(), 1.7)
    }

    rayDir.copy(desired).sub(lookAt)
    const rayLen = rayDir.length()
    if (rayLen > 0.2) {
      rayDir.multiplyScalar(1 / rayLen)
      const hit = raycast(lookAt, rayDir, boxes, rayLen, (b) => b.tag !== 'ground')
      if (hit && hit.t < rayLen) {
        const pull = Math.max(0.55, hit.t - 0.4)
        desired.copy(lookAt).addScaledVector(rayDir, pull)
      }
    }

    if (!this.ready) {
      this.pos.copy(desired)
      this.ready = true
    }
    const lag = MathUtils.lerp(12, 3.1, speedT)
    this.pos.lerp(desired, 1 - Math.exp(-lag * dt))

    this.shake = damp(this.shake, 0, 8, dt)
    this.fovKick = damp(this.fovKick, 0, 6, dt)
    if (this.shake > 0.01) {
      this.pos.x += (Math.random() - 0.5) * this.shake * 0.16
      this.pos.y += (Math.random() - 0.5) * this.shake * 0.1
    }

    const lateral = player.vel.dot(right)
    const targetRoll = clamp(-lateral * 0.014, -0.34, 0.34)
    this.roll = damp(this.roll, targetRoll, player.attached ? 5 : 7, dt)

    const targetFov = MathUtils.lerp(TUNE.fov, TUNE.fovFast, clamp(speed / 46, 0, 1)) + this.fovKick
    this.fov = damp(this.fov, targetFov, 4.5, dt)

    this.camera.position.copy(this.pos)
    this.camera.quaternion.copy(lookQuaternion(player.yaw, player.pitch))
    this.camera.rotateZ(this.roll)
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
  }
}
