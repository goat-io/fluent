export const template = `{{#each this}}{{#if isDatagrid}}import { {{dgPath}}Type } from "./{{dgPath}}.type";\n{{/if}}{{#if isObject}}import { {{path}}Type } from "./{{path}}.type";\n{{/if}}{{/each}}
export interface {{_Model.name}}Type {
  {{> typeProperty}}
}`
