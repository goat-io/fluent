import axios from 'axios'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import to from 'await-to-js'
import type {
  Filter,
  DaoOutput,
  BaseDataElement,
  PaginatedData,
  Paginator,
  Sure
} from '@goatlab/fluent'
import { BaseConnector, FluentConnectorInterface } from '@goatlab/fluent'

dayjs.extend(isSameOrAfter)

interface ILoopbackConnector {
  baseEndPoint: string
  token?: string
  setToken?: () => Promise<string>
}
export class LoopbackConnector<
    ModelDTO = BaseDataElement,
    InputDTO = ModelDTO,
    OutputDTO = ModelDTO
  >
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements FluentConnectorInterface<InputDTO, DaoOutput<InputDTO, OutputDTO>>
{
  private baseEndPoint = ''

  private authToken = ''

  private setToken: () => Promise<string>

  constructor({ baseEndPoint, token, setToken }: ILoopbackConnector) {
    super()
    this.baseEndPoint = baseEndPoint
    this.authToken = token
    this.setToken = setToken
  }

  /**
   *
   */
  public async get(): Promise<DaoOutput<InputDTO, OutputDTO>[]> {
    const result: any = await this.httpGET()

    const data = this.jsApplySelect(result.data)
    this.reset()

    return data
  }

  public async getPaginated(): Promise<PaginatedData<InputDTO>> {
    const [error, response]: any = await to(this.httpGET())

    if (error) {
      throw error
    }

    const results: PaginatedData<InputDTO> = {
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
    this.reset()
    return results
  }

  /**
   *
   */
  public async all(): Promise<DaoOutput<InputDTO, OutputDTO>[]> {
    return this.get()
  }

  /**
   *
   * @param filter
   */
  public async find(filter: Filter): Promise<DaoOutput<InputDTO, OutputDTO>[]> {
    return this.get()
  }

  /**
   *
   * @param paginator
   */
  public async paginate(
    paginator: Paginator
  ): Promise<PaginatedData<InputDTO>> {
    if (!paginator) {
      throw new Error('Paginator cannot be empty')
    }
    this.paginator = paginator

    const response = await this.getPaginated()
    this.reset()
    return response
  }

  /**
   *
   * @param query
   */
  public raw(query: any): this {
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
  public async insert(data: InputDTO): Promise<DaoOutput<InputDTO, OutputDTO>> {
    const [error, result] = await to(this.httpPOST(data))

    if (error) {
      throw new Error('Cannot insert data')
    }
    this.reset()
    return result.data
  }

  /**
   *
   * @param data
   */
  public async insertMany(
    data: InputDTO[]
  ): Promise<DaoOutput<InputDTO, OutputDTO>[]> {
    const insertedElements: DaoOutput<InputDTO, OutputDTO>[] = []

    for (const element of data) {
      const goatAttributes = this.getExtendedCreateAttributes()

      const inserted: DaoOutput<InputDTO, OutputDTO> = await this.insert({
        ...goatAttributes,
        ...element
      })

      insertedElements.push(inserted)
    }
    this.reset()
    return insertedElements
  }

  /**
   *
   * @param data
   */
  public async updateById(
    id: string,
    data: InputDTO
  ): Promise<DaoOutput<InputDTO, OutputDTO>> {
    if (!id) {
      throw new Error(
        'Formio connector error. Cannot update a Model without id key'
      )
    }
    if (id.includes('_local')) {
      throw new Error('Formio connector error. Cannot update a local document')
    }

    const [error, result] = await to(this.httpPatch(id, data))

    if (error) {
      console.log(error)
      throw new Error('Cannot insert data')
    }
    this.reset()
    return result.data
  }

  /**
   *
   * @param param0
   */
  public async clear({ sure }: Sure) {
    /*
    if (!sure || sure !== true) {
      throw new Error(
        'Clear() method will delete everything!, you must set the "sure" parameter "clear({sure:true})" to continue'
      )
    }
    const promises = []

    const [error, data] = await to(
      this.select(this._keys.id).pluck(this._keys.id)
    )

    if (error) {
      console.log(error)
      throw new Error('Cannot get remote Model')
    }

    data.forEach(id => {
      promises.push(this.httpDelete(id))
    })

    return axios.all(promises)
    */
  }

  /**
   *
   * @param id
   */
  public async deleteById(id: string): Promise<string> {
    const [error, removed] = await to(this.httpDelete(id))

    if (error) {
      console.log(error)
      throw new Error(`FormioConnector: Could not delete ${id}`)
    }
    this.reset()
    return removed.data.id
  }

  /**
   *
   * @param id
   */
  public async findById(id: string): Promise<DaoOutput<InputDTO, OutputDTO>> {
    const url = this.baseUrl()
    const headers = await this.getHeaders()

    const [error, httpCall] = await to(axios.get(`${url}/${id}`, { headers }))

    if (error) {
      console.log(error)
      throw new Error('FindById() could not get remote data')
    }
    const { data } = httpCall
    this.reset()
    return data
  }

  public getUrl() {
    const baseUrl = this.baseUrl()
    return `${baseUrl}`
  }

  /**
   *
   */
  public async getHeaders(): Promise<Record<string, any>> {
    const headers: Record<string, any> = {}
    const token =
      (this.setToken && (await this.setToken())) ||
      this.authToken ||
      this.getToken()

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
      return `${page + this.paginator.page}&`
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
    const headers = await this.getHeaders()
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

    // Loopback replaces all / by camel case

    // if (this.baseEndPoint.includes('/')) {
    //   this.baseEndPoint = this.baseEndPoint.replace('/', '')
    //  }

    // Looback replaces all singular words by plural
    // this.baseEndPoint = pluralize(this.baseEndPoint)

    // Always limit the amount of request
    url = `${url}?${page}filter=${encodeURI(JSON.stringify(filter))}`

    const isOnline = true

    if (!isOnline) {
      throw new Error(`Cannot make get request to ${url}.You are not online`)
    }

    return axios.get(url, { headers })
  }

  /**
   *
   * @param data
   */
  public async httpPOST(data) {
    const url = this.getUrl()
    delete data.draft
    delete data.redirect
    delete data.syncError
    delete data.trigger

    const headers = await this.getHeaders()
    const isOnline = true

    if (!isOnline) {
      throw new Error(`Cannot make request post to ${url}.You are not online`)
    }
    return axios.post(url, data, { headers })
  }

  public async httpPUT(id: string, data: InputDTO) {
    const isOnline = true
    const url = `${this.getUrl()}/${id}`
    const headers = await this.getHeaders()

    if (!isOnline) {
      throw new Error(`Cannot make request post to ${url}.You are not online`)
    }

    return axios.put(url, data, { headers })
  }

  public async httpPatch(id: string, data: InputDTO) {
    const isOnline = true
    const url = `${this.getUrl()}/${id}`
    const headers = await this.getHeaders()

    if (!isOnline) {
      throw new Error(`Cannot make request post to ${url}.You are not online`)
    }

    return axios.patch(url, data, { headers })
  }

  public async httpDelete(id) {
    const headers = await this.getHeaders()
    const url = `${this.getUrl()}/${id}`
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
          filters.where.and.push({ [element]: { regexp: value } })
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
      s = s.includes('id') ? 'id' : s
      return s
    })

    if (select.find(e => e.startsWith('data.'))) {
      select.unshift('data')
    }

    if (!select) {
      return filter
    }

    const fields = []

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
    if (!this.baseEndPoint) {
      throw new Error(
        `You did not provide a baseUrl for the Loopback connector`
      )
    }
    return this.baseEndPoint.replace(/\/+$/, '')
  }
}
