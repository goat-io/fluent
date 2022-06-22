import { Objects } from '@goatlab/js-utils'
import { Database } from './Database'
import { Dates } from '@goatlab/dates'
import {
  BaseDataElement,
  Sure,
  Filter,
  PaginatedData,
  Paginator,
  BaseConnector,
  FluentConnectorInterface
} from '@goatlab/fluent'

export class LokiConnector<
    ModelDTO = BaseDataElement,
    InputDTO = ModelDTO,
    OutputDTO = ModelDTO
  >
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements FluentConnectorInterface<InputDTO, OutputDTO>
{
  private name = 'baseModel'

  constructor(name: string) {
    super()
    this.name = name
    // Fluent.model<ModelDTO>(name)
  }

  /**
   *
   */
  public async get(): Promise<OutputDTO[]> {
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
   * @param filter
   */
  public async paginate(
    paginator: Paginator
  ): Promise<PaginatedData<OutputDTO>> {
    const results: PaginatedData<OutputDTO> = {
      current_page: 1,
      data: [],
      first_page_url: 'response[0].meta.firstPageUrl,',
      next_page_url: 'response[0].meta.nextPageUrl',
      path: 'response[0].meta.path',
      per_page: 1,
      prev_page_url: ' response[0].meta.previousPageUrl',
      total: 10
    }

    return results
  }

  /**
   * [remove description]
   * @param  {[type]} document [description]
   * @return {[type]}          [description]
   */
  public async deleteById(id: string): Promise<string> {
    if (!id) {
      throw new Error('No id assign to remove().You must give and id to delete')
    }
    const model = await this.getModel()
    await model.findAndRemove({ id })
    this.reset()
    return id
  }

  /**
   *
   * @param id
   */
  public async findById(id: string): Promise<OutputDTO> {
    if (!id) {
      throw new Error('No id assign to remove().You must give and id to delete')
    }
    const model = await this.getModel()
    const result: OutputDTO = await model.find({
      id
    })
    this.reset()
    return result
  }

  /**
   * [insert description]
   * @param  {Object, Array} element [description]
   * @return {[type]}         [description]
   */
  public async insert(data: InputDTO): Promise<OutputDTO> {
    const _data = Objects.clone(data)

    const model = await this.getModel()

    const inserted: OutputDTO = {
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
  ): Promise<OutputDTO[]> {
    const insertedElements: OutputDTO[] = []

    for (const element of data) {
      const inserted: OutputDTO = await this.insert({
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
    id: string,
    data: InputDTO
  ): Promise<OutputDTO> {
    if (!id) {
      throw new Error(
        'Loki connector error. Cannot update a Model without id key'
      )
    }
    const model = await this.getModel()

    const local = await model.findOne({ id })

    const mod = {
      ...local,
      ...data,
      ...{ modified: Dates.currentIsoString() }
    }

    const updated: OutputDTO = model.update(mod)
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
  public async clear({ sure }: Sure) {
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
            `Error in: "${c[0]}" "Where" close does not work with Array elements`
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
      throw new Error(`The operator "${operator}" is not supported in Loki `)
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
