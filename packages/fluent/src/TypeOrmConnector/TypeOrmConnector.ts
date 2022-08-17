/**
 * Inspiration: https://github.com/laravel/framework/blob/9.x/src/Illuminate/Database/Eloquent/Model.php
 */
import {
  LoadedResult,
  LogicOperator,
  Primitives,
  PrimitivesArray,
  QueryIncludeRelation,
  QueryOutput
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
  FindOptionsRelations,
  SelectQueryBuilder,
  Brackets
} from 'typeorm'
import { Ids, Objects, Strings } from '@goatlab/js-utils'
import { BaseConnector, FluentConnectorInterface } from '../BaseConnector'
import { getOutputKeys } from '../outputKeys'
import type { AnyObject, FluentQuery, PaginatedData } from '../types'
import { DataSource } from 'typeorm'
import { modelGeneratorDataSource } from '../generatorDatasource'
import { z } from 'zod'
import { getSelectedKeysFromRawSql } from './util/getSelectedKeysFromRawSql'
import { getMongoWhere } from './queryBuilder/mongodb/getMongoWhere'
import { getRelationsFromModelGenerator } from './util/getRelationsFromModelGenerator'
import { getMongoFindAggregatedQuery } from './queryBuilder/mongodb/getMongoFindAggregatedQuery'
import { extractInclude } from './util/extractInclude'
import { extractOrderBy } from './util/extractOrderBy'
import { getTypeOrmWhere } from './queryBuilder/sql/getTypeOrmWhere'
import { getQueryBuilderWhere } from './queryBuilder/sql/getQueryBuilderWhere'
import { clearEmpties } from './util/clearEmpties'

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
  // CREATE

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
    return this.outputSchema.parse(clearEmpties(Objects.deleteNulls(datum)))
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

        return clearEmpties(Objects.deleteNulls(d))
      })
    )
  }

  // READ

  public async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO, OutputDTO>> {
    const requiresCustomQuery =
      query?.include && Object.keys(query.include).length

    if (this.isMongoDB && requiresCustomQuery) {
      const results = await this.customMongoRelatedFind(query)

      return results
    }

    if (requiresCustomQuery) {
      const customQuery = this.customTypeOrmRelatedFind(query)

      let [result, count] = await customQuery.getManyAndCount()

      console.log(result, count)

      //TODO: We have to validate the results!
      return result as unknown as QueryOutput<T, ModelDTO, OutputDTO>
    }

    // Generate normal TypeORM Query
    const generatedQuery = this.generateTypeOrmQuery(query)

    let [found, count] = await this.repository.findAndCount(generatedQuery)

    found.map(d => {
      if (this.isMongoDB) {
        d['id'] = d['id'].toString()
      }

      clearEmpties(Objects.deleteNulls(d))
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

  // UPDATE

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
    return this.outputSchema?.parse(clearEmpties(Objects.deleteNulls(dbResult)))
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

    return this.outputSchema.parse(clearEmpties(Objects.deleteNulls(val)))
  }

  // DELETE

  /**
   *
   * @param id
   * @returns
   */
  public async deleteById(id: string): Promise<string> {
    const parsedId = this.isMongoDB
      ? (Ids.objectID(id) as unknown as ObjectID)
      : id

    await this.repository.delete(parsedId)

    return id
  }

  /**
   *
   * @returns
   */
  public async clear(): Promise<boolean> {
    await this.repository.clear()
    return true
  }

  // RELATIONS

  /**
   *
   * @param query
   * @returns
   */
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

  /**
   *
   * @param id
   * @returns
   */
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
      } as unknown as FluentQuery<ModelDTO>
    })

    return newInstance as LoadedResult<this>
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

  /**
   * Creates a Clone of the current instance of the class
   * @returns
   */
  protected clone() {
    return new (<any>this.constructor)()
  }

  /**
   *
   * @param query
   * @returns
   */
  private generateTypeOrmQuery(query?: FluentQuery<ModelDTO>): FindManyOptions {
    let filter: FindManyOptions = {}

    filter.where = this.isMongoDB
      ? getMongoWhere({
          where: query?.where
        })
      : getTypeOrmWhere({
          where: query?.where
        })

    filter.take = query?.limit
    filter.skip = query?.offset

    // Pagination
    if (query?.paginated) {
      filter.take = query.paginated.perPage
      filter.skip = (query.paginated?.page - 1) * query?.paginated.perPage
    }

    if (query?.select) {
      const selectQuery = Objects.flatten(query?.select || {})
      filter.select = selectQuery

      if (this.isMongoDB) {
        filter.select = Object.keys(selectQuery)
      }
    }

    if (query?.orderBy) {
      filter.order = extractOrderBy(query.orderBy)
    }

    if (query?.include) {
      filter.relations = extractInclude(
        query.include
      ) as FindOptionsRelations<any>
    }

    return filter
  }
  /**
   *
   * @param query
   * @returns
   */
  private customTypeOrmRelatedFind<T extends FluentQuery<ModelDTO>>(
    query?: T,
    customQueryRecursive?: SelectQueryBuilder<ModelDTO>,
    recursiveRepository?: any,
    alias?: string
  ): SelectQueryBuilder<ModelDTO> {
    const queryAlias =
      alias ||
      customQueryRecursive?.alias ||
      `${this.repository.metadata.tableName}`

    let customQuery =
      customQueryRecursive || this.raw().createQueryBuilder(queryAlias)

    customQuery = getQueryBuilderWhere({
      queryBuilder: customQuery,
      queryAlias,
      where: query?.where
    })

    // customQuery = this.getTypeOrmQueryBuilderSelect(
    //   customQuery,
    //   queryAlias,
    //   query?.select
    // )

    customQuery = this.getTypeOrmQueryBuilderSubqueries({
      queryBuilder: customQuery,
      selfReference: recursiveRepository,
      include: query?.include
    })

    // if (query?.limit) {
    //   customQuery = customQuery.limit(query?.limit)
    // }

    // if (query?.offset) {
    //   customQuery = customQuery.offset(query?.offset)
    // }

    // if (query?.take) {
    //   customQuery = customQuery.take(query?.take)
    // }

    console.log(customQuery.getSql())
    return customQuery
  }

  private getTypeOrmQueryBuilderSelect(
    queryBuilder: SelectQueryBuilder<ModelDTO>,
    queryAlias: string,
    select?: FluentQuery<ModelDTO>['select']
  ): SelectQueryBuilder<ModelDTO> {
    const selected = Objects.flatten(select || {})

    for (const [index, k] of Object.keys(selected).entries()) {
      // TODO: this will fail with nested fields as
      // breed
      // breed.family => breedFamily
      // we must not include breed
      const field = Strings.camel(`${k}`)
      const search = `${queryAlias}.${field}`

      // We can tell if the field is a "related model" by checking
      // THIS for the name of the relation
      const isRelatedField = !!this[field]

      if (isRelatedField) {
        continue
      }

      if (index === 0) {
        queryBuilder.select(search)
        continue
      }

      queryBuilder.addSelect(search)
    }

    return queryBuilder
  }

  private getTypeOrmQueryBuilderSubqueries({
    queryBuilder,
    selfReference,
    include,
    joinType = 'LeftJoin'
  }: {
    queryBuilder: SelectQueryBuilder<ModelDTO>
    selfReference: any
    include?: FluentQuery<ModelDTO>['include']
    joinType?: 'InnerJoin' | 'LeftJoin'
  }): SelectQueryBuilder<ModelDTO> {
    if (!include) {
      return queryBuilder
    }

    for (const relation of Object.keys(include)) {
      // i.e To make this code more understandable
      // table "users" has many "cars"

      // For a first level query, represents "users"
      const self = selfReference || this

      // All information about the users[cars] relation
      const dbRelation = self.modelRelations[relation]

      // The "cars" table repository
      // this will be use for possible recursive queries
      const newSelf = self[relation]()

      // Extract new query for this included relationship
      const fluentRelatedQuery =
        include[relation] === true ? {} : include[relation]

      if (!dbRelation) {
        throw new Error(
          `The relation ${relation} is not properly defined. Check your entity and repository`
        )
      }

      if (dbRelation.isManyToOne) {
        // We now have the opposite "cars" has one "users"

        // "cars"
        // Or users___cars if it comes from a nested relation
        const leftSideTableName = queryBuilder.alias

        // "cars.userId"
        // users___cars.userId (if nested)
        const leftSideForeignKey = `${leftSideTableName}.${dbRelation.joinColumns[0].propertyPath}`

        // Right side considering nested relations
        // users___cars___cars___user

        const rightSideTableName = `${queryBuilder.alias}___${relation}`

        // Double __ for the id because of... WHY NOT?
        const rightSidePrimaryKey = `${rightSideTableName}_id`

        // Now we need to decide which properties we want to select from the related model
        // If the query has some {select: [x]: true}
        const selectedKeysArray = fluentRelatedQuery.select
          ? Object.keys(Objects.flatten(fluentRelatedQuery.select))
          : []
        const selectedKeys = new Set(selectedKeysArray)

        // Filter out selected keys
        const selectableKeys = newSelf.outputKeys
          .map(key => {
            // To avoid selecting keys that are actually
            // relations in Typeorm
            if (typeof newSelf[key] !== 'function') {
              return Strings.camel(`${key}`)
            }
          })
          .filter(k => {
            // If we selected anything, we pass that
            if (selectedKeys.size) {
              return !!k && selectedKeys.has(k)
            }
            // If not, we pass any key that is not nullish
            return !!k
          })

        // Finally we get to do the LEFT JOIN
        queryBuilder.leftJoinAndMapOne(
          `${leftSideTableName}.elephant`,
          qb => {
            qb.from(dbRelation.targetClass, rightSideTableName)

            // Recursive query!
            this.customTypeOrmRelatedFind(fluentRelatedQuery, qb, newSelf)

            // Force select the foreignKey, otherwise LEFT JOIN ON will not work
            qb.addSelect(`"${rightSideTableName}"._id`, rightSidePrimaryKey)

            //One select for each selectable Field
            for (const key of selectableKeys) {
              // skip the foreign key, as it is already selected above
              if (key === 'id') {
                continue
              }

              if (key === 'breed') {
                continue
              }

              // In all other cases, we just follow the format
              qb.addSelect(
                `"${rightSideTableName}".${key}`,
                `${rightSideTableName}.${key}`
              )
            }

            return qb
          },
          // Right side of the JOIN table name
          // The name of the table that comes from the query above!
          rightSideTableName,
          // Keys to JOIN ON
          // This must account for all aliases used above
          `${leftSideForeignKey} = ${rightSidePrimaryKey}`
        )

        const keys = getSelectedKeysFromRawSql(queryBuilder.getSql())

        // Finally we can select all selectable fields, but from the Outer query
        for (const key of keys) {
          if (key === 'breed') {
            continue
          }
          // queryBuilder.addSelect(key)
        }

        queryBuilder.select()

        // DONE
      }

      if (dbRelation.isOneToMany) {
        // "users"
        const leftSideTableName = queryBuilder.alias

        // As it is one to many, primary key will always be "id"
        // users.id
        const leftSidePrimaryKey = `${leftSideTableName}.id`

        // "cars"
        const rightSideTableName = `${relation}`

        // "cars".userId
        const rightSideForeignKey = `${rightSideTableName}.${dbRelation.inverseSidePropertyPath}`

        // Now we need to decide which properties we want to select from the related model
        // If the query has some {select: [x]: true}
        const selectedKeysArray = fluentRelatedQuery.select
          ? Object.keys(Objects.flatten(fluentRelatedQuery.select))
          : []
        const selectedKeys = new Set(
          selectedKeysArray.map(k => `${rightSideTableName}.${k}`)
        )

        const leftJoinBuilder = this.customTypeOrmRelatedFind(
          fluentRelatedQuery,
          this.raw().createQueryBuilder(rightSideTableName),
          newSelf,
          rightSideTableName
        )

        const customLeftJoin = leftJoinBuilder
          .getQuery()
          .split('WHERE')[1]
          .trim()
        const leftJoinParams = leftJoinBuilder.getParameters()

        // Finally we get to do the LEFT JOIN
        queryBuilder.leftJoinAndMapMany(
          `${leftSideTableName}.${relation}`,
          // As we have custom filters we create a new table from this
          // nested Query Builder
          dbRelation.targetClass,
          // Right side of the JOIN table name
          // The name of the table that comes from the nested query above!
          rightSideTableName,

          // Keys to JOIN ON
          `(${rightSideForeignKey} = ${leftSidePrimaryKey} AND ${customLeftJoin} )`,
          leftJoinParams
        )

        // Add all possible queries
        // These queries are "Inner Joins"!
        // queryBuilder = this.customTypeOrmRelatedFind(
        //   fluentRelatedQuery,
        //   queryBuilder,
        //   newSelf,
        //   rightSideTableName
        // )

        // queryBuilder.addSelect(['users.age', ...Array.from(selectedKeys)])

        // Finally we can select all selectable fields, but from the Outer query
        // for (const key of keys) {
        //   if (key.startsWith(`${queryBuilder.alias}___`)) {
        //     queryBuilder.addSelect(key)
        //   }
        // }

        // DONE
      }

      // if (dbRelation.isManyToMany) {
      //   const relatedTableName = dbRelation.tableName
      //   const pivotTableName =
      //     dbRelation.joinColumns[0].relationMetadata.joinTableName
      //   const pivotForeignField = dbRelation.joinColumns[0].propertyPath
      //   const inverseForeignField =
      //     dbRelation.inverseJoinColumns[0].propertyPath

      //   if (
      //     !relatedTableName ||
      //     !pivotTableName ||
      //     !pivotForeignField ||
      //     !inverseForeignField
      //   ) {
      //     throw new Error(
      //       `Your many to many relation is not properly set up. Please check both your models and schema for relation: ${relation}`
      //     )
      //   }

      //   lookUps.push({ $addFields: { id: { $toString: '$_id' } } })
      //   lookUps.push({
      //     $addFields: { parent_string_id: { $toString: '$_id' } }
      //   })
      //   lookUps.push({
      //     $lookup: {
      //       from: pivotTableName,
      //       localField: 'parent_string_id',
      //       foreignField: pivotForeignField,
      //       as: dbRelation.propertyName,
      //       pipeline: [
      //         // This is the pivot table
      //         { $addFields: { id: { $toString: '$_id' } } },
      //         {
      //           $addFields: {
      //             [`${inverseForeignField}_object`]: {
      //               $toObjectId: `$${inverseForeignField}`
      //             }
      //           }
      //         },
      //         // The other side of the relationShip
      //         {
      //           $lookup: {
      //             from: relatedTableName,
      //             localField: `${inverseForeignField}_object`,
      //             foreignField: '_id',
      //             pipeline: [
      //               { $addFields: { id: { $toString: '$_id' } } }
      //               // Here we could add more filters like
      //               //{ $limit: 2 }
      //             ],
      //             as: dbRelation.propertyName
      //           }
      //         },
      //         { $unwind: `$${dbRelation.propertyName}` },
      //         // Select (ish)
      //         {
      //           $project: {
      //             [dbRelation.propertyName]: `$${dbRelation.propertyName}`,
      //             pivot: '$$ROOT'
      //           }
      //         },
      //         {
      //           $replaceRoot: {
      //             newRoot: {
      //               $mergeObjects: ['$$ROOT', `$${dbRelation.propertyName}`]
      //             }
      //           }
      //         },
      //         { $project: { [dbRelation.propertyName]: 0 } }
      //         // Here we could add more filters like
      //         //{ $limit: 2 }
      //       ]
      //     }
      //   })
      // }
    }

    return queryBuilder
  }

  /**
   *
   * @param query
   * @returns
   */
  private async customMongoRelatedFind<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO, OutputDTO>> {
    const where = getMongoWhere({
      where: query?.where
    })

    const aggregate = getMongoFindAggregatedQuery({
      query,
      where,
      modelRelations: this.modelRelations
    })

    let raw = await this.mongoRaw().aggregate(aggregate).toArray()

    return this.outputSchema?.array().parse(raw) as unknown as QueryOutput<
      T,
      ModelDTO,
      OutputDTO
    >
  }
}
