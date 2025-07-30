import { Objects } from '@goatlab/js-utils'

// Define the minimal types we need to avoid importing from problematic parts of fluent
interface FindByIdFilter<_T> {
  select?: any
  include?: any
  limit?: number
}

interface FluentQuery<_T> {
  where?: any
  select?: any
  include?: any
  orderBy?: any[]
  limit?: number
  offset?: number
}

type QueryOutput<_T, _U> = any

// Simple BaseConnector interface for our needs
abstract class BaseConnector<ModelDTO, _InputDTO, _OutputDTO> {
  protected outputKeys: string[] = []
  public isMongoDB: boolean = false

  async findFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO> | null> {
    const data = await this.findMany({ ...query, limit: 1 })
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

    return found[0] as unknown as QueryOutput<
      FindByIdFilter<ModelDTO>,
      ModelDTO
    >
  }

  async requireFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>> {
    const found = await this.findMany({ ...query, limit: 1 })

    if (!found[0]) {
      const stringQuery = query ? JSON.stringify(query) : ''
      throw new Error(`No objects found matching:  ${stringQuery}`)
    }
    return found[0] as unknown as QueryOutput<T, ModelDTO>
  }

  async collect(query: FluentQuery<ModelDTO>): Promise<any> {
    const data = await this.findMany(query)
    const dataLength = data.length

    return {
      avg: (key: string) => {
        if (dataLength === 0) {
          return 0
        }

        let sum = 0
        for (let i = 0; i < dataLength; i++) {
          const value = data[i][key]
          if (typeof value === 'number') {
            sum += value
          }
        }
        return sum / dataLength
      }
    }
  }

  // Abstract methods that need to be implemented
  abstract findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>[]>

  abstract findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T
  ): Promise<QueryOutput<T, ModelDTO>[]>
}

interface FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO> {
  insert(data: InputDTO): Promise<OutputDTO>
  insertMany(data: InputDTO[]): Promise<OutputDTO[]>
  findById<T extends FindByIdFilter<ModelDTO>>(
    id: string,
    q?: T
  ): Promise<QueryOutput<T, ModelDTO> | null>
  findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T
  ): Promise<QueryOutput<T, ModelDTO>[]>
  findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>[]>
  findFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO> | null>
  requireById(
    id: string,
    q?: FindByIdFilter<ModelDTO>
  ): Promise<QueryOutput<FindByIdFilter<ModelDTO>, ModelDTO>>
  requireFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>>
  updateById(id: string, data: InputDTO): Promise<OutputDTO>
  replaceById(id: string, data: InputDTO): Promise<OutputDTO>
  deleteById(id: string): Promise<string>
  loadFirst(query?: FluentQuery<ModelDTO>): any
  loadById(id: string): any
  raw(): any
}

interface IFormioConnector {
  baseEndPoint?: string
  token?: string
}

// Mock in-memory storage for testing purposes
class FormioMockStorage<T extends { id?: string }> {
  private storage: Map<string, T> = new Map()
  private idCounter = 0

  insert(data: T): T {
    const id = data.id || this.generateId()
    // Only add created if it doesn't already exist
    const record = {
      created: new Date().toISOString(),
      ...data,
      id
    }
    this.storage.set(id, record)
    return record
  }

  insertMany(data: T[]): T[] {
    const dataLength = data.length
    const results = new Array(dataLength)
    for (let i = 0; i < dataLength; i++) {
      results[i] = this.insert(data[i])
    }
    return results
  }

  findById(id: string): T | null {
    return this.storage.get(id) || null
  }

  findByIds(ids: string[]): T[] {
    const idsLength = ids.length
    const results: T[] = []
    results.length = 0 // Ensure array is empty and optimized

    for (let i = 0; i < idsLength; i++) {
      const item = this.storage.get(ids[i])
      if (item) {
        results.push(item)
      }
    }
    return results
  }

