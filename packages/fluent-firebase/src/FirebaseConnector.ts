import * as admin from 'firebase-admin'
import { BaseFirestoreRepository, getRepository } from 'fireorm'
import { FieldPath } from '@google-cloud/firestore'
import type {
  Filter,
  BaseDataElement,
  PaginatedData,
  Paginator,
  Sure
} from '@goatlab/fluent'
import {
  BaseConnector, DataSource,
  FluentConnectorInterface,
  getOutputKeys,
  loadRelations
} from '@goatlab/fluent'
import { Objects, Ids } from '@goatlab/js-utils'

/**
 * Creates a repository from the given Entity
 * @param Entity
 * @param dataSource
 */
export const createFirebaseRepository = (Entity, dataSource: DataSource) => {
  const typeOrmRepo = dataSource.getRepository(Entity)
  const repository = getRepository(Entity)

  let name = ''
  let path = ''
  const relations = {}

  for (const relation of typeOrmRepo.metadata.relations) {
    relations[relation.propertyName] = {
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
    name = parsed.colMetadata.name
    path = parsed.path
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
export class FirebaseConnector<ModelDTO = BaseDataElement,
  InputDTO = ModelDTO,
  OutputDTO = InputDTO>
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements FluentConnectorInterface<InputDTO, OutputDTO> {
  private repository: BaseFirestoreRepository<any>

  private readonly collection: FirebaseFirestore.CollectionReference<ModelDTO>

  constructor(Entity, dataSource: DataSource, relationQuery?: any) {
    super()
    const { repository, keys, name, relations } =
      createFirebaseRepository(Entity, dataSource)
    this.relationQuery = relationQuery
    this.repository = repository
    this.collection = admin.firestore().collection(
      name
    ) as FirebaseFirestore.CollectionReference<ModelDTO>
    this.outputKeys = keys || []
    this.modelRelations = relations
  }

  /**
   *
   */
  public async get(): Promise<OutputDTO[]> {
    let query = this.getGeneratedQuery()
     let pivotData : any[] = []
    if (this.relationQuery && this.relationQuery.data && this.relationQuery.relation) {
      const ids = this.relationQuery.data.map(d => d.id)

      if (this.relationQuery?.relation?.isManyToMany) {
        const pivotForeignKey = this.relationQuery.relation.joinColumns[0].propertyName
        const pivotInverseKey = this.relationQuery.relation.inverseJoinColumns[0].propertyName
        const {pivot} = this.relationQuery

        pivotData = await pivot.where(key => key[pivotForeignKey], "in", ids).get()
        if(!pivotData.length) {
          return []
        }
        const inverseIds = [...new Set(pivotData.map(d => d[pivotInverseKey]))]

        if(!inverseIds.length) {
          return []
        }

        if(inverseIds.length) {
          query = query.where(
            "id",
            'in',
            inverseIds
          )
        }
      } else {
        query = query.where(
          this.relationQuery.relation.inverseSidePropertyPath,
          'in',
          ids
        )
      }

    }

    const snapshot = await query.get()

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
      self: this,
      returnPivot: Boolean(this.relationQuery?.returnPivot)
    })

    if(pivotData.length && this.relationQuery?.returnPivot) {
      const pivotInverseKey = this.relationQuery.relation.inverseJoinColumns[0].propertyName
      data = data.map(d => {
        return {...d, pivot: pivotData.find(p => p[pivotInverseKey] === d.id)}
      })
    }

    this.reset()
    return data
  }

  /**
   *
   */
  public async getPaginated(): Promise<PaginatedData<OutputDTO>> {
    const response: any = await this.get()

    const result = this.jsApplySelect(response)

    const results: PaginatedData<OutputDTO> = {
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
  public async all(): Promise<OutputDTO[]> {
    return this.get()
  }

  /**
   *
   * @param filter
   */
  public async find(
    filter: Filter = {}
  ): Promise<OutputDTO[]> {
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
    paginator: Paginator
  ): Promise<PaginatedData<OutputDTO>> {
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
  ): Promise<OutputDTO> {
    const id = forcedId || Ids.objectIdString()
    // TODO we have to change this to manage cases where created, updated or version fields are included in the respective models
    // const created = new Date()
    // const updated = new Date()
    // const version = 1
    const datum = await this.repository.create({ id, ...data })

    const result = this.jsApplySelect([datum]) as OutputDTO[]
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
  ): Promise<OutputDTO[]> {
    const batch = []

    data.forEach(d => {
      const id = Ids.objectIdString()
      // const created = new Date()
      // const updated = new Date()
      // const version = 1
      batch.push(this.repository.create({ id, ...d }))
    })

    const inserted = await Promise.all(batch)

    const result = this.jsApplySelect(inserted) as OutputDTO[]
    this.reset()

    return result
  }

  /**
   *
   * @param data
   */
  public async batchInsert(
    data: InputDTO[]
  ): Promise<OutputDTO[]> {
    const batch = this.repository.createBatch()

    data.forEach(d => {
      const id = Ids.objectIdString()
      // const created = new Date()
      // const updated = new Date()
      // const version = 1
      batch.create({ id, ...d })
    })

    const inserted = await batch.commit()

    const result = this.jsApplySelect(inserted) as OutputDTO[]
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
  ): Promise<OutputDTO> {
    const parsedId = id

    const dbResult = await this.repository.findById(parsedId)

    const updateData = {
      ...dbResult,
      ...data /* ...{ updated: new Date() } */
    }

    const updated = await this.repository.update(updateData)

    const result = this.jsApplySelect([updated]) as OutputDTO[]
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
  ): Promise<OutputDTO> {
    const parsedId = id

    const value = await this.repository.findById(parsedId)

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

    const entity = { ...newValue /* ...{ updated: new Date() } */ }

    await this.repository.update(entity)

    const val = await this.repository.findById(parsedId)

    const returnValue = this.jsApplySelect([val]) as OutputDTO[]
    this.reset()

    return returnValue[0]
  }

  /**
   *
   * @param param0
   */
  public async clear({ sure }: Sure) {
    if (!sure || sure !== true) {
      throw new Error(
        'Clear() method will delete everything!, you must set the "sure" parameter "clear({sure:true})" to continue'
      )
    }

    const query = this.collection.orderBy('__name__').limit(300)

    this.reset()

    return new Promise((resolve, reject) => {
      this.deleteQueryBatch(admin.firestore(), query, 300, resolve, reject)
    })
  }

  /**
   *
   * @param id
   */
  public async deleteById(id: string): Promise<string> {
    const parsedId = id

    await this.repository.delete(parsedId)

    this.reset()
    return id
  }

  /**
   *
   * @param id
   */
  public async findById(id: string): Promise<OutputDTO> {
    const parsedId = id

    const data = await this.repository.findById(parsedId)

    const result = this.jsApplySelect(data) as OutputDTO[]
    this.reset()

    if (result.length === 0) {
      return null
    }

    return result[0]
  }

  public async findByIds(ids: string[]): Promise<OutputDTO[] | null> {
    const data = await this.raw().where('id', 'in', ids).get()
    if (data.empty) {
      return null
    }
    const res = []
    data.forEach(doc => {
      res.push(doc.data())
    })
    const results = this.jsApplySelect(res) as OutputDTO[]
    this.reset()

    return results
  }

  /**
   *
   */
  private getPage() {
    const page = 'page='
    if (this.paginator && this.paginator.page) {
      return `${page + this.paginator.page}&`
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

      return batch.commit().then(() => snapshot.size)
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
