import { compile } from 'handlebars'
import { join } from 'path'
import { FluentModel } from '../../types/FluentModel'
import { SupportedFrameworks } from '../parse'
import { template as lbController } from './templates/Loopback4/controller/baseController.hbs'
import { template as lbControllerExtended } from './templates/Loopback4/controller/controller.hbs'
import { template as nestController } from './templates/Nestjs/controller/baseController.hbs'
import { template as nestControllerExtended } from './templates/Nestjs/controller/controller.hbs'

const FrameworkTemplatesBaseController = {
  Loopback4: lbController,
  Nestjs: nestController
}
const FrameworkTemplatesControllerExtended = {
  Loopback4: lbControllerExtended,
  Nestjs: nestControllerExtended
}

export const generateControllers = (
  Model: FluentModel,
  framework: SupportedFrameworks
) => {
  const source = FrameworkTemplatesBaseController[framework]

  const template = compile(source)
  Model.properties._Model = Model
  const result = template(Model.properties)

  const filePath = join(`${Model.folderPath}/_base/${Model.name}-controller.ts`)
  // writeFileSync(filePath, result)

  // Generate Extended Repository
  const sourceExtended = FrameworkTemplatesControllerExtended[framework]
  const templateExtended = compile(sourceExtended)
  const resultExtended = templateExtended(Model.properties)
  const filePathExtended = join(
    `${Model.folderPath}/${Model.name}.controller.ts`
  )
  // writeFileSync(filePathExtended, resultExtended)

  return {
    controller: {
      file: result,
      path: filePath
    },
    extendedController: {
      file: resultExtended,
      path: filePathExtended
    }
  }
}
