import { BaseConnector, IDataElement, IGoatExtendedAttributes, GoatConnectorInterface } from '../../BaseConnector'
import { Dates } from '../../Helpers/Dates'

const db: any = []

export class MemoryConnector<T = IDataElement> extends BaseConnector<T> implements GoatConnectorInterface<T> {
  /**
   *
   */
  public async get(): Promise<(T & IGoatExtendedAttributes)[]> {
    let result: (T & IGoatExtendedAttributes)[] = db
    result = this.jsApplySelect(result)
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
  public async all(): Promise<(T & IGoatExtendedAttributes)[]> {
    return this.get()
  }

  /**
   *
   * @param data
   */
  public async insert(data: T) {
    const goatAttributes = this.getExtendedCreateAttributes()

    const inserted: T & IGoatExtendedAttributes = { ...goatAttributes, ...data }

    db.push(inserted)
    return inserted
  }
  /**
   *
   * @param data
   */
  public async insertMany(data: T[]): Promise<(T & IGoatExtendedAttributes)[]> {
    const insertedElements: (T & IGoatExtendedAttributes)[] = []

    for (const element of data) {
      const goatAttributes = this.getExtendedCreateAttributes()

      const inserted: T & IGoatExtendedAttributes = { ...goatAttributes, ...element }

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
  public async updateById(_id: string, data: T): Promise<T & IGoatExtendedAttributes> {
    const dbIndex = db.findIndex((obj) => obj._id === _id)
    db[dbIndex] = { ...db[dbIndex], ...data, ...{ modified: Dates.currentUnixDate() } }

    return db[dbIndex]
  }
  /**
   *
   * @param _id
   */
  public async findById(_id: string): Promise<T & IGoatExtendedAttributes> {
    const dbIndex = db.findIndex((obj) => obj._id === _id)
    return db[dbIndex]
  }
  /**
   *
   * @param _id
   */
  public async deleteById(_id: string): Promise<string> {
    const dbIndex = db.findIndex((obj) => obj._id === _id)
    if (dbIndex > -1) {
      const element: T & IGoatExtendedAttributes = JSON.parse(JSON.stringify(db[dbIndex]))
      db.splice(dbIndex, 1)
      return element._id
    }
    throw new Error(`The element with id ${_id} was not found`)
  }
}
