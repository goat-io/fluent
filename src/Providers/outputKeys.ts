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

  const flatKeys = Objects.flatten(keys, true)

  const outputKeys = Object.keys(flatKeys).filter(e => {
    return !excludedCols.includes(e)
  })
  return outputKeys
}
