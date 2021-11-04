import {
  GoatFilter,
  GoatOutput,
  IDeleted,
  IGoatExtendedAttributes,
  IPaginatedData,
  IPaginator,
  ISure,
  OperatorType,
  Primitives,
  PrimitivesArray
} from './Providers/types'
import { TypedPathWrapper, typedPath } from 'typed-path'

import { Collection } from './Collection'
import { Dates } from './Helpers/Dates'
import { Id } from './Helpers/Id'
import { ObjectID } from 'typeorm'
import { Objects } from './Helpers/Objects'

export interface GoatConnectorInterface<InputDTO, OutputDTO> {
  get(): Promise<GoatOutput<InputDTO, OutputDTO>[]>
  all(filter: GoatFilter): Promise<GoatOutput<InputDTO, OutputDTO>[]>
  findById(id: string): Promise<GoatOutput<InputDTO, OutputDTO>>
  find(filter: GoatFilter): Promise<GoatOutput<InputDTO, OutputDTO>[]>
  // findOne(): Promise<T>
  deleteById(id: string): Promise<string>
  // softDelete(): Promise<T>
  updateById(
    id: string,
    data: InputDTO
  ): Promise<GoatOutput<InputDTO, OutputDTO>>
  insert(data: InputDTO): Promise<GoatOutput<InputDTO, OutputDTO>>
  insertMany(data: InputDTO[]): Promise<GoatOutput<InputDTO, OutputDTO>[]>
  // update(data: T): Promise<T>
  // updateOrCreate(data: T): Promise<T>
  // clear({ sure }: ISure): Promise<string[]>
  // findAndRemove(): Promise<T[]>
  // paginate(paginator: IPaginator): Promise<IPaginatedData<T>>
  // tableView(paginator: IPaginator): Promise<IPaginatedData<T>>
  // raw(): any
}

// tslint:disable-next-line: max-classes-per-file
export abstract class BaseConnector<ModelDTO, InputDTO, OutputDTO> {
  public _keys = typedPath<ModelDTO & InputDTO & OutputDTO>()
  protected outputKeys: string[]
  protected chainReference = []
  protected whereArray = []
  protected orWhereArray = []
  protected selectArray = []
  protected forceSelectArray = []
  protected orderByArray = []
  protected limitNumber: number = 0
  protected offsetNumber: number = 0
  protected populateArray = []
  protected chunk = null
  protected pullSize = null
  protected ownerId = undefined
  protected paginator = undefined
  protected rawQuery = undefined
  protected getFirst = false
  protected relations = undefined
  protected loadModels: boolean = false
  protected relationQuery
  protected modelRelations: any
  public isMongoDB: boolean

  protected getExtendedCreateAttributes = (): IGoatExtendedAttributes => {
    const date = Dates.currentIsoString()
    return {
      id: Id.objectIdString() + '_local',
      updated: date,
      created: date,
      roles: []
    }
  }

  constructor() {
    this.chainReference = []
    this.whereArray = []
    this.orWhereArray = []
    this.selectArray = []
    this.forceSelectArray = []
    this.orderByArray = []
    this.limitNumber = undefined
    this.offsetNumber = undefined
    this.populateArray = []
    this.chunk = null
    this.pullSize = null
    this.ownerId = undefined
    this.paginator = undefined
    this.rawQuery = undefined
    this.outputKeys = []
    this.getFirst = false
  }

