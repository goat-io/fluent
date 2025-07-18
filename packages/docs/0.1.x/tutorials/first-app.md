# Building Your First App with Fluent

This tutorial guides you through creating your first application using the Fluent ecosystem. We'll build a simple task management API from scratch.

## Prerequisites

- Node.js 18+ installed
- Basic knowledge of TypeScript
- Understanding of REST APIs

## Project Setup

### 1. Initialize the Project

```bash
mkdir task-manager-api
cd task-manager-api
npm init -y
```

### 2. Install Dependencies

```bash
# Core dependencies
npm install @goatlab/fluent @goatlab/js-utils @goatlab/node-utils
npm install typeorm reflect-metadata
npm install zod
npm install express cors helmet morgan
npm install mysql2  # or your preferred database driver

# Development dependencies
npm install -D typescript @types/node @types/express
npm install -D nodemon ts-node
npm install -D @types/cors @types/helmet @types/morgan
```

### 3. Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. Project Structure

```
task-manager-api/
├── src/
│   ├── entities/
│   │   └── Task.ts
│   ├── repositories/
│   │   └── TaskRepository.ts
│   ├── services/
│   │   └── TaskService.ts
│   ├── controllers/
│   │   └── TaskController.ts
│   ├── routes/
│   │   └── taskRoutes.ts
│   ├── config/
│   │   └── database.ts
│   └── app.ts
├── package.json
└── tsconfig.json
```

## Define the Entity

Create `src/entities/Task.ts`:

```typescript
import { f } from '@goatlab/fluent'

@f.entity('tasks')
export class Task {
  @f.id()
  id: string

  @f.property({ required: true })
  title: string

  @f.property()
  description: string

  @f.property({ default: false })
  completed: boolean

  @f.property({ default: 'low' })
  priority: 'low' | 'medium' | 'high'

  @f.property()
  dueDate: Date

  @f.property()
  createdAt: Date

  @f.property()
  updatedAt: Date
}
```

## Create Schemas

Create `src/schemas/TaskSchemas.ts`:

```typescript
import { z } from 'zod'

export const TaskInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  completed: z.boolean().default(false),
  priority: z.enum(['low', 'medium', 'high']).default('low'),
  dueDate: z.date().optional()
})

export const TaskUpdateSchema = TaskInputSchema.partial()

export const TaskOutputSchema = TaskInputSchema.extend({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type TaskInput = z.infer<typeof TaskInputSchema>
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>
export type TaskOutput = z.infer<typeof TaskOutputSchema>
```

## Configure Database

Create `src/config/database.ts`:

```typescript
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Task } from '../entities/Task'

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'task_manager',
  synchronize: true, // Don't use in production
  logging: true,
  entities: [Task],
  migrations: [],
  subscribers: []
})

export const initializeDatabase = async () => {
  try {
    await AppDataSource.initialize()
    console.log('Database connected successfully')
  } catch (error) {
    console.error('Database connection failed:', error)
    process.exit(1)
  }
}
```

## Create Repository

Create `src/repositories/TaskRepository.ts`:

```typescript
import { TypeOrmConnector } from '@goatlab/fluent'
import { Task } from '../entities/Task'
import { TaskInputSchema, TaskOutputSchema, TaskInput, TaskOutput } from '../schemas/TaskSchemas'
import { AppDataSource } from '../config/database'

export class TaskRepository extends TypeOrmConnector<Task, TaskInput, TaskOutput> {
  constructor() {
    super({
      entity: Task,
      dataSource: AppDataSource,
      inputSchema: TaskInputSchema,
      outputSchema: TaskOutputSchema
    })
  }

  // Custom method to find tasks by priority
  async findByPriority(priority: 'low' | 'medium' | 'high') {
    return await this.findMany({
      where: { priority },
      orderBy: [{ createdAt: 'desc' }]
    })
  }

  // Custom method to find overdue tasks
  async findOverdueTasks() {
    const now = new Date()
    return await this.findMany({
      where: {
        dueDate: { lt: now },
        completed: false
      },
      orderBy: [{ dueDate: 'asc' }]
    })
  }

  // Custom method to find tasks due soon
  async findTasksDueSoon(days: number = 7) {
    const now = new Date()
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    
    return await this.findMany({
      where: {
        dueDate: {
          gte: now,
          lte: future
        },
        completed: false
      },
      orderBy: [{ dueDate: 'asc' }]
    })
  }
}
```

## Create Service Layer

Create `src/services/TaskService.ts`:

