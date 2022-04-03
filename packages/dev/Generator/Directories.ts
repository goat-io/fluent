import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { GoatModel } from '../../../../fluent-formio/src/Formio/types/GoatModel'
import { SupportedFrameworks } from '../../../../fluent-formio/src/Formio/parser/parse'

export const Directories = (
  Model: GoatModel,
  basePath: string,
  framework: SupportedFrameworks
) => {
  const folderName = Model.folderPath
  const directoryPath = join(basePath, `../src/${folderName}`)
  const base = join(basePath, `../src/${folderName}/_base`)

  const modelString =
    framework === SupportedFrameworks.Loopback ? 'models' : 'entities'

  const models = join(basePath, `../src/${folderName}/_base/${modelString}`)
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
