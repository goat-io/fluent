import {
  extractConditions,
  getOutputKeys,
  getRelationsFromModelGenerator,
  LogicOperator,
  modelGeneratorDataSource,
} from '@goatlab/fluent'
import type { AnyObject } from '@goatlab/js-utils'
import { Objects } from '@goatlab/js-utils'
import PouchDB from 'pouchdb'
import { z } from 'zod'

PouchDB.plugin(require('pouchdb-find'))
PouchDB.plugin(require('pouchdb-adapter-memory'))
PouchDB.plugin(require('pouchdb-json'))

const _db: any = []

export interface PouchDBConnectorParams<Input, Output> {
  entity: any
  dataSource: PouchDB.Database
  inputSchema: z.ZodType<Input>
  outputSchema?: z.ZodType<Output>
}

// Types needed for PouchDB connector
interface FluentQuery<_T> {
  where?: any
  select?: any
  include?: any
  orderBy?: any[]
  limit?: number
  offset?: number
  paginated?: { page: number; perPage: number }
}

interface FindByIdFilter<_T> {
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

type LoadedResult<_T> = Record<string, unknown>

type QueryOutput<_T, _U> = any

interface FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO> {
  insert(data: InputDTO): Promise<OutputDTO>
  insertMany(data: InputDTO[]): Promise<OutputDTO[]>
  updateById(id: string, data: Partial<InputDTO>): Promise<OutputDTO>
  replaceById(id: string, data: Partial<InputDTO>): Promise<OutputDTO>
  deleteById(id: string): Promise<string>
  findMany<T extends FluentQuery<ModelDTO>>(
    query?: T,
  ): Promise<QueryOutput<T, ModelDTO>[]>
  findFirst<T extends FluentQuery<ModelDTO>>(
    query?: T,
  ): Promise<QueryOutput<T, ModelDTO> | null>
  findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T,
  ): Promise<QueryOutput<T, ModelDTO>[]>
  requireById(
    id: string,
    q?: FindByIdFilter<ModelDTO>,
  ): Promise<QueryOutput<FindByIdFilter<ModelDTO>, ModelDTO>>
  requireFirst<T extends FluentQuery<ModelDTO>>(
    query?: T,
  ): Promise<QueryOutput<T, ModelDTO>>
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
    query?: T,
  ): Promise<QueryOutput<T, ModelDTO> | null> {
    const data = await this.findMany({ ...query, limit: 1 } as T)
    return data[0] || null
  }

  async requireById(
    id: string,
    q?: FindByIdFilter<ModelDTO>,
  ): Promise<QueryOutput<FindByIdFilter<ModelDTO>, ModelDTO>> {
    const found = await this.findByIds([id], {
      select: q?.select,
      include: q?.include,
      limit: 1,
    })

    if (!found[0]) {
      throw new Error(`Object ${id} not found`)
    }

    return found[0] as unknown as QueryOutput<
      FindByIdFilter<ModelDTO>,
      ModelDTO
    >
  }

  async requireFirst<T extends FluentQuery<ModelDTO>>(
    query?: T,
  ): Promise<QueryOutput<T, ModelDTO>> {
    const found = await this.findFirst(query)
    if (!found) {
      throw new Error('Object not found')
    }
    return found
  }

  async findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T,
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    return this.findMany({
      where: { id: { in: ids } },
      select: q?.select,
      include: q?.include,
      limit: q?.limit,
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
  abstract findMany<T extends FluentQuery<ModelDTO>>(
    query?: T,
  ): Promise<QueryOutput<T, ModelDTO>[]>
  abstract pluck(path: any, query?: FluentQuery<ModelDTO>): Promise<any[]>
  abstract clear(): Promise<boolean>
}

export class PouchDBConnector<
    ModelDTO = AnyObject,
    InputDTO = ModelDTO,
    OutputDTO = ModelDTO,
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
    outputSchema,
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
      docData.id = undefined
      response = await this.dataSource.put(docData)
    } else {
      // If no id, use post to auto-generate
      response = await this.dataSource.post(dataToInsert)
    }

    const datum = await this.dataSource.get(response.id)
    ;(datum as any).id = (datum as any)._id

    // Handle date fields
    if ((datum as any).created && typeof (datum as any).created === 'string') {
      ;(datum as any).created = new Date((datum as any).created)
    }
    if ((datum as any).updated && typeof (datum as any).updated === 'string') {
      ;(datum as any).updated = new Date((datum as any).updated)
    }

    // Validate Output
    return this.outputSchema.parse(
      Objects.clearEmpties(Objects.deleteNulls(datum)),
    )
  }

  /**
   *
   * @param data
   */
  public async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    const validatedData = this.inputSchema.array().parse(data)

    // Add created date if needed
    const hasCreated = this.outputKeys.includes('created')
    const dataLength = validatedData.length
    const dataToInsert = new Array(dataLength)
    const now = new Date()

    // Optimize loop by avoiding object spread when not needed
    for (let i = 0; i < dataLength; i++) {
      const item = validatedData[i] as any
      if (hasCreated && !item.created) {
        dataToInsert[i] = { ...item, created: now }
      } else {
        dataToInsert[i] = item
      }
    }

    const inserted = await this.dataSource.bulkDocs(dataToInsert as any)

    const insertedArray = inserted as any[]
    const insertedOK: any[] = []
    for (let i = 0; i < insertedArray.length; i++) {
      if (insertedArray[i].id) {
        insertedOK.push(insertedArray[i])
      }
    }

    const elements = await this.dataSource.bulkGet({
      docs: insertedOK,
    })

    const results = elements.results
    const resultsLength = results.length
    const res: any[] = []

    for (let i = 0; i < resultsLength; i++) {
      const r = results[i]
      if (!r) {
        continue
      }
      const docs = r.docs
      if (r.id && docs?.[0] && (docs[0] as any).ok) {
        const okDoc = (docs[0] as any).ok
        const doc = { ...okDoc, id: r.id }

        // Handle date fields more efficiently
        const created = (doc as any).created
        const updated = (doc as any).updated

        if (created && typeof created === 'string') {
          ;(doc as any).created = new Date(created)
        }
        if (updated && typeof updated === 'string') {
          ;(doc as any).updated = new Date(updated)
        }

        res.push(Objects.clearEmpties(Objects.deleteNulls(doc)))
      }
    }

    return this.outputSchema.array().parse(res)
  }
  /**
   * PATCH operation
   * @param data
   */
  public async updateById(
    id: string,
    data: Partial<InputDTO>,
  ): Promise<OutputDTO> {
    // Get existing document
    const existing = await this.dataSource.get(id)
    const existingRev = (existing as any)._rev
    ;(existing as any).id = (existing as any)._id
    if ('_id' in existing) {
      ;(existing as any)._id = undefined
    }
    if ('_rev' in existing) {
      ;(existing as any)._rev = undefined
    }

    // Merge with new data
    const merged = {
      ...existing,
      ...data,
    }

    if (this.outputKeys.includes('updated')) {
      ;(merged as any).updated = new Date()
    }

    // Convert date strings to Date objects for existing data
    if (
      (merged as any).created &&
      typeof (merged as any).created === 'string'
    ) {
      ;(merged as any).created = new Date((merged as any).created)
    }
    if (
      (merged as any).updated &&
      typeof (merged as any).updated === 'string'
    ) {
      ;(merged as any).updated = new Date((merged as any).updated)
    }

    // Validate merged data with partial schema
    const validatedData = (this.inputSchema as any).partial().parse(merged)

    const updateResults = await this.dataSource.put(
      {
        ...validatedData,
        _id: id,
        _rev: existingRev,
      },
      { force: true },
    )

    if (!updateResults.ok) {
      throw new Error('Could not update')
    }

    const dbResult = await this.dataSource.get(id)
    ;(dbResult as any).id = (dbResult as any)._id

    // Convert date strings to Date objects
    if (
      (dbResult as any).created &&
      typeof (dbResult as any).created === 'string'
    ) {
      ;(dbResult as any).created = new Date((dbResult as any).created)
    }
    if (
      (dbResult as any).updated &&
      typeof (dbResult as any).updated === 'string'
    ) {
      ;(dbResult as any).updated = new Date((dbResult as any).updated)
    }

    // Validate Output
    return this.outputSchema?.parse(
      Objects.clearEmpties(Objects.deleteNulls(dbResult)),
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
  public async replaceById(
    id: string,
    data: Partial<InputDTO>,
  ): Promise<OutputDTO> {
    const existing = await this.dataSource.get(id)
    const existingId = (existing as any)._id
    const existingRev = (existing as any)._rev
    const existingCreated = (existing as any).created

    // For replace, we start with only the provided data
    const newData: any = {
      ...data,
    }

    // Preserve system fields
    if (existingCreated) {
      ;(newData as any).created = existingCreated
    }

    if (this.outputKeys.includes('updated')) {
      ;(newData as any).updated = new Date()
    }

    // Don't validate against full schema since replace allows partial data
    const validatedData = newData

    const updateResults = await this.dataSource.put(
      {
        ...validatedData,
        _id: existingId,
        _rev: existingRev,
      },
      { force: true },
    )

    if (!updateResults.ok) {
      throw new Error('Could not Replace')
    }

    const val = await this.dataSource.get(existingId)
    ;(val as any).id = (val as any)._id.toString()

    // Convert date strings to Date objects
    if ((val as any).created && typeof (val as any).created === 'string') {
      ;(val as any).created = new Date((val as any).created)
    }
    if ((val as any).updated && typeof (val as any).updated === 'string') {
      ;(val as any).updated = new Date((val as any).updated)
    }

    // For replace, use partial schema since not all fields may be present
    return (this.outputSchema as any)
      .partial()
      .parse(Objects.clearEmpties(Objects.deleteNulls(val))) as OutputDTO
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
    query?: T,
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

    // Process documents with optimized operations
    const foundLength = found.length
    const processed = new Array(foundLength)

    for (let i = 0; i < foundLength; i++) {
      const d = found[i]
      if (!d) {
        continue
      }
      // Create new object without spread for better performance
      const doc: any = {}

      // Copy properties except _id and _rev
      for (const key in d) {
        if (key !== '_id' && key !== '_rev') {
          doc[key] = d[key]
        }
      }
      doc.id = d._id

      // Handle date fields efficiently
      const created = doc.created
      const updated = doc.updated

      if (created && typeof created === 'string') {
        doc.created = new Date(created)
      }
      if (updated && typeof updated === 'string') {
        doc.updated = new Date(updated)
      }

      processed[i] = Objects.clearEmpties(Objects.deleteNulls(doc))
    }

    // Apply in-memory sorting if needed
    if (needsSort && query?.orderBy) {
      const orderBy = query.orderBy
      const orderLength = orderBy.length

      // Pre-process orderBy to avoid Object.entries in sort loop
      const sortFields = new Array(orderLength)
      for (let i = 0; i < orderLength; i++) {
        const order = orderBy[i]
        const keys = Object.keys(order)
        if (keys.length > 0 && keys[0]) {
          sortFields[i] = { field: keys[0], direction: order[keys[0]] }
        }
      }

      processed.sort((a, b) => {
        for (let i = 0; i < orderLength; i++) {
          const sortField = sortFields[i]
          if (!sortField) {
            continue
          }

          const aVal = a[sortField.field]
          const bVal = b[sortField.field]

          if (aVal === bVal) {
            continue
          }

          const result = aVal < bVal ? -1 : 1
          return sortField.direction === 'asc' ? result : -result
        }
        return 0
      })

      // Apply offset and limit after sorting
      if (query?.offset || query?.limit) {
        const start = query?.offset || 0
        const end = query?.limit ? start + query.limit : undefined
        return processed.slice(start, end) as any
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
          data: processed as unknown as Promise<QueryOutput<T, ModelDTO>[]>[],
        }

      return paginationInfo as unknown as Promise<QueryOutput<T, ModelDTO>[]>
    }

    if (query?.select) {
      // Apply field selection with optimized approach
      const select = query.select
      const selectKeys = Object.keys(select)
      const selectKeysLength = selectKeys.length

      // Pre-filter selected fields
      const selectedFields: string[] = []
      for (let i = 0; i < selectKeysLength; i++) {
        const key = selectKeys[i]
        if (key && select[key]) {
          selectedFields.push(key)
        }
      }

      const processedLength = processed.length
      const selected = new Array(processedLength)
      const fieldsLength = selectedFields.length

      // Optimize field selection loop
      for (let i = 0; i < processedLength; i++) {
        const doc = processed[i]
        const selectedDoc: any = { id: (doc as any).id }

        // Use direct property access instead of 'in' operator
        for (let j = 0; j < fieldsLength; j++) {
          const field = selectedFields[j]
          if (field) {
            const value = (doc as any)[field]
            if (value !== undefined) {
              ;(selectedDoc as any)[field] = value
            }
          }
        }
        selected[i] = selectedDoc
      }
      return selected as unknown as Promise<QueryOutput<T, ModelDTO>[]>
    }

    // Validate Output against schema
    // Use partial validation since documents may have been created with replaceById
    return (this.outputSchema as any)
      ?.partial()
      .array()
      .parse(processed) as unknown as Promise<QueryOutput<T, ModelDTO>[]>
  }

  public getPouchDBWhere(
    where?: FluentQuery<ModelDTO>['where'],
  ): PouchDB.Find.FindRequest<any> {
    if (!where || Object.keys(where).length === 0) {
      return {
        selector: {},
      }
    }

    const Filters: { where: { $or: any[] } } = {
      where: { $or: [{ $and: [] }] },
    }

    const orConditions = extractConditions(where.OR)
    const andConditions = extractConditions(where.AND)

    const copy = Objects.clone(where)
    copy.AND = undefined
    copy.OR = undefined

    const rootLevelConditions = extractConditions([copy])

    // Helper function to process conditions - optimized with operator map
    const operatorMap: Record<string, (value: any) => any> = {
      [LogicOperator.Equals]: value => ({ $eq: value }),
      [LogicOperator.IsNot]: value => ({ $neq: value }),
      [LogicOperator.GreaterThan]: value => ({ $gt: value }),
      [LogicOperator.GreaterOrEqualThan]: value => ({ $gte: value }),
      [LogicOperator.LessThan]: value => ({ $lt: value }),
      [LogicOperator.LessOrEqualThan]: value => ({ $lte: value }),
      [LogicOperator.In]: value => ({ $in: value }),
      [LogicOperator.NotIn]: value => ({ $not: { $in: value } }),
      [LogicOperator.Exists]: () => ({ $exists: true }),
      [LogicOperator.NotExists]: () => ({ $exists: false }),
      [LogicOperator.Regexp]: value => ({ $regex: value }),
    }

    const processCondition = (condition: any, target: any[]) => {
      let { element, operator, value } = condition

      if (element === 'id') {
        element = '_id'
      }

      const operatorFn = operatorMap[operator]
      if (operatorFn) {
        const filter: any = {}
        filter[element] = operatorFn(value)
        target.push(filter)
      }
    }

    // Process AND conditions
    const andLength = andConditions.length
    for (let i = 0; i < andLength; i++) {
      processCondition(andConditions[i], Filters.where.$or[0].$and)
    }

    // Process root level conditions
    const rootLength = rootLevelConditions.length
    for (let i = 0; i < rootLength; i++) {
      processCondition(rootLevelConditions[i], Filters.where.$or[0].$and)
    }

    // Process OR conditions
    const orLength = orConditions.length
    for (let i = 0; i < orLength; i++) {
      processCondition(orConditions[i], Filters.where.$or)
    }

    return Objects.clearEmpties({ selector: Filters.where })
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
      this,
    ) as PouchDBConnector<ModelDTO, InputDTO, OutputDTO>

    detachedClass.setRelatedQuery({
      entity: this.entity,
      repository: this,
      query,
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
          id,
        },
      } as unknown as FluentQuery<ModelDTO>,
    })

    return newInstance as LoadedResult<this>
  }

  protected clone() {
    return new (<any>this.constructor)({
      entity: this.entity,
      dataSource: this.dataSource,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
    })
  }

  public async findById<T extends FindByIdFilter<ModelDTO>>(
    id: string,
    q?: T,
  ): Promise<QueryOutput<T, ModelDTO> | null> {
    const results = await this.findByIds([id], q)
    return results[0] || null
  }

  public async findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T,
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    // Call parent implementation
    const results = await super.findByIds(ids, q)

    // Sort results to match the order of input IDs with pre-allocated array
    const resultsLength = results.length
    const idsLength = ids.length

    // Quick path for single result
    if (resultsLength <= 1) {
      return results
    }

    // Build map for O(1) lookup
    const idMap = new Map<string, QueryOutput<T, ModelDTO>>()
    for (let i = 0; i < resultsLength; i++) {
      const result = results[i]
      idMap.set((result as any).id, result)
    }

    // Pre-allocate ordered results array
    const orderedResults: QueryOutput<T, ModelDTO>[] = []
    for (let i = 0; i < idsLength; i++) {
      const id = ids[i]
      if (id) {
        const found = idMap.get(id)
        if (found) {
          orderedResults.push(found)
        }
      }
    }

    return orderedResults
  }

  public async pluck(path: any, query?: FluentQuery<ModelDTO>): Promise<any[]> {
    // Early return for non-string paths
    if (typeof path !== 'string') {
      return []
    }

    const allDocs = await this.findMany(query)
    const docsLength = allDocs.length

    // Pre-allocate maximum possible size
    const results = new Array(docsLength)
    let resultIndex = 0

    // Pluck values efficiently
    for (let i = 0; i < docsLength; i++) {
      const val = (allDocs[i] as any)[path]
      if (val !== undefined) {
        results[resultIndex++] = val
      }
    }

    // Trim array to actual size
    results.length = resultIndex
    return results
  }

  public async clear(): Promise<boolean> {
    try {
      // Get all documents first
      const allDocs = await this.dataSource.allDocs()

      // Delete all documents in batches for better performance
      const rows = allDocs.rows
      const rowsLength = rows.length
      const batchSize = 100

      // Pre-allocate batch array
      const maxBatchSize = Math.min(batchSize, rowsLength)
      const deletePromises = new Array(maxBatchSize)

      for (let i = 0; i < rowsLength; i += batchSize) {
        const end = Math.min(i + batchSize, rowsLength)
        const currentBatchSize = end - i

        // Fill batch promises without creating new arrays
        for (let j = 0; j < currentBatchSize; j++) {
          const row = rows[i + j]
          if (row) {
            deletePromises[j] = this.dataSource.remove(row.id, row.value.rev)
          }
        }

        // Only wait for the actual batch size
        await Promise.all(
          currentBatchSize < maxBatchSize
            ? deletePromises.slice(0, currentBatchSize)
            : deletePromises,
        )
      }

      return true
    } catch (error) {
      console.error('Error clearing database:', error)
      return false
    }
  }
}
