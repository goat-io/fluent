import { ObjectID } from 'typeorm'
import { TypedPathWrapper } from 'typed-path'
import { Arrays, Ids } from '@goatlab/js-utils'
import type { Primitives } from './types'
import { TypeOrmConnector } from './TypeOrmConnector/TypeOrmConnector'

interface RelationshipLoader {
  data: any[]
  relations: any
  modelRelations: any
  connectionName?: string
  provider?: 'typeorm' | 'firebase'
  self: any
}
export const loadRelations = async ({
  data,
  relations,
  modelRelations,
  connectionName,
  provider,
  self
}: RelationshipLoader): Promise<any[]> => {
  if (!relations) {
    return data
  }

  const chunkSize = provider === 'typeorm' ? 100 : 10

  for (const relation of Object.keys(relations)) {
    if (modelRelations[relation]) {
      const relationModel = modelRelations[relation]
      let firebaseConnector: any
      if (provider === 'firebase') {
        firebaseConnector = require('../FirebaseConnector').FirebaseConnector
      }

      // We need to load the model directly from the connector itself

      const Model =
        typeof self[relation] === 'function'
          ? self[relation]()
          : provider === 'typeorm'
          ? new TypeOrmConnector(
              relationModel.targetClass,
              undefined,
              connectionName || 'LOCAL_DB'
            )
          : new firebaseConnector(relationModel.targetClass)

      if (relationModel.isOneToMany) {
        const ids = Arrays.deDuplicate(
          data.map(d =>
            Model.isMongoDB ? (Ids.objectID(d.id) as unknown as ObjectID) : d.id
          )
        )
        const chunks = Arrays.chunk(ids, chunkSize)
        // TODO we can make this calls at the same time...no need to wait for each one

        const promises = []
        for (const relatedIds of chunks) {
          const results = await Model.andWhere(
            Model._keys[
              relationModel.inverseSidePropertyPath
            ] as TypedPathWrapper<Primitives, Primitives>,
            'in',
            relatedIds
          ).get()
          promises.push(results)
        }

        const relatedResults = Arrays.collapse(await Promise.all(promises))

        const grouped = Arrays.groupBy(
          relatedResults,
          r => r[relationModel.inverseSidePropertyPath]
        )

        data.forEach(d => {
          if (grouped[d.id]) {
            d[relationModel.propertyPath] = grouped[d.id]
          }
        })
      } else if (relationModel.isManyToOne) {
        const ids = Arrays.deDuplicate(
          data.map(d => d[relationModel.joinColumns[0].propertyPath])
        )
        const chunks = Arrays.chunk(ids, chunkSize)
        // TODO we can make this calls at the same time...no need to wait for each one
        const promises = []
        for (const relatedIds of chunks) {
          const results = await Model.andWhere(
            Model._keys.id as TypedPathWrapper<Primitives, Primitives>,
            'in',
            relatedIds
          ).get()
          promises.push(results)
        }

        const relatedResults = Arrays.collapse(promises)

        const grouped = Arrays.groupBy(relatedResults, r => r.id)

        data.forEach(d => {
          if (grouped[d[relationModel.joinColumns[0].propertyPath]]) {
            d[relationModel.propertyPath] =
              grouped[d[relationModel.joinColumns[0].propertyPath]][0]
          }
        })
      } else if (relationModel.isManyToMany) {
        const ids = Arrays.deDuplicate(
          data.map(d =>
            Model.isMongoDB ? (Ids.objectID(d.id) as unknown as ObjectID) : d.id
          )
        )
        const chunks = Arrays.chunk(ids, chunkSize)

        if (relationModel.joinColumns.length === 0) {
          return data
        }

        const pivotRepository =
          self[relationModel.propertyPath]().relationQuery.pivot

        // Get Pivot Table Results
        const promises = []
        for (const pivotIds of chunks) {
          const results = await pivotRepository
            .where(
              relationModel.joinColumns[0].propertyName as TypedPathWrapper<
                Primitives,
                Primitives
              >,
              'in',
              pivotIds
            )
            .get()
          promises.push(results)
        }

        const pivotResults = Arrays.collapse(await Promise.all(promises))

        const uniquePivotIds = pivotResults.map(
          p => p[relationModel.inverseJoinColumns[0].propertyName]
        )

        const relationChunks = Arrays.chunk(uniquePivotIds, chunkSize)
        // Get relationship table results from
        const relationPromises = []
        for (const relatedIds of relationChunks) {
          const results = await Model.andWhere(
            Model._keys.id as TypedPathWrapper<Primitives, Primitives>,
            'in',
            relatedIds
          ).get()
          relationPromises.push(results)
        }

        const relatedResults = Arrays.collapse(
          await Promise.all(relationPromises)
        )

        const groupedPivot = Arrays.groupBy(
          pivotResults,
          r => r[relationModel.joinColumns[0].propertyName]
        )
        const groupedRelated = Arrays.groupBy(relatedResults, r => r.id)

        data.forEach(d => {
          groupedPivot[d.id]?.forEach(gp => {
            d[relationModel.propertyPath] =
              groupedRelated[
                gp[relationModel.inverseJoinColumns[0].propertyName]
              ]
          })
        })
      }
    }
  }

  return data
}