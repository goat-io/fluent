import { DataSource, ObjectID } from 'typeorm'
import { TypedPathWrapper } from 'typed-path'
import { Arrays, Ids } from '@goatlab/js-utils'
import type { Primitives } from './types'

interface RelationshipLoader {
  data: any[]
  relations: any
  modelRelations: any
  dataSource?: DataSource
  provider?: 'typeorm' | 'firebase'
  self: any
  returnPivot?: boolean
}

export const loadRelations = async ({
  data,
  relations,
  modelRelations,
  provider,
  self,
  returnPivot
}: RelationshipLoader): Promise<any[]> => {
  if (!relations) {
    return data
  }

  // Firebase has a 10 query limit
  const chunkSize = provider === 'typeorm' ? 100 : 10

  for (const relation of Object.keys(relations)) {
    if (modelRelations[relation]) {
      const relationModel = modelRelations[relation]
      const Model = new relations[relation]()

      if (relationModel.isOneToMany) {
        const ids = new Set(
          data.map(d =>
            Model.isMongoDB ? (Ids.objectID(d.id) as unknown as ObjectID) : d.id
          )
        )
        const chunks = Arrays.chunk(Array.from(ids), chunkSize)
        // TODO we can make this calls at the same time...no need to wait for each one
        const promises: any[] = []

        for (const relatedIds of chunks) {
          const results = await Model.andWhere(
            keys => keys[relationModel.inverseSidePropertyPath],
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
        const promises: any[] = []
        for (const relatedIds of chunks) {
          const results = await Model.andWhere(
            keys => keys.id,
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
        const promises : any[]= []
        for (const pivotIds of chunks) {
          const results = await pivotRepository
            .where(
              k => k[relationModel.joinColumns[0].propertyName],
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
        const relationPromises: any[] = []
        for (const relatedIds of relationChunks) {
          const results = await Model.andWhere(
            keys => keys.id,
            'in',
            relatedIds
          ).get()

          relationPromises.push(results)
        }

        let relatedResults = Arrays.collapse(
          await Promise.all(relationPromises)
        )

        const pivotInverseKey = relationModel.inverseJoinColumns[0].propertyName
        relatedResults = relatedResults.map(r => {
          return {
            ...r,
            pivot: pivotResults.find(p => p[pivotInverseKey] === r.id)
          }
        })

        const groupedPivot = Arrays.groupBy(
          pivotResults,
          r => r[relationModel.joinColumns[0].propertyName]
        )

        const groupedRelated = Arrays.groupBy(relatedResults, r => r.id)

        data.forEach(d => {
          groupedPivot[d.id]?.forEach(gp => {
            if (!d[relationModel.propertyPath]) {
              d[relationModel.propertyPath] = []
            }
            d[relationModel.propertyPath] = [
              ...d[relationModel.propertyPath],
              ...groupedRelated[
                gp[relationModel.inverseJoinColumns[0].propertyName]
              ]
            ]
          })
        })
      }
    }
  }

  return data
}
