# Installation

Getting started with Fluent utilities is straightforward. Choose the packages that fit your needs and start writing better TypeScript code immediately.

## Requirements

<div class="content-list">

- **Node.js** 16.0 or higher
- **TypeScript** 4.7 or higher (optional but recommended)
- **npm**, **yarn**, or **pnpm** package manager

</div>

## Quick Start

### Core Utilities Installation

The most common starting point - install both js-utils and node-utils:

```bash
# npm
npm install @fluent/js-utils @fluent/node-utils

# yarn
yarn add @fluent/js-utils @fluent/node-utils

# pnpm
pnpm add @fluent/js-utils @fluent/node-utils
```

Start using immediately:

```typescript
import { Arrays, Objects, Strings, Http } from '@fluent/js-utils';
import { JWT, Security, Streams } from '@fluent/node-utils';

// You're ready to go!
const slugified = Strings.slug('Hello World');
const token = JWT.sign({ userId: 123 });
```

## Package Overview

### Core Packages

#### @fluent/js-utils
Universal utilities for browser and Node.js:

```bash
npm install @fluent/js-utils
```

**What's included:**
- **Arrays** - filter, map, groupBy, pluck, chunk, unique
- **Objects** - pick, omit, merge, flatten, clone
- **Strings** - slug, truncate, camelCase, template
- **Http** - modern HTTP client with interceptors
- **Promises** - retry, timeout, parallel, sequential
- **Validation** - schema validation with type inference

#### @fluent/node-utils
Node.js specific utilities:

```bash
npm install @fluent/node-utils
```

**What's included:**
- **JWT** - token generation and verification
- **Security** - hashing, encryption, random tokens
- **Streams** - transform, batch, pipeline utilities
- **Files** - file operations with async/await
- **Processes** - CPU/memory monitoring, graceful shutdown

### Specialized Packages

#### Processing Utilities

```bash
# HTML processing
npm install @fluent/js-html

# Excel file processing
npm install @fluent/node-xlsx

# Web scraping
npm install @fluent/node-metascraper

# Caching utilities
npm install @fluent/node-backend
```

#### Advanced Features

```bash
# Queue system
npm install @fluent/queue-core

# Cloud file uploads
npm install @fluent/uploads

# Form processing
npm install @fluent/formio-utils
```

## TypeScript Configuration

For the best experience, configure TypeScript properly:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node"
  }
}
```

## Usage Examples

### Browser Environment

```typescript
// Works in modern browsers
import { Arrays, Objects, Http } from '@fluent/js-utils';

// Fetch and process data
const response = await Http.get('/api/users');
const activeUsers = Arrays.filter(response.data, user => user.active);
const userEmails = Arrays.pluck(activeUsers, 'email');
```

### Node.js Environment

```typescript
// Full Node.js power
import { Arrays } from '@fluent/js-utils';
import { Files, Streams } from '@fluent/node-utils';

// Process large files efficiently
const users = await Streams.pipeline(
  Files.createReadStream('users.csv'),
  Streams.csv(),
  Streams.transform(row => ({
    ...row,
    email: row.email.toLowerCase()
  })),
  Streams.collect()
);

const grouped = Arrays.groupBy(users, 'country');
```

### Mixed Environment

```typescript
// Use appropriate utilities for each environment
import { Arrays, Strings } from '@fluent/js-utils';

// These work everywhere
const data = [1, 2, 3, 4, 5];
const doubled = Arrays.map(data, n => n * 2);
const slug = Strings.slug('My Blog Post Title');

// Conditionally use Node.js utilities
if (typeof window === 'undefined') {
  const { JWT } = await import('@fluent/node-utils');
  const token = JWT.sign({ userId: 123 });
}
```

## Bundle Size Optimization

Fluent utilities are tree-shakeable. Modern bundlers will only include what you use:

```typescript
// Only imports the specific functions you use
import { filter, map, groupBy } from '@fluent/js-utils/arrays';
import { slug, truncate } from '@fluent/js-utils/strings';

// Even smaller bundle size
```

## CDN Usage

For quick prototypes or demos:

```html
<!-- Development -->
<script src="https://unpkg.com/@fluent/js-utils/dist/index.js"></script>
<script>
  const { Arrays, Strings } = Fluent;
  const slugified = Strings.slug('Hello World');
</script>

<!-- Production -->
<script src="https://unpkg.com/@fluent/js-utils/dist/index.min.js"></script>
```

## Package Managers

### npm

```bash
# Install specific version
npm install @fluent/js-utils@^1.0.0

# Install as dev dependency
npm install --save-dev @fluent/js-utils

# Install globally (for CLI tools)
npm install -g @fluent/cli
```

### yarn

```bash
# Install packages
yarn add @fluent/js-utils @fluent/node-utils

# Install specific version
yarn add @fluent/js-utils@^1.0.0

# Install as dev dependency
yarn add --dev @fluent/js-utils
```

### pnpm

```bash
# Install packages
pnpm add @fluent/js-utils @fluent/node-utils

# Install to workspace
pnpm add @fluent/js-utils --filter my-app

# Install globally
pnpm add -g @fluent/cli
```

## Verification

Verify your installation works correctly:

```typescript
// test.ts
import { Arrays, Strings, Objects } from '@fluent/js-utils';

console.log('Testing Fluent utilities...');

// Test array utilities
const numbers = [1, 2, 3, 4, 5];
console.log('Sum:', Arrays.sum(numbers)); // 15

// Test string utilities
const text = 'Hello World!';
console.log('Slug:', Strings.slug(text)); // hello-world

// Test object utilities
const obj = { a: 1, b: { c: 2 } };
console.log('Flattened:', Objects.flatten(obj)); // { 'a': 1, 'b.c': 2 }

console.log('✅ All utilities working correctly!');
```

Run the test:

```bash
# With TypeScript
npx tsx test.ts

# With Node.js (requires .mjs extension or "type": "module")
node test.js
```

## Common Issues

### TypeScript Errors

If you see TypeScript errors, ensure you have the correct version:

```bash
npm install --save-dev typescript@latest
```

### Module Resolution

For ESM projects, add to package.json:

```json
{
  "type": "module"
}
```

### Import Errors

If imports aren't working, check your tsconfig.json:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true
  }
}
```

## Next Steps

Now that you have Fluent installed:

<div class="content-list">

### 🔧 **Explore Utilities**
Start with [Collections & Arrays](../utilities/collections.md) to see common patterns.

### 🚀 **First Steps**
Follow our [First Steps](first-steps.md) guide to build something real.

### 📚 **API Reference**
Browse the complete [API Documentation](../api/utility-api.md).

### ⚡ **Advanced Features**
Explore [Queue System](../queues/queue-core.md) and [Cloud Services](../advanced/uploads.md).

</div>

---

You're ready to write better TypeScript with Fluent utilities! 🚀