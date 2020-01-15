import { Generators } from '../../Helpers/Generators'
import { Interface } from '../../Interface'

const db = []
export const MemoryConnector = Interface.compose({
  methods: {
    async get() {
      if (this.ownerId) {
        this.andWhere('owner', '=', this.ownerId)
      }
      let result = db
      result = this.jsApplySelect(result)
      result = this.jsApplyOrderBy(result)

      return result
    },
    async insert(data) {
      data._id = Generators().objectID()
      db.push(data)
      return data
    }
  }
})
