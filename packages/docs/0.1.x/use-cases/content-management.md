# Content Management System Implementation

This use case demonstrates how to build a comprehensive Content Management System (CMS) using the Fluent ecosystem.

## Overview

A modern CMS requires flexible content modeling, role-based access control, version management, and multi-language support. This guide shows how to implement these features using Fluent's powerful ORM and relationship management capabilities.

## Architecture

```
CMS Architecture:
├── Content Types (Articles, Pages, Media)
├── User Management (Users, Roles, Permissions)
├── Content Versioning
├── Taxonomy (Categories, Tags)
├── Media Management
├── Multi-language Support
└── Publishing Workflow
```

## Core Entities

### Content Type System

```typescript
import { f } from '@goatlab/fluent'

// Base content entity
@f.entity('content_items')
export class ContentItem {
  @f.id()
  id: string

  @f.property({ required: true })
  title: string

  @f.property({ required: true })
  slug: string

  @f.property()
  content: string

  @f.property({ required: true })
  contentType: string

  @f.property({ required: true })
  authorId: string

  @f.property({ default: 'draft' })
  status: 'draft' | 'published' | 'archived' | 'pending'

  @f.property()
  publishedAt: Date

  @f.property()
  metadata: {
    seoTitle?: string
    seoDescription?: string
    featuredImage?: string
    excerpt?: string
    readingTime?: number
    template?: string
  }

  @f.property()
  settings: {
    allowComments: boolean
    showAuthor: boolean
    showDate: boolean
    sticky: boolean
  }

  @f.property()
  createdAt: Date

  @f.property()
  updatedAt: Date

  // Relationships
  @f.belongsTo(() => User, 'authorId')
  author: User

  @f.hasMany(() => ContentVersion, 'contentId')
  versions: ContentVersion[]

  @f.belongsToMany(() => Category, 'content_categories', 'contentId', 'categoryId')
  categories: Category[]

  @f.belongsToMany(() => Tag, 'content_tags', 'contentId', 'tagId')
  tags: Tag[]
}

// Content versioning
@f.entity('content_versions')
export class ContentVersion {
  @f.id()
  id: string

  @f.property({ required: true })
  contentId: string

  @f.property({ required: true })
  title: string

  @f.property()
  content: string

  @f.property()
  metadata: any

  @f.property({ required: true })
  versionNumber: number

  @f.property()
  changeNote: string

  @f.property({ required: true })
  authorId: string

  @f.property()
  createdAt: Date

  @f.belongsTo(() => ContentItem, 'contentId')
  contentItem: ContentItem

  @f.belongsTo(() => User, 'authorId')
  author: User
}

// Multi-language support
@f.entity('content_translations')
export class ContentTranslation {
  @f.id()
  id: string

  @f.property({ required: true })
  contentId: string

  @f.property({ required: true })
  language: string

  @f.property({ required: true })
  title: string

  @f.property()
  content: string

  @f.property()
  slug: string

  @f.property()
  metadata: any

  @f.property()
  createdAt: Date

  @f.property()
  updatedAt: Date

  @f.belongsTo(() => ContentItem, 'contentId')
  contentItem: ContentItem
}
```

### User Management

```typescript
@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true })
  username: string

  @f.property({ required: true })
  email: string

  @f.property({ required: true })
  password: string

  @f.property({ required: true })
  firstName: string

  @f.property({ required: true })
  lastName: string

  @f.property({ default: 'active' })
  status: 'active' | 'inactive' | 'suspended'

  @f.property()
  profile: {
    avatar?: string
    bio?: string
    website?: string
    socialLinks?: {
      twitter?: string
      linkedin?: string
      github?: string
    }
  }

  @f.property()
  preferences: {
    language: string
    timezone: string
    emailNotifications: boolean
    theme: 'light' | 'dark'
  }

  @f.property()
  lastLoginAt: Date

  @f.property()
  createdAt: Date

  @f.property()
  updatedAt: Date

  // Relationships
  @f.belongsToMany(() => Role, 'user_roles', 'userId', 'roleId')
  roles: Role[]

  @f.hasMany(() => ContentItem, 'authorId')
  contentItems: ContentItem[]
}

@f.entity('roles')
export class Role {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property()
  description: string

  @f.property({ required: true })
  permissions: string[]

  @f.property()
  createdAt: Date

  @f.belongsToMany(() => User, 'user_roles', 'roleId', 'userId')
  users: User[]
}
```

