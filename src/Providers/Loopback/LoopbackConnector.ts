import { Filter } from '@loopback/repository'
import to from 'await-to-js'
import axios from 'axios'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import pluralize from 'pluralize'
import { BaseConnector, IDataElement, IGoatExtendedAttributes, GoatConnectorInterface } from '../../BaseConnector'
import { Connection } from '../../Helpers/Connection'
import { Errors } from '../../Helpers/Errors'
import { Event } from '../../Helpers/Event'
import { Objects } from '../../Helpers/Objects'
import { IDeleted, IPaginatedData, IPaginator, ISure } from '../types'
dayjs.extend(isSameOrAfter)

interface ILoopbackConnector {
  baseEndPoint: string
  token?: string
}
export class LoopbackConnector<T = IDataElement> extends BaseConnector<T> implements GoatConnectorInterface<T> {
  private baseEndPoint: string = ''
  private authToken: string = ''

  constructor({ baseEndPoint, token }: ILoopbackConnector) {
    super()
    this.baseEndPoint = baseEndPoint
    this.authToken = token
  }
  /**
   *
   */
  public async get(): Promise<(T & IGoatExtendedAttributes)[]> {
    const [error, result]: any = await to(this.httpGET())

    if (error) {
      if (error.response.status === 440) {
        Event.emit('GOAT:SESSION:EXPIRED', {
          data: error,
          text: 'Session expired'
        })

        throw new Error(Errors(error, 'Session has expired.'))
      }
      throw new Error(Errors(error, 'Error while getting submissions'))
    }

    return this.jsApplySelect(result && result.data)
  }

