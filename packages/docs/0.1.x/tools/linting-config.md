# ESLint Configuration Package

The `@goatlab/eslint` package provides comprehensive ESLint configuration for TypeScript projects in the Goat Fluent ecosystem. It includes rules for code quality, consistency, and best practices.

## Installation

```bash
npm install @goatlab/eslint
# or
pnpm add @goatlab/eslint
```

## Configuration

### Basic Setup

Create an `.eslintrc.js` file in your project root:

```javascript
module.exports = {
  extends: ['@goatlab/eslint']
}
```

### Package.json Integration

Add ESLint scripts to your `package.json`:

```json
{
  "scripts": {
    "lint": "eslint src/**/*.{ts,tsx}",
    "lint:fix": "eslint src/**/*.{ts,tsx} --fix",
    "lint:check": "eslint src/**/*.{ts,tsx} --max-warnings 0"
  }
}
```

## Features

### TypeScript Support

Full TypeScript support with type-aware linting:

```typescript
// ✅ Good - properly typed
const user: User = await fetchUser(id)

// ❌ Bad - any type
const user: any = await fetchUser(id)

// ✅ Good - explicit return type
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}

// ❌ Bad - implicit any return
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0)
}
```

### Code Quality Rules

#### Unused Imports and Variables

```typescript
// ❌ Bad - unused imports
import { unused, calculate } from './utils'

function process() {
  return calculate(10)
}

// ✅ Good - only used imports
import { calculate } from './utils'

function process() {
  return calculate(10)
}
```

#### Consistent Naming

```typescript
// ✅ Good - consistent naming
const userName = 'john'
const userEmail = 'john@example.com'

class UserService {
  async findUser(id: string): Promise<User> {
    // implementation
  }
}

// ❌ Bad - inconsistent naming
const user_name = 'john'
const UserEmail = 'john@example.com'

class userservice {
  async find_user(id: string): Promise<User> {
    // implementation
  }
}
```

### Best Practices Enforcement

#### Async/Await Usage

```typescript
// ✅ Good - proper async/await
async function fetchUserData(id: string): Promise<User> {
  try {
    const user = await userService.findById(id)
    return user
  } catch (error) {
    throw new Error(`Failed to fetch user: ${error.message}`)
  }
}

// ❌ Bad - mixing promises and async/await
async function fetchUserData(id: string): Promise<User> {
  return userService.findById(id).then(user => {
    return user
  })
}
```

#### Error Handling

```typescript
// ✅ Good - proper error handling
async function processData(data: unknown[]): Promise<ProcessedData[]> {
  try {
    return await Promise.all(data.map(item => processItem(item)))
  } catch (error) {
    logger.error('Failed to process data:', error)
    throw error
  }
}

// ❌ Bad - swallowing errors
async function processData(data: unknown[]): Promise<ProcessedData[]> {
  try {
    return await Promise.all(data.map(item => processItem(item)))
  } catch (error) {
    // Silent failure
    return []
  }
}
```

### Jest Integration

Automatic Jest rule detection when Jest is installed:

```typescript
// Jest-specific rules apply in test files
describe('UserService', () => {
  // ✅ Good - descriptive test names
  it('should return user when valid ID is provided', async () => {
    const user = await userService.findById('123')
    expect(user).toBeDefined()
    expect(user.id).toBe('123')
  })

  // ❌ Bad - vague test names
  it('works', async () => {
    const user = await userService.findById('123')
    expect(user).toBeTruthy()
  })
})
```

### Unicorn Rules

Advanced code quality rules from eslint-plugin-unicorn:

```typescript
// ✅ Good - consistent array methods
const numbers = [1, 2, 3, 4, 5]
const evenNumbers = numbers.filter(n => n % 2 === 0)

// ❌ Bad - unnecessary for loop
const evenNumbers = []
for (let i = 0; i < numbers.length; i++) {
  if (numbers[i] % 2 === 0) {
    evenNumbers.push(numbers[i])
  }
}

// ✅ Good - proper error types
throw new Error('Invalid user ID')

// ❌ Bad - throwing strings
throw 'Invalid user ID'
```

## Configuration Options

### Custom Rules

Extend the base configuration with custom rules:

```javascript
// .eslintrc.js
module.exports = {
  extends: ['@goatlab/eslint'],
  rules: {
    // Custom overrides
    '@typescript-eslint/no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-console': 'warn'
  }
}
```

### Environment-Specific Configuration

```javascript
// .eslintrc.js
module.exports = {
  extends: ['@goatlab/eslint'],
  env: {
    browser: true,
    node: true,
    jest: true
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ]
}
```

### Vue.js Support

For Vue.js projects:

```javascript
// .eslintrc.js
module.exports = {
  extends: ['@goatlab/eslint'],
  overrides: [
    {
      files: ['*.vue'],
      extends: ['plugin:vue/recommended'],
      parser: 'vue-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser'
      }
    }
  ]
}
```

## IDE Integration

### VS Code

Create `.vscode/settings.json`:

```json
{
  "eslint.validate": [
    "javascript",
    "typescript",
    "vue"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.formatOnSave": true
}
```

