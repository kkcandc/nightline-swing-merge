import {
  ACESFilmicToneMapping,
  AmbientLight,
  BackSide,
  Clock,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  OctahedronGeometry,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { AudioBus } from './audio'
import { CameraRig } from './cameraRig'
import { Character } from './character'
import { buildCity, type City } from './city'
import { RINGS, SPAWN } from './course'
import { Filament } from './filament'
import { Hud, type HudMode } from './hud'
import { Input } from './input'
import { layoutOrbs, Orbs } from './orbs'
import { Player } from './player'
import { Rain } from './rain'
import { medalFor, Trial } from './trial'
import { TUNE } from './tune'

const FLY: { p: Vector3; t: Vector3 }[] = [
  { p: new Vector3(-170, 46, 86), t: new Vector3(0, 70, 0) },
  { p: new Vector3(-20, 62, 64), t: new Vector3(0, 100, 0) },
  { p: new Vector3(36, 74, -30), t: new Vector3(0, 80, -80) },
  { p: new Vector3(16, 68, -170), t: new Vector3(0, 90, -236) },
  { p: new Vector3(130, 86, -70), t: new Vector3(222, 140, -18) },
  { p: new Vector3(188, 54, 36), t: new Vector3(222, 100, -18) },
  { p: new Vector3(30, 40, 120), t: new Vector3(0, 36, 40) },
  { p: new Vector3(-130, 44, 96), t: new Vector3(-220, 24, 28) },
]

export class Game {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly rig: CameraRig
  private readonly composer: EffectComposer
  private readonly bloom: UnrealBloomPass
  private readonly clock = new Clock()
  private readonly input: Input
  private readonly player: Player
  private readonly character: Character
  private readonly city: City
  private readonly orbs: Orbs
  private readonly trial: Trial
  private readonly filament = new Filament()
  private readonly rain: Rain
  private readonly audio = new AudioBus()
  private readonly hud: Hud
  private readonly aim: Mesh
  private readonly sky: Mesh
  private readonly moon: DirectionalLight
  private readonly hemi: HemisphereLight
  private mode: HudMode = 'menu'
  private fly = 0
  private hadLock = false
  private showFps = false
  private fps = 60
  private bell = 18
  private thunder = 0
  private didSwing = false
  private didRelease = false
  private didGlide = false
  private readonly canvas: HTMLCanvasElement

  constructor() {
    this.canvas = document.querySelector('#view') as HTMLCanvasElement
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    if (!this.renderer.getContext()) throw new Error('WebGL unavailable')

    this.scene.background = new Color(0x100e18)
    this.scene.fog = new FogExp2(0x161222, 0.00315)
    this.sky = makeSky()
    this.scene.add(this.sky)

    this.hemi = new HemisphereLight(0x243056, 0x09080d, 0.62)
    this.moon = new DirectionalLight(0xc9d6ff, 1.18)
    this.moon.castShadow = true
    this.moon.shadow.mapSize.set(2048, 2048)
    this.moon.shadow.bias = -0.00025
    this.moon.shadow.normalBias = 0.035
    const cam = this.moon.shadow.camera
    cam.near = 10
    cam.far = 240
    cam.left = -60
    cam.right = 60
    cam.top = 60
    cam.bottom = -60
    this.scene.add(this.hemi, this.moon, this.moon.target, new AmbientLight(0x1a1424, 0.2))

    this.city = buildCity(this.scene)
    this.player = new Player(SPAWN.x, SPAWN.y, SPAWN.z)
    this.character = new Character()
    this.scene.add(this.character.group, this.character.capeMesh, this.filament.mesh)
    this.orbs = new Orbs(this.scene, layoutOrbs(this.city.colliders))
    this.trial = new Trial(this.scene)
    this.rain = new Rain()
    this.scene.add(this.rain.lines)
    this.aim = new Mesh(new OctahedronGeometry(0.42, 0), new MeshBasicMaterial({ color: 0xb8fff4 }))
    this.aim.visible = false
    this.scene.add(this.aim)

    this.rig = new CameraRig(window.innerWidth / window.innerHeight)
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.rig.camera))
    this.bloom = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), 0.36, 0.58, 0.68)
    this.composer.addPass(this.bloom)

    this.input = new Input(this.canvas)
    this.hud = new Hud({
      play: () => this.start(true),
      resume: () => this.resume(),
      restart: () => this.restart(),
      resetOrbs: () => this.orbs.reset(),
      toggleMute: () => this.toggleMute(),
      toggleRain: () => this.toggleRain(),
      sensitivity: (value) => {
        this.player.sensMul = value
      },
    })
    this.hud.showBest(this.trial.best)
    this.hud.setMode('menu')
    this.hud.setToggles(false, true)

    this.canvas.addEventListener('click', () => {
      if (this.mode === 'play' && document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock()
    })
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas
      if (locked) this.hadLock = true
      if (!locked && this.hadLock && this.mode === 'play') this.pause()
    })
    window.addEventListener('resize', () => this.resize())

    window.__nightline = {
      ready: true,
      debugState: () => this.debugState(),
      debugAim: (x, y, z) => this.player.aimAt(x, y, z),
      debugFire: () => this.debugFire(),
      debugRelease: () => this.player.releaseLine(),
      debugGlide: (on) => {
        this.player.glideHold = on
      },
      debugDive: (on) => {
        this.player.diveHold = on
      },
      debugTeleport: (x, y, z) => {
        this.ensurePlay()
        this.player.teleport(x, y, z)
        this.rig.snap(this.player, this.city.colliders)
      },
    }

    this.renderer.setAnimationLoop(() => this.frame())
  }

  private start(lock: boolean): void {
    this.mode = 'play'
    this.hud.setMode('play')
    this.audio.start()
    this.rig.snap(this.player, this.city.colliders)
    if (lock) this.canvas.requestPointerLock()
  }

  private ensurePlay(): void {
    if (this.mode !== 'play') this.start(false)
  }

  private resume(): void {
    this.mode = 'play'
    this.hud.setMode('play')
    this.canvas.requestPointerLock()
  }

  private pause(): void {
    this.mode = 'pause'
    this.hud.setMode('pause')
  }

  private restart(): void {
    this.player.teleport(SPAWN.x, SPAWN.y, SPAWN.z)
    this.player.aimAt(0, 40, 0)
    this.player.releaseLine()
    this.trial.reset()
    this.mode = 'play'
    this.hud.setMode('play')
    this.rig.snap(this.player, this.city.colliders)
  }

  private toggleMute(): void {
    this.audio.start()
    this.audio.setMuted(!this.audio.muted)
    this.hud.setToggles(this.audio.muted, this.rain.enabled)
  }

  private toggleRain(): void {
    this.rain.enabled = !this.rain.enabled
    this.hud.setToggles(this.audio.muted, this.rain.enabled)
  }

  private resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    this.bloom.setSize(w, h)
    this.rig.camera.aspect = w / h
    this.rig.camera.updateProjectionMatrix()
  }

  private frame(): void {
    const dt = Math.min(0.05, this.clock.getDelta())
    this.fps += (1 / Math.max(dt, 0.001) - this.fps) * 0.08
    this.city.waterTime.value += dt
    this.bell -= dt
    if (this.bell <= 0) {
      this.bell = 52
      this.audio.bell()
    }
    if (this.thunder > 0) {
      this.thunder -= dt
      this.hemi.intensity = 0.62 + Math.max(0, this.thunder) * 2.2
    } else if (Math.random() < dt * 0.025) this.thunder = 0.16

    const focus = this.mode === 'menu' ? this.rig.camera.position : this.player.pos
    this.moon.position.set(focus.x + 46, focus.y + 90, focus.z + 26)
    this.moon.target.position.copy(focus)
    this.moon.target.updateMatrixWorld()

    for (let i = 0; i < this.city.lights.length; i++) {
      const light = this.city.lights[i]
      if (light) light.rotation.y += dt * (0.18 + i * 0.07)
    }
    if (this.city.clock) {
      const now = new Date()
      this.city.clock.hour.rotation.z = -((now.getHours() % 12) + now.getMinutes() / 60) * (Math.PI / 6)
      this.city.clock.minute.rotation.z = -(now.getMinutes() + now.getSeconds() / 60) * (Math.PI / 30)
    }

    if (this.mode === 'play') {
      if (this.input.pressed('KeyM')) this.toggleMute()
      if (this.input.pressed('KeyG')) this.toggleRain()
      if (this.input.pressed('F3')) this.showFps = !this.showFps
      if (this.input.pressed('KeyR')) this.player.respawn()
      if (this.input.pressed('KeyT')) this.restart()
      this.player.applyLook(this.input, dt)
      this.rig.update(dt, this.player, this.city.colliders)
      this.player.simulate(dt, this.input, this.city.colliders, this.rig.camera.position)
      this.rig.update(dt * 0.35, this.player, this.city.colliders)
      const picked = this.orbs.update(this.player.pos, this.clock.elapsedTime)
      this.trial.update(dt, this.player.pos)
      if (picked) {
        this.audio.orb()
        if (this.orbs.chainCount > 1) this.hud.toast(`CHAIN ${this.orbs.chainCount}`)
      }
      if (this.player.justAttached) {
        this.didSwing = true
        this.audio.attach()
        this.rig.kick()
      }
      if (this.player.justDetached) {
        this.didRelease = true
        this.audio.release()
      }
      if (this.player.gliding) this.didGlide = true
      if (this.player.justWhiff) this.audio.whiff()
      if (this.trial.justRing) this.audio.ring()
      if (this.trial.justFinish) {
        this.audio.finish()
        this.hud.toast('CIRCUIT CLEAR')
        this.hud.showBest(this.trial.best)
      }
      if (this.player.toast) this.hud.toast(this.player.toast)
      this.audio.setSpeed(this.player.vel.length())
      const lines = must('#speedlines')
      const rush = this.player.diving ? 0.55 : Math.max(0, this.player.vel.length() - 22) / 80
      lines.style.opacity = String(Math.min(0.55, rush))
    } else if (this.mode === 'menu') {
      this.flyover(dt)
      must('#speedlines').style.opacity = '0'
    }

    this.character.update(dt, {
      pos: this.player.pos,
      vel: this.player.vel,
      yaw: this.player.yaw,
      grounded: this.player.grounded,
      swinging: this.player.attached,
      gliding: this.player.gliding,
      diving: this.player.diving,
      anchor: this.player.attached ? this.player.anchor : null,
    })
    this.drawLine()
    this.sky.position.copy(this.rig.camera.position)
    this.rain.update(dt, this.rig.camera.position)
    this.composer.render()
    this.hud.tick(dt)
    if (this.mode !== 'menu') this.pushHud()
    this.input.consume()
  }

  private drawLine(): void {
    if (this.mode === 'play' && this.player.attached) {
      const dist = this.character.handWorld.distanceTo(this.player.anchor)
      const slack = Math.max(0, this.player.rope.length - dist)
      this.filament.draw(this.character.handWorld, this.player.anchor, 0.45 + slack * 0.35)
      this.aim.visible = false
      return
    }
    if (this.mode === 'play' && this.player.whiff > 0) {
      const tip = this.player.whiffFrom.clone().addScaledVector(this.player.whiffDir, 16)
      this.filament.draw(this.player.whiffFrom, tip, 1.4, this.player.whiff * 3)
      this.aim.visible = false
      return
    }
    this.filament.hide()
    if (this.mode === 'play' && this.player.hasAim) {
      this.aim.visible = true
      this.aim.position.copy(this.player.aim)
      const s = 0.85 + Math.sin(this.clock.elapsedTime * 6) * 0.12
      this.aim.scale.setScalar(s)
    } else this.aim.visible = false
  }

  private flyover(dt: number): void {
    this.fly += dt
    const n = FLY.length
    const u = (this.fly % 64) / 64
    const f = u * n
    const i = Math.floor(f) % n
    const j = (i + 1) % n
    const t = f - Math.floor(f)
    const s = t * t * (3 - 2 * t)
    const a = FLY[i]!
    const b = FLY[j]!
    this.rig.camera.position.lerpVectors(a.p, b.p, s)
    const look = a.t.clone().lerp(b.t, s)
    this.rig.camera.lookAt(look)
    this.rig.camera.fov = 68
    this.rig.camera.updateProjectionMatrix()
  }

  private pushHud(): void {
    const ring = this.trial.current
    let hint = ''
    if (!this.didSwing) hint = 'Hold left mouse on a tower to throw a nightline.'
    else if (!this.didRelease) hint = 'Release to keep your speed.'
    else if (!this.didGlide) hint = 'Hold Space to cape-glide. Ctrl dives.'
    this.hud.update({
      speed: this.player.vel.length(),
      gliding: this.player.gliding,
      diving: this.player.diving,
      attached: this.player.attached,
      stamina: this.player.stamina / TUNE.glideStamina,
      orbs: this.orbs.collected,
      orbTotal: this.orbs.list.length,
      chain: this.orbs.chainCount,
      hint: this.mode === 'play' ? hint : '',
      landmark: this.trial.finished ? 'Circuit clear' : (ring?.name ?? 'Night Circuit'),
      time: this.trial.time,
      best: this.trial.best,
      running: this.trial.running,
      finished: this.trial.finished,
      medal: this.trial.finished ? medalFor(this.trial.time * 1000) : '',
      fps: this.fps,
      showFps: this.showFps,
      px: this.player.pos.x,
      pz: this.player.pos.z,
      yaw: this.player.yaw,
      rings: RINGS.map((item, index) => ({
        x: item.x,
        z: item.z,
        next: index === this.trial.index,
        done: index < this.trial.index,
      })),
      dots: this.orbs.dots(),
    })
  }

  private debugFire(): boolean {
    this.ensurePlay()
    this.rig.update(1 / 60, this.player, this.city.colliders)
    return this.player.fireToward(this.rig.camera.position, this.city.colliders)
  }

  private debugState(): Record<string, unknown> {
    return {
      mode: this.mode,
      pos: this.player.pos.toArray(),
      vel: this.player.vel.toArray(),
      speed: this.player.vel.length(),
      attached: this.player.attached,
      grounded: this.player.grounded,
      gliding: this.player.gliding,
      diving: this.player.diving,
      rope: this.player.rope.length,
      orbs: this.orbs.collected,
      orbTotal: this.orbs.list.length,
      ring: this.trial.index,
      yaw: this.player.yaw,
      pitch: this.player.pitch,
      hasAim: this.player.hasAim,
    }
  }
}

