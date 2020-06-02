import to from 'await-to-js'
import { BaseConnector, GoatConnectorInterface } from '../../BaseConnector'
import {
  GoatOutput,
  IDataElement,
  IPaginatedData,
  IPaginator,
  ISure,
  GoatFilter
} from '../types'

import { Event } from '../../Helpers/Event'
import { ObjectId } from 'mongodb'

import {
  Repository,
  Not,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Equal,
  In,
  Like,
  IsNull,
  FindManyOptions,
  createConnection as connection,
  ObjectID,
  MongoRepository,
  ObjectLiteral
} from 'typeorm'
import { Errors } from '../../Helpers/Errors'
import { Objects } from '../../Helpers/Objects'
/*
    
      import {
  paginate,
  Pagination,
  IPaginationOptions
} from 'nestjs-typeorm-paginate'
  async paginate(options: IPaginationOptions): Promise<Pagination<Form>> {
        return paginate<Form>(this.forms, options)
      }
   */

interface ITypeOrmConnector<T> {
  repository: Repository<T> | MongoRepository<T>
  isRelationalDB?: boolean
}

export const getOutputKeys = (keys: ObjectLiteral) => {
  const outputKeys = Object.keys(keys).filter(e => {
    return ![
      'deleted',
      'access',
      'submissionAccess',
      'version',
      '_ngram',
      'form'
    ].includes(e)
  })
  return outputKeys
}

export const createConnection = connection

export class TypeOrmConnector<
  ModelDTO = IDataElement,
  InputDTO = ModelDTO,
  OutputDTO = InputDTO
> extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements GoatConnectorInterface<InputDTO, GoatOutput<InputDTO, OutputDTO>> {
  private repository: Repository<ModelDTO> | MongoRepository<ModelDTO>
  private isRelationalDB: boolean

  constructor({ repository, isRelationalDB }: ITypeOrmConnector<ModelDTO>) {
    super()
    this.repository = repository
    this.outputKeys =
      getOutputKeys(this.repository.metadata.propertiesMap) || []
    this.isRelationalDB = isRelationalDB || false
  }
  /**
   *
   */
  public async get(): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    const query = this.getGeneratedQuery()

    const [error, result]: any = await to(this.repository.find(query))

    if (error) {
      throw new Error(Errors(error, 'Error while getting submissions'))
    }
    const data = this.jsApplySelect(result)
    this.reset()
    return data
  }
  /**
   *
   */
  public async getPaginated(): Promise<
    IPaginatedData<GoatOutput<InputDTO, OutputDTO>>
  > {
    const [error, response]: any = await to(this.get())

    if (error) {
      if (error.response.status === 440) {
        Event.emit('GOAT:SESSION:EXPIRED', {
          data: error,
          text: 'Session expired'
        })

        throw new Error(Errors(error, 'Session has expired.'))
      }
      throw new Error(Errors(error, 'Error while getting submissions'))
    }

    const results: IPaginatedData<OutputDTO> = {
      current_page: response[0].meta.currentPage,
      data: response[0].data,
      first_page_url: response[0].meta.firstPageUrl,
      next_page_url: response[0].meta.nextPageUrl,
      path: response[0].meta.path,
      per_page: response[0].meta.itemsPerPage,
      prev_page_url: response[0].meta.previousPageUrl,
      total: response[0].meta.totalItemCount
    }

    if (results && results.data && this.selectArray.length > 0) {
      results.data = this.jsApplySelect(results.data)
      return results
    }
    return results
  }
  /**
   *
   */
  public async all(): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    return this.get()
  }
  /**
   *
   * @param filter
   */
  public async find(
    filter: GoatFilter = {}
  ): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    const stringFilter: string = filter as string
    let parsedFilter: any = {}
    try {
      parsedFilter = JSON.parse(stringFilter)
    } catch (error) {
      parsedFilter = {}
    }

    this.selectArray = (parsedFilter && parsedFilter.fields) || []
    this.whereArray =
      (parsedFilter && parsedFilter.where && parsedFilter.where.and) || []
    this.orWhereArray =
      (parsedFilter && parsedFilter.where && parsedFilter.where.or) || []
    this.limit(
      (parsedFilter && (parsedFilter.limit || parsedFilter.take)) || 100
    )
    this.offset(
      (parsedFilter && (parsedFilter.offset || parsedFilter.skip)) || 0
    )

    if (parsedFilter && parsedFilter.order) {
      const orderB = [
        parsedFilter.order.field,
        parsedFilter.order.asc ? 'asc' : 'desc',
        parsedFilter.order.type || 'string'
      ]
      this.chainReference.push({ method: 'orderBy', orderB })
      this.orderByArray = orderB
    }

    return this.get()
  }
  /**
   *
   * @param paginator
   */
  public async paginate(
    paginator: IPaginator
  ): Promise<IPaginatedData<GoatOutput<InputDTO, OutputDTO>>> {
    if (!paginator) {
      throw new Error('Paginator cannot be empty')
    }
    this.paginator = paginator

    const response = await this.getPaginated()

    return response
  }
  /**
   *
   * Returns the TypeOrm Repository, you can use it
   * form more complex queries and to get
   * the TypeOrm query builder
   *
   * @param query
   */
  public raw(): Repository<ModelDTO> {
    return this.repository
  }
  /**
   *
   * @param data
   */
  public async insert(
    data: InputDTO
  ): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const [error, datum] = await to(this.repository.save(data))

    if (error) {
      return Promise.reject(Errors(error, 'Validation Error'))
    }

    const result = this.jsApplySelect([datum]) as GoatOutput<
      InputDTO,
      OutputDTO
    >[]
    this.reset()
    return result[0]
  }
  /**
   *
   * @param data
   */
  public async insertMany(
    data: InputDTO[]
  ): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    const [error, inserted] = await to(
      this.repository.save(data, {
        chunk: data.length / 300
      })
    )

    if (error) {
      return Promise.reject(Errors(error, 'Could not insert all elements'))
    }
    this.reset()

    const result = this.jsApplySelect(inserted) as GoatOutput<
      InputDTO,
      OutputDTO
    >[]
    return result
  }
  /**
   *
   * @param data
   */
  public async updateById(
    id: string,
    data: InputDTO
  ): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const parsedId = this.isRelationalDB ? id : (new ObjectId(id) as ObjectID)

    const dataToInsert = this.outputKeys.includes('updated')
      ? {
          ...data,
          ...{ updated: new Date() }
        }
      : data

    // const entity = this.repository.create(dataToInsert)

    const [error, updated] = await to(this.repository.update(id, dataToInsert))
    if (error) {
      return Promise.reject(Errors(error, 'Could not update'))
    }

    const [getError, dbResult] = await to(this.repository.findByIds([parsedId]))

    if (getError) {
      return Promise.reject(Errors(error, 'Entity not found'))
    }
    const result = this.jsApplySelect(dbResult) as GoatOutput<
      InputDTO,
      OutputDTO
    >[]
    this.reset()
    return result[0]
  }
  /**
   *
   * PUT operation. All fields not included in the data
   *  param will be set to null
   *
   * @param id
   * @param data
   */
  public async replaceById(
    id: string,
    data: InputDTO
  ): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const parsedId = this.isRelationalDB ? id : (new ObjectId(id) as ObjectID)

    const [getError, value] = await to(this.repository.findOneOrFail(parsedId))

    if (getError) {
      return Promise.reject(Errors(getError, 'Entity not found'))
    }

    const flatValue = Objects.flatten(JSON.parse(JSON.stringify(value)))
    Object.keys(flatValue).forEach(key => {
      flatValue[key] = null
    })

    const nullObject = Objects.nest(flatValue)

    const newValue = { ...nullObject, ...data }

    delete newValue.id
    delete newValue.created
    delete newValue.updated

    const entity = this.repository.create(newValue)

    const dataToInsert = this.outputKeys.includes('updated')
      ? {
          ...entity,
          ...{ updated: new Date() }
        }
      : data

    const [error] = await to(this.repository.update(id, dataToInsert))

    if (error) {
      return Promise.reject(Errors(error, 'Could not save'))
    }

    const [findError, val] = await to(this.repository.findOneOrFail(parsedId))

    if (findError) {
      return Promise.reject(Errors(findError, 'Entity not found'))
    }

    const returnValue = this.jsApplySelect([val]) as GoatOutput<
      InputDTO,
      OutputDTO
    >[]
    this.reset()

    return returnValue[0]
  }
  /**
   *
   * @param param0
   */
  public async clear({ sure }: ISure) {
    if (!sure || sure !== true) {
      throw new Error(
        'Clear() method will delete everything!, you must set the "sure" parameter "clear({sure:true})" to continue'
      )
    }

    const [error, data] = await to(this.repository.clear())

    if (error) {
      console.log(error)
      throw new Error('Cannot Clear the model')
    }
    this.reset()
    return true
  }
  /**
   *
   * @param id
   */
  public async deleteById(id: string): Promise<string> {
    const parsedId = this.isRelationalDB ? id : (new ObjectId(id) as ObjectID)

    const [error, removed] = await to(this.repository.delete(parsedId))
    if (error) {
      return Promise.reject(Errors(error, `Could not delete ${id}`))
    }

    this.reset()
    return id
  }
  /**
   *
   * @param id
   */
  public async findById(id: string): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const parsedId = this.isRelationalDB ? id : (new ObjectId(id) as ObjectID)

    const [error, data] = await to(this.repository.findByIds([parsedId]))

    if (error) {
      return Promise.reject(Errors(error, 'Could not get data'))
    }
    const result = this.jsApplySelect(data) as GoatOutput<InputDTO, OutputDTO>[]
    this.reset()

    if (result.length === 0) {
      return Promise.reject(Errors(error, 'Entity not found'))
    }

    return result[0]
  }
  /**
   *
   */
  private getPage() {
    const page = 'page='
    if (this.paginator && this.paginator.page) {
      return page + this.paginator.page + '&'
    }

    return ''
  }
  /**
   *
   * @param filter
   */
  private getPaginatorLimit(filter) {
    if (this.paginator && this.paginator.perPage) {
      return { ...filter, limit: this.paginator.perPage }
    }

    return filter
  }
  /**
   *
   */
  private getPopulate() {
    const populate = []
    this.populateArray.forEach(relation => {
      if (typeof relation === 'string') {
        populate.push({ relation })
      } else if (Array.isArray(relation)) {
        relation.forEach(nestedRelation => {
          if (typeof nestedRelation === 'string') {
            populate.push({ relation: nestedRelation })
          } else if (typeof nestedRelation === 'object') {
            populate.push(nestedRelation)
          }
        })
      } else if (typeof relation === 'object') {
        populate.push(relation)
      }
    })

    return populate
  }
  /**
   *
   */
  private getGeneratedQuery(): FindManyOptions {
    let filter: any = {}
    filter = this.isRelationalDB
      ? this.getFilters(filter)
      : this.getMongoFilters(filter)

    filter = this.getLimit(filter)
    filter = this.getSkip(filter)
    filter = this.getSelect(filter)
    filter = this.getOrderBy(filter)
    filter = this.getPaginatorLimit(filter)
    const page = this.getPage()
    const populate = this.getPopulate()

    if (this.rawQuery) {
      filter.relations = populate || this.rawQuery.populate
      filter.take = filter.take || this.rawQuery.limit
      filter.skip = filter.skip || this.rawQuery.skip
      filter.order = filter.order || this.rawQuery.order
      filter.select = { ...filter.select, ...this.rawQuery.fields }
      // const where = filter.where && filter.where.and ? filter.where.and[0] : {}
      filter.where = { ...this.rawQuery.where }
    }

    return filter
  }
  /**
   *
   * @param filters
   */
  private getFilters(filters: FindManyOptions) {
    const andFilters = this.whereArray
    const orFilters = this.orWhereArray
    if (!andFilters || andFilters.length === 0) {
      return filters
    }

    const Filters = { where: [{}] }

    // Apply and conditions
    andFilters.forEach(condition => {
      const element = condition[0]
      const operator = condition[1]
      const value = condition[2]

      switch (operator) {
        case '=':
          Filters.where[0] = {
            ...Filters.where[0],
            ...{ [element]: Equal(value) }
          }
          break
        case '!=':
          Filters.where[0] = {
            ...Filters.where[0],
            ...{ [element]: Not(Equal(value)) }
          }
          break
        case '>':
          Filters.where[0] = {
            ...Filters.where[0],
            ...{ [element]: MoreThan(value) }
          }
          break
        case '>=':
          Filters.where[0] = {
            ...Filters.where[0],
            ...{ [element]: MoreThanOrEqual(value) }
          }
          break
        case '<':
          Filters.where[0] = {
            ...Filters.where[0],
            ...{ [element]: LessThan(value) }
          }
          break
        case '<=':
          Filters.where[0] = {
            ...Filters.where[0],
            ...{ [element]: LessThanOrEqual(value) }
          }
          break
        case 'in':
          Filters.where[0] = {
            ...Filters.where[0],
            ...{ [element]: In(value) }
          }
          break
        case 'nin':
          Filters.where[0] = {
            ...Filters.where[0],
            ...{ [element]: Not(In(value)) }
          }
          break
        case 'exists':
          Filters.where[0] = {
            ...Filters.where[0],
            ...{ [element]: Not(IsNull()) }
          }
          break
        case '!exists':
          Filters.where[0] = {
            ...Filters.where[0],
            ...{ [element]: IsNull() }
          }
          break
        case 'regexp':
          Filters.where[0] = {
            ...Filters.where[0],
            ...{ [element]: Like(value) }
          }
          break
      }
    })

    // Apply or conditions
    orFilters.forEach(condition => {
      const element = condition[0]
      const operator = condition[1]
      const value = condition[2]

      switch (operator) {
        case '=':
          Filters.where.push({ [element]: Equal(value) })
          break
        case '!=':
          Filters.where.push({ [element]: Not(Equal(value)) })
          break
        case '>':
          Filters.where.push({ [element]: MoreThan(value) })
          break
        case '>=':
          Filters.where.push({ [element]: MoreThanOrEqual(value) })
          break
        case '<':
          Filters.where.push({ [element]: LessThan(value) })
          break
        case '<=':
          Filters.where.push({ [element]: LessThanOrEqual(value) })
          break
        case 'in':
          Filters.where.push({ [element]: In(value) })
          break
        case 'nin':
          Filters.where.push({ [element]: Not(In(value)) })
          break
        case 'exists':
          Filters.where.push({ [element]: Not(IsNull()) })
          break
        case '!exists':
          Filters.where.push({ [element]: IsNull() })
          break
        case 'regexp':
          Filters.where.push({ [element]: Like(value) })
          break
      }
    })

    return Filters
  }
  /**
   *
   * @param filter
   */
  public getMongoFilters(filters) {
    const andFilters = this.whereArray
    const orFilters = this.orWhereArray

    if (!andFilters || andFilters.length === 0) {
      return filters
    }

    const Filters = { where: { $and: [] } }

    andFilters.forEach(condition => {
      const element = condition[0]
      const operator = condition[1]
      const value = condition[2]

      switch (operator) {
        case '=':
          Filters.where.$and.push({ [element]: { $eq: value } })
          break
        case '!=':
          Filters.where.$and.push({ [element]: { $neq: value } })
          break
        case '>':
          Filters.where.$and.push({ [element]: { $gt: value } })
          break
        case '>=':
          Filters.where.$and.push({ [element]: { $gte: value } })
          break
        case '<':
          Filters.where.$and.push({ [element]: { $lt: value } })
          break
        case '<=':
          Filters.where.$and.push({ [element]: { $lte: value } })
          break
        case 'in':
          Filters.where.$and.push({ [element]: { $in: value } })
          break
        case 'nin':
          Filters.where.$and.push({ [element]: { $not: { $in: value } } })
          break
        case 'exists':
          Filters.where.$and.push({ [element]: { $exists: true } })
          break
        case '!exists':
          Filters.where.$and.push({ [element]: { $exists: false } })
          break
        case 'regex':
          Filters.where.$and.push({ [element]: { $regex: value } })
          break
      }
    })

    return Filters
  }
  /**
   *
   * @param filter
   */
  // TODO order by can have more than 1 element
  private getOrderBy(filter) {
    if (!this.orderByArray || this.orderByArray.length === 0) {
      return filter
    }

    return {
      ...filter,
      order: {
        [this.orderByArray[0]]: this.orderByArray[1].toUpperCase()
      }
    }
  }
  /**
   *
   * @param filter
   */
  private getLimit(filter) {
    if (!this.limitNumber || this.limitNumber === 0) {
      this.limitNumber = (this.rawQuery && this.rawQuery.limit) || 50
    }

    return { ...filter, take: this.limitNumber }
  }
  /**
   *
   * @param filter
   */
  private getSkip(filter) {
    if (!this.offsetNumber) {
      this.offsetNumber = (this.rawQuery && this.rawQuery.skip) || 0
    }

    return { ...filter, skip: this.offsetNumber }
  }
  /**
   *
   * @param filter
   */
  private getSelect(filter) {
    let select = this.selectArray

    select = select.map(s => {
      s = s.split(' as ')[0]
      s = s.includes('id') ? 'id' : s
      return s
    })

    if (select.find(e => e.startsWith('data.'))) {
      select.unshift('data')
    }

    if (!select) {
      return filter
    }

    return { ...filter, fields: select }
  }
}
