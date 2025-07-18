# Real-World Usage Patterns

This guide demonstrates practical, real-world usage patterns for Goat Fluent applications, including complete examples for common scenarios.

## E-commerce Platform

### Entity Models

```typescript
// entities/Product.ts
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm'
import { ObjectType, f } from '@goatlab/fluent'
import { z } from 'zod'

@Entity('products')
@ObjectType()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column()
  @Index()
  @f.Column()
  sku: string

  @Column()
  @Index()
  @f.Column()
  name: string

  @Column('text')
  @f.Column()
  description: string

  @Column('decimal', { precision: 10, scale: 2 })
  @f.Column()
  price: number

  @Column('int')
  @f.Column()
  stockQuantity: number

  @Column()
  @Index()
  @f.Column()
  categoryId: string

  @Column('json')
  @f.Column()
  variants: Array<{
    id: string
    name: string
    price: number
    stockQuantity: number
    attributes: Record<string, string>
  }>

  @Column('json')
  @f.Column()
  images: Array<{
    url: string
    alt: string
    isPrimary: boolean
  }>

  @Column()
  @Index()
  @f.Column()
  status: 'active' | 'inactive' | 'discontinued'

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @f.Column()
  createdAt: Date

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' })
  @f.Column()
  updatedAt: Date
}

// entities/Order.ts
@Entity('orders')
@ObjectType()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column()
  @Index()
  @f.Column()
  userId: string

  @Column()
  @Index()
  @f.Column()
  orderNumber: string

  @Column('json')
  @f.Column()
  items: Array<{
    productId: string
    variantId?: string
    quantity: number
    price: number
    total: number
  }>

  @Column('decimal', { precision: 10, scale: 2 })
  @f.Column()
  subtotal: number

  @Column('decimal', { precision: 10, scale: 2 })
  @f.Column()
  tax: number

  @Column('decimal', { precision: 10, scale: 2 })
  @f.Column()
  shipping: number

  @Column('decimal', { precision: 10, scale: 2 })
  @f.Column()
  total: number

  @Column()
  @Index()
  @f.Column()
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

  @Column('json')
  @f.Column()
  shippingAddress: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @f.Column()
  createdAt: Date

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' })
  @f.Column()
  updatedAt: Date
}
```

### Service Layer Implementation

```typescript
// services/ProductService.ts
import { ProductRepository } from '../repositories/ProductRepository'
import { z } from 'zod'

export class ProductService {
  private productRepository: ProductRepository

  constructor() {
    this.productRepository = new ProductRepository()
  }

  async searchProducts(params: {
    query?: string
    categoryId?: string
    minPrice?: number
    maxPrice?: number
    inStock?: boolean
    page?: number
    limit?: number
  }) {
    const {
      query,
      categoryId,
      minPrice,
      maxPrice,
      inStock,
      page = 1,
      limit = 20
    } = params

    const where: any = {
      status: 'active'
    }

    if (query) {
      where.OR = [
        { name: { contains: query } },
        { description: { contains: query } },
        { sku: { contains: query } }
      ]
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {}
      if (minPrice !== undefined) where.price.gte = minPrice
      if (maxPrice !== undefined) where.price.lte = maxPrice
    }

    if (inStock) {
      where.stockQuantity = { gt: 0 }
    }

    const [products, total] = await Promise.all([
      this.productRepository.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        limit,
        offset: (page - 1) * limit
      }),
      this.productRepository.count({ where })
    ])

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  async updateInventory(productId: string, quantity: number) {
    return await this.productRepository.updateById(productId, {
      stockQuantity: quantity,
      updatedAt: new Date()
    })
  }

  async checkLowStock(threshold: number = 10) {
    return await this.productRepository.findMany({
      where: {
        stockQuantity: { lte: threshold },
        status: 'active'
      },
      orderBy: { stockQuantity: 'asc' }
    })
  }
}

// services/OrderService.ts
export class OrderService {
  private orderRepository: OrderRepository
  private productService: ProductService

  constructor() {
    this.orderRepository = new OrderRepository()
    this.productService = new ProductService()
  }

  async createOrder(orderData: {
    userId: string
    items: Array<{
      productId: string
      variantId?: string
      quantity: number
    }>
    shippingAddress: any
  }) {
    // Validate inventory
    for (const item of orderData.items) {
      const product = await this.productService.findById(item.productId)
      if (!product || product.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`)
      }
    }

    // Calculate totals
    let subtotal = 0
    const processedItems = []

    for (const item of orderData.items) {
      const product = await this.productService.findById(item.productId)
      const price = product.price // or variant price
      const total = price * item.quantity
      
      processedItems.push({
        ...item,
        price,
        total
      })
      
      subtotal += total
    }

    const tax = subtotal * 0.08 // 8% tax
    const shipping = subtotal > 100 ? 0 : 10 // Free shipping over $100
    const total = subtotal + tax + shipping

    // Create order
    const order = await this.orderRepository.insert({
      userId: orderData.userId,
      orderNumber: this.generateOrderNumber(),
      items: processedItems,
      subtotal,
      tax,
      shipping,
      total,
      status: 'pending',
      shippingAddress: orderData.shippingAddress
    })

    // Update inventory
    for (const item of orderData.items) {
      await this.productService.updateInventory(
        item.productId,
        -item.quantity // Decrease stock
      )
    }

    return order
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString()
    const random = Math.random().toString(36).substr(2, 5).toUpperCase()
    return `ORD-${timestamp}-${random}`
  }

  async getOrdersByUser(userId: string, page: number = 1, limit: number = 10) {
    return await this.orderRepository.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      limit,
      offset: (page - 1) * limit
    })
  }

  async updateOrderStatus(orderId: string, status: string) {
    return await this.orderRepository.updateById(orderId, {
      status,
      updatedAt: new Date()
    })
  }
}
```

## Content Management System

### Entity Models

```typescript
// entities/Article.ts
@Entity('articles')
@ObjectType()
export class Article {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column()
  @Index()
  @f.Column()
  title: string

