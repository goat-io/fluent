import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { TemplateFileType } from '../../../../fluent-formio/src/Formio/types/GoatParsedModel'

export const Module = (module: TemplateFileType, basePath: string) => {
  writeFileSync(join(basePath, `../src/${module.path}`), module.file)
}
