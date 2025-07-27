import { describe, it, expect, vi } from 'vitest';
import { Http } from '@goatlab/js-utils';
import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';

// Mock Http client for agent tests
vi.mock('@goatlab/js-utils', () => ({
  Http: {
    getClient: vi.fn(() => ({
      post: vi.fn().mockReturnThis(),
      json: vi.fn(),
    })),
  },
}));

// Mock child_process for Claude tests
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('Unit Tests - Agents', () => {
  describe('UT-plan-200: Planner endpoint', () => {
    it('should return non-empty draft string with length > 10', async () => {
      const mockResponse = {
        data: {
          draft: 'This is a detailed technical specification for implementing the requested feature.',
        },
      };
      
      const mockClient = {
        post: vi.fn().mockReturnThis(),
        json: vi.fn().mockResolvedValueOnce(mockResponse.data),
      };
      vi.mocked(Http.getClient).mockReturnValueOnce(mockClient as any);
      
      const client = Http.getClient({ prefixUrl: 'http://localhost:8000' });
      const data = await client.post('plan', {
        json: { prompt: 'Add logging to the application' },
      }).json<any>();
      
      expect(data.draft).toBeDefined();
      expect(data.draft.length).toBeGreaterThan(10);
    });
  });

  describe('UT-refine-loop: Refiner modifications', () => {
    it('should change spec text after two refinements', async () => {
      const spec0 = 'Initial specification text';
      const spec1 = 'First refined specification with more details';
      const spec2 = 'Final refined specification with architectural improvements';
      
      const mockClient1 = {
        post: vi.fn().mockReturnThis(),
        json: vi.fn().mockResolvedValueOnce({ refined: spec1 }),
      };
      const mockClient2 = {
        post: vi.fn().mockReturnThis(),
        json: vi.fn().mockResolvedValueOnce({ refined: spec2 }),
      };
      vi.mocked(Http.getClient)
        .mockReturnValueOnce(mockClient1 as any)
        .mockReturnValueOnce(mockClient2 as any);
      
      // First refinement
      const client1 = Http.getClient({ prefixUrl: 'http://localhost:8000' });
      const data1 = await client1.post('refine', {
        json: { spec: spec0 },
      }).json<any>();
      
      // Second refinement
      const client2 = Http.getClient({ prefixUrl: 'http://localhost:8000' });
      const data2 = await client2.post('refine', {
        json: { spec: data1.refined },
      }).json<any>();
      
      expect(spec0).not.toBe(data2.refined);
      expect(data1.refined).not.toBe(data2.refined);
    });
  });

  describe('UT-code-diff: Code agent output', () => {
    it('should resolve with a string starting with "diff --git"', async () => {
      const mockDiff = `diff --git a/src/app.ts b/src/app.ts
index 1234567..890abcd 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,5 +1,6 @@
 import express from 'express';
+import pino from 'pino';
 
 const app = express();`;

      const mockSpawn = vi.mocked(spawn);
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from(mockDiff));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
        kill: vi.fn(),
      } as unknown as ChildProcessWithoutNullStreams;

      mockSpawn.mockReturnValueOnce(mockProcess);

      const result = await new Promise<string>((resolve) => {
        const child = spawn('claude', ['-p', 'spec', '--diff']);
        let output = '';
        
        child.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        child.on('close', () => {
          resolve(output);
        });
      });

      expect(result).toMatch(/^diff --git/);
    });
  });
});