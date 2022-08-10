/**
 * Inspiration: https://github.com/laravel/framework/blob/9.x/src/Illuminate/Database/Eloquent/Model.php
 */
import {
  FindByIdFilter,
  LoadedResult,
  LogicOperator,
  Primitives,
  PrimitivesArray,
  QueryOutput,
  SingleQueryOutput
} from './../types'
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
  MongoRepository,
  DeepPartial,
  FindOptionsWhere,
  FindOptionsRelations
} from 'typeorm'
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

export const getRelationsFromModelGenerator = (
  typeOrmRepo: Repository<any>
) => {
  const relations = {}
  for (const relation of typeOrmRepo.metadata.relations) {
    const pPath = relation.inverseRelation?.joinColumns[0]
    relations[relation.propertyName] = {
      isOneToMany: relation.isOneToMany,
      isManyToOne: relation.isManyToOne,
      isManyToMany: relation.isManyToMany,
      inverseSidePropertyRelationPath: relation.inverseSidePropertyPath,
      inverseSidePropertyPath: pPath?.propertyPath,
      propertyName: relation.propertyName,
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

  private readonly outputSchema: z.ZodType<OutputDTO>

  private readonly entity: any

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

    this.entity = entity

    this.repository = this.dataSource.getRepository(entity)

    this.isMongoDB =
      this.repository.metadata.connection.driver.options.type === 'mongodb'

    if (this.isMongoDB) {
      this.repository = this.dataSource.getMongoRepository(entity)
    }

    const relationShipBuilder = modelGeneratorDataSource.getRepository(entity)

    const { relations } = getRelationsFromModelGenerator(relationShipBuilder)

    this.modelRelations = relations

    this.outputKeys = getOutputKeys(relationShipBuilder) || []
  }

  /**
   * Insert the data object into the database.
   * @param data
   */
  public async insert(data: InputDTO): Promise<OutputDTO> {
    // Validate Input
    const validatedData = this.inputSchema.parse(data)

    // Only Way to Skip the DeepPartial requirement from TypeORm
    let datum = await this.repository.save(
      validatedData as unknown as DeepPartial<ModelDTO>
    )

    if (this.isMongoDB) {
      datum['id'] = datum['id'].toString()
    }

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

    return this.outputSchema.array().parse(
      inserted.map(d => {
        if (this.isMongoDB) {
          d['id'] = d['id'].toString()
        }

        return this.clearEmpties(Objects.deleteNulls(d))
      })
    )
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

  /**
   *
   * Returns the TypeOrm Repository, you can use it
   * form more complex queries and to get
   * the TypeOrm query builder
   *
   * @param query
   */
  public mongoRaw(): MongoRepository<ModelDTO> {
    return this.repository as MongoRepository<ModelDTO>
  }

  public async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO, OutputDTO>> {
    if (this.isMongoDB && query?.include) {
      const mongoRelationResult = this.customMongoRelatedSearch(query)

      return mongoRelationResult as unknown as QueryOutput<
        T,
        ModelDTO,
        OutputDTO
      >
    }

    const generatedQuery = this.generateTypeOrmQuery(query)

    let [found, count] = await this.repository.findAndCount(generatedQuery)

    found.map(d => {
      if (this.isMongoDB) {
        d['id'] = d['id'].toString()
      }

      this.clearEmpties(Objects.deleteNulls(d))
    })

    if (query?.paginated) {
      const paginationInfo: PaginatedData<QueryOutput<T, ModelDTO, OutputDTO>> =
        {
          total: count,
          perPage: query.paginated.perPage,
          currentPage: query.paginated.page,
          nextPage: query.paginated.page + 1,
          firstPage: 1,
          lastPage: Math.ceil(count / query.paginated.perPage),
          prevPage:
            query.paginated.page === 1 ? null : query.paginated.page - 1,
          from: (query.paginated.page - 1) * query.paginated.perPage + 1,
          to: query.paginated.perPage * query.paginated.page,
          data: found as unknown as QueryOutput<T, ModelDTO, OutputDTO>[]
        }

      return paginationInfo as unknown as QueryOutput<T, ModelDTO, OutputDTO>
    }

    if (query?.select) {
      // TODO: validate based on the select properties
      return found as unknown as QueryOutput<T, ModelDTO, OutputDTO>
    }

    // Validate Output against schema
    return this.outputSchema?.array().parse(found) as unknown as QueryOutput<
      T,
      ModelDTO,
      OutputDTO
    >
  }

  private getMongoSelect(select: FluentQuery<ModelDTO>['select']) {
    const selected = Objects.flatten(select || {})

    for (const k of Object.keys(selected)) {
      if (k === 'id') {
        delete selected[k]
        selected['_id'] = 1
        continue
      }
      // this will fail in cases like {
      //   cars : {
      //     idea: true
      //   }
      // }
      // as cars.idea matches .id
      const containsId = k.lastIndexOf('.id')

      if (containsId >= 0 && containsId + 3 === k.length) {
        selected[`${k.replace('.id', '')}._id`] = 1
        delete selected[k]

        continue
      }
      selected[k] = 1
    }

    return selected
  }

  private getMongoLookup(include: FluentQuery<ModelDTO>['include']): any[] {
    if (!include) {
      return []
    }

    const lookUps: any[] = []
    for (const relation of Object.keys(include)) {
      if (this.modelRelations[relation]) {
        const dbRelation = this.modelRelations[relation]

        if (dbRelation.isManyToOne) {
          const localField = dbRelation.joinColumns[0].propertyPath
          lookUps.push({
            $addFields: {
              [`${localField}_object`]: { $toObjectId: `$${localField}` }
            }
          })
          // Include Id in the results as we use it in every fluent query
          lookUps.push({ $addFields: { id: { $toString: '$_id' } } })

          lookUps.push({
            $lookup: {
              from: dbRelation.tableName,
              localField: `${localField}_object`,
              foreignField: '_id',
              as: dbRelation.propertyName,
              pipeline: [
                { $addFields: { id: { $toString: '$_id' } } }
                //{ $limit: 2 }
              ]
            }
          })

          lookUps.push({ $unwind: `$${dbRelation.propertyName}` })
        }

        if (dbRelation.isOneToMany) {
          lookUps.push({ $addFields: { string_id: { $toString: '$_id' } } })
          lookUps.push({ $addFields: { id: { $toString: '$_id' } } })
          lookUps.push({
            $lookup: {
              from: dbRelation.tableName,
              localField: 'string_id',
              foreignField: dbRelation.inverseSidePropertyPath,
              as: dbRelation.propertyName,
              pipeline: [
                { $addFields: { id: { $toString: '$_id' } } }
                //{ $limit: 2 }
              ]
            }
          })
        }

        if (dbRelation.isManyToMany) {
          const relatedTableName = dbRelation.tableName
          const pivotTableName =
            dbRelation.joinColumns[0].relationMetadata.joinTableName
          const pivotForeignField = dbRelation.joinColumns[0].propertyPath
          const inverseForeignField =
            dbRelation.inverseJoinColumns[0].propertyPath

          if (
            !relatedTableName ||
            !pivotTableName ||
            !pivotForeignField ||
            !inverseForeignField
          ) {
            throw new Error(
              `Your many to many relation is not properly set up. Please check both your models and schema for relation: ${relation}`
            )
          }

          lookUps.push({ $addFields: { id: { $toString: '$_id' } } })
          lookUps.push({
            $addFields: { parent_string_id: { $toString: '$_id' } }
          })
          lookUps.push({
            $lookup: {
              from: pivotTableName,
              localField: 'parent_string_id',
              foreignField: pivotForeignField,
              as: dbRelation.propertyName,
              pipeline: [
                // This is the pivot table
                { $addFields: { id: { $toString: '$_id' } } },
                {
                  $addFields: {
                    [`${inverseForeignField}_object`]: {
                      $toObjectId: `$${inverseForeignField}`
                    }
                  }
                },
                // The other side of the relationShip
                {
                  $lookup: {
                    from: relatedTableName,
                    localField: `${inverseForeignField}_object`,
                    foreignField: '_id',
                    pipeline: [
                      { $addFields: { id: { $toString: '$_id' } } }
                      // Here we could add more filters like
                      //{ $limit: 2 }
                    ],
                    as: dbRelation.propertyName
                  }
                },
                { $unwind: `$${dbRelation.propertyName}` },
                // Select (ish)
                {
                  $project: {
                    [dbRelation.propertyName]: `$${dbRelation.propertyName}`,
                    pivot: '$$ROOT'
                  }
                },
                {
                  $replaceRoot: {
                    newRoot: {
                      $mergeObjects: ['$$ROOT', `$${dbRelation.propertyName}`]
                    }
                  }
                },
                { $project: { [dbRelation.propertyName]: 0 } }
                // Here we could add more filters like
                //{ $limit: 2 }
              ]
            }
          })
        }
      }
    }

    return lookUps
  }

  private async customMongoRelatedSearch<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO, OutputDTO>> {
    const where = this.getTypeOrmMongoWhere(query?.where)
    const selected = this.getMongoSelect(query?.select)
    const lookups = this.getMongoLookup(query?.include)

    const aggregate: any[] = [
      {
        $match: where
      }
      //{ $sort: { createdAt: 1 } }
    ]

    if (query?.limit) {
      aggregate.push({ $limit: query.limit! })
    }

    for (const lookup of lookups) {
      aggregate.push(lookup)
    }

    if (selected && Object.keys(selected).length) {
      aggregate.push({
        $project: selected
      })
    }

    let raw = await this.mongoRaw().aggregate(aggregate).toArray()

    return this.outputSchema?.array().parse(raw) as unknown as QueryOutput<
      T,
      ModelDTO,
      OutputDTO
    >
  }

  private generateTypeOrmQuery(query?: FluentQuery<ModelDTO>): FindManyOptions {
    let filter: FindManyOptions = {}

    filter.where = this.isMongoDB
      ? this.getTypeOrmMongoWhere(query?.where)
      : this.getTypeOrmWhere(query?.where)

    filter.take = query?.limit
    filter.skip = query?.offset

    // Pagination
    if (query?.paginated) {
      filter.take = query.paginated.perPage
      filter.skip = (query.paginated?.page - 1) * query?.paginated.perPage
    }

    filter.select = Objects.flatten(query?.select || {})
    filter.order = this.getOrderBy(query?.orderBy)

    // TODO: we will bring the full relation Object, we should be able to filter down properties
    filter.relations = query?.include as FindOptionsRelations<any>

    // filter = this.getPaginatorLimit(filter)
    // const page = this.getPage()

    return filter
  }

  protected getTypeOrmWhere(
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

    const filtered = this.clearEmpties(Filters.where)

    return filtered
  }

  protected getTypeOrmMongoWhere(
    where?: FluentQuery<ModelDTO>['where']
  ): FindManyOptions['where'] {
    if (!where || Object.keys(where).length === 0) {
      return {}
    }

    const Filters: { where: { $or: any[] } } = {
      where: { $or: [{ $and: [] }] }
    }

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
      let { element, operator, value } = condition

      if (element === 'id') {
        element = '_id'

        value = (Array.isArray(value)
          ? value.map(v => Ids.objectID(v) as unknown as ObjectID)
          : (Ids.objectID(
              value as string
            ) as unknown as ObjectID)) as unknown as
          | Primitives
          | PrimitivesArray
      }

      switch (operator) {
        case LogicOperator.equals:
          Filters.where.$or[0].$and.push({ [element]: { $eq: value } })
          break
        case LogicOperator.isNot:
          Filters.where.$or[0].$and.push({ [element]: { $neq: value } })
          break
        case LogicOperator.greaterThan:
          Filters.where.$or[0].$and.push({ [element]: { $gt: value } })
          break
        case LogicOperator.greaterOrEqualThan:
          Filters.where.$or[0].$and.push({ [element]: { $gte: value } })
          break
        case LogicOperator.lessThan:
          Filters.where.$or[0].$and.push({ [element]: { $lt: value } })
          break
        case LogicOperator.lessOrEqualThan:
          Filters.where.$or[0].$and.push({ [element]: { $lte: value } })
          break
        case LogicOperator.in:
          Filters.where.$or[0].$and.push({ [element]: { $in: value } })
          break
        case LogicOperator.notIn:
          Filters.where.$or[0].$and.push({
            [element]: { $not: { $in: value } }
          })
          break
        case LogicOperator.exists:
          Filters.where.$or[0].$and.push({ [element]: { $exists: true } })
          break
        case LogicOperator.notExists:
          Filters.where.$or[0].$and.push({ [element]: { $exists: false } })
          break
        case LogicOperator.regexp:
          Filters.where.$or[0].$and.push({ [element]: { $regex: value } })
          break
      }
    }

    for (const condition of rootLevelConditions) {
      let { element, operator, value } = condition

      if (element === 'id') {
        element = '_id'

        value = (Array.isArray(value)
          ? value.map(v => Ids.objectID(v) as unknown as ObjectID)
          : (Ids.objectID(
              value as string
            ) as unknown as ObjectID)) as unknown as
          | Primitives
          | PrimitivesArray
      }

      switch (operator) {
        case LogicOperator.equals:
          Filters.where.$or[0].$and.push({ [element]: { $eq: value } })
          break
        case LogicOperator.isNot:
          Filters.where.$or[0].$and.push({ [element]: { $neq: value } })
          break
        case LogicOperator.greaterThan:
          Filters.where.$or[0].$and.push({ [element]: { $gt: value } })
          break
        case LogicOperator.greaterOrEqualThan:
          Filters.where.$or[0].$and.push({ [element]: { $gte: value } })
          break
        case LogicOperator.lessThan:
          Filters.where.$or[0].$and.push({ [element]: { $lt: value } })
          break
        case LogicOperator.lessOrEqualThan:
          Filters.where.$or[0].$and.push({ [element]: { $lte: value } })
          break
        case LogicOperator.in:
          Filters.where.$or[0].$and.push({ [element]: { $in: value } })
          break
        case LogicOperator.notIn:
          Filters.where.$or[0].$and.push({
            [element]: { $not: { $in: value } }
          })
          break
        case LogicOperator.exists:
          Filters.where.$or[0].$and.push({ [element]: { $exists: true } })
          break
        case LogicOperator.notExists:
          Filters.where.$or[0].$and.push({ [element]: { $exists: false } })
          break
        case LogicOperator.regexp:
          Filters.where.$or[0].$and.push({ [element]: { $regex: value } })
          break
      }
    }

    for (const condition of orConditions) {
      let { element, operator, value } = condition

      if (element === 'id') {
        element = '_id'

        value = (Array.isArray(value)
          ? value.map(v => Ids.objectID(v) as unknown as ObjectID)
          : (Ids.objectID(
              value as string
            ) as unknown as ObjectID)) as unknown as
          | Primitives
          | PrimitivesArray
      }

      switch (operator) {
        case LogicOperator.equals:
          Filters.where.$or.push({ [element]: { $eq: value } })
          break
        case LogicOperator.isNot:
          Filters.where.$or.push({ [element]: { $neq: value } })
          break
        case LogicOperator.greaterThan:
          Filters.where.$or.push({ [element]: { $gt: value } })
          break
        case LogicOperator.greaterOrEqualThan:
          Filters.where.$or.push({ [element]: { $gte: value } })
          break
        case LogicOperator.lessThan:
          Filters.where.$or.push({ [element]: { $lt: value } })
          break
        case LogicOperator.lessOrEqualThan:
          Filters.where.$or.push({ [element]: { $lte: value } })
          break
        case LogicOperator.in:
          Filters.where.$or.push({ [element]: { $in: value } })
          break
        case LogicOperator.notIn:
          Filters.where.$or.push({
            [element]: { $not: { $in: value } }
          })
          break
        case LogicOperator.exists:
          Filters.where.$or.push({ [element]: { $exists: true } })
          break
        case LogicOperator.notExists:
          Filters.where.$or.push({ [element]: { $exists: false } })
          break
        case LogicOperator.regexp:
          Filters.where.$or.push({ [element]: { $regex: value } })
          break
      }
    }

    const filtered = this.clearEmpties(Filters.where)

    return filtered
  }

  /**
   * PATCH operation
   * @param data
   */
  public async updateById(id: string, data: InputDTO): Promise<OutputDTO> {
    const parsedId = this.isMongoDB
      ? (Ids.objectID(id) as unknown as ObjectID)
      : id

    const idFieldName = this.isMongoDB ? '_id' : 'id'

    const dataToInsert = this.outputKeys.includes('updated')
      ? {
          ...data,
          ...{ updated: new Date() }
        }
      : data

    const validatedData = this.inputSchema.parse(dataToInsert)

    const updateResults = await this.repository.update(id, validatedData)

    if (updateResults.affected === 0) {
      throw new Error('No rows where affected')
    }

    const dbResult = await this.repository.findOneOrFail({
      where: {
        [idFieldName]: parsedId
      } as unknown as FindOptionsWhere<ModelDTO>
    })

    if (this.isMongoDB) {
      dbResult['id'] = dbResult['id'].toString()
    }

    // Validate Output
    return this.outputSchema?.parse(
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
      ? (Ids.objectID(id) as unknown as ObjectID)
      : id

    const idFieldName = this.isMongoDB ? '_id' : 'id'

    const value = await this.repository.findOneOrFail({
      where: {
        [idFieldName]: parsedId
      } as unknown as FindOptionsWhere<ModelDTO>
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

    const updateResults = await this.repository.update(id, validatedData)

    if (updateResults.affected === 0) {
      throw new Error('No rows where affected')
    }

    const val = await this.repository.findOneOrFail({
      where: {
        [idFieldName]: parsedId
      } as unknown as FindOptionsWhere<ModelDTO>
    })

    if (this.isMongoDB) {
      val['id'] = val['id'].toString()
    }

    return this.outputSchema.parse(this.clearEmpties(Objects.deleteNulls(val)))
  }

  public async clear(): Promise<boolean> {
    await this.repository.clear()
    return true
  }

  public loadFirst(query?: FluentQuery<ModelDTO>) {
    // Create a clone of the original class
    // to avoid polluting attributes (relatedQuery)
    const newInstance = this.clone()

    newInstance.setRelatedQuery({
      entity: this.entity,
      repository: this,
      query: {
        ...query,
        limit: 1
      }
    })

    return newInstance as LoadedResult<this>
  }

  public loadById(id: string) {
    // Create a new instance to avoid polluting the original one
    const newInstance = this.clone()

    newInstance.setRelatedQuery({
      entity: this.entity,
      repository: this,
      query: {
        where: {
          id
        }
      } as FluentQuery<ModelDTO>
    })

    return newInstance as LoadedResult<this>
  }

  public async requireById(
    id: string,
    q?: FindByIdFilter<ModelDTO>
  ): Promise<SingleQueryOutput<FindByIdFilter<ModelDTO>, ModelDTO, OutputDTO>> {
    const found = await this.findByIds([id], {
      select: q?.select,
      include: q?.include,
      limit: 1
    })

    found.map(d => {
      if (this.isMongoDB) {
        d['id'] = d['id'].toString()
      }
      this.clearEmpties(Objects.deleteNulls(d))
    })

    if (!found[0]) {
      throw new Error(`Object ${id} not found`)
    }

    return this.outputSchema?.parse(found[0]) as unknown as SingleQueryOutput<
      FindByIdFilter<ModelDTO>,
      ModelDTO,
      OutputDTO
    >
  }

  protected clone() {
    return new (<any>this.constructor)()
  }

  public async findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T
  ): Promise<QueryOutput<T, ModelDTO, OutputDTO>> {
    let data = await this.findMany({
      where: {
        id: {
          in: ids
        }
      },
      limit: q?.limit,
      select: q?.select,
      include: q?.include
    } as any)

    // Validate Output against schema
    return this.outputSchema?.array().parse(data) as unknown as QueryOutput<
      T,
      ModelDTO,
      OutputDTO
    >
  }

  /*


  // /**
  //  *
  //  */
  // public async all(): Promise<OutputDTO[]> {
  //   return this.get()
  // }

  // /**
  //  *
  //  * @param param0
  //  */

  // /**
  //  *
  //  * @param id
  //  */
  // public async deleteById(id: string): Promise<string> {
  //   const parsedId = this.isMongoDB
  //     ? (Ids.objectID(id) as unknown as ObjectID)
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
