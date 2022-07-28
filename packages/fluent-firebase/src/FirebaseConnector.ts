import * as admin from 'firebase-admin'
import { BaseFirestoreRepository, getRepository } from 'fireorm'
import { FieldPath } from '@google-cloud/firestore'
import {
  AnyObject,
  FluentQuery,
  getRelationsFromModelGenerator,
  LogicOperator,
  modelGeneratorDataSource,
  PaginatedData,
  Paginator,
  QueryOutput
} from '@goatlab/fluent'
import {
  BaseConnector,
  FluentConnectorInterface,
  getOutputKeys,
  loadRelations
} from '@goatlab/fluent'
import { Objects, Ids, Arrays } from '@goatlab/js-utils'
import { z } from 'zod'

/**
 * Creates a repository from the given Entity
 * @param Entity
 * @param dataSource
 */
export const createFirebaseRepository = Entity => {
  const repository = getRepository(Entity)

  let name = ''
  let path = ''
  const relations = {}

  try {
    const parsed = JSON.parse(JSON.stringify(repository))
    name = parsed.colMetadata.name
    path = parsed.path
  } catch (error) {
    name = ''
  }
  return {
    repository,
    name,
    path,
    relations
  }
}

export interface FirebaseConnectorParams<Input, Output> {
  entity: any
  inputSchema: z.ZodType<Input>
  outputSchema?: z.ZodType<Output>
}

/**
 *
 */
