# Unit Testing

Unit testing in the Fluent ecosystem ensures that individual components work correctly in isolation. This guide covers the testing patterns, setup, and best practices used throughout the monorepo.

## Testing Framework

The Fluent ecosystem uses two main testing frameworks:

### Jest (Primary Framework)
- **Primary testing framework** for most packages
- **Setup**: Configured with `ts-jest` preset
- **Environment**: Node.js testing environment
- **Coverage**: Integrated coverage collection

### Vitest (Alternative Framework)
- **Modern alternative** to Jest
- **Faster execution** with native ESM support
- **Used in some packages** like `js-html`

## Jest Configuration

### Standard Jest Setup

Most packages use a standardized Jest configuration:

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['dotenv/config', './setup.ts'],
  roots: ['<rootDir>/src'],
  maxWorkers: 1,
  transform: {
    '^.+\\.(tsx|ts)?$': 'ts-jest'
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'd.ts'],
  transformIgnorePatterns: ['<rootDir>/node_modules/'],
  collectCoverageFrom: ['src/**/*.ts']
}
```

### Key Configuration Options

- **`maxWorkers: 1`**: Ensures sequential test execution to avoid race conditions
- **`setupFiles`**: Loads environment variables and setup files
- **`testRegex`**: Matches test files with `.test.ts` or `.spec.ts` extensions
- **`collectCoverageFrom`**: Includes all source files in coverage reports

## Writing Unit Tests

### Basic Test Structure

```typescript
// Example: Folders.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Folders } from './Folders'
import * as fs from 'fs'
import * as path from 'path'

describe('FoldersClass', () => {
  const tmpDir = path.join(__dirname, '__test_tmp__')
  const testFile = path.join(tmpDir, 'file.txt')

  beforeEach(() => {
    // Setup test environment
    Folders.removeSync(tmpDir)
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    // Cleanup test environment
    Folders.removeSync(tmpDir)
  })

  describe('findOrCreate', () => {
    it('creates the directory for a given file path if it does not exist', () => {
      const filePath = path.join(tmpDir, 'newdir', 'file.txt')
      expect(fs.existsSync(path.dirname(filePath))).toBe(false)
      
      Folders.findOrCreate(filePath)
      
      expect(fs.existsSync(path.dirname(filePath))).toBe(true)
    })

    it('returns true if the directory already exists', () => {
      const filePath = path.join(tmpDir, 'file.txt')
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      
      expect(Folders.findOrCreate(filePath)).toBe(true)
    })
  })
})
```

### Test Organization Patterns

#### 1. Describe Blocks
- **Outer describe**: Class or module name
- **Inner describe**: Method or feature groups
- **Nested describe**: Specific scenarios

#### 2. Test Lifecycle
- **`beforeEach`**: Setup before each test
- **`afterEach`**: Cleanup after each test
- **`beforeAll`**: One-time setup for all tests
- **`afterAll`**: One-time cleanup for all tests

## Testing Patterns

### 1. Static Method Testing

```typescript
describe('HtmlProcessor', () => {
  it('should detect empty HTML', () => {
    expect(HtmlProcessor.isEmptyHTML('')).toBe(true)
    expect(HtmlProcessor.isEmptyHTML('   ')).toBe(true)
    expect(HtmlProcessor.isEmptyHTML('<div></div>')).toBe(true)
    expect(HtmlProcessor.isEmptyHTML('<span>content</span>')).toBe(false)
  })

  it('should extract text from HTML', () => {
    const html = '<div>Hello <b>World</b><br>Test</div>'
    expect(HtmlProcessor.extractTextFromHTML(html)).toBe('Hello WorldTest')
  })
})
```

### 2. Instance Method Testing

```typescript
describe('HtmlProcessor instance', () => {
  it('should parse and sanitize HTML', () => {
    const html = '<div><b>Bold</b> <script>alert(1)</script></div>'
    const processor = new HtmlProcessor({ html })
    
    const parsed = processor.getParsedHtml()
    expect(parsed).toContain('Bold')
    expect(parsed).not.toContain('script')
  })
})
```

### 3. Private Method Testing

```typescript
it('should format attributes correctly', () => {
  const processor = new HtmlProcessor({ html: '' })
  
  // @ts-expect-error testing private method
  expect(processor.formatAttributes({})).toBe('')
  
  // @ts-expect-error testing private method
  expect(processor.formatAttributes({ href: 'x', class: 'y' }))
    .toBe(' href="x" class="y"')
})
```

### 4. Async Testing

```typescript
describe('searchFileIn', () => {
  it('finds all files recursively', async () => {
    const files = await Folders.searchFileIn({ 
      dir: tmpDir, 
      fileList: [] 
    })
    
    expect(files.sort()).toEqual([testFile, subFile].sort())
  })
})
```

### 5. Error Handling Testing

```typescript
it('should handle getTruncatedHtml with empty HTML', () => {
  const processor = new HtmlProcessor({ html: '' })
  
  const truncated = processor.getTruncatedHtml({
    truncate: 5,
    ellipsis: '...'
  })
  
  expect(truncated).toBe('')
})
```

## Test Utilities

### 1. Shared Test Suites

For testing multiple implementations of the same interface:

```typescript
// sharedBrokerTests.ts
export function runMessageBrokerTestSuite(broker: MessageBroker) {
  const queueName = 'TestQueue'

  beforeAll(async () => {
    await broker.connect()
  })

  afterAll(async () => {
    await broker.close()
  })

  it('should connect and publish a message', async () => {
    const messageSent = await broker.publish({
      queueName,
      data: { myData: 'hello' }
    })

    expect(messageSent).toBe(true)
  })
}

