# Automated Testing Pipeline

The Fluent ecosystem employs comprehensive automated testing to ensure code quality, reliability, and performance. This document outlines the testing infrastructure and CI/CD pipeline.

## Testing Architecture

### Test Pyramid

```
    ┌─────────────┐
    │   E2E Tests │ (Few, Expensive)
    │     🔺      │
    └─────────────┘
   ┌─────────────────┐
   │Integration Tests│ (Some, Moderate)
   │       🔺        │
   └─────────────────┘
  ┌───────────────────┐
  │   Unit Tests      │ (Many, Fast)
  │      🔺           │
  └───────────────────┘
```

### Test Types Distribution

- **Unit Tests**: 70% - Fast, isolated, comprehensive
- **Integration Tests**: 20% - Component interaction
- **E2E Tests**: 10% - Full user workflows

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18, 20]
        database: [postgres, mysql, sqlite]
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: test_db
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
        ports:
          - 3306:3306
      
      redis:
        image: redis:6
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9.15.2

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Run linting
        run: pnpm lint

      - name: Run type checking
        run: pnpm type-check

      - name: Run unit tests
        run: pnpm test:unit
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          MYSQL_URL: mysql://root:test@localhost:3306/test_db
          REDIS_URL: redis://localhost:6379

      - name: Run integration tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          MYSQL_URL: mysql://root:test@localhost:3306/test_db
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          file: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
```

### Performance Testing Pipeline

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  performance:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_USER: perf
          POSTGRES_PASSWORD: perf
          POSTGRES_DB: perf_db
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Seed performance data
        run: pnpm seed:performance
        env:
          DATABASE_URL: postgresql://perf:perf@localhost:5432/perf_db

      - name: Run performance tests
        run: pnpm test:performance
        env:
          DATABASE_URL: postgresql://perf:perf@localhost:5432/perf_db

      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-results.json

      - name: Performance regression check
        run: pnpm check:performance-regression
```

### Security Testing Pipeline

```yaml
# .github/workflows/security.yml
name: Security Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 3 * * 1' # Weekly on Monday at 3 AM

jobs:
  security:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Audit dependencies
        run: pnpm audit --audit-level high

      - name: Check for vulnerabilities
        run: pnpm check:vulnerabilities

      - name: SAST scan
        uses: github/codeql-action/analyze@v2
        with:
          languages: javascript

      - name: Container security scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.js (root)
module.exports = {
  projects: [
    '<rootDir>/packages/*/jest.config.js'
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/*.spec.ts',
    '!packages/*/src/**/*.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '<rootDir>/packages/**/*.test.ts',
    '<rootDir>/packages/**/*.spec.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ]
}
```

### Package-specific Configuration

```javascript
// packages/fluent/jest.config.js
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
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '.test.ts',
    '.spec.ts'
  ]
}
```

## Test Execution

### Local Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test packages/fluent/src/Connector.test.ts

# Run tests for specific package
cd packages/fluent && pnpm test
```

### CI Testing

```bash
# Package-level commands
pnpm test:unit          # Unit tests only
pnpm test:integration   # Integration tests only
pnpm test:e2e          # End-to-end tests only
pnpm test:performance  # Performance tests only
pnpm test:security     # Security tests only

# Quality checks
pnpm lint              # ESLint
pnpm type-check        # TypeScript type checking
pnpm format:check      # Prettier formatting
pnpm audit             # Security audit
```

## Test Data Management

### Test Database Setup

```typescript
// tests/setup/database.ts
import { DataSource } from 'typeorm'
import { User } from '../../src/entities/User'
import { Post } from '../../src/entities/Post'

export async function createTestDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [User, Post],
    synchronize: true,
    logging: false
  })

  await dataSource.initialize()
  return dataSource
}

export async function seedTestData(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User)
  const postRepository = dataSource.getRepository(Post)

  // Create test users
  const users = await userRepository.save([
    { email: 'user1@example.com', firstName: 'User', lastName: 'One' },
    { email: 'user2@example.com', firstName: 'User', lastName: 'Two' }
  ])

  // Create test posts
  await postRepository.save([
    { title: 'Test Post 1', content: 'Content 1', userId: users[0].id },
    { title: 'Test Post 2', content: 'Content 2', userId: users[1].id }
  ])
}
```

### Test Fixtures

```typescript
// tests/fixtures/users.ts
export const userFixtures = {
  validUser: {
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    age: 30
  },
  
  invalidUser: {
    email: 'invalid-email',
    firstName: '',
    lastName: 'Doe'
  },
  
  createUsers: (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      email: `user${i}@example.com`,
      firstName: `User${i}`,
      lastName: 'Test',
      age: 20 + i
    }))
  }
}
```

## Test Utilities

### Mock Factory

```typescript
// tests/utils/mockFactory.ts
import { jest } from '@jest/globals'
import { Repository } from 'typeorm'

