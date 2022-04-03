import { FluentModel } from './FluentModel'

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

export interface FluentParsedModel {
  model: FluentModel
  types: TemplateFileType[]
  models: ParsedModel
  repository: ParsedRepository
  controller: ParsedController
  modules: TemplateFileType
  module: TemplateFileType
}
