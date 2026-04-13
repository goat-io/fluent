import { Objects } from '@goatlab/js-utils'
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
} from 'typeorm'
import { AnyObject, FluentQuery, LogicOperator } from '../../../types'
import { clearEmpties } from '../..//util/clearEmpties'
import { extractConditions } from '../../util/extractConditions'

export interface GetTypeOrmWhereParams {
  where?: FluentQuery<AnyObject>['where']
}

/**
 *
 * @param where
 * @returns
 */
export const getTypeOrmWhere = ({
  where,
}: GetTypeOrmWhereParams): FindManyOptions['where'] => {
  if (!where || Object.keys(where).length === 0) {
    return {}
  }

  // Check if this is a simple query without AND/OR operators
  const hasLogicalOperators = where.OR || where.AND

  if (!hasLogicalOperators) {
    // Simple query - just process the conditions directly
    const conditions = extractConditions([where])
    const simpleFilter: any = {}

    for (const condition of conditions) {
      const { element, operator, value } = condition

      switch (operator) {
        case LogicOperator.Equals:
          simpleFilter[element] = Equal(value)
          break
        case LogicOperator.IsNot:
          simpleFilter[element] = Not(Equal(value))
          break
        case LogicOperator.GreaterThan:
          simpleFilter[element] = MoreThan(value)
          break
        case LogicOperator.GreaterOrEqualThan:
          simpleFilter[element] = MoreThanOrEqual(value)
          break
        case LogicOperator.LessThan:
          simpleFilter[element] = LessThan(value)
          break
        case LogicOperator.LessOrEqualThan:
          simpleFilter[element] = LessThanOrEqual(value)
          break
        case LogicOperator.In:
          simpleFilter[element] = In(value as string[])
          break
        case LogicOperator.NotIn:
          simpleFilter[element] = Not(In(value as string[]))
          break
        case LogicOperator.Exists:
          simpleFilter[element] = Not(IsNull())
          break
        case LogicOperator.NotExists:
          simpleFilter[element] = IsNull()
          break
        case LogicOperator.Regexp:
        case LogicOperator.Like:
          simpleFilter[element] = Like(value)
          break
      }
    }

    return Objects.nest(simpleFilter)
  }

  // Complex query with OR/AND operators
  const Filters = { where: [{}] }

  const orConditions = extractConditions(where.OR)
  const andConditions = extractConditions(where.AND)

  const copy = Objects.clone(where)
  if (copy.AND) {
    delete copy.AND
  }

  if (copy.OR) {
    delete copy.OR
  }

  const rootLevelConditions = extractConditions([copy])

  for (const condition of andConditions) {
    const { element, operator, value } = condition

    switch (operator) {
      case LogicOperator.Equals:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: Equal(value) },
        })
        break
      case LogicOperator.IsNot:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: Not(Equal(value)) },
        })
        break
      case LogicOperator.GreaterThan:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: MoreThan(value) },
        })
        break
      case LogicOperator.GreaterOrEqualThan:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: MoreThanOrEqual(value) },
        })
        break
      case LogicOperator.LessThan:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: LessThan(value) },
        })
        break
      case LogicOperator.LessOrEqualThan:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: LessThanOrEqual(value) },
        })
        break
      case LogicOperator.In:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: In(value as string[]) },
        })
        break
      case LogicOperator.NotIn:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: Not(In(value as string[])) },
        })
        break
      case LogicOperator.Exists:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: Not(IsNull()) },
        })
        break
      case LogicOperator.NotExists:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: IsNull() },
        })
        break
      case LogicOperator.Regexp:
      case LogicOperator.Like:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: Like(value) },
        })
        break
    }
  }

  for (const condition of rootLevelConditions) {
    const { element, operator, value } = condition

    switch (operator) {
      case LogicOperator.Equals:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: Equal(value) },
        })
        break
      case LogicOperator.IsNot:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: Not(Equal(value)) },
        })
        break
      case LogicOperator.GreaterThan:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: MoreThan(value) },
        })
        break
      case LogicOperator.GreaterOrEqualThan:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: MoreThanOrEqual(value) },
        })
        break
      case LogicOperator.LessThan:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: LessThan(value) },
        })
        break
      case LogicOperator.LessOrEqualThan:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: LessThanOrEqual(value) },
        })
        break
      case LogicOperator.In:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: In(value as string[]) },
        })
        break
      case LogicOperator.NotIn:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: Not(In(value as string[])) },
        })
        break
      case LogicOperator.Exists:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: Not(IsNull()) },
        })
        break
      case LogicOperator.NotExists:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: IsNull() },
        })
        break
      case LogicOperator.Regexp:
      case LogicOperator.Like:
        Filters.where[0] = Objects.nest({
          ...Filters.where[0],
          ...{ [element]: Like(value) },
        })
        break
    }
  }

  for (const condition of orConditions) {
    const { element, operator, value } = condition

    switch (operator) {
      case LogicOperator.Equals:
        Filters.where.push({ [element]: Equal(value) })
        break
      case LogicOperator.IsNot:
        Filters.where.push({ [element]: Not(Equal(value)) })
        break
      case LogicOperator.GreaterThan:
        Filters.where.push({ [element]: MoreThan(value) })
        break
      case LogicOperator.GreaterOrEqualThan:
        Filters.where.push({ [element]: MoreThanOrEqual(value) })
        break
      case LogicOperator.LessThan:
        Filters.where.push({ [element]: LessThan(value) })
        break
      case LogicOperator.LessOrEqualThan:
        Filters.where.push({ [element]: LessThanOrEqual(value) })
        break
      case LogicOperator.In:
        Filters.where.push({ [element]: In(value as string[]) })
        break
      case LogicOperator.NotIn:
        Filters.where.push({ [element]: Not(In(value as string[])) })
        break
      case LogicOperator.Exists:
        Filters.where.push({ [element]: Not(IsNull()) })
        break
      case LogicOperator.NotExists:
        Filters.where.push({ [element]: IsNull() })
        break
      case LogicOperator.Regexp:
      case LogicOperator.Like:
        Filters.where.push({ [element]: Like(value) })
        break
    }
  }

  const filtered = clearEmpties(Filters.where)

  // If there's only one element in the array and no OR conditions were added,
  // return the object directly instead of an array
  if (filtered.length === 1 && orConditions.length === 0) {
    return filtered[0]
  }

  return filtered
}
