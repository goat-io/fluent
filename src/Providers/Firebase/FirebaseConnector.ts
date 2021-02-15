import * as admin from 'firebase-admin'

import { BaseConnector, GoatConnectorInterface } from '../../BaseConnector'
import { BaseFirestoreRepository, getRepository } from 'fireorm'
import {
  Connection,
  ObjectLiteral,
  createConnection as connection,
  getConnection,
  getRepository as getRepositoryTypeORM
} from 'typeorm'
import {
  GoatFilter,
  GoatOutput,
  IDataElement,
  IPaginatedData,
  IPaginator,
  ISure
} from '../types'

import { Errors } from '../../Helpers/Errors'
import { FieldPath } from '@google-cloud/firestore'
import { Id } from '../../Helpers/Id'
import { Objects } from '../../Helpers/Objects'
import { getOutputKeys } from '../outputKeys'
import { loadRelations } from './relations/loadRelations'
import to from 'await-to-js'

const db = admin.firestore()

export const createConnection = connection
/**
 * Creates a repository from the given Entity
 * @param Entity
 */
export const createFirebaseRepository = Entity => {
  const typeOrmRepo = getRepositoryTypeORM(Entity, '_goat_model_generator')
  const repository = getRepository(Entity)
  let name: string = ''
  let path: string = ''
  const relations = {}

  for (const relation of typeOrmRepo.metadata.relations) {
    relations[relation.inverseEntityMetadata.givenTableName.toLowerCase()] = {
      isOneToMany: relation.isOneToMany,
      isManyToOne: relation.isManyToOne,
      isManyToMany: relation.isManyToMany,
      inverseSidePropertyPath: relation.inverseSidePropertyPath,
      propertyPath: relation.propertyName,
      entityName: relation.inverseEntityMetadata.name,
      tableName: relation.inverseEntityMetadata.tableName,
      targetClass: relation.inverseEntityMetadata.target,
      joinColumns: relation.joinColumns,
      inverseJoinColumns: relation.inverseJoinColumns
    }
  }

  try {
    const parsed = JSON.parse(JSON.stringify(repository))
    name = parsed.colName
    path = parsed.collectionPath
  } catch (error) {
    name = ''
  }
  return {
    repository,
    name,
    path,
    keys: [...['id', '_id'], ...getOutputKeys(typeOrmRepo)],
    relations
  }
}
/**
 *
 */
