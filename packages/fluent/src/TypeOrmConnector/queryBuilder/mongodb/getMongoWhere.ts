import { Objects } from '@goatlab/js-utils'
import { ObjectId as BSONObjectID } from 'bson'
import { FindManyOptions } from 'typeorm'
import {
  AnyObject,
  FluentQuery,
  LogicOperator,
  Primitives,
  PrimitivesArray
} from '../../../types'
import { clearEmpties } from '../../util/clearEmpties'
import { extractConditions } from '../../util/extractConditions'

export interface GetTypeOrmMongoWhereParams {
  where?: FluentQuery<AnyObject>['where']
}

interface Condition {
  element: string
  operator: LogicOperator
  value: any
}

// Helper function to normalize MongoDB condition
const normalizeCondition = (condition: Condition): Condition => {
  let { element, operator, value } = condition

  // For MongoDB, we need to convert string IDs to ObjectID instances
  // AND convert the field name from 'id' to '_id'
  if (element === 'id') {
    element = '_id'
    value = (Array.isArray(value)
      ? value.map(v => new BSONObjectID(v as string))
      : new BSONObjectID(value as string)) as unknown as
      | Primitives
      | PrimitivesArray
  }

  return { element, operator, value }
}

// Helper function to build MongoDB filter object
const buildMongoFilter = (operator: LogicOperator, value: any): any => {
  switch (operator) {
    case LogicOperator.Equals:
      return value
    case LogicOperator.IsNot:
      return { $ne: value }
    case LogicOperator.GreaterThan:
      return { $gt: value }
    case LogicOperator.GreaterOrEqualThan:
      return { $gte: value }
    case LogicOperator.LessThan:
      return { $lt: value }
    case LogicOperator.LessOrEqualThan:
      return { $lte: value }
    case LogicOperator.In:
      return { $in: value }
    case LogicOperator.NotIn:
      return { $nin: value }
    case LogicOperator.Exists:
      return { $exists: true }
    case LogicOperator.NotExists:
      return { $exists: false }
    case LogicOperator.Regexp:
      return { $regex: value }
    default:
      return value
  }
}

// Helper function to add condition to filter
const addConditionToFilter = (
  filter: any,
  condition: Condition,
  isOr = false
): void => {
  const { element, operator, value } = normalizeCondition(condition)
  const mongoFilter = buildMongoFilter(operator, value)

  if (operator === LogicOperator.Equals) {
    if (isOr) {
      filter.$or.push({ [element]: { $eq: value } })
    } else {
      filter.$or[0].$and.push({ [element]: { $eq: value } })
    }
  } else if (operator === LogicOperator.IsNot) {
    if (isOr) {
      filter.$or.push({ [element]: { $neq: value } })
    } else {
      filter.$or[0].$and.push({ [element]: { $neq: value } })
    }
  } else if (operator === LogicOperator.NotIn) {
    if (isOr) {
      filter.$or.push({ [element]: { $not: { $in: value } } })
    } else {
      filter.$or[0].$and.push({ [element]: { $not: { $in: value } } })
    }
  } else {
    if (isOr) {
      filter.$or.push({ [element]: mongoFilter })
    } else {
      filter.$or[0].$and.push({ [element]: mongoFilter })
    }
  }
}

/**
 *
 * @param where
 * @returns
 */
export const getMongoWhere = ({
  where
}: GetTypeOrmMongoWhereParams): FindManyOptions['where'] => {
  if (!where || Object.keys(where).length === 0) {
    return {}
  }

  // For simple queries without OR/AND, we can use a simpler structure
  const hasLogicalOperators = where.OR || where.AND

  if (!hasLogicalOperators) {
    // Simple query without logical operators
    const conditions = extractConditions([where])
    const simpleFilter: any = {}

    for (const condition of conditions) {
      const { element, operator, value } = normalizeCondition(condition)
      const filter = buildMongoFilter(operator, value)

      if (operator === LogicOperator.Equals) {
        simpleFilter[element] = value
      } else {
        simpleFilter[element] = filter
      }
    }

    return simpleFilter
  }

  // Complex query with OR/AND operators
  const Filters: { filter: { $or: any[] } } = {
    filter: { $or: [{ $and: [] }] }
  }

  const orConditions = extractConditions(where.OR)
  const andConditions = extractConditions(where.AND)

  const copy = Objects.clone(where)
  if (copy.AND) {
    copy.AND = undefined
  }

  if (copy.OR) {
    copy.OR = undefined
  }

  const rootLevelConditions = extractConditions([copy])

  // Process AND conditions
  for (const condition of andConditions) {
    addConditionToFilter(Filters.filter, condition, false)
  }

  // Process root level conditions (treated as AND)
  for (const condition of rootLevelConditions) {
    addConditionToFilter(Filters.filter, condition, false)
  }

  // Process OR conditions
  for (const condition of orConditions) {
    addConditionToFilter(Filters.filter, condition, true)
  }

  const filtered = clearEmpties(Filters.filter)

  return filtered
}
