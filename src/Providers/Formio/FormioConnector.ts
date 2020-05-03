import to from 'await-to-js'
import axios from 'axios'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import jwtDecode from 'jwt-decode'
import { BaseConnector, IDataElement, GoatConnectorInterface, IGoatExtendedAttributes } from '../../BaseConnector'
import { AuthenticationError } from '../../Helpers/AuthenticationError'
import { Connection } from '../../Helpers/Connection'
import { Event } from '../../Helpers/Event'
import { Objects } from '../../Helpers/Objects'
import { IDeleted, IPaginatedData, IPaginator, ISure } from '../types'
dayjs.extend(isSameOrAfter)

interface IFormioConnector {
  baseEndPoint: string
  token?: string
}

const GoatExtenderAttributes = ['_id', 'owner', 'roles', 'created', 'modified', '_ngram']

export class FormioConnector<T = IDataElement> extends BaseConnector<T> implements GoatConnectorInterface<T> {
  private baseEndPoint: string = ''
  private authToken: string = ''

  constructor({ baseEndPoint, token }: IFormioConnector) {
    super()
    this.baseEndPoint = baseEndPoint
    this.authToken = token
  }
  /**
   *
   */
  public async get(): Promise<(T & IGoatExtendedAttributes)[]> {
    const [error, result] = await to(this.httpGET())

    if (error) {
      console.log(error)
      throw new Error('Error while getting submissions')
    }

    const data: (T & IGoatExtendedAttributes)[] = result.data.map((r) => {
      const response: T & IGoatExtendedAttributes = {
        ...{
          _id: r._id,
          owner: r.owner,
          roles: r.roles,
          created: r.created,
          modified: r.modified
        },
        ...r.data
      }
      return response
    })

    let orderedResults = this.jsApplySelect(data)
    orderedResults = this.jsApplyOrderBy(orderedResults)

    return orderedResults
  }
  /**
   *
   */
  public async all(): Promise<(T & IGoatExtendedAttributes)[]> {
    return this.get()
  }
  /**
   *
   * @param paginator
   */
  public async paginate(paginator: IPaginator): Promise<IPaginatedData<T>> {
    const numberOfRows = await this.numberOfRows()

    this.offset((paginator.page - 1) * paginator.perPage).take(paginator.perPage)

    const results: IPaginatedData<T> = {
      data: await this.get(),
      current_page: paginator.page,
      first_page_url: '',
      prev_page_url: '',
      next_page_url: '',
      per_page: paginator.perPage,
      path: '',
      total: numberOfRows
    }

    return results
  }
  /**
   *
   * @param data
   */
  public async insert(data: T): Promise<T & IGoatExtendedAttributes> {
    const [error, result] = await to(this.httpPOST(data))

    if (error) {
      console.log(error)
      throw new Error('Cannot insert data')
    }
    const response: T & IGoatExtendedAttributes = {
      ...{
        _id: result.data._id,
        owner: result.data.owner,
        roles: result.data.roles,
        created: result.data.created,
        modified: result.data.modified
      },
      ...result.data.data
    }

    return response
  }
  /**
   *
   * @param data
   */
  public async insertMany(data: T[]): Promise<(T & IGoatExtendedAttributes)[]> {
    const insertedElements: (T & IGoatExtendedAttributes)[] = []

    for (const element of data) {
      const goatAttributes = this.getExtendedCreateAttributes()

      const inserted: T & IGoatExtendedAttributes = await this.insert({ ...goatAttributes, ...element })

      insertedElements.push(inserted)
    }

    return insertedElements
  }
  /**
   *
   * @param data
   */
  public async updateById(_id: string, data: T): Promise<T & IGoatExtendedAttributes> {
    if (!_id) {
      throw new Error('Formio connector error. Cannot update a Model without _id key')
    }
    if (_id.includes('_local')) {
      throw new Error('Formio connector error. Cannot update a local document')
    }

    const [error, result] = await to(this.httpPUT(_id, data))

    if (error) {
      console.log(error)
      throw new Error('Cannot insert data')
    }
    const response: T & IGoatExtendedAttributes = result.data
    return response
  }
  /**
   *
   * @param param0
   */

