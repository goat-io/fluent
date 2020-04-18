import { compile } from 'handlebars'
import { join } from 'path'
import { GoatModel } from '../../types/GoatModel'
import { template as loopback } from './templates/Loopback4/modules/modules.hbs'

const FrameworkTemplates = {
  Loopback4: loopback
}
export const loadedModules = (Models: GoatModel[]) => {
  const framework = 'Loopback4'
  const source = FrameworkTemplates[framework]

  const template = compile(source)
  const result = template(Models)
  const filePath = join(`app_modules.ts`)
  return {
    file: result,
    path: filePath
  }
}
