import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ParsedController } from '@goatlab/formio'

export const Controllers = (controller: ParsedController, basePath: string) => {
  writeFileSync(
    join(basePath, `../src/${controller.controller.path}`),
    controller.controller.file
  )
  writeFileSync(
    join(basePath, `../src/${controller.extendedController.path}`),
    controller.extendedController.file
  )
}