```typescript
import { TaskRepository } from '../repositories/TaskRepository'
import { TaskInput, TaskUpdate, TaskOutput } from '../schemas/TaskSchemas'
import { Promises } from '@goatlab/js-utils'

export class TaskService {
  constructor(private taskRepository: TaskRepository) {}

  async createTask(data: TaskInput): Promise<TaskOutput> {
    const [error, task] = await Promises.try(
      this.taskRepository.insert({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    )

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`)
    }

    return task
  }

  async getAllTasks(): Promise<TaskOutput[]> {
    return await this.taskRepository.findMany({
      orderBy: [{ createdAt: 'desc' }]
    })
  }

  async getTaskById(id: string): Promise<TaskOutput> {
    const task = await this.taskRepository.findById(id)
    
    if (!task) {
      throw new Error(`Task with ID ${id} not found`)
    }

    return task
  }

  async updateTask(id: string, data: TaskUpdate): Promise<TaskOutput> {
    const [error, task] = await Promises.try(
      this.taskRepository.updateById(id, {
        ...data,
        updatedAt: new Date()
      })
    )

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`)
    }

    return task
  }

  async deleteTask(id: string): Promise<void> {
    const [error] = await Promises.try(
      this.taskRepository.deleteById(id)
    )

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`)
    }
  }

  async markTaskComplete(id: string): Promise<TaskOutput> {
    return await this.updateTask(id, { completed: true })
  }

  async markTaskIncomplete(id: string): Promise<TaskOutput> {
    return await this.updateTask(id, { completed: false })
  }

  async getTasksByPriority(priority: 'low' | 'medium' | 'high'): Promise<TaskOutput[]> {
    return await this.taskRepository.findByPriority(priority)
  }

  async getOverdueTasks(): Promise<TaskOutput[]> {
    return await this.taskRepository.findOverdueTasks()
  }

  async getTasksDueSoon(days: number = 7): Promise<TaskOutput[]> {
    return await this.taskRepository.findTasksDueSoon(days)
  }

  async getTaskStatistics() {
    const tasks = await this.taskRepository.collect()
    
    return {
      total: tasks.length,
      completed: tasks.where('completed', true).length,
      pending: tasks.where('completed', false).length,
      overdue: (await this.getOverdueTasks()).length,
      dueSoon: (await this.getTasksDueSoon()).length,
      byPriority: {
        low: tasks.where('priority', 'low').length,
        medium: tasks.where('priority', 'medium').length,
        high: tasks.where('priority', 'high').length
      }
    }
  }
}
```

## Create Controller

Create `src/controllers/TaskController.ts`:

```typescript
import { Request, Response } from 'express'
import { TaskService } from '../services/TaskService'
import { TaskInputSchema, TaskUpdateSchema } from '../schemas/TaskSchemas'

export class TaskController {
  constructor(private taskService: TaskService) {}

  createTask = async (req: Request, res: Response) => {
    try {
      const validatedData = TaskInputSchema.parse(req.body)
      const task = await this.taskService.createTask(validatedData)
      
      res.status(201).json({
        success: true,
        data: task,
        message: 'Task created successfully'
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      })
    }
  }

  getAllTasks = async (req: Request, res: Response) => {
    try {
      const tasks = await this.taskService.getAllTasks()
      
      res.json({
        success: true,
        data: tasks,
        count: tasks.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  getTaskById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const task = await this.taskService.getTaskById(id)
      
      res.json({
        success: true,
        data: task
      })
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      })
    }
  }

  updateTask = async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const validatedData = TaskUpdateSchema.parse(req.body)
      const task = await this.taskService.updateTask(id, validatedData)
      
