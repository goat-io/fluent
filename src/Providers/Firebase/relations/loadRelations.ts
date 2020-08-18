import {
  FirebaseConnector,
  createFirebaseRepository
} from '../FirebaseConnector'

import { Arrays } from '../../../Helpers/Arrays'
import { Primitives } from '../../../Providers/types'
import { TypedPathWrapper } from 'typed-path'

export const loadRelations = async (
  data,
  relations,
  modelRelations
): Promise<any[]> => {
  const ids = data.map(d => d.id)

  if (!relations) {
    return data
  }

  for (const relation of Object.keys(relations)) {
    if (modelRelations[relation]) {
      const relationModel = modelRelations[relation]

      const Model = new FirebaseConnector(relationModel.targetClass)

      const relatedResults = await Model.andWhere(
        Model._keys[relationModel.inverseSidePropertyPath] as TypedPathWrapper<
          Primitives
        >,
        'in',
        ids
      ).get()

      const grouped = Arrays.groupBy(
        relatedResults,
        r => r[relationModel.inverseSidePropertyPath]
      )

      console.log(modelRelations)

      // isOneToMany: relation.isOneToMany,
      // isManyToOne: relation.isManyToOne,
      // isManyToMany

      data.forEach(d => {
        if (grouped[d.id]) {
          d[relationModel.propertyPath] = grouped[d.id]
        }
      })
    }
  }

  return data
}
