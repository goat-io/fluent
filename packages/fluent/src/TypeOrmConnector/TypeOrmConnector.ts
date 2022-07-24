import { Primitives } from './../../../js-utils/src/types'
import { LogicOperator, PrimitivesArray, QueryOutput } from './../types'
/**
 * Inspiration: https://github.com/laravel/framework/blob/9.x/src/Illuminate/Database/Eloquent/Model.php
 */
import {
  Equal,
  FindManyOptions,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  Like,
  MoreThan,
  MoreThanOrEqual,
  Not,
  ObjectID,
  Repository,
  DeepPartial,
  FindOptionsWhere
} from 'typeorm'
import { ObjectId } from 'mongodb'
import { Ids, Objects } from '@goatlab/js-utils'
import { loadRelations } from '../loadRelations'
import { BaseConnector, FluentConnectorInterface } from '../BaseConnector'
import { getOutputKeys } from '../outputKeys'
import type {
  AnyObject,
  FluentQuery,
  PaginatedData,
  Paginator,
  QueryInsert
} from '../types'
import { DataSource } from 'typeorm'
import { modelGeneratorDataSource } from '../generatorDatasource'
import { z } from 'zod'

export const getRelations = typeOrmRepo => {
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
  return {
    relations
  }
}

export interface TypeOrmConnectorParams<Input, Output> {
  entity: any
  dataSource: DataSource
  inputSchema: z.ZodType<Input>
  outputSchema?: z.ZodType<Output>
  relationQuery?: any
}
export class TypeOrmConnector<
    ModelDTO = AnyObject,
    InputDTO = ModelDTO,
    OutputDTO = InputDTO
  >
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO>
{
  private readonly repository: Repository<ModelDTO>

  private readonly dataSource: DataSource

  private readonly inputSchema: z.ZodType<InputDTO>

  private readonly outputSchema: z.ZodType<OutputDTO> | undefined

  constructor({
    entity,
    dataSource,
    inputSchema,
    outputSchema
  }: TypeOrmConnectorParams<InputDTO, OutputDTO>) {
    super()
    this.dataSource = dataSource
    this.inputSchema = inputSchema
    this.outputSchema =
      outputSchema || (inputSchema as unknown as z.ZodType<OutputDTO>)
    this.repository = this.dataSource.getRepository(entity)
    const relationShipBuilder = modelGeneratorDataSource.getRepository(entity)
    const { relations } = getRelations(relationShipBuilder)

    this.modelRelations = relations

    this.outputKeys = getOutputKeys(relationShipBuilder) || []

    this.isMongoDB =
      this.repository.metadata.connection.driver.options.type === 'mongodb'
  }

  /**
   * Insert the data object into the database.
   * @param data
   */
  public async insert(data: InputDTO): Promise<OutputDTO> {
    // Validate Input
    const validatedData = this.inputSchema.parse(data)

    // Only Way to Skip the DeepPartial requirement from TypeORm
    const datum = await this.repository.save(
      validatedData as unknown as DeepPartial<ModelDTO>
    )

    // Validate Output
    return this.outputSchema.parse(
      this.clearEmpties(Objects.deleteNulls(datum))
    )
  }

  public async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    const validatedData = this.inputSchema.array().parse(data)

    //
    const inserted = await this.repository.save(
      validatedData as unknown as DeepPartial<ModelDTO[]>,
      {
        chunk: data.length / 300
      }
    )

    return this.outputSchema
      .array()
      .parse(inserted.map(d => this.clearEmpties(Objects.deleteNulls(d))))
  }

  /**
   *
   * Returns the TypeOrm Repository, you can use it
   * form more complex queries and to get
   * the TypeOrm query builder
   *
   * @param query
   */
  public raw(): Repository<ModelDTO> {
    return this.repository
  }

  public async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO, OutputDTO>[]> {
    const found = await this.repository.find(this.generateTypeOrmQuery(query))
    // Validate Output against schema
    return this.outputSchema
      .array()
      .parse(
        found.map(d => this.clearEmpties(Objects.deleteNulls(d)))
      ) as QueryOutput<T, ModelDTO, OutputDTO>[]
  }

  private generateTypeOrmQuery(query?: FluentQuery<ModelDTO>): FindManyOptions {
    let filter: FindManyOptions = {}

    filter.where = this.isMongoDB ? {} : this.getTypeOrmWhere(query?.where)

    filter.take = query?.limit
    filter.skip = query?.offset
    filter.select = query?.select
    filter.order = this.getOrderBy(query?.orderBy)

    // TODO: we will bring the full relation Object, we should be able to filter down properties
    filter.relations = Object.keys(query?.include || {})

    // filter = this.getPaginatorLimit(filter)
    // const page = this.getPage()

    return filter
  }

  private getTypeOrmWhere(
    where?: FluentQuery<ModelDTO>['where']
  ): FindManyOptions['where'] {
    /*
    TODO: related Searches
    if (this.relationQuery && this.relationQuery.data) {
      const ids = this.relationQuery.data.map(d => d.id)

      andFilters.push([
        this.relationQuery.relation.inverseSidePropertyPath,
        'in',
        ids
      ])
    }
    */

    if (!where || Object.keys(where).length === 0) {
      return {}
    }

    // Every element of the array is an OR
    const Filters = { where: [{}] }

    const orConditions = this.extractConditions(where['OR'])
    const andConditions = this.extractConditions(where['AND'])

    const copy = Objects.clone(where)
    if (!!copy['AND']) {
      delete copy['AND']
    }

    if (!!copy['OR']) {
      delete copy['OR']
    }

    const rootLevelConditions = this.extractConditions([copy])

    for (const condition of andConditions) {
      const { element, operator, value } = condition

      switch (operator) {
        case LogicOperator.equals:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: Equal(value) }
          })
          break
        case LogicOperator.isNot:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: Not(Equal(value)) }
          })
          break
        case LogicOperator.greaterThan:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: MoreThan(value) }
          })
          break
        case LogicOperator.greaterOrEqualThan:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: MoreThanOrEqual(value) }
          })
          break
        case LogicOperator.lessThan:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: LessThan(value) }
          })
          break
        case LogicOperator.lessOrEqualThan:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: LessThanOrEqual(value) }
          })
          break
        case LogicOperator.in:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: In(value as string[]) }
          })
          break
        case LogicOperator.notIn:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: Not(In(value as string[])) }
          })
          break
        case LogicOperator.exists:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: Not(IsNull()) }
          })
          break
        case LogicOperator.notExists:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: IsNull() }
          })
          break
        case LogicOperator.regexp:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: Like(value) }
          })
          break
      }
    }

    for (const condition of rootLevelConditions) {
      const { element, operator, value } = condition

      switch (operator) {
        case LogicOperator.equals:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: Equal(value) }
          })
          break
        case LogicOperator.isNot:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: Not(Equal(value)) }
          })
          break
        case LogicOperator.greaterThan:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: MoreThan(value) }
          })
          break
        case LogicOperator.greaterOrEqualThan:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: MoreThanOrEqual(value) }
          })
          break
        case LogicOperator.lessThan:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: LessThan(value) }
          })
          break
        case LogicOperator.lessOrEqualThan:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: LessThanOrEqual(value) }
          })
          break
        case LogicOperator.in:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: In(value as string[]) }
          })
          break
        case LogicOperator.notIn:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: Not(In(value as string[])) }
          })
          break
        case LogicOperator.exists:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: Not(IsNull()) }
          })
          break
        case LogicOperator.notExists:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: IsNull() }
          })
          break
        case LogicOperator.regexp:
          Filters.where[0] = Objects.nest({
            ...Filters.where[0],
            ...{ [element]: Like(value) }
          })
          break
      }
    }

    for (const condition of orConditions) {
      const { element, operator, value } = condition

      switch (operator) {
        case LogicOperator.equals:
          Filters.where.push({ [element]: Equal(value) })
          break
        case LogicOperator.isNot:
          Filters.where.push({ [element]: Not(Equal(value)) })
          break
        case LogicOperator.greaterThan:
          Filters.where.push({ [element]: MoreThan(value) })
          break
        case LogicOperator.greaterOrEqualThan:
          Filters.where.push({ [element]: MoreThanOrEqual(value) })
          break
        case LogicOperator.lessThan:
          Filters.where.push({ [element]: LessThan(value) })
          break
        case LogicOperator.lessOrEqualThan:
          Filters.where.push({ [element]: LessThanOrEqual(value) })
          break
        case LogicOperator.in:
          Filters.where.push({ [element]: In(value as string[]) })
          break
        case LogicOperator.notIn:
          Filters.where.push({ [element]: Not(In(value as string[])) })
          break
        case LogicOperator.exists:
          Filters.where.push({ [element]: Not(IsNull()) })
          break
        case LogicOperator.notExists:
          Filters.where.push({ [element]: IsNull() })
          break
        case LogicOperator.regexp:
          Filters.where.push({ [element]: Like(value) })
          break
      }
    }

    return Filters.where
  }

  /**
   * PATCH operation
   * @param data
   */
  public async updateById(id: string, data: InputDTO): Promise<OutputDTO> {
    const parsedId = this.isMongoDB
      ? (new ObjectId(id) as unknown as ObjectID)
      : id

    const dataToInsert = this.outputKeys.includes('updated')
      ? {
          ...data,
          ...{ updated: new Date() }
        }
      : data

    const validatedData = this.inputSchema.parse(dataToInsert)

    await this.repository.update(id, validatedData)

    const dbResult = await this.repository.findOneOrFail({
      where: {
        id: parsedId
      } as unknown as FindOptionsWhere<ModelDTO>
    })

    // Validate Output
    return this.outputSchema.parse(
      this.clearEmpties(Objects.deleteNulls(dbResult))
    )
  }

  /**
   *
   * PUT operation. All fields not included in the data
   *  param will be set to null
   *
   * @param id
   * @param data
   */
  public async replaceById(id: string, data: InputDTO): Promise<OutputDTO> {
    const parsedId = this.isMongoDB
      ? (new ObjectId(id) as unknown as ObjectID)
      : id

    const value = await this.repository.findOneOrFail({
      where: { id: parsedId } as unknown as FindOptionsWhere<ModelDTO>
    })

    const flatValue = Objects.flatten(JSON.parse(JSON.stringify(value)))

    Object.keys(flatValue).forEach(key => {
      flatValue[key] = null
    })

    const nullObject = Objects.nest(flatValue)

    const newValue = { ...nullObject, ...data }

    delete newValue._id
    delete newValue.id
    delete newValue.created
    delete newValue.updated

    const dataToInsert = this.outputKeys.includes('updated')
      ? {
          ...data,
          ...{ updated: new Date() }
        }
      : data

    const validatedData = this.inputSchema.parse(dataToInsert)

    await this.repository.update(id, validatedData)

    const val = await this.repository.findOneOrFail({
      where: {
        id: parsedId
      } as unknown as FindOptionsWhere<ModelDTO>
    })

    return this.outputSchema.parse(this.clearEmpties(Objects.deleteNulls(val)))
  }

  /**
   *
   * @param filter
   */
  /*
  public getTypeOrmMongoWhere(where: FluentQuery<ModelDTO>['where']) : FindManyOptions['where'] {
    const andFilters = this.whereArray
    const orFilters = this.orWhereArray

    if (this.relationQuery && this.relationQuery.data) {
      const ids = this.relationQuery.data.map(
        d => Ids.objectID(d.id) as unknown as ObjectID
      )

      andFilters.push([
        this.relationQuery.relation.inverseSidePropertyPath,
        'in',
        ids
      ])
    }

    if (!andFilters || andFilters.length === 0) {
      return filters
    }

    const Filters = { where: { $and: [] } }

    andFilters.forEach(condition => {
      let element = condition[0]
      const operator = condition[1]
      let value = condition[2]

      if (element === 'id') {
        element = '_id'

        value = Array.isArray(value)
          ? value.map(v => Ids.objectID(v) as unknown as ObjectID)
          : (Ids.objectID(value) as unknown as ObjectID)
      }

      switch (operator) {
        case '=':
          Filters.where.$and.push({ [element]: { $eq: value } })
          break
        case '!=':
          Filters.where.$and.push({ [element]: { $neq: value } })
          break
        case '>':
          Filters.where.$and.push({ [element]: { $gt: value } })
          break
        case '>=':
          Filters.where.$and.push({ [element]: { $gte: value } })
          break
        case '<':
          Filters.where.$and.push({ [element]: { $lt: value } })
          break
        case '<=':
          Filters.where.$and.push({ [element]: { $lte: value } })
          break
        case 'in':
          Filters.where.$and.push({ [element]: { $in: value } })
          break
        case 'nin':
          Filters.where.$and.push({
            [element]: { $not: { $in: value } }
          })
          break
        case 'exists':
          Filters.where.$and.push({ [element]: { $exists: true } })
          break
        case '!exists':
          Filters.where.$and.push({ [element]: { $exists: false } })
          break
        case 'regex':
          Filters.where.$and.push({ [element]: { $regex: value } })
          break
      }
    })

    return Filters
  }

  // /**
  //  *
  //  */
  // public async get(): Promise<OutputDTO[]> {
  //   const query = this.generateTypeOrmQuery()

  //   const result: any = await this.repository.find(query)

  //   let data = this.jsApplySelect(result)

  //   data = await loadRelations({
  //     data,
  //     relations: this.relations,
  //     modelRelations: this.modelRelations,
  //     dataSource: this.dataSource,
  //     provider: 'typeorm',
  //     self: this
  //   })
  //   return data
  // }

  // private async PostProcessResults() {}

  // public async requireById(
  //   id: string,
  //   select?: FluentQuery<ModelDTO>['select'],
  //   include?: FluentQuery<ModelDTO>['include']
  // ): Promise<OutputDTO> {
  //   const query = {
  //     where: {
  //       id,
  //       limit: 1
  //     },
  //     select,
  //     include
  //   } as FluentQuery<ModelDTO>

  //   const generatedQuery = this.generateTypeOrmQuery(query)
  //   const result: any = await this.repository.find(generatedQuery)
  //   let data = this.jsApplySelect(result)

  //   if (!data[0]) {
  //     throw new Error('')
  //   }

  //   return data[0] || null
  // }

  // /**
  //  *
  //  */
  // public async getPaginated(): Promise<PaginatedData<OutputDTO>> {
  //   const response: any = await this.get()

  //   const results: PaginatedData<OutputDTO> = {
  //     current_page: response[0].meta.currentPage,
  //     data: response[0].data,
  //     first_page_url: response[0].meta.firstPageUrl,
  //     next_page_url: response[0].meta.nextPageUrl,
  //     path: response[0].meta.path,
  //     per_page: response[0].meta.itemsPerPage,
  //     prev_page_url: response[0].meta.previousPageUrl,
  //     total: response[0].meta.totalItemCount
  //   }

  //   if (results && results.data && this.selectArray.length > 0) {
  //     results.data = this.jsApplySelect(results.data)
  //     return results
  //   }
  //   return results
  // }

  // /**
  //  *
  //  */
  // public async all(): Promise<OutputDTO[]> {
  //   return this.get()
  // }

  // /**
  //  *
  //  * @param paginator
  //  */
  // public async paginate(
  //   paginator: Paginator
  // ): Promise<PaginatedData<OutputDTO>> {
  //   if (!paginator) {
  //     throw new Error('Paginator cannot be empty')
  //   }
  //   this.paginator = paginator

  //   const response = await this.getPaginated()

  //   return response
  // }

  // /**
  //  *
  //  * Returns the TypeOrm Repository, you can use it
  //  * form more complex queries and to get
  //  * the TypeOrm query builder
  //  *
  //  * @param query
  //  */
  // public raw(): Repository<ModelDTO> {
  //   return this.repository
  // }

  // /**
  //  *
  //  * @param data
  //  */
  // public async insertMany(data: QueryInsert<InputDTO>[]): Promise<OutputDTO[]> {
  //   const inserted = await this.repository.save(
  //     data as unknown as DeepPartial<ModelDTO>,
  //     {
  //       chunk: data.length / 300
  //     }
  //   )
  //   this.reset()
  //   const result = this.jsApplySelect(inserted) as OutputDTO[]
  //   return result
  // }

  // /**
  //  *
  //  * @param param0
  //  */
  // public async clear(): Promise<boolean> {
  //   await this.repository.clear()
  //   return true
  // }

  // /**
  //  *
  //  * @param id
  //  */
  // public async deleteById(id: string): Promise<string> {
  //   const parsedId = this.isMongoDB
  //     ? (new ObjectId(id) as unknown as ObjectID)
  //     : id

  //   await this.repository.delete(parsedId)
  //   this.reset()
  //   return id
  // }

  // /**
  //  *
  //  * @param id
  //  */
  // public async findById(id: string): Promise<OutputDTO> {
  //   const parsedId = this.isMongoDB
  //     ? (new ObjectId(id) as unknown as ObjectID)
  //     : id

  //   const data = await this.repository.findBy({
  //     id: In([parsedId])
  //   } as unknown as FindOptionsWhere<ModelDTO>)

  //   const result = this.jsApplySelect(data) as OutputDTO[]
  //   this.reset()
  //   return result[0]
  // }

  // /**
  //  *
  //  * @param ids
  //  */
  // public async findByIds(ids: string[]): Promise<OutputDTO[]> {
  //   const parsedIds = [...ids]
  //   if (this.isMongoDB) {
  //     parsedIds.map(id => new ObjectId(id) as unknown as ObjectID)
  //   }

  //   const data = await this.repository.findBy({
  //     id: In(parsedIds)
  //   } as unknown as FindOptionsWhere<ModelDTO>)

  //   const result = this.jsApplySelect(data) as OutputDTO[]
  //   return result
  // }

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
   * @param filter
   */
  // TODO order by can have more than 1 element
  private getOrderBy(orderBy: FluentQuery<ModelDTO>['orderBy']) {
    if (!orderBy || orderBy.length === 0) {
      return {}
    }

    const order = {}

    for (const orderElement of orderBy) {
      const flattenOrder = Objects.flatten(orderElement)

      for (const k of Object.keys(flattenOrder)) {
        order[k] = flattenOrder[k]
      }
    }

    return Objects.nest(order)
  }
}