### Taxonomy System

```typescript
@f.entity('categories')
export class Category {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property({ required: true })
  slug: string

  @f.property()
  description: string

  @f.property()
  parentId: string

  @f.property({ default: 0 })
  sortOrder: number

  @f.property()
  metadata: {
    color?: string
    icon?: string
    image?: string
  }

  @f.property()
  createdAt: Date

  // Relationships
  @f.belongsTo(() => Category, 'parentId')
  parent: Category

  @f.hasMany(() => Category, 'parentId')
  children: Category[]

  @f.belongsToMany(() => ContentItem, 'content_categories', 'categoryId', 'contentId')
  contentItems: ContentItem[]
}

@f.entity('tags')
export class Tag {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property({ required: true })
  slug: string

  @f.property()
  description: string

  @f.property({ default: 0 })
  usageCount: number

  @f.property()
  createdAt: Date

  @f.belongsToMany(() => ContentItem, 'content_tags', 'tagId', 'contentId')
  contentItems: ContentItem[]
}
```

### Media Management

```typescript
@f.entity('media_items')
export class MediaItem {
  @f.id()
  id: string

  @f.property({ required: true })
  filename: string

  @f.property({ required: true })
  originalName: string

  @f.property({ required: true })
  mimeType: string

  @f.property({ required: true })
  size: number

  @f.property({ required: true })
  url: string

  @f.property()
  thumbnailUrl: string

  @f.property()
  alt: string

  @f.property()
  caption: string

  @f.property()
  metadata: {
    width?: number
    height?: number
    duration?: number
    dimensions?: string
  }

  @f.property({ required: true })
  uploadedBy: string

  @f.property()
  createdAt: Date

  @f.belongsTo(() => User, 'uploadedBy')
  uploader: User
}
```

## Repository Layer

### Content Repository

```typescript
import { TypeOrmConnector } from '@goatlab/fluent'
import { ContentItem } from '../entities/ContentItem'

export class ContentRepository extends TypeOrmConnector<ContentItem, ContentInput, ContentOutput> {
  constructor(dataSource: DataSource) {
    super({
      entity: ContentItem,
      dataSource,
      inputSchema: ContentInputSchema,
      outputSchema: ContentOutputSchema
    })
  }

  // Find published content
  async findPublished(options?: {
    contentType?: string
    category?: string
    tag?: string
    limit?: number
    offset?: number
  }) {
    const conditions: any[] = [
      { status: 'published' },
      { publishedAt: { lte: new Date() } }
    ]

    if (options?.contentType) {
      conditions.push({ contentType: options.contentType })
    }

    let query: any = {
      where: { AND: conditions },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profile: { avatar: true }
          }
        },
        categories: true,
        tags: true
      },
      orderBy: [{ publishedAt: 'desc' }]
    }

    if (options?.limit) {
      query.limit = options.limit
    }

    if (options?.offset) {
      query.offset = options.offset
    }

    return await this.findMany(query)
  }

  // Find by slug
  async findBySlug(slug: string) {
    return await this.findFirst({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profile: true
          }
        },
        categories: true,
        tags: true,
        versions: {
          orderBy: [{ versionNumber: 'desc' }],
          limit: 5
        }
      }
    })
  }

  // Search content
  async searchContent(query: string, options?: {
    contentType?: string
    status?: string
    limit?: number
  }) {
    const conditions: any[] = [
      {
        OR: [
          { title: { contains: query } },
          { content: { contains: query } },
          { 'metadata.excerpt': { contains: query } }
        ]
      }
    ]

    if (options?.contentType) {
      conditions.push({ contentType: options.contentType })
    }

    if (options?.status) {
      conditions.push({ status: options.status })
    }

    return await this.findMany({
      where: { AND: conditions },
      include: {
        author: {
          select: {
            username: true,
            firstName: true,
            lastName: true
          }
        },
        categories: true,
        tags: true
      },
      orderBy: [{ createdAt: 'desc' }],
      limit: options?.limit || 50
    })
  }

  // Get content by author
  async findByAuthor(authorId: string, options?: {
    status?: string
    limit?: number
    offset?: number
  }) {
    const conditions: any[] = [{ authorId }]

    if (options?.status) {
      conditions.push({ status: options.status })
    }

    return await this.findMany({
      where: { AND: conditions },
      include: {
        categories: true,
        tags: true
      },
      orderBy: [{ createdAt: 'desc' }],
      limit: options?.limit,
      offset: options?.offset
    })
  }

  // Get content statistics
  async getContentStats() {
    const content = await this.collect()
    
    return {
      total: content.length,
      published: content.where('status', 'published').length,
      draft: content.where('status', 'draft').length,
      archived: content.where('status', 'archived').length,
      pending: content.where('status', 'pending').length,
      byType: content.groupBy('contentType'),
      byAuthor: content.groupBy('authorId')
    }
  }
}
```