function makeSky(): Mesh {
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new Color(0x07060e) },
      uHorizon: { value: new Color(0x221838) },
      uMoon: { value: new Vector3(0.42, 0.74, 0.25).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uMoon;
      void main() {
        vec3 dir = normalize(vDir);
        float h = smoothstep(-0.05, 0.55, dir.y);
        vec3 col = mix(uHorizon, uTop, h);
        col = mix(col, vec3(0.02, 0.015, 0.03), smoothstep(0.02, -0.25, dir.y));
        float neb = sin(dir.x * 3.0 + dir.z * 2.2) * sin(dir.y * 4.0);
        col += vec3(0.09, 0.02, 0.12) * smoothstep(0.15, 0.8, neb * 0.5 + 0.5) * step(0.05, dir.y);
        vec3 cell = floor(dir * 220.0);
        float n = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        col += step(0.992, n) * step(0.2, dir.y) * 0.85;
        float md = distance(dir, normalize(uMoon));
        col += vec3(0.85, 0.9, 1.0) * smoothstep(0.055, 0.04, md);
        col += vec3(0.35, 0.42, 0.7) * smoothstep(0.28, 0.05, md);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
  const mesh = new Mesh(new SphereGeometry(680, 28, 18), mat)
  mesh.frustumCulled = false
  return mesh
}

function must(sel: string): HTMLElement {
  const el = document.querySelector(sel)
  if (!el) throw new Error(`Missing ${sel}`)
  return el as HTMLElement
}
