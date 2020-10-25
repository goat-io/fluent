export const template = `import { Injectable, Inject } from '@nestjs/common'
import { {{_Model.name}}Entity } from "../{{_Model.name}}.entity";
import { {{_Model.name}}DtoIn, {{_Model.name}}DtoOut} from '../{{_Model.name}}.dto'
import {
  TypeOrmConnector
} from '@goatlab/fluent/dist/Providers/TypeOrm/TypeOrmConnector'
import { FirebaseConnector } from '@goatlab/fluent/dist/Providers/Firebase/FirebaseConnector'
import { IRepository } from '@goatlab/fluent/dist/core/Nestjs/Database/createRepository'

@Injectable()
export class {{_Model.name}}ServiceBase {
  public model:
    | FirebaseConnector<{{_Model.name}}Entity, {{_Model.name}}DtoIn, {{_Model.name}}DtoOut>
    | TypeOrmConnector<{{_Model.name}}Entity, {{_Model.name}}DtoIn, {{_Model.name}}DtoOut>
  constructor(
    @Inject('{{_Model.name}}_REPOSITORY')
    private repositoryConnector: IRepository<{{_Model.name}}Entity| any>
  ) {
    if (repositoryConnector.type === 'firebase') {
      this.model = new FirebaseConnector<{{_Model.name}}Entity, {{_Model.name}}DtoIn, {{_Model.name}}DtoOut>({{_Model.name}}Entity)
      return
    }
    this.model = new TypeOrmConnector<{{_Model.name}}Entity, {{_Model.name}}DtoIn, {{_Model.name}}DtoOut>({{_Model.name}}Entity)
  }
}`
