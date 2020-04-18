import { BaseConnector, IDataElement, IInsertOptions } from '../../BaseConnector'
import { Id } from '../../Helpers/Id'

const db: IDataElement[] = []

export class MemoryConnector extends BaseConnector {
  public async get() {
    if (this.ownerId) {
      this.andWhere('owner', '=', this.ownerId)
    }
    let result = db
    result = this.jsApplySelect(result)
    result = this.jsApplyOrderBy(result)
    return result
  }
  public async insert(data: IDataElement, options?: IInsertOptions) {
    data._id = Id.objectID()
    db.push(data)
    return data
  }
}
