import { Arrays } from '@goatlab/js-utils'
import { AnyObject } from '@goatlab/js-utils/dist/types'
import { DataSource } from 'typeorm'

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
}: RelationshipLoader): Promise<any[]> => {
  if (!relations) {
    return data
  }

  // Firebase has a 10 query limit
  const chunkSize = provider === 'typeorm' ? 100 : 10

  for (const relation of Object.keys(relations)) {
    validateRelation(relation, modelRelations, self)

    const relationModel = modelRelations[relation]
    const Repository = self[relation]()

    if (relationModel.isOneToMany) {
      data = await loadOneToManyRelation(
        data,
        relationModel,
        Repository,
        chunkSize,
      )
    } else if (relationModel.isManyToOne) {
      data = await loadManyToOneRelation(
        data,
        relationModel,
        Repository,
        chunkSize,
      )
    } else if (relationModel.isManyToMany) {
      data = await loadManyToManyRelation(
        data,
        relationModel,
        Repository,
        self,
        chunkSize,
      )
    }
  }

  return data
}

function validateRelation(relation: string, modelRelations: any, self: any) {
  if (!modelRelations[relation]) {
    throw new Error(
      `Relationship does not exist: ${relation}. Did you create it in your DB entity?`,
    )
  }

  if (!self[relation]) {
    throw new Error(
      `Relationship does not exist: ${relation}. Did you create it in your Repository?`,
    )
  }
}

async function loadOneToManyRelation(
  data: any[],
  relationModel: any,
  Repository: any,
  chunkSize: number,
): Promise<any[]> {
  const ids = new Set(data.map(d => d.id))
  const chunks = Arrays.chunk(Array.from(ids), chunkSize)

  const promises = chunks.map(relatedIds =>
    Repository.findMany({
      where: {
        [relationModel.inverseSidePropertyPath]: {
          in: relatedIds,
        },
      },
    }),
  )

  const relatedResults: AnyObject[] = Arrays.collapse(
    await Promise.all(promises),
  )

  const grouped = Arrays.groupBy(
    relatedResults,
    r => r[relationModel.inverseSidePropertyPath],
  )

  return data.map(d => {
    if (grouped[d.id]) {
      d[relationModel.propertyName] = grouped[d.id]
    }
    return d
  })
}

async function loadManyToOneRelation(
  data: any[],
  relationModel: any,
  Repository: any,
  chunkSize: number,
): Promise<any[]> {
  const ids = Arrays.deDuplicate(
    data.map(d => d[relationModel.joinColumns[0].propertyPath]),
  )
  const chunks = Arrays.chunk(ids, chunkSize)

  const promises = chunks.map(relatedIds =>
    Repository.findMany({
      where: {
        id: {
          in: relatedIds,
        },
      },
    }),
  )

  const relatedResults: AnyObject[] = Arrays.collapse(
    await Promise.all(promises),
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

async function loadManyToManyRelation(
  data: any[],
  relationModel: any,
  Repository: any,
  self: any,
  chunkSize: number,
): Promise<any[]> {
  const ids = Arrays.deDuplicate(data.map(d => d.id))
  const chunks = Arrays.chunk(ids, chunkSize)

  if (relationModel.joinColumns.length === 0) {
    return data
  }

  const pivotData = getPivotData(self, relationModel, Repository)

  // Get Pivot Table Results
  const pivotResults = await loadPivotResults(
    chunks,
    pivotData.pivotForeignField,
    pivotData.pivotRepository,
  )

  // Get relationship table results
  const relatedResults = await loadRelatedResults(
    pivotResults,
    relationModel,
    Repository,
    chunkSize,
  )

  // Map results back to data
  mapManyToManyResults(
    data,
    pivotResults,
    relatedResults,
    relationModel,
    pivotData.calleeKey,
  )

  return data
}

function getPivotData(self: any, relationModel: any, Repository: any) {
  const pivotForeignField =
    self.modelRelations[relationModel.propertyName].joinColumns[0].propertyPath

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
      'The Many-to-Many relationship is not properly defined.Please check both your Model and Repository',
    )
  }

  return {
    pivotForeignField,
    inverseForeignField,
    pivotRepository,
    calleeKey,
  }
}

async function loadPivotResults(
  chunks: any[][],
  pivotForeignField: string,
  pivotRepository: any,
): Promise<AnyObject[]> {
  const promises = chunks.map(pivotIds =>
    pivotRepository.findMany({
      where: {
        [pivotForeignField]: {
          in: pivotIds,
        },
      },
    }),
  )

  return Arrays.collapse(await Promise.all(promises))
}

async function loadRelatedResults(
  pivotResults: AnyObject[],
  relationModel: any,
  Repository: any,
  chunkSize: number,
): Promise<AnyObject[]> {
  const inverseForeignField = relationModel.inverseJoinColumns[0].propertyPath

  const uniquePivotIds = pivotResults.map(p => p[inverseForeignField])
  const relationChunks = Arrays.chunk(uniquePivotIds, chunkSize)

  const relationPromises = relationChunks.map(relatedIds =>
    Repository.findMany({
      where: {
        id: {
          in: relatedIds,
        },
      },
    }),
  )

  const relatedResults: AnyObject[] = Arrays.collapse(
    await Promise.all(relationPromises),
  )

  return relatedResults.map(r => ({
    ...r,
    pivot: pivotResults.find(p => p[inverseForeignField] === r.id),
  }))
}

function mapManyToManyResults(
  data: any[],
  pivotResults: AnyObject[],
  relatedResults: AnyObject[],
  relationModel: any,
  calleeKey: string,
) {
  const groupedPivot = Arrays.groupBy(
    pivotResults,
    r => r[relationModel.joinColumns[0].propertyName],
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
}
