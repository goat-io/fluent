import { writeFileSync } from 'fs'
import { join } from 'path'
import { TemplateFileType } from '../../Helpers/Formio/types/GoatParsedModel'

export const Types = (types: TemplateFileType[], basePath: string) => {
  for (const type of types) {
    writeFileSync(join(basePath, `../src/${type.path}`), type.file)
  }
}
