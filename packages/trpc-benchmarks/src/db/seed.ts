// npx tsx src/db/seed.ts
// Seeds the database with realistic e-commerce data for benchmarking

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Configuration
const NUM_USERS = 1000
const NUM_CATEGORIES = 10
const NUM_PRODUCTS = 500
const NUM_ORDERS = 2000
const MAX_ITEMS_PER_ORDER = 5
const NUM_REVIEWS = 3000

// Helper functions
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

const categoryNames = [
  'Electronics',
  'Clothing',
  'Books',
  'Home & Garden',
  'Sports',
  'Toys',
  'Food & Beverages',
  'Health & Beauty',
  'Automotive',
  'Office Supplies',
]

const adjectives = [
  'Premium',
  'Professional',
  'Essential',
  'Classic',
  'Modern',
  'Ultra',
  'Smart',
  'Eco',
  'Deluxe',
  'Compact',
]
const nouns = [
  'Widget',
  'Gadget',
  'Tool',
  'Device',
  'Kit',
  'Set',
  'Pack',
  'Bundle',
  'System',
  'Solution',
]

async function seed() {
  console.log('Seeding database...')
  const startTime = Date.now()

  // Clear existing data
  console.log('Clearing existing data...')
  await prisma.review.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.user.deleteMany()

  // Create categories
  console.log(`Creating ${NUM_CATEGORIES} categories...`)
  const categories = await Promise.all(
    categoryNames.slice(0, NUM_CATEGORIES).map(name =>
      prisma.category.create({
        data: { name },
      }),
    ),
  )

  // Create users
  console.log(`Creating ${NUM_USERS} users...`)
  const users = (await prisma.user.createManyAndReturn({
    data: Array.from({ length: NUM_USERS }, (_, i) => ({
      email: `user${i + 1}@benchmark.test`,
      name: `User ${i + 1}`,
    })),
  })) as any[]

  // Create products
  console.log(`Creating ${NUM_PRODUCTS} products...`)
  const products = (await prisma.product.createManyAndReturn({
    data: Array.from({ length: NUM_PRODUCTS }, (_, i) => ({
      name: `${randomElement(adjectives)} ${randomElement(nouns)} ${i + 1}`,
      description: `This is a high-quality product designed for professional use. Product #${i + 1} in our catalog.`,
      price: Number.parseFloat(randomFloat(9.99, 999.99).toFixed(2)),
      stock: randomInt(0, 1000),
      categoryId: randomElement(categories).id,
    })),
  })) as any[]

  // Create orders with items
  console.log(`Creating ${NUM_ORDERS} orders with items...`)
  const orderStatuses = [
    'pending',
    'confirmed',
    'shipped',
    'delivered',
    'cancelled',
  ]

  for (let i = 0; i < NUM_ORDERS; i++) {
    const numItems = randomInt(1, MAX_ITEMS_PER_ORDER)
    const selectedProducts = new Set<string>()

    while (selectedProducts.size < numItems) {
      selectedProducts.add(randomElement(products).id)
    }

    const items = Array.from(selectedProducts).map(productId => {
      const product = products.find(p => p.id === productId)!
      const quantity = randomInt(1, 5)
      return {
        productId,
        quantity,
        price: product.price,
      }
    })

    const total = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    )

    await prisma.order.create({
      data: {
        userId: randomElement(users).id,
        status: randomElement(orderStatuses),
        total: Number.parseFloat(total.toFixed(2)),
        items: {
          create: items,
        },
      },
    })

    if ((i + 1) % 500 === 0) {
      console.log(`  Created ${i + 1}/${NUM_ORDERS} orders`)
    }
  }

  // Create reviews
  console.log(`Creating ${NUM_REVIEWS} reviews...`)
  const reviewComments = [
    'Great product! Exactly what I needed.',
    'Good quality for the price.',
    'Average product, nothing special.',
    'Not as described, disappointed.',
    'Excellent! Would buy again.',
    'Fast shipping, good product.',
    'Works as expected.',
    'Could be better, but okay.',
    'Perfect for my needs!',
    'Highly recommend this product.',
  ]

  const existingReviews = new Set<string>()
  let reviewsCreated = 0

  while (reviewsCreated < NUM_REVIEWS) {
    const userId = randomElement(users).id
    const productId = randomElement(products).id
    const key = `${userId}-${productId}`

    if (!existingReviews.has(key)) {
      existingReviews.add(key)
      await prisma.review.create({
        data: {
          userId,
          productId,
          rating: randomInt(1, 5),
          comment: randomElement(reviewComments),
        },
      })
      reviewsCreated++

      if (reviewsCreated % 1000 === 0) {
        console.log(`  Created ${reviewsCreated}/${NUM_REVIEWS} reviews`)
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`\nSeeding completed in ${duration}s`)
  console.log(`  - ${NUM_USERS} users`)
  console.log(`  - ${NUM_CATEGORIES} categories`)
  console.log(`  - ${NUM_PRODUCTS} products`)
  console.log(`  - ${NUM_ORDERS} orders`)
  console.log(`  - ${NUM_REVIEWS} reviews`)
}

seed()
  .catch(e => {
    console.error('Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
