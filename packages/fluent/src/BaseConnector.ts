import { ObjectID } from 'typeorm'
import { Objects, Ids, Collection } from '@goatlab/js-utils'
import {
  FluentHasManyParams,
  FluentQuery,
  LogicOperator,
  Primitives,
  PrimitivesArray,
  QueryFieldSelector,
  QueryOutput,
  SingleQueryOutput
} from './types'

export interface FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO> {
  //findById(id: string): Promise<OutputDTO | null>
  //findByIds(id: string[]): Promise<OutputDTO[] | null>
  //requireById(id: string): Promise<OutputDTO>
  findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO, OutputDTO>>
  //deleteById(id: string): Promise<string>
  //updateById(id: string, data: InputDTO): Promise<OutputDTO>
  insert(data: InputDTO): Promise<OutputDTO>
  insertMany(data: InputDTO[]): Promise<OutputDTO[]>
  // update(data: T): Promise<T>
  // updateOrCreate(data: T): Promise<T>
  // clear({ sure }: ISure): Promise<string[]>
  // findAndRemove(): Promise<T[]>
  // paginate(paginator: IPaginator): Promise<IPaginatedData<T>>
  // tableView(paginator: IPaginator): Promise<IPaginatedData<T>>
  // raw(): any
  // softDelete(): Promise<T>
  // findOne(): Promise<T>
}

// tslint:disable-next-line: max-classes-per-file
export abstract class BaseConnector<ModelDTO, InputDTO, OutputDTO> {
  protected outputKeys: string[]

  protected relatedQuery?: {
    entity: new () => ModelDTO
    query?: FluentQuery<ModelDTO>
  }

  protected chunk = null

  protected pullSize = null

  protected paginator = undefined

  protected rawQuery = undefined

  protected relationQuery

  protected modelRelations: any

  public isMongoDB: boolean

  constructor() {
    this.chunk = null
    this.pullSize = null
    this.paginator = undefined
    this.rawQuery = undefined
    this.outputKeys = []
  }

