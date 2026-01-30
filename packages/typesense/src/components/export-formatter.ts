// ExportFormatter - Handles CSV helpers with streaming support
import { TypesenseDocument, TypesenseExportFormat } from '../typesense.model'

export class ExportFormatter {
  static formatDocuments<T>(
    documents: TypesenseDocument<T>[],
    format: TypesenseExportFormat,
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

  static createStreamingCSVTransform<T>(): TransformStream<
    TypesenseDocument<T>,
    string
  > {
    let isFirstRow = true
    let headers: string[] = []

    return new TransformStream({
      transform(chunk, controller) {
        try {
          if (isFirstRow) {
            // Extract headers from first document
            headers = Object.keys(chunk).sort()
            controller.enqueue(`${headers.join(',')}\n`)
            isFirstRow = false
          }

          // Convert document to CSV row
          const row = headers.map(header => {
            const value = (chunk as any)[header]
            return ExportFormatter.escapeCsvValue(value)
          })

          controller.enqueue(`${row.join(',')}\n`)
        } catch (error: any) {
          controller.error(error)
        }
      },
    })
  }

  static createStreamingJSONLTransform<T>(): TransformStream<
    TypesenseDocument<T>,
    string
  > {
    return new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(`${JSON.stringify(chunk)}\n`)
      },
    })
  }

  static createGzipStream(): never {
    throw new Error(
      'createGzipStream is not available in browser environments. Use CompressionStream API or a server-side solution.',
    )
  }

  static createDocumentParser(
    format: TypesenseExportFormat,
  ): TransformStream<string, any> {
    switch (format) {
      case 'jsonl':
        return ExportFormatter.createJSONLParser()
      case 'json':
        return ExportFormatter.createJSONParser()
      default:
        throw new Error(`Parsing not supported for format: ${format}`)
    }
  }

  private static createJSONLParser(): TransformStream<string, any> {
    let buffer = ''

    return new TransformStream({
      transform(chunk, controller) {
        buffer += chunk
        const lines = buffer.split('\n')

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              controller.enqueue(JSON.parse(line))
            } catch (_error) {
              controller.error(new Error(`Invalid JSON in line: ${line}`))
              return
            }
          }
        }
      },

      flush(controller) {
        if (buffer.trim()) {
          try {
            controller.enqueue(JSON.parse(buffer))
          } catch (_error) {
            controller.error(new Error(`Invalid JSON in final line: ${buffer}`))
          }
        }
      },
    })
  }

  private static createJSONParser(): TransformStream<string, any> {
    let buffer = ''

    return new TransformStream({
      transform(chunk, _controller) {
        buffer += chunk
      },

      flush(controller) {
        try {
          const documents = JSON.parse(buffer)
          if (Array.isArray(documents)) {
            documents.forEach(doc => controller.enqueue(doc))
          } else {
            controller.enqueue(documents)
          }
        } catch (error: any) {
          controller.error(new Error(`Invalid JSON: ${error.message}`))
        }
      },
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

  static async streamToString(stream: ReadableStream): Promise<string> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let result = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      result +=
        typeof value === 'string'
          ? value
          : decoder.decode(value, { stream: true })
    }
    result += decoder.decode()
    return result
  }

  static async *streamToAsyncIterator<T>(
    stream: ReadableStream<T>,
  ): AsyncGenerator<T> {
    const reader = stream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        yield value
      }
    } finally {
      reader.releaseLock()
    }
  }

  static createDocumentStream<T>(
    documents: TypesenseDocument<T>[],
  ): ReadableStream<T> {
    let index = 0

    return new ReadableStream({
      pull(controller) {
        if (index < documents.length) {
          controller.enqueue(documents[index++] as T)
        } else {
          controller.close()
        }
      },
    })
  }
}
