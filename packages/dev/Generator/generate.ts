import { writeFileSync } from 'fs'
import { join } from 'path'
import { Formio } from '../../../../fluent-formio/src/Formio'
import {
  parse,
  SupportedFrameworks
} from '../../../../fluent-formio/src/Formio/parser/parse'
import { Controllers } from './Controllers'
import { Directories } from './Directories'
import { Models } from './Models'
import { Repositories } from './Repositories'
import { Module } from './Module'
import { Types } from './Types'
import { FormioForm } from '../../../../fluent-formio/src/Formio/types/FormioForm'

export const generate = async (
  Forms: FormioForm[],
  directory: string,
  framework: 'Loopback4' | 'Nestjs'
) => {
  const goatModels = await parse(Forms, SupportedFrameworks.Nest)

  for (const m of goatModels) {
    await Directories(m.model, directory, SupportedFrameworks.Nest)
    await Types(m.types, directory)
    await Models(m.models, directory)
    await Repositories(m.repository, directory)
    await Controllers(m.controller, directory)
    await Module(m.module, directory)
  }

  /*
  writeFileSync(
    join(directory, `../src/modules.ts`),
    goatModels[0].modules.file
  )
  */
}
