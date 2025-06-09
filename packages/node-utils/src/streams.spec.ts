// npx jest -i ./src/streams.spec.ts

import { Streams } from './Streams'
import { createGunzip } from 'zlib'
import { readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { Reviver } from '@goatlab/js-utils'

describe('Streams.map (async tests)', () => {
  it('should double numbers using map in pipeline', async () => {
    const input = [1, 2, 3]
    const output: number[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.map(async (n: number) => n * 2),
      Streams.map(async (n: number) => output.push(n)),
      Streams.closePipeline()
    ])

    expect(output).toEqual([2, 4, 6])
  })

  it('should handle empty input array', async () => {
    const input: number[] = []
    const output: number[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.map(async (n: number) => n * 2),
      Streams.map(async (n: number) => output.push(n)),
      Streams.closePipeline()
    ])

    expect(output).toEqual([])
  })

  it('should propagate error from mapper', async () => {
    const input = [1, 2, 3]
    const output: number[] = []
    const error = new Error('fail')

    await expect(() =>
      Streams.pipeline([
        Streams.readableFrom(input),
        Streams.map(async (n: number) => {
          if (n === 2) throw error
          return n * 2
        }),
        Streams.map(async (n: number) => output.push(n)),
        Streams.closePipeline()
      ])
    ).rejects.toThrow('fail')

    expect(output).toEqual([2])
  })

  it('should respect concurrency in map', async () => {
    const input = [1, 2, 3, 4]
    const seen: number[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.map(
        async (n: number) => {
          seen.push(n)
          await new Promise(r => setTimeout(r, 10))
          return n
        },
        { concurrency: 2 }
      ),
      Streams.closePipeline()
    ])

    expect(seen.sort()).toEqual([1, 2, 3, 4])
  })
})

