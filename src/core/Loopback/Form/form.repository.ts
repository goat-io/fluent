import { inject } from '@loopback/core'
import { DefaultCrudRepository } from '@loopback/repository'
import { Form, FormRelations } from './form.model'
import { FormsDataSource } from './forms.datasource'

export class FormRepository extends DefaultCrudRepository<Form, typeof Form.prototype._id, FormRelations> {
  constructor(@inject('datasources.forms') dataSource: FormsDataSource) {
    super(Form, dataSource)
  }
}
