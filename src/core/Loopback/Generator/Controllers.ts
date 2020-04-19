import { writeFileSync } from 'fs'
import { join } from 'path'
import { ParsedController } from '../../../Helpers/Formio/types/GoatParsedModel'

export const Controllers = (controller: ParsedController, basePath: string) => {
  writeFileSync(join(basePath, `../src/${controller.controller.path}`), controller.controller.file)
  writeFileSync(join(basePath, `../src/${controller.extendedController.path}`), controller.extendedController.file)
}
