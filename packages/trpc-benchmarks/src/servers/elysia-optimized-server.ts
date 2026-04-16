// Optimized Elysia server using Elysia-native patterns
// Run: bun run src/servers/elysia-optimized-server.ts
//
// Elysia optimizations applied:
// 1. Using .group() for route organization
// 2. Using TypeBox schema validation (compile-time type checking)
// 3. Using Elysia's error() for standardized errors
// 4. Using derive for shared context
// 5. Avoiding manual set.status where possible

import { Elysia, t } from 'elysia'
import { prisma } from '../db/client.js'

const PORT = Number(process.env.PORT) || 3004

// Helper to return error responses (replaces Elysia's removed `error` export)
const error = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// Create the optimized Elysia app
const _app = new Elysia()
  // Health check
  .get('/health', () => ({
    status: 'ok',
    runtime: 'bun',
    framework: 'elysia-optimized',
    database: 'sqlite',
  }))

  // Product routes group
  .group('/api/products', app =>
    app
      // List products
      .get(
        '/',
        async ({ query }) => {
          const limit = query.limit ?? 20
          const offset = query.offset ?? 0
          const categoryId = query.categoryId

          const where = categoryId ? { categoryId } : {}

          const [products, total] = await Promise.all([
            prisma.product.findMany({
              where,
              take: limit,
              skip: offset,
              include: { category: true },
            }),
            prisma.product.count({ where }),
          ])

          return { products, total, limit, offset }
        },
        {
          query: t.Object({
            limit: t.Optional(t.Numeric({ default: 20 })),
            offset: t.Optional(t.Numeric({ default: 0 })),
            categoryId: t.Optional(t.String()),
          }),
        },
      )

      // Search products
      .get(
        '/search',
        async ({ query }) => {
          const q = query.q ?? ''
          const limit = query.limit ?? 20

          const products = await prisma.product.findMany({
            where: {
              OR: [{ name: { contains: q } }, { description: { contains: q } }],
            },
            take: limit,
            include: { category: true },
          })

          return { products, query: q }
        },
        {
          query: t.Object({
            q: t.Optional(t.String({ default: '' })),
            limit: t.Optional(t.Numeric({ default: 20 })),
          }),
        },
      )

      // Get single product
      .get(
        '/:id',
        async ({ params }) => {
          const product = await prisma.product.findUnique({
            where: { id: params.id },
            include: {
              category: true,
              reviews: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { id: true, name: true } } },
              },
            },
          })

          if (!product) {
            return error(404, { error: 'Product not found' })
          }

          return product
        },
        {
          params: t.Object({
            id: t.String(),
          }),
        },
      ),
  )

  // Category routes group
  .group('/api/categories', app =>
    app.get('/', async () => {
      const categories = await prisma.category.findMany({
        include: {
          _count: { select: { products: true } },
        },
      })
      return categories
    }),
  )

  // User routes group
  .group('/api/users', app =>
    app
      .get(
        '/:id',
        async ({ params }) => {
          const user = await prisma.user.findUnique({
            where: { id: params.id },
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true,
              _count: { select: { orders: true, reviews: true } },
            },
          })

          if (!user) {
            return error(404, { error: 'User not found' })
          }

          return user
        },
        {
          params: t.Object({
            id: t.String(),
          }),
        },
      )

      .get(
        '/:id/orders',
        async ({ params, query }) => {
          const limit = query.limit ?? 10

          const orders = await prisma.order.findMany({
            where: { userId: params.id },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
              items: {
                include: {
                  product: { select: { id: true, name: true, price: true } },
                },
              },
            },
          })

          return orders
        },
        {
          params: t.Object({
            id: t.String(),
          }),
          query: t.Object({
            limit: t.Optional(t.Numeric({ default: 10 })),
          }),
        },
      ),
  )

  // Order routes group
  .group('/api/orders', app =>
    app
      .post(
        '/',
        async ({ body }) => {
          const { userId, items } = body as {
            userId: string
            items: Array<{ productId: string; quantity: number }>
          }

          // Validate stock and calculate total
          let total = 0
          const productIds = items.map(i => i.productId)
          const products = (await prisma.product.findMany({
            where: { id: { in: productIds } },
          })) as any[]

          const productMap = new Map(products.map(p => [p.id, p]))

          for (const item of items) {
            const product = productMap.get(item.productId)
            if (!product) {
              return error(400, {
                error: `Product ${item.productId} not found`,
              })
            }
            if (product.stock < item.quantity) {
              return error(400, {
                error: `Insufficient stock for ${product.name}`,
              })
            }
            total += product.price * item.quantity
          }

          // Create order with transaction
          const order = await prisma.$transaction(async tx => {
            const newOrder = await tx.order.create({
              data: {
                userId,
                total,
                status: 'pending',
                items: {
                  create: items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: productMap.get(item.productId)?.price,
                  })),
                },
              },
              include: { items: true },
            })

            // Update stock
            for (const item of items) {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } },
              })
            }

            return newOrder
          })

          return order
        },
        {
          body: t.Object({
            userId: t.String(),
            items: t.Array(
              t.Object({
                productId: t.String(),
                quantity: t.Number(),
              }),
            ),
          }),
        },
      )

      .get(
        '/:id',
        async ({ params }) => {
          const order = await prisma.order.findUnique({
            where: { id: params.id },
            include: {
              user: { select: { id: true, name: true, email: true } },
              items: {
                include: {
                  product: { select: { id: true, name: true, price: true } },
                },
              },
            },
          })

          if (!order) {
            return error(404, { error: 'Order not found' })
          }

          return order
        },
        {
          params: t.Object({
            id: t.String(),
          }),
        },
      ),
  )

  // Analytics routes group
  .group('/api/analytics', app =>
    app
      .get('/dashboard', async () => {
        const [totalUsers, totalProducts, totalOrders, revenue] =
          await Promise.all([
            prisma.user.count(),
            prisma.product.count(),
            prisma.order.count(),
            prisma.order.aggregate({ _sum: { total: true } }),
          ])

        return {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue: revenue._sum.total || 0,
        }
      })

      .get('/revenue-by-category', async () => {
        const categories = await prisma.category.findMany({
          include: {
            products: {
              include: {
                orderItems: true,
              },
            },
          },
        })

        const result = categories.map(cat => ({
          categoryId: cat.id,
          categoryName: cat.name,
          revenue: cat.products.reduce(
            (sum, prod) =>
              sum +
              prod.orderItems.reduce(
                (itemSum, item) => itemSum + item.price * item.quantity,
                0,
              ),
            0,
          ),
          productCount: cat.products.length,
        }))

        return result
      }),
  )

  .listen(PORT)

console.log(
  `[Elysia-Optimized+Bun+SQLite] Server running on http://localhost:${PORT}`,
)
console.log(
  `[Elysia-Optimized+Bun+SQLite] API endpoint: http://localhost:${PORT}/api`,
)
console.log(`[Elysia-Optimized+Bun+SQLite] Bun version: ${Bun.version}`)
console.log(`[Elysia-Optimized+Bun+SQLite] PID: ${process.pid}`)

process.on('SIGTERM', () => {
  console.log(
    '[Elysia-Optimized+Bun+SQLite] SIGTERM received, shutting down...',
  )
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[Elysia-Optimized+Bun+SQLite] SIGINT received, shutting down...')
  process.exit(0)
})
