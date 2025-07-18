# End-to-End Testing

End-to-end (E2E) testing in the Fluent ecosystem verifies that the complete application workflow functions correctly from the user's perspective. This includes testing the full stack: frontend, backend, database, and external integrations.

## Overview

E2E tests simulate real user interactions and verify that:
- Complete user workflows function correctly
- Frontend and backend integrate properly
- Database operations work in production-like environments
- External APIs and services integrate correctly
- Performance meets acceptable standards

## Testing Frameworks

### Playwright (Recommended)

Playwright provides cross-browser testing capabilities with excellent TypeScript support.

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI
  }
})
```

### Cypress (Alternative)

Cypress provides excellent debugging capabilities and real-time browser testing.

```typescript
// cypress.config.ts
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    setupNodeEvents(on, config) {
      // Custom event listeners
    }
  }
})
```

## Test Structure

### Page Object Model

Organize tests using the Page Object Model pattern for maintainability:

```typescript
// pages/LoginPage.ts
import { Page, Locator } from '@playwright/test'

export class LoginPage {
  private page: Page
  private emailInput: Locator
  private passwordInput: Locator
  private loginButton: Locator
  private errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('[data-testid="email-input"]')
    this.passwordInput = page.locator('[data-testid="password-input"]')
    this.loginButton = page.locator('[data-testid="login-button"]')
    this.errorMessage = page.locator('[data-testid="error-message"]')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.loginButton.click()
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent()
  }

  async isLoggedIn() {
    return this.page.url().includes('/dashboard')
  }
}
```

### Test Data Management

Create factories for consistent test data:

```typescript
// utils/testData.ts
export class TestDataFactory {
  static createUser(overrides: Partial<User> = {}): User {
    return {
      id: Date.now().toString(),
      email: `user${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      password: 'Password123!',
      ...overrides
    }
  }

  static createPost(userId: string, overrides: Partial<Post> = {}): Post {
    return {
      id: Date.now().toString(),
      title: 'Test Post',
      content: 'This is a test post content',
      userId,
      createdAt: new Date(),
      ...overrides
    }
  }
}
```

## Authentication Testing

### User Registration and Login

```typescript
// tests/auth.spec.ts
import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'
import { RegisterPage } from '../pages/RegisterPage'
import { TestDataFactory } from '../utils/testData'

test.describe('Authentication', () => {
  test('should register new user', async ({ page }) => {
    const registerPage = new RegisterPage(page)
    const user = TestDataFactory.createUser()

    await registerPage.goto()
    await registerPage.register(user)

    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid="welcome-message"]'))
      .toContainText(`Welcome, ${user.firstName}`)
  })

  test('should login existing user', async ({ page }) => {
    const loginPage = new LoginPage(page)
    
    // Pre-create user in database
    const user = await createTestUser({
      email: 'existing@example.com',
      password: 'Password123!'
    })

    await loginPage.goto()
    await loginPage.login(user.email, 'Password123!')

    await expect(page).toHaveURL('/dashboard')
  })

  test('should handle login with invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page)

    await loginPage.goto()
    await loginPage.login('invalid@example.com', 'wrongpassword')

    const errorMessage = await loginPage.getErrorMessage()
    expect(errorMessage).toContain('Invalid credentials')
  })

  test('should logout user', async ({ page }) => {
    // Login first
    await loginAsUser(page, 'testuser@example.com')

    // Logout
    await page.locator('[data-testid="logout-button"]').click()

    await expect(page).toHaveURL('/login')
  })
})
```

### Session Management

```typescript
test.describe('Session Management', () => {
  test('should maintain session across page reloads', async ({ page }) => {
    await loginAsUser(page, 'testuser@example.com')

    await page.reload()
    await expect(page).toHaveURL('/dashboard')
  })

  test('should redirect to login when session expires', async ({ page }) => {
    await loginAsUser(page, 'testuser@example.com')

    // Simulate session expiration
    await page.evaluate(() => {
      localStorage.removeItem('authToken')
    })

    await page.reload()
    await expect(page).toHaveURL('/login')
  })
})
```

## CRUD Operations Testing

### Create, Read, Update, Delete workflows

```typescript
test.describe('Post Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'author@example.com')
  })

  test('should create new post', async ({ page }) => {
    const post = TestDataFactory.createPost('user123')

    await page.goto('/posts/new')
    await page.locator('[data-testid="post-title"]').fill(post.title)
    await page.locator('[data-testid="post-content"]').fill(post.content)
    await page.locator('[data-testid="publish-button"]').click()

    await expect(page).toHaveURL(/\/posts\/\d+/)
    await expect(page.locator('[data-testid="post-title"]'))
      .toContainText(post.title)
  })

  test('should edit existing post', async ({ page }) => {
    const post = await createTestPost('user123')

    await page.goto(`/posts/${post.id}/edit`)
    await page.locator('[data-testid="post-title"]').fill('Updated Title')
    await page.locator('[data-testid="save-button"]').click()

    await expect(page.locator('[data-testid="post-title"]'))
      .toContainText('Updated Title')
  })

  test('should delete post', async ({ page }) => {
    const post = await createTestPost('user123')

    await page.goto(`/posts/${post.id}`)
    
    page.on('dialog', dialog => dialog.accept())
    await page.locator('[data-testid="delete-button"]').click()

    await expect(page).toHaveURL('/posts')
    await expect(page.locator(`[data-testid="post-${post.id}"]`))
      .not.toBeVisible()
  })
})
```

## API Testing

### REST API E2E Testing

```typescript
test.describe('API Integration', () => {
  test('should handle API CRUD operations', async ({ request }) => {
    const authToken = await getAuthToken()

    // Create user via API
    const createResponse = await request.post('/api/users', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        email: 'api@example.com',
        firstName: 'API',
        lastName: 'User'
      }
    })

    expect(createResponse.status()).toBe(201)
    const user = await createResponse.json()

    // Read user via API
    const getResponse = await request.get(`/api/users/${user.id}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })

