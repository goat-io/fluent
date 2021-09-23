import Database from './Database'
import Utilities from './Utilities'
import { Id } from '../../../Helpers/Id'
import { Interface } from '../../fluent'

export default Interface.compose({
  methods: {
    /**
     *
     */
    async get() {
      let filterObject = this.prepareFilter()

      let data = await (await this.getModel())
        .chain()
        .find(filterObject)
        .offset(this.offsetNumber)
        .limit(this.limitNumber)
        .data()

      data = this.jsApplySelect(data)
      data = this.jsApplyOrderBy(data)

      return data
    },
    /**
     *
     */
    prepareFilter() {
      let andObject = { $and: [] }
      let orObject = { $or: [] }
      let globalFilter = {}

      // All first Level AND conditions
      if (this.whereArray.length > 0) {
        this.whereArray.forEach(c => {
          let conditionToObject = {}

          if (c[0].includes('[')) {
            throw new Error(
              'Error in: "' +
                c[0] +
                '" "Where" close does not work with Array elements'
            )
          }

          conditionToObject[c[0]] = {}
          let lokiOperator = this.getLokiOperator(c[1])

          conditionToObject[c[0]][lokiOperator] = c[2]
          if (lokiOperator.includes('$regex|')) {
            delete conditionToObject[c[0]][lokiOperator]
            conditionToObject[c[0]]['$regex'] = lokiOperator
              .replace('$regex|', '')
              .replace('{{$var}}', c[2])
          }

          andObject['$and'].push(conditionToObject)
        })
        globalFilter = andObject
      }
      // All second level OR conditions
      if (this.orWhereArray.length > 0) {
        this.orWhereArray.forEach(c => {
          let conditionToObject = {}

          conditionToObject[c[0]] = {}
          let lokiOperator = this.getLokiOperator(c[1])

          conditionToObject[c[0]][lokiOperator] = c[2]
          if (lokiOperator.includes('$regex|')) {
            delete conditionToObject[c[0]][lokiOperator]
            conditionToObject[c[0]]['$regex'] = lokiOperator
              .replace('$regex|', '')
              .replace('{{$var}}', c[2])
          }

          orObject['$or'].push(conditionToObject)
        })

        globalFilter = { $or: [andObject, orObject] }
      }

      // TODO we should include global level and() or()
      // operators to give room for more complex queries
      return globalFilter
    },
    /**
     *
     * @param {*} operator
     */
    getLokiOperator(operator) {
      if (!this.operators.includes(operator)) {
        throw new Error('The "' + operator + '" operator is not supported')
      }

      let lokiOperators = {
        '=': '$eq',
        '<': '$lt',
        '>': '$gt',
        '<=': '$lte',
        '>=': '$gte',
        '<>': '$ne',
        '!=': '$ne',
        in: '$in',
        nin: '$nin',
        like: '$aeq',
        regexp: '$regex',
        startsWith: '$regex|^{{$var}}',
        endsWith: '$regex|{{$var}}$',
        contains: '$regex|{{$var}}'
      }
      let converted = Utilities.get(() => lokiOperators[operator], undefined)

      if (!converted) {
        throw new Error(
          'The operator "' + operator + '" is not supported in Loki '
        )
      }
      return converted
    },
    /**
     *
     * @param {Object} db The name of the model to fetch
     * @param {String} db.model The name of the model to fetch
     * @returns {Promise} The DB model
     */
    async getModel() {
      const DB = await Database.get()
      return DB.getCollection(this.name)
    },
    /**
     *
     */
    async all() {
      const model = await this.getModel()

      return model.find()
    },
    /**
     * [remove description]
     * @param  {[type]} document [description]
     * @return {[type]}          [description]
     */
    async remove(_id) {
      if (!_id) {
        throw new Error(
          'No id assign to remove().You must give and _id to delete'
        )
      }

      if (!_id.includes('_local')) {
        throw new Error('You can`t delete non local submissions')
      }
      const model = await this.getModel()

      return model.findAndRemove({ _id: _id })
    },
    /**
     * [insert description]
     * @param  {Object, Array} element [description]
     * @return {[type]}         [description]
     */
    async insert(data, options) {
      if (Array.isArray(data)) {
        return this.ArrayInsert(data, options)
      }
      data = Utilities.cloneDeep(data)

      const model = await this.getModel()

      data._id = Id.uuid() + '_local'

      return model.insert(data)
    },
    /**
     * [update description]
     * @param  {[type]} document [description]
     * @return {[type]}          [description]
     */
    async update(document) {
      if (!document._id) {
        throw new Error(
          'Loki connector error. Cannot update a Model without _id key'
        )
      }
      const model = await this.getModel()

      document.modified = Math.round(+new Date() / 1000)
      let local = await model.findOne({ _id: document._id })
      let mod = { ...local, ...document }

      return model.update(mod)
    },
    /**
     *
     * @param {*} param0
     */
    async updateOrCreate({ document }) {
      const model = await this.getModel()
      let role = await model.findOne(document)

      if (!role) {
        model.insert(document)
      }
    },
    /**
     *
     * @param {*} param0
     */
    async findAndRemove({ filter }) {
      const model = await this.getModel()

      return model.findAndRemove(filter)
    },
    /**
     *
     * @param {*} param0
     */
    async clear() {
      const model = await this.getModel()

      return model.clear({ removeIndices: true })
    }
  }
})
