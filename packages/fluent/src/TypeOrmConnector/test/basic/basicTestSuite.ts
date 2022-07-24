import { flock } from '../flock'

export const basicTestSuite = Model => {
  let storedId: any

  beforeAll(() => {
    Model = new Model()
  })

  test('Insert - Should  insert data', async () => {
    const a = await Model.insert({ name: 'myGoat', age: 13 })
    expect(typeof a.id).toBe('string')
    expect(a.name).toBe('myGoat')
    expect(0).toBe(0)
  })

  it('Create Multiple - Should insert Multiple elements', async () => {
    const insertedFlock = await Model.insertMany(flock)
    expect(insertedFlock[0].name).toBe('Goatee')
    storedId = insertedFlock[0].id
  })

  test('findMany - Should  GET data', async () => {
    await Model.insertMany(flock)
    const storedGoats = await Model.findMany()

    expect(Array.isArray(storedGoats)).toBe(true)
    expect(typeof storedGoats[0].id).toBe('string')
  })

  it('UpdateById - Should Update a single element', async () => {
    await Model.insertMany(flock)
    const goats = await Model.findMany()

    const data = await Model.updateById(goats[0].id, {
      age: 99,
      name: 'MyUpdatedGoat'
    })
    expect(data.name).toBe('MyUpdatedGoat')
    expect(data.id).toBe(goats[0].id)
  })

  it('ReplaceById - Should Update a single element', async () => {
    await Model.insertMany(flock)
    const goats = await Model.findMany()
    const data = await Model.replaceById(goats[0].id, {
      age: 2,
      name: 'MyReplacedGoat'
    })
    expect(data.name).toBe('MyReplacedGoat')
    expect(data.id).toBe(goats[0].id)
  })
}
