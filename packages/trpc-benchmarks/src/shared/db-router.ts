// npx tsx src/shared/db-router.ts (for type checking)
// Realistic tRPC router with database operations for benchmarking
import { initTRPC, TRPCError } from '@trpc/server'
import type { PrismaClient } from '@prisma/client'
import superjson from 'superjson'
import { z } from 'zod'

// Context type with Prisma client
export interface Context {
  prisma: PrismaClient
}

// Initialize tRPC with context
const t = initTRPC.context<Context>().create({
  transformer: superjson
})

export const router = t.router
export const publicProcedure = t.procedure

// Input schemas
const paginationInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20)
})

const productFilterInput = z.object({
  categoryId: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  inStock: z.boolean().optional(),
  search: z.string().optional()
}).merge(paginationInput)

const createOrderInput = z.object({
  userId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1)
  })).min(1)
})

const createReviewInput = z.object({
  userId: z.string(),
  productId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000)
})

// Create the database-backed router
export const dbRouter = router({
  // Health check with DB ping
  health: publicProcedure.query(async ({ ctx }) => {
    await ctx.prisma.$queryRaw`SELECT 1`
    return { status: 'ok', database: 'connected', timestamp: Date.now() }
  }),

  // User operations
  user: router({
    // Get user by ID with order count
    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const user = await ctx.prisma.user.findUnique({
          where: { id: input.id },
          include: {
            _count: { select: { orders: true, reviews: true } }
          }
        })
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
        }
        return user
      }),

    // List users with pagination
    list: publicProcedure
      .input(paginationInput)
      .query(async ({ ctx, input }) => {
        const [users, total] = await Promise.all([
          ctx.prisma.user.findMany({
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
              _count: { select: { orders: true } }
            }
          }),
          ctx.prisma.user.count()
        ])
        return {
          users,
          total,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(total / input.pageSize)
        }
      }),

    // Get user's orders
    orders: publicProcedure
      .input(z.object({ userId: z.string() }).merge(paginationInput))
      .query(async ({ ctx, input }) => {
        const [orders, total] = await Promise.all([
          ctx.prisma.order.findMany({
            where: { userId: input.userId },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
              items: {
                include: { product: true }
              }
            }
          }),
          ctx.prisma.order.count({ where: { userId: input.userId } })
        ])
        return { orders, total, page: input.page, totalPages: Math.ceil(total / input.pageSize) }
      })
  }),

  // Product operations
  product: router({
    // Get single product with reviews
    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const product = await ctx.prisma.product.findUnique({
          where: { id: input.id },
          include: {
            category: true,
            reviews: {
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: { user: { select: { id: true, name: true } } }
            },
            _count: { select: { reviews: true, orderItems: true } }
          }
        })
        if (!product) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' })
        }
        return product
      }),

    // List products with filtering and pagination
    list: publicProcedure
      .input(productFilterInput)
      .query(async ({ ctx, input }) => {
        const where: any = {}

        if (input.categoryId) where.categoryId = input.categoryId
        if (input.minPrice !== undefined) where.price = { ...where.price, gte: input.minPrice }
        if (input.maxPrice !== undefined) where.price = { ...where.price, lte: input.maxPrice }
        if (input.inStock) where.stock = { gt: 0 }
        if (input.search) {
          where.OR = [
            { name: { contains: input.search } },
            { description: { contains: input.search } }
          ]
        }

        const [products, total] = await Promise.all([
          ctx.prisma.product.findMany({
            where,
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
              category: true,
              _count: { select: { reviews: true } }
            }
          }),
          ctx.prisma.product.count({ where })
        ])

        return {
          products,
          total,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(total / input.pageSize)
        }
      }),

    // Get product reviews
    reviews: publicProcedure
      .input(z.object({ productId: z.string() }).merge(paginationInput))
      .query(async ({ ctx, input }) => {
        const [reviews, total, avgRating] = await Promise.all([
          ctx.prisma.review.findMany({
            where: { productId: input.productId },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { id: true, name: true } } }
          }),
          ctx.prisma.review.count({ where: { productId: input.productId } }),
          ctx.prisma.review.aggregate({
            where: { productId: input.productId },
            _avg: { rating: true }
          })
        ])
        return {
          reviews,
          total,
          avgRating: avgRating._avg.rating || 0,
          page: input.page,
          totalPages: Math.ceil(total / input.pageSize)
        }
      }),

    // Search products (text search simulation)
    search: publicProcedure
      .input(z.object({ query: z.string().min(1) }).merge(paginationInput))
      .query(async ({ ctx, input }) => {
        const [products, total] = await Promise.all([
          ctx.prisma.product.findMany({
            where: {
              OR: [
                { name: { contains: input.query } },
                { description: { contains: input.query } }
              ]
            },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            include: { category: true }
          }),
          ctx.prisma.product.count({
            where: {
              OR: [
                { name: { contains: input.query } },
                { description: { contains: input.query } }
              ]
            }
          })
        ])
        return { products, total, page: input.page, totalPages: Math.ceil(total / input.pageSize) }
      })
  }),

  // Category operations
  category: router({
    // List all categories with product count
    list: publicProcedure.query(async ({ ctx }) => {
      return ctx.prisma.category.findMany({
        include: {
          _count: { select: { products: true } }
        },
        orderBy: { name: 'asc' }
      })
    }),

    // Get category products
    products: publicProcedure
      .input(z.object({ categoryId: z.string() }).merge(paginationInput))
      .query(async ({ ctx, input }) => {
        const [products, total, category] = await Promise.all([
          ctx.prisma.product.findMany({
            where: { categoryId: input.categoryId },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            orderBy: { createdAt: 'desc' }
          }),
          ctx.prisma.product.count({ where: { categoryId: input.categoryId } }),
          ctx.prisma.category.findUnique({ where: { id: input.categoryId } })
        ])
        return { category, products, total, page: input.page, totalPages: Math.ceil(total / input.pageSize) }
      })
  }),

  // Order operations
  order: router({
    // Get single order with all details
    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const order = await ctx.prisma.order.findUnique({
          where: { id: input.id },
          include: {
            user: { select: { id: true, name: true, email: true } },
            items: {
              include: {
                product: {
                  include: { category: true }
                }
              }
            }
          }
        })
        if (!order) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' })
        }
        return order
      }),

    // Create a new order (transaction)
    create: publicProcedure
      .input(createOrderInput)
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.$transaction(async (tx) => {
          // Get products and validate stock
          const products = await tx.product.findMany({
            where: { id: { in: input.items.map((i) => i.productId) } }
          })

          const productMap = new Map(products.map((p) => [p.id, p]))

          // Validate all products exist and have stock
          let total = 0
          const orderItems = input.items.map((item) => {
            const product = productMap.get(item.productId)
            if (!product) {
              throw new TRPCError({ code: 'NOT_FOUND', message: `Product ${item.productId} not found` })
            }
            if (product.stock < item.quantity) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: `Insufficient stock for ${product.name}` })
            }
            total += product.price * item.quantity
            return {
              productId: item.productId,
              quantity: item.quantity,
              price: product.price
            }
          })

          // Create order
          const order = await tx.order.create({
            data: {
              userId: input.userId,
              total: parseFloat(total.toFixed(2)),
              status: 'pending',
              items: { create: orderItems }
            },
            include: { items: true }
          })

          // Update stock
          await Promise.all(
            input.items.map((item) =>
              tx.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } }
              })
            )
          )

          return order
        })
      }),

    // Update order status
    updateStatus: publicProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.prisma.order.update({
          where: { id: input.id },
          data: { status: input.status }
        })
      }),

    // List recent orders
    recent: publicProcedure
      .input(paginationInput)
      .query(async ({ ctx, input }) => {
        const [orders, total] = await Promise.all([
          ctx.prisma.order.findMany({
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
              user: { select: { id: true, name: true } },
              _count: { select: { items: true } }
            }
          }),
          ctx.prisma.order.count()
        ])
        return { orders, total, page: input.page, totalPages: Math.ceil(total / input.pageSize) }
      })
  }),

  // Review operations
  review: router({
    // Create a review
    create: publicProcedure
      .input(createReviewInput)
      .mutation(async ({ ctx, input }) => {
        // Check if user already reviewed this product
        const existing = await ctx.prisma.review.findUnique({
          where: { userId_productId: { userId: input.userId, productId: input.productId } }
        })
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: 'You already reviewed this product' })
        }
        return ctx.prisma.review.create({
          data: input,
          include: { user: { select: { id: true, name: true } } }
        })
      })
  }),

  // Analytics/Dashboard operations (complex queries)
  analytics: router({
    // Get dashboard summary
    dashboard: publicProcedure.query(async ({ ctx }) => {
      const [
        totalUsers,
        totalProducts,
        totalOrders,
        recentOrders,
        topProducts,
        ordersByStatus
      ] = await Promise.all([
        ctx.prisma.user.count(),
        ctx.prisma.product.count(),
        ctx.prisma.order.count(),
        ctx.prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true } } }
        }),
        ctx.prisma.product.findMany({
          take: 5,
          orderBy: { orderItems: { _count: 'desc' } },
          include: { _count: { select: { orderItems: true } } }
        }),
        ctx.prisma.order.groupBy({
          by: ['status'],
          _count: true
        })
      ])

      return {
        summary: { totalUsers, totalProducts, totalOrders },
        recentOrders,
        topProducts,
        ordersByStatus
      }
    }),

    // Revenue by category
    revenueByCategory: publicProcedure.query(async ({ ctx }) => {
      const categories = await ctx.prisma.category.findMany({
        include: {
          products: {
            include: {
              orderItems: true
            }
          }
        }
      })

      return categories.map((cat) => ({
        category: cat.name,
        revenue: cat.products.reduce(
          (sum, product) =>
            sum + product.orderItems.reduce((pSum, item) => pSum + item.price * item.quantity, 0),
          0
        ),
        productCount: cat.products.length
      }))
    })
  })
})

export type DbRouter = typeof dbRouter
