/* global describe, it, beforeAll */
import 'babel-polyfill'
import chai from 'chai'
import Loki from 'lokijs'
import Database from './Database.js'

const expect = chai.expect
let db

describe('Given the DB instance', () => {
  beforeAll(async () => {
    db = await Database.get({ env: 'testing' })
  })

  it('Should return and instance of LockiJS DB', () => {
    const isLoki = db instanceof Loki

    expect(isLoki).to.be.true
  })

  it('Should be named GOAT', () => {
    expect(db.filename).to.be.equal('GOAT')
  })

  it('Should have all basic Collections', () => {
    const expectedCollections = [
      'Submission',
      'Form',
      'Translation',
      'User',
      'Role',
      'Configuration',
      'Pages'
    ]
    const dbCollections = db.collections.reduce((dbColArray, dbCol) => {
      dbColArray.push(dbCol.name)
      return dbColArray
    }, [])

    if (expectedCollections.length !== dbCollections.length) {
      return false
    }
    const uniqueCollections = {}

    expectedCollections.forEach((collection, index) => {
      uniqueCollections[collection] = true
      uniqueCollections[dbCollections[index]] = true
    })
    const areTheSame =
      Object.keys(uniqueCollections).length === expectedCollections.length

    expect(areTheSame).to.be.equal(true)
  })
})
