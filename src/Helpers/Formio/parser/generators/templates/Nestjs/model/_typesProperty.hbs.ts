export const template = `{{#each this}}
{{#ifIsNotId @key}}
{{#IfMetaNotProperty @key}}
{{#if array}}

@Column({ type: 'simple-array', nullable: {{#if required}}false,{{else}}true,{{/if}} })
@ApiProperty({ type: [{{#stringToJsType type}}{{/stringToJsType}}], nullable: {{#if required}}false{{else}}true{{/if}}, required: {{#if required}}true{{else}}false{{/if}} })
{{else}}

{{#if isDatagrid}}@Column(type => {{#unless isObject}} {{type}}{{#if array}}[]{{/if}}{{#if isDatagrid}}{{dgPath}}BaseEntity{{/if}}{{/unless}}{{#if isObject}}{{path}}BaseEntity{{else}}{{/if}})
@ApiProperty({ isArray: true, type: {{#if isDatagrid}}{{dgPath}}BaseEntity{{else}}{{/if}}, nullable: {{#if required}}false,{{else}}true{{/if}} , required: {{#if required}}true{{else}}false{{/if}} })
{{else}}
{{#if isObject}}@Column(type => {{#unless isObject}} {{type}}{{#if array}}[]{{/if}}{{#if isDatagrid}}{{dgPath}}BaseEntity[]{{/if}}{{/unless}}{{#if isObject}}{{path}}BaseEntity{{else}}{{/if}})
@ApiProperty({ type: {{#if isObject}}{{path}}BaseEntity{{else}}{{/if}}, nullable: {{#if required}}false,{{else}}true{{/if}} , required: {{#if required}}true{{else}}false{{/if}} })
{{else}}
@Column({
  nullable: {{#if required}}false,{{else}}true,{{/if}}
  {{#if enum}} 
  enum: [ {{#each enum}}"{{this}}",{{/each}} ]{{/if}}
})
@ApiProperty({
  nullable: {{#if required}}false,{{else}}true,{{/if}} 
  required: {{#if required}}true{{else}}false{{/if}}
})
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
_id: string
{{/ifIsId}}

{{/each}}`
