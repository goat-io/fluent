import {
  AnyObject,
  BaseConnector,
  extractConditions,
  FluentConnectorInterface,
  FluentQuery,
  getOutputKeys,
  getRelationsFromModelGenerator,
  LoadedResult,
  LogicOperator,
  loadRelations,
  modelGeneratorDataSource,
  PaginatedData,
  QueryOutput,
} from '@goatlab/fluent'
import { Ids, Memo, Objects } from '@goatlab/js-utils'
import { UpdateData } from '@google-cloud/firestore'
import * as admin from 'firebase-admin'
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
    ModelDTO extends admin.firestore.DocumentData = AnyObject,
    InputDTO = ModelDTO,
    OutputDTO = InputDTO,
  >
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO>
{
  private readonly inputSchema: z.ZodType<InputDTO>

  private readonly outputSchema: z.ZodType<OutputDTO>

  private collection: FirebaseFirestore.CollectionReference<ModelDTO>

  private readonly entity: any

  constructor({
    entity,
    inputSchema,
    outputSchema,
  }: FirebaseConnectorParams<InputDTO, OutputDTO>) {
    super()
    this.inputSchema = inputSchema
    this.outputSchema =
      outputSchema || (inputSchema as unknown as z.ZodType<OutputDTO>)

    this.entity = entity
  }

  private initialized = false

  @Memo.syncMethod()
  initDB() {
    if (this.initialized) {
      return 1
    }

    // Check if modelGeneratorDataSource is initialized before using it
    if (!modelGeneratorDataSource.isInitialized) {
      throw new Error(
        'modelGeneratorDataSource is not initialized. Please call Fluent.initialize() before using Firebase connectors.',
      )
    }

    const relationShipBuilder = modelGeneratorDataSource.getRepository(
      this.entity,
    )

    const name = relationShipBuilder.metadata.givenTableName

    if (!name) {
      throw new Error(
        `Could not find table by name. Did you include @f.entity in your model?`,
      )
    }

    this.collection = admin
      .firestore()
      .collection(name) as FirebaseFirestore.CollectionReference<ModelDTO>

    const { relations } = getRelationsFromModelGenerator(relationShipBuilder)

    this.modelRelations = relations

    this.outputKeys = getOutputKeys(relationShipBuilder) || []
    this.initialized = true
    return 1
  }
  // CREATE

  /**
   * Insert the data object into the database.
   * @param data
   */
  public async insert(data: InputDTO): Promise<OutputDTO> {
    this.initDB()
    // Validate Input
    const validatedData = (this.inputSchema as any).parse(data)

    if ((data as any).id) {
      const found = await this.findById((data as any).id)

      if (found) {
        throw new Error(`A document with id ${found[0].id} already exists.`)
      }
    }

    const id: string = (data as any).id || Ids.uuid()
    const item = {
      id,
      ...validatedData,
    } as unknown as ModelDTO

    await this.collection.doc(id).set(item)

    // Validate Output
    return this.outputSchema.parse(
      Objects.clearEmpties(Objects.deleteNulls(item)),
    )
  }

  public async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    this.initDB()
    const validatedData = this.inputSchema.array().parse(data)

    const batch = admin.firestore().batch()
    // Pre-allocate array for better performance
    const dataLength = validatedData.length
    const batchInserted: ModelDTO[] = new Array(dataLength)

    for (let i = 0; i < dataLength; i++) {
      const d = validatedData[i]
      if (!d) {
        continue
      }
      const id: string = (d as any).id || Ids.uuid()
      const item = { id, ...d } as unknown as ModelDTO
      batch.set(this.collection.doc(id), item)
      batchInserted[i] = item
    }

    await batch.commit()

    const resultLength = batchInserted.length
    const cleanedResults = new Array(resultLength)
    for (let i = 0; i < resultLength; i++) {
      const item = batchInserted[i]
      if (item) {
        cleanedResults[i] = Objects.clearEmpties(Objects.deleteNulls(item))
      }
    }

    return this.outputSchema.array().parse(cleanedResults)
  }

  // READ

  public async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T,
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    this.initDB()
    const [andQuery, orQueries] = this.getGeneratedQueries(query)
    const results: admin.firestore.DocumentData[] = []

    if (andQuery) {
      const snapshot = await andQuery.get()
      const docs = snapshot.docs
      const docLength = docs.length
      // Pre-allocate space for better performance
      const startIdx = results.length
      results.length = startIdx + docLength
      for (let i = 0; i < docLength; i++) {
        const doc = docs[i]
        if (doc) {
          results[startIdx + i] = doc.data()
        }
      }
    }

    // Execute OR queries in parallel if there are any
    if (orQueries.length > 0) {
      const orSnapshots = await Promise.all(orQueries.map(q => q.get()))

      // Count total docs for pre-allocation
      let totalOrDocs = 0
      for (let i = 0; i < orSnapshots.length; i++) {
        const snapshot = orSnapshots[i]
        if (snapshot) {
          totalOrDocs += snapshot.docs.length
        }
      }

      // Pre-allocate space
      const startIdx = results.length
      results.length = startIdx + totalOrDocs

      let currentIdx = startIdx
      for (let i = 0; i < orSnapshots.length; i++) {
        const orSnapshot = orSnapshots[i]
        if (!orSnapshot) {
          continue
        }
        const docs = orSnapshot.docs
        const docLength = docs.length
        for (let j = 0; j < docLength; j++) {
          const doc = docs[j]
          if (doc) {
            results[currentIdx++] = doc.data()
          }
        }
      }
    }

    // As there might be duplicated results from the queries,
    // we will deduplicate by ID using a more efficient approach
    let found: admin.firestore.DocumentData[]
    if (results.length > 0) {
      const dedupeMap = new Map<string, admin.firestore.DocumentData>()
      const resultsLength = results.length
      for (let i = 0; i < resultsLength; i++) {
        const item = results[i]
        if (item && !dedupeMap.has(item.id)) {
          dedupeMap.set(item.id, item)
        }
      }
      found = Array.from(dedupeMap.values())
    } else {
      found = []
    }

    // Process data cleaning in-place
    const foundLength = found.length
    for (let i = 0; i < foundLength; i++) {
      const item = found[i]
      if (item) {
        Objects.clearEmpties(Objects.deleteNulls(item))
      }
    }

    if (query?.include) {
      found = await this.loadRelatedData(found, Objects.flatten(query.include))
    }

    if (query?.paginated) {
      const perPage = query.paginated.perPage
      const page = query.paginated.page
      const paginationInfo: PaginatedData<QueryOutput<T, ModelDTO>> = {
        total: 0,
        perPage,
        currentPage: page,
        nextPage: page + 1,
        firstPage: 1,
        lastPage: Math.ceil(0 / perPage),
        prevPage: page === 1 ? null : page - 1,
        from: (page - 1) * perPage + 1,
        to: perPage * page,
        data: found as unknown as QueryOutput<T, ModelDTO>[],
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
    this.initDB()
    const dataToInsert = this.outputKeys.includes('updated')
      ? {
          ...data,
          updated: new Date(),
        }
      : data

    const validatedData = (this.inputSchema as any).parse(dataToInsert)

    await this.collection.doc(id).update({
      ...validatedData,
      id,
    } as unknown as UpdateData<ModelDTO>)

    const dbResult = await this.findById(id)

    if (!dbResult) {
      throw new Error(`Object not found: ${id}`)
    }

    // Validate Output
    return this.outputSchema?.parse(
      Objects.clearEmpties(Objects.deleteNulls(dbResult)),
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
    this.initDB()
    const value = await this.findById(id)

    // Avoid JSON parse/stringify overhead - use structured clone if available
    const clonedValue =
      typeof structuredClone !== 'undefined'
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value))
    const flatValue = Objects.flatten(clonedValue)
    const keys = Object.keys(flatValue)
    const keysLength = keys.length

    // Use a more efficient nullification approach
    const nullValue = null as any
    for (let i = 0; i < keysLength; i++) {
      const key = keys[i]
      if (key) {
        flatValue[key] = nullValue
      }
    }

    const nullObject = Objects.nest(flatValue)

    const newValue = { ...nullObject, ...data }

    ;(newValue as any)._id = undefined
    ;(newValue as any).id = undefined
    ;(newValue as any).created = undefined
    ;(newValue as any).updated = undefined

    const dataToInsert = this.outputKeys.includes('updated')
      ? {
          ...data,
          updated: new Date(),
        }
      : data

    const validatedData = (this.inputSchema as any).parse(dataToInsert)

    await this.collection
      .doc(id)
      .update(validatedData as unknown as UpdateData<ModelDTO>)

    // TODO: do we need to pull the info again?
    const val = await this.requireById(id)

    return this.outputSchema.parse(
      Objects.clearEmpties(Objects.deleteNulls(val)),
    )
  }

  // DELETE

  public async deleteById(id: string): Promise<string> {
    this.initDB()
    await this.collection.doc(id).delete()
    return id
  }

  public async clear() {
    this.initDB()
    const query = this.collection.orderBy('__name__').limit(300)
    return new Promise((resolve, reject) => {
      this.deleteQueryBatch(admin.firestore(), query, 300, resolve, reject)
    }) as Promise<boolean>
  }

  // RELATIONS

  public loadFirst(query?: FluentQuery<ModelDTO>) {
    this.initDB()
    // Create a clone of the original class
    // to avoid polluting attributes (relatedQuery)
    const newInstance = this.clone()

    newInstance.setRelatedQuery({
      entity: this.entity,
      repository: this,
      query: {
        ...query,
        limit: 1,
      },
    })

    return newInstance as LoadedResult<this>
  }

  public loadById(id: string) {
    this.initDB()
    // Create a new instance to avoid polluting the original one
    const newInstance = this.clone()

    newInstance.setRelatedQuery({
      entity: this.entity,
      repository: this,
      query: {
        where: {
          id,
        },
      } as unknown as FluentQuery<ModelDTO>,
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
    this.initDB()
    return this.collection
  }

  public rawFirebase(): admin.firestore.Firestore {
    this.initDB()
    return admin.firestore()
  }

  private async deleteQueryBatch(
    db: admin.firestore.Firestore,
    query: FirebaseFirestore.Query,
    batchSize: number,
    resolve: (value?: unknown) => void,
    reject: (reason?: any) => void,
  ) {
    this.initDB()
    try {
      const snapshot = await query.get()
      // When there are no documents left, we are done
      if (snapshot.size === 0) {
        resolve(true)
        return
      }

      // Delete documents in a batch
      const batch = db.batch()
      const docs = snapshot.docs
      const docsLength = docs.length
      for (let i = 0; i < docsLength; i++) {
        const doc = docs[i]
        if (doc) {
          batch.delete(doc.ref)
        }
      }

      await batch.commit()

      // Use setImmediate for better performance than process.nextTick
      setImmediate(() => {
        this.deleteQueryBatch(db, query, batchSize, resolve, reject)
      })
    } catch (error) {
      reject(error)
    }
  }

  /**
   * Creates a Clone of the current instance of the class
   * @returns
   */
  protected clone() {
    this.initDB()
    return new (<any>this.constructor)({
      entity: this.entity,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
    })
  }
  //////////////////////////////////////////////////////////////
  // ALL OF THESE METHODS PROBABLY SHOULD BE IN SOMEWHERE ELSE
  //////////////////////////////////////////////////////////////

  protected async loadRelatedData(
    data: any[],
    loadedKeys: AnyObject,
  ): Promise<admin.firestore.DocumentData[]> {
    const result = await loadRelations({
      data,
      relations: loadedKeys,
      modelRelations: this.modelRelations,
      provider: 'firebase',
      self: this,
      returnPivot: false,
    })

    return result as unknown as admin.firestore.DocumentData[]
  }

  /**
   *
   */
  private getGeneratedQueries(
    query?: FluentQuery<ModelDTO>,
  ): [FirebaseFirestore.Query | undefined, FirebaseFirestore.Query[]] {
    const { andWhere, orWhere } = this.getFirebaseWhereQuery(query?.where)

    let mergedQueries: FirebaseFirestore.Query[]

    if (andWhere) {
      mergedQueries = [andWhere, ...orWhere]
    } else {
      mergedQueries = orWhere
    }

    const selectKeys = query?.select
      ? Object.keys(Objects.flatten(query.select))
      : null
    const limit = query?.limit || 10
    const offset = query?.offset || 0
    const orderBy = query?.orderBy

    const queriesLength = mergedQueries.length
    for (let i = 0; i < queriesLength; i++) {
      let currentQuery = mergedQueries[i]
      if (!currentQuery) {
        continue
      }

      if (selectKeys && selectKeys.length > 0) {
        // Force select the ID
        currentQuery = currentQuery.select('id', ...selectKeys)
      }

      currentQuery = currentQuery.limit(limit).offset(offset)

      if (orderBy) {
        const orderLength = orderBy.length
        for (let j = 0; j < orderLength; j++) {
          const orderItem = orderBy[j]
          if (orderItem) {
            const flattenObject = Objects.flatten(orderItem)
            const attributes = Object.keys(flattenObject)
            const attrLength = attributes.length
            for (let k = 0; k < attrLength; k++) {
              const attribute = attributes[k]
              if (attribute) {
                currentQuery = currentQuery.orderBy(
                  attribute,
                  flattenObject[
                    attribute
                  ] as FirebaseFirestore.OrderByDirection,
                )
              }
            }
          }
        }
      }

      mergedQueries[i] = currentQuery
    }

    if (andWhere) {
      const orQueries = mergedQueries.slice(1)
      return [mergedQueries[0], orQueries]
    }

    return [undefined, mergedQueries]
  }

  private getFirebaseWhereQuery(where?: FluentQuery<ModelDTO>['where']): {
    andWhere?: FirebaseFirestore.Query
    orWhere: FirebaseFirestore.Query[]
  } {
    if (!where || Object.keys(where).length === 0) {
      return { andWhere: this.collection, orWhere: [] }
    }

    // Every element of the array is an OR
    let andWhereQuery: FirebaseFirestore.Query = this.collection as any
    const orWhereQueries: FirebaseFirestore.Query[] = []

    // Avoid cloning overhead - work with original object
    const { AND, OR, ...rootConditions } = where

    const orConditions = extractConditions((OR || []) as any)
    const andConditions = extractConditions((AND || []) as any)

    const rootLevelConditions = extractConditions([rootConditions])

    // Helper function to apply conditions to a query - use a map for O(1) lookup
    const operatorMap = new Map<LogicOperator, string>([
      [LogicOperator.Equals, '=='],
      [LogicOperator.IsNot, '!='],
      [LogicOperator.GreaterThan, '>'],
      [LogicOperator.GreaterOrEqualThan, '>='],
      [LogicOperator.LessThan, '<'],
      [LogicOperator.LessOrEqualThan, '<='],
      [LogicOperator.In, 'in'],
      [LogicOperator.ArrayContains, 'array-contains'],
      [LogicOperator.NotIn, 'not-in'],
    ])

    const applyCondition = (
      query: FirebaseFirestore.Query,
      condition: any,
    ): FirebaseFirestore.Query => {
      const { element, operator, value } = condition

      const firebaseOp = operatorMap.get(operator)
      if (firebaseOp) {
        return query.where(element, firebaseOp as any, value)
      }

      switch (operator) {
        case LogicOperator.Exists:
          throw new Error('The exists Operator cannot be used in Firebase')
        case LogicOperator.NotExists:
          throw new Error('The !exists Operator cannot be used in Firebase')
        case LogicOperator.Regexp:
          throw new Error('The regexp Operator cannot be used in Firebase')
        default:
          throw new Error(`Unknown operator: ${operator}`)
      }
    }

    // Apply AND conditions
    const andLength = andConditions.length
    for (let i = 0; i < andLength; i++) {
      andWhereQuery = applyCondition(andWhereQuery, andConditions[i])
    }

    // Apply root level conditions
    const rootLength = rootLevelConditions.length
    for (let i = 0; i < rootLength; i++) {
      andWhereQuery = applyCondition(andWhereQuery, rootLevelConditions[i])
    }

    // Each or query needs to be an independent query in Firebase
    const orLength = orConditions.length
    for (let i = 0; i < orLength; i++) {
      const orQuery = applyCondition(this.collection as any, orConditions[i])
      orWhereQueries.push(orQuery)
    }

    let andWhereCondition: FirebaseFirestore.Query | undefined

    // If there is no query, just return the collection
    if (
      !andConditions?.length &&
      !rootLevelConditions?.length &&
      !orConditions?.length
    ) {
      andWhereCondition = this.collection as any
    }

    if (andConditions?.length || rootLevelConditions?.length) {
      andWhereCondition = andWhereQuery
    }

    return {
      andWhere: andWhereCondition,
      orWhere: orWhereQueries,
    }
  }
}
