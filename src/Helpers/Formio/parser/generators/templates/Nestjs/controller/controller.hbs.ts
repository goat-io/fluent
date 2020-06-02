export const template = `import { {{_Model.name}}BaseController } from "./_base/{{_Model.name}}-controller";

export class {{_Model.name}} extends {{_Model.name}}BaseController {
     public baseFormId = "{{_Model.id}}"
}`
