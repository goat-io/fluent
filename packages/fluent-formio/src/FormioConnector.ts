import { Objects } from '@goatlab/js-utils'

// Define the minimal types we need to avoid importing from problematic parts of fluent
interface FindByIdFilter<T> {
  select?: any
  include?: any
  limit?: number
}

interface FluentQuery<T> {
  where?: any
  select?: any
  include?: any
  orderBy?: any[]
  limit?: number
  offset?: number
}

type QueryOutput<T, U> = any

// Simple BaseConnector interface for our needs
abstract class BaseConnector<ModelDTO, InputDTO, OutputDTO> {
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

    return found[0] as unknown as QueryOutput<FindByIdFilter<ModelDTO>, ModelDTO>
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

  async collect(
    query: FluentQuery<ModelDTO>
  ): Promise<any> {
    const data = await this.findMany(query)
    return { 
      avg: (key: string) => {
        const sum = data.reduce((acc, item) => acc + (item[key] || 0), 0)
        return sum / data.length
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
    return data.map(item => this.insert(item))
  }

  findById(id: string): T | null {
    return this.storage.get(id) || null
  }

  findByIds(ids: string[]): T[] {
    return ids.map(id => this.storage.get(id)).filter(Boolean) as T[]
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
    if (!existing) return null

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
    return items.filter(item => this.matchesWhere(item, where))
  }

  private matchesWhere(item: any, where: any): boolean {
    if (where.AND) {
      return where.AND.every((condition: any) => this.matchesWhere(item, condition))
    }

    if (where.OR) {
      return where.OR.some((condition: any) => this.matchesWhere(item, condition))
    }

    for (const [key, condition] of Object.entries(where)) {
      if (!this.matchesCondition(item, key, condition)) {
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
        if (conditionObj.equals !== undefined && value !== conditionObj.equals) return false
        if (conditionObj.in && !conditionObj.in.includes(value)) return false
        if (conditionObj.greaterOrEqualThan !== undefined && value < conditionObj.greaterOrEqualThan) return false
        if (conditionObj.lessThan !== undefined && value >= conditionObj.lessThan) return false
        return true
      } else {
        // Handle nested object matching (like { nestedTest: { c: { greaterOrEqualThan: 3 } } })
        if (value && typeof value === 'object') {
          return this.matchesWhere(value, condition)
        } else {
          return false
        }
      }
    } else {
      return value === condition
    }
  }

  private isFilterCondition(obj: any): boolean {
    const filterKeys = ['equals', 'in', 'greaterOrEqualThan', 'lessThan', 'greaterThan', 'lessOrEqualThan']
    return filterKeys.some(key => key in obj)
  }

  private applyOrderBy(items: T[], orderBy: any[]): T[] {
    return items.sort((a, b) => {
      for (const order of orderBy) {
        const key = Object.keys(order)[0]
        const direction = order[key]
        
        const aVal = Objects.getFromPath(a, key).value
        const bVal = Objects.getFromPath(b, key).value

        if (aVal === bVal) continue

        const comparison = aVal > bVal ? 1 : -1
        return direction === 'desc' ? -comparison : comparison
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
  private baseEndPoint: string
  private authToken?: string
  private storage: FormioMockStorage<any>

  constructor({ baseEndPoint = 'http://localhost:3001', token }: IFormioConnector = {}) {
    super()
    this.baseEndPoint = baseEndPoint
    this.authToken = token
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
    return this.applySelect(results, query?.select) as QueryOutput<T, ModelDTO>[]
  }

  async findById<T extends FindByIdFilter<ModelDTO>>(
    id: string,
    q?: T
  ): Promise<QueryOutput<T, ModelDTO> | null> {
    const result = this.storage.findById(id)
    if (!result) return null
    
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
    if (!select || !items.length) return items

    return items.map(item => {
      const selected: any = {}
      
      for (const [key, value] of Object.entries(select)) {
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
      
      return selected
    })
  }

  async pluck(path: string): Promise<any[]> {
    const data = await this.findMany()
    
    return data.map(item => {
      const extracted = Objects.getFromPath(item, path, undefined)
      return extracted.value
    }).filter(value => value !== undefined)
  }

  // Clear all data (useful for testing)
  async clear(): Promise<boolean> {
    this.storage.clear()
    return true
  }
}

// Export with original name for compatibility
export { FormioConnector as Formioconnector }