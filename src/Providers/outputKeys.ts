import { Objects } from '../Helpers/Objects'
import { Repository } from 'typeorm'

export const getOutputKeys = (repository: Repository<any>) => {
  const excludedCols = []
  repository.metadata.columns.forEach(c => {
    if (!c.isSelect) {
      excludedCols.push(c.propertyName)
    }
  })

  const keys = repository.metadata.propertiesMap

  const flatKeys = Objects.flatten(keys)
  const exclude = [
    ...excludedCols,
    ...['deleted', 'access', 'submissionAccess', 'version', '_ngram', 'form']
  ]

  const outputKeys = Object.keys(flatKeys).filter(e => {
    return !exclude.includes(e)
  })
  return outputKeys
}