  /**
   *
   */
  public async get(): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    throw new Error('get() method not implemented')
  }
  /**
   *
   */
  public async insertMany(
    data: InputDTO[]
  ): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
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
  public async first(): Promise<GoatOutput<InputDTO, OutputDTO> | null> {
    this.limit(1)
    const data = await this.get()

    if (!data[0]) {
      return null
    }

    return data[0]
  }
  /**
   *
   * Gets the data in the current query and
   * transforms it into a collection
   * @returns {Collection} Fluent Collection
   */
  public async collect(): Promise<Collection<GoatOutput<InputDTO, OutputDTO>>> {
    const data = await this.get()

    if (!Array.isArray(data)) {
      throw new Error('Collect method only accepts arrays of data')
    }

    return new Collection<GoatOutput<InputDTO, OutputDTO>>(data)
  }
  /**
   * Adds the given columns to the SelectArray
   * to use as column filter for the data
   *
   * @param {Array|String} columns The columns to select
   * @returns {Model} Fluent Model
   */
  public select(...columns: TypedPathWrapper<Primitives, Primitives>[]) {
    columns = this.prepareInput(columns)

    this.chainReference.push({ method: 'select', args: columns })
    this.selectArray = this.selectArray
      .concat(columns)
      .filter((elem, pos, arr) => {
        return arr.indexOf(elem) === pos
      })

    return this
  }
  /**
   * Adds the given columns to the SelectArray
   * to use as column filter for the data
   *
   * @param {Array|String} columns The columns to select
   * @returns {Model} Fluent Model
   */
  public forceSelect(...columns: TypedPathWrapper<Primitives, Primitives>[]) {
    if (typeof module === 'undefined' || !module.exports) {
      throw new Error('forceSelect cant be used in frontend')
    }
    columns = this.prepareInput(columns)

    this.chainReference.push({ method: 'forceSelect', args: columns })
    this.forceSelectArray = this.forceSelectArray
      .concat(columns)
      .filter((elem, pos, arr) => {
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
  public where(
    path: TypedPathWrapper<Primitives, Primitives>,
    operator: OperatorType,
    value: Primitives | PrimitivesArray
  ) {
    const stringPath = path.toString()
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
  public andWhere(
    path: TypedPathWrapper<Primitives, Primitives>,
    operator: OperatorType,
    value: Primitives | Primitives[]
  ) {
    const stringPath = path.toString()
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
  public orWhere(
    path: TypedPathWrapper<Primitives, Primitives>,
    operator: OperatorType,
    value: Primitives
  ) {
    const stringPath = path.toString()
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
  public async pluck(
    path: TypedPathWrapper<Primitives, Primitives>
  ): Promise<string[]> {
    const stringPath = path.toString()
    this.chainReference.push({ method: 'pluck', args: stringPath })
    const data = await this.get()

    const result: string[] = data.map(e => {
      const extracted = Objects.getFromPath(e, String(stringPath), undefined)

      if (typeof extracted.value !== 'undefined') {
        return extracted.value
      }
    })
    return result
  }
  /**
   *
   * @param {*} args
   */
  public orderBy(
    path: TypedPathWrapper<Primitives, Primitives>,
    order: 'asc' | 'desc' = 'desc',
    orderType: 'string' | 'number' | 'date' = 'string'
  ) {
    const stringPath = path.toString()
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
    const _data = Array.isArray(data) ? [...data] : [data]

    if (this.selectArray.length <= 0 && this.outputKeys.length <= 0) {
      return _data
    }

    const iterationArray =
      this.outputKeys.length === 0 && this.selectArray.length > 0
        ? this.selectArray
        : [...this.outputKeys, ...this.forceSelectArray]

    const compareArray =
      this.outputKeys.length === 0 && this.selectArray.length > 0
        ? [...this.outputKeys, ...this.forceSelectArray]
        : this.selectArray

    return _data.map(element => {
      const newElement = {}

      iterationArray.forEach(attribute => {
        if (compareArray.length > 0 && !compareArray.includes(attribute)) {
          return undefined
        }

        const extract = Objects.getFromPath(element, attribute, undefined)

        let value = Objects.get(() => extract.value, undefined)

        if (typeof value !== 'undefined' && value !== null) {
          if (
            typeof value === 'object' &&
            value.hasOwnProperty('data') &&
            value.data.hasOwnProperty('name')
          ) {
            newElement[extract.label] = value.data.name
          } else {
            if (typeof value === 'object' && Id.isValidObjectID(value)) {
              value = Id.objectIdString(value)
            }
            newElement[extract.label] = value
          }
        }
      })

      return Objects.nest(newElement)
    })
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

    if (
      this.selectArray.length > 0 &&
      (field.includes('.') || field.includes('['))
    ) {
      throw new Error(
        'Cannot orderBy nested attribute "' +
          field +
          '" when using Select. You must rename the attribute'
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
        throw new Error(
          'Cannot order by property "' +
            field +
            '" not all values have this property'
        )
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
   */
  protected reset() {
    this.chainReference = []
    this.whereArray = []
    this.orWhereArray = []
    this.selectArray = []
    this.forceSelectArray = []
    this.orderByArray = []
    this.limitNumber = undefined
    this.offsetNumber = undefined
    this.populateArray = []
    this.chunk = null
    this.pullSize = null
    this.ownerId = undefined
    this.paginator = undefined
    this.rawQuery = undefined
    this.getFirst = false
    this.relations = undefined
    this.loadModels = false
    this.relationQuery = undefined
  }
  /**
   *
   */
  public async load() {
    const result = await this.get()

    this.relationQuery = {
      data: result,
      relations: this.modelRelations
    }

    return this
  }
  /**
   *
   * @returns
   */
  public async loadFirst() {
    const result = await this.first()

    this.relationQuery = {
      data: result,
      relations: this.modelRelations
    }

    return this
  }
  /**
   * Gets the loaded data so we dont have to
   * call the main model twice
   * @returns
   */
  public getLoadedData():
    | GoatOutput<InputDTO, OutputDTO>[]
    | GoatOutput<InputDTO, OutputDTO> {
    return this.relationQuery.data
  }
  /**
   * Define which relations to load
   * @param Entities
   */
  public with(entities: any) {
    this.relations = entities

    return this
  }
  /**
   *
   * @param data
   */
  public async attach(data: InputDTO) {
    if (!this.relationQuery.relation || !this.relationQuery.data) {
      throw new Error('Attached can only be called as a related model')
    }

    if (this.relationQuery && this.relationQuery.data) {
      const relatedData = this.relationQuery.data.map(d => {
        return {
          [this.relationQuery.relation.inverseSidePropertyPath]: this.isMongoDB
            ? (Id.objectID(d.id) as unknown as ObjectID)
            : d.id,
          ...data
        }
      })

      return this.insertMany(relatedData)
    }
  }
  /**
   * Associate a registry with Many to Many relation
   * @param id
   */
  public associate(id: string) {
    if (!this.relationQuery.relation || !this.relationQuery.data) {
      throw new Error('Attached can only be called as a related model')
    }

    if (this.relationQuery && this.relationQuery.data) {
      const relatedData = this.relationQuery.data.map(d => {
        return {
          [this.relationQuery.relation.joinColumns[0].propertyName]: this
            .isMongoDB
            ? (Id.objectID(d.id) as unknown as ObjectID)
            : d.id,
          [this.relationQuery.relation.inverseJoinColumns[0].propertyName]: this
            .isMongoDB
            ? (Id.objectID(id) as unknown as ObjectID)
            : id
        }
      })

      return this.relationQuery.pivot.insertMany(relatedData)
    }
  }
  /**
   *
   */
  protected hasMany<T>(Repository, relationName: string) {
    if (this.relationQuery) {
      this.relationQuery.relation = this.relationQuery.relations[relationName]
    }
    const newClass = new Repository(this.relationQuery) as T
    this.reset()
    return newClass
  }
  /**
   *
   */
  // TODO implement hasOne
  protected hasOne() {
    throw new Error('Method not implemented')
  }
  /**
   *
   */
  protected belongsTo<T>(Repository, relationName: string) {
    if (this.relationQuery) {
      this.relationQuery.relation = this.relationQuery.relations[relationName]
    }
    const newClass = new Repository(this.relationQuery) as T
    this.reset()
    return newClass
  }
  /**
   *
   */
  protected belongsToMany<T, R>(Repository, Pivot, relationName: string) {
    this.relationQuery = !this.relationQuery
      ? { pivot: new Pivot(this.relationQuery) as R }
      : {
          ...this.relationQuery,
          ...{
            pivot: new Pivot(this.relationQuery) as R,
            relation: this.relationQuery.relations[relationName]
          }
        }

    const newClass = new Repository(this.relationQuery) as T
    this.reset()
    return newClass
  }
  /**
   *
   */
  // TODO implement hasManyThrough
  protected hasManyThrough() {
    throw new Error('Method not implemented')
  }
  /**
   *
   * @param {*} input
   */
  private prepareInput(columns: TypedPathWrapper<Primitives, Primitives>[]) {
    let cols = []

    columns.forEach(col => {
      cols = cols.concat(col.toString().trim())
    })

    cols.filter((elem, pos, arr) => {
      return arr.indexOf(elem) === pos
    })

    return cols
  }
}
