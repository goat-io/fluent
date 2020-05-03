import { Database } from './Database'
import Loki from 'lokijs'

let db
beforeAll(async () => {
  db = await Database.get()
})

it('Should return and instance of LockiJS DB', () => {
  const isLoki = db instanceof Loki
  expect(isLoki).toBe(true)
})

it('Should be named GOAT', () => {
  expect(db.filename).toBe('GOAT')
})

it('Should start with no collections', () => {
  const expectedCollections = []
  const dbCollections = db.collections.reduce((dbColArray, dbCol) => {
    dbColArray.push(dbCol.name)
    return dbColArray
  }, [])

  expect(expectedCollections.length).toBe(dbCollections.length)

  const uniqueCollections = {}

  expectedCollections.forEach((collection, index) => {
    uniqueCollections[collection] = true
    uniqueCollections[dbCollections[index]] = true
  })
  const areTheSame = Object.keys(uniqueCollections).length === expectedCollections.length

  expect(areTheSame).toBe(true)
})
