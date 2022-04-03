import { writeFileSync } from 'fs'
import { join } from 'path'
import { ParsedModel } from '../../../../fluent-formio/src/Formio/types/GoatParsedModel'

export const Models = (model: ParsedModel, basePath: string) => {
  for (const base of model.baseModels) {
    writeFileSync(join(basePath, `../src/${base.path}`), base.file)
  }

  // Write DTO
  writeFileSync(
    join(basePath, `../src/${model.baseDto.path}`),
    model.baseDto.file
  )

  writeFileSync(
    join(basePath, `../src/${model.extendedModels.path}`),
    model.extendedModels.file
  )
}
