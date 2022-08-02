import { Promises } from "@goatlab/js-utils"
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

  // test('requireById - Should return valid Object', async () => {
   
  //   const insertedUser = await Model.insert({
  //     name: 'testUser',
  //     age: 20
  //   })

  //   expect(typeof insertedUser.id).toBe('string')

  //   const findById = await Model.requireById(insertedUser.id!)
  //   expect(findById.id).toBe(insertedUser.id)

  // })

  // test('requireById - Should fail if not found', async () => {
   
  //   const insertedUser = await Model.insert({
  //     name: 'testUser',
  //     age: 20
  //   })

  //   expect(typeof insertedUser.id).toBe('string')

  //   const [error, found] = await Promises.try(Model.requireById('SomeUnkownId'))

  //   expect(error?.message).toBe('Object SomeUnkownId not found')

  // })

  // test('loadFirst - Should return a cloned class', async () => {
  //   const insertedUser = await Model.insert({
  //     name: 'testUser',
  //     age: 20
  //   })

  //   expect(typeof insertedUser.id).toBe('string')    
  
  //   const user = Model
  //   .loadFirst({
  //     where: {
  //       id: insertedUser.id
  //     }
  //   })

  //   expect(Array.isArray(user)).toBe(false)
  //   expect(typeof user).toBe('object')
  //   expect(typeof user.associate).toBe('function')
  // })


  test('Associate - OneToMany - Should  insert data', async () => {
    const UserRepo = new UserRepository()
    const insertedUser = await UserRepo.insert({
      name: 'testUser',
      age: 20
    })

    expect(typeof insertedUser.id).toBe('string')

    const user = await UserRepo.loadById(insertedUser.id!)

    const cars = user.cars().associate({ name: 'My new car' })

    console.log(cars)
    // console.log(user)

    // const cars = await user.

    // expect(Array.isArray(cars)).toBe(true)
    // expect(cars[0].name).toBe('Another new car')
  })

  /*
  

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
