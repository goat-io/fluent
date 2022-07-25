import { flock } from '../flock'

export const basicTestSuite = Repository => {
  let storedId: any

  beforeAll(() => {
    Repository = new Repository()
  })

  test('Insert - Should  insert data', async () => {
    const a = await Repository.insert({ name: 'myGoat', age: 13 })
    expect(typeof a.id).toBe('string')
    expect(a.name).toBe('myGoat')
    expect(0).toBe(0)
  })

  it('Create Multiple - Should insert Multiple elements', async () => {
    const insertedFlock = await Repository.insertMany(flock)
    expect(insertedFlock[0].name).toBe('Goatee')
    storedId = insertedFlock[0].id
  })

  test('findMany - Should  GET data', async () => {
    await Repository.insertMany(flock)
    const storedGoats = await Repository.findMany()

    expect(Array.isArray(storedGoats)).toBe(true)
    expect(typeof storedGoats[0].id).toBe('string')
  })

  it('UpdateById - Should Update a single element', async () => {
    await Repository.insertMany(flock)
    const goats = await Repository.findMany()

    const data = await Repository.updateById(goats[0].id, {
      age: 99,
      name: 'MyUpdatedGoat'
    })
    expect(data.name).toBe('MyUpdatedGoat')
    expect(data.id).toBe(goats[0].id)
  })

  it('ReplaceById - Should Update a single element', async () => {
    await Repository.insertMany(flock)
    const goats = await Repository.findMany()
    const data = await Repository.replaceById(goats[0].id, {
      age: 2,
      name: 'MyReplacedGoat'
    })
    expect(data.name).toBe('MyReplacedGoat')
    expect(data.id).toBe(goats[0].id)
  })
}
