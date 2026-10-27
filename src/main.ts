import { Game } from './game/Game'

console.info('orbjuice-2026-10-27')
document.documentElement.dataset.build = 'orbjuice-2026-10-27'

const boot = document.querySelector('#boot')
try {
  new Game()
  if (boot) boot.remove()
} catch (error) {
  const message = error instanceof Error ? error.message : 'The city failed to start.'
  if (boot) boot.textContent = message
  console.error(error)
}
