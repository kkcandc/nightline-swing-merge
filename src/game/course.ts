export const CELL = 74

export const SPAWN = { x: -262, y: 0, z: 28 }

export const CANAL = { minX: -390, maxX: 390, minZ: 102, maxZ: 174 }

export type Place = { name: string; x: number; z: number; clear: number }

export const PLACES: Place[] = [
  { name: 'Bellforge', x: 0, z: 0, clear: 58 },
  { name: 'Hollow Nave', x: 0, z: -236, clear: 72 },
  { name: 'Vesper Spire', x: 222, z: -18, clear: 42 },
  { name: 'Mourning Gate', x: -236, z: 28, clear: 52 },
]

export type RingDef = { x: number; y: number; z: number; r: number; name: string }

export const RINGS: RingDef[] = [
  { x: -236, y: 4.4, z: 28, r: 9.2, name: 'Mourning Gate' },
  { x: -188, y: 18, z: 30, r: 7.6, name: 'First Thread' },
  { x: -120, y: 26, z: 16, r: 7.4, name: 'West Arcade' },
  { x: -48, y: 32, z: 6, r: 7.4, name: 'Bellforge Approach' },
  { x: 18, y: 40, z: -28, r: 7.2, name: 'Bellforge' },
  { x: 22, y: 34, z: -118, r: 7.4, name: 'North Veil' },
  { x: 4, y: 36, z: -210, r: 8, name: 'Hollow Nave' },
  { x: 96, y: 30, z: -150, r: 7.4, name: 'Buttress Run' },
  { x: 168, y: 28, z: -48, r: 7.4, name: 'Spire Ward' },
  { x: 214, y: 52, z: -16, r: 7, name: 'Vesper Ascent' },
  { x: 222, y: 118, z: -18, r: 6.4, name: 'Vesper Crown' },
]

/** Hand-placed filament towers. Streets stay open around them. */
export const SPIRES: { x: number; z: number; h: number }[] = [
  { x: -190, z: 28, h: 88 },
  { x: -188, z: -6, h: 66 },
  { x: -168, z: 62, h: 74 },
  { x: -112, z: 36, h: 96 },
  { x: -74, z: -18, h: 84 },
  { x: -36, z: 40, h: 78 },
  { x: 42, z: -8, h: 90 },
  { x: 48, z: -70, h: 86 },
  { x: 8, z: -150, h: 80 },
  { x: -28, z: -188, h: 76 },
  { x: 70, z: -168, h: 92 },
  { x: 132, z: -96, h: 88 },
  { x: 176, z: -36, h: 102 },
  { x: 168, z: 24, h: 70 },
  { x: 96, z: 36, h: 76 },
  { x: 36, z: 48, h: 68 },
  { x: -40, z: 78, h: 72 },
  { x: -120, z: 8, h: 80 },
]

export const ROOF_SEEDS: { x: number; z: number }[] = [
  { x: -150, z: 90 },
  { x: -80, z: 100 },
  { x: 70, z: 86 },
  { x: 140, z: 70 },
  { x: 250, z: 40 },
  { x: -40, z: -80 },
  { x: 80, z: -40 },
  { x: -90, z: -40 },
  { x: 40, z: -190 },
  { x: -70, z: -250 },
  { x: 120, z: -200 },
  { x: 250, z: -80 },
  { x: -200, z: -40 },
  { x: -250, z: 80 },
  { x: 20, z: 120 },
  { x: 300, z: -20 },
]

export function hash2(i: number, j: number): number {
  let n = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
