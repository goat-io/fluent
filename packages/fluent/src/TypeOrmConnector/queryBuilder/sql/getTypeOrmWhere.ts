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
  Not
} from 'typeorm'
import { clearEmpties } from '../..//util/clearEmpties'
import { AnyObject, FluentQuery, LogicOperator } from '../../../types'
import { extractConditions } from '../../util/extractConditions'

export interface getTypeOrmWhereParams {
  where?: FluentQuery<AnyObject>['where']
}

/**
 *
 * @param where
 * @returns
 */
export const getTypeOrmWhere = ({
  where
}: getTypeOrmWhereParams): FindManyOptions['where'] => {
  if (!where || Object.keys(where).length === 0) {
    return {}
  }

  // Every element of the array is an OR
  const Filters = { where: [{}] }

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

  const filtered = clearEmpties(Filters.where)

  return filtered
}
