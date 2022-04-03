import { Repository } from 'typeorm'
import { Objects } from '@goatlab/js-utils'

export const getOutputKeys = (repository: Repository<any>) => {
  const excludedCols = []
  repository.metadata.columns.forEach(c => {
    if (!c.isSelect) {
      excludedCols.push(c.propertyName)
    }
  })

  const keys = repository.metadata.propertiesMap

  const flatKeys = Objects.flatten(keys, true)

  const outputKeys = Object.keys(flatKeys).filter(
    e => !excludedCols.includes(e)
  )
  return outputKeys
}
