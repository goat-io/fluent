import { BaseConnector, FluentConnectorInterface } from '../../BaseConnector'
import { Filter, DaoOutput, BaseDataElement } from '../types'

import { Dates } from '../../Helpers/Dates'

let db: any = []

export class MemoryConnector<
    ModelDTO = BaseDataElement,
    InputDTO = ModelDTO,
    OutputDTO = ModelDTO
  >
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements FluentConnectorInterface<InputDTO, DaoOutput<InputDTO, OutputDTO>>
{
  /**
   *
   */
  public async get(): Promise<DaoOutput<InputDTO, OutputDTO>[]> {
    let result: DaoOutput<InputDTO, OutputDTO>[] = db
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
  public async all(): Promise<DaoOutput<InputDTO, OutputDTO>[]> {
    return this.get()
  }
  /**
   *
   * @param filter
   */
  public async find(filter: Filter): Promise<DaoOutput<InputDTO, OutputDTO>[]> {
    return this.get()
  }
  /**
   *
   * @param data
   */
  public async insert(data: InputDTO): Promise<DaoOutput<InputDTO, OutputDTO>> {
    const goatAttributes = this.getExtendedCreateAttributes()

    const inserted: DaoOutput<InputDTO, OutputDTO> = {
      ...data,
      ...goatAttributes
    }

    db.push(inserted)
    this.reset()
    return inserted
  }
  /**
   *
   * @param data
   */
  public async insertMany(
    data: InputDTO[]
  ): Promise<DaoOutput<InputDTO, OutputDTO>[]> {
    const insertedElements: DaoOutput<InputDTO, OutputDTO>[] = []

    for (const element of data) {
      const inserted = { ...element, ...insertedElements }

      db.push(inserted)
      insertedElements.push(inserted)
    }

    this.reset()

    return insertedElements
  }
  /**
   *
   * @param id
   * @param data
   */
  public async updateById(
    id: string,
    data: InputDTO
  ): Promise<DaoOutput<InputDTO, OutputDTO>> {
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
  public async findById(id: string): Promise<DaoOutput<InputDTO, OutputDTO>> {
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
      const element: DaoOutput<InputDTO, OutputDTO> = JSON.parse(
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
