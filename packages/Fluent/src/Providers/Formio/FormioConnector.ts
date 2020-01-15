import to from 'await-to-js'
import axios from 'axios'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import jwtDecode from 'jwt-decode'
import { AuthenticationError } from '../../Helpers/AuthenticationError'
import { Connection } from '../../Helpers/Connection'
import { Event } from '../../Helpers/Event'
import { Objects } from '../../Helpers/Objects'
import { Interface } from '../../Interface'

dayjs.extend(isSameOrAfter)

export default Interface.compose({
  methods: {
    getToken() {
      if (typeof localStorage === 'undefined') {
        return
      }
      const token = localStorage.getItem('formioToken')

      if (!token || this.getTokenType(token) === 'x-token') {
        return token
      }

      const decodedToken = jwtDecode(token)
      const expDate = dayjs.unix(decodedToken.exp)
      if (dayjs().isSameOrAfter(expDate)) {
        Event.emit({
          data: expDate,
          name: 'GOAT:SESSION:EXPIRED',
          text: 'Session expired'
        })
        throw new AuthenticationError('Token has expired.')
      }
      return token
    },
    baseUrl() {
      const { baseUrl, name } = this.connector

      if (!baseUrl) {
        throw new Error(`You did not provide a baseUrl for the "${name}" connector`)
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
        console.log(error)
        throw new Error('Error while getting submissions')
      }

      result = this.jsApplySelect(result && result.data)
      result = this.jsApplyOrderBy(result)

      return result
    },
    async all() {
      return this.get()
    },
    async numberOfRows() {
      let url = this.getUrl()
      const headers = this.getHeaders()
      const filters = this.getFilters()
      const limit = '?limit=1'
      const skip = this.getSkip()
      const order = this.getOrder()
      const select = this.getSelect()
      const spacer = ''

      url = url + spacer + limit
      url = filters ? url + this.getSpacer(url) + filters : url
      url = skip ? url + this.getSpacer(url) + skip : url
      url = order ? url + this.getSpacer(url) + order : url
      url = select ? url + this.getSpacer(url) + select : url

      const isOnline = await Connection.isOnline()

      if (!isOnline) {
        throw new Error(`Cannot make get request to ${url}.You are not online`)
      }

      const response = await axios.get(url, { headers })

      return response.headers['content-range'].split('/')[1]
    },
    async paginate(paginator: any) {
      const numberOfRows = await this.numberOfRows()

      this.offset((paginator.page - 1) * paginator.rowsPerPage).take(paginator.rowsPerPage)

      const results: any = {}
      results.data = await this.get()
      results.paginator = {
        page: paginator.page,
        rowsNumber: numberOfRows,
        rowsPerPage: paginator.rowsPerPage
      }

      return results
    },
    async insert(data, options) {
      if (Array.isArray(data)) {
        return this.ArrayInsert(data, options)
      }

      const [error, result] = await to(this.httpPOST(data))

      if (error) {
        console.log(error)
        throw new Error('Cannot insert data')
      }
      return result.data
    },
    async update(data) {
      if (!data._id) {
        throw new Error('Formio connector error. Cannot update a Model without _id key')
      }
      if (data._id.includes('_local')) {
        throw new Error('Formio connector error. Cannot update a local document')
      }

      const [error, result] = await to(this.httpPUT(data))

      if (error) {
        console.log(error)
        throw new Error('Cannot insert data')
      }
      return result.data
    },
    async clear({ sure } = { sure: false }) {
      if (!sure || sure !== true) {
        throw new Error(
          'Clear() method will delete everything!, you must set the "sure" parameter "clear({sure:true})" to continue'
        )
      }
      const promises = []

      const [error, data] = await to(this.select('_id').pluck('_id'))

      if (error) {
        console.log(error)
        throw new Error('Cannot get remote Model')
      }

      data.forEach(_id => {
        promises.push(this.httpDelete(_id))
      })

      return axios.all(promises)
    },
    async remove(_id) {
      const [error, removed] = await to(this.httpDelete(_id))

      if (error) {
        console.log(error)
        throw new Error(`FormioConnector: Could not delete ${_id}`)
      }

      return removed
    },
    async find(_id) {
      if (typeof _id !== 'string') {
        throw new Error('Formio connector find() method only accepts strings "' + typeof _id + '" given "' + _id + '"')
      }
      const [error, data] = await to(this.where('_id', '=', _id).first())

      if (error) {
        console.log(error)
        throw new Error('Find() could not get remote data')
      }

      return data
    },
    getUrl() {
      const baseUrl = this && this.baseUrl() ? this.baseUrl() : undefined
      let path = Objects().get(() => this.remoteConnection.path, undefined)
      const id = Objects().get(() => this.remoteConnection.id, undefined)
      const pullForm = Objects().get(() => this.remoteConnection.pullForm, undefined)

      if (!pullForm && path) {
        path = !id ? `${path}/submission` : `${path}/submission/${id}`
      }

      if (!baseUrl) {
        throw new Error('Cannot get remote model. baseUrl not defined')
      }

      if (path) {
        return `${baseUrl}/${path}`
      }
      return baseUrl
    },
    getHeaders() {
      const headers = {}
      let token = {}
      if (typeof localStorage !== 'undefined') {
        token = this.getToken()
      }

      if (this.remoteConnection.token || this.remoteConnection.token === '') {
        token = this.remoteConnection.token
      }

      if (!token) {
        return headers
      }

      const type = this.getTokenType(token)
      headers[type] = token
      return headers
    },
    getSpacer(url) {
      return url.substr(url.length - 1) === '&' ? '' : '&'
    },
    async httpGET() {
      let url = this.getUrl()
      const headers = this.getHeaders()
      const filters = this.getFilters()
      const limit = this.getLimit()
      const skip = this.getSkip()
      const order = this.getOrder()
      const select = this.getSelect()
      const spacer = ''

      // Always limit the amount of requests
      url = url + spacer + limit

      url = filters ? url + this.getSpacer(url) + filters : url

      url = skip ? url + this.getSpacer(url) + skip : url

      url = order ? url + this.getSpacer(url) + order : url

      url = select ? url + this.getSpacer(url) + select : url

      const isOnline = await Connection.isOnline()

      if (!isOnline) {
        throw new Error(`Cannot make get request to ${url}.You are not online`)
      }

      return axios.get(url, { headers })
    },
    async httpPOST(data) {
      const url = this.getUrl()
      const headers = this.getHeaders()
      const isOnline = await Connection.isOnline()

      if (!isOnline) {
        throw new Error(`Cannot make request post to ${url}.You are not online`)
      }
      return axios.post(url, data, { headers })
    },
    async httpPUT(data) {
      const isOnline = await Connection.isOnline()
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
    getFilters() {
      const filter = this.whereArray

      if (!filter || filter.length === 0) {
        return undefined
      }

      let filterQuery = ''

      filter.forEach(condition => {
        let valueString = ''
        const element = condition[0]
        const operator = condition[1]
        const value = condition[2]

        switch (operator) {
          case '=':
            filterQuery = filterQuery + element + '=' + value + '&'
            break
          case '!=':
            filterQuery = filterQuery + element + '__ne=' + value + '&'
            break
          case '>':
            filterQuery = filterQuery + element + '__gt=' + value + '&'
            break
          case '>=':
            filterQuery = filterQuery + element + '__gte=' + value + '&'
            break
          case '<':
            filterQuery = filterQuery + element + '__lt=' + value + '&'
            break
          case '<=':
            filterQuery = filterQuery + element + '__lte=' + value + '&'
            break
          case 'in':
            valueString = ''
            value.forEach((val, index, array) => {
              valueString = index === array.length - 1 ? valueString + val : valueString + val + ','
            })
            filterQuery = filterQuery + element + '__in=' + valueString + '&'
            break
          case 'nin':
            valueString = ''
            value.forEach((val, index, array) => {
              valueString = index === array.length - 1 ? valueString + val : valueString + val + ','
            })
            filterQuery = filterQuery + element + '__nin=' + valueString + '&'
            break
          case 'exists':
            filterQuery = filterQuery + element + '__exists=' + true + '&'
            break
          case '!exists':
            filterQuery = filterQuery + element + '__exists=' + false + '&'
            break
          case 'regex':
            filterQuery = filterQuery + element + '__regex=' + value + '&'
            break
        }
      })
      return filterQuery.substring(0, filterQuery.length - 1)
    },
    getLimit() {
      const limit = '?limit='

      if (!this.limitNumber || this.limitNumber === 0) {
        this.limitNumber = 50
      }

      return `${limit}${this.limitNumber}`
    },
    getSkip() {
      const skip = 'skip='

      if (!this.offsetNumber) {
        this.offsetNumber = 0
      }

      return skip + this.offsetNumber
    },
    getOrder() {
      const order = 'sort='
      const or = this.orderByArray[1] === 'DESC' ? '-' : ''
      return order + or + this.orderByArray[0]
    },
    getSelect() {
      let select = this.selectArray

      select = select.map(e => {
        return e.split(' as ')[0]
      })

      if (!select) {
        return
      }

      return 'select=' + select.join(',')
    }
  }
})
