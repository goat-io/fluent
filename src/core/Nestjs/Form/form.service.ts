import { Injectable, Inject } from '@nestjs/common'
import { Repository } from 'typeorm'
import { Form } from './form.entity'
import { FormDtoIn, FormDtoOut, formOutKeys } from './form.dto'
import { TypeOrmConnector } from '../../../Providers/TypeOrm/TypeOrmConnector'

@Injectable()
export class FormService {
  public model: TypeOrmConnector<Form, FormDtoIn, FormDtoOut>
  constructor(
    @Inject('FORM_REPOSITORY')
    private forms: Repository<Form>
  ) {
    this.model = new TypeOrmConnector<Form, FormDtoIn, FormDtoOut>({
      repository: this.forms,
      outputKeys: formOutKeys
    })
  }
}