### Version Management Repository

```typescript
export class ContentVersionRepository extends TypeOrmConnector<ContentVersion, ContentVersionInput, ContentVersionOutput> {
  constructor(dataSource: DataSource) {
    super({
      entity: ContentVersion,
      dataSource,
      inputSchema: ContentVersionInputSchema,
      outputSchema: ContentVersionOutputSchema
    })
  }

  // Create version from content
  async createVersion(contentId: string, authorId: string, changeNote?: string) {
    const content = await this.findById(contentId)
    if (!content) {
      throw new Error('Content not found')
    }

    // Get latest version number
    const latestVersion = await this.findFirst({
      where: { contentId },
      orderBy: [{ versionNumber: 'desc' }],
      select: { versionNumber: true }
    })

    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1

    return await this.insert({
      contentId,
      title: content.title,
      content: content.content,
      metadata: content.metadata,
      versionNumber,
      changeNote: changeNote || `Version ${versionNumber}`,
      authorId
    })
  }

  // Get version history
  async getVersionHistory(contentId: string) {
    return await this.findMany({
      where: { contentId },
      include: {
        author: {
          select: {
            username: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [{ versionNumber: 'desc' }]
    })
  }

  // Restore version
  async restoreVersion(contentId: string, versionNumber: number, authorId: string) {
    const version = await this.findFirst({
      where: { contentId, versionNumber }
    })

    if (!version) {
      throw new Error('Version not found')
    }

    // Update content with version data
    const contentRepo = new ContentRepository(this.dataSource)
    const restored = await contentRepo.updateById(contentId, {
      title: version.title,
      content: version.content,
      metadata: version.metadata,
      updatedAt: new Date()
    })

    // Create new version for the restore
    await this.createVersion(contentId, authorId, `Restored from version ${versionNumber}`)

    return restored
  }
}
```

## Service Layer

### Content Service