export class FirebaseConnector<
    ModelDTO = IDataElement,
    InputDTO = ModelDTO,
    OutputDTO = InputDTO
  >
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements GoatConnectorInterface<InputDTO, GoatOutput<InputDTO, OutputDTO>> {
  private repository: BaseFirestoreRepository<any>
  private collection: FirebaseFirestore.CollectionReference<ModelDTO>

  constructor(Entity, relationQuery?: any) {
    super()
    const { repository, keys, name, relations } = createFirebaseRepository(
      Entity
    )
    this.relationQuery = relationQuery
    this.repository = repository
    this.collection = db.collection(
      name
    ) as FirebaseFirestore.CollectionReference<ModelDTO>
    this.outputKeys = keys || []
    this.modelRelations = relations
  }
  /**
   *
   */
  public async get(): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    let query = this.getGeneratedQuery()

    if (this.relationQuery && this.relationQuery.data) {
      const ids = this.relationQuery.data.map(d => d.id)
      query = query.where(
        this.relationQuery.relation.inverseSidePropertyPath,
        'in',
        ids
      )
    }

    const [getError, snapshot] = await to(query.get())

    if (getError) {
      console.log(getError)
      throw new Error(Errors(getError, 'Error while getting submissions'))
    }

    const result = []

    snapshot.forEach(doc => {
      result.push(doc.data())
    })

    let data = this.jsApplySelect(result)

    data = await loadRelations({
      data,
      relations: this.relations,
      modelRelations: this.modelRelations,
      provider: 'firebase',
      self: this
    })

    this.reset()
    return data
  }
  /**
   *
   */
  public async getPaginated(): Promise<
    IPaginatedData<GoatOutput<InputDTO, OutputDTO>>
  > {
    const [error, response]: any = await to(this.get())

    if (error) {
      throw new Error(Errors(error, 'Error while getting submissions'))
    }

    const result = this.jsApplySelect(response)

    const results: IPaginatedData<OutputDTO> = {
      current_page: 1,
      data: result,
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
    filter: GoatFilter = {}
  ): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    const stringFilter: string = filter as string
    let parsedFilter: any = {}
    try {
      parsedFilter = JSON.parse(stringFilter)
    } catch (error) {
      parsedFilter = {}
    }

    this.selectArray = (parsedFilter && parsedFilter.fields) || []
    this.whereArray =
      (parsedFilter && parsedFilter.where && parsedFilter.where.and) || []
    this.orWhereArray =
      (parsedFilter && parsedFilter.where && parsedFilter.where.or) || []
    this.limit(
      (parsedFilter && (parsedFilter.limit || parsedFilter.take)) || 20
    )
    this.offset(
      (parsedFilter && (parsedFilter.offset || parsedFilter.skip)) || 0
    )

    if (parsedFilter && parsedFilter.order) {
      const orderB = [
        parsedFilter.order.field,
        parsedFilter.order.asc ? 'asc' : 'desc',
        parsedFilter.order.type || 'string'
      ]
      this.chainReference.push({ method: 'orderBy', orderB })
      this.orderByArray = orderB
    }

    return this.get()
  }
  /**
   *
   * @param paginator
   */
  public async paginate(
    paginator: IPaginator
  ): Promise<IPaginatedData<GoatOutput<InputDTO, OutputDTO>>> {
    if (!paginator) {
      throw new Error('Paginator cannot be empty')
    }
    this.paginator = paginator

    const response = await this.getPaginated()

    return response
  }
  /**
   *
   * Returns the Firebase collection, you can use it
   * form more complex queries and to get
   * the TypeOrm query builder
   *
   * @param query
   */
  public raw() {
    return this.collection
  }
  /**
   *
   * @param data
   */
  public async insert(
    data: InputDTO,
    forcedId?: string | number
  ): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const id = forcedId || Id.objectIdString()
    // TODO we have to change this to manage cases where created, updated or version fields are included in the respective models
    // const created = new Date()
    // const updated = new Date()
    // const version = 1
    const [error, datum] = await to(this.repository.create({ id, ...data }))

    if (error) {
      return Promise.reject(Errors(error, 'Validation Error'))
    }

    const result = this.jsApplySelect([datum]) as GoatOutput<
      InputDTO,
      OutputDTO
    >[]
    this.reset()
    return result[0]
  }
  /**
   *
   * @param data
   */
  public async insertMany(
    data: InputDTO[],
    forcedId?: string | number
  ): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    const batch = []

    data.forEach(d => {
      const id = Id.objectIdString()
      // const created = new Date()
      // const updated = new Date()
      // const version = 1
      batch.push(this.repository.create({ id, ...d }))
    })

    const [error, inserted] = await to(Promise.all(batch))

    if (error) {
      return Promise.reject(Errors(error, 'Could not insert all elements'))
    }

    const result = this.jsApplySelect(inserted) as GoatOutput<
      InputDTO,
      OutputDTO
    >[]
    this.reset()

    return result
  }
  /**
   *
   * @param data
   */
  public async batchInsert(
    data: InputDTO[]
  ): Promise<GoatOutput<InputDTO, OutputDTO>[]> {
    const batch = this.repository.createBatch()

    data.forEach(d => {
      const id = Id.objectIdString()
      // const created = new Date()
      // const updated = new Date()
      // const version = 1
      batch.create({ id, ...d })
    })

    const [error, inserted] = await to(batch.commit())

    if (error) {
      return Promise.reject(Errors(error, 'Could not insert all elements'))
    }

    const result = this.jsApplySelect(inserted) as GoatOutput<
      InputDTO,
      OutputDTO
    >[]
    this.reset()

    return result
  }
  /**
   *
   * @param data
   */
  public async updateById(
    id: string,
    data: InputDTO
  ): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const parsedId = id

    const [getError, dbResult] = await to(this.repository.findById(parsedId))

    if (getError) {
      return Promise.reject(Errors(getError, 'Entity not found'))
    }

    const updateData = {
      ...dbResult,
      ...data /* ...{ updated: new Date() }*/
    }

    const [error, updated] = await to(this.repository.update(updateData))

    const result = this.jsApplySelect([updated]) as GoatOutput<
      InputDTO,
      OutputDTO
    >[]
    this.reset()
    return result[0]
  }
  /**
   *
   * PUT operation. All fields not included in the data
   *  param will be set to null
   *
   * @param id
   * @param data
   */
  public async replaceById(
    id: string,
    data: InputDTO
  ): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const parsedId = id

    const [getError, value] = await to(this.repository.findById(parsedId))

    if (getError) {
      return Promise.reject(Errors(getError, 'Entity not found'))
    }

    const flatValue = Objects.flatten(JSON.parse(JSON.stringify(value)))

    Object.keys(flatValue).forEach(key => {
      if (key !== 'id') {
        flatValue[key] = null
      }
    })

    const nullObject = Objects.nest(flatValue)

    const newValue = { ...nullObject, ...data }

    delete newValue.created
    delete newValue.updated

    const entity = { ...newValue /*...{ updated: new Date() }*/ }

    const [error] = await to(this.repository.update(entity))

    if (error) {
      return Promise.reject(Errors(error, 'Could not save'))
    }

    const [findError, val] = await to(this.repository.findById(parsedId))

    if (findError) {
      return Promise.reject(Errors(findError, 'Entity not found'))
    }

    const returnValue = this.jsApplySelect([val]) as GoatOutput<
      InputDTO,
      OutputDTO
    >[]
    this.reset()

    return returnValue[0]
  }
  /**
   *
   * @param param0
   */
  public async clear({ sure }: ISure) {
    if (!sure || sure !== true) {
      throw new Error(
        'Clear() method will delete everything!, you must set the "sure" parameter "clear({sure:true})" to continue'
      )
    }

    const query = this.collection.orderBy('__name__').limit(300)

    this.reset()

    return new Promise((resolve, reject) => {
      this.deleteQueryBatch(db, query, 300, resolve, reject)
    })
  }
  /**
   *
   * @param id
   */
  public async deleteById(id: string): Promise<string> {
    const parsedId = id

    const [error, removed] = await to(this.repository.delete(parsedId))
    if (error) {
      return Promise.reject(Errors(error, `Could not delete ${id}`))
    }

    this.reset()
    return id
  }
  /**
   *
   * @param id
   */
  public async findById(id: string): Promise<GoatOutput<InputDTO, OutputDTO>> {
    const parsedId = id

    const [error, data] = await to(this.repository.findById(parsedId))

    if (error) {
      return Promise.reject(Errors(error, 'Could not get data'))
    }

    const result = this.jsApplySelect(data) as GoatOutput<InputDTO, OutputDTO>[]
    this.reset()

    if (result.length === 0) {
      return Promise.reject(Errors(error, 'Entity not found'))
    }

    return result[0]
  }
  /**
   *
   */
  private getPage() {
    const page = 'page='
    if (this.paginator && this.paginator.page) {
      return page + this.paginator.page + '&'
    }

    return ''
  }
  /**
   *
   * @param filter
   */
  private getPaginatorLimit(filter) {
    if (this.paginator && this.paginator.perPage) {
      return { ...filter, limit: this.paginator.perPage }
    }

    return filter
  }
  /**
   *
   */
  private getPopulate() {
    const populate = []
    this.populateArray.forEach(relation => {
      if (typeof relation === 'string') {
        populate.push({ relation })
      } else if (Array.isArray(relation)) {
        relation.forEach(nestedRelation => {
          if (typeof nestedRelation === 'string') {
            populate.push({ relation: nestedRelation })
          } else if (typeof nestedRelation === 'object') {
            populate.push(nestedRelation)
          }
        })
      } else if (typeof relation === 'object') {
        populate.push(relation)
      }
    })

    return populate
  }
  /**
   *
   */
  private getGeneratedQuery(): FirebaseFirestore.Query {
    let queryBuilder = this.getFilters()

    const select = this.getSelect()
    if (select.length > 0) {
      queryBuilder = queryBuilder.select(...this.getSelect())
    }

    const limit: number = this.getLimit()
    if (limit > 0) {
      queryBuilder = queryBuilder.limit(limit)
    }

    const skip = this.getSkip()

    if (skip) {
      queryBuilder = queryBuilder.offset(skip)
    }

    const order = this.getOrderBy()
    if (order[0] && order[0] !== '') {
      const fieldPath = new FieldPath(order[0] || '')
      const orderByOrder = order[1] || 'desc'
      queryBuilder = queryBuilder.orderBy(fieldPath, orderByOrder)
    }

    // filter = this.getPaginatorLimit(filter)
    // const page = this.getPage()
    // const populate = this.getPopulate()
    return queryBuilder
  }
  /**
   *
   * @param filters
   */
  private getFilters(): FirebaseFirestore.Query {
    const andFilters = this.whereArray
    const orFilters = this.orWhereArray

    if (!andFilters || andFilters.length === 0) {
      return this.collection
    }

    let filterQuery: FirebaseFirestore.Query

    // Apply and conditions
    andFilters.forEach((condition, index) => {
      const element = condition[0]
      const operator = condition[1]
      const value = condition[2]

      if (index === 0) {
        filterQuery = this.collection as FirebaseFirestore.Query
      }

      switch (operator) {
        case '=':
          filterQuery = filterQuery.where(element, '==', value)
          break
        case '!=':
          filterQuery = filterQuery.where(element, '!=', value)
          break
        case '>':
          filterQuery = filterQuery.where(element, operator, value)
          break
        case '>=':
          filterQuery = filterQuery.where(element, operator, value)
          break
        case '<':
          filterQuery = filterQuery.where(element, operator, value)
          break
        case '<=':
          filterQuery = filterQuery.where(element, operator, value)
          break
        case 'in':
          filterQuery = filterQuery.where(element, 'in', value)
          break
        case 'array-contains':
          filterQuery = filterQuery.where(element, 'array-contains', value)
          break
        case 'nin':
          throw new Error('The nin Operator cannot be used in Firabase')
          break
        case 'exists':
          throw new Error('The nin Operator cannot be used in Firabase')
          break
        case '!exists':
          throw new Error('The !exists Operator cannot be used in Firabase')
          break
        case 'regexp':
          throw new Error('The regexp Operator cannot be used in Firabase')
          break
      }
    })

    return filterQuery
  }
  /**
   *
   * @param filter
   */
  // TODO order by can have more than 1 element
  private getOrderBy() {
    if (!this.orderByArray || this.orderByArray.length === 0) {
      return []
    }

    return [this.orderByArray[0], this.orderByArray[1].toLowerCase()]
  }
  /**
   *
   * @param filter
   */
  private getLimit() {
    if (!this.limitNumber || this.limitNumber === 0) {
      this.limitNumber = (this.rawQuery && this.rawQuery.limit) || 20
    }

    return this.limitNumber
  }
  /**
   *
   * @param filter
   */
  private getSkip() {
    if (!this.offsetNumber) {
      this.offsetNumber = (this.rawQuery && this.rawQuery.skip) || 0
    }

    return this.offsetNumber
  }
  /**
   *
   * @param filter
   */
  private getSelect(): string[] {
    let select = this.selectArray

    select = select.map(s => {
      s = s.split(' as ')[0]
      s = s.includes('id') ? 'id' : s
      return s
    })

    if (select.find(e => e.startsWith('data.'))) {
      select.unshift('data')
    }

    if (!select) {
      return []
    }

    return select
  }

  private deleteQueryBatch(db, query, batchSize, resolve, reject) {
    query
      .get()
      .then(snapshot => {
        // When there are no documents left, we are done
        if (snapshot.size == 0) {
          return 0
        }

        // Delete documents in a batch
        const batch = db.batch()
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref)
        })

        return batch.commit().then(() => {
          return snapshot.size
        })
      })
      .then(numDeleted => {
        if (numDeleted === 0) {
          resolve()
          return
        }

        // Recurse on the next process tick, to avoid
        // exploding the stack.
        process.nextTick(() => {
          this.deleteQueryBatch(db, query, batchSize, resolve, reject)
        })
      })
      .catch(reject)
  }
}
