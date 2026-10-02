import { Game } from './game/Game'

const boot = document.querySelector('#boot')
try {
  new Game()
  if (boot) boot.remove()
} catch (error) {
  const message = error instanceof Error ? error.message : 'The city failed to start.'
  if (boot) boot.textContent = message
  console.error(error)
}
