import { FormDtoIn, FormDtoOut } from './form.dto'

import { Form } from './form.entity'
import { TypeOrmConnector } from '../../../Providers/TypeOrm/TypeOrmConnector'

export class FormService extends TypeOrmConnector<Form, FormDtoIn, FormDtoOut> {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  constructor(relations?: any) {
    super(Form, relations, 'LOCAL_DB')
  }
}