export function createMockRepository<T>(): jest.Mocked<Repository<T>> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    query: jest.fn(),
    manager: {} as any,
    metadata: {} as any,
    queryRunner: {} as any,
    target: {} as any
  } as jest.Mocked<Repository<T>>
}

export function createMockDataSource() {
  return {
    getRepository: jest.fn(),
    initialize: jest.fn(),
    destroy: jest.fn(),
    isInitialized: true,
    query: jest.fn(),
    transaction: jest.fn()
  }
}
```

### Test Helpers

```typescript
// tests/utils/testHelpers.ts
import { DataSource } from 'typeorm'
import { createTestDataSource } from '../setup/database'

export class TestContext {
  public dataSource: DataSource
  
  async setup(): Promise<void> {
    this.dataSource = await createTestDataSource()
  }
  
  async teardown(): Promise<void> {
    await this.dataSource.destroy()
  }
  
  async clearDatabase(): Promise<void> {
    const entities = this.dataSource.entityMetadatas
    
    for (const entity of entities) {
      const repository = this.dataSource.getRepository(entity.name)
      await repository.clear()
    }
  }
}

// Usage in tests
describe('Integration Tests', () => {
  const testContext = new TestContext()
  
  beforeAll(async () => {
    await testContext.setup()
  })
  
  afterAll(async () => {
    await testContext.teardown()
  })
  
  beforeEach(async () => {
    await testContext.clearDatabase()
  })
})
```

## Coverage and Reporting

### Coverage Configuration

```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.d.ts',
    '!src/index.ts' // Entry points
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Package-specific thresholds
    'packages/fluent/src/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  coverageReporters: [
    'text',
    'html',
    'lcov',
    'json'
  ]
}
```

### Coverage Reports

```bash
# Generate coverage reports
pnpm test:coverage

# Open HTML coverage report
open coverage/lcov-report/index.html

# Coverage summary
pnpm test:coverage:summary
```

## Test Debugging

### VS Code Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Jest Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--runInBand",
        "--testPathPattern=${relativeFile}"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "port": 9229
    },
    {
      "name": "Debug Current Test",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--runInBand",
        "--testNamePattern=${selectedText}"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Debug Commands

```bash
# Debug specific test
node --inspect-brk node_modules/.bin/jest --runInBand --testNamePattern="should create user"

# Debug with VS Code
# F5 in VS Code with debug configuration
```

## Quality Gates

### Pre-commit Hooks

```json
// .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run tests on changed files
pnpm test:changed

# Run linting
pnpm lint

# Run type checking
pnpm type-check
```

### Pre-push Hooks

```json
// .husky/pre-push
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run full test suite
pnpm test

# Run integration tests
pnpm test:integration
```

## Test Monitoring

### Test Results Dashboard

```typescript
// scripts/testDashboard.ts
import { TestResults } from './types'

export class TestDashboard {
  async generateReport(): Promise<TestResults> {
    const results = await this.collectTestResults()
    const metrics = this.calculateMetrics(results)
    
    return {
      totalTests: metrics.total,
      passedTests: metrics.passed,
      failedTests: metrics.failed,
      coverage: metrics.coverage,
      duration: metrics.duration,
      trends: this.calculateTrends(results)
    }
  }
  
  private async collectTestResults(): Promise<any[]> {
    // Implementation to collect test results
    return []
  }
  
  private calculateMetrics(results: any[]): any {
    // Implementation to calculate metrics
    return {}
  }
  
  private calculateTrends(results: any[]): any {
    // Implementation to calculate trends
    return {}
  }
}
```

### Performance Monitoring

```typescript
// Monitor test execution time
const testMetrics = {
  slowTests: [],
  testDuration: new Map(),
  
  recordTestDuration(testName: string, duration: number) {
    this.testDuration.set(testName, duration)
    
    if (duration > 1000) { // 1 second threshold
      this.slowTests.push({ testName, duration })
    }
  },
  
  generateReport() {
    return {
      totalTests: this.testDuration.size,
      averageDuration: this.calculateAverage(),
      slowTests: this.slowTests.sort((a, b) => b.duration - a.duration)
    }
  }
}
```

## Best Practices

### 1. Test Organization
- Group related tests with describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Test Data
- Use factories for test data creation
- Clean up after each test
- Use realistic but minimal data

### 3. Mocking
- Mock external dependencies
- Use dependency injection for testability
- Reset mocks between tests

### 4. Performance
- Keep tests fast and focused
- Use parallel execution where possible
- Monitor test execution time

### 5. Maintenance
- Keep tests up to date with code changes
- Refactor tests regularly
- Remove obsolete tests

This comprehensive automated testing pipeline ensures high code quality, reliability, and maintainability across the entire Fluent ecosystem.