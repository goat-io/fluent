import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  checkpointer,
  cleanupDatabase,
  initializeMemory,
} from '../../checkpoint/sqlite.js'
import { buildGraph } from '../../graph.js'
import type { FlowState } from '../../types.js'

describe('E2E Test - Full Pipeline', () => {
  beforeAll(async () => {
    await initializeMemory()
  })

  afterAll(async () => {
    await cleanupDatabase()
  })

  it('should complete "Add pino logging to all Fastify routes" scenario', async () => {
    // Mock the AutoGen service responses for E2E test
    const mockServer = {
      plan: vi.fn().mockResolvedValue({
        data: {
          draft: `Add pino logging to all Fastify routes:
1. Install pino and pino-pretty dependencies
2. Create a logger instance with appropriate configuration
3. Add logging middleware to all Fastify routes
4. Include request ID tracking
5. Log request/response times and status codes`,
        },
      }),
      refine: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            refined: `Technical Specification: Add Pino Logging to Fastify

1. Dependencies:
   - npm install pino pino-pretty

2. Logger Configuration (src/logger.ts):
   export const logger = pino({
     level: process.env.LOG_LEVEL || 'info',
     transport: {
       target: 'pino-pretty',
       options: { colorize: true }
     }
   });

3. Fastify Integration:
   - Import logger in main server file
   - Add to Fastify instance: fastify.register(require('fastify-pino'), { logger })
   - All routes will automatically log requests/responses

4. Request ID: Enabled by default with fastify-pino

This specification needs more detail on error handling.`,
            clear: false,
          },
        })
        .mockResolvedValueOnce({
          data: {
            refined: `Technical Specification: Add Pino Logging to Fastify

1. Install Dependencies:
   npm install pino pino-pretty fastify-pino

2. Create Logger Module (src/logger.ts):
   import pino from 'pino';
   
   export const logger = pino({
     level: process.env.LOG_LEVEL || 'info',
     transport: process.env.NODE_ENV === 'development' 
       ? { target: 'pino-pretty', options: { colorize: true } }
       : undefined
   });

3. Integrate with Fastify (src/server.ts):
   import fastifyPino from 'fastify-pino';
   import { logger } from './logger';
   
   // After creating fastify instance:
   await fastify.register(fastifyPino, {
     logger,
     serializers: {
       req: (request) => ({
         method: request.method,
         url: request.url,
         id: request.id
       }),
       res: (reply) => ({
         statusCode: reply.statusCode
       })
     }
   });

4. Error Handling:
   - Errors automatically logged with stack traces
   - Custom error handler can use req.log.error()

5. Benefits:
   - Automatic request/response logging
   - Request ID tracking (req.id)
   - Performance metrics (response time)
   - Structured JSON logs in production

CLEAR: TRUE`,
            clear: true,
          },
        }),
      review: vi.fn().mockResolvedValue({
        data: {
          ok: true,
          feedback:
            '✅ Approved - Implementation correctly adds pino logging with proper configuration',
        },
      }),
    }

    // Mock Claude Code execution
    const mockDiff = `diff --git a/package.json b/package.json
index 1234567..890abcd 100644
--- a/package.json
+++ b/package.json
@@ -10,6 +10,9 @@
   "dependencies": {
     "fastify": "^4.0.0",
+    "pino": "^8.0.0",
+    "pino-pretty": "^10.0.0",
+    "fastify-pino": "^3.0.0"
   }
 }
diff --git a/src/logger.ts b/src/logger.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/logger.ts
@@ -0,0 +1,10 @@
+import pino from 'pino';
+
+export const logger = pino({
+  level: process.env.LOG_LEVEL || 'info',
+  transport: process.env.NODE_ENV === 'development' 
+    ? { target: 'pino-pretty', options: { colorize: true } }
+    : undefined
+});
diff --git a/src/server.ts b/src/server.ts
index 1234567..890abcd 100644
--- a/src/server.ts
+++ b/src/server.ts
@@ -1,5 +1,7 @@
 import Fastify from 'fastify';
+import fastifyPino from 'fastify-pino';
+import { logger } from './logger';
 
 const fastify = Fastify();
 
+await fastify.register(fastifyPino, {
+  logger,
+  serializers: {
+    req: (request) => ({
+      method: request.method,
+      url: request.url,
+      id: request.id
+    }),
+    res: (reply) => ({
+      statusCode: reply.statusCode
+    })
+  }
+});`

    // Build graph with mocked dependencies
    const graph = buildGraph({
      enableTests: true,
      testCommand: 'echo "All tests passed"',
    })

    const app = graph.compile({ checkpointer })

    const initialState: FlowState = {
      task: 'Add pino logging to all Fastify routes',
      spec: '',
      repoPath: '/tmp/test-repo',
      iterationCount: 0,
      timestamp: Date.now(),
    }

    // Patch Http client to use our mock
    const jsUtils = await import('@goatlab/js-utils')
    vi.mocked(jsUtils.Http.getClient).mockImplementation(
      () =>
        ({
          post: vi.fn((endpoint: string) => ({
            json: vi.fn(async () => {
              if (endpoint === 'plan') {
                return (await mockServer.plan({})).data
              }
              if (endpoint === 'refine') {
                return (await mockServer.refine({})).data
              }
              if (endpoint === 'review') {
                return (await mockServer.review({})).data
              }
              throw new Error(`Unexpected endpoint: ${endpoint}`)
            }),
          })),
        }) as any,
    )

    // Mock spawn for Claude
    const childProcess = await import('node:child_process')
    const spawnMock = vi.mocked(childProcess.spawn)
    spawnMock.mockReturnValue({
      stdout: {
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            cb(Buffer.from(mockDiff))
          }
        }),
      },
      stderr: { on: vi.fn() },
      on: vi.fn((event, cb) => {
        if (event === 'close') {
          cb(0)
        }
      }),
      kill: vi.fn(),
    } as any)

    // Run the pipeline
    const threadId = `e2e-test-${Date.now()}`
    const result = await app.invoke(initialState, {
      configurable: { thread_id: threadId },
    })

    // Assertions
    expect(result.approved).toBe(true)
    expect(result.codeDiff).toContain('import pino')
    expect(result.codeDiff).toContain('fastify-pino')
    expect(result.testResults).toMatch(/exit code: 0/i)
    expect(mockServer.refine).toHaveBeenCalledTimes(2) // Should refine twice before clear=true
  })
})
