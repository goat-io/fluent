import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Enum } from '@mikro-orm/core'

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'int' })
  id!: number

  @Property({ type: 'string', length: 255, unique: true })
  email!: string

  @Property({ type: 'string', length: 100, fieldName: 'first_name' })
  firstName!: string

  @Property({ type: 'string', length: 100, fieldName: 'last_name' })
  lastName!: string

  @Property({ type: 'Date', fieldName: 'created_at', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ type: 'Date', fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Enum({ items: ['active', 'inactive', 'suspended'], default: 'active', type: 'string' })
  status: 'active' | 'inactive' | 'suspended' = 'active'

  @Property({ type: 'int', nullable: true })
  age?: number

  @Property({ type: 'string', length: 100, nullable: true })
  country?: string

  @OneToMany(() => Order, order => order.user)
  orders = new Collection<Order>(this)

  @OneToMany(() => Review, review => review.user)
  reviews = new Collection<Review>(this)
}

@Entity({ tableName: 'products' })
export class Product {
  @PrimaryKey({ type: 'int' })
  id!: number

  @Property({ type: 'string', length: 255 })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  price!: number

  @Property({ type: 'int', fieldName: 'stock_quantity', default: 0 })
  stockQuantity: number = 0

  @Property({ type: 'Date', fieldName: 'created_at', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ type: 'Date', fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ type: 'boolean', fieldName: 'is_active', default: true })
  isActive: boolean = true

  @ManyToOne(() => Category, { nullable: true })
  category?: Category

  @OneToMany(() => OrderItem, orderItem => orderItem.product)
  orderItems = new Collection<OrderItem>(this)

  @OneToMany(() => Review, review => review.product)
  reviews = new Collection<Review>(this)
}

@Entity({ tableName: 'categories' })
export class Category {
  @PrimaryKey({ type: 'int' })
  id!: number

  @Property({ type: 'string', length: 100 })
  name!: string

  @Property({ type: 'int', fieldName: 'parent_id', nullable: true })
  parentId?: number

  @Property({ type: 'text', nullable: true })
  description?: string

  @OneToMany(() => Product, product => product.category)
  products = new Collection<Product>(this)
}

@Entity({ tableName: 'orders' })
export class Order {
  @PrimaryKey({ type: 'int' })
  id!: number

  @Enum({ items: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending', type: 'string' })
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' = 'pending'

  @Property({ fieldName: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: number

  @Property({ type: 'Date', fieldName: 'created_at', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ type: 'Date', fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ fieldName: 'shipping_address', type: 'text', nullable: true })
  shippingAddress?: string

  @ManyToOne(() => User)
  user!: User

  @OneToMany(() => OrderItem, orderItem => orderItem.order)
  orderItems = new Collection<OrderItem>(this)
}

@Entity({ tableName: 'order_items' })
export class OrderItem {
  @PrimaryKey({ type: 'int' })
  id!: number

  @Property({ type: 'int' })
  quantity!: number

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  price!: number

  @ManyToOne(() => Order)
  order!: Order

  @ManyToOne(() => Product)
  product!: Product
}

@Entity({ tableName: 'reviews' })
export class Review {
  @PrimaryKey({ type: 'int' })
  id!: number

  @Property({ type: 'int' })
  rating!: number

  @Property({ type: 'text', nullable: true })
  comment?: string

  @Property({ type: 'Date', fieldName: 'created_at', onCreate: () => new Date() })
  createdAt: Date = new Date()

  @ManyToOne(() => User)
  user!: User

  @ManyToOne(() => Product)
  product!: Product
}