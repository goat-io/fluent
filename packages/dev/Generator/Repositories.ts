import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ParsedRepository } from '../../../../fluent-formio/src/Formio/types/GoatParsedModel'

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
