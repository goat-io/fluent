import { compile } from 'handlebars'
import { join } from 'path'
import { FluentModel } from '../../types/FluentModel'
import { SupportedFrameworks } from '../parse'

import { template as lbRepositoryExtended } from './templates/Loopback4/repository/repository.hbs'
import { template as lbRepositoryBase } from './templates/Loopback4/repository/baseRepository.hbs'

import { template as nestRepositoryExtended } from './templates/Nestjs/repository/repository.hbs'
import { template as nestRepositoryBase } from './templates/Nestjs/repository/baseRepository.hbs'

const FrameworkTemplatesBaseRepository = {
  Loopback4: lbRepositoryBase,
  Nestjs: nestRepositoryBase
}

const FrameworkTemplatesRepositoryExtended = {
  Loopback4: lbRepositoryExtended,
  Nestjs: nestRepositoryExtended
}

export const generateRepositories = (
  Model: FluentModel,
  framework: SupportedFrameworks
) => {
  const source = FrameworkTemplatesBaseRepository[framework]

  const template = compile(source)
  Model.properties._Model = Model
  const result = template(Model.properties)

  const modelName =
    framework === SupportedFrameworks.Loopback ? 'repository' : 'service'

  const filePath = join(
    `${Model.folderPath}/_base/${Model.name}-${modelName}.ts`
  )
  // writeFileSync(filePath, result)

  // Generate Extended Repository
  const sourceExtended = FrameworkTemplatesRepositoryExtended[framework]
  const templateExtended = compile(sourceExtended)
  const resultExtended = templateExtended(Model.properties)
  const filePathExtended = join(
    `${Model.folderPath}/${Model.name}.${modelName}.ts`
  )
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
