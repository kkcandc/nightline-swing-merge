import { Vector3 } from 'three'
import { raycast, resolvePlayer, type Collider } from './collision'
import type { Input } from './input'
import { clamp, flatOf, lookDirection, lookRight, yawPitchFromDirection } from './look'
import { findAnchor, stepSwing, type Rope } from './swing'
import { TUNE } from './tune'

const right = new Vector3()
const up = new Vector3()
const flatF = new Vector3()
const flatR = new Vector3()
const wish = new Vector3()
const lookDir = new Vector3()
const point = new Vector3()
const chest = new Vector3()
const side = new Vector3()

export class Player {
  readonly pos = new Vector3()
  readonly vel = new Vector3()
  readonly anchor = new Vector3()
  readonly aim = new Vector3()
  readonly lastSafe = new Vector3()
  readonly rope: Rope = { length: 12, zip: 12 }
  yaw = 0
  pitch = 0.12
  grounded = false
  attached = false
  gliding = false
  diving = false
  wallRunning = false
  stamina = TUNE.glideStamina
  hasAim = false
  whiff = 0
  readonly whiffFrom = new Vector3()
  readonly whiffDir = new Vector3()
  toast = ''
  justAttached = false
  justDetached = false
  justPullout = false
  justWhiff = false
  sensMul = 1

  private seek = 0
  private coyote = 0
  private glideLock = false
  private wasDiving = false
  private wallTime = 0
  private wallBlocked = false
  private readonly wallNormal = new Vector3()
  private lineWasHeld = false
  lineLatch = false
  glideHold = false
  diveHold = false
  private detachedAt = -10
  private pulloutArmed = false

  constructor(x: number, y: number, z: number) {
    this.pos.set(x, y, z)
    this.lastSafe.set(x, y, z)
    const dir = new Vector3(0 - x, 36 - 1.5, 0 - z).normalize()
    const aim = yawPitchFromDirection(dir)
    this.yaw = aim.yaw
    this.pitch = clamp(aim.pitch, -0.2, 0.35)
  }

  applyLook(input: Input, dt: number): void {
    const sens = TUNE.sens * this.sensMul
    this.yaw -= input.dx * sens
    this.pitch -= input.dy * sens
    this.pitch = clamp(this.pitch, -1.28, 1.18)
    void dt
  }

  simulate(dt: number, input: Input, boxes: Collider[], camPos: Vector3): void {
    this.justAttached = false
    this.justDetached = false
    this.justPullout = false
    this.justWhiff = false
    this.toast = ''

    up.set(0, 1, 0)

    const steps = clamp(Math.ceil(dt / (1 / 90)), 1, 5)
    const h = dt / steps
    for (let i = 0; i < steps; i++) this.substep(h, boxes, camPos, input, i === 0)
  }

