import { PrismaClient } from '@prisma/client'
import mysql from 'mysql2/promise'
import { getDatabaseUrl, getMySqlConfig } from '../utils/containerHelpers'

export class ContainerizedConnections {
  private static mysql2Connection: mysql.Connection | null = null
  private static prismaClient: PrismaClient | null = null

  static async getMysql2Connection(): Promise<mysql.Connection> {
    if (!ContainerizedConnections.mysql2Connection) {
      const config = getMySqlConfig()
      ContainerizedConnections.mysql2Connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        namedPlaceholders: true,
      })
    }
    return ContainerizedConnections.mysql2Connection
  }

  static async getPrismaClient(): Promise<PrismaClient> {
    if (!ContainerizedConnections.prismaClient) {
      // Override DATABASE_URL for Prisma to use container
      process.env.DATABASE_URL = getDatabaseUrl()

      ContainerizedConnections.prismaClient = new PrismaClient({
        log: ['error'], // Minimal logging for benchmarks
      })
      await ContainerizedConnections.prismaClient.$connect()
    }
    return ContainerizedConnections.prismaClient
  }

  static async closeConnections(): Promise<void> {
    if (ContainerizedConnections.mysql2Connection) {
      await ContainerizedConnections.mysql2Connection.end()
      ContainerizedConnections.mysql2Connection = null
    }

    if (ContainerizedConnections.prismaClient) {
      await ContainerizedConnections.prismaClient.$disconnect()
      ContainerizedConnections.prismaClient = null
    }
  }

  static async setupSchema(): Promise<void> {
    const mysql2Conn = await ContainerizedConnections.getMysql2Connection()

    // Create tables
    await mysql2Conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
        age INT,
        country VARCHAR(100),
        
        INDEX idx_email (email),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        INDEX idx_country (country),
        INDEX idx_age (age)
      )
    `)

    await mysql2Conn.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category_id INT,
        stock_quantity INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        
        INDEX idx_category (category_id),
        INDEX idx_price (price),
        INDEX idx_stock (stock_quantity),
        INDEX idx_active (is_active),
        INDEX idx_created_at (created_at)
      )
    `)

    await mysql2Conn.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        parent_id INT NULL,
        description TEXT,
        
        INDEX idx_parent (parent_id),
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `)

    await mysql2Conn.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
        total_amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        shipping_address TEXT,
        
        INDEX idx_user (user_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        INDEX idx_total (total_amount),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await mysql2Conn.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        
        INDEX idx_order (order_id),
        INDEX idx_product (product_id),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `)

    await mysql2Conn.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_user (user_id),
        INDEX idx_product (product_id),
        INDEX idx_rating (rating),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_product (user_id, product_id)
      )
    `)

    // Add sample data
    await ContainerizedConnections.seedMinimalData()
  }

  private static async seedMinimalData(): Promise<void> {
    const mysql2Conn = await ContainerizedConnections.getMysql2Connection()

    // Add some categories
    await mysql2Conn.execute(`
      INSERT IGNORE INTO categories (id, name, description) VALUES
      (1, 'Electronics', 'Electronic devices'),
      (2, 'Books', 'Literature and books'),
      (3, 'Clothing', 'Apparel and fashion')
    `)

    // Add some users
    const users = []
    for (let i = 1; i <= 1000; i++) {
      users.push([
        `user${i}@example.com`,
        `FirstName${i}`,
        `LastName${i}`,
        'active',
        Math.floor(Math.random() * 50) + 20,
        'US',
      ])
    }

    const userPlaceholders = users.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    await mysql2Conn.execute(
      `
      INSERT IGNORE INTO users (email, first_name, last_name, status, age, country) 
      VALUES ${userPlaceholders}
    `,
      users.flat(),
    )

    // Add some products
    const products = []
    for (let i = 1; i <= 1000; i++) {
      products.push([
        `Product ${i}`,
        `Description for product ${i}`,
        (Math.random() * 100).toFixed(2),
        Math.floor(Math.random() * 3) + 1,
        Math.floor(Math.random() * 100),
        true,
      ])
    }

    const productPlaceholders = products
      .map(() => '(?, ?, ?, ?, ?, ?)')
      .join(', ')
    await mysql2Conn.execute(
      `
      INSERT IGNORE INTO products (name, description, price, category_id, stock_quantity, is_active) 
      VALUES ${productPlaceholders}
    `,
      products.flat(),
    )

    // Add some orders
    const orders = []
    for (let i = 1; i <= 500; i++) {
      orders.push([
        Math.floor(Math.random() * 1000) + 1,
        'pending',
        (Math.random() * 200).toFixed(2),
        `Address ${i}, City, Country`,
      ])
    }

    const orderPlaceholders = orders.map(() => '(?, ?, ?, ?)').join(', ')
    await mysql2Conn.execute(
      `
      INSERT IGNORE INTO orders (user_id, status, total_amount, shipping_address) 
      VALUES ${orderPlaceholders}
    `,
      orders.flat(),
    )
  }
}
