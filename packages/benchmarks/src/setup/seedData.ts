import { DatabaseConnections } from '../database/connections'
import { DatabaseConfig } from '../types'

export class SeedData {
  private config: DatabaseConfig

  constructor(config: DatabaseConfig) {
    this.config = config
  }

  async seedDatabase(recordCount: number = 10000): Promise<void> {
    console.log(`🌱 Seeding database with ${recordCount} records...`)

    const _mysql2Conn = await DatabaseConnections.getMysql2Connection(
      this.config
    )
    const _prisma = await DatabaseConnections.getPrismaClient()

    // Clear existing data
    await this.clearData()

    // Seed categories
    console.log('📁 Seeding categories...')
    await this.seedCategories()

    // Seed users
    console.log('👥 Seeding users...')
    await this.seedUsers(recordCount)

    // Seed products
    console.log('📦 Seeding products...')
    await this.seedProducts(recordCount)

    // Seed orders
    console.log('🛒 Seeding orders...')
    await this.seedOrders(Math.floor(recordCount / 2))

    // Seed reviews
    console.log('⭐ Seeding reviews...')
    await this.seedReviews(Math.floor(recordCount / 3))

    console.log('✅ Database seeding completed!')
  }

  private async clearData(): Promise<void> {
    const mysql2Conn = await DatabaseConnections.getMysql2Connection(
      this.config
    )

    // Disable foreign key checks
    await mysql2Conn.execute('SET FOREIGN_KEY_CHECKS = 0')

    // Clear tables in reverse dependency order
    const tables = [
      'reviews',
      'order_items',
      'orders',
      'products',
      'users',
      'categories'
    ]

    for (const table of tables) {
      await mysql2Conn.execute(`DELETE FROM ${table}`)
      await mysql2Conn.execute(`ALTER TABLE ${table} AUTO_INCREMENT = 1`)
    }

    // Re-enable foreign key checks
    await mysql2Conn.execute('SET FOREIGN_KEY_CHECKS = 1')
  }

  private async seedCategories(): Promise<void> {
    const mysql2Conn = await DatabaseConnections.getMysql2Connection(
      this.config
    )

    const categories = [
      { name: 'Electronics', description: 'Electronic devices and gadgets' },
      { name: 'Clothing', description: 'Apparel and fashion items' },
      { name: 'Books', description: 'Books and literature' },
      { name: 'Home & Garden', description: 'Home and garden items' },
      { name: 'Sports', description: 'Sports and fitness equipment' },
      { name: 'Toys', description: 'Toys and games' },
      { name: 'Automotive', description: 'Car parts and accessories' },
      { name: 'Health & Beauty', description: 'Health and beauty products' }
    ]

    for (const category of categories) {
      await mysql2Conn.execute(
        'INSERT INTO categories (name, description) VALUES (?, ?)',
        [category.name, category.description]
      )
    }
  }

  private async seedUsers(count: number): Promise<void> {
    const mysql2Conn = await DatabaseConnections.getMysql2Connection(
      this.config
    )

    const countries = [
      'US',
      'UK',
      'CA',
      'DE',
      'FR',
      'JP',
      'AU',
      'BR',
      'IN',
      'MX'
    ]
    const statuses = ['active', 'inactive', 'suspended']

    // Batch insert for better performance
    const batchSize = 1000

    for (let i = 0; i < count; i += batchSize) {
      const batch = []
      const currentBatchSize = Math.min(batchSize, count - i)

      for (let j = 0; j < currentBatchSize; j++) {
        const userId = i + j + 1
        batch.push([
          `user${userId}@example.com`,
          `FirstName${userId}`,
          `LastName${userId}`,
          statuses[Math.floor(Math.random() * statuses.length)],
          Math.floor(Math.random() * 60) + 18, // Age between 18-77
          countries[Math.floor(Math.random() * countries.length)]
        ])
      }

      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
      const values = batch.flat()

      await mysql2Conn.execute(
        `INSERT INTO users (email, first_name, last_name, status, age, country) VALUES ${placeholders}`,
        values
      )
    }
  }

  private async seedProducts(count: number): Promise<void> {
    const mysql2Conn = await DatabaseConnections.getMysql2Connection(
      this.config
    )

    const batchSize = 1000

    for (let i = 0; i < count; i += batchSize) {
      const batch = []
      const currentBatchSize = Math.min(batchSize, count - i)

      for (let j = 0; j < currentBatchSize; j++) {
        const productId = i + j + 1
        batch.push([
          `Product ${productId}`,
          `Description for product ${productId}`,
          (Math.random() * 1000).toFixed(2), // Price between 0-1000
          Math.floor(Math.random() * 8) + 1, // Category ID 1-8
          Math.floor(Math.random() * 100), // Stock quantity 0-99
          Math.random() > 0.1 // 90% active
        ])
      }

      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
      const values = batch.flat()

      await mysql2Conn.execute(
        `INSERT INTO products (name, description, price, category_id, stock_quantity, is_active) VALUES ${placeholders}`,
        values
      )
    }
  }

  private async seedOrders(count: number): Promise<void> {
    const mysql2Conn = await DatabaseConnections.getMysql2Connection(
      this.config
    )

    const statuses = [
      'pending',
      'processing',
      'shipped',
      'delivered',
      'cancelled'
    ]
    const batchSize = 1000

    for (let i = 0; i < count; i += batchSize) {
      const batch = []
      const currentBatchSize = Math.min(batchSize, count - i)

      for (let j = 0; j < currentBatchSize; j++) {
        batch.push([
          Math.floor(Math.random() * 10000) + 1, // Random user ID
          statuses[Math.floor(Math.random() * statuses.length)],
          (Math.random() * 500).toFixed(2), // Total amount 0-500
          `Address ${i + j + 1}, City, Country`
        ])
      }

      const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ')
      const values = batch.flat()

      await mysql2Conn.execute(
        `INSERT INTO orders (user_id, status, total_amount, shipping_address) VALUES ${placeholders}`,
        values
      )
    }
  }

  private async seedReviews(count: number): Promise<void> {
    const mysql2Conn = await DatabaseConnections.getMysql2Connection(
      this.config
    )

    const batchSize = 1000

    for (let i = 0; i < count; i += batchSize) {
      const batch = []
      const currentBatchSize = Math.min(batchSize, count - i)

      for (let j = 0; j < currentBatchSize; j++) {
        batch.push([
          Math.floor(Math.random() * 10000) + 1, // Random user ID
          Math.floor(Math.random() * 10000) + 1, // Random product ID
          Math.floor(Math.random() * 5) + 1, // Rating 1-5
          `This is a review comment ${i + j + 1}`
        ])
      }

      const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ')
      const values = batch.flat()

      try {
        await mysql2Conn.execute(
          `INSERT IGNORE INTO reviews (user_id, product_id, rating, comment) VALUES ${placeholders}`,
          values
        )
      } catch (_error) {
        // Ignore duplicate key errors
      }
    }
  }
}