describe('Streams.mapSync (sync tests)', () => {
  it('should double numbers using mapSync in pipeline', async () => {
    const input = [1, 2, 3]
    const output: number[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.mapSync((n: number) => n * 2),
      Streams.mapSync((n: number) => {
        output.push(n)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output).toEqual([2, 4, 6])
  })

  it('should filter values using predicate', async () => {
    const input = [1, 2, 3, 4]
    const output: number[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.mapSync((n: number) => n, {
        predicate: n => n % 2 === 0
      }),
      Streams.mapSync((n: number) => {
        output.push(n)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output).toEqual([2, 4])
  })
})

describe('Streams.buffer', () => {
  it('should batch values with default config', async () => {
    const input = [1, 2, 3, 4, 5]
    const output: number[][] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.buffer({ batchSize: 2 }),
      Streams.mapSync((batch: number[]) => {
        output.push(batch)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output).toEqual([[1, 2], [3, 4], [5]])
  })

  it('should emit single batch if all fit', async () => {
    const input = [10, 20]
    const output: number[][] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.buffer({ batchSize: 10 }),
      Streams.mapSync((batch: number[]) => {
        output.push(batch)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output).toEqual([[10, 20]])
  })

  it('should emit nothing for empty input', async () => {
    const input: number[] = []
    const output: number[][] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.buffer({ batchSize: 3 }),
      Streams.mapSync((batch: number[]) => {
        output.push(batch)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output).toEqual([])
  })
})

describe('Streams.filter', () => {
  it('should filter even numbers asynchronously', async () => {
    const input = [1, 2, 3, 4, 5]
    const output: number[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.filter(async (n: number) => n % 2 === 0),
      Streams.map(async (n: number) => {
        await output.push(n)
      }),
      Streams.closePipeline()
    ])

    expect(output).toEqual([2, 4])
  })

  it('should handle empty input', async () => {
    const input: number[] = []
    const output: number[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.filter(async () => true),
      Streams.mapSync((n: number) => {
        output.push(n)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output).toEqual([])
  })

  it('should reject on error in predicate', async () => {
    const input = [1, 2, 3]
    const err = new Error('fail')

    await expect(() =>
      Streams.pipeline([
        Streams.readableFrom(input),
        Streams.filter(async (n: number) => {
          if (n === 2) throw err
          return true
        }),
        Streams.closePipeline()
      ])
    ).rejects.toThrow('fail')
  })
})

describe('Streams.gzip', () => {
  it('should produce gzip-compressed Buffer', async () => {
    const input = ['hello', 'world']
    const chunks: Buffer[] = []

    await Streams.pipeline([
      Streams.readableFrom(input.map(s => s + '\n')),
      Streams.gzip(),
      Streams.mapSync((chunk: Buffer) => {
        chunks.push(chunk)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(chunks.length).toBeGreaterThan(0)
    expect(Buffer.concat(chunks)).toBeInstanceOf(Buffer)
  })

  it('should compress and decompress JSON objects', async () => {
    const input = [{ id: 1 }, { id: 2 }]
    const output: string[] = []

    const jsonLines = input.map(obj => JSON.stringify(obj) + '\n')

    await Streams.pipeline([
      Streams.readableFrom(jsonLines),
      Streams.gzip(),
      createGunzip(),
      Streams.mapSync((buf: Buffer) => {
        buf
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach(str => output.push(str))
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output.map(str => JSON.parse(str))).toEqual(input)
  })

  it('should handle empty input', async () => {
    const input: string[] = []
    const chunks: Buffer[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.gzip(),
      Streams.mapSync((chunk: Buffer) => {
        chunks.push(chunk)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(Buffer.concat(chunks).length).toBeGreaterThan(0)
  })

  it('should preserve line breaks in decompressed data', async () => {
    const input = ['line 1\nline 2\n', 'line 3\n']
    const output: string[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.gzip(),
      createGunzip(),
      Streams.mapSync((buf: Buffer) => {
        output.push(buf.toString())
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output.join('')).toEqual(input.join(''))
  })

  it('should gzip with reduced size and valid header', async () => {
    const input = Array(100).fill('repetitive content\n')
    const raw = Buffer.from(input.join(''))

    const compressedChunks: Buffer[] = []

    await Streams.pipeline([
      Streams.readableFrom([raw]),
      Streams.gzip(),
      Streams.mapSync((chunk: Buffer) => {
        compressedChunks.push(chunk)
        return undefined
      }),
      Streams.closePipeline()
    ])

    const gzipped = Buffer.concat(compressedChunks)

    // Magic number check
    expect(gzipped[0]).toBe(0x1f)
    expect(gzipped[1]).toBe(0x8b)

    // Compression effectiveness
    expect(gzipped.length).toBeLessThan(raw.length)
  })
})

describe('Streams.unGzip', () => {
  it('should decompress a gzip-compressed buffer stream', async () => {
    const input = ['foo', 'bar', 'baz']
    const output: string[] = []

    // First compress the input
    const compressed: Buffer[] = []
    await Streams.pipeline([
      Streams.readableFrom(input.map(s => s + '\n')),
      Streams.gzip(),
      Streams.mapSync((chunk: Buffer) => {
        compressed.push(chunk)
        return undefined
      }),
      Streams.closePipeline()
    ])

    // Then decompress it
    await Streams.pipeline([
      Streams.readableFrom([Buffer.concat(compressed)]),
      Streams.unGzip(),
      Streams.mapSync((buf: Buffer) => {
        buf
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach(line => output.push(line))
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output).toEqual(input)
  })

  it('should handle empty compressed input', async () => {
    const output: Buffer[] = []

    const compressed: Buffer[] = []
    await Streams.pipeline([
      Streams.readableFrom([]),
      Streams.gzip(),
      Streams.mapSync(chunk => {
        compressed.push(chunk)
        return undefined
      }),
      Streams.closePipeline()
    ])

    await Streams.pipeline([
      Streams.readableFrom([Buffer.concat(compressed)]),
      Streams.unGzip(),
      Streams.mapSync((chunk: Buffer) => {
        output.push(chunk)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(Buffer.concat(output).toString()).toBe('')
  })
})

describe('Streams.logProgress', () => {
  it('should log progress at defined intervals', async () => {
    const input = Array.from({ length: 10 }, (_, i) => i + 1)
    const output: number[] = []
    const logs: any[] = []

    const mockLogger = {
      log: (msg: any) => logs.push(msg),
      warn: (msg: any) => logs.push(msg),
      error: (msg: any) => logs.push(msg)
    }

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.logProgress({
        logEvery: 5,
        logger: mockLogger,
        logRPS: false
      }),
      Streams.mapSync((n: number) => {
        output.push(n)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output).toEqual(input)
    const logMessages = logs.filter(
      log =>
        typeof log === 'string' &&
        (log.includes('progress') || log.includes('progress_final'))
    )
    expect(logMessages.length).toBeGreaterThanOrEqual(2)
  })

  it('should not log when logProgress is false', async () => {
    const input = [1, 2, 3]
    const logs: any[] = []

    const mockLogger = {
      log: (msg: any) => logs.push(msg),
      warn: (msg: any) => logs.push(msg),
      error: (msg: any) => logs.push(msg)
    }

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.logProgress({
        logEvery: 1,
        logProgress: false,
        logger: mockLogger
      }),
      Streams.closePipeline()
    ])

    expect(logs.length).toBe(0)
  })
})

describe('Streams.toWriteStream', () => {
  it('should write streamed data to a file', async () => {
    const input = ['line1\n', 'line2\n', 'line3\n']
    const tmpPath = join(tmpdir(), `test-output-${Date.now()}.txt`)

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.toWriteStream(tmpPath)
    ])

    const contents = await readFile(tmpPath, 'utf8')
    expect(contents).toBe(input.join(''))

    await unlink(tmpPath)
  })
})

describe('Streams.toNDJson', () => {
  it('should convert objects to NDJSON format', async () => {
    const input = [{ x: 1 }, { y: 2 }]
    const output: string[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.toNDJson(),
      Streams.mapSync(chunk => {
        output.push(chunk.toString())
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output.join('')).toBe('{"x":1}\n{"y":2}\n')
  })

  it('should use custom separator', async () => {
    const input = [{ a: 1 }, { b: 2 }]
    const output: string[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.toNDJson({ separator: '|' }),
      Streams.mapSync(chunk => {
        output.push(chunk.toString())
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output.join('')).toBe('{"a":1}|{"b":2}|')
  })

  it('should skip invalid JSON if strict is false', async () => {
    const input = [
      {
        toJSON: () => {
          throw new Error('bad')
        }
      },
      { c: 3 }
    ]
    const output: string[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.toNDJson({ strict: false }),
      Streams.mapSync(chunk => {
        output.push(chunk.toString())
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output.join('')).toBe('{"c":3}\n')
  })

  it('should throw on invalid JSON if strict is true', async () => {
    const input = [
      {
        toJSON: () => {
          throw new Error('bad')
        }
      },
      { d: 4 }
    ]

    await expect(() =>
      Streams.pipeline([
        Streams.readableFrom(input),
        Streams.toNDJson({ strict: true }),
        Streams.closePipeline()
      ])
    ).rejects.toThrow()
  })
})

describe('Streams.parseJson', () => {
  it('should parse NDJSON strings into objects', async () => {
    const input = ['{"x":1}\n', '{"y":2}\n']
    const output: any[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.parseJson(),
      Streams.mapSync(obj => {
        output.push(obj)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output).toEqual([{ x: 1 }, { y: 2 }])
  })

  it('should use custom reviver', async () => {
    const input = ['{"a":"1"}\n']
    const output: any[] = []

    const reviver: Reviver = (key, value) => {
      if (key === 'a') return parseInt(value)
      return value
    }

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.parseJson({ reviver }),
      Streams.mapSync(obj => {
        output.push(obj)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output).toEqual([{ a: 1 }])
  })

  it('should skip invalid JSON if strict is false', async () => {
    const input = ['{ invalid json }\n', '{"valid":true}\n']
    const output: any[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.parseJson({ strict: false }),
      Streams.mapSync(obj => {
        output.push(obj)
        return undefined
      }),
      Streams.closePipeline()
    ])

    expect(output).toEqual([{ valid: true }])
  })

  it('should throw on invalid JSON if strict is true', async () => {
    const input = ['{ invalid json }\n']

    await expect(() =>
      Streams.pipeline([
        Streams.readableFrom(input),
        Streams.parseJson({ strict: true }),
        Streams.closePipeline()
      ])
    ).rejects.toThrow()
  })
})

describe('Streams.closePipeline', () => {
  it('should consume the stream without modifying the data', async () => {
    const input = [1, 2, 3]
    const processed: number[] = []

    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.mapSync(n => {
        processed.push(n)
        return n
      }),
      Streams.closePipeline()
    ])

    expect(processed).toEqual(input)
  })
})
