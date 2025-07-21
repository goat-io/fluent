# @goatlab/js-utils

A comprehensive collection of TypeScript utilities for both Node.js and browser environments. This package provides essential helpers for working with arrays, objects, strings, promises, HTTP requests, and more.

## Installation

```bash
npm install @goatlab/js-utils
# or
yarn add @goatlab/js-utils
# or
pnpm add @goatlab/js-utils
```

## Basic Usage

```typescript
import { Arrays, Objects, Strings, Promises, Http } from '@goatlab/js-utils'

// Array utilities
const numbers = [1, 2, 3, 4, 5, 6]
const chunks = Arrays.chunk(numbers, 2) // [[1, 2], [3, 4], [5, 6]]
const first = Arrays.first(numbers) // 1
const last = Arrays.last(numbers) // 6

// Object utilities
const obj = { a: 1, b: 2, c: 3 }
const picked = Objects.pick(obj, ['a', 'c']) // { a: 1, c: 3 }
const omitted = Objects.omit(obj, ['b']) // { a: 1, c: 3 }
const isEmpty = Objects.isEmpty({}) // true

// String utilities
const camelCase = Strings.camelCase('hello-world') // 'helloWorld'
const snakeCase = Strings.snakeCase('helloWorld') // 'hello_world'
const truncated = Strings.truncate('long text here', 8) // 'long tex...'

// Promise utilities
const [err, result] = await Promises.try(fetchData())
const results = await Promises.map(items, async (item) => process(item), { concurrency: 3 })

// HTTP client (based on ky)
const client = Http.getClient({ 
  prefixUrl: 'https://api.example.com',
  timeout: 30000 
})
const data = await client.get('users').json()
```

## Available Utilities

### Core Utilities

- **Arrays** - `chunk`, `first`, `last`, `flatten`, `uniq`, `sortBy`, `groupBy`
- **Objects** - `pick`, `omit`, `merge`, `isEmpty`, `deepEquals`, `mapValues`, `filterValues`
- **Strings** - `camelCase`, `snakeCase`, `kebabCase`, `truncate`, `before`, `after`, `template`
- **Numbers** - `round`, `random`, `inRange`, `clamp`
- **Functions** - `debounce`, `throttle`, `once`, `memoize`
- **Promises** - `try`, `map`, `props`, `retry`, `hang`

### Data & Collections

- **Collection** - Chainable collection operations
- **Ids** - UUID and nanoid generation
- **Time** - Time formatting (`ms`, `since`)
- **Units** - Unit conversions

### Error Handling

- **Errors** - Error utilities and custom error classes
- **AppError** - Application-specific errors
- **HttpError** - HTTP-specific errors
- **Assert** - Assertion utilities

### HTTP & Browser

- **Http** - HTTP client wrapper (ky-based)
- **BrowserEvents** - Browser event utilities

### Advanced Features

- **Is** - Type checking utilities
- **Memo** - Memoization decorators
- **Inspect** - Object inspection utilities
- **Changelogs** - Changelog generation
- **nGram** - N-gram text analysis

### Date & Time

- **LocalDate** - Date handling without time
- **LocalTime** - Time handling without date
- **DateInterval** - Date range operations
- **TimeInterval** - Time range operations