```typescript
import { ContentRepository } from '../repositories/ContentRepository'
import { ContentVersionRepository } from '../repositories/ContentVersionRepository'
import { UserRepository } from '../repositories/UserRepository'
import { Promises } from '@goatlab/js-utils'

export class ContentService {
  constructor(
    private contentRepo: ContentRepository,
    private versionRepo: ContentVersionRepository,
    private userRepo: UserRepository
  ) {}

  // Create content with version
  async createContent(data: ContentInput, authorId: string) {
    const [error, content] = await Promises.try(
      this.contentRepo.insert({
        ...data,
        authorId,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    )

    if (error) {
      throw new Error(`Failed to create content: ${error.message}`)
    }

    // Create initial version
    await this.versionRepo.createVersion(content.id, authorId, 'Initial version')

    return content
  }

  // Update content with versioning
  async updateContent(id: string, data: ContentInput, authorId: string, changeNote?: string) {
    const [error, content] = await Promises.try(
      this.contentRepo.updateById(id, {
        ...data,
        updatedAt: new Date()
      })
    )

    if (error) {
      throw new Error(`Failed to update content: ${error.message}`)
    }

    // Create version
    await this.versionRepo.createVersion(id, authorId, changeNote)

    return content
  }

  // Publish content
  async publishContent(id: string, authorId: string) {
    // Check permissions
    const user = await this.userRepo.findById(authorId, {
      include: {
        roles: {
          select: { permissions: true }
        }
      }
    })

    if (!user || !this.hasPermission(user, 'content.publish')) {
      throw new Error('Insufficient permissions to publish content')
    }

    return await this.contentRepo.updateById(id, {
      status: 'published',
      publishedAt: new Date(),
      updatedAt: new Date()
    })
  }

  // Get content with related data
  async getContent(id: string, options?: {
    includeVersions?: boolean
    includeTranslations?: boolean
  }) {
    const includeConfig: any = {
      author: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profile: true
        }
      },
      categories: true,
      tags: true
    }

    if (options?.includeVersions) {
      includeConfig.versions = {
        include: {
          author: {
            select: {
              username: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: [{ versionNumber: 'desc' }],
        limit: 10
      }
    }

    return await this.contentRepo.findById(id, {
      include: includeConfig
    })
  }

  // Get published content for public API
  async getPublishedContent(options?: {
    contentType?: string
    category?: string
    tag?: string
    page?: number
    limit?: number
  }) {
    const limit = options?.limit || 20
    const offset = options?.page ? (options.page - 1) * limit : 0

    return await this.contentRepo.findPublished({
      contentType: options?.contentType,
      category: options?.category,
      tag: options?.tag,
      limit,
      offset
    })
  }

  // Search content
  async searchContent(query: string, options?: {
    contentType?: string
    status?: string
    authorId?: string
    page?: number
    limit?: number
  }) {
    const limit = options?.limit || 20
    const offset = options?.page ? (options.page - 1) * limit : 0

    let results = await this.contentRepo.searchContent(query, {
      contentType: options?.contentType,
      status: options?.status,
      limit: limit + offset
    })

    // Filter by author if specified
    if (options?.authorId) {
      results = results.filter(content => content.authorId === options.authorId)
    }

    return results.slice(offset, offset + limit)
  }

  // Get content by slug (for public access)
  async getContentBySlug(slug: string) {
    const content = await this.contentRepo.findBySlug(slug)
    
    if (!content || content.status !== 'published') {
      throw new Error('Content not found')
    }

    return content
  }

  // Get content statistics
  async getContentStatistics() {
    const [contentStats, versionStats] = await Promise.all([
      this.contentRepo.getContentStats(),
      this.getVersionStatistics()
    ])

    return {
      content: contentStats,
      versions: versionStats
    }
  }

  // Get version statistics
  private async getVersionStatistics() {
    const versions = await this.versionRepo.collect()
    
    return {
      total: versions.length,
      byContent: versions.groupBy('contentId'),
      byAuthor: versions.groupBy('authorId')
    }
  }

  // Check user permissions
  private hasPermission(user: any, permission: string): boolean {
    return user.roles.some(role => 
      role.permissions.includes(permission) || 
      role.permissions.includes('*')
    )
  }
}
```

### User Management Service

```typescript
export class UserService {
  constructor(
    private userRepo: UserRepository,
    private roleRepo: RoleRepository
  ) {}

  // Create user with roles
  async createUser(data: UserInput, roleIds: string[]) {
    const user = await this.userRepo.insert({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Assign roles
    const userWithRoles = await this.userRepo.loadById(user.id)
    for (const roleId of roleIds) {
      await userWithRoles.roles().attach(roleId)
    }

    return user
  }

  // Get user with permissions
  async getUserWithPermissions(userId: string) {
    const user = await this.userRepo.findById(userId, {
      include: {
        roles: {
          select: {
            name: true,
            permissions: true
          }
        }
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Flatten permissions
    const permissions = user.roles.reduce((acc, role) => {
      return [...acc, ...role.permissions]
    }, [])

    return {
      ...user,
      permissions: [...new Set(permissions)]
    }
  }

  // Check user permission
  async checkPermission(userId: string, permission: string): Promise<boolean> {
    const user = await this.getUserWithPermissions(userId)
    return user.permissions.includes(permission) || user.permissions.includes('*')
  }

  // Get users with role filtering
  async getUsers(options?: {
    role?: string
    status?: string
    page?: number
    limit?: number
  }) {
    const limit = options?.limit || 20
    const offset = options?.page ? (options.page - 1) * limit : 0

    const conditions: any[] = []

    if (options?.status) {
      conditions.push({ status: options.status })
    }

    return await this.userRepo.findMany({
      where: conditions.length > 0 ? { AND: conditions } : {},
      include: {
        roles: {
          select: {
            name: true,
            permissions: true
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }],
      limit,
      offset
    })
  }
}
```

