import { compile } from 'handlebars'
import { join } from 'path'
import { GoatModel } from '../../types/GoatModel'
import { SupportedFrameworks } from '../parse'
import { template as lbController } from './templates/Loopback4/controller/baseController.hbs'
import { template as lbControllerExtended } from './templates/Loopback4/controller/controller.hbs'

const FrameworkTemplatesBaseController = {
  Loopback4: lbController
}
const FrameworkTemplatesControllerExtended = {
  Loopback4: lbControllerExtended
}

export const generateControllers = (Model: GoatModel, framework: SupportedFrameworks) => {
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
  const filePathExtended = join(`${Model.folderPath}/${Model.name}.controller.ts`)
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
