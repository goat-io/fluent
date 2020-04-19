export const template = `{{#each this}}
{{#ifIsNotId @key}}
{{#IfMetaNotProperty @key}}
{{#if array}}

@property.array({{#stringToJsType type}}{{/stringToJsType}})
{{else}}

{{#if isDatagrid}}@property.array({{dgPath}}BaseModel)
{{else}}
{{#if isObject}}@property()
{{else}}
@property({
  type: "{{type}}"{{#if enum}}, 
  enum: [ {{#each enum}}"{{this}}",{{/each}} ]{{/if}}
})
{{/if}}
{{/if}}
{{/if}}
"{{@key}}"{{#unless required}}?{{/unless}}:{{#unless isObject}} {{type}}{{#if array}}[]{{/if}}{{#if isDatagrid}}{{dgPath}}BaseModel[]{{/if}};{{/unless}}{{#if isObject}}{{path}}BaseModel;
{{else}}
{{/if}}
{{/IfMetaNotProperty}}
{{/ifIsNotId}}
{{#ifIsId @key}}
@property({
  id: true,
  type: "string",
  default: () => () => Id.objectID()
})
_id: string;
{{/ifIsId}}

{{/each}}`
