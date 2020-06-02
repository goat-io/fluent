import { compile } from 'handlebars'
import { join } from 'path'
import { GoatModel } from '../../types/GoatModel'
import { template as loopback } from './templates/Loopback4/modules/modules.hbs'
import { template as nestModule } from './templates/Nestjs/modules/module.hbs'
import { SupportedFrameworks } from '../parse'

const FrameworkTemplates = {
  Loopback4: loopback,
  Nestjs: nestModule
}
export const loadedModules = (
  Models: GoatModel | GoatModel[],
  framework: SupportedFrameworks
) => {
  const source = FrameworkTemplates[framework]
  const template = compile(source)

  if (!Array.isArray(Models)) {
    Models.properties._Model = Models
  }

  const result = template(Array.isArray(Models) ? Models : Models.properties)

  const filePath = Array.isArray(Models)
    ? join(`app_modules.ts`)
    : join(`${Models.folderPath}/${Models.name}.module.ts`)

  return {
    file: result,
    path: filePath
  }
}
