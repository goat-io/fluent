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

  const Filters: { filter: { $or: any[] } } = {
    filter: { $or: [{ $and: [] }] }
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
        Filters.filter.$or[0].$and.push({ [element]: { $eq: value } })
        break
      case LogicOperator.isNot:
        Filters.filter.$or[0].$and.push({ [element]: { $neq: value } })
        break
      case LogicOperator.greaterThan:
        Filters.filter.$or[0].$and.push({ [element]: { $gt: value } })
        break
      case LogicOperator.greaterOrEqualThan:
        Filters.filter.$or[0].$and.push({ [element]: { $gte: value } })
        break
      case LogicOperator.lessThan:
        Filters.filter.$or[0].$and.push({ [element]: { $lt: value } })
        break
      case LogicOperator.lessOrEqualThan:
        Filters.filter.$or[0].$and.push({ [element]: { $lte: value } })
        break
      case LogicOperator.in:
        Filters.filter.$or[0].$and.push({ [element]: { $in: value } })
        break
      case LogicOperator.notIn:
        Filters.filter.$or[0].$and.push({
          [element]: { $not: { $in: value } }
        })
        break
      case LogicOperator.exists:
        Filters.filter.$or[0].$and.push({ [element]: { $exists: true } })
        break
      case LogicOperator.notExists:
        Filters.filter.$or[0].$and.push({ [element]: { $exists: false } })
        break
      case LogicOperator.regexp:
        Filters.filter.$or[0].$and.push({ [element]: { $regex: value } })
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
        Filters.filter.$or[0].$and.push({ [element]: { $eq: value } })
        break
      case LogicOperator.isNot:
        Filters.filter.$or[0].$and.push({ [element]: { $neq: value } })
        break
      case LogicOperator.greaterThan:
        Filters.filter.$or[0].$and.push({ [element]: { $gt: value } })
        break
      case LogicOperator.greaterOrEqualThan:
        Filters.filter.$or[0].$and.push({ [element]: { $gte: value } })
        break
      case LogicOperator.lessThan:
        Filters.filter.$or[0].$and.push({ [element]: { $lt: value } })
        break
      case LogicOperator.lessOrEqualThan:
        Filters.filter.$or[0].$and.push({ [element]: { $lte: value } })
        break
      case LogicOperator.in:
        Filters.filter.$or[0].$and.push({ [element]: { $in: value } })
        break
      case LogicOperator.notIn:
        Filters.filter.$or[0].$and.push({
          [element]: { $not: { $in: value } }
        })
        break
      case LogicOperator.exists:
        Filters.filter.$or[0].$and.push({ [element]: { $exists: true } })
        break
      case LogicOperator.notExists:
        Filters.filter.$or[0].$and.push({ [element]: { $exists: false } })
        break
      case LogicOperator.regexp:
        Filters.filter.$or[0].$and.push({ [element]: { $regex: value } })
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
        Filters.filter.$or.push({ [element]: { $eq: value } })
        break
      case LogicOperator.isNot:
        Filters.filter.$or.push({ [element]: { $neq: value } })
        break
      case LogicOperator.greaterThan:
        Filters.filter.$or.push({ [element]: { $gt: value } })
        break
      case LogicOperator.greaterOrEqualThan:
        Filters.filter.$or.push({ [element]: { $gte: value } })
        break
      case LogicOperator.lessThan:
        Filters.filter.$or.push({ [element]: { $lt: value } })
        break
      case LogicOperator.lessOrEqualThan:
        Filters.filter.$or.push({ [element]: { $lte: value } })
        break
      case LogicOperator.in:
        Filters.filter.$or.push({ [element]: { $in: value } })
        break
      case LogicOperator.notIn:
        Filters.filter.$or.push({
          [element]: { $not: { $in: value } }
        })
        break
      case LogicOperator.exists:
        Filters.filter.$or.push({ [element]: { $exists: true } })
        break
      case LogicOperator.notExists:
        Filters.filter.$or.push({ [element]: { $exists: false } })
        break
      case LogicOperator.regexp:
        Filters.filter.$or.push({ [element]: { $regex: value } })
        break
    }
  }

  const filtered = clearEmpties(Filters.filter)

  return filtered
}
