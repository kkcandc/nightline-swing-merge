import { Vector3 } from 'three'
import { makeBox, resolvePlayer } from './collision'
import { lookDirection, yawPitchFromDirection } from './look'
import { constrain, stepSwing, type Rope } from './swing'

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

function checkLook(): void {
  const samples = [
    [0, 0],
    [Math.PI / 2, 0],
    [-Math.PI / 2, 0],
    [0.4, 0.5],
    [-1.1, -0.7],
    [2.2, 1.1],
  ]
  const dir = new Vector3()
  for (const [yaw, pitch] of samples) {
    lookDirection(yaw ?? 0, pitch ?? 0, dir)
    const back = yawPitchFromDirection(dir)
    lookDirection(back.yaw, back.pitch, dir)
    const again = lookDirection(yaw ?? 0, pitch ?? 0)
    const err = dir.distanceTo(again)
    assert(err < 1e-4, `look roundtrip ${yaw} ${pitch} err ${err}`)
  }
  lookDirection(-Math.PI / 2, 0, dir)
  assert(dir.x > 0.99, `yaw -PI/2 should look +X, got ${dir.toArray()}`)
}

function checkCollision(): void {
  const ground = makeBox(0, -2, 0, 200, 4, 200, 'ground')
  const pos = new Vector3(0, 0.4, 0)
  const vel = new Vector3(0, -8, 0)
  const prev = pos.y
  pos.y += vel.y * 0.1
  const landed = resolvePlayer(pos, vel, prev, 0.42, 1.78, [ground])
  assert(landed.grounded && Math.abs(pos.y) < 1e-3, `ground land y=${pos.y}`)

  const roof = makeBox(0, 10, 0, 10, 20, 10, 'solid')
  const p2 = new Vector3(0, 8, 0)
  const v2 = new Vector3(0, -40, 0)
  const prev2 = 28
  const roofed = resolvePlayer(p2, v2, prev2, 0.42, 1.78, [roof, ground])
  assert(roofed.grounded && Math.abs(p2.y - 20) < 1e-3, `roof land y=${p2.y} tag=${roofed.tag}`)

  const wall = makeBox(3, 5, 0, 2, 10, 8, 'solid')
  const p3 = new Vector3(1.7, 0, 0)
  const v3 = new Vector3(6, 0, 0)
  resolvePlayer(p3, v3, 0, 0.45, 1.78, [wall, ground])
  assert(p3.x <= 2 - 0.45 + 0.05, `wall push x=${p3.x}`)
  assert(v3.x <= 0.01, `wall kills inward speed ${v3.x}`)
}

function checkSwing(): void {
  const anchor = new Vector3(0, 48, 0)
  const point = new Vector3(30, 22, 0)
  const vel = new Vector3(0, 0, 4)
  const dist = point.distanceTo(anchor)
  const rope: Rope = { length: dist, zip: dist }
  const wish = new Vector3()
  let minY = point.y
  let maxSpeed = vel.length()
  for (let i = 0; i < 240; i++) {
    stepSwing(point, vel, anchor, rope, 1 / 60, wish, 0, 0)
    minY = Math.min(minY, point.y)
    maxSpeed = Math.max(maxSpeed, vel.length())
    const d = point.distanceTo(anchor)
    assert(d <= rope.length + 0.15, `rope stretch d=${d} L=${rope.length}`)
    assert(Number.isFinite(point.x + vel.x), 'non finite swing')
  }
  assert(minY < 14, `pendulum should drop through the arc, minY=${minY}`)
  assert(maxSpeed > 12, `bottom of the arc should be fast, speed=${maxSpeed}`)
  assert(vel.length() > 2, `swing should still be alive, speed=${vel.length()}`)

  const pumped = new Vector3(30, 22, 0)
  const pvel = new Vector3(0, 0, 10)
  const prope: Rope = { length: dist, zip: dist }
  let pumpedMax = 0
  for (let i = 0; i < 120; i++) {
    stepSwing(pumped, pvel, anchor, prope, 1 / 60, new Vector3(0, 0, 1), 1, 0)
    pumpedMax = Math.max(pumpedMax, pvel.length())
  }
  assert(pumpedMax > 18, `pump should build speed, got ${pumpedMax}`)

  const kept = pvel.length()
  constrain(pumped, pvel, anchor, prope.length)
  assert(pvel.length() > kept * 0.85, 'release keeps momentum')
}

checkLook()
checkCollision()
checkSwing()
console.log('nightline physics ok')
