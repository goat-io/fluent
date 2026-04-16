// Native Elysia server without tRPC - using Elysia's native routing
// Run: bun run src/servers/elysia-native-server.ts

import { Elysia } from 'elysia'
import { prisma } from '../db/client.js'

const PORT = Number(process.env.PORT) || 3004

const _app = new Elysia()
  .get('/health', () => ({
    status: 'ok',
    runtime: 'bun',
    framework: 'elysia-native',
    database: 'sqlite',
  }))

  // Product routes
  .get('/api/products', async ({ query }) => {
    const limit = Number(query.limit) || 20
    const offset = Number(query.offset) || 0
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
  })

  .get('/api/products/search', async ({ query }) => {
    const q = query.q || ''
    const limit = Number(query.limit) || 20

    const products = await prisma.product.findMany({
      where: {
        OR: [{ name: { contains: q } }, { description: { contains: q } }],
      },
      take: limit,
      include: { category: true },
    })

    return { products, query: q }
  })

  .get('/api/products/:id', async ({ params, set }) => {
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
      set.status = 404
      return { error: 'Product not found' }
    }

    return product
  })

  // Category routes
  .get('/api/categories', async () => {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
      },
    })
    return categories
  })

  // User routes
  .get('/api/users/:id', async ({ params, set }) => {
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
      set.status = 404
      return { error: 'User not found' }
    }

    return user
  })

  .get('/api/users/:id/orders', async ({ params, query }) => {
    const limit = Number(query.limit) || 10

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
  })

  // Order routes
  .post('/api/orders', async ({ body, set }) => {
    const { userId, items } = body as {
      userId: string
      items: { productId: string; quantity: number }[]
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
        set.status = 400
        return { error: `Product ${item.productId} not found` }
      }
      if (product.stock < item.quantity) {
        set.status = 400
        return { error: `Insufficient stock for ${product.name}` }
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
  })

  .get('/api/orders/:id', async ({ params, set }) => {
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
      set.status = 404
      return { error: 'Order not found' }
    }

    return order
  })

  // Analytics routes
  .get('/api/analytics/dashboard', async () => {
    const [totalUsers, totalProducts, totalOrders, revenue] = await Promise.all(
      [
        prisma.user.count(),
        prisma.product.count(),
        prisma.order.count(),
        prisma.order.aggregate({ _sum: { total: true } }),
      ],
    )

    return {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: revenue._sum.total || 0,
    }
  })

  .get('/api/analytics/revenue-by-category', async () => {
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
  })

  .listen(PORT)

console.log(
  `[Elysia-Native+Bun+SQLite] Server running on http://localhost:${PORT}`,
)
console.log(
  `[Elysia-Native+Bun+SQLite] API endpoint: http://localhost:${PORT}/api`,
)
console.log(`[Elysia-Native+Bun+SQLite] Bun version: ${Bun.version}`)
console.log(`[Elysia-Native+Bun+SQLite] PID: ${process.pid}`)

process.on('SIGTERM', () => {
  console.log('[Elysia-Native+Bun+SQLite] SIGTERM received, shutting down...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[Elysia-Native+Bun+SQLite] SIGINT received, shutting down...')
  process.exit(0)
})
