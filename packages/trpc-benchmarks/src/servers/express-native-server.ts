// Native Express server without tRPC - using Express routing
// Run: npx tsx src/servers/express-native-server.ts

import express from 'express'
import { prisma } from '../db/client.js'

const PORT = Number(process.env.PORT) || 3007
const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    runtime: 'node',
    framework: 'express-native',
    database: 'sqlite'
  })
})

// Product routes
app.get('/api/products', async (req, res) => {
  const limit = Number(req.query.limit) || 20
  const offset = Number(req.query.offset) || 0
  const categoryId = req.query.categoryId as string | undefined

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

  res.json({ products, total, limit, offset })
})

app.get('/api/products/search', async (req, res) => {
  const q = (req.query.q as string) || ''
  const limit = Number(req.query.limit) || 20

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

  res.json({ products, query: q })
})

app.get('/api/products/:id', async (req, res) => {
  const id = req.params.id

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
    return res.status(404).json({ error: 'Product not found' })
  }

  res.json(product)
})

// Category routes
app.get('/api/categories', async (_req, res) => {
  const categories = await prisma.category.findMany({
    include: {
      _count: { select: { products: true } }
    }
  })
  res.json(categories)
})

// User routes
app.get('/api/users/:id', async (req, res) => {
  const id = req.params.id

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
    return res.status(404).json({ error: 'User not found' })
  }

  res.json(user)
})

app.get('/api/users/:id/orders', async (req, res) => {
  const id = req.params.id
  const limit = Number(req.query.limit) || 10

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

  res.json(orders)
})

// Order routes
app.post('/api/orders', async (req, res) => {
  const { userId, items } = req.body as { userId: string; items: { productId: string; quantity: number }[] }

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
      return res.status(400).json({ error: `Product ${item.productId} not found` })
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for ${product.name}` })
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

  res.json(order)
})

app.get('/api/orders/:id', async (req, res) => {
  const id = req.params.id

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
    return res.status(404).json({ error: 'Order not found' })
  }

  res.json(order)
})

// Analytics routes
app.get('/api/analytics/dashboard', async (_req, res) => {
  const [totalUsers, totalProducts, totalOrders, revenue] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } })
  ])

  res.json({
    totalUsers,
    totalProducts,
    totalOrders,
    totalRevenue: revenue._sum.total || 0
  })
})

app.get('/api/analytics/revenue-by-category', async (_req, res) => {
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

  res.json(result)
})

const server = app.listen(PORT, () => {
  console.log(`[Express-Native+Node+SQLite] Server running on http://localhost:${PORT}`)
  console.log(`[Express-Native+Node+SQLite] API endpoint: http://localhost:${PORT}/api`)
  console.log(`[Express-Native+Node+SQLite] Node version: ${process.version}`)
  console.log(`[Express-Native+Node+SQLite] PID: ${process.pid}`)
})

process.on('SIGTERM', () => {
  console.log('[Express-Native+Node+SQLite] SIGTERM received, shutting down...')
  server.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('[Express-Native+Node+SQLite] SIGINT received, shutting down...')
  server.close(() => process.exit(0))
})
