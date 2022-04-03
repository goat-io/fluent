export const template = `import { {{_Model.name}}Base } from "./_base/{{_Model.name}}-controller";

export class {{_Model.name}} extends {{_Model.name}}Base {
     public baseFormId = "{{_Model.id}}"
}`
