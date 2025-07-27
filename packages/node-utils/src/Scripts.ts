import { runScript } from './scripts/runScript'
import { runCommand as runCommandScript } from './scripts/runCommand'

class ScriptsClass {
  run = runScript
  runCommand = runCommandScript
}

export const Scripts = new ScriptsClass()
export { runScript }