  public async truncate({ sure }: ISure) {
    if (!sure || sure !== true) {
      throw new Error(
        'truncate() method will delete everything!, you must set the "sure" parameter "truncate({sure:true})" to continue'
      )
    }
    const promises = []

    const [error, data] = await to(this.select(['_id']).pluck(['_id']))

    if (error) {
      console.log(error)
      throw new Error('Cannot get remote Model')
    }

    data.forEach((_id: string) => {
      promises.push(this.httpDelete(_id))
    })

    return axios.all(promises)
  }

  /**
   *
   * @param _id
   */
  public async deleteById(_id: string): Promise<string> {
    const [error, removed] = await to(this.httpDelete(_id))

    if (error) {
      console.log(error)
      throw new Error(`FormioConnector: Could not delete ${_id}`)
    }

    return removed.data
  }
  /**
   *
   * @param _id
   */
  public async findById(_id: string): Promise<T & IGoatExtendedAttributes> {
    const [error, data] = await to(this.where(['_id'], '=', _id).first())

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

  private getUrl() {
    const baseUrl = `${this.baseEndPoint}/submission`
    return baseUrl
  }
  private getHeaders() {
    const headers = {}
    let token = {}
    if (typeof localStorage !== 'undefined') {
      token = this.getToken()
    }

    if (this.authToken || this.authToken === '') {
      token = this.authToken
    }

    if (!token) {
      return headers
    }

    const type = this.getTokenType(token)
    headers[type] = token
    return headers
  }
  /**
   *
   * @param url
   */
  private getSpacer(url) {
    return url.substr(url.length - 1) === '&' ? '' : '&'
  }
  /**
   *
   */
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
  /**
   *
   * @param data
   */
  private async httpPOST(data: T) {
    const url = this.getUrl()
    const headers = this.getHeaders()
    const isOnline = await Connection.isOnline()

    if (!isOnline) {
      throw new Error(`Cannot make request post to ${url}.You are not online`)
    }
    return axios.post(url, { data }, { headers })
  }
  /**
   *
   * @param _id
   * @param data
   */
  private async httpPUT(_id: string, data: T) {
    const isOnline = await Connection.isOnline()
    const url = `${this.getUrl()}/${_id}`
    const headers = this.getHeaders()

    if (!isOnline) {
      throw new Error(`Cannot make request post to ${url}.You are not online`)
    }
    return axios.put(url, { data }, { headers })
  }
  /**
   *
   * @param _id
   */
  private httpDelete(_id: string) {
    const headers = this.getHeaders()
    const url = `${this.getUrl()}/${_id}`

    return axios.delete(url, { headers })
  }
  /**
   *
   * @param token
   */
  private getTokenType(token) {
    return token.length > 32 ? 'x-jwt-token' : 'x-token'
  }
  /**
   *
   */
  private getFilters() {
    const filter = this.whereArray

    if (!filter || filter.length === 0) {
      return undefined
    }

    let filterQuery = ''

    filter.forEach((condition) => {
      let valueString = ''

      const element = GoatExtenderAttributes.includes(condition[0]) ? condition[0] : `data.${condition[0]}`
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
  /**
   *
   */
  private getLimit() {
    const limit = '?limit='

    if (!this.limitNumber || this.limitNumber === 0) {
      this.limitNumber = 50
    }

    return `${limit}${this.limitNumber}`
  }
  /**
   *
   */
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

    select = select.map((e) => {
      return e.split(' as ')[0]
    })

    if (!select) {
      return
    }

    select = select.map((e) => {
      return GoatExtenderAttributes.includes(e) ? e : `data.${e}`
    })

    return 'select=' + select.join(',')
  }
}