  private substep(dt: number, boxes: Collider[], camPos: Vector3, input: Input, first: boolean): void {
    const prevY = this.pos.y
    lookDirection(this.yaw, this.pitch, lookDir)
    flatOf(lookDir, flatF)
    lookRight(this.yaw, this.pitch, right)
    flatOf(right, flatR)

    const lineHeld = this.lineLatch || input.mouseHeld || input.held('KeyF')
    const spaceEdge = first && input.pressed('Space')
    const diveHeld = this.diveHold || input.held('ControlLeft') || input.held('ControlRight') || input.held('KeyC')
    const diveEdge = first && (input.pressed('ControlLeft') || input.pressed('ControlRight') || input.pressed('KeyC'))
    const press = first && (input.mouseEdge || input.pressed('KeyF'))

    if (!this.attached) {
      const found = findAnchor(camPos, lookDir, right, up, boxes, this.pos)
      if (found) {
        this.aim.copy(found)
        this.hasAim = true
      } else this.hasAim = false
    } else this.hasAim = false

    if (press) {
      this.seek = 0.16
      if (!this.tryAttach(flatF)) {
        this.whiff = 0.18
        this.justWhiff = true
        this.whiffFrom.copy(this.pos)
        this.whiffFrom.y += 1.35
        this.whiffDir.copy(lookDir)
      }
    } else if (this.seek > 0 && lineHeld && !this.attached) {
      this.seek -= dt
      this.tryAttach(flatF)
    }
    if (!lineHeld && this.lineWasHeld && this.attached) this.detach(true)
    this.lineWasHeld = lineHeld
    if (!lineHeld) this.seek = 0

    if (spaceEdge && this.attached) {
      this.detach(true)
      this.vel.y = Math.max(this.vel.y, 7.6)
      this.vel.addScaledVector(flatF, 3)
    }
    if (diveEdge && this.attached) {
      this.detach(false)
      this.vel.y = Math.min(this.vel.y, -4)
      this.vel.addScaledVector(lookDir, 8)
      this.pulloutArmed = true
    }

    if (this.grounded) this.coyote = 0.14
    else this.coyote = Math.max(0, this.coyote - dt)

    if (spaceEdge && !this.attached && (this.grounded || this.coyote > 0)) {
      this.vel.y = this.wallRunning ? TUNE.jump + 0.6 : TUNE.jump
      if (this.wallRunning) {
        this.vel.addScaledVector(this.wallNormal, 9.5)
        this.vel.addScaledVector(flatF, 4)
        this.wallRunning = false
        this.wallBlocked = true
      }
      this.grounded = false
      this.coyote = 0
    }

    const sprint = input.held('ShiftLeft') || input.held('ShiftRight')
    wish.set(0, 0, 0)
    const f = (input.held('KeyW') || input.held('ArrowUp') ? 1 : 0) - (input.held('KeyS') || input.held('ArrowDown') ? 1 : 0)
    const s = (input.held('KeyD') || input.held('ArrowRight') ? 1 : 0) - (input.held('KeyA') || input.held('ArrowLeft') ? 1 : 0)
    wish.addScaledVector(flatF, f).addScaledVector(flatR, s)
    if (wish.lengthSq() > 1) wish.normalize()

    this.gliding = false
    this.diving = false

    if (this.attached) {
      let pump = 0
      if (f > 0) pump = 1
      else if (f < 0) pump = -0.65
      const steer = flatF.clone()
      if (s !== 0) steer.addScaledVector(flatR, s * 0.9)
      let reel = 0
      if (input.rightHeld || input.held('KeyQ') || input.wheel < 0) reel += 1
      if (input.held('KeyE') || input.wheel > 0) reel -= 1
      if (this.grounded && this.pos.y < 1.4) {
        reel += 1
        if (this.vel.y < 5) this.vel.y = 5
      }
      point.copy(this.pos)
      point.y += TUNE.hang
      stepSwing(point, this.vel, this.anchor, this.rope, dt, steer, pump, reel)
      this.pos.x = point.x
      this.pos.y = point.y - TUNE.hang
      this.pos.z = point.z
      this.stamina = Math.min(TUNE.glideStamina, this.stamina + dt * 0.62)
      this.glideLock = false
    } else {
      const canGlide = (this.glideHold || input.held('Space')) && !diveHeld && !this.glideLock && this.stamina > 0 && !this.grounded
      if (diveHeld && !this.grounded) {
        this.diving = true
        this.pulloutArmed = true
        this.vel.y -= (TUNE.gravity * 0.35 + TUNE.diveAccel) * dt
        this.vel.addScaledVector(lookDir, TUNE.diveLook * dt)
      } else if (canGlide) {
        this.gliding = true
        this.stamina -= dt
        if (this.stamina <= 0) this.glideLock = true
        this.vel.addScaledVector(flatF, TUNE.glideSteer * dt)
        const sink = Math.max(0, -this.vel.y)
        this.vel.y += Math.min(TUNE.glideLift, sink * 5 + 8) * dt
        this.vel.y += lookDir.y * 9 * dt
        if (this.vel.y < -3.2) this.vel.y = MathUtilsLerp(this.vel.y, -3.2, 1 - Math.exp(-5 * dt))
        const hs = Math.hypot(this.vel.x, this.vel.z)
        if (hs > TUNE.glideMax) {
          const k = TUNE.glideMax / hs
          this.vel.x *= k
          this.vel.z *= k
        }
      } else {
        if (!this.grounded) this.vel.y -= TUNE.gravity * dt
        const target = this.grounded ? (sprint ? TUNE.sprint : TUNE.run) : TUNE.run * 0.92
        if (this.grounded) {
          if (wish.lengthSq() < 0.01) {
            const drag = Math.max(0, 1 - 9 * dt)
            this.vel.x *= drag
            this.vel.z *= drag
          } else {
            const k = 1 - Math.exp(-TUNE.groundAccel * dt)
            this.vel.x += (wish.x * target - this.vel.x) * k
            this.vel.z += (wish.z * target - this.vel.z) * k
          }
        } else if (wish.lengthSq() > 0.01) {
          const k = Math.min(1, TUNE.airAccel * dt)
          this.vel.x += (wish.x * target - this.vel.x) * k
          this.vel.z += (wish.z * target - this.vel.z) * k
        }
      }
      this.pos.addScaledVector(this.vel, dt)
    }

    if (this.wasDiving && !this.diving && !this.grounded && this.pulloutArmed) {
      const down = Math.max(0, -this.vel.y)
      if (down > 9) {
        this.vel.y += down * 0.7
        this.vel.addScaledVector(flatF, down * TUNE.pullout)
        this.justPullout = true
        if (this.vel.length() > 32) this.toast = 'FALLKNIFE'
      }
      this.pulloutArmed = false
    }
    if (this.grounded) this.pulloutArmed = false
    this.wasDiving = this.diving

    const hit = resolvePlayer(this.pos, this.vel, prevY, TUNE.radius, TUNE.height, boxes)
    if (this.attached) {
      point.copy(this.pos)
      point.y += TUNE.hang
      stepSwing(point, this.vel, this.anchor, this.rope, 0, wish, 0, 0)
      this.pos.x = point.x
      this.pos.y = point.y - TUNE.hang
      this.pos.z = point.z
    }
    this.grounded = hit.grounded
    if (this.grounded) {
      this.stamina = Math.min(TUNE.glideStamina, this.stamina + dt * 1.15)
      this.glideLock = false
      this.wallBlocked = false
      if (this.pos.y > -2) this.lastSafe.copy(this.pos)
    }

    this.updateWallRun(dt, boxes, diveHeld)

    const cap = this.diving ? TUNE.diveMaxSpeed : TUNE.maxSpeed
    const sp = this.vel.length()
    if (sp > cap) this.vel.multiplyScalar(cap / sp)

    if (this.pos.y < -30 || Math.abs(this.pos.x) > 560 || Math.abs(this.pos.z) > 560) {
      this.respawn()
    }
    if (this.whiff > 0) this.whiff = Math.max(0, this.whiff - dt)
  }

