import LokiJS from 'lokijs'
import { Loki, LokiStorageType } from '../Loki'

let db: LokiJS

beforeAll(() => {
  db = Loki.createDb({ dbName: 'GOAT', storage: LokiStorageType.memory })
})

it('Should return and instance of LockiJS DB', () => {
  const isLoki = db instanceof LokiJS
  expect(isLoki).toBe(true)
})

it('Should be named GOAT', () => {
  expect(db.filename).toBe('GOAT')
})

it('Should start with no collections', () => {
  const expectedCollections: string[] = []
  const dbCollections: string[] = []
    
  for(const collection of db.collections) {
    dbCollections.push(collection.name)
  }

  expect(expectedCollections.length).toBe(dbCollections.length)

  const uniqueCollections = {}

  expectedCollections.forEach((collection, index) => {
    uniqueCollections[collection] = true
    uniqueCollections[dbCollections[index]] = true
  })
  const areTheSame =
    Object.keys(uniqueCollections).length === expectedCollections.length

  expect(areTheSame).toBe(true)
})