  findMany(filter?: any): T[] {
    const allItems = Array.from(this.storage.values())

    if (!filter) {
      return allItems
    }

    // Simple filtering for testing
    let filtered = allItems

    if (filter.where) {
      filtered = this.applyWhereFilter(filtered, filter.where)
    }

    if (filter.orderBy) {
      filtered = this.applyOrderBy(filtered, filter.orderBy)
    }

    if (filter.offset) {
      filtered = filtered.slice(filter.offset)
    }

    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit)
    }

    return filtered
  }

  updateById(id: string, data: Partial<T>): T | null {
    const existing = this.storage.get(id)
    if (!existing) {
      return null
    }

    const updated = { ...existing, ...data, id }
    this.storage.set(id, updated)
    return updated
  }

  deleteById(id: string): boolean {
    return this.storage.delete(id)
  }

  clear(): void {
    this.storage.clear()
    this.idCounter = 0
  }

  private generateId(): string {
    return `formio_${++this.idCounter}_${Date.now()}`
  }

  private applyWhereFilter(items: T[], where: any): T[] {
    const itemsLength = items.length
    const results: T[] = []
    results.length = 0 // Pre-optimize array

    for (let i = 0; i < itemsLength; i++) {
      const item = items[i]
      if (this.matchesWhere(item, where)) {
        results.push(item)
      }
    }
    return results
  }

  private matchesWhere(item: any, where: any): boolean {
    // Handle AND conditions
    const andConditions = where.AND
    if (andConditions) {
      const andLength = andConditions.length
      for (let i = 0; i < andLength; i++) {
        if (!this.matchesWhere(item, andConditions[i])) {
          return false
        }
      }
      return true
    }

    // Handle OR conditions
    const orConditions = where.OR
    if (orConditions) {
      const orLength = orConditions.length
      for (let i = 0; i < orLength; i++) {
        if (this.matchesWhere(item, orConditions[i])) {
          return true
        }
      }
      return false
    }

    // Handle regular conditions - avoid Object.entries
    for (const key in where) {
      if (key === 'AND' || key === 'OR') {
        continue
      }
      if (!this.matchesCondition(item, key, where[key])) {
        return false
      }
    }

    return true
  }

  private matchesCondition(item: any, key: string, condition: any): boolean {
    const value = Objects.getFromPath(item, key).value

    if (typeof condition === 'object' && condition !== null) {
      // Handle nested object filters (like nestedTest.c)
      if (this.isFilterCondition(condition)) {
        const conditionObj = condition as any
        if (
          conditionObj.equals !== undefined &&
          value !== conditionObj.equals
        ) {
          return false
        }
        if (conditionObj.in && !conditionObj.in.includes(value)) {
          return false
        }
        if (
          conditionObj.greaterOrEqualThan !== undefined &&
          value < conditionObj.greaterOrEqualThan
        ) {
          return false
        }
        if (
          conditionObj.lessThan !== undefined &&
          value >= conditionObj.lessThan
        ) {
          return false
        }
        return true
      }
      // Handle nested object matching (like { nestedTest: { c: { greaterOrEqualThan: 3 } } })
      if (value && typeof value === 'object') {
        return this.matchesWhere(value, condition)
      }
      return false
    }
    return value === condition
  }

  private isFilterCondition(obj: any): boolean {
    // Direct property checks are faster than array iteration
    return (
      'equals' in obj ||
      'in' in obj ||
      'greaterOrEqualThan' in obj ||
      'lessThan' in obj ||
      'greaterThan' in obj ||
      'lessOrEqualThan' in obj
    )
  }

  private applyOrderBy(items: T[], orderBy: any[]): T[] {
    const orderLength = orderBy.length

    // Pre-process orderBy to avoid repeated Object.keys calls
    const sortFields = new Array(orderLength)
    for (let i = 0; i < orderLength; i++) {
      const order = orderBy[i]
      const keys = Object.keys(order)
      if (keys.length > 0) {
        sortFields[i] = {
          key: keys[0],
          direction: order[keys[0]],
          descMultiplier: order[keys[0]] === 'desc' ? -1 : 1
        }
      }
    }

    return items.sort((a, b) => {
      for (let i = 0; i < orderLength; i++) {
        const field = sortFields[i]
        if (!field) {
          continue
        }

        const aVal = Objects.getFromPath(a, field.key).value
        const bVal = Objects.getFromPath(b, field.key).value

        if (aVal === bVal) {
          continue
        }

        const comparison = aVal > bVal ? 1 : -1
        return comparison * field.descMultiplier
      }
      return 0
    })
  }
}

