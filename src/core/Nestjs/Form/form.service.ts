import { Injectable, Inject } from '@nestjs/common'
import { Form } from './form.entity'
import { FormDtoIn, FormDtoOut } from './form.dto'
import { TypeOrmConnector } from '../../../Providers/TypeOrm/TypeOrmConnector'
import { Repository } from 'typeorm'

@Injectable()
export class FormService {
  public model: TypeOrmConnector<Form, FormDtoIn, FormDtoOut>
  constructor(
    @Inject('FORM_REPOSITORY')
    private forms: Repository<Form>
  ) {
    this.model = new TypeOrmConnector<Form, FormDtoIn, FormDtoOut>(Form)
  }
}