    expect(getResponse.status()).toBe(200)
    const fetchedUser = await getResponse.json()
    expect(fetchedUser.email).toBe('api@example.com')

    // Update user via API
    const updateResponse = await request.put(`/api/users/${user.id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { firstName: 'Updated' }
    })

    expect(updateResponse.status()).toBe(200)

    // Delete user via API
    const deleteResponse = await request.delete(`/api/users/${user.id}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })

    expect(deleteResponse.status()).toBe(204)
  })
})
```

### GraphQL E2E Testing

```typescript
test.describe('GraphQL Integration', () => {
  test('should handle GraphQL operations', async ({ request }) => {
    const authToken = await getAuthToken()

    const query = `
      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
          id
          email
          firstName
          lastName
        }
      }
    `

    const response = await request.post('/graphql', {
      headers: { 
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        query,
        variables: {
          input: {
            email: 'graphql@example.com',
            firstName: 'GraphQL',
            lastName: 'User'
          }
        }
      }
    })

    expect(response.status()).toBe(200)
    const result = await response.json()
    expect(result.data.createUser.email).toBe('graphql@example.com')
  })
})
```

## File Upload Testing

```typescript
test.describe('File Upload', () => {
  test('should upload file', async ({ page }) => {
    await loginAsUser(page, 'uploader@example.com')

    await page.goto('/upload')

    // Create test file
    const fileContent = 'This is a test file content'
    const buffer = Buffer.from(fileContent)

    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer
    })

    await page.locator('[data-testid="upload-button"]').click()

    await expect(page.locator('[data-testid="upload-success"]'))
      .toBeVisible()
    
    await expect(page.locator('[data-testid="file-name"]'))
      .toContainText('test.txt')
  })

  test('should handle file size validation', async ({ page }) => {
    await loginAsUser(page, 'uploader@example.com')

    await page.goto('/upload')

    // Create large file (simulated)
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024) // 10MB

    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'large.txt',
      mimeType: 'text/plain',
      buffer: largeBuffer
    })

    await page.locator('[data-testid="upload-button"]').click()

    await expect(page.locator('[data-testid="error-message"]'))
      .toContainText('File size too large')
  })
})
```

## Real-time Features Testing

### WebSocket Testing

```typescript
test.describe('Real-time Features', () => {
  test('should handle real-time messages', async ({ page }) => {
    await loginAsUser(page, 'user1@example.com')

    // Open chat page
    await page.goto('/chat')

    // Send message
    await page.locator('[data-testid="message-input"]').fill('Hello World!')
    await page.locator('[data-testid="send-button"]').click()

    // Verify message appears
    await expect(page.locator('[data-testid="message-list"]'))
      .toContainText('Hello World!')

    // Simulate message from another user
    await page.evaluate(() => {
      const ws = new WebSocket('ws://localhost:3000/chat')
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'message',
          content: 'Hello from another user',
          userId: 'user2'
        }))
      }
    })

    // Verify received message appears
    await expect(page.locator('[data-testid="message-list"]'))
      .toContainText('Hello from another user')
  })
})
```

## Performance Testing

### Load Testing

```typescript
test.describe('Performance', () => {
  test('should handle page load performance', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/dashboard')

    const endTime = Date.now()
    const loadTime = endTime - startTime

    expect(loadTime).toBeLessThan(3000) // Less than 3 seconds
  })

  test('should handle concurrent users', async ({ browser }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ])

    const pages = await Promise.all([
      contexts[0].newPage(),
      contexts[1].newPage(),
      contexts[2].newPage()
    ])

    // Simulate concurrent user actions
    const startTime = Date.now()

    await Promise.all([
      loginAsUser(pages[0], 'user1@example.com'),
      loginAsUser(pages[1], 'user2@example.com'),
      loginAsUser(pages[2], 'user3@example.com')
    ])

    const endTime = Date.now()
    const totalTime = endTime - startTime

    expect(totalTime).toBeLessThan(5000) // Less than 5 seconds

    // Cleanup
    await Promise.all(contexts.map(context => context.close()))
  })
})
```

## Mobile Testing

### Responsive Design Testing

```typescript
test.describe('Mobile Responsiveness', () => {
  test('should work on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE

    await loginAsUser(page, 'mobile@example.com')

    await page.goto('/dashboard')

    // Check mobile navigation
    await expect(page.locator('[data-testid="mobile-menu-button"]'))
      .toBeVisible()
    
    await page.locator('[data-testid="mobile-menu-button"]').click()
    
    await expect(page.locator('[data-testid="mobile-menu"]'))
      .toBeVisible()
  })

  test('should handle touch interactions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    await loginAsUser(page, 'touch@example.com')

    await page.goto('/posts')

    // Test swipe-to-delete
    const postElement = page.locator('[data-testid="post-1"]')
    
    await postElement.hover()
    await page.mouse.down()
    await page.mouse.move(100, 0) // Swipe right
    await page.mouse.up()

    await expect(page.locator('[data-testid="delete-option"]'))
      .toBeVisible()
  })
})
```

## Cross-browser Testing

```typescript
test.describe('Cross-browser Compatibility', () => {
  ['chromium', 'firefox', 'webkit'].forEach(browserName => {
    test(`should work in ${browserName}`, async ({ page }) => {
      await page.goto('/dashboard')

      // Test basic functionality
      await expect(page.locator('[data-testid="logo"]')).toBeVisible()
      await expect(page.locator('[data-testid="navigation"]')).toBeVisible()

      // Test JavaScript functionality
      await page.locator('[data-testid="dropdown-toggle"]').click()
      await expect(page.locator('[data-testid="dropdown-menu"]')).toBeVisible()
    })
  })
})
```

## Database State Testing

```typescript
test.describe('Database Integration', () => {
  test('should maintain data consistency', async ({ page }) => {
    await loginAsUser(page, 'datauser@example.com')

    // Create post via UI
    await page.goto('/posts/new')
    await page.locator('[data-testid="post-title"]').fill('Test Post')
    await page.locator('[data-testid="post-content"]').fill('Content')
    await page.locator('[data-testid="publish-button"]').click()

    // Verify in database
    const post = await getPostFromDatabase('Test Post')
    expect(post).toBeDefined()
    expect(post.title).toBe('Test Post')

    // Verify in UI
    await page.goto('/posts')
    await expect(page.locator('[data-testid="post-list"]'))
      .toContainText('Test Post')
  })

  test('should handle concurrent data modifications', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    await loginAsUser(page1, 'user1@example.com')
    await loginAsUser(page2, 'user2@example.com')

    // Both users try to edit the same post
    const postId = await createTestPost('shared-post')

    await Promise.all([
      page1.goto(`/posts/${postId}/edit`),
      page2.goto(`/posts/${postId}/edit`)
    ])

    // User 1 makes changes
    await page1.locator('[data-testid="post-title"]').fill('Updated by User 1')
    await page1.locator('[data-testid="save-button"]').click()

    // User 2 makes changes
    await page2.locator('[data-testid="post-title"]').fill('Updated by User 2')
    await page2.locator('[data-testid="save-button"]').click()

    // Verify conflict handling
    await expect(page2.locator('[data-testid="conflict-message"]'))
      .toBeVisible()

    await context1.close()
    await context2.close()
  })
})
```

## Test Environment Setup

### Docker Test Environment

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=test
      - DATABASE_URL=postgresql://test:test@db:5432/test_db
    depends_on:
      - db
      - redis

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=test_db
      - POSTGRES_USER=test
      - POSTGRES_PASSWORD=test
    ports:
      - "5432:5432"

  redis:
    image: redis:6
    ports:
      - "6379:6379"
```

