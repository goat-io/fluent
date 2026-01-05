import LokiJS from 'lokijs'

// Create a new in-memory database for each test run
export const lokiDataSource = new (LokiJS as any)('test-db.json', {
  autosave: false,
  persistenceMethod: 'memory',
})
