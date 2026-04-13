import { Pool } from 'mysql2/promise'

export const mysql2PromiseImplementations = {
  simpleSelect: async (pool: Pool) => {
    const [_rows] = await pool.execute('SELECT * FROM users LIMIT 50')
  },

  filteredSelect: async (pool: Pool) => {
    const [_rows] = await pool.execute(
      'SELECT * FROM users WHERE status = ? AND age > ?',
      ['active', 25],
    )
  },

  joinQuery: async (pool: Pool) => {
    const [_rows] = await pool.execute(
      `
      SELECT u.id, u.email, u.first_name, u.last_name,
             COUNT(o.id) as order_count, COALESCE(SUM(o.total_amount), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.status = ?
      GROUP BY u.id
      LIMIT 30
    `,
      ['active'],
    )
  },

  complexJoin: async (pool: Pool) => {
    const [_rows] = await pool.execute(
      `
      SELECT p.id, p.name, p.price, c.name as category_name,
             COUNT(r.id) as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.is_active = ?
      GROUP BY p.id
      LIMIT 25
    `,
      [true],
    )
  },

  insert: async (pool: Pool, insertCounter: number) => {
    const uniqueId = `${insertCounter}_${Date.now()}`
    await pool.execute(
      'INSERT INTO users (email, first_name, last_name, status, age, country) VALUES (?, ?, ?, ?, ?, ?)',
      [
        `mysql2promise_${uniqueId}@example.com`,
        'Test',
        'User',
        'active',
        30,
        'US',
      ],
    )
  },
}
