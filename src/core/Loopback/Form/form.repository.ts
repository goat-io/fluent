import { inject } from '@loopback/core'
import { DefaultCrudRepository } from '@loopback/repository'
import { Form, FormRelations } from './form.model'
import { FormsDataSource } from './forms.datasource'
import { Formio } from '../../../Helpers/Formio'
export class FormRepository extends DefaultCrudRepository<Form, typeof Form.prototype._id, FormRelations> {
  constructor(@inject('datasources.forms') dataSource: FormsDataSource) {
    super(Form, dataSource)
  }

  public async getFormById(_id: string) {
    const stringForm = await this.findById(_id)
    return Formio.getter(stringForm)
  }
}