  private updateWallRun(dt: number, boxes: Collider[], diveHeld: boolean): void {
    if (this.attached || this.grounded || diveHeld || this.wallBlocked) {
      this.wallRunning = false
      return
    }
    const speed = Math.hypot(this.vel.x, this.vel.z)
    if (speed < 7) {
      this.wallRunning = false
      return
    }
    chest.copy(this.pos)
    chest.y += 1.1
    side.copy(flatR)
    let hit = sideNormal(chest, side, boxes)
    if (!hit) {
      side.negate()
      hit = sideNormal(chest, side, boxes)
    }
    if (!hit) {
      this.wallRunning = false
      return
    }
    if (!this.wallRunning) this.wallTime = 1.05
    this.wallRunning = true
    this.wallNormal.copy(hit)
    this.wallTime -= dt
    if (this.wallTime <= 0) {
      this.wallRunning = false
      this.wallBlocked = true
      return
    }
    if (this.vel.y < 0) this.vel.y *= Math.max(0, 1 - 6 * dt)
    this.vel.y = Math.max(this.vel.y, -2.4)
  }

  private tryAttach(wishDir: Vector3): boolean {
    if (!this.hasAim) return false
    this.beginSwing(this.aim, wishDir)
    return true
  }

  private beginSwing(anchor: Vector3, wishDir: Vector3): void {
    const was = this.attached
    this.anchor.copy(anchor)
    this.attached = true
    point.copy(this.pos)
    point.y += TUNE.hang
    const dist = Math.max(TUNE.minRope, point.distanceTo(this.anchor))
    const zip = Math.min(Math.max(0, dist - TUNE.minRope), Math.max(4.5, dist * TUNE.zipFraction))
    this.rope.length = dist
    this.rope.zip = Math.max(TUNE.minRope, dist - zip)
    const dir = anchor.clone().sub(point)
    const dlen = dir.length() || 1
    dir.multiplyScalar(1 / dlen)
    this.vel.addScaledVector(dir, Math.min(28, TUNE.zipSpeed + zip * 0.45))
    const outward = point.clone().sub(anchor).normalize()
    const outVel = this.vel.dot(outward)
    if (outVel > 0) this.vel.addScaledVector(outward, -outVel)
    if (this.vel.length() < 12) {
      const tangent = wishDir.clone()
      if (tangent.lengthSq() < 1e-4) tangent.set(dir.z, 0, -dir.x)
      tangent.addScaledVector(outward, -tangent.dot(outward))
      if (tangent.lengthSq() > 1e-4) {
        this.vel.addScaledVector(tangent.normalize(), 12 - this.vel.length())
      }
    }
    this.grounded = false
    this.justAttached = true
    if (!was && performance.now() / 1000 - this.detachedAt < 0.7 && this.vel.length() > 18) {
      this.toast = 'RETHREAD'
    }
  }

