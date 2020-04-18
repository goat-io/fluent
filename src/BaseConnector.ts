import { Filter } from '@loopback/repository'
import { Collection } from './Collection'
import { Objects } from './Helpers/Objects'
import { IDeleted, IPaginatedData, IPaginator, ISure } from './Providers/types'

export interface IConnector {
  name?: string
  remoteConnection?: any
  connector?: any
}

export interface IDataElement {
  _id?: string
  [key: string]: any
}

export interface IInsertOptions {
  showProgress: boolean
}

export abstract class BaseConnector {
  protected name: string
  protected remoteConnection: any
  protected connector: any
  protected chainReference = []
  protected whereArray = []
  protected orWhereArray = []
  protected selectArray = []
  protected orderByArray = []
  protected limitNumber = undefined
  protected offsetNumber = undefined
  protected populateArray = []
  protected chunk = null
  protected pullSize = null
  protected ownerId = undefined
  protected paginator = undefined
  protected rawQuery = undefined
  protected operators = [
    '=',
    '<',
    '>',
    '<=',
    '>=',
    '<>',
    '!=',
    'in',
    'nin',
    'like',
    'regexp',
    'startsWith',
    'endsWith',
    'contains'
  ]
  constructor({ name, remoteConnection, connector }: IConnector) {
    this.name = name || this.name
    this.remoteConnection = remoteConnection || this.remoteConnection
    this.connector = connector || this.connector
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
  public async get(): Promise<IDataElement[]> {
    throw new Error('get() method not implemented')
  }
  /**
   *
   */
  public async all(): Promise<IDataElement[]> {
    throw new Error('all() method not implemented')
  }
  /**
   *
   */
  public async findById(id: string): Promise<IDataElement> {
    throw new Error('find() method not implemented')
  }
  /**
   *
   */
  public async find(id): Promise<IDataElement[]> {
    throw new Error('find() method not implemented')
  }
  /**
   *
   */
  public async findOne(): Promise<IDataElement[]> {
    throw new Error('findOne() method not implemented')
  }
  /**
   *
   */
  public async remove(): Promise<IDataElement> {
    throw new Error('remove() method not implemented')
  }
  /**
   *
   */
  public async removeById(_id: string): Promise<IDeleted> {
    throw new Error('remove() method not implemented')
  }
  /**
   *
   */
  public softDelete(): Promise<IDataElement> {
    throw new Error('softDelete() method not implemented')
  }
  /**
   *
   */
  public async insert(data: IDataElement, options?: IInsertOptions): Promise<IDataElement> {
    throw new Error('insert() method not implemented')
  }
  /**
   *
   */
  public async update(data: IDataElement): Promise<IDataElement> {
    throw new Error('update() method not implemented')
  }
  /**
   *
   */
  public async clear({ sure }: ISure): Promise<any[]> {
    throw new Error('clear() method not implemented')
  }
  /**
   *
   */
  public async updateOrCreate(): Promise<IDataElement> {
    throw new Error('updateOrCreate() method not implemented')
  }
  /**
   *
   */
  public async findAndRemove(): Promise<IDataElement[]> {
    throw new Error('findAndRemove() method not implemented')
  }
  /**
   *
   * @param {*} paginator
   */
  public async paginate(paginator: IPaginator): Promise<IPaginatedData> {
    throw new Error('paginate() method not implemented')
  }
  /**
   * @param {*} tableView
   */
  public tableView(paginator: IPaginator): Promise<IPaginatedData> {
    throw new Error('tableView() method not implemented')
  }
  /**
   * @param {*} raw
   */
  public raw(query: Filter): this {
    throw new Error('Raw method not implemented')
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
   * returns the its first result
   *
   * @return {Object} First result
   */
  public async first() {
    const data = await this.get()
    return Objects.get(() => data[0], [])
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

    return new Collection(data)
  }
  /**
   * Adds the given columns to the SelectArray
   * to use as column filter for the data
   *
   * @param {Array|String} columns The columns to select
   * @returns {Model} Fluent Model
   */
  public select(...columns) {
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
  public offset(offset) {
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
  public skip(offset) {
    return this.offset(offset)
  }
  /**
   *  Adds where filters to the query
   *  whereArray
   * @param {String|Array} args Where filters
   * @returns {Model} Fluent Model
   */
  public where(...args) {
    this.chainReference.push({ method: 'where', args })
    this.whereArray = []
    args = Array.isArray(args[0]) ? args : [args]
    args.forEach(arg => {
      if (arg.length !== 3) {
        throw new Error(
          'There where clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "' +
            JSON.stringify(arg) +
            '" '
        )
      }
      this.whereArray.push(arg)
    })
    return this
  }
  /**
   * Pushes where filters with AND condition
   * to the whereArray
   *
   * @param {String|Array} args Where filters
   * @returns {Model} Fluent Model
   */
  public andWhere(...args) {
    this.chainReference.push({ method: 'andWhere', args })
    args = Array.isArray(args[0]) ? args : [args]
    args.forEach(arg => {
      if (arg.length !== 3) {
        throw new Error(
          'There where clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "' +
            JSON.stringify(arg) +
            '" '
        )
      }
      this.whereArray.push(arg)
    })
    return this
  }
  /**
   * Pushes where filter with OR condition
   * to the orWhereArray
   *
   * @param {String|Array} args OR where filters
   * @returns {Model} Fluent Model
   */
  public orWhere(...args) {
    this.chainReference.push({ method: 'orWhere', args })
    args = Array.isArray(args[0]) ? args : [args]
    args.forEach(arg => {
      if (arg.length !== 3) {
        throw new Error(
          'There orWhere clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "' +
            JSON.stringify(arg) +
            '" '
        )
      }
      this.orWhereArray.push(arg)
    })
    return this
  }
  /**
   * Limits the number of results for the
   * given query
   * @param {int} limit limit number
   * @returns {Model} Fluent Model
   */
  public limit(limit) {
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
  public take(limit) {
    return this.limit(limit)
  }
  /**
   * Gets all values for a given KEY
   * @param {String} keyPath The path to the key
   * @returns {Array}
   */
  public async pluck(keyPath) {
    this.chainReference.push({ method: 'pluck', args: keyPath })
    let data = await this.get()

    data = data.map(e => {
      const extracted = Objects.getFromPath(e, keyPath, undefined)

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
  public orderBy(...args) {
    this.chainReference.push({ method: 'orderBy', args })
    this.orderByArray = args
    return this
  }
  public async ArrayInsert(dataArray, options) {
    let initial = 1
    const length = dataArray.length
    for (const element of dataArray) {
      if (options && options.showProgress) {
        console.log(`Inserting ${initial} of ${length}`)
      }
      try {
        const a = await this.insert(element, options)
        if (options && options.showProgress) {
          console.log(`Element ${initial} inserted`)
        }
        initial++
      } catch (e) {
        console.log(`ERROR - Element ${initial} - ${JSON.stringify(element)} could not be inserted`)
        console.log(e)
        initial++
      }
    }
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
      _data = _data.map(element => {
        const newElement = {}

        this.selectArray.forEach(attribute => {
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

    input.forEach(item => {
      let value = Array.isArray(item) ? item : item.split(',')

      value = value.map(e => {
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
