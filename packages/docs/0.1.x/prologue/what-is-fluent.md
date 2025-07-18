# What is Fluent?

Fluent is a **comprehensive TypeScript utility ecosystem** that provides battle-tested, type-safe utilities for modern development. Built from the ground up with TypeScript, Fluent helps you write cleaner, more maintainable code by handling common development tasks with elegant, intuitive APIs.

## The Core: Powerful Utilities

At the heart of Fluent are two essential packages that transform how you write TypeScript:

### @fluent/js-utils

Universal utilities that work in both browser and Node.js environments:

```typescript
import { Arrays, Objects, Strings, Http, Promises } from '@fluent/js-utils';

// Powerful array operations
const users = [
  { id: 1, name: 'Alice', age: 30, role: 'admin' },
  { id: 2, name: 'Bob', age: 25, role: 'user' },
  { id: 3, name: 'Charlie', age: 35, role: 'admin' }
];

const admins = Arrays.filter(users, user => user.role === 'admin');
const names = Arrays.pluck(users, 'name'); // ['Alice', 'Bob', 'Charlie']
const grouped = Arrays.groupBy(users, 'role'); // { admin: [...], user: [...] }

// Elegant object manipulation
const config = Objects.pick(process.env, ['API_KEY', 'DATABASE_URL']);
const merged = Objects.deepMerge(defaults, userConfig);
const flattened = Objects.flatten({ a: { b: { c: 1 } } }); // { 'a.b.c': 1 }

// String utilities that just work
const slug = Strings.slug('Hello World!'); // 'hello-world'
const truncated = Strings.truncate(longText, 100); // 'Long text...'
const camelCased = Strings.camelCase('hello-world'); // 'helloWorld'

// Modern HTTP client
const response = await Http.post('https://api.example.com/users', {
  name: 'John Doe',
  email: 'john@example.com'
});
```

### @fluent/node-utils

Node.js-specific utilities for backend development:

```typescript
import { JWT, Streams, Security, Files, Processes } from '@fluent/node-utils';

// JWT authentication made simple
const token = JWT.sign({ userId: user.id }, { expiresIn: '24h' });
const payload = JWT.verify(token);

// Stream processing for large files
await Streams.pipeline(
  Files.createReadStream('large-file.csv'),
  Streams.transform(row => processRow(row)),
  Streams.batch(1000),
  async batch => await saveToDatabase(batch)
);

// Security utilities
const hashed = await Security.hash('password');
const isValid = await Security.verify('password', hashed);
const encrypted = Security.encrypt(sensitiveData);

// Process management
const cpuUsage = Processes.getCPUUsage();
const memoryInfo = Processes.getMemoryInfo();
await Processes.gracefulShutdown(() => cleanup());
```

## Why Fluent Utilities?

### 1. **Type Safety Everywhere**

Every function is fully typed with TypeScript generics and strict type checking:

```typescript
// Arrays.groupBy knows the exact shape of your data
const users = [
  { id: 1, name: 'Alice', department: 'Engineering' },
  { id: 2, name: 'Bob', department: 'Design' }
];

const grouped = Arrays.groupBy(users, 'department');
// TypeScript knows: grouped.Engineering[0].name is string
// TypeScript knows: grouped.Marketing is possibly undefined
```

### 2. **Battle-Tested in Production**

These utilities aren't theoretical - they're extracted from real production applications and refined over years of use:

```typescript
// Handle complex data transformations
const processedData = Arrays.pipe(rawData,
  data => Arrays.filter(data, item => item.valid),
  data => Arrays.map(data, normalizeItem),
  data => Arrays.unique(data, 'id'),
  data => Arrays.sortBy(data, 'priority')
);

// Robust error handling built-in
const result = await Promises.retry(
  () => fetchDataFromAPI(),
  { retries: 3, delay: 1000 }
);
```

### 3. **Zero Configuration**

Just install and use - no setup required:

```bash
npm install @fluent/js-utils @fluent/node-utils
```

```typescript
import { Arrays, Http, Strings } from '@fluent/js-utils';
// Start using immediately - fully typed, no configuration needed
```

## Beyond Utilities

While utilities are the core, Fluent provides additional specialized packages:

### Specialized Processing

```typescript
// HTML processing
import { HtmlProcessor } from '@fluent/js-html';
const cleaned = HtmlProcessor.sanitize(userInput);
const links = HtmlProcessor.extractLinks(content);

// Excel processing
import { ExcelProcessor } from '@fluent/node-xlsx';
await ExcelProcessor.stream('large-file.xlsx')
  .map(row => transformRow(row))
  .batch(1000)
  .process();

// Web scraping
import { Scraper } from '@fluent/node-metascraper';
const metadata = await Scraper.extract('https://example.com');
```