  @Column()
  @Index()
  @f.Column()
  slug: string

  @Column('text')
  @f.Column()
  content: string

  @Column('text')
  @f.Column()
  excerpt: string

  @Column()
  @Index()
  @f.Column()
  authorId: string

  @Column('json')
  @f.Column()
  tags: string[]

  @Column('json')
  @f.Column()
  categories: string[]

  @Column()
  @f.Column()
  featuredImage?: string

  @Column('json')
  @f.Column()
  seoData: {
    metaTitle?: string
    metaDescription?: string
    keywords?: string[]
  }

  @Column()
  @Index()
  @f.Column()
  status: 'draft' | 'published' | 'archived'

  @Column({ type: 'timestamp', nullable: true })
  @f.Column()
  publishedAt?: Date

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @f.Column()
  createdAt: Date

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' })
  @f.Column()
  updatedAt: Date
}

// entities/Comment.ts
@Entity('comments')
@ObjectType()
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column()
  @Index()
  @f.Column()
  articleId: string

  @Column()
  @Index()
  @f.Column()
  userId: string

  @Column('text')
  @f.Column()
  content: string

  @Column()
  @Index()
  @f.Column()
  parentId?: string

  @Column()
  @Index()
  @f.Column()
  status: 'pending' | 'approved' | 'rejected'

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @f.Column()
  createdAt: Date

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' })
  @f.Column()
  updatedAt: Date
}
```

### CMS Service Implementation

```typescript
// services/ArticleService.ts
export class ArticleService {
  private articleRepository: ArticleRepository
  private commentRepository: CommentRepository

  constructor() {
    this.articleRepository = new ArticleRepository()
    this.commentRepository = new CommentRepository()
  }

  async createArticle(articleData: {
    title: string
    content: string
    excerpt: string
    authorId: string
    tags: string[]
    categories: string[]
    featuredImage?: string
    seoData?: any
    status: 'draft' | 'published'
  }) {
    const slug = this.generateSlug(articleData.title)
    
    // Check if slug already exists
    const existingArticle = await this.articleRepository.findFirst({
      where: { slug }
    })
    
    if (existingArticle) {
      throw new Error('Article with this slug already exists')
    }

    const article = await this.articleRepository.insert({
      ...articleData,
      slug,
      publishedAt: articleData.status === 'published' ? new Date() : undefined
    })

    return article
  }

  async getPublishedArticles(params: {
    page?: number
    limit?: number
    category?: string
    tag?: string
    author?: string
    search?: string
  }) {
    const {
      page = 1,
      limit = 10,
      category,
      tag,
      author,
      search
    } = params

    const where: any = {
      status: 'published',
      publishedAt: { lte: new Date() }
    }

    if (category) {
      where.categories = { contains: category }
    }

    if (tag) {
      where.tags = { contains: tag }
    }

    if (author) {
      where.authorId = author
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { excerpt: { contains: search } }
      ]
    }

