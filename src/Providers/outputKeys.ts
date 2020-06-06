import { Objects } from '../Helpers/Objects'
import { ObjectLiteral } from 'typeorm'

export const getOutputKeys = (keys: ObjectLiteral) => {
  const flatKeys = Objects.flatten(keys)

  const outputKeys = Object.keys(flatKeys).filter(e => {
    return ![
      'deleted',
      'access',
      'submissionAccess',
      'version',
      '_ngram',
      'form'
    ].includes(e)
  })
  return outputKeys
}
