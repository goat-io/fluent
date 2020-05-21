import { Filter } from '@loopback/repository'
import to from 'await-to-js'
import {
  BaseConnector,
  IDataElement,
  GoatConnectorInterface,
  GoatOutput
} from '../../BaseConnector'
import { Errors } from '../../Helpers/Errors'
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
}

export class TypeOrmConnector<InputDTO = IDataElement, OutputDTO = InputDTO>
  extends BaseConnector<InputDTO, OutputDTO>
  implements GoatConnectorInterface<InputDTO, GoatOutput<InputDTO, OutputDTO>> {
  private repository: Repository<OutputDTO>

  constructor({ repository }: ITypeOrmConnector<OutputDTO>) {
    super()
    this.repository = repository
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

    return this.jsApplySelect(result)
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
   * @param query
   */
  public raw(query: Filter): this {
    if (!query) {
      throw new Error('No query was received')
    }
    this.rawQuery = query
    return this
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
      console.log(error)
      throw new Error('Cannot insert data')
    }
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
  private getFilters(filters) {
    const filter = this.whereArray

    if (!filter || filter.length === 0) {
      return filters
    }

    filters.where = { and: [] }

    filter.forEach(condition => {
      const element = condition[0]
      const operator = condition[1]
      const value = condition[2]

      switch (operator) {
        case '=':
          filters.where.and.push({ [element]: Equal(value) })
          break
        case '!=':
          filters.where.and.push({ [element]: Not(Equal(value)) })
          break
        case '>':
          filters.where.and.push({ [element]: MoreThan(value) })
          break
        case '>=':
          filters.where.and.push({ [element]: MoreThanOrEqual(value) })
          break
        case '<':
          filters.where.and.push({ [element]: LessThan(value) })
          break
        case '<=':
          filters.where.and.push({ [element]: LessThanOrEqual(value) })
          break
        case 'in':
          filters.where.and.push({ [element]: In(value) })
          break
        case 'nin':
          filters.where.and.push({ [element]: Not(In(value)) })
          break
        case 'exists':
          filters.where.and.push({ [element]: Not(IsNull()) })
          break
        case '!exists':
          filters.where.and.push({ [element]: IsNull() })
          break
        case 'regex':
          filters.where.and.push({
            [element]: Like(value)
          })
          break
      }
    })

    return filters
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
