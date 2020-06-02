import { GoatModel } from './GoatModel'

export interface TemplateFileType {
  path: string
  file: string
}

export interface ParsedModel {
  baseDto: TemplateFileType
  baseModels: TemplateFileType[]
  extendedModels: TemplateFileType
}
export interface ParsedRepository {
  extendedRepository: TemplateFileType
  repository: TemplateFileType
}

export interface ParsedController {
  controller: TemplateFileType
  extendedController: TemplateFileType
}

export interface GoatParsedModel {
  model: GoatModel
  types: TemplateFileType[]
  models: ParsedModel
  repository: ParsedRepository
  controller: ParsedController
  modules: TemplateFileType
  module: TemplateFileType
}
