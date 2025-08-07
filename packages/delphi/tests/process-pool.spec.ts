// npx vitest run tests/process-pool.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ProcessPool } from '../src/utils/process-pool-impl'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

describe('Process Pool Memory Management', () => {
  let pool: ProcessPool
  
  beforeEach(() => {
    // Set a reasonable limit for testing
    process.env.CLAUDE_MAX_WORKERS = '3'
  })
  
  afterEach(async () => {
    if (pool) {
      await pool.shutdown()
    }
  })

  it('should not leak workers when processing 50 sequential goals', async () => {
    pool = new ProcessPool({
      maxWorkers: 3,
      idleTimeoutMs: 5000, // Shorter timeout for testing
      command: 'node',
      args: ['-e', 'setTimeout(() => console.log("done"), 100)']
    })
    
    // Get initial process count
    const getNodeProcessCount = async () => {
      try {
        const { stdout } = await execAsync('ps aux | grep -c "[n]ode -e"')
        return parseInt(stdout.trim(), 10)
      } catch {
        return 0
      }
    }
    
    const initialCount = await getNodeProcessCount()
    
    // Process 50 sequential tasks
    const tasks = []
    for (let i = 0; i < 50; i++) {
      tasks.push(
        pool.execute(`Task ${i}`, {
          timeout: 1000,
          env: { TASK_ID: String(i) }
        })
      )
      
      // Small delay between tasks to simulate real usage
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    
    // Wait for all tasks to complete
    await Promise.all(tasks)
    
    // Check process count after tasks
    const afterTasksCount = await getNodeProcessCount()
    
    // Should not exceed maxWorkers + initial count
    expect(afterTasksCount - initialCount).toBeLessThanOrEqual(3)
    
    // Wait for idle timeout
    await new Promise(resolve => setTimeout(resolve, 6000))
    
    // Check that idle workers are cleaned up
    const finalCount = await getNodeProcessCount()
    expect(finalCount).toBeLessThanOrEqual(initialCount + 1)
  }, { timeout: 30000 })

  it('should reuse workers efficiently', async () => {
    pool = new ProcessPool({
      maxWorkers: 2,
      idleTimeoutMs: 10000,
      command: 'node',
      args: ['-e', 'console.log(process.pid); setTimeout(() => {}, 100)']
    })
    
    const pids = new Set<number>()
    
    // Run 10 tasks and collect PIDs
    for (let i = 0; i < 10; i++) {
      const result = await pool.execute(`Task ${i}`, {
        timeout: 1000
      })
      
      // Extract PID from output
      const pid = parseInt(result.stdout.trim(), 10)
      if (!isNaN(pid)) {
        pids.add(pid)
      }
    }
    
    // Should have reused workers (PIDs should be less than task count)
    expect(pids.size).toBeLessThanOrEqual(2)
  })

  it('should handle worker crashes gracefully', async () => {
    pool = new ProcessPool({
      maxWorkers: 2,
      idleTimeoutMs: 5000,
      command: 'node',
      args: ['-e', 'if (process.env.CRASH === "true") process.exit(1); console.log("ok")']
    })
    
    const results = []
    
    // Mix of crashing and successful tasks
    for (let i = 0; i < 10; i++) {
      try {
        const result = await pool.execute(`Task ${i}`, {
          timeout: 1000,
          env: { CRASH: i % 3 === 0 ? 'true' : 'false' }
        })
        results.push({ success: true, output: result.stdout })
      } catch (error) {
        results.push({ success: false, error })
      }
    }
    
    // Should have both successes and failures
    const successes = results.filter(r => r.success).length
    const failures = results.filter(r => !r.success).length
    
    expect(successes).toBeGreaterThan(0)
    expect(failures).toBeGreaterThan(0)
    
    // Pool should still be functional
    const finalResult = await pool.execute('Final task', {
      timeout: 1000,
      env: { CRASH: 'false' }
    })
    expect(finalResult.stdout.trim()).toBe('ok')
  })

  it('should enforce memory limits per worker', async () => {
    pool = new ProcessPool({
      maxWorkers: 1,
      idleTimeoutMs: 5000,
      command: 'node',
      args: ['-e', `
        const arr = [];
        if (process.env.ALLOCATE === 'true') {
          // Try to allocate a lot of memory
          for (let i = 0; i < 1000000; i++) {
            arr.push(new Array(1000).fill('x'.repeat(1000)));
          }
        }
        console.log('done');
      `],
      maxMemoryMB: 128 // Limit to 128MB
    })
    
    // This should fail due to memory limit
    await expect(
      pool.execute('Memory hog', {
        timeout: 5000,
        env: { ALLOCATE: 'true' }
      })
    ).rejects.toThrow()
    
    // Pool should recover and handle normal tasks
    const result = await pool.execute('Normal task', {
      timeout: 1000,
      env: { ALLOCATE: 'false' }
    })
    expect(result.stdout.trim()).toBe('done')
  })

  it('should handle queue backpressure', async () => {
    pool = new ProcessPool({
      maxWorkers: 1,
      idleTimeoutMs: 5000,
      maxQueueSize: 5,
      command: 'node',
      args: ['-e', 'setTimeout(() => console.log("done"), 500)']
    })
    
    const tasks = []
    const rejected = []
    
    // Try to queue more than maxQueueSize
    for (let i = 0; i < 10; i++) {
      tasks.push(
        pool.execute(`Task ${i}`, { timeout: 2000 })
          .catch(error => {
            rejected.push(i)
            return error
          })
      )
    }
    
    await Promise.all(tasks)
    
    // Some tasks should have been rejected due to queue limit
    expect(rejected.length).toBeGreaterThan(0)
  })

  it('should clean up zombie processes', async () => {
    pool = new ProcessPool({
      maxWorkers: 2,
      idleTimeoutMs: 2000,
      zombieCheckIntervalMs: 1000,
      command: 'node',
      args: ['-e', 'setTimeout(() => {}, 10000)'] // Long-running process
    })
    
    // Start a task that will become a zombie
    const longTask = pool.execute('Long task', {
      timeout: 500 // Will timeout before process finishes
    }).catch(() => 'timeout')
    
    await longTask
    
    // Wait for zombie check
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Check that the zombie was cleaned up
    const { stdout } = await execAsync('ps aux | grep -c "[n]ode -e.*10000" || echo 0')
    const zombieCount = parseInt(stdout.trim(), 10)
    
    expect(zombieCount).toBe(0)
  })

  it('should track worker statistics', async () => {
    pool = new ProcessPool({
      maxWorkers: 2,
      idleTimeoutMs: 5000,
      trackStats: true,
      command: 'node',
      args: ['-e', 'console.log("task done")']
    })
    
    // Run several tasks
    for (let i = 0; i < 20; i++) {
      await pool.execute(`Task ${i}`, { timeout: 1000 })
    }
    
    const stats = pool.getStatistics()
    
    expect(stats.totalTasks).toBe(20)
    expect(stats.activeTasks).toBe(0)
    expect(stats.queuedTasks).toBe(0)
    expect(stats.totalWorkers).toBeLessThanOrEqual(2)
    expect(stats.idleWorkers).toBeGreaterThanOrEqual(0)
    expect(stats.tasksPerWorker).toBeGreaterThan(0)
  })
})