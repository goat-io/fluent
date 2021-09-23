const pluralize = require('pluralize')
import Submission from '../../../Fluent/models/Submission'
import Form from '../../../Fluent/models/Form'

const parseRequestedUrl = (url): { formId: string; filter: string } => {
  const formId = url.substring(
    url.lastIndexOf('/form/') + 6,
    url.lastIndexOf('/submission')
  )

  const filter = url.includes('&filter')
    ? decodeURIComponent(
        url.substring(url.lastIndexOf('&filter=') + 8, url.length)
      )
    : '{}'

  return { formId, filter }
}

const search = async (lbQueryUrl: any) => {
  return await Submission({ path: lbQueryUrl.path })
    .remote({ connectorName: 'loopback' })
    .raw({
      fields: lbQueryUrl.filter.fields,
      where: lbQueryUrl.filter.where
    })
    .populate(lbQueryUrl.filter.related)
    .get()
}

interface LoopbackPluginInterface {
  appUrl: string
  loopbackUrl: string
  localForms: any
  submission: any
  form?: any
}
export const loopbackGetPlugin = ({
  appUrl,
  localForms,
  loopbackUrl,
  submission,
  form
}: LoopbackPluginInterface) => {
  return {
    priority: 1,
    request: async request => {
      if (!(request.method === 'GET') || !request.url.includes(appUrl)) {
        return undefined
      }

      if (request.type === 'form') {
        const form = await Form.find({
          path: localForms[request.opts.formio.formId]
        })

        return form.data
      }
    },
    staticRequest: async (request, options) => {
      if (!(request.method === 'GET') || !request.url.includes(appUrl)) {
        return undefined
      }
      const { url } = request
      const { formId, filter } = parseRequestedUrl(url)

      const formPath = localForms[formId]
      let searchString
      let where

      if (url.includes('&where')) {
        where = decodeURIComponent(
          url.substring(
            url.lastIndexOf('&where') + 6,
            url.lastIndexOf('&filter')
          )
        ).replace('=', '')

        if (where.includes('=')) {
          const lastIndex =
            filter === '{}' ? url.length : url.lastIndexOf('&filter=')

          searchString = decodeURIComponent(
            where.substring(where.lastIndexOf('=') + 1, lastIndex)
          )

          where = where.substring(0, where.lastIndexOf('='))
        }
      } else if (url.includes('__regex')) {
        const startIndex = url.lastIndexOf('&')
        const lastIndex = url.lastIndexOf('=')

        searchString = decodeURIComponent(
          url.substring(lastIndex + 1, url.length)
        )

        const searchKey = decodeURIComponent(
          url.substring(startIndex + 1, url.indexOf('__regex'))
        )

        where = `{"${searchKey}": {"like": {{input}}, "options": "si" }}`
      }

      const lbQueryUrl: any = {
        base: loopbackUrl,
        path: formPath,
        formField: pluralize.singular(formPath),
        limit: Number(
          url.substring(
            url.lastIndexOf('?limit=') + 7,
            url.lastIndexOf('&skip')
          )
        ),
        filter,
        where,
        searchString
      }

      const currentValue = submission.data[lbQueryUrl.formField]

      if (
        currentValue === lbQueryUrl.searchString ||
        (Array.isArray(currentValue) &&
          currentValue.join(',') === lbQueryUrl.searchString)
      ) {
        delete lbQueryUrl.where
      }

      // Make the fields searchable
      // TODO we have to erase the search when there is no country selected
      if (lbQueryUrl.searchString && lbQueryUrl.where) {
        lbQueryUrl.where = lbQueryUrl.where.replace(
          /{{input}}/g,
          `"${lbQueryUrl.searchString}"`
        )

        if (submission.data.country && submission.data.country !== '') {
        }
        lbQueryUrl.where = lbQueryUrl.where.replace(
          /{{data.country}}/g,
          `"${submission.data.country}"`
        )
      }

      try {
        if (lbQueryUrl.filter) {
          lbQueryUrl.filter = lbQueryUrl.filter
            ? JSON.parse(lbQueryUrl.filter)
            : undefined
        }
      } catch (error) {
        console.error(
          'Could not parse FILTER one of your resource queries: ',
          formPath,
          url
        )
        return undefined
      }

      try {
        if (lbQueryUrl.where) {
          lbQueryUrl.where = lbQueryUrl.where
            ? JSON.parse(lbQueryUrl.where)
            : undefined
          lbQueryUrl.filter.where = lbQueryUrl.where
        } else {
          if (
            !currentValue ||
            (Array.isArray(currentValue) && currentValue.length === 0) ||
            !lbQueryUrl.searchString
          ) {
            lbQueryUrl.where = {}
          } else {
            lbQueryUrl.where = {
              id: Array.isArray(currentValue)
                ? { inq: currentValue }
                : currentValue
            }
            lbQueryUrl.filter.where = lbQueryUrl.where
          }
        }
      } catch (error) {
        console.log(
          'Could not parse WHERE one of your resource queries: ',
          formPath,
          url
        )
        return undefined
      }

      if (
        form._id === '5f47d05def135f0018b31dbd' &&
        lbQueryUrl.formField === 'provider' &&
        !lbQueryUrl.filter.where
      ) {
        lbQueryUrl.filter.where = {
          or: [
            { id: currentValue },
            { 'data.country': '5f848e0636cf94acce03d4de' }
          ]
        }
      }

      const result = await search(lbQueryUrl)

      return result
    }
  }
}