    const [articles, total] = await Promise.all([
      this.articleRepository.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        limit,
        offset: (page - 1) * limit
      }),
      this.articleRepository.count({ where })
    ])

    return {
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  async getArticleWithComments(slug: string) {
    const article = await this.articleRepository.findFirst({
      where: { slug, status: 'published' }
    })

    if (!article) {
      throw new Error('Article not found')
    }

    const comments = await this.commentRepository.findMany({
      where: {
        articleId: article.id,
        status: 'approved'
      },
      orderBy: { createdAt: 'asc' }
    })

    // Build comment tree
    const commentTree = this.buildCommentTree(comments)

    return {
      article,
      comments: commentTree
    }
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  private buildCommentTree(comments: Comment[]): any[] {
    const commentMap = new Map()
    const rootComments: any[] = []

    // First pass: create comment objects
    comments.forEach(comment => {
      commentMap.set(comment.id, {
        ...comment,
        replies: []
      })
    })

    // Second pass: build tree structure
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)
      
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId)
        if (parent) {
          parent.replies.push(commentWithReplies)
        }
      } else {
        rootComments.push(commentWithReplies)
      }
    })

    return rootComments
  }
}
```

## Multi-Tenant SaaS Application

### Entity Models with Tenant Isolation

```typescript
// entities/Tenant.ts
@Entity('tenants')
@ObjectType()
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column({ unique: true })
  @Index()
  @f.Column()
  slug: string

  @Column()
  @f.Column()
  name: string

  @Column()
  @f.Column()
  domain?: string

  @Column('json')
  @f.Column()
  settings: {
    theme: string
    features: string[]
    limits: {
      users: number
      storage: number
      apiCalls: number
    }
  }

  @Column()
  @Index()
  @f.Column()
  status: 'active' | 'suspended' | 'cancelled'

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @f.Column()
  createdAt: Date

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' })
  @f.Column()
  updatedAt: Date
}

// entities/TenantUser.ts
@Entity('tenant_users')
@ObjectType()
export class TenantUser {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column()
  @Index()
  @f.Column()
  tenantId: string

  @Column()
  @Index()
  @f.Column()
  email: string

  @Column()
  @f.Column()
  firstName: string

  @Column()
  @f.Column()
  lastName: string

  @Column()
  @f.Column()
  passwordHash: string

  @Column('json')
  @f.Column()
  roles: string[]

  @Column('json')
  @f.Column()
  permissions: string[]

  @Column()
  @Index()
  @f.Column()
  status: 'active' | 'inactive' | 'invited'

  @Column({ type: 'timestamp', nullable: true })
  @f.Column()
  lastLoginAt?: Date

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @f.Column()
  createdAt: Date

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' })
  @f.Column()
  updatedAt: Date
}
```

### Multi-Tenant Service Implementation

```typescript
// services/TenantService.ts
export class TenantService {
  private tenantRepository: TenantRepository
  private tenantUserRepository: TenantUserRepository

  constructor() {
    this.tenantRepository = new TenantRepository()
    this.tenantUserRepository = new TenantUserRepository()
  }

  async createTenant(tenantData: {
    name: string
    slug: string
    domain?: string
    adminEmail: string
    adminPassword: string
  }) {
    // Check if tenant slug is available
    const existingTenant = await this.tenantRepository.findFirst({
      where: { slug: tenantData.slug }
    })

    if (existingTenant) {
      throw new Error('Tenant slug already exists')
    }

    // Create tenant
    const tenant = await this.tenantRepository.insert({
      name: tenantData.name,
      slug: tenantData.slug,
      domain: tenantData.domain,
      settings: {
        theme: 'default',
        features: ['basic'],
        limits: {
          users: 10,
          storage: 1000, // MB
          apiCalls: 10000
        }
      },
      status: 'active'
    })

    // Create admin user
    const adminUser = await this.tenantUserRepository.insert({
      tenantId: tenant.id,
      email: tenantData.adminEmail,
      firstName: 'Admin',
      lastName: 'User',
      passwordHash: await this.hashPassword(tenantData.adminPassword),
      roles: ['admin'],
      permissions: ['*'],
      status: 'active'
    })

    return { tenant, adminUser }
  }

