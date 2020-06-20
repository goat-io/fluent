export const template = `import { Injectable, Inject } from '@nestjs/common'
import { {{_Model.name}}Entity } from "../{{_Model.name}}.entity";
import { {{_Model.name}}DtoIn, {{_Model.name}}DtoOut} from '../{{_Model.name}}.dto'
import {
  TypeOrmConnector,
  GoatRepository
} from '@goatlab/fluent/dist/Providers/TypeOrm/TypeOrmConnector'

@Injectable()
export class {{_Model.name}}ServiceBase {
  public model: TypeOrmConnector<{{_Model.name}}Entity, {{_Model.name}}DtoIn, {{_Model.name}}DtoOut>
  constructor(
    @Inject('{{_Model.name}}_REPOSITORY')
    private {{_Model.name}}: GoatRepository<{{_Model.name}}Entity>
  ) {
    this.model = new TypeOrmConnector<{{_Model.name}}Entity, {{_Model.name}}DtoIn, {{_Model.name}}DtoOut>({
      repository: this.{{_Model.name}}
    })
  }
}`
