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
}

export type {{_Model.name}}OriginalBaseModel = Omit<
  {{_Model.name}}BaseModel,
  | "modified"
  | "deleted"
  | "created"
  | "id"
  | "form"
  | "_ngram"
  | "roles"
  | "owner"
  | "getId"
  | "getIdObject"
  | "toJSON"
  | "toObject"
>;

export type {{_Model.name}}ReturnBaseModel = Omit<
  {{_Model.name}}BaseModel,
  | "deleted"
  | "form"
  | "_ngram"
  | "getId"
  | "getIdObject"
  | "toJSON"
  | "toObject"
>;
`
