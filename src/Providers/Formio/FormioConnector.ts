import to from 'await-to-js'
import axios from 'axios'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import jwtDecode from 'jwt-decode'
import { BaseConnector, IDataElement } from '../../BaseConnector'
import { AuthenticationError } from '../../Helpers/AuthenticationError'
import { Connection } from '../../Helpers/Connection'
import { Event } from '../../Helpers/Event'
import { Objects } from '../../Helpers/Objects'
import { IDeleted, IPaginatedData, IPaginator, ISure } from '../types'
dayjs.extend(isSameOrAfter)

export class FormioConnector extends BaseConnector {
  /**
   *
   */
  public async get(): Promise<IDataElement[]> {
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
    const data: IDataElement[] = result
    return data
  }
  /**
   *
   */
  public async all(): Promise<IDataElement[]> {
    return this.get()
  }
  /**
   *
   * @param paginator
   */
  public async paginate(paginator: IPaginator): Promise<IPaginatedData> {
    const numberOfRows = await this.numberOfRows()

    this.offset((paginator.page - 1) * paginator.perPage).take(paginator.perPage)

    const results: any = {}
    results.data = await this.get()
    results.paginator = {
      page: paginator.page,
      rowsNumber: numberOfRows,
      rowsPerPage: paginator.perPage
    }

    return results
  }
  /**
   *
   * @param data
   */
  public async insert(data: IDataElement) {
    if (Array.isArray(data)) {
      return this.ArrayInsert(data, {})
    }

    const [error, result] = await to(this.httpPOST(data))

    if (error) {
      console.log(error)
      throw new Error('Cannot insert data')
    }
    return result.data
  }
  /**
   *
   * @param data
   */
  public async update(data: IDataElement): Promise<IDataElement> {
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
  }
  /**
   *
   * @param param0
   */
  public async clear({ sure }: ISure) {
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
  }
  public async removeById(_id: string): Promise<IDeleted> {
    const [error, removed] = await to(this.httpDelete(_id))

    if (error) {
      console.log(error)
      throw new Error(`FormioConnector: Could not delete ${_id}`)
    }

    return { deleted: 1 }
  }
  public async findById(_id: string): Promise<IDataElement> {
    const [error, data] = await to(this.where('_id', '=', _id).first())

    if (error) {
      console.log(error)
      throw new Error('Find() could not get remote data')
    }

    return data
  }
  /**
   *
   */
  private async numberOfRows() {
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
  }

  private getToken() {
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
  }
  private baseUrl() {
    const { baseUrl, name } = this.connector

    if (!baseUrl) {
      throw new Error(`You did not provide a baseUrl for the "${name}" connector`)
    }
    return baseUrl.replace(/\/+$/, '')
  }
  private getUrl() {
    const baseUrl = this && this.baseUrl() ? this.baseUrl() : undefined
    let path = Objects.get(() => this.remoteConnection.path, undefined)
    const id = Objects.get(() => this.remoteConnection.id, undefined)
    const pullForm = Objects.get(() => this.remoteConnection.pullForm, undefined)

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
  }
  private getHeaders() {
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
  }
  private getSpacer(url) {
    return url.substr(url.length - 1) === '&' ? '' : '&'
  }
  private async httpGET() {
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
  }
  private async httpPOST(data) {
    const url = this.getUrl()
    const headers = this.getHeaders()
    const isOnline = await Connection.isOnline()

    if (!isOnline) {
      throw new Error(`Cannot make request post to ${url}.You are not online`)
    }
    return axios.post(url, data, { headers })
  }
  private async httpPUT(data) {
    const isOnline = await Connection.isOnline()
    const url = `${this.getUrl()}/${data._id}`
    const headers = this.getHeaders()

    if (!isOnline) {
      throw new Error(`Cannot make request post to ${url}.You are not online`)
    }
    return axios.put(url, data, { headers })
  }
  private httpDelete(_id) {
    const headers = this.getHeaders()
    const url = `${this.getUrl()}/${_id}`

    return axios.delete(url, { headers })
  }
  private getTokenType(token) {
    return token.length > 32 ? 'x-jwt-token' : 'x-token'
  }
  private getFilters() {
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
  }
  private getLimit() {
    const limit = '?limit='

    if (!this.limitNumber || this.limitNumber === 0) {
      this.limitNumber = 50
    }

    return `${limit}${this.limitNumber}`
  }
  private getSkip() {
    const skip = 'skip='

    if (!this.offsetNumber) {
      this.offsetNumber = 0
    }

    return skip + this.offsetNumber
  }
  private getOrder() {
    const order = 'sort='
    const or = this.orderByArray[1] === 'DESC' ? '-' : ''
    return order + or + this.orderByArray[0]
  }
  private getSelect() {
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
