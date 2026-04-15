// npx vitest run src/__tests__/unit/container-manager.spec.ts
import type { Readable } from 'node:stream'

/**
 * Collects a Docker exec stream into stdout/stderr strings.
 * Docker multiplexes stdout and stderr into a single stream with 8-byte headers.
 * Header format: [streamType(1), 0, 0, 0, size(4 bytes big-endian)]
 * streamType: 1 = stdout, 2 = stderr
 */
export function collectStream(
  stream: Readable,
  opts?: {
    onStdout?: (chunk: string) => void
    onStderr?: (chunk: string) => void
    maxSize?: number
  },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let totalSize = 0
    const maxSize = opts?.maxSize ?? 50 * 1024 * 1024 // 50MB limit

    stream.on('data', (chunk: Buffer) => {
      totalSize += chunk.length
      if (totalSize > maxSize) {
        stream.destroy()
        reject(new Error(`Output exceeded ${maxSize} bytes limit`))
        return
      }

      // Try demuxing Docker stream format
      let offset = 0
      while (offset < chunk.length) {
        if (offset + 8 > chunk.length) {
          // Not enough bytes for header, treat rest as stdout
          const text = chunk.subarray(offset).toString('utf-8')
          stdout += text
          opts?.onStdout?.(text)
          break
        }

        const streamType = chunk[offset]
        const size = chunk.readUInt32BE(offset + 4)

        if (size === 0 || offset + 8 + size > chunk.length) {
          // Invalid frame, treat rest as raw stdout
          const text = chunk.subarray(offset).toString('utf-8')
          stdout += text
          opts?.onStdout?.(text)
          break
        }

        const payload = chunk
          .subarray(offset + 8, offset + 8 + size)
          .toString('utf-8')

        if (streamType === 2) {
          stderr += payload
          opts?.onStderr?.(payload)
        } else {
          stdout += payload
          opts?.onStdout?.(payload)
        }

        offset += 8 + size
      }
    })

    stream.on('end', () => resolve({ stdout, stderr }))
    stream.on('error', reject)
  })
}
