import { Objects } from '@goatlab/js-utils'
import { FluentQuery } from '../../../types'

/**
 *
 * @param select
 * @returns
 */
export const getMongoSelect = (select: FluentQuery<any>['select']) => {
  const selected = Objects.flatten(select || {})

  for (const k of Object.keys(selected)) {
    selected[k] = 1
  }

  return selected
}
