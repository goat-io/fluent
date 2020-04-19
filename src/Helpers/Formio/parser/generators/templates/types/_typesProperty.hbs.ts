export const template = `{{#each this}}
{{#IfNotMetaProperty @key}}
  "{{@key}}"{{#unless required}}?{{/unless}}:{{#unless isObject}} {{type}}{{#if array}}[]{{/if}}{{#if isDatagrid}}{{dgPath}}Type[]{{/if}};{{/unless}}{{#if isObject}} {{path}}Type;
  {{else}}{{/if}}
{{/IfNotMetaProperty}}
{{/each}}`
