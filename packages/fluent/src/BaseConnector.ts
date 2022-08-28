import { Objects, Ids, Collection } from '@goatlab/js-utils'
import {
  FindByIdFilter,
  FluentHasManyParams,
  FluentBelongsToParams,
  FluentBelongsToManyParams,
  FluentQuery,
  Primitives,
  QueryFieldSelector,
  QueryOutput,
  AnyObject
} from './types'
import { clearEmpties } from './TypeOrmConnector/util/clearEmpties'

export abstract class BaseConnector<ModelDTO, InputDTO, OutputDTO> {
  protected outputKeys: string[]

  protected relatedQuery?: {
    entity: new () => ModelDTO
    query?: FluentQuery<ModelDTO>
    repository?: any
    key?: string
    pivot?: any
  }

  protected chunk = null

  protected pullSize = null

  protected paginator = undefined

  protected rawQuery = undefined

  protected modelRelations: any

  public isMongoDB: boolean

  constructor() {
    this.chunk = null
    this.pullSize = null
    this.paginator = undefined
    this.rawQuery = undefined
    this.outputKeys = []
  }
  /**
   *
   * @param data
   */
  public async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    throw new Error('get() method not implemented')
  }

  /**
   *
   * @param id
   * @param data
   */
  public async updateById(id: string, data: InputDTO): Promise<OutputDTO> {
    throw new Error('get() method not implemented')
  }

  /**
   *
   * @param query
   */
  public async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    throw new Error('findMany() method not implemented')
  }

  /**
   * Executes the findMany() method and
   * returns it's first result
   *
   * @return {Object} First result
   */
  public async findFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO> | null> {
    const data = await this.findMany({ ...query, limit: 1 })

    if (!data[0]) {
      return null
    }

    return data[0] as QueryOutput<T, ModelDTO>
  }

  public async requireById(
    id: string,
    q?: FindByIdFilter<ModelDTO>
  ): Promise<QueryOutput<FindByIdFilter<ModelDTO>, ModelDTO>> {
    const found = await this.findByIds([id], {
      select: q?.select,
      include: q?.include,
      limit: 1
    })

    found.map(d => {
      if (this.isMongoDB) {
        d['id'] = d['id'].toString()
      }
      clearEmpties(Objects.deleteNulls(d))
    })

    if (!found[0]) {
      throw new Error(`Object ${id} not found`)
    }

    // No need to validate, as findMany already validates
    return found[0] as unknown as QueryOutput<
      FindByIdFilter<ModelDTO>,
      ModelDTO
    >
  }

  public async requireFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>> {
    const found = await this.findMany({ ...query, limit: 1 })

    found.map(d => {
      if (this.isMongoDB) {
        d['id'] = d['id'].toString()
      }
      clearEmpties(Objects.deleteNulls(d))
    })

    if (!found[0]) {
      const stringQuery = query ? JSON.stringify(query) : ''
      throw new Error(`No objects found matching:  ${stringQuery}`)
    }
    // The object is already validated by findMany
    return found[0] as unknown as QueryOutput<T, ModelDTO>
  }

  public async findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T
  ): Promise<QueryOutput<T, ModelDTO>[]> {
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

    // The object should already be validated by FindMany
    return data as unknown as QueryOutput<T, ModelDTO>[]
  }

  public async findById<T extends FindByIdFilter<ModelDTO>>(
    id: string,
    q?: T
  ): Promise<QueryOutput<T, ModelDTO> | null> {
    const result = await this.findByIds([id], { ...q, limit: 1 })

    if (!result[0]) {
      return null
    }

    return result[0] as unknown as QueryOutput<T, ModelDTO>
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

    return new Collection<OutputDTO>(data as unknown as OutputDTO[])
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

  /**
   * Sets the relatedQuery param, to be used by the
   * different LOAD methods
   * @param r
   */
  protected setRelatedQuery(r: {
    entity: new () => ModelDTO
    query?: FluentQuery<ModelDTO>
    repository?: any
    key?: string
  }) {
    this.relatedQuery = r
  }
  /**
   * Associate One-to-Many relationship.
   * Associate an object to the parent.
   * @param data
   */
  public async associate(data: InputDTO | OutputDTO): Promise<OutputDTO[]> {
    if (!this.relatedQuery?.entity || !this.relatedQuery.key) {
      throw new Error('Associate can only be called as a related model')
    }

    const parentData = await this.relatedQuery.repository.findMany({
      ...this.relatedQuery.query,
      // We just need the IDs to make the relations
      select: { id: true }
    } as unknown as FluentQuery<ModelDTO>)

    const foreignKeyName =
      this.relatedQuery!['repository']['modelRelations'][this.relatedQuery.key]
        .inverseSidePropertyPath

    if (!foreignKeyName) {
      throw new Error(
        'The relationship was not properly defined. Please check that your Repository and Model relations have the same keys'
      )
    }

    const relatedData = parentData.map(r => ({
      [foreignKeyName]: r.id,
      ...data
    }))

    const existingIds = clearEmpties(relatedData.map(r => r.id))

    const existingData = existingIds.length
      ? await this.findByIds(relatedData.map(r => r.id))
      : []

    const updateQueries: any[] = []
    const insertQueries: any[] = []

    for (const related of relatedData) {
      const exists = existingData.find((d: AnyObject) => {
        // We need to manually define the id field
        const p = d as unknown as { id: string } & OutputDTO
        p.id === related.id
      }) as unknown as { id: string } & OutputDTO

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
   * Attach an object with Many-to-Many relation
   * @param id
   */
  // TODO: properly type the pivot object
  public async attach(id: string, pivot?: AnyObject) {
    if (!this.relatedQuery?.entity || !this.relatedQuery.key) {
      throw new Error('Associate can only be called as a related model')
    }

    const parentData = await this.relatedQuery.repository.findMany({
      ...this.relatedQuery.query,
      // We just need the IDs to make the relations
      select: { id: true }
    } as unknown as FluentQuery<ModelDTO>)

    const foreignKeyName =
      this.relatedQuery!['repository']['modelRelations'][this.relatedQuery.key]
        .joinColumns[0].propertyPath

    const inverseKeyName =
      this.relatedQuery!['repository']['modelRelations'][this.relatedQuery.key]
        .inverseJoinColumns[0].propertyPath

    if (!foreignKeyName || !inverseKeyName) {
      throw new Error(
        `The relationship was not properly defined. Please check that your Repository and Model relations have the same keys: Searching for: ${this.relatedQuery.key}`
      )
    }

    // TODO: insert data to the pivot table
    const relatedData = parentData.map(d => ({
      [foreignKeyName]: d.id,
      [inverseKeyName]: id,
      ...pivot
    }))

    return this.relatedQuery.pivot.insertMany(relatedData)
  }

  /**
   * One-to-Many relationship
   * To be used in the "parent" entity (One)
   */
  protected hasMany<T extends FluentHasManyParams<T>>(
    r: T
  ): InstanceType<T['repository']> {
    const newRepo = new r.repository() as any

    const calleeName = new Error('dummy')
      .stack!.split('\n')[2]
      // " at functionName ( ..." => "functionName"
      .replace(/^\s+at\s+(.+?)\s.+/g, '$1')
      .split('.')[1]

    if (this.relatedQuery) {
      newRepo.setRelatedQuery({
        ...this.relatedQuery,
        key: calleeName
      })
    }

    return newRepo as InstanceType<T['repository']>
  }

  /**
   * Inverse One-to-Many relationship
   * To be used in the "children" entity (Many)
   */
  protected belongsTo<T extends FluentBelongsToParams<T>>(
    r: T
  ): InstanceType<T['repository']> {
    return this.hasMany(r)
  }

  /**
   * One-to-One model relationship
   */
  // TODO implement hasOne
  protected hasOne() {
    throw new Error('Method not implemented')
  }

  /**
   * Many-to-Many relationship
   * To be used in both of the Related models (excluding pivot)
   */
  protected belongsToMany<T extends FluentBelongsToManyParams<T>>(
    r: T
  ): InstanceType<T['repository']> {
    const newRepo = new r.repository() as any

    // Hacky way to get the name of the callee function
    const relationName = new Error('dummy')
      .stack!.split('\n')[2]
      // " at functionName ( ..." => "functionName"
      .replace(/^\s+at\s+(.+?)\s.+/g, '$1')
      .split('.')[1]

    const pivot = new r.pivot() as any

    pivot.setRelatedQuery({
      ...this.relatedQuery,
      key: relationName
    })

    if (this.relatedQuery) {
      newRepo.setRelatedQuery({
        ...this.relatedQuery,
        key: relationName,
        pivot
      })
    } else {
      newRepo.setRelatedQuery({
        key: relationName,
        pivot
      })
    }

    // this.relationQuery.relations[relationName]

    return newRepo as InstanceType<T['repository']>
  }
  /**
   *
   */
  // TODO implement hasManyThrough
  protected hasManyThrough() {
    throw new Error('Method not implemented')
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
