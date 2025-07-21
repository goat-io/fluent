# @goatlab/tsconfig

Shared TypeScript configuration presets for the Goat Fluent monorepo and related projects.

## Installation

```bash
pnpm add -D @goatlab/tsconfig
```

## Usage

Extend one of the available configurations in your `tsconfig.json`:

```json
{
  "extends": "@goatlab/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

## Available Configurations

- **`base.json`** - Base TypeScript configuration with strict type checking, ES2022 target, and decorator support
- **`internal.json`** - Extends base config for declaration-only builds (generates `.d.ts` files without JavaScript output)
- **`tsconfig.json`** - CommonJS configuration with Node.js types and ts-node support

## Features

- Strict type checking enabled
- Decorator and metadata support for TypeORM/class-based APIs  
- Source maps and incremental compilation
- Path mapping for `@src/*` imports
- Optimized for modern ES2022+ environments