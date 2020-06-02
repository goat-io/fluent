import { writeFileSync } from 'fs'
import { join } from 'path'
import { ParsedRepository } from '../../Helpers/Formio/types/GoatParsedModel'

export const Repositories = (
  repository: ParsedRepository,
  basePath: string
) => {
  writeFileSync(
    join(basePath, `../src/${repository.repository.path}`),
    repository.repository.file
  )
  writeFileSync(
    join(basePath, `../src/${repository.extendedRepository.path}`),
    repository.extendedRepository.file
  )
}
