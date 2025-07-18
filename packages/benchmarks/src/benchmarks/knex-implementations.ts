import { Knex } from 'knex'

export const knexImplementations = {
  simpleSelect: async (knex: Knex) => {
    await knex('users').select('*').limit(50)
  },
  
  filteredSelect: async (knex: Knex) => {
    await knex('users')
      .where('status', 'active')
      .andWhere('age', '>', 25)
      .select('*')
  },
  
  joinQuery: async (knex: Knex) => {
    await knex('users as u')
      .leftJoin('orders as o', 'u.id', 'o.user_id')
      .select('u.id', 'u.email', 'u.first_name', 'u.last_name')
      .select(knex.raw('COUNT(o.id) as order_count'))
      .select(knex.raw('COALESCE(SUM(o.total_amount), 0) as total_spent'))
      .where('u.status', 'active')
      .groupBy('u.id')
      .limit(30)
  },
  
  complexJoin: async (knex: Knex) => {
    await knex('products as p')
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .leftJoin('reviews as r', 'p.id', 'r.product_id')
      .select('p.id', 'p.name', 'p.price')
      .select('c.name as category_name')
      .select(knex.raw('COUNT(r.id) as review_count'))
      .where('p.is_active', true)
      .groupBy('p.id')
      .limit(25)
  },
  
  insert: async (knex: Knex, insertCounter: number) => {
    const uniqueId = `${insertCounter}_${Date.now()}`
    await knex('users').insert({
      email: `knex_${uniqueId}@example.com`,
      first_name: 'Test',
      last_name: 'User',
      status: 'active',
      age: 30,
      country: 'US',
    })
  }
}