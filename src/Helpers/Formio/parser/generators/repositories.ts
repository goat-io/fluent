import { compile } from 'handlebars'
import { join } from 'path'
import { GoatModel } from '../../types/GoatModel'
import { SupportedFrameworks } from '../parse'

import { template as lbRepositoryExtended } from './templates/Loopback4/repository/repository.hbs'
import { template as lbRepositoryBase } from './templates/Loopback4/repository/baseRepository.hbs'

const FrameworkTemplatesBaseRepository = {
  Loopback4: lbRepositoryBase
}

const FrameworkTemplatesRepositoryExtended = {
  Loopback4: lbRepositoryExtended
}

export const generateRepositories = (Model: GoatModel, framework: SupportedFrameworks) => {
  const source = FrameworkTemplatesBaseRepository[framework]

  const template = compile(source)
  Model.properties._Model = Model
  const result = template(Model.properties)

  const filePath = join(`${Model.folderPath}/_base/${Model.name}-repository.ts`)
  // writeFileSync(filePath, result)

  // Generate Extended Repository
  const sourceExtended = FrameworkTemplatesRepositoryExtended[framework]
  const templateExtended = compile(sourceExtended)
  const resultExtended = templateExtended(Model.properties)
  const filePathExtended = join(`${Model.folderPath}/${Model.name}.repository.ts`)
  // writeFileSync(filePathExtended, resultExtended)

  return {
    extendedRepository: {
      file: resultExtended,
      path: filePathExtended
    },
    repository: {
      file: result,
      path: filePath
    }
  }
}
