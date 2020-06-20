export const template = `{{#each this}}
{{#ifIsNotId @key}}
{{#IfMetaNotProperty @key}}
{{#if array}}

@Column({ type: 'simple-array', nullable: {{#if required}}false,{{else}}true,{{/if}} })
@ApiProperty({ type: [{{#stringToJsType type}}{{/stringToJsType}}], nullable: {{#if required}}false{{else}}true{{/if}}, required: {{#if required}}true{{else}}false{{/if}} })
{{else}}

{{#if isDatagrid}}@property.array({{dgPath}}BaseModel)
{{else}}
{{#if isObject}}@property()
{{else}}
@Column({
  nullable: {{#if required}}false,{{else}}true,{{/if}}
  type: "{{type}}"{{#if enum}}, 
  enum: [ {{#each enum}}"{{this}}",{{/each}} ]{{/if}}
})
@ApiProperty({
  nullable: {{#if required}}false,{{else}}true,{{/if}} 
  required: {{#if required}}true{{else}}false{{/if}}
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
@PrimaryGeneratedColumn('uuid')
@ApiProperty()
@Field(() => ID)
id: string
{{/ifIsId}}

{{/each}}`