  public async getPaginated(): Promise<IPaginatedData<T>> {
    const [error, response]: any = await to(this.httpGET())

    if (error) {
      if (error.response.status === 440) {
        Event.emit('GOAT:SESSION:EXPIRED', {
          data: error,
          text: 'Session expired'
        })

        throw new Error(Errors(error, 'Session has expired.'))
      }
      throw new Error(Errors(error, 'Error while getting submissions'))
    }

    const results: IPaginatedData<T> = {
      current_page: response[0].meta.currentPage,
      data: response[0].data,
      first_page_url: response[0].meta.firstPageUrl,
      next_page_url: response[0].meta.nextPageUrl,
      path: response[0].meta.path,
      per_page: response[0].meta.itemsPerPage,
      prev_page_url: response[0].meta.previousPageUrl,
      total: response[0].meta.totalItemCount
    }

    if (results && results.data && this.selectArray.length > 0) {
      results.data = this.jsApplySelect(results.data)
      return results
    }
    return results
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
    if (!paginator) {
      throw new Error('Paginator cannot be empty')
    }
    this.paginator = paginator

    const response = await this.getPaginated()

    return response
  }
  /**
   *
   * @param query
   */
  public raw(query: Filter): this {
    if (!query) {
      throw new Error('No query was received')
    }
    this.rawQuery = query
    return this
  }
  /**
   *
   * @param data
   */
  public async insert(data: T): Promise<T & IGoatExtendedAttributes> {
    const [error, result] = await to(this.httpPOST(data))

    if (error) {
      throw new Error('Cannot insert data')
    }
    return result.data
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

    const [error, data] = await to(this.select(this._keys._id).pluck(this._keys._id))

    if (error) {
      console.log(error)
      throw new Error('Cannot get remote Model')
    }

    data.forEach((_id) => {
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

    return removed.data._id
  }
  /**
   *
   * @param _id
   */
  public async findById(_id: string): Promise<T & IGoatExtendedAttributes> {
    const [error, data] = await to(this.where(this._keys._id, '=', _id).first())

    if (error) {
      console.log(error)
      throw new Error('FindById() could not get remote data')
    }

    return data
  }

  public getUrl() {
    const baseUrl = this.baseUrl()
    return `${baseUrl}`
  }
  /**
   *
   */
  public getHeaders() {
    const headers: any = {}
    const token = this.authToken || this.getToken()

    if (!token) {
      return headers
    }

    const type = this.getTokenType(token)
    headers[type] = token
    headers.Authorization = `Bearer ${token}`
    return headers
  }
  /**
   *
   */
  public getPage() {
    const page = 'page='
    if (this.paginator && this.paginator.page) {
      return page + this.paginator.page + '&'
    }

    return ''
  }
  /**
   *
   * @param filter
   */
  public getPaginatorLimit(filter) {
    if (this.paginator && this.paginator.perPage) {
      return { ...filter, limit: this.paginator.perPage }
    }

    return filter
  }
  public getPopulate() {
    const populate = []
    this.populateArray.forEach((relation) => {
      if (typeof relation === 'string') {
        populate.push({ relation })
      } else if (Array.isArray(relation)) {
        relation.forEach((nestedRelation) => {
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
  }
  public async httpGET() {
    let filter: any = {}
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
      const where = filter.where && filter.where.and ? filter.where.and[0] : {}
      filter.where = { ...where, ...this.rawQuery.where }
    }

    filter.where = {
      ...filter.where,
      ...{ deleted: null }
    }

    // Loopback replaces all / by camel case

    if (this.baseEndPoint.includes('/')) {
      this.baseEndPoint = this.baseEndPoint.replace('/', '')
    }

    // Looback replaces all singular words by plural
    this.baseEndPoint = pluralize(this.baseEndPoint)
    const remotePath = Objects.get(() => this.baseEndPoint, undefined)

    // Always limit the amount of request
    url = `${url}/${remotePath}?${page}filter=${encodeURI(JSON.stringify(filter))}`

    const isOnline = true || (await Connection.isOnline())

    if (!isOnline) {
      throw new Error(`Cannot make get request to ${url}.You are not online`)
    }

    return axios.get(url, { headers })
  }
  public async httpPOST(data) {
    const url = this.getUrl()
    delete data.draft
    delete data.redirect
    delete data.syncError
    delete data.trigger

    const headers = this.getHeaders()
    const isOnline = true || (await Connection.isOnline())

    if (!isOnline) {
      throw new Error(`Cannot make request post to ${url}.You are not online`)
    }
    return axios.post(url, data, { headers })
  }
  public async httpPUT(_id: string, data: T) {
    const isOnline = true || (await Connection.isOnline())
    const url = `${this.getUrl()}/${_id}`
    const headers = this.getHeaders()

    if (!isOnline) {
      throw new Error(`Cannot make request post to ${url}.You are not online`)
    }

    return axios.put(url, data, { headers })
  }
  public httpDelete(_id) {
    const headers = this.getHeaders()
    const url = `${this.getUrl()}/${_id}`
    return axios.delete(url, { headers })
  }
  public getTokenType(token) {
    if (token.length > 32) {
      return 'x-jwt-token'
    }
    return 'x-token'
  }
  public async getFilters(filters) {
    const filter = this.whereArray

    if (!filter || filter.length === 0) {
      return filters
    }

    filters.where = { and: [] }

    filter.forEach((condition) => {
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
  }
  public getOrderBy(filter) {
    if (!this.orderByArray || this.orderByArray.length === 0) {
      return filter
    }

    return {
      ...filter,
      order: `${this.orderByArray[0]} ${this.orderByArray[1].toUpperCase()}`
    }
  }
  public getLimit(filter) {
    if (!this.limitNumber || this.limitNumber === 0) {
      this.limitNumber = (this.rawQuery && this.rawQuery.limit) || 50
    }

    return { ...filter, limit: this.limitNumber }
  }
  public getSkip(filter) {
    if (!this.offsetNumber) {
      this.offsetNumber = (this.rawQuery && this.rawQuery.skip) || 0
    }

    return { ...filter, skip: this.offsetNumber }
  }
  public getSelect(filter) {
    let select = this.selectArray

    select = select.map((s) => {
      s = s.split(' as ')[0]
      s = s.includes('_id') ? '_id' : s
      return s
    })

    if (select.find((e) => e.startsWith('data.'))) {
      select.unshift('data')
    }

    if (!select) {
      return filter
    }

    const fields = {}

    select.forEach((e) => {
      fields[e] = true
    })

    return { ...filter, fields }
  }

  private getToken() {
    if (typeof localStorage === 'undefined') {
      return
    }
    const token = localStorage.getItem('formioToken')
    return token
    /*
      if (!token || this.getTokenType(token) === 'x-token') {
        return token
      }
      
      const decodedToken = jwtDecode(token);
      const expDate = dayjs.unix(decodedToken.exp);
      if (dayjs().isSameOrAfter(expDate)) {
        Event.emit({
          name: "GOAT:SESSION:EXPIRED",
          data: expDate,
          text: "Session expired"
        });
        throw new Error("Token has expired.");
      }
      */
    return token
  }
  private baseUrl() {
    if (!this.baseEndPoint) {
      throw new Error(`You did not provide a baseUrl for the Loopback connector`)
    }
    return this.baseEndPoint.replace(/\/+$/, '')
  }
}
