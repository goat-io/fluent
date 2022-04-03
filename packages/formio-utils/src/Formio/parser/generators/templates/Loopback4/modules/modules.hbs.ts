export const template = `export const modules = [
  "core"{{#each this}},
  "{{folderPath}}"{{/each}} 
];`
