import { Ids, Objects } from '@goatlab/js-utils'
import { ObjectID } from 'bson'
import { FindManyOptions } from 'typeorm'
import { clearEmpties } from '../../util/clearEmpties'
import {
  AnyObject,
  FluentQuery,
  LogicOperator,
  Primitives,
  PrimitivesArray
} from '../../../types'
import { extractConditions } from '../../util/extractConditions'

export interface getTypeOrmMongoWhereParams {


  where?: FluentQuery<AnyObject>['where']
}

/**
 *
 * @param where
 * @returns
 */
export const getMongoWhere = ({
  where
}: getTypeOrmMongoWhereParams): FindManyOptions['where'] => {
  if (!where || Object.keys(where).length === 0) {
    return {}
  }

  const Filters: { where: { $or: any[] } } = {
    where: { $or: [{ $and: [] }] }
  }

  const orConditions = extractConditions(where['OR'])
  const andConditions = extractConditions(where['AND'])

  const copy = Objects.clone(where)
  if (!!copy['AND']) {
    delete copy['AND']
  }

  if (!!copy['OR']) {
    delete copy['OR']
  }

  const rootLevelConditions = extractConditions([copy])

  for (const condition of andConditions) {
    let { element, operator, value } = condition

    if (element === 'id') {
      element = '_id'

      value = (Array.isArray(value)
        ? value.map(v => Ids.objectID(v) as unknown as ObjectID)
        : (Ids.objectID(value as string) as unknown as ObjectID)) as unknown as
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
        : (Ids.objectID(value as string) as unknown as ObjectID)) as unknown as
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
        : (Ids.objectID(value as string) as unknown as ObjectID)) as unknown as
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

  const filtered = clearEmpties(Filters.where)

  return filtered
}
