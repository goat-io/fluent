import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type GlobalTempData = {
  redisUrl?: string
}
const tempDataFilePath = resolve(join(__dirname, '../../'), 'tempData.json')

export const getGlobalData = (): GlobalTempData => {
  const data = JSON.parse(readFileSync(tempDataFilePath, 'utf-8'))

  return data
}