// Usage in specific tests
describe('FastQBroker', () => {
  const broker = new FastQBroker()
  runMessageBrokerTestSuite(broker)
})
```

### 2. Test Data Generation

```typescript
// Generate test data with random values
const randomId = Math.floor(Math.random() * 1000000)
const testEmail = `test${randomId}@example.com`
```

### 3. File System Testing

```typescript
beforeEach(() => {
  // Clean up test directories
  Folders.removeSync(tmpDir)
  fs.mkdirSync(tmpDir, { recursive: true })
})

afterEach(() => {
  // Ensure cleanup
  Folders.removeSync(tmpDir)
})
```

## Mocking and Stubbing

### 1. Vitest Mocking

```typescript
import { vi } from 'vitest'

it('should handle message consumption', async () => {
  const handle = vi.fn(async () => {
    // Mock implementation
  })

  await broker.subscribe({
    queueName,
    handle,
    topics: ['topic']
  })

  expect(handle).toHaveBeenCalled()
})
```

### 2. Promise-based Testing

```typescript
it('should handle multiple topics', async () => {
  let resolvePromise: () => void
  const messageHandled = new Promise<void>((res, rej) => {
    resolvePromise = res
    setTimeout(() => rej(new Error('Message not handled in time')), 9000)
  })

  const handle = vi.fn(async () => {
    resolvePromise()
  })

  await broker.subscribe({
    queueName: exchangeName,
    handle,
    topics: ['topic.a', 'topic.b']
  })

  await messageHandled
  expect(handle).toHaveBeenCalled()
}, { timeout: 10_000 })
```

## Running Tests

### Command Line

```bash
# Run all tests in monorepo
pnpm test

# Run tests for specific package
cd packages/node-utils && pnpm test

# Run specific test file
npx jest -i ./src/Folders.test.ts

# Run with coverage
npx jest --coverage
```

### Development Workflow

```bash
# Watch mode for active development
npx jest --watch

# Run tests matching pattern
npx jest --testNamePattern="should detect empty HTML"

# Run tests for specific file
npx jest Folders.test.ts
```

## Test Coverage

### Coverage Configuration

```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

### Coverage Reports

```bash
# Generate coverage report
npx jest --coverage

# Open coverage report in browser
open coverage/lcov-report/index.html
```

## Best Practices

### 1. Test Naming
- Use descriptive test names that explain the expected behavior
- Follow the pattern: "should [expected behavior] when [condition]"

### 2. Test Organization
- Group related tests in `describe` blocks
- Use nested `describe` blocks for method/feature grouping
- Keep tests focused on single behaviors

### 3. Assertions
- Use specific assertions (`toBe`, `toEqual`, `toContain`)
- Assert both positive and negative cases
- Test edge cases and error conditions

### 4. Test Data
- Use meaningful test data
- Generate random data when needed to avoid test pollution
- Clean up test data after each test

### 5. Async Testing
- Always use `async/await` for async operations
- Set appropriate timeouts for long-running tests
- Handle Promise rejections explicitly

### 6. Mocking
- Mock external dependencies
- Use shared mock implementations for consistency
- Reset mocks between tests

## Common Test Patterns

### 1. Property Testing
```typescript
it('should maintain data integrity', () => {
  const data = { key: 'value' }
  const result = processor.transform(data)
  expect(result).toHaveProperty('key')
  expect(result.key).toBe('value')
})
```

### 2. Boundary Testing
```typescript
it('should handle edge cases', () => {
  expect(processor.process('')).toBe('')
  expect(processor.process(null)).toBe('')
  expect(processor.process(undefined)).toBe('')
})
```

### 3. Error Testing
```typescript
it('should throw on invalid input', () => {
  expect(() => processor.process(invalidData)).toThrow()
  expect(() => processor.process(invalidData)).toThrow('Invalid input')
})
```

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase timeout for async operations
2. **File System Tests**: Ensure proper cleanup in `afterEach`
3. **Mock Issues**: Reset mocks between tests
4. **Coverage Issues**: Check ignored files in configuration

### Debug Tips

```bash
# Run with debug output
npx jest --verbose

# Run single test for debugging
npx jest --testNamePattern="specific test name"

# Use Node.js debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

This comprehensive unit testing guide provides the foundation for writing reliable, maintainable tests in the Fluent ecosystem. Following these patterns ensures consistent testing practices across all packages.