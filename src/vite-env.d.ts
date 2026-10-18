/// <reference types="vite/client" />

interface NightlineDebug {
  ready: boolean
  debugState: () => Record<string, unknown>
  debugAim: (x: number, y: number, z: number) => void
  debugFire: () => boolean
  debugRelease: () => void
  debugGlide: (on: boolean) => void
  debugDive: (on: boolean) => void
  debugTeleport: (x: number, y: number, z: number) => void
}

interface Window {
  __nightline?: NightlineDebug
}
