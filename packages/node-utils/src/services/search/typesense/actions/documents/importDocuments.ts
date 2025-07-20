import { Readable } from 'stream'
import type { 
  TypesenseDocument, 
  TypesenseImportResult, 
  TypesenseImportFormat,
  TypesenseImportOptions,
  TypesenseCollectionOptions 
} from '../../typesense.model'
import { TypesenseError } from '../../typesense.model'
import { ExportFormatter } from '../../components/export-formatter'
import type { TypesenseContext } from '../../types'

export async function importDocuments<T extends Record<string, any>>(
  ctx: TypesenseContext,
  documents: TypesenseDocument<T>[] | string | Readable,
  format: TypesenseImportFormat = 'jsonl',
  importOptions?: TypesenseImportOptions,
  collectionOptions?: TypesenseCollectionOptions
): Promise<TypesenseImportResult[]> {
  // Validate format
  const supportedFormats: TypesenseImportFormat[] = ['jsonl', 'json', 'csv']
  if (!supportedFormats.includes(format)) {
    throw new TypesenseError('Unsupported format', 400)
  }

  const collectionName = collectionOptions?.collection || ctx.collectionName
  let bodyStream: Readable

  if (documents instanceof Readable) {
    bodyStream = documents
  } else if (typeof documents === 'string') {
    if (format === 'csv') {
      throw new TypesenseError('CSV import requires conversion', 400)
    } else if (format === 'json') {
      // Convert JSON array string to JSONL
      const parsedDocuments = JSON.parse(documents)
      const jsonlData = parsedDocuments.map((doc: any) => JSON.stringify(doc)).join('\n')
      bodyStream = Readable.from([jsonlData])
    } else {
      // Assume it's already JSONL
      bodyStream = Readable.from([documents])
    }
  } else {
    // Array of documents
    if (format === 'csv') {
      throw new TypesenseError('CSV import requires conversion', 400)
    }
    const formatted = ExportFormatter.formatDocuments(documents, format)
    bodyStream = Readable.from([formatted as string])
  }

  const searchParams: any = {
    ...importOptions,
    action: importOptions?.action || 'create'
  }

  // Stream directly to HTTP body for large files
  const response = await ctx.httpClient.requestTextWithRawBody(
    `/collections/${collectionName}/documents/import`,
    {
      method: 'POST',
      body: bodyStream,
      searchParams,
      timeout: ctx.httpClient['options'].importTimeout
    }
  )

  // Parse JSONL response to array
  return response
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line))
}