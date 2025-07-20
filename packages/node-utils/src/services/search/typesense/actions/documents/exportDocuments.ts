import { Readable } from 'stream'
import type { 
  TypesenseDocument, 
  TypesenseExportFormat,
  TypesenseExportOptions,
  TypesenseCollectionOptions 
} from '../../typesense.model'
import { TypesenseError } from '../../typesense.model'
import { ExportFormatter } from '../../components/export-formatter'
import type { TypesenseContext } from '../../types'

export async function exportDocuments<T extends Record<string, any>>(
  ctx: TypesenseContext,
  format: TypesenseExportFormat = 'jsonl',
  options?: TypesenseExportOptions & TypesenseCollectionOptions
): Promise<string | TypesenseDocument<T>[]> {
  // Validate format
  const supportedFormats: TypesenseExportFormat[] = ['jsonl', 'json', 'csv']
  if (!supportedFormats.includes(format)) {
    throw new TypesenseError(`Unsupported export format: ${format}`, 400)
  }

  const collectionName = options?.collection || ctx.collectionName
  const { collection, ...exportOptions } = options || {}
  const searchParams: any = {
    ...exportOptions
    // Note: Typesense export always returns JSONL regardless of format param
  }

  // Get response as text (JSONL format)
  const response = await ctx.httpClient.requestText(
    `/collections/${collectionName}/documents/export`,
    { searchParams }
  )

  if (format === 'json') {
    // Parse JSONL to JSON array
    return response
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
  } else if (format === 'csv') {
    // For small datasets, convert JSONL to CSV
    const documents = response
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))

    return ExportFormatter.formatCSV(documents)
  }

  return response
}

export async function exportDocumentsStream<T extends Record<string, any>>(
  ctx: TypesenseContext,
  options?: TypesenseExportOptions & TypesenseCollectionOptions
): Promise<Readable> {
  const collectionName = options?.collection || ctx.collectionName
  const { collection, ...exportOptions } = options || {}
  const searchParams: any = {
    ...exportOptions
  }

  return ctx.httpClient
    .stream(`/collections/${collectionName}/documents/export`, {
      searchParams
    })
    .then(stream => Readable.fromWeb(stream))
}