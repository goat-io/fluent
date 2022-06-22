import { BaseConnector, FluentConnectorInterface } from '@goatlab/fluent'
import type { Filter, BaseDataElement } from '@goatlab/fluent'
import { Dates } from '@goatlab/dates'

let db: any = []

export class MemoryConnector<
    ModelDTO = BaseDataElement,
    InputDTO = ModelDTO,
    OutputDTO = ModelDTO
  >
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements FluentConnectorInterface<InputDTO, OutputDTO>
{
  /**
   *
   */
  public async get(): Promise<OutputDTO[]> {
    let result: OutputDTO[] = db
    result = this.jsApplyOrderBy(result)

    const limit = this.limitNumber
    const skip = this.offsetNumber

    if (skip > 0) {
      result = result.slice(skip, result.length)
    }

    if (limit > 0) {
      result = result.slice(0, limit)
    }
    this.reset()
    return result
  }

  /**
   *
   */
  public async all(): Promise<OutputDTO[]> {
    return this.get()
  }

  /**
   *
   * @param filter
   */
  public async find(filter: Filter): Promise<OutputDTO[]> {
    return this.get()
  }

  /**
   *
   * @param data
   */
  public async insert(data: InputDTO): Promise<OutputDTO> {
    const inserted: InputDTO = {
      ...data
    }

    db.push(inserted)
    this.reset()
    return inserted as unknown as OutputDTO
  }

  /**
   *
   * @param data
   */
  public async insertMany(
    data: InputDTO[]
  ): Promise<OutputDTO[]> {
    const insertedElements: InputDTO[] = []

    for (const element of data) {
      const inserted = { ...element, ...insertedElements }

      db.push(inserted)
      insertedElements.push(inserted)
    }

    this.reset()

    return insertedElements as unknown as OutputDTO[]
  }

  /**
   *
   * @param id
   * @param data
   */
  public async updateById(
    id: string,
    data: InputDTO
  ): Promise<OutputDTO> {
    const dbIndex = db.findIndex(obj => obj.id === id)
    db[dbIndex] = {
      ...db[dbIndex],
      ...data,
      ...{ modified: Dates.currentIsoString() }
    }
    this.reset()
    return db[dbIndex]
  }

  /**
   *
   * @param id
   */
  public async findById(id: string): Promise<OutputDTO> {
    const dbIndex = db.findIndex(obj => obj.id === id)
    this.reset()
    return db[dbIndex]
  }

  /**
   *
   * @param id
   */
  public async deleteById(id: string): Promise<string> {
    const dbIndex = db.findIndex(obj => obj.id === id)
    if (dbIndex > -1) {
      const element: {id: string} & OutputDTO = JSON.parse(
        JSON.stringify(db[dbIndex])
      )
      db.splice(dbIndex, 1)
      this.reset()
      return element.id
    }
    throw new Error(`The element with id ${id} was not found`)
  }

  public async clear(): Promise<void> {
    this.reset()
    db = []
  }

  public async raw(): Promise<void> {
    throw new Error('Raw is not implemented for Memory Connector')
  }
}
