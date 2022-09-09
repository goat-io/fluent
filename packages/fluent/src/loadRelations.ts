import { DataSource } from 'typeorm'
import { Arrays } from '@goatlab/js-utils'
import { AnyObject } from '@goatlab/js-utils/dist/types'

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
    if (!modelRelations[relation]) {
      throw new Error(
        `Relationship does not exist: ${relation}. Did you create it in your DB entity?`
      )
    }

    if (!self[relation]) {
      throw new Error(
        `Relationship does not exist: ${relation}. Did you create it in your Repository?`
      )
    }

    const relationModel = modelRelations[relation]
    const Repository = self[relation]()

    if (relationModel.isOneToMany) {
      const ids = new Set(data.map(d => d.id))

      const chunks = Arrays.chunk(Array.from(ids), chunkSize)

      const promises: any[] = []
      for (const relatedIds of chunks) {
        //TODO: NESTED MODEL FILTERS
        // Here is where we could define nested model filters!!!!
        promises.push(
          Repository.findMany({
            where: {
              [relationModel.inverseSidePropertyPath]: {
                in: relatedIds
              }
            }
          })
        )
      }

      const relatedResults: AnyObject[] = Arrays.collapse(
        await Promise.all(promises)
      )

      const grouped = Arrays.groupBy(
        relatedResults,
        r => r[relationModel.inverseSidePropertyPath]
      )

      data.map(d => {
        if (grouped[d.id]) {
          d[relationModel.propertyName] = grouped[d.id]
        }
        return d
      })

      return data
    }

    if (relationModel.isManyToOne) {
      const ids = Arrays.deDuplicate(
        data.map(d => d[relationModel.joinColumns[0].propertyPath])
      )
      const chunks = Arrays.chunk(ids, chunkSize)

      const promises: any[] = []
      for (const relatedIds of chunks) {
        promises.push(
          Repository.findMany({
            where: {
              id: {
                in: relatedIds
              }
            }
          })
        )
      }

      const relatedResults: AnyObject[] = Arrays.collapse(
        await Promise.all(promises)
      )

      const grouped = Arrays.groupBy(relatedResults, r => r.id)

      data.map(d => {
        if (grouped[d[relationModel.joinColumns[0].propertyPath]]) {
          d[relationModel.propertyName] =
            grouped[d[relationModel.joinColumns[0].propertyPath]]![0]
        }
      })

      return data
    }

    if (relationModel.isManyToMany) {
      const ids = Arrays.deDuplicate(data.map(d => d.id))

      const chunks = Arrays.chunk(ids, chunkSize)

      if (relationModel.joinColumns.length === 0) {
        return data
      }

      const pivotForeignField =
        self.modelRelations[relationModel.propertyName].joinColumns[0]
          .propertyPath

      const inverseForeignField =
        self.modelRelations[relationModel.propertyName].inverseJoinColumns[0]
          .propertyPath

      const pivotRepository = Repository?.relatedQuery.pivot

      const calleeKey = Repository?.relatedQuery.key

      if (
        !pivotForeignField ||
        !inverseForeignField ||
        !pivotRepository ||
        !calleeKey
      ) {
        throw new Error(
          'The Many-to-Many relationship is not properly defined.Please check both your Model and Repository'
        )
      }

      // Get Pivot Table Results
      const promises: any[] = []
      for (const pivotIds of chunks) {
        const results = await pivotRepository.findMany({
          where: {
            [pivotForeignField]: {
              in: pivotIds
            }
          }
        })

        promises.push(results)
      }

      const pivotResults: AnyObject[] = Arrays.collapse(
        await Promise.all(promises)
      )

      const uniquePivotIds = pivotResults.map(p => p[inverseForeignField])

      const relationChunks = Arrays.chunk(uniquePivotIds, chunkSize)

      // Get relationship table results from
      const relationPromises: any[] = []
      for (const relatedIds of relationChunks) {
        const results = await Repository.findMany({
          where: {
            id: {
              in: relatedIds
            }
          }
        })

        relationPromises.push(results)
      }

      let relatedResults: AnyObject[] = Arrays.collapse(
        await Promise.all(relationPromises)
      )

      relatedResults = relatedResults.map(r => {
        return {
          ...r,
          pivot: pivotResults.find(p => p[inverseForeignField] === r.id)
        }
      })

      const groupedPivot = Arrays.groupBy(
        pivotResults,
        r => r[relationModel.joinColumns[0].propertyName]
      )

      const groupedRelated = Arrays.groupBy(relatedResults, r => r.id)

      data.map(d => {
        groupedPivot[d.id]?.forEach(gp => {
          if (!d[calleeKey]) {
            d[calleeKey] = []
          }

          const mapped =
            groupedRelated[gp[relationModel.inverseJoinColumns[0].propertyName]]

          if (mapped) {
            d[calleeKey] = [...d[calleeKey], ...mapped]
          }
        })
      })

      return data
    }
  }

  return data
}