  public async findByIds(ids: string[]): Promise<OutputDTO[]> {
    throw new Error('findByIds() method not implemented')
  }
  /**
   *
   */
  public async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    throw new Error('get() method not implemented')
  }

  public async updateById(id: string, data: InputDTO): Promise<OutputDTO> {
    throw new Error('get() method not implemented')
  }

  public async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO, OutputDTO>> {
    throw new Error('findMany() method not implemented')
  }
  /**
   * Executes the Get() method and
   * returns it's first result
   *
   * @return {Object} First result
   */
  public async findFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<SingleQueryOutput<T, ModelDTO, OutputDTO> | null> {
    const data = await this.findMany({ ...query, limit: 1 })

    if (!data[0]) {
      return null
    }

    return data[0] as SingleQueryOutput<T, ModelDTO, OutputDTO>
  }
  /**
   *
   * Gets the data in the current query and
   * transforms it into a collection
   * @returns {Collection} Fluent Collection
   */
  public async collect(
    query: FluentQuery<ModelDTO>
  ): Promise<Collection<OutputDTO>> {
    const data = await this.findMany(query)

    if (!Array.isArray(data)) {
      return new Collection<OutputDTO>([data])
    }

    return new Collection<OutputDTO>(data)
  }

  /**
   * Gets all values for a given KEY
   * @returns {Array}
   * @param path
   */
  public async pluck(
    path: QueryFieldSelector<ModelDTO>,
    query?: FluentQuery<ModelDTO>
  ): Promise<Primitives[]> {
    const data = await this.findMany(query)
    const paths = Object.keys(Objects.flatten(path))

    const result: string[] = (data as any).map(e => {
      const extracted = Objects.getFromPath(e, String(paths[0]), undefined)

      if (typeof extracted.value !== 'undefined') {
        return extracted.value
      }
    })
    return result
  }

  public setRelatedQuery(
    entity: new () => ModelDTO,
    query?: FluentQuery<ModelDTO>
  ) {
    this.relatedQuery = {
      entity,
      query
    }
  }

  public getRelatedQuery() {
    return this.relatedQuery
  }
  /**
   * Attach One-to-Many relationship.
   * Attach a model to the parent.
   * @param data
   */
  public async attach(data: InputDTO | OutputDTO): Promise<OutputDTO[]> {
    if (!this.relationQuery.relation || !this.relationQuery.data) {
      throw new Error('Attached can only be called as a related model')
    }
    const foreignKeyName = this.relationQuery.relation.inverseSidePropertyPath
    const D = Array.isArray(this.relationQuery.data)
      ? this.relationQuery.data
      : [this.relationQuery.data]

    const relatedData = D.map(d => ({
      [foreignKeyName]: this.isMongoDB
        ? (Ids.objectID(d.id) as unknown as ObjectID)
        : d.id,
      ...data
    }))

    const existingData = await this.findByIds(relatedData.map(r => r.id))

    const updateQueries: any[] = []
    const insertQueries: any[] = []

    for (const related of relatedData) {
      const exists = existingData.find(
        (d: { id: string } & OutputDTO) => d.id === related.id
      ) as { id: string } & OutputDTO

      if (exists) {
        updateQueries.push(
          this.updateById(exists.id, {
            ...exists,
            [foreignKeyName]: related[foreignKeyName]
          } as unknown as InputDTO)
        )
      } else {
        insertQueries.push(related)
      }
    }
    const updateResult = await Promise.all(updateQueries)
    const insertedResult = await this.insertMany(insertQueries)

    return [...updateResult, ...insertedResult]
  }

  /**
   * Associate a registry with Many-to-Many relation
   * @param id
   */
  public associate(id: string) {
    if (!this.relationQuery?.relation || !this.relationQuery.data) {
      throw new Error('Associate can only be called as a related model')
    }

    const D = Array.isArray(this.relationQuery.data)
      ? this.relationQuery.data
      : [this.relationQuery.data]

    const relatedData = D.map(d => ({
      [this.relationQuery.relation.joinColumns[0].propertyName]: this.isMongoDB
        ? (Ids.objectID(d.id) as unknown as ObjectID)
        : d.id,
      [this.relationQuery.relation.inverseJoinColumns[0].propertyName]: this
        .isMongoDB
        ? (Ids.objectID(id) as unknown as ObjectID)
        : id
    }))

    return this.relationQuery.pivot.insertMany(relatedData)
  }

  /**
   * One-to-Many relationship
   * To be used in the "parent" entity (One)
   */
  protected hasMany<T extends FluentHasManyParams<ModelDTO>>({
    relationKey,
    repository
  }: T): InstanceType<T['repository']> {
    const flatten = Objects.flatten(relationKey)

    const relation = Object.keys(flatten)[0]

    if (this.relationQuery) {
      this.relationQuery.relation = this.relationQuery.relations[relation]
    }
    return new repository()
  }

  /**
   * One-to-One model relationship
   */
  // TODO implement hasOne
  protected hasOne() {
    throw new Error('Method not implemented')
  }

  /**
   * Inverse One-to-Many relationship
   * To be used in the "children" entity (Many)
   */
  protected belongsTo<T>(Repository, relationName: string) {
    if (this.relationQuery) {
      this.relationQuery.relation = this.relationQuery.relations[relationName]
    }
    const newClass = new Repository(this.relationQuery) as T
    return newClass
  }

  /**
   * Many-to-Many relationship
   * To be used in both of the Related models (excluding pivot)
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

    return newClass
  }

  public withPivot() {
    if (this.relationQuery?.pivot) {
      this.relationQuery.returnPivot = true
    }
    return this
  }
  /**
   *
   */
  // TODO implement hasManyThrough
  protected hasManyThrough() {
    throw new Error('Method not implemented')
  }

  public clearEmpties(object) {
    Object.entries(object).forEach(([k, v]) => {
      if (v && typeof v === 'object') {
        this.clearEmpties(v)
      }
      if (
        (v && typeof v === 'object' && !Object.keys(v).length) ||
        v === null ||
        v === undefined
      ) {
        if (Array.isArray(object)) {
          object.splice(Number(k), 1)
        } else {
          delete object[k]
        }
      }
    })
    return object
  }

  public isAnyObject(val: any): boolean {
    return typeof val === 'object' && !Array.isArray(val) && val !== null
  }

  public extractConditions(conditions: FluentQuery<ModelDTO>['where'][]) {
    const accumulatedClauses: {
      operator: LogicOperator
      element: string
      value: Primitives | PrimitivesArray
    }[] = []

    if (!conditions) {
      return accumulatedClauses
    }

    for (const clause of conditions) {
      if (!clause) {
        continue
      }
      for (const el of Object.keys(clause)) {
        const value = clause[el]

        if (this.isAnyObject(value)) {
          const initialKey = el
          const flatten = Objects.flatten(value)

          for (const key of Object.keys(flatten)) {
            if (LogicOperator[key]) {
              accumulatedClauses.push({
                operator: LogicOperator[key],
                element: `${initialKey}`,
                value: flatten[key]
              })
            } else if (key.includes('.')) {
              const op = key.split('.').slice(-1).pop()

              if (!op) {
                continue
              }

              if (LogicOperator[op]) {
                accumulatedClauses.push({
                  operator: LogicOperator[op],
                  element: `${initialKey}.${key.replace(`.${op}`, '')}`,
                  value: flatten[key]
                })
              } else {
                accumulatedClauses.push({
                  operator: LogicOperator.equals,
                  element: `${initialKey}.${key}`,
                  value: flatten[key]
                })
              }
            } else {
              accumulatedClauses.push({
                operator: LogicOperator.equals,
                element: `${initialKey}.${key}`,
                value: flatten[key]
              })
            }
          }
        } else {
          accumulatedClauses.push({
            operator: LogicOperator.equals,
            element: el,
            value
          })
        }
      }
    }
    return accumulatedClauses
  }

  /**
   * Maps the given Data to show only those fields
   * explicitly detailed on the Select function
   *
   * @param {Array} data Data from local or remote DB
   * @returns {Array} Formatted data with the selected columns
   */
  protected jsApplySelect(
    select: FluentQuery<ModelDTO>['select'],
    data: ModelDTO[]
  ): ModelDTO[] {
    const _data = Array.isArray(data) ? [...data] : [data]

    if (!select) {
      return data
    }

    const selectedAttributes = Object.keys(Objects.flatten(select))

    const iterationArray =
      this.outputKeys.length === 0 && selectedAttributes.length > 0
        ? selectedAttributes
        : [...this.outputKeys]

    const compareArray =
      this.outputKeys.length === 0 && selectedAttributes.length > 0
        ? [...this.outputKeys]
        : selectedAttributes

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
            if (typeof value === 'object' && Ids.isValidObjectID(value)) {
              value = Ids.objectIdString(value)
            }
            newElement[extract.label] = value
          }
        }
      })

      return Objects.nest(newElement)
    }) as ModelDTO[]
  }

  /**
   * Order the results once they have already
   * been pulled from the data source
   * @param {*} data
   */
  /*
    protected jsApplyOrderBy(orderBy: FluentQuery<ModelDTO>['orderBy'],data: ModelDTO[]) {
      let _data = [...data]
  
      if (orderBy?.length === 0) {
        return _data
      }

      const field = this.orderByArray[0]
  
      if (
        selectedAttributes.length > 0 &&
        (field.includes('.') || field.includes('['))
      ) {
        throw new Error(
          `Cannot orderBy nested attribute "${field}" when using Select. You must rename the attribute`
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
            `Cannot order by property "${field}" not all values have this property`
          )
        }
        // For default order and numbers
        if (type.includes('string') || type.includes('number')) {
          if (order === 'asc') {
            return A > B ? 1 : A < B ? -1 : 0
          }
          return A > B ? -1 : A < B ? 1 : 0
        }
        if (type.includes('date')) {
          if (order === 'asc') {
            return new Date(A).getTime() - new Date(B).getTime()
          }
          return new Date(B).getTime() - new Date(A).getTime()
        }
      })
      return _data
    }
    */
}
