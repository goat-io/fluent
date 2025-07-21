# @goatlab/ts-package-template

A TypeScript package template for creating new packages in the Goat Fluent monorepo. This template provides a pre-configured setup with TypeScript, Jest, ESLint, and automated release workflows.

## Using this Template

1. Copy the `base_project` directory to a new package:
   ```bash
   cp -r packages/base_project packages/your-package-name
   ```

2. Update `package.json`:
   - Change the `name` field to your package name (e.g., `@goatlab/your-package`)
   - Update the `description` field
   - Remove or update dependencies as needed

3. Start developing in the `src/` directory

## What's Included

- **TypeScript** configuration extending `@goatlab/tsconfig`
- **Jest** setup for testing with ts-jest
- **ESLint** for code linting
- **Prettier** for code formatting
- **Commitizen** for conventional commits
- **Release-it** for automated releases
- **Auto-changelog** generation
- Pre-configured build scripts

## Commands

```bash
# Development
pnpm dev          # Watch mode compilation
pnpm build        # Build the package
pnpm test         # Run tests
pnpm lint         # Run ESLint
pnpm format       # Format code with Prettier

# Release
pnpm release:patch  # Release patch version
pnpm release:minor  # Release minor version
pnpm release:major  # Release major version
```
