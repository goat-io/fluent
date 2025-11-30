// Native Hono server without tRPC - using Hono's native routing
// Run: bun run src/servers/hono-native-server.ts

import { Hono } from 'hono'
import { prisma } from '../db/client.js'

const PORT = Number(process.env.PORT) || 3005

const app = new Hono()

app.get('/health', (c) => c.json({
  status: 'ok',
  runtime: 'bun',
  framework: 'hono-native',
  database: 'sqlite'
}))

// Product routes
app.get('/api/products', async (c) => {
  const limit = Number(c.req.query('limit')) || 20
  const offset = Number(c.req.query('offset')) || 0
  const categoryId = c.req.query('categoryId')

  const where = categoryId ? { categoryId } : {}

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      take: limit,
      skip: offset,
      include: { category: true }
    }),
    prisma.product.count({ where })
  ])

  return c.json({ products, total, limit, offset })
})

app.get('/api/products/search', async (c) => {
  const q = c.req.query('q') || ''
  const limit = Number(c.req.query('limit')) || 20

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { description: { contains: q } }
      ]
    },
    take: limit,
    include: { category: true }
  })

  return c.json({ products, query: q })
})

app.get('/api/products/:id', async (c) => {
  const id = c.req.param('id')

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      reviews: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } }
      }
    }
  })

  if (!product) {
    return c.json({ error: 'Product not found' }, 404)
  }

  return c.json(product)
})

// Category routes
app.get('/api/categories', async (c) => {
  const categories = await prisma.category.findMany({
    include: {
      _count: { select: { products: true } }
    }
  })
  return c.json(categories)
})

// User routes
app.get('/api/users/:id', async (c) => {
  const id = c.req.param('id')

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      _count: { select: { orders: true, reviews: true } }
    }
  })

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json(user)
})

app.get('/api/users/:id/orders', async (c) => {
  const id = c.req.param('id')
  const limit = Number(c.req.query('limit')) || 10

  const orders = await prisma.order.findMany({
    where: { userId: id },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, price: true } } }
      }
    }
  })

  return c.json(orders)
})

// Order routes
app.post('/api/orders', async (c) => {
  const { userId, items } = await c.req.json() as { userId: string; items: { productId: string; quantity: number }[] }

  // Validate stock and calculate total
  let total = 0
  const productIds = items.map(i => i.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } }
  })

  const productMap = new Map(products.map(p => [p.id, p]))

  for (const item of items) {
    const product = productMap.get(item.productId)
    if (!product) {
      return c.json({ error: `Product ${item.productId} not found` }, 400)
    }
    if (product.stock < item.quantity) {
      return c.json({ error: `Insufficient stock for ${product.name}` }, 400)
    }
    total += product.price * item.quantity
  }

  // Create order with transaction
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId,
        total,
        status: 'pending',
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: productMap.get(item.productId)!.price
          }))
        }
      },
      include: { items: true }
    })

    // Update stock
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } }
      })
    }

    return newOrder
  })

  return c.json(order)
})

app.get('/api/orders/:id', async (c) => {
  const id = c.req.param('id')

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: {
        include: { product: { select: { id: true, name: true, price: true } } }
      }
    }
  })

  if (!order) {
    return c.json({ error: 'Order not found' }, 404)
  }

  return c.json(order)
})

// Analytics routes
app.get('/api/analytics/dashboard', async (c) => {
  const [totalUsers, totalProducts, totalOrders, revenue] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } })
  ])

  return c.json({
    totalUsers,
    totalProducts,
    totalOrders,
    totalRevenue: revenue._sum.total || 0
  })
})

app.get('/api/analytics/revenue-by-category', async (c) => {
  const categories = await prisma.category.findMany({
    include: {
      products: {
        include: {
          orderItems: true
        }
      }
    }
  })

  const result = categories.map(cat => ({
    categoryId: cat.id,
    categoryName: cat.name,
    revenue: cat.products.reduce((sum, prod) =>
      sum + prod.orderItems.reduce((itemSum, item) =>
        itemSum + (item.price * item.quantity), 0), 0),
    productCount: cat.products.length
  }))

  return c.json(result)
})

export default {
  port: PORT,
  fetch: app.fetch
}

console.log(`[Hono-Native+Bun+SQLite] Server running on http://localhost:${PORT}`)
console.log(`[Hono-Native+Bun+SQLite] API endpoint: http://localhost:${PORT}/api`)
console.log(`[Hono-Native+Bun+SQLite] Bun version: ${Bun.version}`)
console.log(`[Hono-Native+Bun+SQLite] PID: ${process.pid}`)

process.on('SIGTERM', () => {
  console.log('[Hono-Native+Bun+SQLite] SIGTERM received, shutting down...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[Hono-Native+Bun+SQLite] SIGINT received, shutting down...')
  process.exit(0)
})