  async getTenantUsers(tenantId: string, params: {
    page?: number
    limit?: number
    role?: string
    status?: string
    search?: string
  }) {
    const {
      page = 1,
      limit = 20,
      role,
      status,
      search
    } = params

    const where: any = {
      tenantId
    }

    if (role) {
      where.roles = { contains: role }
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } }
      ]
    }

    const [users, total] = await Promise.all([
      this.tenantUserRepository.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        limit,
        offset: (page - 1) * limit
      }),
      this.tenantUserRepository.count({ where })
    ])

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  async checkTenantLimits(tenantId: string) {
    const tenant = await this.tenantRepository.findById(tenantId)
    if (!tenant) {
      throw new Error('Tenant not found')
    }

    const userCount = await this.tenantUserRepository.count({
      where: { tenantId }
    })

    return {
      users: {
        current: userCount,
        limit: tenant.settings.limits.users,
        exceeded: userCount >= tenant.settings.limits.users
      },
      storage: {
        current: 0, // Calculate actual storage usage
        limit: tenant.settings.limits.storage,
        exceeded: false
      },
      apiCalls: {
        current: 0, // Calculate current API usage
        limit: tenant.settings.limits.apiCalls,
        exceeded: false
      }
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const bcrypt = require('bcrypt')
    return await bcrypt.hash(password, 10)
  }
}
```

## Social Media Platform

### Entity Models

```typescript
// entities/Post.ts
@Entity('posts')
@ObjectType()
export class Post {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column()
  @Index()
  @f.Column()
  userId: string

  @Column('text')
  @f.Column()
  content: string

  @Column('json')
  @f.Column()
  media: Array<{
    type: 'image' | 'video' | 'gif'
    url: string
    thumbnail?: string
    alt?: string
  }>

  @Column('json')
  @f.Column()
  hashtags: string[]

  @Column('json')
  @f.Column()
  mentions: string[]

  @Column('int', { default: 0 })
  @f.Column()
  likesCount: number

  @Column('int', { default: 0 })
  @f.Column()
  commentsCount: number

  @Column('int', { default: 0 })
  @f.Column()
  sharesCount: number

  @Column()
  @Index()
  @f.Column()
  visibility: 'public' | 'friends' | 'private'

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @f.Column()
  createdAt: Date

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' })
  @f.Column()
  updatedAt: Date
}

// entities/Follow.ts
@Entity('follows')
@ObjectType()
export class Follow {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column()
  @Index()
  @f.Column()
  followerId: string

  @Column()
  @Index()
  @f.Column()
  followingId: string

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @f.Column()
  createdAt: Date
}
```

### Social Media Service Implementation

```typescript
// services/SocialService.ts
export class SocialService {
  private postRepository: PostRepository
  private followRepository: FollowRepository
  private userRepository: UserRepository

  constructor() {
    this.postRepository = new PostRepository()
    this.followRepository = new FollowRepository()
    this.userRepository = new UserRepository()
  }

  async createPost(postData: {
    userId: string
    content: string
    media?: any[]
    visibility: 'public' | 'friends' | 'private'
  }) {
    // Extract hashtags and mentions from content
    const hashtags = this.extractHashtags(postData.content)
    const mentions = this.extractMentions(postData.content)

    const post = await this.postRepository.insert({
      ...postData,
      hashtags,
      mentions,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0
    })

    // Notify mentioned users
    await this.notifyMentionedUsers(mentions, post.id)

    return post
  }

