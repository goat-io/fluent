# @goatlab/node-xlsx

Efficiently stream and process Excel (.xlsx) files in Node.js with TypeScript support. Built on top of xlstream for memory-efficient processing of large Excel files.

## Installation

```bash
npm install @goatlab/node-xlsx
# or
yarn add @goatlab/node-xlsx
# or
pnpm add @goatlab/node-xlsx
```

## Basic Usage

```typescript
import { xlsxStream } from '@goatlab/node-xlsx'

// Process rows individually
await xlsxStream.stream({
  file: {
    filePath: './data.xlsx',
    sheet: 0,
    withHeader: true
  },
  rowMapper: (row) => ({
    name: row.Name,
    email: row.Email,
    age: Number(row.Age)
  }),
  fx: async (mappedRow) => {
    // Process each row
    console.log(mappedRow)
  },
  mapOptions: {
    concurrency: 4
  }
})

// Process rows in batches
await xlsxStream.batchStream({
  file: {
    filePath: './data.xlsx',
    sheet: 0,
    withHeader: true
  },
  batchSize: 100,
  rowMapper: (row) => ({
    name: row.Name,
    email: row.Email
  }),
  fx: async (batch) => {
    // Process batch of rows
    await saveToDatabase(batch)
  },
  mapOptions: {
    concurrency: 2
  }
})
```

## Key Features

- **Memory-efficient streaming** - Process large Excel files without loading them entirely into memory
- **TypeScript support** - Full type safety with generic column typing
- **Flexible row mapping** - Transform rows with custom mapper functions
- **Batch processing** - Process rows individually or in configurable batches
- **Concurrent processing** - Control concurrency for optimal performance
- **Row filtering** - Skip rows by returning `null` from the mapper function
- **Sheet selection** - Choose which sheet to process by index
- **Header support** - Automatically use first row as column headers