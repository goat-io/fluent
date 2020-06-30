export const template = `import { Injectable, Inject } from '@nestjs/common'
import { {{_Model.name}}Entity } from "../{{_Model.name}}.entity";
import { {{_Model.name}}DtoIn, {{_Model.name}}DtoOut} from '../{{_Model.name}}.dto'
import {
  TypeOrmConnector
} from '@goatlab/fluent/dist/Providers/TypeOrm/TypeOrmConnector'
import { IRepository } from '@goatlab/fluent/dist/core/Nestjs/Database/createRepository'

@Injectable()
export class {{_Model.name}}ServiceBase {
  public model: TypeOrmConnector<{{_Model.name}}Entity, {{_Model.name}}DtoIn, {{_Model.name}}DtoOut>
  constructor(
    @Inject('{{_Model.name}}_REPOSITORY')
    private repositoryConnector: IRepository<{{_Model.name}}Entity>
  ) {
    this.model = new TypeOrmConnector<{{_Model.name}}Entity, {{_Model.name}}DtoIn, {{_Model.name}}DtoOut>({
      repository: this.repositoryConnector.repository,
      isMongoDB: this.repositoryConnector.type === 'mongodb'
    })
  }
}`