### Background Processing

```typescript
// Queue system for background jobs
import { Queue } from '@fluent/queue-core';

await Queue.dispatch(new ProcessPayment(order));
await Queue.schedule(new SendNewsletter(), '0 9 * * *');
```

### Cloud Services

```typescript
// Multi-cloud file uploads
import { Storage } from '@fluent/uploads';

const url = await Storage.disk('s3').put('avatars/user.jpg', file);
const files = await Storage.disk('gcs').list('documents/');
```

## Real-World Examples

### Data Processing Pipeline

```typescript
import { Arrays, Objects, Strings } from '@fluent/js-utils';
import { Files, Streams } from '@fluent/node-utils';

// Process CSV data with streaming
const results = await Streams.pipeline(
  Files.createReadStream('users.csv'),
  Streams.csv(),
  Streams.transform(row => ({
    ...row,
    email: Strings.toLowerCase(row.email),
    name: Strings.titleCase(row.name),
    id: Strings.uuid()
  })),
  Streams.filter(row => Strings.isEmail(row.email)),
  Streams.collect()
);

// Group and analyze
const analytics = Arrays.pipe(results,
  data => Arrays.groupBy(data, 'country'),
  groups => Objects.mapValues(groups, users => ({
    count: users.length,
    averageAge: Arrays.avg(users, 'age')
  }))
);
```

### API Development

```typescript
import { Http, Objects, Validation } from '@fluent/js-utils';
import { JWT, Security } from '@fluent/node-utils';

// Build APIs with confidence
export async function createUser(data: unknown) {
  // Validate input
  const validated = Validation.validate(data, {
    name: Validation.string().min(2).required(),
    email: Validation.email().required(),
    password: Validation.string().min(8).required()
  });

  // Process data
  const user = {
    id: Strings.uuid(),
    ...Objects.pick(validated, ['name', 'email']),
    password: await Security.hash(validated.password),
    createdAt: new Date()
  };

  // Generate token
  const token = JWT.sign({ userId: user.id });

  return { user, token };
}
```

## Getting Started

### Installation

Choose what you need:

```bash
# Core utilities only
npm install @fluent/js-utils @fluent/node-utils

# Add specialized packages as needed
npm install @fluent/queue-core @fluent/uploads
```

### Your First Utility

```typescript
import { Arrays, Objects, Strings } from '@fluent/js-utils';

// You're ready to write cleaner code!
const data = [
  { id: 1, name: 'Product A', price: 29.99, category: 'Electronics' },
  { id: 2, name: 'Product B', price: 49.99, category: 'Clothing' },
  { id: 3, name: 'Product C', price: 19.99, category: 'Electronics' }
];

const electronics = Arrays.filter(data, item => item.category === 'Electronics');
const totalPrice = Arrays.sum(electronics, 'price');
const productNames = Arrays.pluck(electronics, 'name');

console.log(`Electronics: ${productNames.join(', ')} - Total: $${totalPrice}`);
```

## What Makes Fluent Different?

<div class="content-list">

### 🎯 **Utility First**
We focus on providing the best utility functions for TypeScript development. No bloat, just essential tools.

### 🔒 **Type Safe by Design**
Every function leverages TypeScript's type system to catch errors at compile time and provide excellent IDE support.

### 🚀 **Performance Focused**
Optimized implementations with lazy evaluation, streaming support, and efficient algorithms.

### 📦 **Tree Shakeable**
Import only what you use. Modern bundlers will remove unused code automatically.

### 🧪 **Battle Tested**
Used in production applications processing millions of requests. Every utility is thoroughly tested.

### 📚 **Comprehensive Documentation**
Clear examples, type definitions, and use cases for every function.

</div>

## Next Steps

Ready to transform how you write TypeScript? Here's where to go:

<div class="content-list">

### 🔧 **Explore Core Utilities**
Dive into [Collections & Arrays](../utilities/collections.md) to see the power of Fluent's array manipulation.

### ⚡ **Node.js Development**
Check out [Node.js Utilities](../utils/node-utils.md) for backend-specific tools.

### 🚀 **Quick Start**
Follow our [Installation Guide](../getting-started/installation.md) to get up and running in minutes.

### 📚 **API Reference**
Browse the complete [API Documentation](../api/utility-api.md) for all available functions.

</div>

---

Fluent utilities are designed to make your TypeScript development faster, safer, and more enjoyable. Let's build something amazing together! 🚀