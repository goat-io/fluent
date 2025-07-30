// ExportFormatter - Handles CSV/gzip helpers with streaming support
import { Readable, Transform } from 'node:stream'
import { createGzip } from 'node:zlib'
import { TypesenseDocument, TypesenseExportFormat } from '../typesense.model'

export class ExportFormatter {
  static formatDocuments<T>(
    documents: TypesenseDocument<T>[],
    format: TypesenseExportFormat
  ): string | TypesenseDocument<T>[] {
    switch (format) {
      case 'json':
        return documents
      case 'jsonl':
        return documents.map(doc => JSON.stringify(doc)).join('\n')
      case 'csv':
        return ExportFormatter.formatCSV(documents)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  static formatCSV<T>(documents: TypesenseDocument<T>[]): string {
    if (documents.length === 0) {
      return ''
    }

    // Get all unique keys from all documents
    const allKeys = new Set<string>()
    documents.forEach(doc => {
      Object.keys(doc).forEach(key => allKeys.add(key))
    })

    const headers = Array.from(allKeys).sort()
    const csvLines: string[] = [headers.join(',')]

    for (const doc of documents) {
      const row = headers.map(header => {
        const value = (doc as any)[header]
        return ExportFormatter.escapeCsvValue(value)
      })
      csvLines.push(row.join(','))
    }

    return csvLines.join('\n')
  }

  static createStreamingCSVTransform<T>(): Transform {
    let isFirstRow = true
    let headers: string[] = []

    return new Transform({
      objectMode: true,
      transform(chunk: TypesenseDocument<T>, _encoding, callback) {
        try {
          if (isFirstRow) {
            // Extract headers from first document
            headers = Object.keys(chunk).sort()
            this.push(`${headers.join(',')}\n`)
            isFirstRow = false
          }

          // Convert document to CSV row
          const row = headers.map(header => {
            const value = (chunk as any)[header]
            return ExportFormatter.escapeCsvValue(value)
          })

          this.push(`${row.join(',')}\n`)
          callback()
        } catch (error) {
          callback(error)
        }
      }
    })
  }

  static createStreamingJSONLTransform<T>(): Transform {
    return new Transform({
      objectMode: true,
      transform(chunk: TypesenseDocument<T>, _encoding, callback) {
        try {
          this.push(`${JSON.stringify(chunk)}\n`)
          callback()
        } catch (error) {
          callback(error)
        }
      }
    })
  }

  static createGzipStream(): Transform {
    return createGzip()
  }

  static createDocumentParser(format: TypesenseExportFormat): Transform {
    switch (format) {
      case 'jsonl':
        return ExportFormatter.createJSONLParser()
      case 'json':
        return ExportFormatter.createJSONParser()
      default:
        throw new Error(`Parsing not supported for format: ${format}`)
    }
  }

  private static createJSONLParser(): Transform {
    let buffer = ''

    return new Transform({
      objectMode: true,
      transform(chunk: Buffer, _encoding, callback) {
        buffer += chunk.toString()
        const lines = buffer.split('\n')

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              const document = JSON.parse(line)
              this.push(document)
            } catch (_error) {
              return callback(new Error(`Invalid JSON in line: ${line}`))
            }
          }
        }

        callback()
      },

      flush(callback) {
        if (buffer.trim()) {
          try {
            const document = JSON.parse(buffer)
            this.push(document)
          } catch (_error) {
            return callback(new Error(`Invalid JSON in final line: ${buffer}`))
          }
        }
        callback()
      }
    })
  }

  private static createJSONParser(): Transform {
    let buffer = ''

    return new Transform({
      objectMode: true,
      transform(chunk: Buffer, _encoding, callback) {
        buffer += chunk.toString()
        callback()
      },

      flush(callback) {
        try {
          const documents = JSON.parse(buffer)
          if (Array.isArray(documents)) {
            documents.forEach(doc => this.push(doc))
          } else {
            this.push(documents)
          }
        } catch (error) {
          return callback(new Error(`Invalid JSON: ${error.message}`))
        }
        callback()
      }
    })
  }

  private static escapeCsvValue(value: any): string {
    if (value === null || value === undefined) {
      return ''
    }

    let stringValue = String(value)

    // Handle arrays by joining with semicolons
    if (Array.isArray(value)) {
      stringValue = value.map(item => String(item)).join(';')
    }

    // Handle objects by stringifying
    if (typeof value === 'object' && !Array.isArray(value)) {
      stringValue = JSON.stringify(value)
    }

    // Escape quotes and wrap in quotes if needed
    const needsQuoting =
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r')

    if (needsQuoting) {
      // Escape existing quotes by doubling them
      stringValue = stringValue.replace(/"/g, '""')
      return `"${stringValue}"`
    }

    return stringValue
  }

  static async streamToString(stream: Readable): Promise<string> {
    const chunks: Buffer[] = []

    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('error', reject)
      stream.on('end', () => {
        resolve(Buffer.concat(chunks).toString())
      })
    })
  }

  static async *streamToAsyncIterator<T>(stream: Readable): AsyncGenerator<T> {
    const reader = stream[Symbol.asyncIterator]?.() || stream

    if (typeof reader[Symbol.asyncIterator] === 'function') {
      for await (const chunk of reader) {
        yield chunk
      }
    } else {
      // Fallback for streams without async iterator support
      const chunks: T[] = []

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: T) => chunks.push(chunk))
        stream.on('error', reject)
        stream.on('end', resolve)
      })

      for (const chunk of chunks) {
        yield chunk
      }
    }
  }

  static createDocumentStream<T>(documents: TypesenseDocument<T>[]): Readable {
    let index = 0

    return new Readable({
      objectMode: true,
      read() {
        if (index < documents.length) {
          this.push(documents[index++])
        } else {
          this.push(null) // End stream
        }
      }
    })
  }
}