  async getFeedForUser(userId: string, params: {
    page?: number
    limit?: number
    type?: 'home' | 'public' | 'user'
    targetUserId?: string
  }) {
    const {
      page = 1,
      limit = 10,
      type = 'home',
      targetUserId
    } = params

    let where: any = {}

    switch (type) {
      case 'home':
        // Get posts from followed users
        const followedUsers = await this.followRepository.findMany({
          where: { followerId: userId },
          select: { followingId: true }
        })
        
        const followedUserIds = followedUsers.map(f => f.followingId)
        followedUserIds.push(userId) // Include own posts
        
        where = {
          userId: { in: followedUserIds },
          visibility: { in: ['public', 'friends'] }
        }
        break

      case 'public':
        where = {
          visibility: 'public'
        }
        break

      case 'user':
        if (!targetUserId) {
          throw new Error('Target user ID required for user feed')
        }
        
        // Check if current user can see target user's posts
        const canSeePrivate = await this.canUserSeePrivatePosts(userId, targetUserId)
        
        where = {
          userId: targetUserId,
          visibility: canSeePrivate ? 
            { in: ['public', 'friends', 'private'] } : 
            { in: ['public', 'friends'] }
        }
        break
    }

    const posts = await this.postRepository.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      limit,
      offset: (page - 1) * limit
    })

    // Enrich posts with user data and engagement status
    const enrichedPosts = await Promise.all(
      posts.map(async (post) => {
        const user = await this.userRepository.findById(post.userId)
        const hasLiked = await this.hasUserLikedPost(userId, post.id)
        
        return {
          ...post,
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar
          },
          hasLiked
        }
      })
    )

    return enrichedPosts
  }

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new Error('Cannot follow yourself')
    }

    const existingFollow = await this.followRepository.findFirst({
      where: { followerId, followingId }
    })

    if (existingFollow) {
      throw new Error('Already following this user')
    }

    const follow = await this.followRepository.insert({
      followerId,
      followingId
    })

    // Update follower/following counts
    await this.updateFollowCounts(followerId, followingId)

    return follow
  }

  async unfollowUser(followerId: string, followingId: string) {
    const follow = await this.followRepository.findFirst({
      where: { followerId, followingId }
    })

    if (!follow) {
      throw new Error('Not following this user')
    }

    await this.followRepository.deleteById(follow.id)

    // Update follower/following counts
    await this.updateFollowCounts(followerId, followingId)
  }

  async getFollowSuggestions(userId: string, limit: number = 10) {
    // Get users followed by people you follow
    const query = `
      SELECT DISTINCT u.id, u.first_name, u.last_name, u.avatar,
             COUNT(f2.id) as mutual_connections
      FROM users u
      JOIN follows f1 ON u.id = f1.following_id
      JOIN follows f2 ON f1.follower_id = f2.following_id
      WHERE f2.follower_id = ?
        AND u.id != ?
        AND u.id NOT IN (
          SELECT following_id FROM follows WHERE follower_id = ?
        )
      GROUP BY u.id
      ORDER BY mutual_connections DESC
      LIMIT ?
    `

    return await this.userRepository.query(query, [userId, userId, userId, limit])
  }

  private extractHashtags(content: string): string[] {
    const hashtags = content.match(/#[a-zA-Z0-9_]+/g) || []
    return hashtags.map(tag => tag.substring(1).toLowerCase())
  }

  private extractMentions(content: string): string[] {
    const mentions = content.match(/@[a-zA-Z0-9_]+/g) || []
    return mentions.map(mention => mention.substring(1).toLowerCase())
  }

  private async canUserSeePrivatePosts(viewerId: string, targetUserId: string): Promise<boolean> {
    if (viewerId === targetUserId) return true
    
    const follow = await this.followRepository.findFirst({
      where: { followerId: viewerId, followingId: targetUserId }
    })
    
    return !!follow
  }

  private async hasUserLikedPost(userId: string, postId: string): Promise<boolean> {
    // Implementation depends on your Like entity structure
    return false
  }

  private async updateFollowCounts(followerId: string, followingId: string) {
    // Update follower and following counts in user records
    // This could be done with triggers or batch jobs for better performance
  }

  private async notifyMentionedUsers(mentions: string[], postId: string) {
    // Send notifications to mentioned users
    // Implementation depends on your notification system
  }
}
```

## API Integration Patterns

### RESTful API with Express

```typescript
// routes/products.ts
import express from 'express'
import { ProductService } from '../services/ProductService'

const router = express.Router()
const productService = new ProductService()

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const params = {
      query: req.query.q as string,
      categoryId: req.query.category as string,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      inStock: req.query.inStock === 'true',
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20
    }

    const result = await productService.searchProducts(params)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const product = await productService.createProduct(req.body)
    res.status(201).json(product)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await productService.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    res.json(product)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
```

### GraphQL Integration

```typescript
// graphql/resolvers/productResolvers.ts
import { ProductService } from '../../services/ProductService'

const productService = new ProductService()

export const productResolvers = {
  Query: {
    products: async (parent: any, args: any, context: any) => {
      return await productService.searchProducts(args)
    },
    product: async (parent: any, args: any, context: any) => {
      return await productService.findById(args.id)
    }
  },
  Mutation: {
    createProduct: async (parent: any, args: any, context: any) => {
      // Check authentication
      if (!context.user) {
        throw new Error('Authentication required')
      }
      
      return await productService.createProduct(args.input)
    },
    updateProduct: async (parent: any, args: any, context: any) => {
      if (!context.user) {
        throw new Error('Authentication required')
      }
      
      return await productService.updateProduct(args.id, args.input)
    }
  }
}
```

These real-world patterns demonstrate how to build complex, scalable applications using Goat Fluent across different domains and use cases.