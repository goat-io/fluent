import to from 'await-to-js'
import axios from 'axios'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import jwtDecode from 'jwt-decode'
import pluralize from 'pluralize'
import { Event, Fluent, Interface } from '../../fluent'
import Utilities from './Utilities'
import Connection from './Wrapers/Connection'

dayjs.extend(isSameOrAfter)

export default Interface.compose({
  methods: {
    getToken() {
      if (typeof localStorage === 'undefined') {
        return
      }
      const token = localStorage.getItem('formioToken')
      if (!token || this.getTokenType(token) === 'x-jwt-token') {
        return token
      }

      const decodedToken = jwtDecode(token)
      const expDate = dayjs.unix(decodedToken.exp)
      if (dayjs().isSameOrAfter(expDate)) {
        Event.emit({
          name: 'GOAT:SESSION:EXPIRED',
          data: expDate,
          text: 'Session expired'
        })
        throw new Error('Token has expired.')
      }
      return token
    },
    baseUrl() {
      const { baseUrl, name } = this.connector

      if (!baseUrl) {
        throw new Error(
          `You did not provide a baseUrl for the "${name}" connector`
        )
      }
      return baseUrl.replace(/\/+$/, '')
    },
    async get() {
      if (this.ownerId) {
        this.andWhere('owner', '=', this.ownerId)
      }
      let error
      let result
      ;[error, result] = await to(this.httpGET())

      if (error) {
        if (error.response && error.response.status === 440) {
          Event.emit({
            name: 'GOAT:SESSION:EXPIRED',
            data: error,
            text: 'Session expired'
          })
          throw new Error('Session has expired.')
        }
        throw error
      }

      if (
        result?.data &&
        Object.hasOwn(result.data, 'meta') &&
        this.selectArray.length > 0
      ) {
        result.data.data = this.jsApplySelect(result.data.data)
        return [result.data]
      }

      return this.jsApplySelect(result?.data)
    },
    async all() {
      return this.get()
    },
    async paginate(paginator) {
      if (!paginator) {
        throw new Error('Paginator cannot be empty')
      }
      this.paginator = paginator
      const results = {}
      const response = await this.get()
      if (!response[0]) {
        throw new Error('The query was not paginated')
      }
      results.data = response[0].data
      results.paginator = {
        page: response[0].meta.currentPage,
        rowsPerPage: response[0].meta.itemsPerPage,
        rowsNumber: response[0].meta.totalItemCount
      }

      return results
    },
    raw(query) {
      if (!query) {
        throw new Error('No query was received')
      }
      this.rawQuery = query
      return this
    },
    async insert(data) {
      const result = await this.httpPOST(data)

      return result.data
    },
    async tableView(paginator) {
      const baseUrl = this && this.baseUrl() ? this.baseUrl() : undefined
      const remotePath = Utilities.get(
        () => this.remoteConnection.path,
        undefined
      )
      const form = await this.getForm(baseUrl, remotePath)
      if (!form) {
        throw new Error('Could not find form')
      }

      const components = form.components
      let finalComponents = this.getTableViewComponents(components)
      finalComponents = [
        ...finalComponents,
        'id as _id',
        'modified as HumanUpdated',
        'related'
      ]
      this.select(finalComponents)

      return this.paginate(paginator)
    },
    getTableViewComponents(components) {
      return Utilities.findComponents(components, {
        input: true,
        tableView: true
      })
        .filter(c => !!(c.label !== ''))
        .map(c => `data.${c.key} as ${c.key}`)
    },
    async update(data) {
      if (!data._id) {
        throw new Error(
          'Formio connector error. Cannot update a Model without _id key'
        )
      }
      if (data._id.includes('_local')) {
        throw new Error(
          'Formio connector error. Cannot update a local document'
        )
      }

      const result = await this.httpPUT(data)

      return result.data
    },
    /* async clear({ sure } = {}) {
      if (!sure || sure !== true) {
        throw new Error(
          'Clear() method will delete everything!, you must set the "sure" parameter "clear({sure:true})" to continue'
        );
      }
      let promises = [];

      let [error, data] = await to(this.select("_id").pluck("_id"));

      if (error) {
        console.log(error);
        throw new Error("Cannot get remote Model");
      }

      data.forEach(_id => {
        promises.push(this.httpDelete(_id));
      });

      return axios.all(promises);
    }, */
    async remove(_id) {
      const removed = await this.httpDelete(_id)
      return removed
    },
    /* async find(_id) {
      if (typeof _id !== "string") {
        throw new Error(
          'Formio connector find() method only accepts strings "' +
            typeof _id +
            '" given "' +
            _id +
            '"'
        );
      }
      let [error, data] = await to(this.where("_id", "=", _id).first());

      if (error) {
        console.log(error);
        throw new Error("Find() could not get remote data");
      }

      return data;
    }, */
    async getForm(_baseUrl, path) {
      const Form = Fluent.model({
        properties: {
          name: 'Form',
          config: {
            remote: {
              path: 'form',
              pullForm: true
            }
          }
        }
      })()

      const form = await Form.local().where('data.path', '=', path).first()
      return form.data
    },
    getUrl() {
      const baseUrl = this && this.baseUrl() ? this.baseUrl() : undefined
      const path =
        Utilities.get(() => this.path, undefined) ||
        Utilities.get(() => this.remoteConnection.path, undefined)

      if (!baseUrl) {
        throw new Error('Cannot get remote model. baseUrl was not found')
      }
      if (!path) {
        throw new Error('Cannot get remote model. Path was not found')
      }

      return `${baseUrl}/${path}`
    },
    getHeaders() {
      const headers = {}
      let token = {}
      // Get token from local storage
      token = this.getToken()

      // Overwrite if a token is given in the connector
      if (this.remoteConnection.token || this.remoteConnection.token === '') {
        token = this.remoteConnection.token
      }

      if (!token) {
        return headers
      }

      const type = this.getTokenType(token)
      headers[type] = token
      headers.Authorization = `Bearer ${token}`
      return headers
    },
    getPage() {
      const page = 'page='
      if (this.paginator?.page) {
        return `${page + this.paginator.page}&`
      }

      return ''
    },
    getPaginatorLimit(filter) {
      if (this.paginator?.rowsPerPage) {
        return { ...filter, limit: this.paginator.rowsPerPage }
      }

      return filter
    },
    getPopulate() {
      const populate = []
      this.populateArray.forEach(relation => {
        if (typeof relation === 'string') {
          populate.push({ relation: relation })
        } else if (Array.isArray(relation)) {
          relation.forEach(nestedRelation => {
            if (typeof nestedRelation === 'string') {
              populate.push({ relation: nestedRelation })
            } else if (typeof nestedRelation === 'object') {
              populate.push(nestedRelation)
            }
          })
        } else if (typeof relation === 'object') {
          populate.push(relation)
        }
      })

      return populate
    },
    async httpGET() {
      let filter = {}
      let url = this.baseUrl()
      const headers = this.getHeaders()
      filter = await this.getFilters(filter)
      filter = this.getLimit(filter)
      filter = this.getSkip(filter)
      filter = this.getSelect(filter)
      filter = this.getOrderBy(filter)
      filter = this.getPaginatorLimit(filter)
      const page = this.getPage()
      const populate = this.getPopulate()

      if (this.rawQuery) {
        filter.related = populate || this.rawQuery.populate
        filter.limit = filter.limit || this.rawQuery.limit
        filter.skip = filter.skip || this.rawQuery.skip
        filter.order = filter.order || this.rawQuery.order
        filter.fields = { ...filter.fields, ...this.rawQuery.fields }
        const where = filter.where?.and ? filter.where.and[0] : {}
        filter.where = { ...where, ...this.rawQuery.where }
      }

      filter.where = {
        ...filter.where,
        ...{ deleted: null }
      }

      // Loopback replaces all / by camel case

      if (this.remoteConnection.path.includes('/')) {
        this.remoteConnection.path = this.remoteConnection.path.replace('/', '')
      }

      // Looback replaces all singular words by plural

      this.remoteConnection.path = pluralize(this.remoteConnection.path)
      const remotePath = Utilities.get(
        () => this.remoteConnection.path,
        undefined
      )

      // Always limit the amount of request
      url = `${url}/${remotePath}?${page}filter=${encodeURI(
        JSON.stringify(filter)
      )}`

      const isOnline = true || (await Connection.isOnline())

      if (!isOnline) {
        throw new Error(`Cannot make get request to ${url}.You are not online`)
      }

      return axios.get(url, { headers })
    },
    async httpPOST(data) {
      const url = this.getUrl()

      const headers = this.getHeaders()
      const isOnline = true || (await Connection.isOnline())

      if (!isOnline) {
        throw new Error(`Cannot make request post to ${url}.You are not online`)
      }
      return axios.post(url, data, { headers })
    },
    async httpPUT(data) {
      const isOnline = true || (await Connection.isOnline())
      const url = `${this.getUrl()}/${data._id}`
      const headers = this.getHeaders()

      if (!isOnline) {
        throw new Error(`Cannot make request post to ${url}.You are not online`)
      }

      return axios.put(url, data, { headers })
    },
    httpDelete(_id) {
      const headers = this.getHeaders()
      const url = `${this.getUrl()}/${_id}`
      return axios.delete(url, { headers })
    },
    getTokenType(token) {
      if (token.length > 32) {
        return 'x-jwt-token'
      }
      return 'x-token'
    },
    async getFilters(filters) {
      const filter = this.whereArray

      if (!filter || filter.length === 0) {
        return filters
      }

      filters.where = { and: [] }

      filter.forEach(condition => {
        const element = condition[0]
        const operator = condition[1]
        const value = condition[2]

        switch (operator) {
          case '=':
            filters.where.and.push({ [element]: value })
            break
          case '!=':
            filters.where.and.push({ [element]: { neq: value } })
            break
          case '>':
            filters.where.and.push({ [element]: { gt: value } })
            break
          case '>=':
            filters.where.and.push({ [element]: { gte: value } })
            break
          case '<':
            filters.where.and.push({ [element]: { lt: value } })
            break
          case '<=':
            filters.where.and.push({ [element]: { lte: value } })
            break
          case 'in':
            filters.where.and.push({ [element]: { inq: value } })
            break
          case 'nin':
            filters.where.and.push({ [element]: { nin: value } })
            break
          case 'exists':
            filters.where.and.push({ [element]: { exists: true } })
            break
          case '!exists':
            filters.where.and.push({ [element]: { exists: false } })
            break
          case 'regex':
            filters.where.and.push({ [`data.${element}`]: { regexp: value } })
            break
        }
      })

      return filters
    },
    getOrderBy(filter) {
      if (!this.orderByArray || this.orderByArray.length === 0) {
        return filter
      }

      return {
        ...filter,
        order: `${this.orderByArray[0]} ${this.orderByArray[1].toUpperCase()}`
      }
    },
    getLimit(filter) {
      if (!this.limitNumber || this.limitNumber === 0) {
        this.limitNumber = this.rawQuery?.limit || 50
      }

      return { ...filter, limit: this.limitNumber }
    },
    getSkip(filter) {
      if (!this.offsetNumber) {
        this.offsetNumber = this.rawQuery?.skip || 0
      }

      return { ...filter, skip: this.offsetNumber }
    },
    getSelect(filter) {
      let select = this.selectArray

      select = select.map(s => {
        let field = s.split(' as ')[0]
        field = field.includes('_id') ? 'id' : field
        return field
      })

      if (select.find(e => e.startsWith('data.'))) {
        select.unshift('data')
      }

      if (!select) {
        return filter
      }

      const fields = {}

      select.forEach(e => {
        fields[e] = true
      })

      return { ...filter, fields }
    },
    getRequest(url) {
      const headers = this.getHeaders()
      const baseUrl = this.baseUrl()
      return axios.get(`${baseUrl}${url}`, { headers })
    }
  }
})
