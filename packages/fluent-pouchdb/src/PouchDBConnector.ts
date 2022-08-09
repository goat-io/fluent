import {
  BaseConnector,
  FluentConnectorInterface,
  FluentQuery,
  modelGeneratorDataSource,
  QueryOutput,
  getRelationsFromModelGenerator,
  getOutputKeys,
  LogicOperator,
  PaginatedData,
  LoadedResult,
  FindByIdFilter,
  SingleQueryOutput
} from '@goatlab/fluent'
import type { AnyObject } from '@goatlab/fluent'
import { z } from 'zod'
import PouchDB from 'pouchdb'
import { Objects } from '@goatlab/js-utils'

PouchDB.plugin(require('pouchdb-find'))
PouchDB.plugin(require('pouchdb-adapter-memory'))
PouchDB.plugin(require('pouchdb-json'))

let db: any = []

export interface PouchDBConnectorParams<Input, Output> {
  entity: any
  dataSource: PouchDB.Database
  inputSchema: z.ZodType<Input>
  outputSchema?: z.ZodType<Output>
}

export class PouchDBConnector<
    ModelDTO = AnyObject,
    InputDTO = ModelDTO,
    OutputDTO = ModelDTO
  >
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO>
{
  private readonly dataSource: PouchDB.Database

  private readonly inputSchema: z.ZodType<InputDTO>

  private readonly outputSchema: z.ZodType<OutputDTO>

  private readonly entity: any

  constructor({
    entity,
    dataSource,
    inputSchema,
    outputSchema
  }: PouchDBConnectorParams<InputDTO, OutputDTO>) {
    super()
    this.dataSource = dataSource
    this.inputSchema = inputSchema
    this.outputSchema =
      outputSchema || (inputSchema as unknown as z.ZodType<OutputDTO>)

    this.entity = entity

    const relationShipBuilder = modelGeneratorDataSource.getRepository(entity)

    const { relations } = getRelationsFromModelGenerator(relationShipBuilder)

    this.modelRelations = relations

    this.outputKeys = getOutputKeys(relationShipBuilder) || []
  }

  /**
   *
   * @param data
   */
  public async insert(data: InputDTO): Promise<OutputDTO> {
    // Validate Input
    const validatedData = this.inputSchema.parse(data)

    const reponse = await this.dataSource.post(validatedData)
    let datum = await this.dataSource.get(reponse.id)

    datum['id'] = datum['_id']

    // Validate Output
    return this.outputSchema.parse(
      this.clearEmpties(Objects.deleteNulls(datum))
    )
  }

  /**
   *
   * @param data
   */
  public async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    const validatedData = this.inputSchema.array().parse(data)

    const inserted = await this.dataSource.bulkDocs(validatedData)

    const insertedOK = inserted.map(i => {
      if (i.id) {
        return i
      }
    }) as any

    const elements = await this.dataSource.bulkGet({
      docs: insertedOK
    })

    const res = elements.results.map(r => {
      if (r.id && r.docs[0]['ok']) {
        return this.clearEmpties(
          Objects.deleteNulls({ ...r.docs[0]['ok'], id: r.id })
        )
      }
    })

    return this.outputSchema.array().parse(res)
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

    // Yes, terribly ineficient, Pull/push/pull
    const prePull = await this.dataSource.get(id)

    const updateResults = await this.dataSource.put(
      {
        ...validatedData,
        _id: id,
        _rev: prePull._rev
      },
      { force: true }
    )

    if (!updateResults.ok) {
      throw new Error('Could not update')
    }

    const dbResult = await this.dataSource.get(id)

    dbResult['id'] = dbResult['_id']

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
    const value = await this.dataSource.get(id)

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

    const updateResults = await this.dataSource.put(
      {
        ...validatedData,
        _id: id,
        _rev: value._rev
      },
      { force: true }
    )

    if (!updateResults.ok) {
      throw new Error('Could not Replace')
    }

    const val = await this.dataSource.get(id)

    val['id'] = val['_id'].toString()

    return this.outputSchema.parse(this.clearEmpties(Objects.deleteNulls(val)))
  }
  // TODO: apply types to the DB?
  /**
   *
   * Returns the PouchDB Database, you can use it
   * form more complex queries
   *
   * @param query
   */
  public raw(): PouchDB.Database {
    return this.dataSource
  }

  public async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO, OutputDTO>> {
    const pouchQUery = this.getPouchDBWhere(query?.where)

    // console.log(query?.where)
    // console.log(pouchQUery)

    const response = await this.dataSource.find(pouchQUery)

    const found = response.docs

    found.map(d => {
      d['id'] = d['_id']

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

  public getPouchDBWhere(
    where?: FluentQuery<ModelDTO>['where']
  ): PouchDB.Find.FindRequest<any> {
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
      return {
        selector: {}
      }
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
        element = '_id'
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

  /**
   *
   * @param id
   */
  public async findById(id: string): Promise<OutputDTO> {
    const dbIndex = db.findIndex(obj => obj.id === id)

    return db[dbIndex]
  }

  /**
   *
   * @param id
   */
  public async deleteById(id: string): Promise<string> {
    const dbIndex = db.findIndex(obj => obj.id === id)
    if (dbIndex > -1) {
      const element: { id: string } & OutputDTO = JSON.parse(
        JSON.stringify(db[dbIndex])
      )
      db.splice(dbIndex, 1)

      return element.id
    }
    throw new Error(`The element with id ${id} was not found`)
  }

  public loadFirst(query?: FluentQuery<ModelDTO>) {
    // Create a clone of the original class
    // to avoid polluting attributes (relatedQuery)
    const detachedClass = Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      this
    ) as PouchDBConnector<ModelDTO, InputDTO, OutputDTO>

    detachedClass.setRelatedQuery({
      entity: this.entity,
      repository: this,
      query
    })

    return detachedClass
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


  protected clone() {
    return new (<any>this.constructor)()
  }

  public async clear(): Promise<boolean> {
    await this.dataSource.close()
    return true
  }
}
