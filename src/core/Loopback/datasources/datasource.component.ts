import { inject } from '@loopback/context'
import { Component, CoreBindings } from '@loopback/core'
import { MongoDataSource } from './mongo.datasource'

export class DataSourceComponent implements Component {
  constructor(
    @inject(CoreBindings.APPLICATION_INSTANCE)
    private application: any
  ) {
    this.application.dataSource(MongoDataSource)
  }
}
