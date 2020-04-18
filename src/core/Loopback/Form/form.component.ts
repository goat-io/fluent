import { inject } from '@loopback/context'
import { Application, Component, CoreBindings } from '@loopback/core'
import { Form as FormController } from './form.controller'
import { FormRepository } from './form.repository'
import { FormsDataSource } from './forms.datasource'

export class FormComponent implements Component {
  constructor(
    @inject(CoreBindings.APPLICATION_INSTANCE)
    private application: any
  ) {
    this.application.controller(FormController)
    this.application.dataSource(FormsDataSource)
    this.application.repository(FormRepository)
  }
}
