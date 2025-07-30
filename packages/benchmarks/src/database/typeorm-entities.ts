import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName: string

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  })
  status: 'active' | 'inactive' | 'suspended'

  @Column({ type: 'int', nullable: true })
  age: number

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string

  @OneToMany(
    () => Order,
    order => order.user
  )
  orders: Order[]

  @OneToMany(
    () => Review,
    review => review.user
  )
  reviews: Review[]
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number

  @Column({ type: 'int', name: 'category_id', nullable: true })
  categoryId: number

  @Column({ type: 'int', name: 'stock_quantity', default: 0 })
  stockQuantity: number

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean

  @ManyToOne(
    () => Category,
    category => category.products
  )
  @JoinColumn({ name: 'category_id' })
  category: Category

  @OneToMany(
    () => OrderItem,
    orderItem => orderItem.product
  )
  orderItems: OrderItem[]

  @OneToMany(
    () => Review,
    review => review.product
  )
  reviews: Review[]
}

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 100 })
  name: string

  @Column({ type: 'int', name: 'parent_id', nullable: true })
  parentId: number

  @Column({ type: 'text', nullable: true })
  description: string

  @OneToMany(
    () => Product,
    product => product.category
  )
  products: Product[]
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'int', name: 'user_id' })
  userId: number

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  })
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @Column({ name: 'shipping_address', type: 'text', nullable: true })
  shippingAddress: string

  @ManyToOne(
    () => User,
    user => user.orders
  )
  @JoinColumn({ name: 'user_id' })
  user: User

  @OneToMany(
    () => OrderItem,
    orderItem => orderItem.order
  )
  orderItems: OrderItem[]
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'int', name: 'order_id' })
  orderId: number

  @Column({ type: 'int', name: 'product_id' })
  productId: number

  @Column({ type: 'int' })
  quantity: number

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number

  @ManyToOne(
    () => Order,
    order => order.orderItems
  )
  @JoinColumn({ name: 'order_id' })
  order: Order

  @ManyToOne(
    () => Product,
    product => product.orderItems
  )
  @JoinColumn({ name: 'product_id' })
  product: Product
}

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'int', name: 'user_id' })
  userId: number

  @Column({ type: 'int', name: 'product_id' })
  productId: number

  @Column({ type: 'int' })
  rating: number

  @Column({ type: 'text', nullable: true })
  comment: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @ManyToOne(
    () => User,
    user => user.reviews
  )
  @JoinColumn({ name: 'user_id' })
  user: User

  @ManyToOne(
    () => Product,
    product => product.reviews
  )
  @JoinColumn({ name: 'product_id' })
  product: Product
}