  private detach(boost: boolean): void {
    if (!this.attached) return
    this.attached = false
    if (boost) {
      const h = Math.hypot(this.vel.x, this.vel.z)
      if (h > 1) {
        this.vel.x *= 1.06
        this.vel.z *= 1.06
      }
      this.justDetached = true
      if (this.vel.length() > 26) this.toast = 'RIPLINE'
    }
    this.detachedAt = performance.now() / 1000
  }

  respawn(): void {
    this.pos.copy(this.lastSafe)
    this.vel.set(0, 0, 0)
    this.attached = false
    this.gliding = false
    this.diving = false
    this.grounded = true
  }

  aimAt(x: number, y: number, z: number): void {
    const dir = lookDir.set(x - this.pos.x, y - (this.pos.y + 1.4), z - this.pos.z)
    if (dir.lengthSq() < 1e-6) return
    dir.normalize()
    const aim = yawPitchFromDirection(dir)
    this.yaw = aim.yaw
    this.pitch = clamp(aim.pitch, -1.2, 1.15)
  }

  /** Scripted attach. Stays connected until releaseLine(). */
  fireToward(camPos: Vector3, boxes: Collider[]): boolean {
    lookDirection(this.yaw, this.pitch, lookDir)
    lookRight(this.yaw, this.pitch, right)
    up.set(0, 1, 0)
    const found = findAnchor(camPos, lookDir, right, up, boxes, this.pos)
    if (!found) return false
    flatOf(lookDir, flatF)
    this.beginSwing(found, flatF)
    this.lineLatch = true
    this.lineWasHeld = true
    return true
  }

  releaseLine(): void {
    this.lineLatch = false
    this.detach(true)
    this.lineWasHeld = false
  }

  teleport(x: number, y: number, z: number): void {
    this.pos.set(x, y, z)
    this.vel.set(0, 0, 0)
    this.attached = false
    this.grounded = y <= 0.05
    this.lastSafe.copy(this.pos)
  }
}

function MathUtilsLerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function sideNormal(origin: Vector3, dir: Vector3, boxes: Collider[]): Vector3 | null {
  const hit = raycast(origin, dir, boxes, 0.85, (b) => b.tag !== 'ground' && b.maxX - b.minX > 2.4)
  if (!hit || hit.normal.y > 0.45) return null
  return hit.normal
}
