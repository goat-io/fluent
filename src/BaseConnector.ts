import { Filter } from '@loopback/repository'
import { Collection } from './Collection'
import { Objects } from './Helpers/Objects'
import { IDeleted, IPaginatedData, IPaginator, ISure, Primitives } from './Providers/types'
import { Id } from './Helpers/Id'
import { Dates } from './Helpers/Dates'
import { Paths } from './Collection'
import { type } from 'os'

export interface IGoatExtendedAttributes {
  _id: string
  modified: number
  updated: number
  deleted: number
  owner?: string
  roles: string[]
}

export interface GoatConnectorInterface<T> {
  get(): Promise<(T & IGoatExtendedAttributes)[]>
  all(): Promise<(T & IGoatExtendedAttributes)[]>
  findById(_id: string): Promise<T & IGoatExtendedAttributes>
  // find(query: any): Promise<T[]>
  // findOne(): Promise<T>
  deleteById(_id: string): Promise<string>
  // softDelete(): Promise<T>
  updateById(_id: string, data: T): Promise<T & IGoatExtendedAttributes>
  insert(data: T): Promise<T & IGoatExtendedAttributes>
  insertMany(data: T[]): Promise<(T & IGoatExtendedAttributes)[]>
  // update(data: T): Promise<T & IGoatExtendedAttributes>
  // updateOrCreate(data: T): Promise<T & IGoatExtendedAttributes>
  // clear({ sure }: ISure): Promise<string[]>
  // findAndRemove(): Promise<T[]>
  // paginate(paginator: IPaginator): Promise<IPaginatedData<T>>
  // tableView(paginator: IPaginator): Promise<IPaginatedData<T>>
  // raw(query: Filter): this
}

export interface IDataElement {
  _id?: string
  [key: string]: any
}

type OperatorType =
  | '='
  | '<'
  | '>'
  | '<='
  | '>='
  | '<>'
  | '!='
  | 'in'
  | 'nin'
  | 'like'
  | 'regexp'
  | 'startsWith'
  | 'endsWith'
  | 'contains'

export abstract class BaseConnector<T> {
  protected chainReference = []
  protected whereArray = []
  protected orWhereArray = []
  protected selectArray = []
  protected orderByArray = []
  protected limitNumber: number = 0
  protected offsetNumber: number = 0
  protected populateArray = []
  protected chunk = null
  protected pullSize = null
  protected ownerId = undefined
  protected paginator = undefined
  protected rawQuery = undefined

  protected getExtendedCreateAttributes = (): IGoatExtendedAttributes => {
    const date = Dates.currentUnixDate()
    return {
      _id: Id.objectID() + '_local',
      modified: date,
      updated: date,
      deleted: 0,
      roles: []
    }
  }
  constructor() {
    this.chainReference = []
    this.whereArray = []
    this.orWhereArray = []
    this.selectArray = []
    this.orderByArray = []
    this.limitNumber = undefined
    this.offsetNumber = undefined
    this.populateArray = []
    this.chunk = null
    this.pullSize = null
    this.ownerId = undefined
    this.paginator = undefined
    this.rawQuery = undefined
  }

