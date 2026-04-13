import { Ids, Objects } from '@goatlab/js-utils'
import { Brackets, SelectQueryBuilder } from 'typeorm'
import { AnyObject, FluentQuery, LogicOperator } from '../../../types'
import { extractConditions } from '../../util/extractConditions'

const queryId = Ids.customId(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
)

export interface GetQueryBuilderWhereParams {
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
  queryBuilder,
}: GetQueryBuilderWhereParams): SelectQueryBuilder<any> => {
  if (!where || Object.keys(where).length === 0) {
    return queryBuilder
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

  queryBuilder.andWhere(
    new Brackets(qbAnd => {
      // All AND level conditions (root and AND)
      for (const condition of andConditions) {
        const { element, operator, value } = condition
        const customId = queryId(4)

        switch (operator) {
          case LogicOperator.Equals:
            qbAnd.andWhere(
              `${queryAlias}.${element} = :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.IsNot:
            qbAnd.andWhere(
              `${queryAlias}.${element} != :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.GreaterThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} > :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.GreaterOrEqualThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} >= :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.LessThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} < :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.LessOrEqualThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} <= :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.In:
            qbAnd.andWhere(
              `${queryAlias}.${element} IN :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.NotIn:
            qbAnd.andWhere(
              `${queryAlias}.${element} NOT IN :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.Exists:
            qbAnd.andWhere(`${queryAlias}.${element} IS NOT NULL`)
            break
          case LogicOperator.NotExists:
            qbAnd.andWhere(`${queryAlias}.${element} IS NULL`)
            break
          case LogicOperator.Regexp:
            qbAnd.andWhere(
              `${queryAlias}.${element} LIKE :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
        }
      }

      for (const condition of rootLevelConditions) {
        const { element, operator, value } = condition
        const customId = queryId(4)

        switch (operator) {
          case LogicOperator.Equals:
            qbAnd.andWhere(
              `${queryAlias}.${element} = :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.IsNot:
            qbAnd.andWhere(
              `${queryAlias}.${element} != :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.GreaterThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} > :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.GreaterOrEqualThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} >= :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.LessThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} < :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.LessOrEqualThan:
            qbAnd.andWhere(
              `${queryAlias}.${element} <= :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.In:
            qbAnd.andWhere(
              `${queryAlias}.${element} IN :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.NotIn:
            qbAnd.andWhere(
              `${queryAlias}.${element} NOT IN :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
            )
            break
          case LogicOperator.Exists:
            qbAnd.andWhere(`${queryAlias}.${element} IS NOT NULL`)
            break
          case LogicOperator.NotExists:
            qbAnd.andWhere(`${queryAlias}.${element} IS NULL`)
            break
          case LogicOperator.Regexp:
            qbAnd.andWhere(
              `${queryAlias}.${element} LIKE :${element}_${customId}`,
              {
                [`${element}_${customId}`]: value,
              },
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
              case LogicOperator.Equals:
                qbOr.andWhere(
                  `${queryAlias}.${element} = :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value,
                  },
                )
                break
              case LogicOperator.IsNot:
                qbOr.andWhere(
                  `${queryAlias}.${element} != :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value,
                  },
                )
                break
              case LogicOperator.GreaterThan:
                qbOr.andWhere(
                  `${queryAlias}.${element} > :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value,
                  },
                )
                break
              case LogicOperator.GreaterOrEqualThan:
                qbOr.andWhere(
                  `${queryAlias}.${element} >= :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value,
                  },
                )
                break
              case LogicOperator.LessThan:
                qbOr.andWhere(
                  `${queryAlias}.${element} < :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value,
                  },
                )
                break
              case LogicOperator.LessOrEqualThan:
                qbOr.andWhere(
                  `${queryAlias}.${element} <= :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value,
                  },
                )
                break
              case LogicOperator.In:
                qbOr.andWhere(
                  `${queryAlias}.${element} IN :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value,
                  },
                )
                break
              case LogicOperator.NotIn:
                qbOr.andWhere(
                  `${queryAlias}.${element} NOT IN :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value,
                  },
                )
                break
              case LogicOperator.Exists:
                qbOr.andWhere(`${queryAlias}.${element} IS NOT NULL`)
                break
              case LogicOperator.NotExists:
                qbOr.andWhere(`${queryAlias}.${element} IS NULL`)
                break
              case LogicOperator.Regexp:
                qbOr.andWhere(
                  `${queryAlias}.${element} LIKE :${element}_${customId}`,
                  {
                    [`${element}_${customId}`]: value,
                  },
                )
                break
            }
          }
        }),
      )
    }),
  )

  return queryBuilder
}
