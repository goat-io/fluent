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
  SingleQueryOutput
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
    ModelDTO = AnyObject,
    InputDTO = ModelDTO,
    OutputDTO = ModelDTO
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
    const validatedData = this.inputSchema.parse(_data)

    const id = Ids.uuid()
    const inserted: OutputDTO = {
      id,
      ...validatedData
    } as unknown as OutputDTO

    await this.collection.insert(inserted)

    // Validate Output
    return this.outputSchema.parse(
      this.clearEmpties(Objects.deleteNulls(inserted))
    )
  }

  public async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    const validatedData = this.inputSchema.array().parse(data)

    const insertedElements: OutputDTO[] = []

    for (const data of validatedData) {
      insertedElements.push({
        ...data,
        id: Ids.uuid()
      } as unknown as OutputDTO)
    }

    await this.collection.insert(insertedElements)

    return this.outputSchema.array().parse(
      insertedElements.map(d => {
        return this.clearEmpties(Objects.deleteNulls(d))
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
  ): Promise<QueryOutput<T, ModelDTO, OutputDTO>> {
    const where = this.getLokiWhere(query?.where)

    const sort: [string, boolean][] = []

    let baseQuery = this.collection
      .chain()
      .find(where)
      .offset(query?.offset || 0)
      .limit(query?.limit || 10)

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

    let found = baseQuery.data()

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
          lastPage: Math.ceil(1 / query.paginated.perPage),
          prevPage:
            query.paginated.page === 1 ? null : query.paginated.page - 1,
          from: (query.paginated.page - 1) * query.paginated.perPage + 1,
          to: query.paginated.perPage * query.paginated.page,
          data: found as unknown as QueryOutput<T, ModelDTO, OutputDTO>[]
        }

      return paginationInfo as unknown as QueryOutput<T, ModelDTO, OutputDTO>
    }

    if (query?.select) {
      const selectedAttributes = this.jsApplySelect(query?.select, found)
      // TODO: validate based on the select properties
      return selectedAttributes as unknown as QueryOutput<
        T,
        ModelDTO,
        OutputDTO
      >
    }
    // Validate Output against schema
    return this.outputSchema?.array().parse(found) as unknown as QueryOutput<
      T,
      ModelDTO,
      OutputDTO
    >
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
    let value = await this.collection.findOne({ id })

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

    value = { ...value, ...validatedData }

    await this.collection.update(value)

    const val = await this.collection.findOne({ id })

    return this.outputSchema.parse(this.clearEmpties(Objects.deleteNulls(val)))
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

    for (const condition of andConditions) {
      let { element, operator, value } = condition

      if (element === 'id') {
        element = '_id'
        /*
        value = (Array.isArray(value)
          ? value.map(v => Ids.objectID(v) as unknown as ObjectID)
          : (Ids.objectID(value) as unknown as ObjectID) as unknown as PrimitivesArray | Primitives)
          */
      }

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

    for (const condition of rootLevelConditions) {
      let { element, operator, value } = condition

      if (element === 'id') {
        element = '_id'
        /*
        value = (Array.isArray(value)
          ? value.map(v => Ids.objectID(v) as unknown as ObjectID)
          : (Ids.objectID(value) as unknown as ObjectID) as unknown as PrimitivesArray | Primitives)
          */
      }

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

    for (const condition of orConditions) {
      let { element, operator, value } = condition

      if (element === 'id') {
        element = 'id'
        /*
        value = (Array.isArray(value)
          ? value.map(v => Ids.objectID(v) as unknown as ObjectID)
          : (Ids.objectID(value) as unknown as ObjectID) as unknown as PrimitivesArray | Primitives)
          */
      }

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

    return this.clearEmpties(Filters.where)
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
      } as FluentQuery<ModelDTO>
    })

    return newInstance as LoadedResult<this>
  }

  public async findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T
  ): Promise<QueryOutput<T, ModelDTO, OutputDTO>> {
    let data = await this.findMany({
      where: {
        id: {
          in: ids
        }
      },
      limit: q?.limit,
      select: q?.select,
      include: q?.include
    } as any)

    // Validate Output against schema
    return this.outputSchema?.array().parse(data) as unknown as QueryOutput<
      T,
      ModelDTO,
      OutputDTO
    >
  }

  public async requireById(
    id: string,
    q?: FindByIdFilter<ModelDTO>
  ): Promise<SingleQueryOutput<FindByIdFilter<ModelDTO>, ModelDTO, OutputDTO>> {
    const found = await this.findByIds([id], {
      select: q?.select,
      include: q?.include,
      limit: 1
    })

    found.map(d => {
      if (this.isMongoDB) {
        d['id'] = d['id'].toString()
      }
      this.clearEmpties(Objects.deleteNulls(d))
    })

    if (!found[0]) {
      throw new Error(`Object ${id} not found`)
    }

    return this.outputSchema?.parse(found[0]) as unknown as SingleQueryOutput<
      FindByIdFilter<ModelDTO>,
      ModelDTO,
      OutputDTO
    >
  }

  public async clear(): Promise<boolean> {
    // await this.repository.clear()
    return true
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
  

  public async clear() {
    return this.collection.clear({ removeIndices: true })
  }

  public async deleteById(id: string): Promise<string> {
    if (!id) {
      throw new Error('No id assign to remove().You must give and id to delete')
    }
    const model = await this.getModel()
    await model.findAndRemove({ id })

    return id
  }

  public async findById(id: string): Promise<OutputDTO> {
    if (!id) {
      throw new Error('No id assign to remove().You must give and id to delete')
    }
    const model = await this.getModel()
    const result: OutputDTO = await model.find({
      id
    })

    return result
  }
  */
}
