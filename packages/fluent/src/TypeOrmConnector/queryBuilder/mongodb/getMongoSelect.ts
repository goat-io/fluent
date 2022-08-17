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
    if (k === 'id') {
      delete selected[k]
      selected['_id'] = 1
      continue
    }
    // this will fail in cases like {
    //   cars : {
    //     idea: true
    //   }
    // }
    // as cars.idea matches .id
    const containsId = k.lastIndexOf('.id')

    if (containsId >= 0 && containsId + 3 === k.length) {
      selected[`${k.replace('.id', '')}._id`] = 1
      delete selected[k]

      continue
    }
    selected[k] = 1
  }

  return selected
}
