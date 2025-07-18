# Contributing to Fluent

Thank you for your interest in contributing to the Fluent ecosystem! This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contribution Workflow](#contribution-workflow)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Release Process](#release-process)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please read it before contributing.

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

## Getting Started

### Prerequisites

- **Node.js** 18 or higher
- **pnpm** 9.15.2 or higher
- **Git** for version control
- **TypeScript** knowledge

### Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/fluent.git
   cd fluent
   ```

3. **Install dependencies**:
   ```bash
   pnpm install
   ```

4. **Build all packages**:
   ```bash
   pnpm build
   ```

5. **Run tests**:
   ```bash
   pnpm test
   ```

## Development Setup

### Workspace Structure

The Fluent ecosystem is organized as a monorepo with the following structure:

```
fluent/
├── packages/
│   ├── fluent/                 # Core package
│   ├── js-utils/              # Browser/Node utilities
│   ├── node-utils/            # Node.js utilities
│   ├── fluent-firebase/       # Firebase connector
│   ├── fluent-loki/           # LokiJS connector
│   ├── fluent-pouchdb/        # PouchDB connector
│   ├── queue-core/            # Queue system
│   └── uploads/               # File upload handlers
├── package.json               # Root package.json
├── pnpm-workspace.yaml        # Workspace configuration
├── turbo.json                 # Turbo configuration
└── tsconfig.json              # TypeScript configuration
```

### Available Scripts

#### Root Level Commands

```bash
# Build all packages
pnpm build

# Run development mode
pnpm dev

# Run tests
pnpm test

# Run linting
pnpm lint

# Clean all node_modules
pnpm clean

# Clean turbo cache
pnpm clean:turbo

# Version packages
pnpm cs

# Publish packages
pnpm cs:publish
```

#### Package Level Commands

```bash
# Navigate to specific package
cd packages/fluent

# Build specific package
pnpm build

# Run tests for specific package
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
npx jest -i ./src/MyComponent.test.ts
```

### IDE Setup

#### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "jest.autoRun": "off",
  "jest.showCoverageOnLoad": false
}
```

#### Recommended Extensions

- **TypeScript Importer** - Auto imports
- **Prettier** - Code formatting
- **ESLint** - Linting
- **Jest** - Testing support
- **GitLens** - Git integration
- **Turbo Console Log** - Debugging

## Contribution Workflow

### 1. Create an Issue

Before starting work, create an issue describing:
- **Problem**: What issue are you solving?
- **Solution**: How do you plan to solve it?
- **Breaking Changes**: Will this introduce breaking changes?
- **Tests**: How will you test the changes?

### 2. Create a Branch

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Or bug fix branch
git checkout -b fix/bug-description
```

### 3. Make Changes

#### Code Changes
- Write clean, readable code
- Follow TypeScript best practices
- Add type definitions where needed
- Update documentation as needed

#### Add Tests
- Write unit tests for new functionality
- Add integration tests for complex features
- Ensure all tests pass

#### Update Documentation
- Update README files
- Add JSDoc comments
- Update API documentation

### 4. Test Your Changes

```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/fluent && pnpm test

# Run linting
pnpm lint

# Build all packages
pnpm build
```

### 5. Commit Changes

Use conventional commit messages:

```bash
git add .
git commit -m "feat: add new connector interface"

# Or for bug fixes
git commit -m "fix: resolve query builder issue"

# Or for documentation
git commit -m "docs: update API documentation"
```

#### Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Scopes:**
- `fluent`: Core package
- `js-utils`: JS utilities
- `node-utils`: Node utilities
- `firebase`: Firebase connector
- `loki`: LokiJS connector
- `queue`: Queue system
- `uploads`: Upload handlers

### 6. Create Pull Request

1. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create PR** on GitHub with:
   - Clear title and description
   - Reference to related issues
   - Breaking changes (if any)
   - Testing instructions
   - Screenshots (if applicable)

#### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests passing

## Checklist
- [ ] Code follows project standards
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### 7. Code Review Process

#### For Contributors
- Be responsive to feedback
- Make requested changes promptly
- Ask questions if feedback is unclear
- Test changes thoroughly

#### For Reviewers
- Review code quality and standards
- Check for breaking changes
- Verify tests are adequate
- Ensure documentation is updated

### 8. Merge Process

After approval:
1. **Squash and merge** for clean history
2. **Delete feature branch**
3. **Update local repository**:
   ```bash
   git checkout main
   git pull origin main
   git branch -d feature/your-feature-name
   ```

## Code Standards

### TypeScript Standards

#### Type Definitions
```typescript
// Use explicit types
interface User {
  id: string
  email: string
  firstName: string
  lastName: string
}

// Use generics appropriately
interface Repository<T> {
  find(id: string): Promise<T | null>
  create(data: Partial<T>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}
```

#### Function Signatures
```typescript
// Use explicit return types
async function createUser(userData: CreateUserInput): Promise<User> {
  // Implementation
}

// Use proper error handling
async function riskyOperation(): Promise<Result<Data, Error>> {
  try {
    const data = await someAsyncOperation()
    return { success: true, data }
  } catch (error) {
    return { success: false, error }
  }
}
```

### Code Style

#### Naming Conventions
- **Classes**: PascalCase (`UserService`)
- **Interfaces**: PascalCase (`UserInterface`)
- **Functions**: camelCase (`createUser`)
- **Variables**: camelCase (`userData`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **Files**: kebab-case (`user-service.ts`)

#### File Organization
```typescript
// 1. Imports (external packages first)
import { Repository } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'

// 2. Internal imports
import { User } from '../entities/User'
import { UserRepository } from '../repositories/UserRepository'

// 3. Types and interfaces
interface CreateUserInput {
  email: string
  firstName: string
  lastName: string
}

// 4. Constants
const MAX_RETRY_COUNT = 3

// 5. Main code
export class UserService {
  // Implementation
}
```

### Error Handling

#### Use Custom Error Classes
```typescript
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`)
    this.name = 'NotFoundError'
  }
}
```

#### Proper Error Handling
```typescript
async function getUserById(id: string): Promise<User> {
  try {
    const user = await userRepository.findById(id)
    if (!user) {
      throw new NotFoundError('User', id)
    }
    return user
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error
    }
    throw new Error(`Failed to get user: ${error.message}`)
  }
}
```

## Testing Guidelines

### Unit Tests

#### Test Structure
```typescript
// tests/UserService.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UserService } from '../src/UserService'

describe('UserService', () => {
  let userService: UserService
  let mockRepository: jest.Mocked<UserRepository>

  beforeEach(() => {
    mockRepository = createMockRepository()
    userService = new UserService(mockRepository)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      }

      mockRepository.create.mockResolvedValue(mockUser)

      const result = await userService.createUser(userData)

      expect(result).toEqual(mockUser)
      expect(mockRepository.create).toHaveBeenCalledWith(userData)
    })

    it('should throw error for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        firstName: 'John',
        lastName: 'Doe'
      }

      await expect(userService.createUser(userData))
        .rejects
        .toThrow('Invalid email format')
    })
  })
})
```

### Integration Tests

#### Database Integration
```typescript
describe('UserService Integration', () => {
  let dataSource: DataSource
  let userService: UserService

  beforeAll(async () => {
    dataSource = await createTestDataSource()
    userService = new UserService(dataSource.getRepository(User))
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  beforeEach(async () => {
    await dataSource.getRepository(User).clear()
  })

  it('should create and retrieve user', async () => {
    const userData = {
      email: 'integration@example.com',
      firstName: 'Integration',
      lastName: 'Test'
    }

    const createdUser = await userService.createUser(userData)
    const foundUser = await userService.findById(createdUser.id)

    expect(foundUser).toEqual(createdUser)
  })
})
```

### Test Coverage

Maintain test coverage above 80%:

```bash
# Run tests with coverage
pnpm test --coverage

# Coverage requirements in jest.config.js
module.exports = {
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

## Documentation

### JSDoc Comments

```typescript
/**
 * Creates a new user with the provided data
 * 
 * @param userData - The user data to create
 * @returns Promise that resolves to the created user
 * @throws {ValidationError} When user data is invalid
 * @throws {ConflictError} When user already exists
 * 
 * @example
 * ```typescript
 * const user = await userService.createUser({
 *   email: 'john@example.com',
 *   firstName: 'John',
 *   lastName: 'Doe'
 * })
 * ```
 */
async createUser(userData: CreateUserInput): Promise<User> {
  // Implementation
}
```

### README Updates

When adding new features, update relevant README files:

```markdown
## New Feature

Brief description of the new feature.

### Usage

```typescript
import { NewFeature } from '@goatlab/fluent'

const feature = new NewFeature()
await feature.doSomething()
```

### API Reference

#### `NewFeature.doSomething()`

Description of what this method does.

**Parameters:**
- `param1` (string): Description of parameter

**Returns:**
- `Promise<Result>`: Description of return value
```

## Release Process

### Changesets

Use changesets for version management:

```bash
# Add changeset
pnpm changeset

# Select packages to version
# Choose version bump type
# Write changeset description

# Version packages
pnpm changeset version

# Publish packages
pnpm changeset publish
```

### Changeset Examples

```markdown
---
"@goatlab/fluent": major
"@goatlab/js-utils": minor
---

Add new connector interface

This introduces a new connector interface that provides better type safety and improved performance. This is a breaking change as it modifies the public API.

BREAKING CHANGE: The FluentConnector class has been replaced with specific connector classes.
```

## Community Guidelines

### Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Questions and general discussion
- **Discord**: Real-time chat (link in README)

### Reporting Issues

When reporting bugs:
1. Search existing issues first
2. Use the issue template
3. Provide minimal reproduction case
4. Include environment information

### Feature Requests

When requesting features:
1. Explain the use case
2. Provide examples
3. Consider backward compatibility
4. Be open to discussion

## Recognition

Contributors are recognized through:
- **Contributors file**: All contributors listed
- **Release notes**: Major contributors mentioned
- **GitHub**: Contribution activity tracked
- **Discord**: Contributors role and recognition

Thank you for contributing to the Fluent ecosystem! Your contributions help make it better for everyone.