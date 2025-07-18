import { DataSource } from 'typeorm'
import { Sequelize, Op } from 'sequelize'
import { MikroORM, EntityManager } from '@mikro-orm/core'
import { MySqlDriver } from '@mikro-orm/mysql'

export const typeOrmImplementations = {
  simpleSelect: async (dataSource: DataSource) => {
    const { User } = await import('../database/typeorm-entities')
    await dataSource.getRepository(User).find({ take: 50 })
  },
  
  filteredSelect: async (dataSource: DataSource) => {
    const { User } = await import('../database/typeorm-entities')
    await dataSource.getRepository(User)
      .createQueryBuilder('user')
      .where('user.status = :status', { status: 'active' })
      .andWhere('user.age > :age', { age: 25 })
      .getMany()
  },
  
  joinQuery: async (dataSource: DataSource) => {
    const { User } = await import('../database/typeorm-entities')
    await dataSource.getRepository(User)
      .createQueryBuilder('u')
      .leftJoin('u.orders', 'o')
      .select('u.id', 'id')
      .addSelect('u.email', 'email')
      .addSelect('u.firstName', 'first_name')
      .addSelect('u.lastName', 'last_name')
      .addSelect('COUNT(o.id)', 'order_count')
      .addSelect('COALESCE(SUM(o.totalAmount), 0)', 'total_spent')
      .where('u.status = :status', { status: 'active' })
      .groupBy('u.id')
      .limit(30)
      .getRawMany()
  },
  
  complexJoin: async (dataSource: DataSource) => {
    const { Product } = await import('../database/typeorm-entities')
    await dataSource.getRepository(Product)
      .createQueryBuilder('p')
      .leftJoin('p.category', 'c')
      .leftJoin('p.reviews', 'r')
      .select('p.id', 'id')
      .addSelect('p.name', 'name')
      .addSelect('p.price', 'price')
      .addSelect('c.name', 'category_name')
      .addSelect('COUNT(r.id)', 'review_count')
      .where('p.isActive = :isActive', { isActive: true })
      .groupBy('p.id')
      .limit(25)
      .getRawMany()
  },
  
  insert: async (dataSource: DataSource, insertCounter: number) => {
    const { User } = await import('../database/typeorm-entities')
    const uniqueId = `${insertCounter}_${Date.now()}`
    const user = dataSource.getRepository(User).create({
      email: `typeorm_${uniqueId}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      status: 'active',
      age: 30,
      country: 'US',
    })
    await dataSource.getRepository(User).save(user)
  }
}

export const sequelizeImplementations = {
  simpleSelect: async (sequelize: Sequelize) => {
    const { User } = await import('../database/sequelize-models')
    await User.findAll({ limit: 50 })
  },
  
  filteredSelect: async (sequelize: Sequelize) => {
    const { User } = await import('../database/sequelize-models')
    await User.findAll({
      where: {
        status: 'active',
        age: { [Op.gt]: 25 }
      }
    })
  },
  
  joinQuery: async (sequelize: Sequelize) => {
    const { User } = await import('../database/sequelize-models')
    await sequelize.query(`
      SELECT u.id, u.email, u.first_name, u.last_name,
             COUNT(o.id) as order_count, COALESCE(SUM(o.total_amount), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.status = 'active'
      GROUP BY u.id
      LIMIT 30
    `, { type: sequelize.QueryTypes.SELECT })
  },
  
  complexJoin: async (sequelize: Sequelize) => {
    const { Product } = await import('../database/sequelize-models')
    await sequelize.query(`
      SELECT p.id, p.name, p.price, c.name as category_name,
             COUNT(r.id) as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      LIMIT 25
    `, { type: sequelize.QueryTypes.SELECT })
  },
  
  insert: async (sequelize: Sequelize, insertCounter: number) => {
    const { User } = await import('../database/sequelize-models')
    const uniqueId = `${insertCounter}_${Date.now()}`
    await User.create({
      email: `sequelize_${uniqueId}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      status: 'active',
      age: 30,
      country: 'US',
    })
  }
}

export const mikroOrmImplementations = {
  simpleSelect: async (orm: MikroORM<MySqlDriver>) => {
    const { User } = await import('../database/mikro-orm-entities-fixed')
    const em = orm.em.fork()
    await em.find(User, {}, { limit: 50 })
  },
  
  filteredSelect: async (orm: MikroORM<MySqlDriver>) => {
    const { User } = await import('../database/mikro-orm-entities-fixed')
    const em = orm.em.fork()
    await em.find(User, {
      status: 'active',
      age: { $gt: 25 }
    })
  },
  
  joinQuery: async (orm: MikroORM<MySqlDriver>) => {
    const em = orm.em.fork()
    await em.getConnection().execute(`
      SELECT u.id, u.email, u.first_name, u.last_name,
             COUNT(o.id) as order_count, COALESCE(SUM(o.total_amount), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.status = 'active'
      GROUP BY u.id
      LIMIT 30
    `)
  },
  
  complexJoin: async (orm: MikroORM<MySqlDriver>) => {
    const em = orm.em.fork()
    await em.getConnection().execute(`
      SELECT p.id, p.name, p.price, c.name as category_name,
             COUNT(r.id) as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      LIMIT 25
    `)
  },
  
  insert: async (orm: MikroORM<MySqlDriver>, insertCounter: number) => {
    const { User } = await import('../database/mikro-orm-entities-fixed')
    const em = orm.em.fork()
    const uniqueId = `${insertCounter}_${Date.now()}`
    const user = em.create(User, {
      email: `mikroorm_${uniqueId}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      status: 'active',
      age: 30,
      country: 'US',
    })
    await em.persistAndFlush(user)
  }
}