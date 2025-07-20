import {
  modelGeneratorDataSource,
  getRelationsFromModelGenerator,
  getOutputKeys,
  LogicOperator,
  extractConditions
} from '@goatlab/fluent'
import type { AnyObject } from '@goatlab/js-utils'
import { Objects } from '@goatlab/js-utils'
import { z } from 'zod'
import PouchDB from 'pouchdb'

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

// Types needed for PouchDB connector
interface FluentQuery<T> {
  where?: any
  select?: any
  include?: any
  orderBy?: any[]
  limit?: number
  offset?: number
  paginated?: { page: number; perPage: number }
}

interface FindByIdFilter<T> {
  select?: any
  include?: any
  limit?: number
}

interface PaginatedData<T> {
  total: number
  perPage: number
  currentPage: number
  nextPage: number
  firstPage: number
  lastPage: number
  prevPage: number | null
  from: number
  to: number
  data: T[]
}

interface LoadedResult<T> {
  // Minimal interface
}

type QueryOutput<T, U> = any

interface FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO> {
  insert(data: InputDTO): Promise<OutputDTO>
  insertMany(data: InputDTO[]): Promise<OutputDTO[]>
  updateById(id: string, data: Partial<InputDTO>): Promise<OutputDTO>
  replaceById(id: string, data: Partial<InputDTO>): Promise<OutputDTO>
  deleteById(id: string): Promise<string>
  findMany<T extends FluentQuery<ModelDTO>>(query?: T): Promise<QueryOutput<T, ModelDTO>[]>
  findFirst<T extends FluentQuery<ModelDTO>>(query?: T): Promise<QueryOutput<T, ModelDTO> | null>
  findByIds<T extends FindByIdFilter<ModelDTO>>(ids: string[], q?: T): Promise<QueryOutput<T, ModelDTO>[]>
  requireById(id: string, q?: FindByIdFilter<ModelDTO>): Promise<QueryOutput<FindByIdFilter<ModelDTO>, ModelDTO>>
  requireFirst<T extends FluentQuery<ModelDTO>>(query?: T): Promise<QueryOutput<T, ModelDTO>>
  pluck(path: any, query?: FluentQuery<ModelDTO>): Promise<any[]>
  clear(): Promise<boolean>
}

// Base class for connectors
abstract class BaseConnector<ModelDTO, InputDTO, OutputDTO> {
  protected outputKeys: string[] = []
  protected modelRelations: any[] = []
  public isMongoDB: boolean = false
  protected relationQuery?: any

  async findFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO> | null> {
    const data = await this.findMany({ ...query, limit: 1 } as T)
    return data[0] || null
  }

  async requireById(
    id: string,
    q?: FindByIdFilter<ModelDTO>
  ): Promise<QueryOutput<FindByIdFilter<ModelDTO>, ModelDTO>> {
    const found = await this.findByIds([id], {
      select: q?.select,
      include: q?.include,
      limit: 1
    })

    if (!found[0]) {
      throw new Error(`Object ${id} not found`)
    }

    return found[0] as unknown as QueryOutput<FindByIdFilter<ModelDTO>, ModelDTO>
  }

  async requireFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>> {
    const found = await this.findFirst(query)
    if (!found) {
      throw new Error('Object not found')
    }
    return found
  }

