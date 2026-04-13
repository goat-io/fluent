import { ExportFormatter } from '../../components/export-formatter'
import type { TypesenseContext } from '../../types'
import type {
  TypesenseCollectionOptions,
  TypesenseDocument,
  TypesenseImportFormat,
  TypesenseImportOptions,
  TypesenseImportResult,
} from '../../typesense.model'
import { TypesenseError } from '../../typesense.model'

export async function importDocuments<T extends Record<string, any>>(
  ctx: TypesenseContext,
  documents: TypesenseDocument<T>[] | string | ReadableStream,
  format: TypesenseImportFormat = 'jsonl',
  importOptions?: TypesenseImportOptions,
  collectionOptions?: TypesenseCollectionOptions,
): Promise<TypesenseImportResult[]> {
  // Validate format
  const supportedFormats: TypesenseImportFormat[] = ['jsonl', 'json', 'csv']
  if (!supportedFormats.includes(format)) {
    throw new TypesenseError('Unsupported format', 400)
  }

  const collectionName = collectionOptions?.collection || ctx.fqcn()
  let body: string | ReadableStream

  if (documents instanceof ReadableStream) {
    body = documents
  } else if (typeof documents === 'string') {
    if (format === 'csv') {
      throw new TypesenseError('CSV import requires conversion', 400)
    }
    if (format === 'json') {
      // Convert JSON array string to JSONL
      const parsedDocuments = JSON.parse(documents)
      const jsonlData = parsedDocuments
        .map((doc: any) => JSON.stringify(doc))
        .join('\n')
      body = jsonlData
    } else {
      // Assume it's already JSONL
      body = documents
    }
  } else {
    // Array of documents
    if (format === 'csv') {
      throw new TypesenseError('CSV import requires conversion', 400)
    }
    const formatted = ExportFormatter.formatDocuments(documents, format)
    body = formatted as string
  }

  const searchParams: any = {
    ...importOptions,
    action: importOptions?.action || 'create',
  }

  // Send body directly to HTTP for large files
  const response = await ctx.httpClient.requestTextWithRawBody(
    `/collections/${collectionName}/documents/import`,
    {
      method: 'POST',
      body,
      searchParams,
      timeout: ctx.httpClient.importTimeout,
    },
  )

  // Parse JSONL response to array
  return response
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line))
}
