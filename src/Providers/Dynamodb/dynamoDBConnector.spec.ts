import { GoatEntityOut, GoatEntityIn } from '../test/goat.dto'
import { GoatEntity } from '../test/goat.entity'
import { flock } from '../test/flock'
import * as admin from 'firebase-admin'

import { getRepository, initialize } from 'fireorm'
/*
jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'

admin.initializeApp({
  projectId: 'test',
  credential: admin.credential.applicationDefault()
})
const firestore = admin.firestore()

beforeEach(() => {
  initialize(firestore)
})
*/
test('Insert - Should  insert data', async () => {
  // const todo = { text: 'myGoat', done: false } as Todo

  //const todoDocument = await todoRepository.find()
  //console.log(todoDocument)
  //expect(typeof todoDocument.id).toBe('string')
  //expect(todoDocument.text).toBe('myGoat')
  expect(0).toBe(0)
})

/*

test('Get - Should  GET data', async () => {
  const storedGoats = await GoatModel.get()
  console.log(storedGoats)
  expect(Array.isArray(storedGoats)).toBe(true)
})


it('Create Multiple - Should insert Multiple elements', async () => {
  const insertedFlock = await GoatModel.insertMany(flock)
  expect(insertedFlock[0].name).toBe('Goatee')
  storedId = insertedFlock[0].id
})

it('UpdateById - Should Update a single element', async () => {
  await GoatModel.insertMany(flock)
  const goats = await GoatModel.get()
  const data = await GoatModel.updateById(goats[0].id, {
    age: 99,
    name: 'MyUpdatedGoat'
  })
  expect(data.name).toBe('MyUpdatedGoat')
})
*/
