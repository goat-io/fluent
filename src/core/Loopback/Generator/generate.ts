import { Formio } from '../../../Helpers/Formio'
import { parse, SupportedFrameworks } from '../../../Helpers/Formio/parser/parse'
import { Controllers } from './Controllers'
import { Directories } from './Directories'
import { Models } from './Models'
import { Repositories } from './Repositories'
import { Types } from './Types'
import { writeFileSync } from 'fs'
import { join } from 'path'

export const generate = async (rawJsonForms: any, directory: string) => {
  const parsedForms = Formio.getFromJson(rawJsonForms)
  if (!parsedForms || parsedForms.length === 0) {
    return
  }
  const goatModels = await parse(parsedForms, SupportedFrameworks.Loopback)

  for (const m of goatModels) {
    await Directories(m.model, directory)
    await Types(m.types, directory)
    await Controllers(m.controller, directory)
    await Models(m.models, directory)
    await Repositories(m.repository, directory)
  }

  writeFileSync(join(directory, `../src/modules.ts`), goatModels[0].modules.file)
}
