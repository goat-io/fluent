import { getKy, getShortUrl } from './Got/getKy'

class HttpClass {
  getClient = getKy
  getShortUrl = getShortUrl
}

export const Http = new HttpClass()
