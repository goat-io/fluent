// npx ts-node ./src/server/middleware/memoryMonitor.example.ts

/**
 * Example demonstrating memory monitoring middleware capabilities
 * 
 * This example shows:
 * 1. How memory monitoring tracks heap usage
 * 2. Warning and critical threshold alerts
 * 3. Memory metrics in response headers
 * 4. Automatic garbage collection triggers (when available)
 * 
 * To run with garbage collection enabled:
 * node --expose-gc -r ts-node/register ./src/server/middleware/memoryMonitor.example.ts
 */

import express from 'express'
import { createMemoryMonitorMiddleware } from './memoryMonitor.middleware'

const app = express()
const port = 3001

// Create memory monitor with aggressive thresholds for demo
const { middleware: memoryMiddleware, monitor } = createMemoryMonitorMiddleware({
  warningThreshold: 70,  // Warn at 70% heap usage
  criticalThreshold: 85, // Critical at 85% heap usage
  monitorInterval: 5000, // Check every 5 seconds
  enableGarbageCollection: true,
  addHeaders: true // Add memory info to response headers
})

app.use(memoryMiddleware)

// Endpoint to check current memory status
app.get('/memory-status', (req, res) => {
  const metrics = monitor.getLastMetrics()
  const memUsage = process.memoryUsage()
  
  res.json({
    current: {
      heapUsedMB: (memUsage.heapUsed / (1024 * 1024)).toFixed(2),
      heapTotalMB: (memUsage.heapTotal / (1024 * 1024)).toFixed(2),
      heapUsedPercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1),
      rssMB: (memUsage.rss / (1024 * 1024)).toFixed(2)
    },
    lastMonitored: metrics ? {
      heapUsedMB: metrics.heapUsedMB.toFixed(2),
      heapTotalMB: metrics.heapTotalMB.toFixed(2),
      heapUsedPercent: metrics.heapUsedPercentage.toFixed(1),
      timestamp: new Date(metrics.timestamp).toISOString()
    } : null,
    thresholds: {
      warning: '70%',
      critical: '85%'
    }
  })
})

// Endpoint to simulate memory leak (for testing)
let leakedData: any[] = []
app.get('/leak-memory', (req, res) => {
  // Allocate 10MB of memory
  const size = 10 * 1024 * 1024
  const buffer = Buffer.alloc(size)
  leakedData.push(buffer)
  
  res.json({
    message: 'Allocated 10MB',
    totalLeaked: `${leakedData.length * 10}MB`,
    currentHeapMB: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2)
  })
})

// Endpoint to clear leaked memory
app.get('/clear-memory', (req, res) => {
  const beforeMB = (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2)
  leakedData = []
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc()
  }
  
  setTimeout(() => {
    const afterMB = (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2)
    res.json({
      message: 'Memory cleared',
      beforeMB,
      afterMB,
      freedMB: (parseFloat(beforeMB) - parseFloat(afterMB)).toFixed(2)
    })
  }, 100)
})

// Health endpoint showing memory in response
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const server = app.listen(port, () => {
  console.log(`Memory monitoring example server running at http://localhost:${port}`)
  console.log('\nEndpoints:')
  console.log('  GET /memory-status - Check current memory usage')
  console.log('  GET /leak-memory   - Simulate memory leak (allocates 10MB)')
  console.log('  GET /clear-memory  - Clear leaked memory')
  console.log('  GET /health        - Health check (see memory headers)')
  console.log('\nMemory headers added to all responses:')
  console.log('  X-Memory-Heap-Used-MB')
  console.log('  X-Memory-Heap-Total-MB')
  console.log('  X-Memory-Heap-Used-Percent')
  console.log('  X-Memory-RSS-MB')
  console.log('\nWatch the console for memory warnings/alerts!')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  monitor.stopMonitoring()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})