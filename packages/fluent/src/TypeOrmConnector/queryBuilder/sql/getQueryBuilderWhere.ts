import { Ids, Objects } from '@goatlab/js-utils'
import { SelectQueryBuilder, Brackets } from 'typeorm'
import { extractConditions } from '../../util/extractConditions'
import {
  AnyObject,
  FluentQuery,
  LogicOperator,
} from '../../../types'

const queryId = Ids.customId(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
)

export interface getQueryBuilderWhereParams {
  where?: FluentQuery<AnyObject>['where']
  queryBuilder: SelectQueryBuilder<any>
  queryAlias: string
}
/**
 *
 * @param where
 * @returns
 */
export const getQueryBuilderWhere = ({
  where,
  queryAlias,
  queryBuilder
}: getQueryBuilderWhereParams): SelectQueryBuilder<any> => {
  if (!where || Object.keys(where).length === 0) {
    return queryBuilder
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

  queryBuilder.andWhere(
    new Brackets(qbAnd => {
      // All AND level conditions (root and AND)
      for (const condition of andConditions) {
        const { element, operator, value } = condition
        const customId = queryId(4)

        switch (operator) {
          case LogicOperator.equals:
            qbAnd.andWhere(
              `${queryAlias}.${element} = :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.isNot:
            qbAnd.andWhere(
              `${queryAlias}.${element} != :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.greaterThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} > :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.greaterOrEqualThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} >= :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.lessThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} < :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.lessOrEqualThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} <= :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.in:
            qbAnd.andWhere(
              `${queryAlias}.${element} IN :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.notIn:
            qbAnd.andWhere(
              `${queryAlias}.${element} NOT IN :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.exists:
            qbAnd.andWhere(`${queryAlias}.${element} IS NOT NULL`)
            break
          case LogicOperator.notExists:
            qbAnd.andWhere(`${queryAlias}.${element} IS NULL`)
            break
          case LogicOperator.regexp:
            qbAnd.andWhere(
              `${queryAlias}.${element} LIKE :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
        }
      }

      for (const condition of rootLevelConditions) {
        const { element, operator, value } = condition
        const customId = queryId(4)

        switch (operator) {
          case LogicOperator.equals:
            qbAnd.andWhere(
              `${queryAlias}.${element} = :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.isNot:
            qbAnd.andWhere(
              `${queryAlias}.${element} != :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.greaterThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} > :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.greaterOrEqualThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} >= :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.lessThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} < :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.lessOrEqualThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} <= :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.in:
            qbAnd.andWhere(
              `${queryAlias}.${element} IN :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.notIn:
            qbAnd.andWhere(
              `${queryAlias}.${element} NOT IN :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
          case LogicOperator.exists:
            qbAnd.andWhere(`${queryAlias}.${element} IS NOT NULL`)
            break
          case LogicOperator.notExists:
            qbAnd.andWhere(`${queryAlias}.${element} IS NULL`)
            break
          case LogicOperator.regexp:
            qbAnd.andWhere(
              `${queryAlias}.${element} LIKE :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value
              }
            )
            break
        }
      }

      qbAnd.andWhere(
        new Brackets(qbOr => {
          for (const condition of orConditions) {
            const { element, operator, value } = condition
            const customId = queryId(4)

            switch (operator) {
              case LogicOperator.equals:
                qbOr.andWhere(
                  `${queryAlias}.${element} = :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value
                  }
                )
                break
              case LogicOperator.isNot:
                qbOr.andWhere(
                  `${queryAlias}.${element} != :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value
                  }
                )
                break
              case LogicOperator.greaterThan:
                qbOr.andWhere(
                  `${queryAlias}.${element} > :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value
                  }
                )
                break
              case LogicOperator.greaterOrEqualThan:
                qbOr.andWhere(
                  `${queryAlias}.${element} >= :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value
                  }
                )
                break
              case LogicOperator.lessThan:
                qbOr.andWhere(
                  `${queryAlias}.${element} < :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value
                  }
                )
                break
              case LogicOperator.lessOrEqualThan:
                qbOr.andWhere(
                  `${queryAlias}.${element} <= :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value
                  }
                )
                break
              case LogicOperator.in:
                qbOr.andWhere(
                  `${queryAlias}.${element} IN :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value
                  }
                )
                break
              case LogicOperator.notIn:
                qbOr.andWhere(
                  `${queryAlias}.${element} NOT IN :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value
                  }
                )
                break
              case LogicOperator.exists:
                qbOr.andWhere(`${queryAlias}.${element} IS NOT NULL`)
                break
              case LogicOperator.notExists:
                qbOr.andWhere(`${queryAlias}.${element} IS NULL`)
                break
              case LogicOperator.regexp:
                qbOr.andWhere(
                  `${queryAlias}.${element} LIKE :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value
                  }
                )
                break
            }
          }
        })
      )
    })
  )

  return queryBuilder
}
