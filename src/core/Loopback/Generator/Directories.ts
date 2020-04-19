import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { GoatModel } from '../../../Helpers/Formio/types/GoatModel'

export const Directories = (Model: GoatModel, basePath: string) => {
  const folderName = Model.folderPath
  const directoryPath = join(basePath, `../src/${folderName}`)
  const base = join(basePath, `../src/${folderName}/_base`)
  const models = join(basePath, `../src/${folderName}/_base/models`)
  const types = join(basePath, `../src/${folderName}/_base/types`)

  if (!existsSync(directoryPath)) {
    mkdirSync(directoryPath)
  }

  if (!existsSync(base)) {
    mkdirSync(base)
  }

  if (!existsSync(models)) {
    mkdirSync(models)
  }

  if (!existsSync(types)) {
    mkdirSync(types)
  }
}