### Test Data Seeding

```typescript
// scripts/seedTestData.ts
export async function seedTestData() {
  // Clear existing data
  await clearDatabase()

  // Create test users
  const users = await Promise.all([
    createUser({ email: 'admin@example.com', role: 'admin' }),
    createUser({ email: 'user@example.com', role: 'user' }),
    createUser({ email: 'editor@example.com', role: 'editor' })
  ])

  // Create test posts
  await Promise.all([
    createPost({ title: 'Test Post 1', userId: users[0].id }),
    createPost({ title: 'Test Post 2', userId: users[1].id }),
    createPost({ title: 'Test Post 3', userId: users[2].id })
  ])

  console.log('Test data seeded successfully')
}
```

## CI/CD Integration

### GitHub Actions E2E Pipeline

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: pnpm install
      
    - name: Build application
      run: pnpm build
      
    - name: Seed test data
      run: pnpm seed:test
      
    - name: Install Playwright
      run: npx playwright install --with-deps
      
    - name: Run E2E tests
      run: pnpm test:e2e
      
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
```

## Best Practices

### 1. Test Organization
- Use descriptive test names
- Group related tests with describe blocks
- Implement proper setup and teardown

### 2. Data Management
- Use test-specific data
- Clean up after each test
- Use factories for consistent data creation

### 3. Page Object Model
- Encapsulate page interactions
- Create reusable page objects
- Use data-testid attributes for reliable selectors

### 4. Assertions
- Use appropriate waiting strategies
- Assert on visible elements
- Test both positive and negative scenarios

### 5. Performance
- Set appropriate timeouts
- Use parallel execution where possible
- Monitor test execution time

### 6. Maintenance
- Keep tests simple and focused
- Update tests with UI changes
- Use shared utilities for common operations

This comprehensive E2E testing guide ensures that the complete Fluent application workflow functions correctly from the user's perspective, providing confidence in production deployments.