## API Layer

### Content Controller

```typescript
import { Request, Response } from 'express'
import { ContentService } from '../services/ContentService'

export class ContentController {
  constructor(private contentService: ContentService) {}

  // Create content
  createContent = async (req: Request, res: Response) => {
    try {
      const data = ContentInputSchema.parse(req.body)
      const authorId = req.user.id // From auth middleware
      
      const content = await this.contentService.createContent(data, authorId)
      
      res.status(201).json({
        success: true,
        data: content,
        message: 'Content created successfully'
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      })
    }
  }

  // Get content list (admin)
  getContentList = async (req: Request, res: Response) => {
    try {
      const {
        page = 1,
        limit = 20,
        contentType,
        status,
        authorId,
        search
      } = req.query

      let content
      if (search) {
        content = await this.contentService.searchContent(search as string, {
          contentType: contentType as string,
          status: status as string,
          authorId: authorId as string,
          page: parseInt(page as string),
          limit: parseInt(limit as string)
        })
      } else {
        content = await this.contentService.getPublishedContent({
          contentType: contentType as string,
          page: parseInt(page as string),
          limit: parseInt(limit as string)
        })
      }

      res.json({
        success: true,
        data: content,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: content.length
        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Get single content
  getContent = async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const { includeVersions, includeTranslations } = req.query

      const content = await this.contentService.getContent(id, {
        includeVersions: includeVersions === 'true',
        includeTranslations: includeTranslations === 'true'
      })

      if (!content) {
        return res.status(404).json({
          success: false,
          error: 'Content not found'
        })
      }

      res.json({
        success: true,
        data: content
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Get content by slug (public)
  getContentBySlug = async (req: Request, res: Response) => {
    try {
      const { slug } = req.params
      const content = await this.contentService.getContentBySlug(slug)

      res.json({
        success: true,
        data: content
      })
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      })
    }
  }

  // Update content
  updateContent = async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const data = ContentInputSchema.partial().parse(req.body)
      const authorId = req.user.id
      const changeNote = req.body.changeNote

      const content = await this.contentService.updateContent(id, data, authorId, changeNote)

      res.json({
        success: true,
        data: content,
        message: 'Content updated successfully'
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      })
    }
  }

  // Publish content
  publishContent = async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const authorId = req.user.id

      const content = await this.contentService.publishContent(id, authorId)

      res.json({
        success: true,
        data: content,
        message: 'Content published successfully'
      })
    } catch (error) {
      res.status(403).json({
        success: false,
        error: error.message
      })
    }
  }

  // Get content statistics
  getContentStatistics = async (req: Request, res: Response) => {
    try {
      const stats = await this.contentService.getContentStatistics()

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
}
```

## Advanced Features

### 1. Content Workflow

```typescript
// Workflow states
export enum ContentWorkflowState {
  DRAFT = 'draft',
  REVIEW = 'review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

// Workflow transitions
export class ContentWorkflowService {
  constructor(private contentService: ContentService) {}

  async transitionContent(contentId: string, newState: ContentWorkflowState, userId: string) {
    const content = await this.contentService.getContent(contentId)
    const user = await this.userService.getUserWithPermissions(userId)

    // Check transition permissions
    if (!this.canTransition(content.status, newState, user.permissions)) {
      throw new Error('Transition not allowed')
    }

    // Update content state
    await this.contentService.updateContent(contentId, { status: newState }, userId)

    // Send notifications
    await this.notifyStakeholders(content, newState, user)
  }

  private canTransition(currentState: string, newState: ContentWorkflowState, permissions: string[]): boolean {
    const transitions = {
      [ContentWorkflowState.DRAFT]: [ContentWorkflowState.REVIEW],
      [ContentWorkflowState.REVIEW]: [ContentWorkflowState.APPROVED, ContentWorkflowState.DRAFT],
      [ContentWorkflowState.APPROVED]: [ContentWorkflowState.PUBLISHED, ContentWorkflowState.REVIEW],
      [ContentWorkflowState.PUBLISHED]: [ContentWorkflowState.ARCHIVED],
      [ContentWorkflowState.ARCHIVED]: [ContentWorkflowState.DRAFT]
    }

    return transitions[currentState]?.includes(newState) || permissions.includes('content.admin')
  }
}
```

