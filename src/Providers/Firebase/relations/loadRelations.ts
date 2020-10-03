import { Arrays } from '../../../Helpers/Arrays'
import { FirebaseConnector } from '../FirebaseConnector'
import { ObjectID } from 'typeorm'
import { ObjectId } from 'mongodb'
import { Primitives } from '../../../Providers/types'
import { TypeOrmConnector } from '../../../Providers/TypeOrm/TypeOrmConnector'
import { TypedPathWrapper } from 'typed-path'

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
      const Model =
        provider === 'typeorm'
          ? new TypeOrmConnector(
              relationModel.targetClass,
              connectionName || 'default'
            )
          : new FirebaseConnector(relationModel.targetClass)

      if (relationModel.isOneToMany) {
        const ids = Arrays.deDuplicate(
          data.map(d =>
            Model.isMongoDB ? (new ObjectId(d.id) as ObjectID) : d.id
          )
        )
        const chunks = Arrays.chunk(ids, chunkSize)
        // TODO we can make this calls at the same time...no need to wait for each one

        const promises = []
        for (const relatedIds of chunks) {
          const results = await Model.andWhere(
            Model._keys[
              relationModel.inverseSidePropertyPath
            ] as TypedPathWrapper<Primitives>,
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
            Model._keys.id as TypedPathWrapper<Primitives>,
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
            Model.isMongoDB ? (new ObjectId(d.id) as ObjectID) : d.id
          )
        )
        const chunks = Arrays.chunk(ids, chunkSize)

        if (relationModel.joinColumns.length === 0) {
          return data
        }

        const pivotRepository = self[relationModel.propertyPath]().relationQuery
          .pivot

        // Get Pivot Table Results
        const promises = []
        for (const pivotIds of chunks) {
          const results = await pivotRepository
            .where(
              relationModel.joinColumns[0].propertyName as TypedPathWrapper<
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
            Model._keys.id as TypedPathWrapper<Primitives>,
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
          groupedPivot[d.id].forEach(gp => {
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
