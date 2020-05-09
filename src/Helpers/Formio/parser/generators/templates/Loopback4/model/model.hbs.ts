export const template = `// import { property } from "@loopback/repository";
import { {{_Model.name}}BaseModel, {{_Model.name}}ReturnBaseModel, {{_Model.name}}OriginalBaseModel  } from "./_base/models/{{_Model.name}}-model";


export type {{_Model.name}}ReturnModel = {{_Model.name}}ReturnBaseModel  & {}

export type {{_Model.name}}OriginalModel = {{_Model.name}}OriginalBaseModel  & {}

export class {{_Model.name}}Model extends {{_Model.name}}BaseModel {}`
