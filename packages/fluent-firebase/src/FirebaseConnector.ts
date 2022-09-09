import * as admin from 'firebase-admin'
import { UpdateData } from '@google-cloud/firestore'
import {
  AnyObject,
  extractConditions,
  FluentQuery,
  getRelationsFromModelGenerator,
  LoadedResult,
  LogicOperator,
  modelGeneratorDataSource,
  PaginatedData,
  QueryOutput
} from '@goatlab/fluent'
import {
  BaseConnector,
  FluentConnectorInterface,
  getOutputKeys,
  loadRelations
} from '@goatlab/fluent'
import { Objects, Ids } from '@goatlab/js-utils'
import { z } from 'zod'

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

  private readonly collection: FirebaseFirestore.CollectionReference<ModelDTO>

  private readonly entity: any

  constructor({
    entity,
    inputSchema,
    outputSchema
  }: FirebaseConnectorParams<InputDTO, OutputDTO>) {
    super()
    this.inputSchema = inputSchema
    this.outputSchema =
      outputSchema || (inputSchema as unknown as z.ZodType<OutputDTO>)

    this.entity = entity

    const relationShipBuilder = modelGeneratorDataSource.getRepository(entity)

    const name = relationShipBuilder.metadata.givenTableName

    if (!name) {
      throw new Error(
        `Could not find table by name. Did you include @f.entity in your model?`
      )
    }

    this.collection = admin
      .firestore()
      .collection(name) as FirebaseFirestore.CollectionReference<ModelDTO>

    const { relations } = getRelationsFromModelGenerator(relationShipBuilder)

    this.modelRelations = relations

    this.outputKeys = getOutputKeys(relationShipBuilder) || []
  }
  // CREATE

  /**
   * Insert the data object into the database.
   * @param data
   */
  public async insert(data: InputDTO): Promise<OutputDTO> {
    // Validate Input
    const validatedData = this.inputSchema.parse(data)

    if (data['id']) {
      const found = await this.findById(data['id'])

      if (found) {
        throw new Error(`A document with id ${found[0]['id']} already exists.`)
      }
    }

    const id: string = data['id'] || Ids.objectIdString()
    const item = {
      id,
      ...validatedData
    } as unknown as ModelDTO

    await this.collection.doc(id).set(item)

    // Validate Output
    return this.outputSchema.parse(
      Objects.clearEmpties(Objects.deleteNulls(item))
    )
  }

  public async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    const validatedData = this.inputSchema.array().parse(data)

    const batch = admin.firestore().batch()
    const batchInserted: ModelDTO[] = []
    validatedData.forEach(d => {
      const id: string = d['id'] || Ids.objectIdString()
      const item = { id, ...d } as unknown as ModelDTO
      const insert = this.collection.doc(id)
      batch.set(insert, item)
      batchInserted.push(item) as unknown as InputDTO[]
    })

    await batch.commit()

    return this.outputSchema.array().parse(
      batchInserted.map(d => {
        return Objects.clearEmpties(Objects.deleteNulls(d))
      })
    )
  }

  // READ

  public async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>[]> {
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
    let found = [...new Map(results.map(v => [v.id, v])).values()]

    found.map(d => {
      Objects.clearEmpties(Objects.deleteNulls(d))
    })

    if (query?.include) {
      found = await this.loadRelatedData(
        found,
        Objects.flatten(query?.include || {})
      )
    }

    if (query?.paginated) {
      const paginationInfo: PaginatedData<QueryOutput<T, ModelDTO>> = {
        total: 0,
        perPage: query.paginated.perPage,
        currentPage: query.paginated.page,
        nextPage: query.paginated.page + 1,
        firstPage: 1,
        lastPage: Math.ceil(0 / query.paginated.perPage),
        prevPage: query.paginated.page === 1 ? null : query.paginated.page - 1,
        from: (query.paginated.page - 1) * query.paginated.perPage + 1,
        to: query.paginated.perPage * query.paginated.page,
        data: found as unknown as QueryOutput<T, ModelDTO>[]
      }

      return paginationInfo as unknown as Promise<QueryOutput<T, ModelDTO>[]>
    }

    if (query?.select) {
      // TODO: validate based on the select properties
      return found as unknown as QueryOutput<T, ModelDTO>[]
    }
    // Validate Output against schema
    return this.outputSchema?.array().parse(found) as unknown as QueryOutput<
      T,
      ModelDTO
    >[]
  }

  // UPDATE

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

    await this.collection.doc(id).update({
      ...validatedData,
      id
    } as unknown as UpdateData<ModelDTO>)

    const dbResult = await this.findById(id)

    if (!dbResult) {
      throw new Error(`Object not found: ${id}`)
    }

    // Validate Output
    return this.outputSchema?.parse(
      Objects.clearEmpties(Objects.deleteNulls(dbResult))
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
    const value = await this.findById(id)

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

    await this.collection
      .doc(id)
      .update(validatedData as unknown as UpdateData<ModelDTO>)

    // TODO: do we need to pull the info again?
    const val = await this.requireById(id)

    return this.outputSchema.parse(
      Objects.clearEmpties(Objects.deleteNulls(val))
    )
  }

  // DELETE

  public async deleteById(id: string): Promise<string> {
    await this.collection.doc(id).delete()
    return id
  }

  public async clear() {
    const query = this.collection.orderBy('__name__').limit(300)
    return new Promise((resolve, reject) => {
      this.deleteQueryBatch(admin.firestore(), query, 300, resolve, reject)
    }) as Promise<boolean>
  }

  // RELATIONS

  public loadFirst(query?: FluentQuery<ModelDTO>) {
    // Create a clone of the original class
    // to avoid polluting attributes (relatedQuery)
    const newInstance = this.clone()

    newInstance.setRelatedQuery({
      entity: this.entity,
      repository: this,
      query: {
        ...query,
        limit: 1
      }
    })

    return newInstance as LoadedResult<this>
  }

  public loadById(id: string) {
    // Create a new instance to avoid polluting the original one
    const newInstance = this.clone()

    newInstance.setRelatedQuery({
      entity: this.entity,
      repository: this,
      query: {
        where: {
          id
        }
      } as unknown as FluentQuery<ModelDTO>
    })

    return newInstance as LoadedResult<this>
  }

  /**
   *
   * Returns the firebase-admin collection, you can use it
   * for more complex queries that require the base library
   *
   * @param query
   */
  public raw(): admin.firestore.CollectionReference<ModelDTO> {
    return this.collection
  }

  public rawFirebase(): admin.firestore.Firestore {
    return admin.firestore()
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

  /**
   * Creates a Clone of the current instance of the class
   * @returns
   */
  protected clone() {
    return new (<any>this.constructor)()
  }
  //////////////////////////////////////////////////////////////
  // ALL OF THESE METHODS PROBABLY SHOULD BE IN SOMEWHERE ELSE
  //////////////////////////////////////////////////////////////

  protected async loadRelatedData(
    data: any[],
    loadedKeys: AnyObject
  ): Promise<admin.firestore.DocumentData[]> {
    const result = await loadRelations({
      data,
      relations: loadedKeys,
      modelRelations: this.modelRelations,
      provider: 'firebase',
      self: this,
      returnPivot: false
    })

    return result as unknown as admin.firestore.DocumentData[]
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

    const orConditions = extractConditions(where['OR'])
    const andConditions = extractConditions(where['AND'])

    const copy = Objects.clone(where)
    if (!!copy['AND']) {
      delete copy['AND']
    }

    if (!!copy['OR']) {
      delete copy['OR']
    }

    const rootLevelConditions = extractConditions([copy])

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

    // If there is no query, just return the collection
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
}
