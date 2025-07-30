import { relations } from 'drizzle-orm'
import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'

export const users = mysqlTable(
  'users',
  {
    id: int('id').autoincrement().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
    status: mysqlEnum('status', ['active', 'inactive', 'suspended']).default(
      'active'
    ),
    age: int('age'),
    country: varchar('country', { length: 100 })
  },
  table => ({
    emailIdx: index('idx_email').on(table.email),
    statusIdx: index('idx_status').on(table.status),
    createdAtIdx: index('idx_created_at').on(table.createdAt),
    countryIdx: index('idx_country').on(table.country),
    ageIdx: index('idx_age').on(table.age)
  })
)

export const categories = mysqlTable(
  'categories',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    parentId: int('parent_id').references(() => categories.id, {
      onDelete: 'set null'
    }),
    description: text('description')
  },
  table => ({
    parentIdx: index('idx_parent').on(table.parentId)
  })
)

export const products = mysqlTable(
  'products',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    categoryId: int('category_id').references(() => categories.id),
    stockQuantity: int('stock_quantity').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
    isActive: boolean('is_active').default(true)
  },
  table => ({
    categoryIdx: index('idx_category').on(table.categoryId),
    priceIdx: index('idx_price').on(table.price),
    stockIdx: index('idx_stock').on(table.stockQuantity),
    activeIdx: index('idx_active').on(table.isActive),
    createdAtIdx: index('idx_created_at').on(table.createdAt)
  })
)

export const orders = mysqlTable(
  'orders',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: mysqlEnum('status', [
      'pending',
      'processing',
      'shipped',
      'delivered',
      'cancelled'
    ]).default('pending'),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
    shippingAddress: text('shipping_address')
  },
  table => ({
    userIdx: index('idx_user').on(table.userId),
    statusIdx: index('idx_status').on(table.status),
    createdAtIdx: index('idx_created_at').on(table.createdAt),
    totalIdx: index('idx_total').on(table.totalAmount)
  })
)

export const orderItems = mysqlTable(
  'order_items',
  {
    id: int('id').autoincrement().primaryKey(),
    orderId: int('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: int('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: int('quantity').notNull(),
    price: decimal('price', { precision: 10, scale: 2 }).notNull()
  },
  table => ({
    orderIdx: index('idx_order').on(table.orderId),
    productIdx: index('idx_product').on(table.productId)
  })
)

export const reviews = mysqlTable(
  'reviews',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: int('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    rating: int('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at').defaultNow()
  },
  table => ({
    userIdx: index('idx_user').on(table.userId),
    productIdx: index('idx_product').on(table.productId),
    ratingIdx: index('idx_rating').on(table.rating),
    createdAtIdx: index('idx_created_at').on(table.createdAt),
    userProductUnique: uniqueIndex('unique_user_product').on(
      table.userId,
      table.productId
    )
  })
)

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  reviews: many(reviews)
}))

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id]
  }),
  products: many(products)
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  }),
  orderItems: many(orderItems),
  reviews: many(reviews)
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id]
  }),
  orderItems: many(orderItems)
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id]
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id]
  })
}))

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id]
  }),
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id]
  })
}))
