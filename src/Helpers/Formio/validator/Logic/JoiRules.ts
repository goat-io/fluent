const vm = require('vm')
const Joi = require('joi')
import * as _ from 'lodash'
import util from '../utils'
const FormioUtils = require('formiojs/utils').default
const request = require('request-promise-native')
const cache = require('memory-cache')

import { Log } from '../../../../Log/Logger'
import { checkConditional } from './conditionalCheck'

export const getRules = (type: any) => [
  {
    name: 'custom',
    params: {
      component: Joi.any(),
      data: Joi.any()
    },
    validate(params: any, value: any, state: any, options: any): any {
      const component = params.component
      const data = params.data
      let row = state.parent
      let valid = true

      if (!_.isArray(row)) {
        row = [row]
      }

      // If a component has multiple rows of data, e.g. Datagrids, validate each row of data on the backend.
      for (let b = 0; b < row.length; b++) {
        const _row = row[b]

        // Try a new sandboxed validation.
        try {
          // Replace with variable substitutions.
          const replace = /({{\s{0,}(.*[^\s]){1}\s{0,}}})/g
          component.validate.custom = component.validate.custom.replace(
            replace,
            (match: any, $1: any, $2: any) => _.get(data, $2)
          )

          // Create the sandbox.
          const sandbox: any = vm.createContext({
            input: _.isObject(_row)
              ? util.getValue({ data: _row }, component.key)
              : _row,
            data,
            row: _row,
            scope: { data },
            component,
            valid
          })

          // Execute the script.
          const script: any = new vm.Script(component.validate.custom)
          script.runInContext(sandbox, {
            timeout: 100
          })
          valid = sandbox.valid
        } catch (err) {
          // Say this isn't valid based on bad code executed...
          valid = err.toString()
        }

        // If there is an error, then set the error object and break from iterations.
        if (valid !== true) {
          return Joi.createError(
            `${type}.custom`,
            { message: valid },
            state,
            options
          )
        }
      }

      return value // Everything is OK
    }
  },
  {
    name: 'json',
    params: {
      component: Joi.any(),
      data: Joi.any()
    },
    validate(params: any, value: any, state: any, options: any): any {
      const component = params.component
      const data = params.data
      let row = state.parent
      let valid = true

      if (!_.isArray(row)) {
        row = [row]
      }

      // If a component has multiple rows of data, e.g. Datagrids, validate each row of data on the backend.
      for (let b = 0; b < row.length; b++) {
        const _row = row[b]

        try {
          valid = util.jsonLogic.apply(component.validate.json, {
            data,
            row: _row
          })
        } catch (err) {
          valid = err.message
        }

        // If there is an error, then set the error object and break from iterations.
        if (valid !== true) {
          return Joi.createError(
            `${type}.json`,
            { message: valid },
            state,
            options
          )
        }
      }

      return value // Everything is OK
    }
  },
  {
    name: 'hidden',
    params: {
      component: Joi.any(),
      data: Joi.any()
    },
    validate(params: any, value: any, state: any, options: any): any {
      // If we get here than the field has thrown an error.
      // If we are hidden, sanitize the data and return true to override the error.
      // If not hidden, return an error so the original error remains on the field.

      const component = params.component
      const data = params.data
      const row = state.parent

      const isVisible = checkConditional(component, row, data, true)

      if (isVisible) {
        return value
      }

      return Joi.createError(
        `${type}.hidden`,
        { message: 'hidden with value' },
        state,
        options
      )
    }
  },
  {
    name: 'maxWords',
    params: {
      maxWords: Joi.any()
    },
    validate(params: any, value: any, state: any, options: any): any {
      if (value.trim().split(/\s+/).length <= parseInt(params.maxWords, 10)) {
        return value
      }

      return Joi.createError(
        `${type}.maxWords`,
        { message: 'exceeded maximum words.' },
        state,
        options
      )
    }
  },
  {
    name: 'minWords',
    params: {
      minWords: Joi.any()
    },
    validate(params: any, value: any, state: any, options: any): any {
      if (value.trim().split(/\s+/).length >= parseInt(params.minWords, 10)) {
        return value
      }

      return Joi.createError(
        `${type}.minWords`,
        { message: 'does not have enough words.' },
        state,
        options
      )
    }
  },
  {
    name: 'select',
    params: {
      component: Joi.any(),
      submission: Joi.any(),
      token: Joi.any(),
      async: Joi.any(),
      requests: Joi.any()
    },
    validate(params: any, value: any, state: any, options: any) {
      // Empty values are fine.
      if (!value) {
        return value
      }

      const component = params.component
      const submission = params.submission
      const token = params.token
      const async = params.async
      const requests = params.requests

      // Initialize the request options.
      const requestOptions: any = {
        url: _.get(component, 'validate.select'),
        method: 'GET',
        qs: {},
        json: true,
        headers: {}
      }

      // If the url is a boolean value.
      if (util.isBoolean(requestOptions.url)) {
        requestOptions.url = util.boolean(requestOptions.url)
        if (!requestOptions.url) {
          return value
        }

        if (component.dataSrc !== 'url') {
          return value
        }

        if (!component.data.url || !component.searchField) {
          return value
        }

        // Get the validation url.
        requestOptions.url = component.data.url

        // Add the search field.
        requestOptions.qs[component.searchField] = value

        // Add the filters.
        if (component.filter) {
          requestOptions.url +=
            (!requestOptions.url.includes('?') ? '?' : '&') + component.filter
        }

        // If they only wish to return certain fields.
        if (component.selectFields) {
          requestOptions.qs.select = component.selectFields
        }
      }

      if (!requestOptions.url) {
        return value
      }

      // Make sure to interpolate.
      requestOptions.url = FormioUtils.interpolate(requestOptions.url, {
        data: submission.data
      })

      // Set custom headers.
      if (component.data && component.data.headers) {
        _.each(component.data.headers, (header: any) => {
          if (header.key) {
            requestOptions.headers[header.key] = header.value
          }
        })
      }

      // Set form.io authentication.
      if (component.authenticate && token) {
        requestOptions.headers['x-jwt-token'] = token
      }

      async.push(
        new Promise((resolve: any, reject: any) => {
          /* eslint-disable prefer-template */
          const cacheKey =
            `${requestOptions.method}:${requestOptions.url}?` +
            Object.keys(requestOptions.qs)
              .map(key => key + '=' + requestOptions.qs[key])
              .join('&')
          /* eslint-enable prefer-template */
          const cacheTime: any = 3 * 60 * 60 * 1000

          // Check if this request was cached
          const result: any = cache.get(cacheKey)
          if (result !== null) {
            Log.info(`${cacheKey}, hit!`)
            // Null means no cache hit but is also used as a success callback which we are faking with true here.
            if (result === true) {
              return resolve(null)
            } else {
              return resolve(result)
            }
          }
          Log.info(`${cacheKey}, miss`)

          // Us an existing promise or create a new one.
          requests[cacheKey] = requests[cacheKey] || request(requestOptions)

          requests[cacheKey]
            .then((body: any) => {
              if (!body || !body.length) {
                const error = {
                  message: `"${value}" for "${
                    component.label || component.key
                  }" is not a valid selection.`,
                  path: state.path,
                  type: 'any.select'
                }
                cache.put(cacheKey, error, cacheTime)
                return resolve(error)
              }

              cache.put(cacheKey, true, cacheTime)
              return resolve(null)
            })
            .catch((result: any) => {
              const error = {
                message: `Select validation error: ${result.error}`,
                path: state.path,
                type: 'any.select'
              }
              cache.put(cacheKey, error, cacheTime)
              return resolve(error)
            })
        })
      )

      return value
    }
  },
  {
    name: 'distinct',
    params: {
      component: Joi.any(),
      submission: Joi.any(),
      model: Joi.any(),
      async: Joi.any()
    },
    validate(params: any, value: any, state: any, options: any) {
      const { component, submission, model, async } = params
      const path: any = `data.${state.path.join('.')}`
      // Allow empty.
      if (!value || _.isEmpty(value)) {
        return value
      }
      // Get the query.
      const query: any = { form: util.idToBson(submission.form) }
      if (_.isString(value)) {
        query[path] = { $regex: `${util.escapeRegExp(value)}`, $options: 'i' }
      } else if (
        /* eslint-disable  */
        !_.isString(value) &&
        value.hasOwnProperty('address_components') &&
        value.hasOwnProperty('place_id')
      ) {
        query[`${path}.place_id`] = {
          $regex: new RegExp(`^${util.escapeRegExp(value.place_id)}$`),
          $options: 'i'
        }
      }
      /* eslint-enable  */
      // Compare the contents of arrays vs the order.
      else if (_.isArray(value)) {
        query[path] = { $all: value }
      } else if (_.isObject(value)) {
        query[path] = { $eq: value }
      }

      // Only search for non-deleted items.
      // eslint-disable-next-line no-prototype-builtins
      if (!query.hasOwnProperty('deleted')) {
        query.deleted = { $eq: null }
      }

      // Validate if the submission is unique
      async.push(
        new Promise(resolve => {
          // Try to find an existing value within the form.
          model.findOne(query, (err: any, result: any) => {
            if (err) {
              return resolve({
                message: err,
                path: state.path,
                type: 'any.unique'
              })
            }
            if (
              result &&
              result._id &&
              submission._id &&
              result._id.toString() === submission._id
            ) {
              // This matches the current submission which is allowed.
              return resolve(null)
            }

            if (result) {
              return resolve({
                message: `"${component.label}" must be unique.`,
                path: state.path,
                type: 'any.unique'
              })
            }
            return resolve(null)
          })
        })
      )

      return value // Everything is OK
    }
  }
]
