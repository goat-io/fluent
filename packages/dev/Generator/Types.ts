import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { TemplateFileType } from '../../../../fluent-formio/src/Formio/types/GoatParsedModel'

export const Types = (types: TemplateFileType[], basePath: string) => {
  for (const type of types) {
    writeFileSync(join(basePath, `../src/${type.path}`), type.file)
  }
}
