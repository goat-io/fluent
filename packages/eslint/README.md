# @goatlab/eslint

Shared ESLint configuration for the Goat Fluent monorepo, providing consistent TypeScript, Jest, and code quality rules across all packages.

## Installation

```bash
pnpm add -D @goatlab/eslint eslint
```

## Usage

Create an `.eslintrc.js` file in your package root:

```js
module.exports = require('@goatlab/eslint/eslint.config.js')
```

Or extend it with custom rules:

```js
const baseConfig = require('@goatlab/eslint/eslint.config.js')

module.exports = {
  ...baseConfig,
  // your custom overrides
}
```

## What's Included

- **TypeScript Support**: Full TypeScript linting with type-aware rules via `@typescript-eslint`
- **Code Quality**: Airbnb base configuration with custom rules for consistent code style
- **Jest Integration**: Automatically includes Jest rules when Jest is installed in your project
- **Import Management**: Import ordering and unused import detection
- **Framework Support**: Vue.js file support with proper parser configuration
- **Prettier Integration**: Configured to work seamlessly with Prettier formatting
- **Unicorn Rules**: Best practices and improvements via `eslint-plugin-unicorn`

## Key Features

- Automatically detects Jest and applies testing rules only when needed
- Strict naming conventions (camelCase for variables/functions, PascalCase for types)
- Comprehensive error prevention rules
- Optimized for TypeScript projects with proper type checking
- Ignores common build artifacts (`node_modules`, `dist`, `coverage`, `.turbo`)