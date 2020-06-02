export const template = `import { DefaultCrudRepository } from "@loopback/repository";
import { inject } from "@loopback/core";
import { {{_Model.name}}Model } from "../{{_Model.name}}.model";
import { MongoDataSource } from "@goatlab/fluent/dist/core/Loopback/datasources/mongo.datasource";

export class {{_Model.name}}RepositoryBase extends DefaultCrudRepository<
  {{_Model.name}}Model,
  typeof {{_Model.name}}Model.prototype.id
> {
  constructor(@inject("datasources.mongo") dataSource: MongoDataSource) {
    super({{_Model.name}}Model, dataSource);
  }
}`
