import { Objects } from '@goatlab/js-utils'
import { FluentQuery } from '../../../types'

/**
 *
 * @param select
 * @returns
 */
export const getMongoSelect = (select: FluentQuery<any>['select']) => {
  const flattened = Objects.flatten(select || {})
  const selected: Record<string, number> = {}

  for (const k of Object.keys(flattened)) {
    selected[k] = 1
  }

  return selected
}
