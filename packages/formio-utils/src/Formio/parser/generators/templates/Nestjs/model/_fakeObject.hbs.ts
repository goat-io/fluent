export const template = `{{#each this}}
{{#ifIsNotId @key}}
{{#IfMetaNotProperty @key}}
"{{@key}}":{{#unless isObject}} {{#stringToFaker type array}}{{/stringToFaker}}{{#if isDatagrid}}{{dgPath}}BaseEntityFaker(){{/if}},{{/unless}}{{#if isObject}}{{path}}BaseEntityFaker(),
{{else}}
{{/if}}
{{/IfMetaNotProperty}}
{{/ifIsNotId}}
{{#ifIsId @key}}
id: faker.random.uuid(),
{{/ifIsId}}

{{/each}}`