### 2. Multi-language Support

```typescript
export class MultiLanguageService {
  constructor(
    private contentRepo: ContentRepository,
    private translationRepo: ContentTranslationRepository
  ) {}

  async createTranslation(contentId: string, language: string, translationData: any) {
    return await this.translationRepo.insert({
      contentId,
      language,
      ...translationData,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  async getContentWithTranslations(contentId: string, language?: string) {
    const content = await this.contentRepo.findById(contentId, {
      include: {
        translations: language ? { where: { language } } : true
      }
    })

    if (language && content?.translations?.length > 0) {
      // Merge translation data
      const translation = content.translations[0]
      return {
        ...content,
        title: translation.title,
        content: translation.content,
        slug: translation.slug,
        metadata: { ...content.metadata, ...translation.metadata }
      }
    }

    return content
  }
}
```

### 3. Media Integration

```typescript
export class MediaService {
  constructor(private mediaRepo: MediaRepository) {}

  async uploadMedia(file: Express.Multer.File, userId: string) {
    // Upload to storage (S3, GCP, etc.)
    const uploadResult = await this.uploadToStorage(file)

    // Create media record
    return await this.mediaRepo.insert({
      filename: uploadResult.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: uploadResult.url,
      thumbnailUrl: uploadResult.thumbnailUrl,
      metadata: await this.extractMetadata(file),
      uploadedBy: userId,
      createdAt: new Date()
    })
  }

  async getMediaLibrary(options?: {
    mimeType?: string
    page?: number
    limit?: number
  }) {
    const conditions: any[] = []

    if (options?.mimeType) {
      conditions.push({ mimeType: { contains: options.mimeType } })
    }

    return await this.mediaRepo.findMany({
      where: conditions.length > 0 ? { AND: conditions } : {},
      include: {
        uploader: {
          select: {
            username: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }],
      limit: options?.limit || 50,
      offset: options?.page ? (options.page - 1) * (options.limit || 50) : 0
    })
  }

  private async uploadToStorage(file: Express.Multer.File) {
    // Implementation depends on storage provider
    // Return { filename, url, thumbnailUrl }
  }

  private async extractMetadata(file: Express.Multer.File) {
    // Extract metadata based on file type
    // Return metadata object
  }
}
```

## Key Benefits

1. **Flexible Content Modeling**: Support for multiple content types with custom fields
2. **Version Control**: Full version history with restore capabilities
3. **Role-based Access**: Granular permissions for content management
4. **Multi-language Support**: Built-in internationalization
5. **Workflow Management**: Customizable content approval workflows
6. **Media Management**: Integrated media library with metadata
7. **Search and Filtering**: Powerful content discovery
8. **Performance**: Optimized queries with selective loading

## Best Practices

1. **Use Versioning**: Always version content changes
2. **Implement Permissions**: Strict access control
3. **Optimize Queries**: Use selective field loading
4. **Cache Results**: Cache frequently accessed content
5. **Validate Input**: Comprehensive input validation
6. **Monitor Performance**: Track query performance
7. **Backup Content**: Regular content backups

This CMS implementation demonstrates the power of the Fluent ecosystem for building complex content management systems with sophisticated relationships and business logic.

## Related Documentation

- [Relationships](../examples/relations.md) - Working with relationships
- [Complex Queries](../examples/complex-queries.md) - Advanced query patterns
- [Performance Guide](../guides/performance.md) - Optimization strategies