  async findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    return this.findMany({
      where: { id: { in: ids } },
      select: q?.select,
      include: q?.include,
      limit: q?.limit
    } as unknown as FluentQuery<ModelDTO>)
  }

  setRelatedQuery(query: any) {
    this.relationQuery = query
  }

  abstract insert(data: InputDTO): Promise<OutputDTO>
  abstract insertMany(data: InputDTO[]): Promise<OutputDTO[]>
  abstract updateById(id: string, data: Partial<InputDTO>): Promise<OutputDTO>
  abstract replaceById(id: string, data: Partial<InputDTO>): Promise<OutputDTO>
  abstract deleteById(id: string): Promise<string>
  abstract findMany<T extends FluentQuery<ModelDTO>>(query?: T): Promise<QueryOutput<T, ModelDTO>[]>
  abstract pluck(path: any, query?: FluentQuery<ModelDTO>): Promise<any[]>
  abstract clear(): Promise<boolean>
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

    this.modelRelations = Object.values(relations || {})

    this.outputKeys = getOutputKeys(relationShipBuilder) || []
  }

  /**
   *
   * @param data
   */
  public async insert(data: InputDTO): Promise<OutputDTO> {
    // Validate Input
    const validatedData = this.inputSchema.parse(data)
    
    // Add created date if needed
    const dataToInsert: any = { ...validatedData }
    if (this.outputKeys.includes('created') && !dataToInsert.created) {
      dataToInsert.created = new Date()
    }

    let response: any
    if (dataToInsert.id) {
      // If id is provided, use put with explicit _id
      const docData = { ...dataToInsert }
      docData._id = docData.id
      delete docData.id
      response = await this.dataSource.put(docData)
    } else {
      // If no id, use post to auto-generate
      response = await this.dataSource.post(dataToInsert)
    }
    
    let datum = await this.dataSource.get(response.id)
    datum['id'] = datum['_id']
    
    // Handle date fields
    if (datum['created'] && typeof datum['created'] === 'string') {
      datum['created'] = new Date(datum['created'])
    }
    if (datum['updated'] && typeof datum['updated'] === 'string') {
      datum['updated'] = new Date(datum['updated'])
    }

    // Validate Output
    return this.outputSchema.parse(
      Objects.clearEmpties(Objects.deleteNulls(datum))
    )
  }

  /**
   *
   * @param data
   */
  public async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    const validatedData = this.inputSchema.array().parse(data)
    
    // Add created date if needed
    const dataToInsert = validatedData.map((item: any) => {
      const doc = { ...item }
      if (this.outputKeys.includes('created') && !doc.created) {
        doc.created = new Date()
      }
      return doc
    })

    const inserted = await this.dataSource.bulkDocs(dataToInsert as any)

    const insertedOK = (inserted as any).map((i: any) => {
      if (i.id) {
        return i
      }
    }).filter(Boolean) as any

    const elements = await this.dataSource.bulkGet({
      docs: insertedOK
    })

    const res = elements.results.map(r => {
      if (r.id && r.docs?.[0] && r.docs[0]['ok']) {
        const doc = { ...r.docs[0]['ok'], id: r.id }
        
        // Handle date fields
        if (doc['created'] && typeof doc['created'] === 'string') {
          doc['created'] = new Date(doc['created'])
        }
        if (doc['updated'] && typeof doc['updated'] === 'string') {
          doc['updated'] = new Date(doc['updated'])
        }
        
        return Objects.clearEmpties(Objects.deleteNulls(doc))
      }
    }).filter(Boolean)

    return this.outputSchema.array().parse(res)
  }
  /**
   * PATCH operation
   * @param data
   */
  public async updateById(id: string, data: Partial<InputDTO>): Promise<OutputDTO> {
    // Get existing document
    const existing = await this.dataSource.get(id)
    const existingRev = existing._rev
    existing['id'] = existing['_id']
    if ('_id' in existing) delete (existing as any)['_id']
    if ('_rev' in existing) delete (existing as any)['_rev']
    
    // Merge with new data
    const merged = {
      ...existing,
      ...data
    }
    
    if (this.outputKeys.includes('updated')) {
      merged['updated'] = new Date()
    }

    // Convert date strings to Date objects for existing data
    if (merged['created'] && typeof merged['created'] === 'string') {
      merged['created'] = new Date(merged['created'])
    }
    if (merged['updated'] && typeof merged['updated'] === 'string') {
      merged['updated'] = new Date(merged['updated'])
    }

    // Validate merged data with partial schema
    const validatedData = (this.inputSchema as any).partial().parse(merged)

    const updateResults = await this.dataSource.put(
      {
        ...validatedData,
        _id: id,
        _rev: existingRev
      },
      { force: true }
    )

    if (!updateResults.ok) {
      throw new Error('Could not update')
    }

    const dbResult = await this.dataSource.get(id)
    dbResult['id'] = dbResult['_id']

    // Convert date strings to Date objects
    if (dbResult['created'] && typeof dbResult['created'] === 'string') {
      dbResult['created'] = new Date(dbResult['created'])
    }
    if (dbResult['updated'] && typeof dbResult['updated'] === 'string') {
      dbResult['updated'] = new Date(dbResult['updated'])
    }

    // Validate Output
    return this.outputSchema?.parse(
      Objects.clearEmpties(Objects.deleteNulls(dbResult))
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
  public async replaceById(id: string, data: Partial<InputDTO>): Promise<OutputDTO> {
    const existing = await this.dataSource.get(id)
    const existingId = existing._id
    const existingRev = existing._rev
    const existingCreated = (existing as any).created

    // For replace, we start with only the provided data
    const newData: any = {
      ...data
    }
    
    // Preserve system fields
    if (existingCreated) {
      newData.created = existingCreated
    }

    if (this.outputKeys.includes('updated')) {
      newData['updated'] = new Date()
    }

    // Don't validate against full schema since replace allows partial data
    const validatedData = newData

    const updateResults = await this.dataSource.put(
      {
        ...validatedData,
        _id: existingId,
        _rev: existingRev
      },
      { force: true }
    )

    if (!updateResults.ok) {
      throw new Error('Could not Replace')
    }

    const val = await this.dataSource.get(existingId)
    val['id'] = val['_id'].toString()

    // Convert date strings to Date objects
    if (val['created'] && typeof val['created'] === 'string') {
      val['created'] = new Date(val['created'])
    }
    if (val['updated'] && typeof val['updated'] === 'string') {
      val['updated'] = new Date(val['updated'])
    }

    // For replace, use partial schema since not all fields may be present
    return (this.outputSchema as any).partial().parse(
      Objects.clearEmpties(Objects.deleteNulls(val))
    ) as OutputDTO
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
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    const pouchQuery: any = this.getPouchDBWhere(query?.where)

    // Note: PouchDB requires indexes for sorting, so we'll sort in memory instead
    const needsSort = query?.orderBy && query.orderBy.length > 0
    
    // If we need to sort, we can't use PouchDB's limit/skip because they apply before sorting
    // So we'll fetch all results and apply limit/offset after sorting
    if (!needsSort) {
      // Add limit and skip only if we don't need to sort
      if (query?.limit) {
        pouchQuery.limit = query.limit
      }
      if (query?.offset) {
        pouchQuery.skip = query.offset
      }
    }

    const response = await this.dataSource.find(pouchQuery)
    const found = response.docs

    // Process documents
    let processed = found.map(d => {
      const doc = { ...d }
      doc['id'] = doc['_id']
      if ('_id' in doc) delete (doc as any)['_id']
      if ('_rev' in doc) delete (doc as any)['_rev']
      
      // Handle date fields
      if (doc['created'] && typeof doc['created'] === 'string') {
        doc['created'] = new Date(doc['created'])
      }
      if (doc['updated'] && typeof doc['updated'] === 'string') {
        doc['updated'] = new Date(doc['updated'])
      }
      
      return Objects.clearEmpties(Objects.deleteNulls(doc))
    })
    
    // Apply in-memory sorting if needed
    if (needsSort && query?.orderBy) {
      processed = processed.sort((a, b) => {
        for (const order of query.orderBy!) {
          const entries = Object.entries(order)
          if (!entries[0]) continue
          const [field, direction] = entries[0]
          const aVal = a[field]
          const bVal = b[field]
          
          if (aVal === bVal) continue
          
          const result = aVal < bVal ? -1 : 1
          return direction === 'asc' ? result : -result
        }
        return 0
      })
      
      // Apply offset and limit after sorting
      if (query?.offset) {
        processed = processed.slice(query.offset)
      }
      if (query?.limit) {
        processed = processed.slice(0, query.limit)
      }
    }

    if (query?.paginated) {
      const paginationInfo: PaginatedData<Promise<QueryOutput<T, ModelDTO>[]>> =
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
          data: processed as unknown as Promise<QueryOutput<T, ModelDTO>[]>[]
        }

      return paginationInfo as unknown as Promise<QueryOutput<T, ModelDTO>[]>
    }

    if (query?.select) {
      // Apply field selection
      const selectedFields = Object.keys(query.select).filter(key => query.select![key])
      const selected = processed.map(doc => {
        const selectedDoc: any = { id: doc.id }
        selectedFields.forEach(field => {
          if (field in doc) {
            selectedDoc[field] = doc[field]
          }
        })
        return selectedDoc
      })
      return selected as unknown as Promise<QueryOutput<T, ModelDTO>[]>
    }
    
    // Validate Output against schema
    // Use partial validation since documents may have been created with replaceById
    return (this.outputSchema as any)?.partial().array().parse(processed) as unknown as Promise<
      QueryOutput<T, ModelDTO>[]
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

    const orConditions = extractConditions(where['OR'])
    const andConditions = extractConditions(where['AND'])

    const copy = Objects.clone(where)
    if (!!copy['AND']) {
      delete copy['AND']
    }

    if (!!copy['OR']) {
      delete copy['OR']
    }

    const rootLevelConditions = extractConditions([copy])

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

    return Objects.clearEmpties({selector: Filters.where})
  }
  /**
   *
   * @param id
   */
  public async deleteById(id: string): Promise<string> {
    try {
      const doc = await this.dataSource.get(id)
      await this.dataSource.remove(doc)
      return id
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`The element with id ${id} was not found`)
      }
      throw error
    }
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
      } as unknown as FluentQuery<ModelDTO>
    })

    return newInstance as LoadedResult<this>
  }

  protected clone() {
    return new (<any>this.constructor)()
  }

  public async findById<T extends FindByIdFilter<ModelDTO>>(
    id: string,
    q?: T
  ): Promise<QueryOutput<T, ModelDTO> | null> {
    const results = await this.findByIds([id], q)
    return results[0] || null
  }

  public async findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    // Call parent implementation
    const results = await super.findByIds(ids, q)
    
    // Sort results to match the order of input IDs
    const orderedResults: QueryOutput<T, ModelDTO>[] = []
    for (const id of ids) {
      const found = results.find(r => r.id === id)
      if (found) {
        orderedResults.push(found)
      }
    }
    
    return orderedResults
  }

  public async pluck(path: any, query?: FluentQuery<ModelDTO>): Promise<any[]> {
    const allDocs = await this.findMany(query)
    
    // If path is a string, pluck that field
    if (typeof path === 'string') {
      return allDocs.map(doc => (doc as any)[path]).filter(val => val !== undefined)
    }
    
    // Otherwise return empty array
    return []
  }

  public async clear(): Promise<boolean> {
    try {
      // Get all documents first
      const allDocs = await this.dataSource.allDocs()
      
      // Delete all documents
      const deletePromises = allDocs.rows.map(row => 
        this.dataSource.remove(row.id, row.value.rev)
      )
      
      await Promise.all(deletePromises)
      return true
    } catch (error) {
      console.error('Error clearing database:', error)
      return false
    }
  }
}
