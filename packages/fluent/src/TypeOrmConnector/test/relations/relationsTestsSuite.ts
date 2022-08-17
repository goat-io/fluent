import { Promises } from '@goatlab/js-utils'
import { CarsRepository } from './car/car.repositoryTypeOrm'
import { RoleRepository } from './roles/roles.repositoryTypeOrm'
import { UserRepository } from './user/user.repositoryTypeOrm'

let User: UserRepository
let Car: CarsRepository
let Role: RoleRepository
// User, Cars, Roles
export const relationsTestSuite = (
  UserRepo,
  BelongsToModelF,
  ManyToManyModelF
) => {
  beforeAll(() => {
    User = new UserRepo()
    Car = new BelongsToModelF()
    Role = new ManyToManyModelF()
  })

  // test('requireById - Should return valid Object', async () => {
  //   const insertedUser = await User.insert({
  //     name: 'testUser',
  //     age: 20
  //   })

  //   expect(typeof insertedUser.id).toBe('string')

  //   const findById = await User.requireById(insertedUser.id!)

  //   expect(findById.id).toBe(insertedUser.id)
  // })

  // test('requireById - Should fail if not found', async () => {
  //   const insertedUser = await User.insert({
  //     name: 'testUser',
  //     age: 20
  //   })

  //   const [error, found] = await Promises.try(
  //     User.requireById('62ed01e4219a6ab760ae5c50')
  //   )

  //   expect(error?.message).toBe('Object 62ed01e4219a6ab760ae5c50 not found')
  // })

  // test('loadFirst - Should return a cloned class', async () => {
  //   const insertedUser = await User.insert({
  //     name: 'testUser',
  //     age: 20
  //   })

  //   expect(typeof insertedUser.id).toBe('string')

  //   const user = User.loadFirst({
  //     where: {
  //       id: insertedUser.id
  //     }
  //   })

  //   expect(Array.isArray(user)).toBe(false)
  //   expect(typeof user).toBe('object')
  //   expect(user).toHaveProperty('associate')
  // })

  // test('Associate - OneToMany - Should  insert data', async () => {
  //   const insertedUser = await User.insert({
  //     name: 'testUser',
  //     age: 20
  //   })

  //   expect(typeof insertedUser.id).toBe('string')

  //   const user = await User.loadById(insertedUser.id!)

  //   const cars = await user.cars().associate({ name: 'Another new car' })

  //   expect(Array.isArray(cars)).toBe(true)
  //   expect(cars[0].name).toBe('Another new car')
  //   expect(cars[0].userId).toBe(insertedUser.id)
  // })

  // test('Query related model - OneToMany (belongsToMany)', async () => {
  //   const insertedUser = await User.insert({
  //     name: 'testUser',
  //     age: 20
  //   })

  //   expect(typeof insertedUser.id).toBe('string')

  //   const user1 = await User.loadById(insertedUser.id!)

  //   const cars = await user1.cars().associate({ name: 'My new car' })

  //   expect(Array.isArray(cars)).toBe(true)

  //   const searchUserWithRelation = await User.findMany({
  //     where: { id: insertedUser.id },
  //     include: {
  //       cars: true
  //     }
  //   })

  //   const firstResult = searchUserWithRelation[0]!

  //   expect(Array.isArray(searchUserWithRelation)).toBe(true)
  //   expect(Array.isArray(firstResult.cars)).toBe(true)
  //   expect(firstResult.cars!.length > 0).toBe(true)
  //   expect(firstResult.cars![0].userId).toBe(insertedUser.id)

  //   const searchCar = await user1.cars().findMany({
  //     where: { name: 'My new car' },
  //     include: { user: true }
  //   })

  //   expect(Array.isArray(searchCar)).toBe(true)
  //   expect(searchCar.length > 0).toBe(true)
  //   expect(searchCar[0].user?.id).toBe(insertedUser.id)

  //   const searchCar2 = await user1
  //     .cars()
  //     .findMany({ where: { name: 'My.......' } })

  //   expect(Array.isArray(searchCar2)).toBe(true)
  //   expect(searchCar2.length === 0).toBe(true)
  // })

  // test('Query related model - ManyToOne (BelongsTo)', async () => {
  //   const insertedUser = await User.insert({
  //     name: 'testUser',
  //     age: 20
  //   })

  //   expect(typeof insertedUser.id).toBe('string')

  //   const user1 = await User.loadById(insertedUser.id!)

  //   await user1.cars().associate({ name: 'My new car' })

  //   const results = await Car.findMany({
  //     where: {
  //       userId: insertedUser.id
  //     },
  //     include: {
  //       user: true
  //     }
  //   })

  //   expect(Array.isArray(results)).toBe(true)
  //   expect(results.length > 0).toBe(true)
  //   expect(typeof results[0].user?.name).toBe('string')

  //   expect(results[0].user!['id']).toBe(insertedUser.id)
  // })

  // test('Query related model - ManyToMany', async () => {
  //   const insertedUser = await User.insert({
  //     name: 'testUser',
  //     age: 20
  //   })

  //   expect(typeof insertedUser.id).toBe('string')

  //   const adminRole = await Role.insert({
  //     name: 'Administrator'
  //   })

  //   const user = await User.loadById(insertedUser.id!)

  //   const associated = await user.roles().attach(adminRole.id!)

  //   expect(associated[0].userId).toBe(insertedUser.id)
  //   expect(associated[0].roleId).toBe(adminRole.id)

  //   const searchUserWithRelation = await User.findMany({
  //     where: {
  //       id: insertedUser.id
  //     },
  //     include: {
  //       roles: true
  //     }
  //   })

  //   expect(Array.isArray(searchUserWithRelation[0].roles)).toBe(true)
  //   expect(searchUserWithRelation[0].roles!.length > 0).toBe(true)
  //   expect(typeof searchUserWithRelation[0].roles![0].name).toBe('string')
  //   expect(searchUserWithRelation[0].roles![0].id).toBe(adminRole.id)
  //   // expect(searchUserWithRelation[0].roles[0].pivot.id).toBe(associated.id)

  //   // Query the opposite relation
  //   const roles = await Role.findMany({
  //     where: {
  //       name: 'Administrator'
  //     },
  //     include: {
  //       users: true
  //     }
  //   })

  //   expect(Array.isArray(roles)).toBe(true)
  //   expect(roles.length > 0).toBe(true)
  //   expect(typeof roles[0].users![0].name).toBe('string')
  //   expect(typeof roles[0].users![0].age).toBe('number')
  // })

  test('Related - should load multiple relationships at once', async () => {
    const insertedUser = await User.insert({
      name: 'testUser1',
      age: 20
    })

    await User.insert({
      name: 'anotherUser 2',
      age: 24
    })

    const adminRole = await Role.insert({
      name: 'Administrator'
    })

    const user = await User.loadById(insertedUser.id)
    const attachedRole = await user.roles().attach(adminRole.id!)
    const associatedCar1 = await user.cars().associate({ name: 'My' })
    const associatedCar2 = await user.cars().associate({ name: 'My new car 2' })
    const associatedCar3 = await user.cars().associate({ name: 'My new car 4' })
    const associatedCar4 = await user.cars().associate({ name: 'My new car 4' })

    const searchUserWithRelations = await User.findMany({
      select: {
        id: true,
        name: true
      },
      // Inner join
      where: {
        id: insertedUser.id
      },
      include: {
        // Left Join
        cars: {
          select: {
            id: true,
            name: true
          },
          where: {
            name: 'My new car 4'
          },
          include: {
            user: {
              where: {
                name: 'testUser432'
              }
            }
          }
        }
      }
    })

    console.log(searchUserWithRelations[0]['cars']![0])
  })
}
