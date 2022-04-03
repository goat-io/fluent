import { writeFileSync } from 'fs'
import { join } from 'path'
import { TemplateFileType } from '../../../../fluent-formio/src/Formio/types/GoatParsedModel'

export const Module = (module: TemplateFileType, basePath: string) => {
  writeFileSync(join(basePath, `../src/${module.path}`), module.file)
}
