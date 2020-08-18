export const relationsTestSuite = Model => {
  beforeAll(() => {
    Model = new Model()
  })

  test('Attach - OneToMany - Should  insert data', async () => {
    const insertedUser = await Model.insert({
      name: 'testUser',
      age: 20
    })

    expect(typeof insertedUser.id).toBe('string')

    const user = await Model.where(
      Model.cars()._keys.id,
      '=',
      insertedUser.id
    ).load()

    const cars = await user.cars().attach({ name: 'Another new car' })

    expect(Array.isArray(cars)).toBe(true)
    expect(cars[0].name).toBe('Another new car')
  })

  test('Query related model - OneToMany', async () => {
    const insertedUser = await Model.insert({
      name: 'testUser',
      age: 20
    })

    expect(typeof insertedUser.id).toBe('string')

    const user1 = await Model.where(
      Model.cars()._keys.id,
      '=',
      insertedUser.id
    ).load()

    const cars = await user1.cars().attach({ name: 'My new car' })

    expect(Array.isArray(cars)).toBe(true)

    const searchCar = await user1
      .cars()
      .where(Model.cars()._keys.name, '=', 'My new car')
      .get()

    expect(Array.isArray(searchCar)).toBe(true)
    expect(searchCar.length > 0).toBe(true)

    const searchCar2 = await user1
      .cars()
      .where(Model.cars()._keys.name, '=', 'My.......')
      .get()
    expect(Array.isArray(searchCar2)).toBe(true)
    expect(searchCar2.length === 0).toBe(true)
  })
}
