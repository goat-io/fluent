// npx vitest run ./src/services/search/typesense/tests/export-formatter.test.ts

import { describe, it, expect } from 'vitest'
import { ExportFormatter } from '../components/export-formatter'
import { Readable } from 'stream'

describe('ExportFormatter', () => {
  const sampleDocuments = [
    { id: '1', title: 'Document 1', content: 'Content 1', tags: ['tag1', 'tag2'], views: 100, published: true },
    { id: '2', title: 'Document 2', content: 'Content with "quotes" and, commas', tags: ['tag3'], views: 200, published: false },
    { id: '3', title: 'Document 3', content: 'Content with\nnewlines', tags: [], views: 0, published: true }
  ]

  describe('CSV Formatting', () => {
    it('should format documents as CSV', () => {
      const csv = ExportFormatter.formatCSV(sampleDocuments)
      
      expect(csv).toContain('content,id,published,tags,title,views')
      expect(csv).toContain('Document 1')
      expect(csv).toContain('"Content with ""quotes"" and, commas"')
      expect(csv).toContain('"Content with\nnewlines"')
    })

    it('should handle empty documents array', () => {
      const csv = ExportFormatter.formatCSV([])
      expect(csv).toBe('')
    })

    it('should escape CSV values correctly', () => {
      const docs = [
        { id: '1', text: 'Simple text' },
        { id: '2', text: 'Text with, comma' },
        { id: '3', text: 'Text with "quotes"' },
        { id: '4', text: 'Text with\nnewline' },
        { id: '5', array: ['item1', 'item2'] },
        { id: '6', object: { nested: 'value' } }
      ]
      
      const csv = ExportFormatter.formatCSV(docs)
      
      expect(csv).toContain('Simple text')
      expect(csv).toContain('"Text with, comma"')
      expect(csv).toContain('"Text with ""quotes"""')
      expect(csv).toContain('"Text with\nnewline"')
      expect(csv).toContain('item1;item2')
      expect(csv).toContain('"{""nested"":""value""}"')
    })
  })

  describe('Format Documents', () => {
    it('should format as JSON', () => {
      const result = ExportFormatter.formatDocuments(sampleDocuments, 'json')
      expect(result).toEqual(sampleDocuments)
    })

    it('should format as JSONL', () => {
      const result = ExportFormatter.formatDocuments(sampleDocuments, 'jsonl')
      expect(typeof result).toBe('string')
      const lines = (result as string).split('\n')
      expect(lines).toHaveLength(3)
      expect(JSON.parse(lines[0])).toEqual(sampleDocuments[0])
    })

    it('should format as CSV', () => {
      const result = ExportFormatter.formatDocuments(sampleDocuments, 'csv')
      expect(typeof result).toBe('string')
      expect(result as string).toContain('content,id,published,tags,title,views')
    })

    it('should throw error for unsupported format', () => {
      expect(() => {
        ExportFormatter.formatDocuments(sampleDocuments, 'xml' as any)
      }).toThrow('Unsupported export format: xml')
    })
  })

  describe('Streaming Transforms', () => {
    it('should create streaming CSV transform', async () => {
      const transform = ExportFormatter.createStreamingCSVTransform()
      const results: string[] = []
      
      transform.on('data', (chunk) => {
        results.push(chunk.toString())
      })
      
      // Write documents
      transform.write(sampleDocuments[0])
      transform.write(sampleDocuments[1])
      transform.end()
      
      await new Promise(resolve => transform.on('end', resolve))
      
      const output = results.join('')
      expect(output).toContain('content,id,published,tags,title,views')
      expect(output).toContain('Document 1')
      expect(output).toContain('Document 2')
    })

    it('should create streaming JSONL transform', async () => {
      const transform = ExportFormatter.createStreamingJSONLTransform()
      const results: string[] = []
      
      transform.on('data', (chunk) => {
        results.push(chunk.toString())
      })
      
      transform.write(sampleDocuments[0])
      transform.write(sampleDocuments[1])
      transform.end()
      
      await new Promise(resolve => transform.on('end', resolve))
      
      const output = results.join('')
      const lines = output.trim().split('\n')
      expect(lines).toHaveLength(2)
      expect(JSON.parse(lines[0])).toEqual(sampleDocuments[0])
      expect(JSON.parse(lines[1])).toEqual(sampleDocuments[1])
    })
  })

  describe('Document Parsing', () => {
    it('should parse JSONL format', async () => {
      const jsonlData = sampleDocuments.map(doc => JSON.stringify(doc)).join('\n')
      const parser = ExportFormatter.createDocumentParser('jsonl')
      const results: any[] = []
      
      parser.on('data', (doc) => {
        results.push(doc)
      })
      
      parser.write(Buffer.from(jsonlData))
      parser.end()
      
      await new Promise(resolve => parser.on('end', resolve))
      
      expect(results).toHaveLength(3)
      expect(results[0]).toEqual(sampleDocuments[0])
    })

    it('should parse JSON format', async () => {
      const jsonData = JSON.stringify(sampleDocuments)
      const parser = ExportFormatter.createDocumentParser('json')
      const results: any[] = []
      
      parser.on('data', (doc) => {
        results.push(doc)
      })
      
      parser.write(Buffer.from(jsonData))
      parser.end()
      
      await new Promise(resolve => parser.on('end', resolve))
      
      expect(results).toHaveLength(3)
      expect(results[0]).toEqual(sampleDocuments[0])
    })

    it('should handle partial JSONL chunks', async () => {
      const parser = ExportFormatter.createDocumentParser('jsonl')
      const results: any[] = []
      
      parser.on('data', (doc) => {
        results.push(doc)
      })
      
      // Write partial chunks
      const line1 = JSON.stringify(sampleDocuments[0])
      const line2 = JSON.stringify(sampleDocuments[1])
      
      parser.write(Buffer.from(line1.slice(0, 10)))
      parser.write(Buffer.from(line1.slice(10) + '\n' + line2.slice(0, 15)))
      parser.write(Buffer.from(line2.slice(15)))
      parser.end()
      
      await new Promise(resolve => parser.on('end', resolve))
      
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual(sampleDocuments[0])
      expect(results[1]).toEqual(sampleDocuments[1])
    })

    it('should throw error for unsupported parser format', () => {
      expect(() => {
        ExportFormatter.createDocumentParser('csv' as any)
      }).toThrow('Parsing not supported for format: csv')
    })
  })

  describe('Stream Utilities', () => {
    it('should convert stream to string', async () => {
      const data = 'Hello World'
      const stream = Readable.from([Buffer.from(data)])
      
      const result = await ExportFormatter.streamToString(stream)
      expect(result).toBe(data)
    })

    it('should create document stream', async () => {
      const stream = ExportFormatter.createDocumentStream(sampleDocuments)
      const results: any[] = []
      
      for await (const doc of ExportFormatter.streamToAsyncIterator(stream)) {
        results.push(doc)
      }
      
      expect(results).toEqual(sampleDocuments)
    })

    it('should handle empty document stream', async () => {
      const stream = ExportFormatter.createDocumentStream([])
      const results: any[] = []
      
      for await (const doc of ExportFormatter.streamToAsyncIterator(stream)) {
        results.push(doc)
      }
      
      expect(results).toEqual([])
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid JSON in JSONL parser', async () => {
      const parser = ExportFormatter.createDocumentParser('jsonl')
      let error: Error | null = null
      
      parser.on('error', (err) => {
        error = err
      })
      
      parser.write(Buffer.from('invalid json\n'))
      parser.end()
      
      await new Promise(resolve => {
        parser.on('error', resolve)
        parser.on('end', resolve)
      })
      
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toContain('Invalid JSON')
    })

    it('should handle invalid JSON in JSON parser', async () => {
      const parser = ExportFormatter.createDocumentParser('json')
      let error: Error | null = null
      
      parser.on('error', (err) => {
        error = err
      })
      
      parser.write(Buffer.from('invalid json'))
      parser.end()
      
      await new Promise(resolve => {
        parser.on('error', resolve)
        parser.on('end', resolve)
      })
      
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toContain('Invalid JSON')
    })
  })
})