  /**
   *
   */
  public async get(): Promise<(T & IGoatExtendedAttributes)[]> {
    throw new Error('get() method not implemented')
  }
  /**
   *
   * @param user
   */
  public owner(user: string) {
    this.chainReference.push({ method: 'owner', args: user })
    this.ownerId = user
    return this
  }
  /**
   *
   * @param user
   */
  public own(user: string) {
    return this.owner(user)
  }
  /**
   * Executes the Get() method and
   * returns its first result
   *
   * @return {Object} First result
   */
  public async first(): Promise<T & IGoatExtendedAttributes> {
    const data = await this.get()
    if (!data[0]) {
      throw new Error('First could not find elements')
    }

    return data[0]
  }
  /**
   *
   * Gets the data in the current query and
   * transforms it into a collection
   * @returns {Collection} Fluent Collection
   */
  public async collect() {
    const data = await this.get()

    if (!Array.isArray(data)) {
      throw new Error('Collect method only accepts arrays of data')
    }

    return new Collection<T>(data)
  }
  /**
   * Adds the given columns to the SelectArray
   * to use as column filter for the data
   *
   * @param {Array|String} columns The columns to select
   * @returns {Model} Fluent Model
   */
  public select(...columns: Paths<T & IGoatExtendedAttributes>[]) {
    columns = this.prepareInput(columns)
    this.chainReference.push({ method: 'select', args: columns })
    this.selectArray = this.selectArray.concat(columns).filter((elem, pos, arr) => {
      return arr.indexOf(elem) === pos
    })

    return this
  }
  /**
   *  Sets the offset number for
   *  the given query
   *
   * @param {int} offset The given offset
   * @returns {Model} Fluent Model
   */
  public offset(offset: number) {
    this.chainReference.push({ method: 'offset', args: offset })
    this.offsetNumber = offset
    return this
  }
  /**
   *  Sets the relations to be
   *  loaded with the query
   *
   * @param {int} offset The given offset
   * @returns {Model} Fluent Model
   */
  public populate(...relations) {
    this.chainReference.push({ method: 'relations', args: relations })
    this.populateArray = relations
    return this
  }
  /**
   *  Alias for the offset methods
   *
   * @param {int} offset the given offset
   */
  public skip(offset: number) {
    return this.offset(offset)
  }
  /**
   *  Adds where filters to the query
   *  whereArray
   * @param {String|Array} args Where filters
   * @returns {Model} Fluent Model
   */
  public where(path: Paths<T & IGoatExtendedAttributes>, operator: OperatorType, value: Primitives) {
    const stringPath = path && path.join('.')
    const chainedWhere = [stringPath, operator, value]
    this.chainReference.push({ method: 'where', chainedWhere })

    this.whereArray = []

    this.whereArray.push(chainedWhere)

    return this
  }
  /**
   * Pushes where filters with AND condition
   * to the whereArray
   *
   * @param {String|Array} args Where filters
   * @returns {Model} Fluent Model
   */
  public andWhere(path: Paths<T & IGoatExtendedAttributes>, operator: OperatorType, value: Primitives) {
    const stringPath = path && path.join('.')
    const chainedWhere = [stringPath, operator, value]
    this.chainReference.push({ method: 'andWhere', chainedWhere })

    this.whereArray.push(chainedWhere)
    return this
  }
  /**
   * Pushes where filter with OR condition
   * to the orWhereArray
   *
   * @param {String|Array} args OR where filters
   * @returns {Model} Fluent Model
   */
  public orWhere(path: Paths<T & IGoatExtendedAttributes>, operator: OperatorType, value: Primitives) {
    const stringPath = path && path.join('.')
    const chainedWhere = [stringPath, operator, value]
    this.chainReference.push({ method: 'orWhere', chainedWhere })
    this.orWhereArray.push(chainedWhere)
    return this
  }
  /**
   * Limits the number of results for the
   * given query
   * @param {int} limit limit number
   * @returns {Model} Fluent Model
   */
  public limit(limit: number) {
    this.chainReference.push({ method: 'limit', args: limit })
    this.limitNumber = limit
    return this
  }
  /**
   * Alias for the limit method
   *
   * @param {*} limit limit number
   * @returns {Model} Fluent Model
   */
  public take(limit: number) {
    return this.limit(limit)
  }
  /**
   * Gets all values for a given KEY
   * @param {String} keyPath The path to the key
   * @returns {Array}
   */
  public async pluck(path: Paths<T & IGoatExtendedAttributes>) {
    const stringPath = path && path.join('.')
    this.chainReference.push({ method: 'pluck', args: stringPath })
    let data = await this.get()

    data = data.map((e) => {
      const extracted = Objects.getFromPath(e, stringPath, undefined)

      if (typeof extracted.value !== 'undefined') {
        return extracted.value
      }
    })
    return data
  }
  /**
   *
   * @param {*} args
   */
  public orderBy(
    path: Paths<T & IGoatExtendedAttributes>,
    order: 'asc' | 'desc' = 'desc',
    orderType: 'string' | 'number' | 'date' = 'string'
  ) {
    const stringPath = path && path.join('.')
    const orderB = [stringPath, order, orderType]
    this.chainReference.push({ method: 'orderBy', orderB })
    this.orderByArray = orderB
    return this
  }
  /**
   * Maps the given Data to show only those fields
   * explicitly detailed on the Select function
   *
   * @param {Array} data Data from local or remote DB
   * @returns {Array} Formatted data with the selected columns
   */
  protected jsApplySelect(data) {
    let _data = Array.isArray(data) ? [...data] : [data]

    if (this.selectArray.length > 0) {
      _data = _data.map((element) => {
        const newElement = {}

        this.selectArray.forEach((attribute) => {
          const extract = Objects.getFromPath(element, attribute, undefined)

          const value = Objects.get(() => extract.value, undefined)

          if (typeof value !== 'undefined') {
            if (typeof value === 'object' && value.hasOwnProperty('data') && value.data.hasOwnProperty('name')) {
              newElement[extract.label] = value.data.name
            } else {
              newElement[extract.label] = value
            }
          }
        })

        return newElement
      })
    }

    return _data
  }
  /**
   *
   * @param {*} data
   */
  protected jsApplyOrderBy(data) {
    let _data = [...data]

    if (this.orderByArray.length === 0) {
      return _data
    }
    const field = this.orderByArray[0]

    if (this.selectArray.length > 0 && (field.includes('.') || field.includes('['))) {
      throw new Error(
        'Cannot orderBy nested attribute "' + field + '" when using Select. You must rename the attribute'
      )
    }

    const order = this.orderByArray[1]
    let type = this.orderByArray[2]

    if (!type) {
      type = 'string'
    }

    _data = _data.sort((a, b) => {
      const A = Objects.getFromPath(a, field, undefined).value
      const B = Objects.getFromPath(b, field, undefined).value

      if (typeof A === 'undefined' || typeof B === 'undefined') {
        throw new Error('Cannot order by property "' + field + '" not all values have this property')
      }
      // For default order and numbers
      if (type.includes('string') || type.includes('number')) {
        if (order === 'asc') {
          return A > B ? 1 : A < B ? -1 : 0
        }
        return A > B ? -1 : A < B ? 1 : 0
      } else if (type.includes('date')) {
        if (order === 'asc') {
          return new Date(A).getTime() - new Date(B).getTime()
        }
        return new Date(B).getTime() - new Date(A).getTime()
      }
    })
    return _data
  }
  /**
   *
   * @param {*} input
   */
  private prepareInput(input) {
    let cols = []

    input.forEach((item) => {
      let value = Array.isArray(item) ? item : item.split(',')

      value = value.map((e) => {
        return e.trim()
      })
      cols = cols.concat(value)
    })

    cols.filter((elem, pos, arr) => {
      return arr.indexOf(elem) === pos
    })

    return cols
  }
}
