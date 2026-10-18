export class Input {
  readonly keys = new Set<string>()
  readonly just = new Set<string>()
  mouseHeld = false
  rightHeld = false
  mouseEdge = false
  dx = 0
  dy = 0
  wheel = 0
  dragging = false

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.keys.add(e.code)
      this.just.add(e.code)
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault()
      }
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.mouseHeld = false
      this.rightHeld = false
      this.dragging = false
    })
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseHeld = true
        this.mouseEdge = true
        this.dragging = true
      }
      if (e.button === 2) this.rightHeld = true
    })
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseHeld = false
        this.dragging = false
      }
      if (e.button === 2) this.rightHeld = false
    })
    canvas.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas || this.dragging) {
        this.dx += e.movementX
        this.dy += e.movementY
      }
    })
    canvas.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY)
      e.preventDefault()
    }, { passive: false })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  held(code: string): boolean {
    return this.keys.has(code)
  }

  pressed(code: string): boolean {
    return this.just.has(code)
  }

  consume(): void {
    this.just.clear()
    this.mouseEdge = false
    this.dx = 0
    this.dy = 0
    this.wheel = 0
  }
}
