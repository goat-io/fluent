import { Streams } from '@goatlab/node-utils'
import { getXlsxStream } from 'xlstream'

export type IXlsxStreamOptions = {
  filePath: string
  sheet: number
  withHeader: boolean
}

class XlsxStream {
  public async getReadableStream(file: IXlsxStreamOptions) {
    return await getXlsxStream(file)
  }
  /**
   * Streams and processes rows from an XLSX file asynchronously, applying a custom row mapping function and processing each mapped row with a provided async handler.
   *
   * @template Columns - The set of column names expected in each row.
   * @template RowMapper - The type of the row mapping function.
   *
   * @param params - The parameters for streaming and processing the XLSX file.
   * @param params.file - The XLSX stream options.
   * @param params.batchSize - The number of rows to process in each batch.
   * @param params.rowMapper - A function that maps each row (as a record of column values) and its index to a desired output.
   * @param params.fx - An asynchronous function to process each mapped row.
   * @param params.mapOptions - Options for mapping, including concurrency settings.
   * @param params.mapOptions.concurrency - The maximum number of concurrent mapping operations.
   *
   * @returns A promise that resolves when the streaming and processing pipeline has completed.
   *
   * @example
   * ```typescript
   * await stream({
   *   file: { path: 'data.xlsx' },
   *   batchSize: 100,
   *   rowMapper: (row, index) => ({ ... }),
   *   fx: async (mappedRow) => { ... },
   *   mapOptions: { concurrency: 5 }
   * });
   * ```
   */
  public async stream<
    Columns extends string,
    RowMapper extends (
      row: Record<Columns, string | null | undefined>,
      rowIndex: number,
    ) => any,
  >({
    file,
    rowMapper,
    fx,
    mapOptions,
  }: {
    file: IXlsxStreamOptions
    batchSize: number
    rowMapper: RowMapper
    fx: (mappedRows: ReturnType<RowMapper>) => Promise<void>
    mapOptions: {
      concurrency: number
    }
  }) {
    const readable = await this.getReadableStream(file)
    return await Streams.pipeline([
      Streams.readableFrom(readable),
      // This any is because is the output of the getXlsxStream library
      Streams.map<any, void>(async (row: any) => {
        const mappedRows = [row]
          .map((row, index) =>
            rowMapper(
              row.formatted.obj as Record<Columns, string | null | undefined>,
              index,
            ),
          )
          .filter(
            (model): model is NonNullable<ReturnType<RowMapper>> =>
              model !== null,
          )

        if (mappedRows.length > 0) {
          await fx(mappedRows[0])
        }
      }, mapOptions),
      Streams.closePipeline(),
    ])
  }

  /**
   * Processes an XLSX file in batches using a streaming pipeline.
   *
   * Reads rows from the provided XLSX file, maps each row using the given `rowMapper` function,
   * and processes batches of mapped rows with the provided asynchronous `fx` function.
   * Supports configurable batch size and concurrency for mapping operations.
   *
   * @template Columns - The set of string keys representing column names in the XLSX file.
   * @template RowMapper - The function type used to map each row.
   *
   * @param params - The parameters for batch processing.
   * @param params.file - Options for the XLSX stream source.
   * @param params.batchSize - The number of rows to process in each batch.
   * @param params.rowMapper - Function to map each row to a desired output.
   * @param params.fx - Asynchronous function to process each batch of mapped rows.
   * @param params.mapOptions - Options for mapping, including concurrency.
   * @param params.mapOptions.concurrency - The number of concurrent mapping operations.
   *
   * @returns A Promise that resolves when the entire XLSX file has been processed.
   *
   * @example
   * ```typescript
   * await batchStream({
   *   file: { path: 'data.xlsx' },
   *   batchSize: 100,
   *   rowMapper: (row) => ({ name: row.Name, age: Number(row.Age) }),
   *   fx: async (batch) => { await saveToDatabase(batch); },
   *   mapOptions: { concurrency: 4 }
   * });
   * ```
   */
  public async batchStream<
    Columns extends string,
    RowMapper extends (
      row: Record<Columns, string | null | undefined>,
      rowIndex: number,
    ) => any,
  >({
    file,
    batchSize,
    rowMapper,
    fx,
    mapOptions,
  }: {
    file: IXlsxStreamOptions
    batchSize: number
    rowMapper: RowMapper
    fx: (mappedRows: ReturnType<RowMapper>[]) => Promise<void>
    mapOptions: {
      concurrency: number
    }
  }) {
    const readable = await this.getReadableStream(file)

    return await Streams.pipeline([
      Streams.readableFrom(readable),
      Streams.buffer({
        batchSize,
      }),
      // This any is because is the output of the getXlsxStream library
      Streams.map<any[], void>(async (rows: any[]) => {
        const mappedRows = rows
          .map((row, index) =>
            rowMapper(
              row.formatted.obj as Record<Columns, string | null | undefined>,
              index,
            ),
          )
          .filter(
            (model): model is NonNullable<ReturnType<RowMapper>> =>
              model !== null,
          )

        if (mappedRows.length > 0) {
          await fx(mappedRows)
        }
      }, mapOptions),
      Streams.closePipeline(),
    ])
  }
}

export const xlsxStream = new XlsxStream()