export class FirebaseConnector<
    ModelDTO = AnyObject,
    InputDTO = ModelDTO,
    OutputDTO = InputDTO
  >
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO>
{
  private readonly inputSchema: z.ZodType<InputDTO>

  private readonly outputSchema: z.ZodType<OutputDTO>
  private repository: BaseFirestoreRepository<any>

  private readonly collection: FirebaseFirestore.CollectionReference<ModelDTO>

  constructor({
    entity,
    inputSchema,
    outputSchema
  }: FirebaseConnectorParams<InputDTO, OutputDTO>) {
    super()
    this.inputSchema = inputSchema
    this.outputSchema =
      outputSchema || (inputSchema as unknown as z.ZodType<OutputDTO>)

    const { repository, name } = createFirebaseRepository(entity)

    this.repository = repository

    this.collection = admin
      .firestore()
      .collection(name) as FirebaseFirestore.CollectionReference<ModelDTO>

    const relationShipBuilder = modelGeneratorDataSource.getRepository(entity)

    const { relations } = getRelationsFromModelGenerator(relationShipBuilder)

    this.modelRelations = relations

    this.outputKeys = getOutputKeys(relationShipBuilder) || []
  }
  /**
   * Insert the data object into the database.
   * @param data
   */
  public async insert(data: InputDTO): Promise<OutputDTO> {
    // Validate Input
    const validatedData = this.inputSchema.parse(data)

    // Only Way to Skip the DeepPartial requirement from TypeORm
    const datum = await this.repository.create({
      id: data['id'] || Ids.objectIdString(),
      ...validatedData
    })

    // Validate Output
    return this.outputSchema.parse(
      this.clearEmpties(Objects.deleteNulls(datum))
    )
  }

  public async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    const validatedData = this.inputSchema.array().parse(data)

    const batch = this.repository.createBatch()
    const batchInserted: InputDTO[] = []
    validatedData.forEach(d => {
      const id: string = d['id'] || Ids.objectIdString()
      // const created = new Date()
      // const updated = new Date()
      // const version = 1
      batchInserted.push({ id, ...d })
      batch.create({ id, ...d })
    })

    await batch.commit()

    return this.outputSchema.array().parse(
      batchInserted.map(d => {
        return this.clearEmpties(Objects.deleteNulls(d))
      })
    )
  }

  /**
   *
   * Returns the Firebase Repository, you can use it
   * form more complex queries and to get
   * the TypeOrm query builder
   *
   * @param query
   */
  public raw(): BaseFirestoreRepository<any> {
    return this.repository
  }

  public async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO, OutputDTO>> {
    const [andQuery, orQueries] = this.getGeneratedQueries(query)
    const results: admin.firestore.DocumentData[] = []

    if (andQuery) {
      const snapshot = await andQuery.get()
      snapshot.forEach(doc => {
        results.push(doc.data())
      })
    }

    const promises: Promise<
      admin.firestore.QuerySnapshot<admin.firestore.DocumentData>
    >[] = []

    for (const orQuery of orQueries) {
      promises.push(orQuery.get())
    }

    const orSnapshots = await Promise.all(promises)

    for (const orSnapshot of orSnapshots) {
      orSnapshot.forEach(doc => {
        results.push(doc.data())
      })
    }

    // As there might be duplicated results from the queries,
    // we will deduplicate by ID
    const found = [...new Map(results.map(v => [v.id, v])).values()]

    found.map(d => {
      this.clearEmpties(Objects.deleteNulls(d))
    })

    if (query?.paginated) {
      const paginationInfo: PaginatedData<QueryOutput<T, ModelDTO, OutputDTO>> =
        {
          total: 0,
          perPage: query.paginated.perPage,
          currentPage: query.paginated.page,
          nextPage: query.paginated.page + 1,
          firstPage: 1,
          lastPage: Math.ceil(0 / query.paginated.perPage),
          prevPage:
            query.paginated.page === 1 ? null : query.paginated.page - 1,
          from: (query.paginated.page - 1) * query.paginated.perPage + 1,
          to: query.paginated.perPage * query.paginated.page,
          data: found as unknown as QueryOutput<T, ModelDTO, OutputDTO>[]
        }

      return paginationInfo as unknown as QueryOutput<T, ModelDTO, OutputDTO>
    }

    if (query?.select) {
      // TODO: validate based on the select properties
      return found as unknown as QueryOutput<T, ModelDTO, OutputDTO>
    }
    // Validate Output against schema
    return this.outputSchema?.array().parse(found) as unknown as QueryOutput<
      T,
      ModelDTO,
      OutputDTO
    >
  }

  /**
   *
   */
  private getGeneratedQueries(
    query?: FluentQuery<ModelDTO>
  ): [FirebaseFirestore.Query | undefined, FirebaseFirestore.Query[]] {
    let { andWhere, orWhere } = this.getFirebaseWhereQuery(query?.where)

    let mergedQueries: FirebaseFirestore.Query[] = []

    if (andWhere) {
      mergedQueries = [andWhere, ...orWhere]
    } else {
      mergedQueries = orWhere
    }

    const select = Object.keys(Objects.flatten(query?.select || {}))

    for (const [index] of mergedQueries.entries()) {
      if (select?.length > 0) {
        // Force select the ID
        mergedQueries[index] = mergedQueries[index].select(...['id', ...select])
      }

      mergedQueries[index] = mergedQueries[index].limit(query?.limit || 10)
      mergedQueries[index] = mergedQueries[index].offset(query?.offset || 0)

      if (query?.orderBy) {
        for (const order of query?.orderBy!) {
          const flattenObject = Objects.flatten(order)
          for (const attribute of Object.keys(flattenObject)) {
            mergedQueries[index] = mergedQueries[index].orderBy(
              attribute,
              flattenObject[attribute]
            )
          }
        }
      }
    }

    const cloned = [...mergedQueries]

    if (andWhere) {
      cloned.shift()
    }

    return [andWhere ? mergedQueries[0] : undefined, cloned]
  }

  private getFirebaseWhereQuery(where?: FluentQuery<ModelDTO>['where']): {
    andWhere?: FirebaseFirestore.Query
    orWhere: FirebaseFirestore.Query[]
  } {
    if (!where || Object.keys(where).length === 0) {
      return { andWhere: this.collection, orWhere: [] }
    }

    // Every element of the array is an OR
    let andWhereQuery: FirebaseFirestore.Query = this.collection
    let orWhereQueries: FirebaseFirestore.Query[] = []

    const orConditions = this.extractConditions(where['OR'])
    const andConditions = this.extractConditions(where['AND'])

    const copy = Objects.clone(where)
    if (!!copy['AND']) {
      delete copy['AND']
    }

    if (!!copy['OR']) {
      delete copy['OR']
    }

    const rootLevelConditions = this.extractConditions([copy])

    // We can merge root level and And conditions in the same query
    for (const condition of andConditions) {
      const { element, operator, value } = condition

      switch (operator) {
        case LogicOperator.equals:
          andWhereQuery = andWhereQuery.where(element, '==', value)
          break
        case LogicOperator.isNot:
          andWhereQuery = andWhereQuery.where(element, '!=', value)
          break
        case LogicOperator.greaterThan:
          andWhereQuery = andWhereQuery.where(element, '>', value)
          break
        case LogicOperator.greaterOrEqualThan:
          andWhereQuery = andWhereQuery.where(element, '>=', value)
          break
        case LogicOperator.lessThan:
          andWhereQuery = andWhereQuery.where(element, '<', value)
          break
        case LogicOperator.lessOrEqualThan:
          andWhereQuery = andWhereQuery.where(element, '<=', value)
          break
        case LogicOperator.in:
          andWhereQuery = andWhereQuery.where(element, 'in', value)
          break
        case LogicOperator.arrayContains:
          andWhereQuery = andWhereQuery.where(element, 'array-contains', value)
          break
        case LogicOperator.notIn:
          andWhereQuery = andWhereQuery.where(element, 'not-in', value)
          break
        case LogicOperator.exists:
          throw new Error('The nin Operator cannot be used in Firabase')
        case LogicOperator.notExists:
          throw new Error('The !exists Operator cannot be used in Firabase')
        case LogicOperator.regexp:
          throw new Error('The regexp Operator cannot be used in Firabase')
        default:
          throw new Error('The regexp Operator cannot be used in Firabase')
      }
    }

    for (const condition of rootLevelConditions) {
      const { element, operator, value } = condition

      switch (operator) {
        case LogicOperator.equals:
          andWhereQuery = andWhereQuery.where(element, '==', value)
          break
        case LogicOperator.isNot:
          andWhereQuery = andWhereQuery.where(element, '!=', value)
          break
        case LogicOperator.greaterThan:
          andWhereQuery = andWhereQuery.where(element, '>', value)
          break
        case LogicOperator.greaterOrEqualThan:
          andWhereQuery = andWhereQuery.where(element, '>=', value)
          break
        case LogicOperator.lessThan:
          andWhereQuery = andWhereQuery.where(element, '<', value)
          break
        case LogicOperator.lessOrEqualThan:
          andWhereQuery = andWhereQuery.where(element, '<=', value)
          break
        case LogicOperator.in:
          andWhereQuery = andWhereQuery.where(element, 'in', value)
          break
        case LogicOperator.arrayContains:
          andWhereQuery = andWhereQuery.where(element, 'array-contains', value)
          break
        case LogicOperator.notIn:
          andWhereQuery = andWhereQuery.where(element, 'not-in', value)
          break
        case LogicOperator.exists:
          throw new Error('The nin Operator cannot be used in Firabase')
        case LogicOperator.notExists:
          throw new Error('The !exists Operator cannot be used in Firabase')
        case LogicOperator.regexp:
          throw new Error('The regexp Operator cannot be used in Firabase')
        default:
          throw new Error('The regexp Operator cannot be used in Firabase')
      }
    }

    // Each or query needs to be an independent query in Firebase
    for (const condition of orConditions) {
      const { element, operator, value } = condition

      let orQuery: FirebaseFirestore.Query = this.collection

      switch (operator) {
        case LogicOperator.equals:
          orQuery = orQuery.where(element, '==', value)
          break
        case LogicOperator.isNot:
          orQuery = orQuery.where(element, '!=', value)
          break
        case LogicOperator.greaterThan:
          orQuery = orQuery.where(element, '>', value)
          break
        case LogicOperator.greaterOrEqualThan:
          orQuery = orQuery.where(element, '>=', value)
          break
        case LogicOperator.lessThan:
          orQuery = orQuery.where(element, '<', value)
          break
        case LogicOperator.lessOrEqualThan:
          orQuery = orQuery.where(element, '<=', value)
          break
        case LogicOperator.in:
          orQuery = orQuery.where(element, 'in', value)
          break
        case LogicOperator.arrayContains:
          orQuery = orQuery.where(element, 'array-contains', value)
          break
        case LogicOperator.notIn:
          orQuery = orQuery.where(element, 'not-in', value)
          break
        case LogicOperator.exists:
          throw new Error('The nin Operator cannot be used in Firabase')
        case LogicOperator.notExists:
          throw new Error('The !exists Operator cannot be used in Firabase')
        case LogicOperator.regexp:
          throw new Error('The regexp Operator cannot be used in Firabase')
        default:
          throw new Error('The regexp Operator cannot be used in Firabase')
      }

      orWhereQueries.push(orQuery)
    }

    let andWhereCondition: FirebaseFirestore.Query | undefined = undefined

    if (
      !andConditions?.length &&
      !rootLevelConditions?.length &&
      !orConditions?.length
    ) {
      andWhereCondition = this.collection
    }

    if (andConditions?.length || rootLevelConditions?.length) {
      andWhereCondition = andWhereQuery
    }

    return {
      andWhere: andWhereCondition,
      orWhere: orWhereQueries
    }
  }

  /**
   * PATCH operation
   * @param data
   */
  public async updateById(id: string, data: InputDTO): Promise<OutputDTO> {
    const dataToInsert = this.outputKeys.includes('updated')
      ? {
          ...data,
          ...{ updated: new Date() }
        }
      : data

    const validatedData = this.inputSchema.parse(dataToInsert)

    await this.collection.doc(id).update(validatedData)

    const dbResult = await this.repository.findById(id)

    // Validate Output
    return this.outputSchema?.parse(
      this.clearEmpties(Objects.deleteNulls(dbResult))
    )
  }

  /**
   *
   * PUT operation. All fields not included in the data
   *  param will be set to null
   *
   * @param id
   * @param data
   */
  public async replaceById(id: string, data: InputDTO): Promise<OutputDTO> {
    const value = await this.repository.findById(id)

    const flatValue = Objects.flatten(JSON.parse(JSON.stringify(value)))

    Object.keys(flatValue).forEach(key => {
      flatValue[key] = null
    })

    const nullObject = Objects.nest(flatValue)

    const newValue = { ...nullObject, ...data }

    delete newValue._id
    delete newValue.id
    delete newValue.created
    delete newValue.updated

    const dataToInsert = this.outputKeys.includes('updated')
      ? {
          ...data,
          ...{ updated: new Date() }
        }
      : data

    const validatedData = this.inputSchema.parse(dataToInsert)

    await this.collection.doc(id).update(validatedData)

    const val = await this.repository.findById(id)

    return this.outputSchema.parse(this.clearEmpties(Objects.deleteNulls(val)))
  }

  public async clear() {
    const query = this.collection.orderBy('__name__').limit(300)
    return new Promise((resolve, reject) => {
      this.deleteQueryBatch(admin.firestore(), query, 300, resolve, reject)
    })
  }

  private deleteQueryBatch(db, query, batchSize, resolve, reject) {
    query
      .get()
      .then(snapshot => {
        // When there are no documents left, we are done
        if (snapshot.size == 0) {
          return 0
        }

        // Delete documents in a batch
        const batch = db.batch()
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref)
        })

        return batch.commit().then(() => snapshot.size)
      })
      .then(numDeleted => {
        if (numDeleted === 0) {
          resolve()
          return
        }

        // Recurse on the next process tick, to avoid
        // exploding the stack.
        process.nextTick(() => {
          this.deleteQueryBatch(db, query, batchSize, resolve, reject)
        })
      })
      .catch(reject)
  }

  // /**
  //  *
  //  * PUT operation. All fields not included in the data
  //  *  param will be set to null
  //  *
  //  * @param id
  //  * @param data
  //  */
  // public async replaceById(id: string, data: InputDTO): Promise<OutputDTO> {
  //   const parsedId = id

  //   const value = await this.repository.findById(parsedId)

  //   const flatValue = Objects.flatten(JSON.parse(JSON.stringify(value)))

  //   Object.keys(flatValue).forEach(key => {
  //     if (key !== 'id') {
  //       flatValue[key] = null
  //     }
  //   })

  //   const nullObject = Objects.nest(flatValue)

  //   const newValue = { ...nullObject, ...data }

  //   delete newValue.created
  //   delete newValue.updated

  //   const entity = { ...newValue /* ...{ updated: new Date() } */ }

  //   await this.repository.update(entity)

  //   const val = await this.repository.findById(parsedId)

  //   const returnValue = this.jsApplySelect([val]) as OutputDTO[]

  //   return returnValue[0]
  // }

  // /**
  //  *
  //  * @param param0
  //  */

  // /**
  //  *
  //  * @param id
  //  */
  // public async deleteById(id: string): Promise<string> {
  //   const parsedId = id

  //   await this.repository.delete(parsedId)

  //   return id
  // }

  // /**
  //  *
  //  * @param id
  //  */
  // public async findById(id: string): Promise<OutputDTO> {
  //   const parsedId = id

  //   const data = await this.repository.findById(parsedId)

  //   const result = this.jsApplySelect(data) as OutputDTO[]

  //   if (result.length === 0) {
  //     return null
  //   }

  //   return result[0]
  // }

  // public async findByIds(ids: string[]): Promise<OutputDTO[] | null> {
  //   const data = await this.raw().where('id', 'in', ids).get()
  //   if (data.empty) {
  //     return null
  //   }
  //   const res = []
  //   data.forEach(doc => {
  //     res.push(doc.data())
  //   })
  //   const results = this.jsApplySelect(res) as OutputDTO[]

  //   return results
  // }

  // /**
  //  *
  //  */
  // private getPopulate() {
  //   const populate = []
  //   this.populateArray.forEach(relation => {
  //     if (typeof relation === 'string') {
  //       populate.push({ relation })
  //     } else if (Array.isArray(relation)) {
  //       relation.forEach(nestedRelation => {
  //         if (typeof nestedRelation === 'string') {
  //           populate.push({ relation: nestedRelation })
  //         } else if (typeof nestedRelation === 'object') {
  //           populate.push(nestedRelation)
  //         }
  //       })
  //     } else if (typeof relation === 'object') {
  //       populate.push(relation)
  //     }
  //   })

  //   return populate
  // }
}
