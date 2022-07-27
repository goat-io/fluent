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
  QueryOutput
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

    const dbModels = dataSource.collections.reduce((acc, collection) => {
      acc.push(collection.name)
      return acc
    }, [])

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

    const inserted: OutputDTO = {
      id: Ids.uuid(),
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

    const filterObject = this.prepareFilter()

    let data = await (await this.getModel())
      .chain()
      .find(filterObject)
      .offset(this.offsetNumber)
      .limit(this.limitNumber)
      .data()

    // data = this.jsApplySelect(data)
    data = this.jsApplyOrderBy(data)

    return data
    const [found, count] = await this.repository.findAndCount(
      this.generateTypeOrmQuery(query)
    )

    found.map(d => {
      if (this.isMongoDB) {
        d['id'] = d['id'].toString()
      }

      this.clearEmpties(Objects.deleteNulls(d))
    })

    if (query?.paginated) {
      const paginationInfo: PaginatedData<QueryOutput<T, ModelDTO, OutputDTO>> =
        {
          total: count,
          perPage: query.paginated.perPage,
          currentPage: query.paginated.page,
          nextPage: query.paginated.page + 1,
          firstPage: 1,
          lastPage: Math.ceil(count / query.paginated.perPage),
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

  /*
  public async updateById(id: string, data: InputDTO): Promise<OutputDTO> {
    if (!id) {
      throw new Error(
        'Loki connector error. Cannot update a Model without id key'
      )
    }
    const model = await this.getModel()

    const local = await model.findOne({ id })

    const mod = {
      ...local,
      ...data,
      ...{ modified: Dates.currentIsoString() }
    }

    const updated: OutputDTO = model.update(mod)

    return updated
  }

  public async clear() {
    return this.collection.clear({ removeIndices: true })
  }

  private prepareFilter() {
    const andObject = { $and: [] }
    const orObject = { $or: [] }
    let globalFilter = {}
    // All first Level AND conditions
    if (this.whereArray.length > 0) {
      this.whereArray.forEach(c => {
        const conditionToObject = {}

        if (c[0].includes('[')) {
          throw new Error(
            `Error in: "${c[0]}" "Where" close does not work with Array elements`
          )
        }

        conditionToObject[c[0]] = {}
        const lokiOperator = this.getLokiOperator(c[1])

        conditionToObject[c[0]][lokiOperator] = c[2]
        if (lokiOperator.includes('$regex|')) {
          delete conditionToObject[c[0]][lokiOperator]
          conditionToObject[c[0]].$regex = lokiOperator
            .replace('$regex|', '')
            .replace('{{$var}}', c[2])
        }

        andObject.$and.push(conditionToObject)
      })
      globalFilter = andObject
    }
    // All second level OR conditions
    if (this.orWhereArray.length > 0) {
      this.orWhereArray.forEach(c => {
        const conditionToObject = {}

        conditionToObject[c[0]] = {}
        const lokiOperator = this.getLokiOperator(c[1])

        conditionToObject[c[0]][lokiOperator] = c[2]
        if (lokiOperator.includes('$regex|')) {
          delete conditionToObject[c[0]][lokiOperator]
          conditionToObject[c[0]].$regex = lokiOperator
            .replace('$regex|', '')
            .replace('{{$var}}', c[2])
        }

        orObject.$or.push(conditionToObject)
      })

      globalFilter = { $or: [andObject, orObject] }
    }

    // TODO we should include global level and() or()
    // operators to give room for more complex queries
    return globalFilter
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

  public async get(): Promise<OutputDTO[]> {
    const filterObject = this.prepareFilter()

    let data = await (await this.getModel())
      .chain()
      .find(filterObject)
      .offset(this.offsetNumber)
      .limit(this.limitNumber)
      .data()

    // data = this.jsApplySelect(data)
    data = this.jsApplyOrderBy(data)

    return data
  }

  public async all(): Promise<OutputDTO[]> {
    return this.get()
  }

  public async find(filter: Filter): Promise<OutputDTO[]> {
    return this.get()
  }

  public async paginate(
    paginator: Paginator
  ): Promise<PaginatedData<OutputDTO>> {
    const results: PaginatedData<OutputDTO> = {
      current_page: 1,
      data: [],
      first_page_url: 'response[0].meta.firstPageUrl,',
      next_page_url: 'response[0].meta.nextPageUrl',
      path: 'response[0].meta.path',
      per_page: 1,
      prev_page_url: ' response[0].meta.previousPageUrl',
      total: 10
    }

    return results
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
