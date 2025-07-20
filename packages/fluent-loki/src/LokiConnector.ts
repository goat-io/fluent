import { Ids, Objects } from '@goatlab/js-utils'
import { Dates } from '@goatlab/dates'
import {
  AnyObject,
  PaginatedData,
  Paginator,
  BaseConnector,
  FluentConnectorInterface,
  modelGeneratorDataSource,
  getRelationsFromModelGenerator,
  getOutputKeys,
  FluentQuery,
  QueryOutput,
  LogicOperator,
  LoadedResult,
  FindByIdFilter,
  extractConditions,
  Primitives
} from '@goatlab/fluent'
import { z } from 'zod'
import LokiJS, { Collection } from 'lokijs'

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

    const dbModels: string[] = []

    for (const collection of dataSource.collections) {
      dbModels.push(collection.name)
    }

    if (!dbModels.includes(entity.name)) {
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
    const _data = Objects.clone(data)
    // Validate Input
    const validatedData = (this.inputSchema as any).parse(_data)

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

    const insertedElements: OutputDTO[] = []

    for (const data of validatedData) {
      const now = new Date()
      insertedElements.push({
        ...data,
        id: Ids.uuid(),
        created: now,
        createdAt: now,
        updatedAt: now
      } as unknown as OutputDTO)
    }

    await this.collection.insert(insertedElements)

    return this.outputSchema.array().parse(
      insertedElements.map(d => {
        return Objects.clearEmpties(Objects.deleteNulls(d))
      })
    )
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

    const sort: [string, boolean][] = []

    let baseQuery = this.collection
      .chain()
      .find(where)

    // Pagination
    if (query?.paginated) {
      baseQuery.limit(query.paginated.perPage)
      baseQuery.offset((query.paginated?.page - 1) * query.paginated.perPage)
    }

    if (query?.orderBy) {
      for (const order of query?.orderBy!) {
        const flattenObject = Objects.flatten(order)
        for (const attribute of Object.keys(flattenObject)) {
          const isDecending = flattenObject[attribute] === 'desc'
          sort.push([attribute, isDecending])
        }
      }
      baseQuery = baseQuery.compoundsort(sort)
    }
    
    // Apply offset and limit after sorting
    if (query?.offset) {
      baseQuery = baseQuery.offset(query.offset)
    }
    
    if (query?.limit) {
      baseQuery = baseQuery.limit(query.limit)
    } else if (!query?.paginated) {
      // Default limit if no pagination
      baseQuery = baseQuery.limit(10)
    }

    let found = baseQuery.data()

    found.map(d => {
      Objects.clearEmpties(Objects.deleteNulls(d))
    })

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
    const validatedResults = found.map(item => {
      try {
        return this.outputSchema.parse(item)
      } catch (e) {
        // If full validation fails, try partial validation
        return (this.outputSchema as any).partial().parse(item)
      }
    })
    
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
    let value = await this.collection.findOne({ id })

    const flatValue = Objects.flatten(JSON.parse(JSON.stringify(value)))

    Object.keys(flatValue).forEach(key => {
      (flatValue as any)[key] = null
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

    // For replace operations, use partial validation since we're replacing with only provided fields
    const partialSchema = (this.inputSchema as any).partial()
    const validatedData = partialSchema.parse(dataToInsert)

    // Keep LokiJS metadata when updating
    const updatedValue = {
      ...value,  // Keep all LokiJS metadata
      ...validatedData
    }
    
    // Remove all fields except LokiJS metadata and validated fields
    const lokiMetaFields = ['$loki', 'meta']
    const allowedFields = [...lokiMetaFields, 'id', 'created', ...Object.keys(validatedData)]
    
    Object.keys(updatedValue).forEach(key => {
      if (!allowedFields.includes(key)) {
        delete updatedValue[key]
      }
    })

    await this.collection.update(updatedValue)

    const val = await this.collection.findOne({ id })

    // For replace operations, use partial output schema since we only have the replaced fields
    const partialOutputSchema = (this.outputSchema as any).partial()
    return partialOutputSchema.parse(
      Objects.clearEmpties(Objects.deleteNulls(val))
    ) as OutputDTO
  }

  public getLokiWhere(where?: FluentQuery<ModelDTO>['where']): any {
    /*

    if (this.relationQuery && this.relationQuery.data) {
      const ids = this.relationQuery.data.map(
        d => Ids.objectID(d.id) as unknown as ObjectID
      )

      andFilters.push([
        this.relationQuery.relation.inverseSidePropertyPath,
        'in',
        ids
      ])
    }

    if (!andFilters || andFilters.length === 0) {
      return filters
    }
    */

    if (!where || Object.keys(where).length === 0) {
      return {}
    }

    const Filters: { where: { $or: any[] } } = {
      where: { $or: [{ $and: [] }] }
    }

    const orConditions = extractConditions((where['OR'] || []) as any)
    const andConditions = extractConditions((where['AND'] || []) as any)

    const copy = Objects.clone(where)
    if (!!copy['AND']) {
      delete copy['AND']
    }

    if (!!copy['OR']) {
      delete copy['OR']
    }

    const rootLevelConditions = extractConditions([copy])

    // Process AND conditions
    for (const condition of andConditions) {
      let { element, operator, value } = condition

      if (element === 'id') {
        // element = '_id'
        /*
        value = (Array.isArray(value)
          ? value.map(v => Ids.objectID(v) as unknown as ObjectID)
          : (Ids.objectID(value) as unknown as ObjectID) as unknown as PrimitivesArray | Primitives)
          */
      }

      // Handle nested properties for LokiJS
      if (element.includes('.')) {
        const parts = element.split('.')
        const nestedFilter: any = {}
        let current = nestedFilter
        
        for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = {}
          current = current[parts[i]]
        }
        
        const lastPart = parts[parts.length - 1]
        
        switch (operator) {
          case LogicOperator.equals:
            current[lastPart] = value
            break
          case LogicOperator.isNot:
            current[lastPart] = { $ne: value }
            break
          case LogicOperator.greaterThan:
            current[lastPart] = { $gt: value }
            break
          case LogicOperator.greaterOrEqualThan:
            current[lastPart] = { $gte: value }
            break
          case LogicOperator.lessThan:
            current[lastPart] = { $lt: value }
            break
          case LogicOperator.lessOrEqualThan:
            current[lastPart] = { $lte: value }
            break
          case LogicOperator.in:
            current[lastPart] = { $in: value }
            break
          case LogicOperator.notIn:
            current[lastPart] = { $nin: value }
            break
          case LogicOperator.exists:
            current[lastPart] = { $exists: true }
            break
          case LogicOperator.notExists:
            current[lastPart] = { $exists: false }
            break
          case LogicOperator.regexp:
            current[lastPart] = { $regex: value }
            break
        }
        
        Filters.where.$or[0].$and.push(nestedFilter)
      } else {
        switch (operator) {
          case LogicOperator.equals:
            Filters.where.$or[0].$and.push({ [element]: { $eq: value } })
          break
        case LogicOperator.isNot:
          Filters.where.$or[0].$and.push({ [element]: { $neq: value } })
          break
        case LogicOperator.greaterThan:
          Filters.where.$or[0].$and.push({ [element]: { $gt: value } })
          break
        case LogicOperator.greaterOrEqualThan:
          Filters.where.$or[0].$and.push({ [element]: { $gte: value } })
          break
        case LogicOperator.lessThan:
          Filters.where.$or[0].$and.push({ [element]: { $lt: value } })
          break
        case LogicOperator.lessOrEqualThan:
          Filters.where.$or[0].$and.push({ [element]: { $lte: value } })
          break
        case LogicOperator.in:
          Filters.where.$or[0].$and.push({ [element]: { $in: value } })
          break
        case LogicOperator.notIn:
          Filters.where.$or[0].$and.push({
            [element]: { $not: { $in: value } }
          })
          break
        case LogicOperator.exists:
          Filters.where.$or[0].$and.push({ [element]: { $exists: true } })
          break
        case LogicOperator.notExists:
          Filters.where.$or[0].$and.push({ [element]: { $exists: false } })
          break
        case LogicOperator.regexp:
          Filters.where.$or[0].$and.push({ [element]: { $regex: value } })
          break
        }
      }
    }

    for (const condition of rootLevelConditions) {
      let { element, operator, value } = condition

      if (element === 'id') {
        // element = '_id'
        /*
        value = (Array.isArray(value)
          ? value.map(v => Ids.objectID(v) as unknown as ObjectID)
          : (Ids.objectID(value) as unknown as ObjectID) as unknown as PrimitivesArray | Primitives)
          */
      }

      // Handle nested properties for LokiJS
      if (element.includes('.')) {
        const parts = element.split('.')
        const nestedFilter: any = {}
        let current = nestedFilter
        
        for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = {}
          current = current[parts[i]]
        }
        
        const lastPart = parts[parts.length - 1]
        
        switch (operator) {
          case LogicOperator.equals:
            current[lastPart] = value
            break
          case LogicOperator.isNot:
            current[lastPart] = { $ne: value }
            break
          case LogicOperator.greaterThan:
            current[lastPart] = { $gt: value }
            break
          case LogicOperator.greaterOrEqualThan:
            current[lastPart] = { $gte: value }
            break
          case LogicOperator.lessThan:
            current[lastPart] = { $lt: value }
            break
          case LogicOperator.lessOrEqualThan:
            current[lastPart] = { $lte: value }
            break
          case LogicOperator.in:
            current[lastPart] = { $in: value }
            break
          case LogicOperator.notIn:
            current[lastPart] = { $nin: value }
            break
          case LogicOperator.exists:
            current[lastPart] = { $exists: true }
            break
          case LogicOperator.notExists:
            current[lastPart] = { $exists: false }
            break
          case LogicOperator.regexp:
            current[lastPart] = { $regex: value }
            break
        }
        
        Filters.where.$or[0].$and.push(nestedFilter)
      } else {
        switch (operator) {
          case LogicOperator.equals:
            Filters.where.$or[0].$and.push({ [element]: { $eq: value } })
          break
        case LogicOperator.isNot:
          Filters.where.$or[0].$and.push({ [element]: { $neq: value } })
          break
        case LogicOperator.greaterThan:
          Filters.where.$or[0].$and.push({ [element]: { $gt: value } })
          break
        case LogicOperator.greaterOrEqualThan:
          Filters.where.$or[0].$and.push({ [element]: { $gte: value } })
          break
        case LogicOperator.lessThan:
          Filters.where.$or[0].$and.push({ [element]: { $lt: value } })
          break
        case LogicOperator.lessOrEqualThan:
          Filters.where.$or[0].$and.push({ [element]: { $lte: value } })
          break
        case LogicOperator.in:
          Filters.where.$or[0].$and.push({ [element]: { $in: value } })
          break
        case LogicOperator.notIn:
          Filters.where.$or[0].$and.push({
            [element]: { $not: { $in: value } }
          })
          break
        case LogicOperator.exists:
          Filters.where.$or[0].$and.push({ [element]: { $exists: true } })
          break
        case LogicOperator.notExists:
          Filters.where.$or[0].$and.push({ [element]: { $exists: false } })
          break
        case LogicOperator.regexp:
          Filters.where.$or[0].$and.push({ [element]: { $regex: value } })
          break
        }
      }
    }

    for (const condition of orConditions) {
      let { element, operator, value } = condition

      switch (operator) {
        case LogicOperator.equals:
          Filters.where.$or.push({ [element]: { $eq: value } })
          break
        case LogicOperator.isNot:
          Filters.where.$or.push({ [element]: { $neq: value } })
          break
        case LogicOperator.greaterThan:
          Filters.where.$or.push({ [element]: { $gt: value } })
          break
        case LogicOperator.greaterOrEqualThan:
          Filters.where.$or.push({ [element]: { $gte: value } })
          break
        case LogicOperator.lessThan:
          Filters.where.$or.push({ [element]: { $lt: value } })
          break
        case LogicOperator.lessOrEqualThan:
          Filters.where.$or.push({ [element]: { $lte: value } })
          break
        case LogicOperator.in:
          Filters.where.$or.push({ [element]: { $in: value } })
          break
        case LogicOperator.notIn:
          Filters.where.$or.push({
            [element]: { $not: { $in: value } }
          })
          break
        case LogicOperator.exists:
          Filters.where.$or.push({ [element]: { $exists: true } })
          break
        case LogicOperator.notExists:
          Filters.where.$or.push({ [element]: { $exists: false } })
          break
        case LogicOperator.regexp:
          Filters.where.$or.push({ [element]: { $regex: value } })
          break
      }
    }

    // For simple queries without OR conditions, return a simpler format
    if (Filters.where.$or.length === 1 && Filters.where.$or[0].$and.length === 1) {
      const filter = Filters.where.$or[0].$and[0]
      // For nested objects, LokiJS needs { "breed.family": "Angora" } format
      // Check if this is a nested object filter
      const keys = Object.keys(filter)
      if (keys.length === 1 && typeof filter[keys[0]] === 'object' && !filter[keys[0]].$eq && !filter[keys[0]].$ne && !filter[keys[0]].$gt && !filter[keys[0]].$gte && !filter[keys[0]].$lt && !filter[keys[0]].$lte && !filter[keys[0]].$in && !filter[keys[0]].$nin && !filter[keys[0]].$exists && !filter[keys[0]].$regex) {
        // This is a nested object filter like { breed: { family: "Angora" } }
        // Convert to dot notation for LokiJS
        const result: any = {}
        const flattenNestedObject = (obj: any, prefix: string = '') => {
          for (const key in obj) {
            const fullKey = prefix ? `${prefix}.${key}` : key
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !obj[key].$eq && !obj[key].$ne && !obj[key].$gt && !obj[key].$gte && !obj[key].$lt && !obj[key].$lte && !obj[key].$in && !obj[key].$nin && !obj[key].$exists && !obj[key].$regex) {
              flattenNestedObject(obj[key], fullKey)
            } else {
              result[fullKey] = obj[key]
            }
          }
        }
        flattenNestedObject(filter)
        return result
      }
      return filter
    }
    
    // For empty AND conditions, return empty object
    if (Filters.where.$or.length === 1 && Filters.where.$or[0].$and.length === 0) {
      return {}
    }
    
    // For multiple AND conditions without OR, combine them
    if (Filters.where.$or.length === 1 && Filters.where.$or[0].$and.length > 1) {
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
    const detachedClass = Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      this
    ) as LokiConnector<ModelDTO, InputDTO, OutputDTO>

    detachedClass.setRelatedQuery({
      entity: this.entity,
      repository: this,
      query
    })

    return detachedClass
  }

  protected clone() {
    return new (<any>this.constructor)()
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
    const pathKey = typeof path === 'string' ? path : Object.keys(Objects.flatten(path))[0]
    const result: Primitives[] = []
    
    for (const item of data as any[]) {
      const extracted = Objects.getFromPath(item, String(pathKey), undefined)
      if (typeof extracted.value !== 'undefined') {
        result.push(extracted.value)
      }
    }
    
    return result
  }

  private getLokiOperator(operator) {
    const lokiOperators = {
      '=': '$eq',
      '<': '$lt',
      '>': '$gt',
      '<=': '$lte',
      '>=': '$gte',
      '<>': '$ne',
      '!=': '$ne',
      in: '$in',
      nin: '$nin',
      like: '$aeq',
      regexp: '$regex',
      startsWith: '$regex|^{{$var}}',
      endsWith: '$regex|{{$var}}$',
      contains: '$regex|{{$var}}'
    }
    const converted = Objects.get(() => lokiOperators[operator], undefined)

    if (!converted) {
      throw new Error(`The operator "${operator}" is not supported in Loki `)
    }
    return converted
  }

  /*
      id
    })

    return result
  }
  */
}
