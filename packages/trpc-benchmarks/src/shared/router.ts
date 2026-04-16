// npx tsx src/shared/router.ts (for type checking)
import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { z } from 'zod'

/**
 * Shared tRPC router for benchmarking Express+Node vs Bun+Hono
 *
 * Endpoint categories:
 * 1. Simple queries (minimal overhead)
 * 2. Data queries (JSON serialization)
 * 3. Mutations (input validation + processing)
 * 4. Computation (CPU-bound operations)
 */

// Initialize tRPC
const t = initTRPC.create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure

// Simulated data store
const users = new Map<string, { id: string; name: string; email: string }>()
const items = Array.from({ length: 1000 }, (_, i) => ({
  id: `item-${i}`,
  name: `Item ${i}`,
  price: Math.random() * 100,
  category: ['electronics', 'clothing', 'food', 'books'][i % 4],
  inStock: Math.random() > 0.3,
}))

// Seed some users
for (let i = 0; i < 100; i++) {
  const id = `user-${i}`
  users.set(id, {
    id,
    name: `User ${i}`,
    email: `user${i}@example.com`,
  })
}

// Input schemas
const getUserInput = z.object({
  id: z.string(),
})

const createUserInput = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
})

const listItemsInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
})

const computeInput = z.object({
  iterations: z.number().int().min(1).max(100000).default(1000),
})

const batchInput = z.object({
  ids: z.array(z.string()).min(1).max(50),
})

// Create the router
export const appRouter = router({
  // Simple health check - minimal overhead
  health: publicProcedure.query(() => {
    return { status: 'ok', timestamp: Date.now() }
  }),

  // Simple ping - absolute minimum
  ping: publicProcedure.query(() => 'pong'),

  // Get server info
  info: publicProcedure.query(() => ({
    runtime: typeof Bun !== 'undefined' ? 'bun' : 'node',
    version: typeof Bun !== 'undefined' ? Bun.version : process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    uptime: process.uptime(),
  })),

  // User operations
  user: router({
    // Get single user
    get: publicProcedure.input(getUserInput).query(({ input }) => {
      const user = users.get(input.id)
      if (!user) {
        throw new Error(`User ${input.id} not found`)
      }
      return user
    }),

    // Create user (mutation)
    create: publicProcedure.input(createUserInput).mutation(({ input }) => {
      const id = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const user = { id, name: input.name ?? '', email: input.email ?? '' }
      users.set(id, user)
      return user
    }),

    // List all users
    list: publicProcedure.query(() => {
      return Array.from(users.values())
    }),

    // Batch get users
    batch: publicProcedure.input(batchInput).query(({ input }) => {
      return input.ids.map(id => users.get(id)).filter(Boolean)
    }),
  }),

  // Item operations (larger data sets)
  items: router({
    // Paginated list with filtering
    list: publicProcedure.input(listItemsInput).query(({ input }) => {
      let filtered = items
      if (input.category) {
        filtered = items.filter(item => item.category === input.category)
      }
      const start = (input.page - 1) * input.pageSize
      const end = start + input.pageSize
      return {
        items: filtered.slice(start, end),
        total: filtered.length,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(filtered.length / input.pageSize),
      }
    }),

    // Get all items (large response)
    all: publicProcedure.query(() => items),

    // Get item count
    count: publicProcedure.query(() => ({ count: items.length })),
  }),

  // Computation endpoints (CPU-bound)
  compute: router({
    // Fibonacci (recursive, inefficient on purpose)
    fibonacci: publicProcedure
      .input(z.object({ n: z.number().int().min(1).max(35) }))
      .query(({ input }) => {
        const fib = (n: number): number => {
          if (n <= 1) {
            return n
          }
          return fib(n - 1) + fib(n - 2)
        }
        return { n: input.n, result: fib(input.n) }
      }),

    // Prime check
    isPrime: publicProcedure
      .input(z.object({ n: z.number().int().min(1) }))
      .query(({ input }) => {
        const isPrime = (n: number): boolean => {
          if (n < 2) {
            return false
          }
          for (let i = 2; i <= Math.sqrt(n); i++) {
            if (n % i === 0) {
              return false
            }
          }
          return true
        }
        return { n: input.n, isPrime: isPrime(input.n) }
      }),

    // Hash computation (simulate work)
    hash: publicProcedure.input(computeInput).query(({ input }) => {
      let hash = 0
      for (let i = 0; i < input.iterations; i++) {
        hash = ((hash << 5) - hash + i) | 0
      }
      return { iterations: input.iterations, hash }
    }),

    // Array sorting benchmark
    sort: publicProcedure
      .input(
        z.object({ size: z.number().int().min(1).max(10000).default(1000) }),
      )
      .query(({ input }) => {
        const arr = Array.from({ length: input.size }, () => Math.random())
        const start = performance.now()
        arr.sort((a, b) => a - b)
        const duration = performance.now() - start
        return { size: input.size, durationMs: duration }
      }),
  }),

  // Echo endpoint for payload testing
  echo: publicProcedure
    .input(z.object({ data: z.unknown() }))
    .mutation(({ input }) => input.data),
})

// Export type for client
export type AppRouter = typeof appRouter
