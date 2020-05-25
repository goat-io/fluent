import {
  BaseConnector,
  IDataElement,
  IGoatExtendedAttributes,
  GoatConnectorInterface,
  GoatOutput
} from '../../BaseConnector'
import { Objects } from '../../Helpers/Objects'
import { IDeleted, IPaginatedData, IPaginator, ISure } from '../types'
import { Database } from './Database'
import { Dates } from '../../Helpers/Dates'
import { Filter } from '@loopback/repository'
import { Fluent } from '../../Fluent'

export class LokiConnector<
  ModelDTO = IDataElement,
  InputDTO = ModelDTO,
  OutputDTO = ModelDTO
> extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements GoatConnectorInterface<InputDTO, GoatOutput<InputDTO, OutputDTO>> {
  private name: string = 'baseModel'

  constructor(name: string) {
    super()
    this.name = name
    Fluent.model<ModelDTO>(name)
  }
  /**
   *
   */
  public async get(): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    const filterObject = this.prepareFilter()

    let data = await (await this.getModel())
      .chain()
      .find(filterObject)
      .offset(this.offsetNumber)
      .limit(this.limitNumber)
      .data()

    // data = this.jsApplySelect(data)
    data = this.jsApplyOrderBy(data)
    this.reset()
    return data
  }
  /**
   *
   */
  public async all(): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    return this.get()
  }
  /**
   *
   * @param filter
   */
  public async find(
    filter: Filter<GoatOutput<InputDTO, OutputDTO>>
  ): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    return this.get()
  }
  /**
   * [remove description]
   * @param  {[type]} document [description]
   * @return {[type]}          [description]
   */
  public async deleteById(_id: string): Promise<string> {
    if (!_id) {
      throw new Error(
        'No id assign to remove().You must give and _id to delete'
      )
    }
    const model = await this.getModel()
    await model.findAndRemove({ _id })
    this.reset()
    return _id
  }
  /**
   *
   * @param _id
   */
  public async findById(_id: string): Promise<GoatOutput<InputDTO, OutputDTO>> {
    if (!_id) {
      throw new Error(
        'No id assign to remove().You must give and _id to delete'
      )
    }
    const model = await this.getModel()
    const result: GoatOutput<InputDTO, OutputDTO> = await model.find({
      _id
    })
    this.reset()
    return result
  }
  /**
   * [insert description]
   * @param  {Object, Array} element [description]
   * @return {[type]}         [description]
   */
  public async insert(
    data: InputDTO
  ): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const _data = Objects.clone(data)

    const model = await this.getModel()

    const goatAttributes = this.getExtendedCreateAttributes()

    const inserted: GoatOutput<InputDTO, OutputDTO> = {
      ...goatAttributes,
      ..._data
    }

    model.insert(inserted)
    this.reset()
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
      const goatAttributes = this.getExtendedCreateAttributes()

      const inserted: GoatOutput<InputDTO, OutputDTO> = await this.insert({
        ...goatAttributes,
        ...element
      })

      insertedElements.push(inserted)
    }
    this.reset()
    return insertedElements
  }
  /**
   *
   * @param document
   */
  public async updateById(
    _id: string,
    data: InputDTO
  ): Promise<GoatOutput<InputDTO, OutputDTO>> {
    if (!_id) {
      throw new Error(
        'Loki connector error. Cannot update a Model without _id key'
      )
    }
    const model = await this.getModel()

    const local = await model.findOne({ _id })

    const mod = {
      ...local,
      ...data,
      ...{ modified: Dates.currentIsoString() }
    }

    const updated: GoatOutput<InputDTO, OutputDTO> = model.update(mod)
    this.reset()
    return updated
  }
  /**
   *
   * @param {*} param0
   */
  /*
  public async updateOrCreate({ document }) {
    const model = await this.getModel()
    const role = await model.findOne(document)

    if (!role) {
      model.insert(document)
    }
  }
  */
  /**
   *
   * @param {*} param0
   */
  /*
  public async findAndRemove({ filter }) {
    const model = await this.getModel()

    return model.findAndRemove(filter)
  }
  */
  /**
   *
   * @param {*} param0
   */
  public async clear({ sure }: ISure) {
    const model = await this.getModel()

    return model.clear({ removeIndices: true })
  }
  /**
   *
   */
  private prepareFilter() {
    const andObject = { $and: [] }
    const orObject = { $or: [] }
    let globalFilter = {}
    // All first Level AND conditions
    if (this.whereArray.length > 0) {
      this.whereArray.forEach(c => {
        const conditionToObject = {}

        if (c[0].includes('[')) {
          throw new Error(
            'Error in: "' +
              c[0] +
              '" "Where" close does not work with Array elements'
          )
        }

        conditionToObject[c[0]] = {}
        const lokiOperator = this.getLokiOperator(c[1])

        conditionToObject[c[0]][lokiOperator] = c[2]
        if (lokiOperator.includes('$regex|')) {
          delete conditionToObject[c[0]][lokiOperator]
          conditionToObject[c[0]].$regex = lokiOperator
            .replace('$regex|', '')
            .replace('{{$var}}', c[2])
        }

        andObject.$and.push(conditionToObject)
      })
      globalFilter = andObject
    }
    // All second level OR conditions
    if (this.orWhereArray.length > 0) {
      this.orWhereArray.forEach(c => {
        const conditionToObject = {}

        conditionToObject[c[0]] = {}
        const lokiOperator = this.getLokiOperator(c[1])

        conditionToObject[c[0]][lokiOperator] = c[2]
        if (lokiOperator.includes('$regex|')) {
          delete conditionToObject[c[0]][lokiOperator]
          conditionToObject[c[0]].$regex = lokiOperator
            .replace('$regex|', '')
            .replace('{{$var}}', c[2])
        }

        orObject.$or.push(conditionToObject)
      })

      globalFilter = { $or: [andObject, orObject] }
    }

    // TODO we should include global level and() or()
    // operators to give room for more complex queries
    return globalFilter
  }
  /**
   *
   * @param {*} operator
   */
  private getLokiOperator(operator) {
    const lokiOperators = {
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
    const converted = Objects.get(() => lokiOperators[operator], undefined)

    if (!converted) {
      throw new Error(
        'The operator "' + operator + '" is not supported in Loki '
      )
    }
    return converted
  }
  /**
   *
   * @param {Object} db The name of the model to fetch
   * @param {String} db.model The name of the model to fetch
   * @returns {Promise} The DB model
   */
  private async getModel() {
    const DB = await Database.get()
    return DB.getCollection(this.name)
  }
}
