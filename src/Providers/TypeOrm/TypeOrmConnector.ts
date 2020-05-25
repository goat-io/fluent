import { Filter } from '@loopback/repository'
import to from 'await-to-js'
import {
  BaseConnector,
  IDataElement,
  GoatConnectorInterface,
  GoatOutput
} from '../../BaseConnector'

import { Event } from '../../Helpers/Event'
import { IPaginatedData, IPaginator, ISure } from '../types'
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
  FindManyOptions
} from 'typeorm'
import { Errors } from '../../Helpers/Errors'
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
  repository: Repository<T>
  outputKeys?: string[]
}

export class TypeOrmConnector<
  ModelDTO = IDataElement,
  InputDTO = ModelDTO,
  OutputDTO = InputDTO
> extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements GoatConnectorInterface<InputDTO, GoatOutput<InputDTO, OutputDTO>> {
  private repository: Repository<ModelDTO>

  constructor({ repository, outputKeys }: ITypeOrmConnector<ModelDTO>) {
    super()
    this.repository = repository
    this.outputKeys = outputKeys || []
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
    filter: Filter<GoatOutput<InputDTO, OutputDTO>>
  ): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    this.selectArray = String(filter.fields).split(',')
    this.limit(Number(filter.limit))
    this.offset(Number(filter.offset))
    this.skip(Number(filter.skip))
    // this.repository.createQueryBuilder('model').w
    const order: string[] = filter.order

    if (order.length > 0) {
      const firstOrder = String(order).split(',')[0].split(' ')
      const orderB = [firstOrder[0], firstOrder[1], firstOrder[2] || 'string']
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
    const [error, result] = await to(this.repository.save(data))

    if (error) {
      return Promise.reject(Errors(error, 'Validation Error'))
    }
    this.reset()
    return result
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
      console.log(error)
      throw new Error('Could not insert all elements')
    }
    this.reset()
    return inserted
  }
  /**
   *
   * @param data
   */
  public async updateById(
    _id: string,
    data: InputDTO
  ): Promise<GoatOutput<InputDTO, OutputDTO>> {
    if (!_id) {
      throw new Error(
        'TypeORM connector error. Cannot update a Model without _id key'
      )
    }

    const [error, updated] = await to(this.repository.update(_id, data))
    const [getError, result] = await to(this.repository.findByIds([_id]))

    if (error || getError) {
      console.log(error)
      console.log(getError)
      throw new Error('Cannot update data')
    }
    this.reset()
    return result[0]
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
   * @param _id
   */
  public async deleteById(_id: string): Promise<string> {
    const [error, removed] = await to(this.repository.delete(_id))

    if (error) {
      console.log(error)
      throw new Error(`FormioConnector: Could not delete ${_id}`)
    }
    this.reset()
    return _id
  }
  /**
   *
   * @param _id
   */
  public async findById(_id: string): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const [error, data] = await to(this.repository.findOne({ where: { _id } }))

    if (error) {
      console.log(error)
      throw new Error('FindById() could not get remote data')
    }
    this.reset()
    return data
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
    let filter: FindManyOptions = {}
    filter = this.getFilters(filter)
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
    const oldFilters = this.orWhereArray
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
    oldFilters.forEach(condition => {
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
      s = s.includes('_id') ? '_id' : s
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
