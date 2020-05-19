import {
  BaseConnector,
  IDataElement,
  GoatConnectorInterface,
  GoatOutput
} from '../../BaseConnector'
import { Dates } from '../../Helpers/Dates'

let db: any = []

export class MemoryConnector<InputDTO = IDataElement, OutputDTO = InputDTO>
  extends BaseConnector<InputDTO, OutputDTO>
  implements GoatConnectorInterface<InputDTO, GoatOutput<InputDTO, OutputDTO>> {
  /**
   *
   */
  public async get(): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    let result: GoatOutput<InputDTO, OutputDTO>[] = db
    result = this.jsApplyOrderBy(result)

    const limit = this.limitNumber
    const skip = this.offsetNumber

    if (skip > 0) {
      result = result.slice(skip, result.length)
    }

    if (limit > 0) {
      result = result.slice(0, limit)
    }

    return result
  }
  /**
   *
   */
  public async all(): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    return this.get()
  }

  /**
   *
   * @param data
   */
  public async insert(
    data: InputDTO
  ): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const goatAttributes = this.getExtendedCreateAttributes()

    const inserted: GoatOutput<InputDTO, OutputDTO> = {
      ...data,
      ...goatAttributes
    }

    db.push(inserted)
    return inserted
  }
  /**
   *
   * @param data
   */
  public async insertMany(
    data: InputDTO[]
  ): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    const insertedElements: GoatOutput<InputDTO, OutputDTO>[] = []

    for (const element of data) {
      const inserted = { ...element, ...insertedElements }

      db.push(inserted)
      insertedElements.push(inserted)
    }

    return insertedElements
  }
  /**
   *
   * @param _id
   * @param data
   */
  public async updateById(
    _id: string,
    data: InputDTO
  ): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const dbIndex = db.findIndex(obj => obj._id === _id)
    db[dbIndex] = {
      ...db[dbIndex],
      ...data,
      ...{ modified: Dates.currentIsoString() }
    }

    return db[dbIndex]
  }
  /**
   *
   * @param _id
   */
  public async findById(_id: string): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const dbIndex = db.findIndex(obj => obj._id === _id)
    return db[dbIndex]
  }
  /**
   *
   * @param _id
   */
  public async deleteById(_id: string): Promise<string> {
    const dbIndex = db.findIndex(obj => obj._id === _id)
    if (dbIndex > -1) {
      const element: GoatOutput<InputDTO, OutputDTO> = JSON.parse(
        JSON.stringify(db[dbIndex])
      )
      db.splice(dbIndex, 1)
      return element._id
    }
    throw new Error(`The element with id ${_id} was not found`)
  }

  public async clear(): Promise<void> {
    db = []
  }
}