      res.json({
        success: true,
        data: task,
        message: 'Task updated successfully'
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      })
    }
  }

  deleteTask = async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      await this.taskService.deleteTask(id)
      
      res.json({
        success: true,
        message: 'Task deleted successfully'
      })
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      })
    }
  }

  markTaskComplete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const task = await this.taskService.markTaskComplete(id)
      
      res.json({
        success: true,
        data: task,
        message: 'Task marked as complete'
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      })
    }
  }

  markTaskIncomplete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const task = await this.taskService.markTaskIncomplete(id)
      
      res.json({
        success: true,
        data: task,
        message: 'Task marked as incomplete'
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      })
    }
  }

  getTasksByPriority = async (req: Request, res: Response) => {
    try {
      const { priority } = req.params
      
      if (!['low', 'medium', 'high'].includes(priority)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid priority. Must be low, medium, or high'
        })
      }
      
      const tasks = await this.taskService.getTasksByPriority(priority as any)
      
      res.json({
        success: true,
        data: tasks,
        count: tasks.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  getOverdueTasks = async (req: Request, res: Response) => {
    try {
      const tasks = await this.taskService.getOverdueTasks()
      
      res.json({
        success: true,
        data: tasks,
        count: tasks.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  getTasksDueSoon = async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 7
      const tasks = await this.taskService.getTasksDueSoon(days)
      
      res.json({
        success: true,
        data: tasks,
        count: tasks.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  getTaskStatistics = async (req: Request, res: Response) => {
    try {
      const stats = await this.taskService.getTaskStatistics()
      
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

## Create Routes

Create `src/routes/taskRoutes.ts`:

```typescript
import { Router } from 'express'
import { TaskController } from '../controllers/TaskController'
import { TaskService } from '../services/TaskService'
import { TaskRepository } from '../repositories/TaskRepository'

const router = Router()

// Initialize dependencies
const taskRepository = new TaskRepository()
const taskService = new TaskService(taskRepository)
const taskController = new TaskController(taskService)

// Routes
router.post('/', taskController.createTask)
router.get('/', taskController.getAllTasks)
router.get('/stats', taskController.getTaskStatistics)
router.get('/overdue', taskController.getOverdueTasks)
router.get('/due-soon', taskController.getTasksDueSoon)
router.get('/priority/:priority', taskController.getTasksByPriority)
router.get('/:id', taskController.getTaskById)
router.put('/:id', taskController.updateTask)
router.delete('/:id', taskController.deleteTask)
router.patch('/:id/complete', taskController.markTaskComplete)
router.patch('/:id/incomplete', taskController.markTaskIncomplete)

export default router
```

## Create Application

Create `src/app.ts`:

```typescript
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { Fluent } from '@goatlab/fluent'
import { initializeDatabase, AppDataSource } from './config/database'
import { Task } from './entities/Task'
import taskRoutes from './routes/taskRoutes'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(helmet())
app.use(cors())
app.use(morgan('combined'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api/tasks', taskRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Task Manager API is running',
    timestamp: new Date().toISOString()
  })
})

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Error:', error)
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  })
})

// Start server
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase()
    
    // Initialize Fluent
    await Fluent.initialize([AppDataSource], [Task])
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      console.log(`Health check: http://localhost:${PORT}/health`)
      console.log(`API endpoint: http://localhost:${PORT}/api/tasks`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
```

## Environment Configuration

Create `.env` file:

```env
# Database configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_NAME=task_manager

# Server configuration
PORT=3000
NODE_ENV=development
```

## Package.json Scripts

Update `package.json`:

```json
{
  "scripts": {
    "dev": "nodemon src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

## Running the Application

### 1. Setup Database

Create a MySQL database named `task_manager`:

```sql
CREATE DATABASE task_manager;
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

## Testing the API

### 1. Health Check

```bash
curl http://localhost:3000/health
```

### 2. Create a Task

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete project documentation",
    "description": "Write comprehensive documentation for the project",
    "priority": "high",
    "dueDate": "2024-01-15T10:00:00Z"
  }'
```

### 3. Get All Tasks

```bash
curl http://localhost:3000/api/tasks
```

### 4. Get Task by ID

```bash
curl http://localhost:3000/api/tasks/TASK_ID
```

### 5. Update Task

```bash
curl -X PUT http://localhost:3000/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated task title",
    "priority": "medium"
  }'
```

### 6. Mark Task Complete

```bash
curl -X PATCH http://localhost:3000/api/tasks/TASK_ID/complete
```

### 7. Get Task Statistics

```bash
curl http://localhost:3000/api/tasks/stats
```

### 8. Get Overdue Tasks

```bash
curl http://localhost:3000/api/tasks/overdue
```

### 9. Get Tasks by Priority

```bash
curl http://localhost:3000/api/tasks/priority/high
```

### 10. Delete Task

```bash
curl -X DELETE http://localhost:3000/api/tasks/TASK_ID
```

## Adding Advanced Features

### 1. Pagination

Update `TaskController.getAllTasks`:

```typescript
getAllTasks = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const offset = (page - 1) * limit
    
    const tasks = await this.taskService.getAllTasks()
    const paginatedTasks = tasks.slice(offset, offset + limit)
    
    res.json({
      success: true,
      data: paginatedTasks,
      pagination: {
        page,
        limit,
        total: tasks.length,
        totalPages: Math.ceil(tasks.length / limit)
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
```

### 2. Search and Filtering

Add search method to `TaskService`:

```typescript
async searchTasks(query: string): Promise<TaskOutput[]> {
  return await this.taskRepository.findMany({
    where: {
      OR: [
        { title: { contains: query } },
        { description: { contains: query } }
      ]
    },
    orderBy: [{ createdAt: 'desc' }]
  })
}
```

### 3. Sorting

Update `TaskService.getAllTasks`:

```typescript
async getAllTasks(sortBy: string = 'createdAt', order: 'asc' | 'desc' = 'desc'): Promise<TaskOutput[]> {
  return await this.taskRepository.findMany({
    orderBy: [{ [sortBy]: order }]
  })
}
```

## Next Steps

1. **Add Authentication**: Implement JWT-based authentication
2. **Add Validation**: Enhance input validation and error handling
3. **Add Testing**: Write unit and integration tests
4. **Add Logging**: Implement structured logging
5. **Add Documentation**: Generate API documentation with Swagger
6. **Add Rate Limiting**: Implement rate limiting for API endpoints
7. **Add Caching**: Add Redis for caching frequently accessed data
8. **Add Monitoring**: Add health checks and metrics

## Conclusion

You've successfully built a complete task management API using the Fluent ecosystem! This tutorial covered:

- Entity definition with decorators
- Repository pattern with TypeORM connector
- Service layer with business logic
- RESTful API endpoints
- Error handling and validation
- Custom query methods
- Statistics and analytics

The Fluent ecosystem provides a powerful foundation for building type-safe, scalable applications with consistent data access patterns across different databases.

## Related Documentation

- [CRUD Operations](../examples/crud-operations.md) - Complete CRUD examples
- [Complex Queries](../examples/complex-queries.md) - Advanced query patterns
- [API Reference](../api/connector-api.md) - Complete API documentation
- [Best Practices](../guides/best-practices.md) - Development best practices