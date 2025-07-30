import { Dates } from '@goatlab/dates'
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
  modelGeneratorDataSource,
  PaginatedData,
  Primitives,
  QueryOutput
} from '@goatlab/fluent'
import { Ids, Objects } from '@goatlab/js-utils'
import LokiJS, { Collection } from 'lokijs'
import { z } from 'zod'

export interface LokiConnectorParams<Input, Output> {
  entity: any
  dataSource: LokiJS
  inputSchema: z.ZodType<Input>
  outputSchema?: z.ZodType<Output>
}

export interface TypeOrmConnectorParams<Input, Output> {
  entity: any
  dataSource: LokiJS
  inputSchema: z.ZodType<Input>
  outputSchema?: z.ZodType<Output>
}
export class LokiConnector<
    ModelDTO extends AnyObject = AnyObject,
    InputDTO extends AnyObject = ModelDTO,
    OutputDTO extends AnyObject = ModelDTO
  >
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO>
{
  private collection: Collection

  private readonly dataSource: LokiJS

  private readonly inputSchema: z.ZodType<InputDTO>

  private readonly outputSchema: z.ZodType<OutputDTO>

  private readonly entity: any

  constructor({
    entity,
    dataSource,
    inputSchema,
    outputSchema
  }: LokiConnectorParams<InputDTO, OutputDTO>) {
    super()
    this.dataSource = dataSource
    this.inputSchema = inputSchema
    this.outputSchema =
      outputSchema || (inputSchema as unknown as z.ZodType<OutputDTO>)

    this.entity = entity

    // Use Set for O(1) lookup instead of array
    const dbModels = new Set<string>()
    const collections = dataSource.collections
    const collectionsLength = collections.length

    for (let i = 0; i < collectionsLength; i++) {
      dbModels.add(collections[i].name)
    }

    if (!dbModels.has(entity.name)) {
      dataSource.addCollection(entity.name)
    }

    this.dataSource = dataSource

    this.collection = dataSource.getCollection(entity.name)

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
    const Data = Objects.clone(data)
    // Validate Input
    const validatedData = (this.inputSchema as any).parse(Data)

    const id = Ids.uuid()
    const now = new Date()
    const inserted: OutputDTO = {
      id,
      created: now,
      createdAt: now,
      updatedAt: now,
      ...validatedData
    } as unknown as OutputDTO

    await this.collection.insert(inserted)

    // Validate Output
    return this.outputSchema.parse(
      Objects.clearEmpties(Objects.deleteNulls(inserted))
    )
  }

  public async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    const validatedData = this.inputSchema.array().parse(data)

    const dataLength = validatedData.length
    const insertedElements: OutputDTO[] = new Array(dataLength)
    const now = new Date()
    const _nowTime = now.getTime() // Cache timestamp for reuse

    for (let i = 0; i < dataLength; i++) {
      const id = Ids.uuid()
      insertedElements[i] = {
        ...validatedData[i],
        id,
        created: now,
        createdAt: now,
        updatedAt: now
      } as unknown as OutputDTO
    }

    await this.collection.insert(insertedElements)

    const cleanedResults = new Array(dataLength)
    for (let i = 0; i < dataLength; i++) {
      cleanedResults[i] = Objects.clearEmpties(
        Objects.deleteNulls(insertedElements[i])
      )
    }

    return this.outputSchema.array().parse(cleanedResults)
  }

  /**
   *
   * Returns the TypeOrm Repository, you can use it
   * form more complex queries and to get
   * the TypeOrm query builder
   *
   * @param query
   */
  public raw(): Collection {
    return this.collection
  }

  public async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    const where = this.getLokiWhere(query?.where)

    let baseQuery = this.collection.chain().find(where)

    // Build sort array if needed - pre-calculate total size
    if (query?.orderBy) {
      let totalSortFields = 0
      const orderLength = query.orderBy.length

      // First pass: count total fields
      for (let i = 0; i < orderLength; i++) {
        const flattenObject = Objects.flatten(query.orderBy[i])
        totalSortFields += Object.keys(flattenObject).length
      }

      // Pre-allocate sort array
      const sort: [string, boolean][] = new Array(totalSortFields)
      let sortIndex = 0

      // Second pass: populate array
      for (let i = 0; i < orderLength; i++) {
        const flattenObject = Objects.flatten(query.orderBy[i])
        const attributes = Object.keys(flattenObject)
        const attrLength = attributes.length
        for (let j = 0; j < attrLength; j++) {
          const attribute = attributes[j]
          const isDescending = flattenObject[attribute] === 'desc'
          sort[sortIndex++] = [attribute, isDescending]
        }
      }
      baseQuery = baseQuery.compoundsort(sort)
    }

    // Apply pagination, offset and limit
    if (query?.paginated) {
      const offset = (query.paginated.page - 1) * query.paginated.perPage
      baseQuery = baseQuery.offset(offset).limit(query.paginated.perPage)
    } else {
      if (query?.offset) {
        baseQuery = baseQuery.offset(query.offset)
      }
      baseQuery = baseQuery.limit(query?.limit || 10)
    }

    const found = baseQuery.data()

    // Clean data in-place
    const foundLength = found.length
    for (let i = 0; i < foundLength; i++) {
      Objects.clearEmpties(Objects.deleteNulls(found[i]))
    }

    if (query?.paginated) {
      const paginationInfo: PaginatedData<Promise<QueryOutput<T, ModelDTO>[]>> =
        {
          total: 0,
          perPage: query.paginated.perPage,
          currentPage: query.paginated.page,
          nextPage: query.paginated.page + 1,
          firstPage: 1,
          lastPage: Math.ceil(1 / query.paginated.perPage),
          prevPage:
            query.paginated.page === 1 ? null : query.paginated.page - 1,
          from: (query.paginated.page - 1) * query.paginated.perPage + 1,
          to: query.paginated.perPage * query.paginated.page,
          data: found as unknown as Promise<QueryOutput<T, ModelDTO>[]>[]
        }

      return paginationInfo as unknown as Promise<QueryOutput<T, ModelDTO>[]>
    }

    if (query?.select) {
      const selectedAttributes = this.jsApplySelect(query?.select, found)
      // TODO: validate based on the select properties
      return selectedAttributes as unknown as Promise<
        QueryOutput<T, ModelDTO>[]
      >
    }
    // Validate Output against schema
    // Use partial schema to handle objects that may have been replaced with partial data
    // Optimize validation by caching partial schema
    const partialSchema = (this.outputSchema as any).partial()
    const validatedResults = new Array(found.length)

    for (let i = 0; i < found.length; i++) {
      const item = found[i]
      try {
        validatedResults[i] = this.outputSchema.parse(item)
      } catch (_e) {
        // If full validation fails, try partial validation
        validatedResults[i] = partialSchema.parse(item)
      }
    }

    return validatedResults as unknown as Promise<QueryOutput<T, ModelDTO>[]>
  }

  /**
   *
   * @param id
   * @returns
   */
  public async deleteById(id: string): Promise<string> {
    await this.collection.findAndRemove({ id })

    return id
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

    // For PATCH operations, use partial validation
    const partialSchema = (this.inputSchema as any).partial()
    const validatedData = partialSchema.parse(dataToInsert)

    const local = await this.collection.findOne({ id })

    const mod = {
      ...local,
      ...validatedData,
      modified: Dates.currentIsoString()
    }

    const dbResult = await this.collection.update(mod)
    // const dbResult = await this.collection.findOne({ id })

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
    const value = await this.collection.findOne({ id })

    // Avoid JSON parse/stringify overhead
    const clonedValue =
      typeof structuredClone !== 'undefined'
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value))
    const flatValue = Objects.flatten(clonedValue)
    const keys = Object.keys(flatValue)
    const keysLength = keys.length
    const nullValue = null

    for (let i = 0; i < keysLength; i++) {
      ;(flatValue as any)[keys[i]] = nullValue
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
          updated: new Date()
        }
      : data

    // For replace operations, use partial validation since we're replacing with only provided fields
    const partialSchema = (this.inputSchema as any).partial()
    const validatedData = partialSchema.parse(dataToInsert)

    // Keep LokiJS metadata when updating
    const updatedValue = {
      ...value, // Keep all LokiJS metadata
      ...validatedData
    }

    // Remove all fields except LokiJS metadata and validated fields
    const lokiMetaFields = ['$loki', 'meta']
    const validatedKeys = Object.keys(validatedData)
    const allowedFields = new Set([
      ...lokiMetaFields,
      'id',
      'created',
      ...validatedKeys
    ])

    const updatedKeys = Object.keys(updatedValue)
    const updatedKeysLength = updatedKeys.length
    for (let i = 0; i < updatedKeysLength; i++) {
      const key = updatedKeys[i]
      if (!allowedFields.has(key)) {
        delete updatedValue[key]
      }
    }

    await this.collection.update(updatedValue)

    const val = await this.collection.findOne({ id })

    // For replace operations, use partial output schema since we only have the replaced fields
    const partialOutputSchema = (this.outputSchema as any).partial()
    return partialOutputSchema.parse(
      Objects.clearEmpties(Objects.deleteNulls(val))
    ) as OutputDTO
  }

  public getLokiWhere(where?: FluentQuery<ModelDTO>['where']): any {
    if (!where || Object.keys(where).length === 0) {
      return {}
    }

    const Filters: { where: { $or: any[] } } = {
      where: { $or: [{ $and: [] }] }
    }

    // Avoid cloning overhead - use destructuring
    const { AND, OR, ...rootConditions } = where

    const orConditions = extractConditions((OR || []) as any)
    const andConditions = extractConditions((AND || []) as any)

    const rootLevelConditions = extractConditions([rootConditions])

    // Create operator map for O(1) lookup
    const simpleOperatorMap = new Map<LogicOperator, string>([
      [LogicOperator.Equals, '$eq'],
      [LogicOperator.IsNot, '$neq'],
      [LogicOperator.GreaterThan, '$gt'],
      [LogicOperator.GreaterOrEqualThan, '$gte'],
      [LogicOperator.LessThan, '$lt'],
      [LogicOperator.LessOrEqualThan, '$lte'],
      [LogicOperator.In, '$in'],
      [LogicOperator.Exists, '$exists'],
      [LogicOperator.NotExists, '$exists'],
      [LogicOperator.Regexp, '$regex']
    ])

    // Helper function to process conditions
    const processCondition = (condition: any, target: any[]) => {
      const { element, operator, value } = condition

      // Handle nested properties for LokiJS
      if (element.includes('.')) {
        const parts = element.split('.')
        const nestedFilter: any = {}
        let current = nestedFilter

        const partsLength = parts.length - 1
        for (let i = 0; i < partsLength; i++) {
          current[parts[i]] = {}
          current = current[parts[i]]
        }

        const lastPart = parts[partsLength]

        switch (operator) {
          case LogicOperator.Equals:
            current[lastPart] = value
            break
          case LogicOperator.IsNot:
            current[lastPart] = { $ne: value }
            break
          case LogicOperator.GreaterThan:
            current[lastPart] = { $gt: value }
            break
          case LogicOperator.GreaterOrEqualThan:
            current[lastPart] = { $gte: value }
            break
          case LogicOperator.LessThan:
            current[lastPart] = { $lt: value }
            break
          case LogicOperator.LessOrEqualThan:
            current[lastPart] = { $lte: value }
            break
          case LogicOperator.In:
            current[lastPart] = { $in: value }
            break
          case LogicOperator.NotIn:
            current[lastPart] = { $nin: value }
            break
          case LogicOperator.Exists:
            current[lastPart] = { $exists: true }
            break
          case LogicOperator.NotExists:
            current[lastPart] = { $exists: false }
            break
          case LogicOperator.Regexp:
            current[lastPart] = { $regex: value }
            break
        }

        target.push(nestedFilter)
      } else {
        // Use map for O(1) operator lookup
        const lokiOp = simpleOperatorMap.get(operator)
        if (lokiOp) {
          if (operator === LogicOperator.NotExists) {
            target.push({ [element]: { [lokiOp]: false } })
          } else if (operator === LogicOperator.Exists) {
            target.push({ [element]: { [lokiOp]: true } })
          } else {
            target.push({ [element]: { [lokiOp]: value } })
          }
        } else if (operator === LogicOperator.NotIn) {
          target.push({ [element]: { $not: { $in: value } } })
        }
      }
    }

    // Process AND conditions
    const andLength = andConditions.length
    for (let i = 0; i < andLength; i++) {
      processCondition(andConditions[i], Filters.where.$or[0].$and)
    }

    // Process root level conditions
    const rootLength = rootLevelConditions.length
    for (let i = 0; i < rootLength; i++) {
      processCondition(rootLevelConditions[i], Filters.where.$or[0].$and)
    }

    // Process OR conditions
    const orLength = orConditions.length
    for (let i = 0; i < orLength; i++) {
      const condition = orConditions[i]
      const { element, operator, value } = condition

      const orFilter: any = {}
      // Reuse operator map for consistency
      const lokiOp = simpleOperatorMap.get(operator)
      if (lokiOp) {
        if (operator === LogicOperator.NotExists) {
          orFilter[element] = { [lokiOp]: false }
        } else if (operator === LogicOperator.Exists) {
          orFilter[element] = { [lokiOp]: true }
        } else {
          orFilter[element] = { [lokiOp]: value }
        }
      } else if (operator === LogicOperator.NotIn) {
        orFilter[element] = { $not: { $in: value } }
      }

      Filters.where.$or.push(orFilter)
    }

    // For simple queries without OR conditions, return a simpler format
    if (
      Filters.where.$or.length === 1 &&
      Filters.where.$or[0].$and.length === 1
    ) {
      const filter = Filters.where.$or[0].$and[0]
      // For nested objects, LokiJS needs { "breed.family": "Angora" } format
      // Check if this is a nested object filter
      const keys = Object.keys(filter)
      if (keys.length === 1) {
        const firstKey = keys[0]
        const firstValue = filter[firstKey]
        if (
          typeof firstValue === 'object' &&
          firstValue !== null &&
          !Array.isArray(firstValue) &&
          !firstValue.$eq &&
          !firstValue.$ne &&
          !firstValue.$gt &&
          !firstValue.$gte &&
          !firstValue.$lt &&
          !firstValue.$lte &&
          !firstValue.$in &&
          !firstValue.$nin &&
          !firstValue.$exists &&
          !firstValue.$regex
        ) {
          // This is a nested object filter like { breed: { family: "Angora" } }
          // Convert to dot notation for LokiJS
          const result: any = {}
          const flattenNestedObject = (obj: any, prefix: string = '') => {
            const objKeys = Object.keys(obj)
            const objKeysLength = objKeys.length
            for (let i = 0; i < objKeysLength; i++) {
              const key = objKeys[i]
              const fullKey = prefix ? `${prefix}.${key}` : key
              const value = obj[key]
              if (
                typeof value === 'object' &&
                value !== null &&
                !Array.isArray(value) &&
                !value.$eq &&
                !value.$ne &&
                !value.$gt &&
                !value.$gte &&
                !value.$lt &&
                !value.$lte &&
                !value.$in &&
                !value.$nin &&
                !value.$exists &&
                !value.$regex
              ) {
                flattenNestedObject(value, fullKey)
              } else {
                result[fullKey] = value
              }
            }
          }
          flattenNestedObject(filter)
          return result
        }
      }
      return filter
    }

    // For empty AND conditions, return empty object
    if (
      Filters.where.$or.length === 1 &&
      Filters.where.$or[0].$and.length === 0
    ) {
      return {}
    }

    // For multiple AND conditions without OR, combine them
    if (
      Filters.where.$or.length === 1 &&
      Filters.where.$or[0].$and.length > 1
    ) {
      return { $and: Filters.where.$or[0].$and }
    }

    // For OR conditions, return the full structure
    if (Filters.where.$or.length > 1) {
      return { $or: Filters.where.$or }
    }

    return Objects.clearEmpties(Filters.where)
  }

  public loadFirst(query?: FluentQuery<ModelDTO>) {
    // Create a clone of the original class
    // to avoid polluting attributes (relatedQuery)
    const detachedClass = this.clone()

    detachedClass.setRelatedQuery({
      entity: this.entity,
      repository: this,
      query: {
        ...query,
        limit: 1
      }
    })

    return detachedClass as LoadedResult<this>
  }

  protected clone() {
    return new (<any>this.constructor)({
      entity: this.entity,
      dataSource: this.dataSource,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema
    })
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

  public async clear(): Promise<boolean> {
    this.collection.clear({ removeIndices: true })
    return true
  }

  /**
   * Override pluck to filter out undefined values
   */
  public async pluck(
    path: any,
    query?: FluentQuery<ModelDTO>
  ): Promise<Primitives[]> {
    const data = await this.findMany(query)

    // Handle both string and object path formats
    const pathKey =
      typeof path === 'string' ? path : Object.keys(Objects.flatten(path))[0]
    const result: Primitives[] = []

    const dataArray = data as any[]
    const dataLength = dataArray.length
    for (let i = 0; i < dataLength; i++) {
      const extracted = Objects.getFromPath(
        dataArray[i],
        String(pathKey),
        undefined
      )
      if (typeof extracted.value !== 'undefined') {
        result.push(extracted.value)
      }
    }

    return result
  }

  /*
      id
    })

    return result
  }
  */
}