export class FormioConnector<
    ModelDTO = any,
    InputDTO = ModelDTO,
    OutputDTO = ModelDTO
  >
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO>
{
  private storage: FormioMockStorage<any>

  constructor({
    baseEndPoint: _baseEndPoint = 'http://localhost:3001',
    token: _token
  }: IFormioConnector = {}) {
    super()
    this.storage = new FormioMockStorage()
    this.isMongoDB = false
  }

  async insert(data: InputDTO): Promise<OutputDTO> {
    const result = this.storage.insert(data as any)
    return result as OutputDTO
  }

  async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    const results = this.storage.insertMany(data as any[])
    return results as OutputDTO[]
  }

  async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    const results = this.storage.findMany(query)
    return this.applySelect(results, query?.select) as QueryOutput<
      T,
      ModelDTO
    >[]
  }

  async findById<T extends FindByIdFilter<ModelDTO>>(
    id: string,
    q?: T
  ): Promise<QueryOutput<T, ModelDTO> | null> {
    const result = this.storage.findById(id)
    if (!result) {
      return null
    }

    const selected = this.applySelect([result], q?.select)
    return selected[0] as QueryOutput<T, ModelDTO>
  }

  async findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    const results = this.storage.findByIds(ids)
    return this.applySelect(results, q?.select) as QueryOutput<T, ModelDTO>[]
  }

  async updateById(id: string, data: InputDTO): Promise<OutputDTO> {
    const result = this.storage.updateById(id, data as any)
    if (!result) {
      throw new Error(`FormioConnector: Object with id ${id} not found`)
    }
    return result as OutputDTO
  }

  async replaceById(id: string, data: InputDTO): Promise<OutputDTO> {
    // Replace should completely replace the object, keeping only the id
    const existingItem = this.storage.findById(id)
    if (!existingItem) {
      throw new Error(`FormioConnector: Object with id ${id} not found`)
    }

    // Delete the old one and insert new one with same id
    this.storage.deleteById(id)
    const result = this.storage.insert({ ...(data as any), id })
    return result as OutputDTO
  }

  async deleteById(id: string): Promise<string> {
    const deleted = this.storage.deleteById(id)
    if (!deleted) {
      throw new Error(`FormioConnector: Could not delete ${id}`)
    }
    return id
  }

  async loadFirst(query?: FluentQuery<ModelDTO>) {
    return this.findFirst(query)
  }

  async loadById(id: string) {
    return this.findById(id)
  }

  raw(): any {
    return this.storage
  }

  // Helper method to apply select filtering
  private applySelect(items: any[], select?: any): any[] {
    if (!select || !items.length) {
      return items
    }

    const itemsLength = items.length
    const results = new Array(itemsLength)

    // Pre-process select keys to avoid Object.entries in hot loop
    const selectKeys: Array<{ key: string; value: any }> = []
    for (const key in select) {
      selectKeys.push({ key, value: select[key] })
    }
    const selectLength = selectKeys.length

    for (let i = 0; i < itemsLength; i++) {
      const item = items[i]
      const selected: any = {}

      for (let j = 0; j < selectLength; j++) {
        const { key, value } = selectKeys[j]
        if (value === true) {
          selected[key] = item[key]
        } else if (typeof value === 'object' && value !== null) {
          // Handle nested selections
          const nestedValue = item[key]
          if (nestedValue && typeof nestedValue === 'object') {
            selected[key] = this.applySelect([nestedValue], value)[0]
          }
        }
      }

      results[i] = selected
    }

    return results
  }

  async pluck(path: string): Promise<any[]> {
    const data = await this.findMany()
    const dataLength = data.length

    // Pre-allocate with maximum possible size
    const results = new Array(dataLength)
    let resultIndex = 0

    for (let i = 0; i < dataLength; i++) {
      const extracted = Objects.getFromPath(data[i], path, undefined)
      if (extracted.value !== undefined) {
        results[resultIndex++] = extracted.value
      }
    }

    // Trim to actual size
    results.length = resultIndex
    return results
  }

  // Clear all data (useful for testing)
  async clear(): Promise<boolean> {
    this.storage.clear()
    return true
  }
}

// Export with original name for compatibility
export { FormioConnector as Formioconnector }
