# @goatlab/biome

Shared Biome configuration for GoatLab projects.

## Installation

```bash
pnpm add -D @goatlab/biome @biomejs/biome
```

## Usage

Create a `biome.json` file in your project root:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.1.3/schema.json",
  "extends": ["../../packages/biome/biome.json"]
}
```

Or if using the published package:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.1.3/schema.json",
  "extends": ["node_modules/@goatlab/biome/biome.json"]
}
```

## Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "format": "biome format --write .",
    "lint": "biome lint --write .",
    "check": "biome check --write ."
  }
}
```

## VS Code Integration

Install the [Biome VS Code extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) and add this to your workspace settings:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

## Rule Mappings from ESLint

This configuration includes equivalent rules for the following ESLint/Prettier settings:

### Formatting (from Prettier)
- `printWidth: 80` → `lineWidth: 80`
- `trailingComma: "none"` → `trailingCommas: "none"`
- `singleQuote: true` → `quoteStyle: "single"`
- `semi: false` → `semicolons: "asNeeded"`
- `tabWidth: 2` → `indentWidth: 2`
- `arrowParens: "avoid"` → `arrowParentheses: "asNeeded"`

### Linting (from ESLint)
- TypeScript naming conventions
- Import organization
- Unused imports/variables removal
- Complexity limits (max 30)
- Various code quality rules

See the [biome.json](./biome.json) file for the complete configuration.