### WebStorm

1. Go to Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
2. Enable "Automatic ESLint configuration"
3. Enable "Run eslint --fix on save"

## Common Rules Explained

### TypeScript Rules

```typescript
// @typescript-eslint/no-unused-vars
// ❌ Bad - unused variable
const unusedVar = 'not used'

// ✅ Good - all variables used
const usedVar = 'used in return'
return usedVar

// @typescript-eslint/explicit-function-return-type
// ✅ Good - explicit return type
function add(a: number, b: number): number {
  return a + b
}

// ❌ Bad - implicit return type
function add(a: number, b: number) {
  return a + b
}
```

### Import Rules

```typescript
// import/order
// ✅ Good - proper import order
import fs from 'fs'
import path from 'path'

import express from 'express'
import cors from 'cors'

import { UserService } from './services/UserService'
import { DatabaseConfig } from './config/database'

// ❌ Bad - mixed import order
import { UserService } from './services/UserService'
import express from 'express'
import fs from 'fs'
import { DatabaseConfig } from './config/database'
```

### Unicorn Rules

```typescript
// unicorn/prefer-modern-dom-apis
// ✅ Good - modern DOM APIs
document.querySelector('.button')
document.querySelectorAll('.items')

// ❌ Bad - legacy DOM APIs
document.getElementById('button')
document.getElementsByClassName('items')

// unicorn/no-array-for-each
// ✅ Good - for...of loop
for (const item of items) {
  processItem(item)
}

// ❌ Bad - forEach when not needed
items.forEach(item => {
  processItem(item)
})
```

## Performance Optimization

### Caching

ESLint caching is enabled by default:

```json
{
  "scripts": {
    "lint": "eslint --cache src/**/*.{ts,tsx}",
    "lint:clear-cache": "eslint --cache --cache-location .eslintcache --clear-cache"
  }
}
```

### Selective Linting

Lint only changed files:

```bash
# Lint staged files
npx lint-staged

# Lint files changed in current branch
git diff --name-only --diff-filter=ACMR origin/main | grep -E '\.(ts|tsx)$' | xargs eslint
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Lint

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  lint:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Run ESLint
      run: npm run lint:check
    
    - name: Run TypeScript check
      run: npx tsc --noEmit
```

### Pre-commit Hooks

Using Husky and lint-staged:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "src/**/*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

## Migration Guide

### From Standard ESLint

```javascript
// Before
module.exports = {
  extends: ['eslint:recommended', '@typescript-eslint/recommended'],
  rules: {
    // many custom rules
  }
}

// After
module.exports = {
  extends: ['@goatlab/eslint'],
  rules: {
    // minimal custom overrides
  }
}
```

### From TSLint

1. Remove TSLint configuration:
   ```bash
   rm tslint.json
   npm uninstall tslint
   ```

2. Install ESLint configuration:
   ```bash
   npm install @goatlab/eslint
   ```

3. Update scripts:
   ```json
   {
     "scripts": {
       "lint": "eslint src/**/*.{ts,tsx}",
       "lint:fix": "eslint src/**/*.{ts,tsx} --fix"
     }
   }
   ```

## Troubleshooting

### Common Issues

#### Parser Errors

```bash
# Error: Cannot find module '@typescript-eslint/parser'
npm install @typescript-eslint/parser

# Error: TypeScript project configuration
# Ensure tsconfig.json is in project root
```

#### Performance Issues

```bash
# Clear ESLint cache
npm run lint:clear-cache

# Reduce file scope
eslint src/specific-folder/**/*.ts
```

#### Rule Conflicts

```javascript
// Disable conflicting rules
module.exports = {
  extends: ['@goatlab/eslint'],
  rules: {
    'conflicting-rule': 'off'
  }
}
```

### Debug Mode

Run ESLint in debug mode:

```bash
DEBUG=eslint:* npm run lint
```

## Custom Rule Development

### Creating Custom Rules

```javascript
// eslint-rules/no-hardcoded-urls.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded URLs',
      category: 'Best Practices'
    },
    schema: []
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === 'string' && node.value.startsWith('http')) {
          context.report({
            node,
            message: 'Hardcoded URLs are not allowed'
          })
        }
      }
    }
  }
}
```

### Using Custom Rules

```javascript
// .eslintrc.js
module.exports = {
  extends: ['@goatlab/eslint'],
  rules: {
    'custom/no-hardcoded-urls': 'error'
  },
  plugins: ['custom']
}
```

## Best Practices

1. **Consistent Configuration**: Use the same ESLint config across all projects
2. **Gradual Migration**: Migrate large codebases gradually
3. **Team Alignment**: Ensure all team members use the same configuration
4. **CI Integration**: Enforce linting in CI/CD pipelines
5. **IDE Setup**: Configure IDEs for automatic linting and fixing
6. **Documentation**: Document any custom rule overrides
7. **Regular Updates**: Keep ESLint and rules updated

## Contributing

The ESLint configuration is part of the Goat Fluent ecosystem. See the main documentation for contribution guidelines.