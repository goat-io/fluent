import { readFileSync } from 'fs'
import { join, resolve } from 'path'

export type GlobalTempData = {
  rabbitMQUrl?: string
}
const tempDataFilePath = resolve(join(__dirname, '../../'), 'tempData.json')

export const getGlobalData = (): GlobalTempData => {
  const data = JSON.parse(readFileSync(tempDataFilePath, 'utf-8'))

  return data
}
