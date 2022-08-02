import { UserRepository } from "./user/user.repositoryTypeOrm"


let Model
let BelongsToModel
let ManyToManyModel
// User, Cars, Roles
export const relationsTestSuite = (ModelF, BelongsToModelF, ManyToManyModelF) => {
  beforeAll(() => {
    Model = new ModelF()
    BelongsToModel = new BelongsToModelF()
    ManyToManyModel = new ManyToManyModelF()
  })


  test('loadFirst - Should return a cloned class', async () => {

    const userR = new UserRepository()
  
    const user = await userR
    .loadFirst({
      where: {
        id: '2'
      }
    })
  
    //console.log(user)
    expect(true).toBe(false)

  })

  /*
  test('Attach - OneToMany - Should  insert data', async () => {
    const insertedUser = await Model.insert({
      name: 'testUser',
      age: 20
    })

    expect(typeof insertedUser.id).toBe('string')

    const user = await Model.where(
      keys => keys.id,
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

    const user1 = await Model.where(keys => keys.id, '=', insertedUser.id).load()

    const cars = await user1.cars().attach({ name: 'My new car' })

    expect(Array.isArray(cars)).toBe(true)

    const searchUserWithRelation = await Model.where(
      keys => keys.id,
      '=',
      insertedUser.id
    )
    .with({ cars: BelongsToModelF })
    .get()

    expect(Array.isArray(searchUserWithRelation[0].cars)).toBe(true)
    expect(searchUserWithRelation[0].cars.length > 0).toBe(true)

    const searchCar = await user1
    .cars()
    .where(keys => keys.name, '=', 'My new car')
    .get()

    expect(Array.isArray(searchCar)).toBe(true)
    expect(searchCar.length > 0).toBe(true)

    const searchCar2 = await user1
    .cars()
    .where(keys => keys.name, '=', 'My.......')
    .get()
    expect(Array.isArray(searchCar2)).toBe(true)
    expect(searchCar2.length === 0).toBe(true)
  })

  test('Query related model - BelongTo', async () => {
    const insertedUser = await Model.insert({
      name: 'testUser',
      age: 20
    })

    expect(typeof insertedUser.id).toBe('string')

    const user1 = await Model.where(
      keys => keys.id,
      '=',
      insertedUser.id
    ).load()

    await user1.cars().attach({ name: 'My new car' })

    const results = await BelongsToModel.with({ user: ModelF }).get()

    expect(Array.isArray(results)).toBe(true)
    expect(results.length > 0).toBe(true)
    expect(typeof results[0].user.name).toBe('string')
  })

  test('Query related model - ManyToMany', async () => {
    const insertedUser = await Model.insert({
      name: 'testUser',
      age: 20
    })

    expect(typeof insertedUser.id).toBe('string')

    const adminRole = await ManyToManyModel.insert({
      name: 'Administrator'
    })

    const user = await Model.where(keys => keys.id, '=', insertedUser.id).load()

    const associated = await user.roles().associate(adminRole.id)
    expect(associated[0].userId).toBe(insertedUser.id)
    expect(associated[0].roleId).toBe(adminRole.id)

    const searchUserWithRelation = await Model.where(
      keys => keys.id,
      '=',
      insertedUser.id
    )
    .with({
      roles: ManyToManyModelF
    })
    .get()

    expect(Array.isArray(searchUserWithRelation[0].roles)).toBe(true)
    expect(searchUserWithRelation[0].roles.length > 0).toBe(true)
    expect(typeof searchUserWithRelation[0].roles[0].name).toBe('string')

    // Query the opposite relation
    const roles = await ManyToManyModel.where(
      keys => keys.name,
      '=',
      'Administrator'
    )
    .with({
      users: ModelF
    })
    .get()

    expect(Array.isArray(roles)).toBe(true)
    expect(roles.length > 0).toBe(true)
    expect(typeof roles[0].users[0].name).toBe('string')
    expect(typeof roles[0].users[0].age).toBe('number')
  })

  */
}
