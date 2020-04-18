export const template = `import { Entity, model, property } from "@loopback/repository";
import { Id } from "@goatlab/fluent/dist/Helpers/Id";
{{#each this}}{{#if isDatagrid}}import { {{dgPath}}BaseModel } from "./{{dgPath}}-model";\n{{/if}}{{#if isObject}}import { {{path}}BaseModel } from "./{{path}}-model";\n{{/if}}{{/each}}
@model({
  settings: {
    strictObjectIDCoercion: true
  }
})
export class {{_Model.name}}BaseModel extends Entity {
  {{> typeProperty}}
  
  constructor(data?: Partial< {{_Model.name}}BaseModel >) {
    super(data);
  }
}`
