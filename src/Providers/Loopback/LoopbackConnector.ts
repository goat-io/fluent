import { Filter } from '@loopback/repository'
import to from 'await-to-js'
import axios from 'axios'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import pluralize from 'pluralize'
import { BaseConnector, IDataElement, IInsertOptions } from '../../BaseConnector'
import { Fluent } from '../../Fluent'
import { Connection } from '../../Helpers/Connection'
import { Errors } from '../../Helpers/Errors'
import { Event } from '../../Helpers/Event'
import { findComponents } from '../../Helpers/Formio/findComponents'
import { Objects } from '../../Helpers/Objects'
import { IDeleted, IPaginatedData, IPaginator, ISure } from '../types'
dayjs.extend(isSameOrAfter)
// import jwtDecode from 'jwt-decode'

export class Loopback extends BaseConnector {
  /**
   *
   */
  public async get(): Promise<IDataElement[]> {
    if (this.ownerId) {
      this.andWhere('owner', '=', this.ownerId)
    }

    const [error, result]: any = await to(this.httpGET())

    if (error) {
      if (error.response.status === 440) {
        Event.emit({
          name: 'GOAT:SESSION:EXPIRED',
          data: error,
          text: 'Session expired'
        })

        throw new Error(Errors(error, 'Session has expired.'))
      }
      throw new Error(Errors(error, 'Error while getting submissions'))
    }

    if (result && result.data && this.selectArray.length > 0) {
      result.data = this.jsApplySelect(result.data)
      return [result.data]
    }

    return this.jsApplySelect(result && result.data)
  }
  /**
   *
   */
  public async all() {
    return this.get()
  }
  /**
   *
   * @param paginator
   */
  public async paginate(paginator: IPaginator): Promise<IPaginatedData> {
    if (!paginator) {
      throw new Error('Paginator cannot be empty')
    }
    this.paginator = paginator

    const response = await this.get()
    if (!response[0]) {
      throw new Error('The query was not paginated')
    }
    const results: IPaginatedData = {
      current_page: response[0].meta.currentPage,
      data: response[0].data,
      first_page_url: response[0].meta.firstPageUrl,
      next_page_url: response[0].meta.nextPageUrl,
      path: response[0].meta.path,
      per_page: response[0].meta.itemsPerPage,
      prev_page_url: response[0].meta.previousPageUrl,
      total: response[0].meta.totalItemCount
    }

    return results
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
  public async insert(data: IDataElement) {
    const [error, result] = await to(this.httpPOST(data))

    if (error) {
      throw new Error('Cannot insert data')
    }
    return result.data
  }
  /**
   *
   * @param paginator
   */
  public async tableView(paginator: IPaginator): Promise<IPaginatedData> {
    const baseUrl = this && this.baseUrl() ? this.baseUrl() : undefined
    const remotePath = Objects.get(() => this.remoteConnection.path, undefined)
    const form = await this.getForm(remotePath)
    if (!form) {
      throw new Error('Could not find form')
    }

    const components = form.components
    let finalComponents = this.getTableViewComponents(components)
    finalComponents = [...finalComponents, '_id as _id', 'modified as HumanUpdated', 'related']
    this.select(finalComponents)

    return this.paginate(paginator)
  }
  /**
   *
   * @param components
   */
  public getTableViewComponents(components) {
    return findComponents(components, {
      input: true,
      tableView: true
    })
      .filter(c => !!(c.label !== ''))
      .map(c => `data.${c.key} as ${c.key}`)
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
  /**
   *
   * @param _id
   */
  public async removeById(_id: string): Promise<IDeleted> {
    const [error, removed] = await to(this.httpDelete(_id))

    if (error) {
      console.log(error)
      throw new Error(`FormioConnector: Could not delete ${_id}`)
    }

    return { deleted: 1 }
  }
  /**
   *
   * @param _id
   */
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
   * @param baseUrl
   * @param path
   */
  public async getForm(path: string) {
    const Config = Fluent.model('Form', {
      remote: {
        path: 'form',
        pullForm: true
      }
    })
    const form = await Config.local()
      .where('data.path', '=', path)
      .first()

    return form.data
  }
  public getUrl() {
    const baseUrl = this && this.baseUrl() ? this.baseUrl() : undefined
    const path = Objects.get(() => this.remoteConnection.path, undefined)

    if (!baseUrl) {
      throw new Error('Cannot get remote model. baseUrl was not found')
    }
    if (!path) {
      throw new Error('Cannot get remote model. Path was not found')
    }

    return `${baseUrl}/${path}`
  }
  public getHeaders() {
    const headers: any = {}
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
  }
  public getPage() {
    const page = 'page='
    if (this.paginator && this.paginator.page) {
      return page + this.paginator.page + '&'
    }

    return ''
  }
  public getPaginatorLimit(filter) {
    if (this.paginator && this.paginator.perPage) {
      return { ...filter, limit: this.paginator.perPage }
    }

    return filter
  }
  public getPopulate() {
    const populate = []
    this.populateArray.forEach(relation => {
      if (typeof relation === 'string') {
        populate.push({ relation })
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

    if (this.remoteConnection.path.includes('/')) {
      this.remoteConnection.path = this.remoteConnection.path.replace('/', '')
    }

    // Looback replaces all singular words by plural

    this.remoteConnection.path = pluralize(this.remoteConnection.path)
    const remotePath = Objects.get(() => this.remoteConnection.path, undefined)

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
  public async httpPUT(data) {
    const isOnline = true || (await Connection.isOnline())
    const url = `${this.getUrl()}/${data._id}`
    const headers = this.getHeaders()
    delete data.draft
    delete data.redirect
    delete data.syncError
    delete data.trigger
    delete data._id

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

    select = select.map(s => {
      s = s.split(' as ')[0]
      s = s.includes('_id') ? '_id' : s
      return s
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
    const { baseUrl, name } = this.connector

    if (!baseUrl) {
      throw new Error(`You did not provide a baseUrl for the "${name}" connector`)
    }
    return baseUrl.replace(/\/+$/, '')
  }
}
