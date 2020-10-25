export const template = `{{#each this}}
{{#ifIsNotId @key}}
{{#IfMetaNotProperty @key}}
{{#if array}}

@Decorators.array({{#stringToJsType type}}{{/stringToJsType}}, { required: {{#if required}}true{{else}}false{{/if}} })
{{else}}

{{#if isDatagrid}}@Column(type => {{#unless isObject}} {{type}}{{#if array}}[]{{/if}}{{#if isDatagrid}}{{dgPath}}BaseEntity{{/if}}{{/unless}}{{#if isObject}}{{path}}BaseEntity{{else}}{{/if}})
@ApiProperty({ isArray: true, type: {{#if isDatagrid}}{{dgPath}}BaseEntity{{else}}{{/if}}, required: {{#if required}}true{{else}}false{{/if}} })
{{else}}
{{#if isObject}}@Column(type => {{#unless isObject}} {{type}}{{#if array}}[]{{/if}}{{#if isDatagrid}}{{dgPath}}BaseEntity[]{{/if}}{{/unless}}{{#if isObject}}{{path}}BaseEntity{{else}}{{/if}})
@ApiProperty({ type: {{#if isObject}}{{path}}BaseEntity{{else}}{{/if}}, nullable: {{#if required}}false,{{else}}true{{/if}} , required: {{#if required}}true{{else}}false{{/if}} })
{{else}}
{{#if enum}} 
@Decorators.Enum({ enum: [ {{#each enum}}"{{this}}",{{/each}} ]}, { required: {{#if required}}true{{else}}false{{/if}}, unique: {{#if unique}}true{{else}}false{{/if}} })
{{else}}
@Decorators.property({ required: {{#if required}}true{{else}}false{{/if}}, unique: {{#if unique}}true{{else}}false{{/if}} })
{{/if}}
{{/if}}
{{/if}}
{{/if}}
"{{@key}}"{{#unless required}}?{{/unless}}:{{#unless isObject}} {{type}}{{#if array}}[]{{/if}}{{#if isDatagrid}}{{dgPath}}BaseEntity[]{{/if}};{{/unless}}{{#if isObject}}{{path}}BaseEntity;
{{else}}
{{/if}}
{{/IfMetaNotProperty}}
{{/ifIsNotId}}
{{#ifIsId @key}}
@Decorators.id()
id: string
{{/ifIsId}}

{{/each}}`
