import { inject } from '@loopback/context'
import { Component, CoreBindings } from '@loopback/core'
import { FileUploadController } from './uploads.controller'

export class UploadsComponent implements Component {
  constructor(
    @inject(CoreBindings.APPLICATION_INSTANCE)
    private application: any
  ) {
    // Uploads
    this.application.controller(FileUploadController)
  }
}
