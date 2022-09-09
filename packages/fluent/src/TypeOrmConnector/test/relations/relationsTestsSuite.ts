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

  const insertRelatedData = async () => {
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

    return { insertedUser, adminRole }
  }

  test('requireById - Should return valid Object', async () => {
    const insertedUser = await User.insert({
      name: 'testUser',
      age: 20
    })

    expect(typeof insertedUser.id).toBe('string')

    const findById = await User.requireById(insertedUser.id!)

    expect(findById.id).toBe(insertedUser.id)
  })

  test('requireById - Should fail if not found', async () => {
    const insertedUser = await User.insert({
      name: 'testUser',
      age: 20
    })

    const [error, found] = await Promises.try(
      User.requireById('62ed01e4219a6ab760ae5c50')
    )

    expect(error?.message).toBe('Object 62ed01e4219a6ab760ae5c50 not found')
  })

  test('loadFirst - Should return a cloned class', async () => {
    const insertedUser = await User.insert({
      name: 'testUser',
      age: 20
    })

    expect(typeof insertedUser.id).toBe('string')

    const user = User.loadFirst({
      where: {
        id: insertedUser.id
      }
    })

    expect(Array.isArray(user)).toBe(false)
    expect(typeof user).toBe('object')
    expect(user).toHaveProperty('associate')
  })

  test('Associate - OneToMany - Should  insert data', async () => {
    const insertedUser = await User.insert({
      name: 'testUser',
      age: 20
    })

    expect(typeof insertedUser.id).toBe('string')

    const user = await User.loadById(insertedUser.id!)

    const cars = await user.cars().associate({ name: 'Another new car' })

    expect(Array.isArray(cars)).toBe(true)
    expect(cars[0].name).toBe('Another new car')
    expect(cars[0].userId).toBe(insertedUser.id)
  })

  test('Query related model - OneToMany (belongsToMany)', async () => {
    const insertedUser = await User.insert({
      name: 'testUser',
      age: 20
    })

    expect(typeof insertedUser.id).toBe('string')

    const user1 = await User.loadById(insertedUser.id!)

    const cars = await user1.cars().associate({ name: 'My new car' })

    expect(Array.isArray(cars)).toBe(true)

    const searchUserWithRelation = await User.findMany({
      where: { id: insertedUser.id },
      include: {
        cars: true
      }
    })

    const firstResult = searchUserWithRelation[0]!

    expect(Array.isArray(searchUserWithRelation)).toBe(true)
    expect(Array.isArray(firstResult.cars)).toBe(true)
    expect(firstResult.cars!.length > 0).toBe(true)
    expect(firstResult.cars![0].userId).toBe(insertedUser.id)

    const searchCar = await user1.cars().findMany({
      where: { name: 'My new car' },
      include: { user: true }
    })

    expect(Array.isArray(searchCar)).toBe(true)
    expect(searchCar.length > 0).toBe(true)
    expect(searchCar[0].user?.id).toBe(insertedUser.id)

    const searchCar2 = await user1
      .cars()
      .findMany({ where: { name: 'My.......' } })

    expect(Array.isArray(searchCar2)).toBe(true)
    expect(searchCar2.length === 0).toBe(true)
  })

  test('Query related model - ManyToOne (BelongsTo)', async () => {
    const insertedUser = await User.insert({
      name: 'testUser',
      age: 20
    })

    expect(typeof insertedUser.id).toBe('string')

    const user1 = await User.loadById(insertedUser.id!)

    await user1.cars().associate({ name: 'My new car' })

    const results = await Car.findMany({
      where: {
        userId: insertedUser.id
      },
      include: {
        user: true
      }
    })

    expect(Array.isArray(results)).toBe(true)
    expect(results.length > 0).toBe(true)
    expect(typeof results[0].user?.name).toBe('string')

    expect(results[0].user!['id']).toBe(insertedUser.id)
  })

  test('Include - can load cyclical relations', async () => {
    const { insertedUser } = await insertRelatedData()

    const searchUserWithRelations = await User.findMany({
      where: {
        id: insertedUser.id
      },
      include: {
        cars: {
          include: {
            user: {
              include: {
                cars: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    })
    // Filter by id should load 1 result
    expect(searchUserWithRelations.length).toBe(1)

    // No filters on the cars, so should load the 4 associated cars
    expect(searchUserWithRelations[0].cars?.length).toBe(4)

    // Expect nested user to be the inserted one
    expect(searchUserWithRelations[0].cars![0].user?.id).toBe(insertedUser.id)
    expect(searchUserWithRelations[0].cars![0].user?.name).toBe(
      insertedUser.name
    )

    // Expect the top level user, to be the same as the bottom level user

    expect(searchUserWithRelations[0].cars![0].user?.id).toBe(
      searchUserWithRelations[0].id
    )
    expect(searchUserWithRelations[0].cars![0].user?.name).toBe(
      searchUserWithRelations[0].name
    )

    // Expect double nested to exist
    expect(searchUserWithRelations[0].cars![0].user?.cars?.length).toBe(4)

    // Expect triple nested to load user
    expect(searchUserWithRelations[0].cars![0].user?.cars![0].user?.id).toBe(
      searchUserWithRelations[0].id
    )
  })

  test('Include - can filter related models', async () => {
    const { insertedUser } = await insertRelatedData()
    const searchUserWithRelations = await User.findMany({
      where: {
        id: insertedUser.id
      },
      include: {
        // Left Join
        cars: {
          select: {
            name: true,
            id: true
          },
          where: {
            name: 'My new car 4'
          },
          include: {
            user: {
              include: {
                cars: {
                  where: {
                    name: 'My new car XXXxX'
                  },
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    })

    expect(searchUserWithRelations[0].cars?.length).toBe(2)
    expect(searchUserWithRelations[0].cars![0].name).toBe('My new car 4')
    expect(searchUserWithRelations[0].cars![0].user?.cars?.length).toBe(0)
  })

  test('Include - (One to Many) Should display [] if not found', async () => {
    const { insertedUser } = await insertRelatedData()
    const searchUserWithRelations = await User.findMany({
      where: {
        id: insertedUser.id
      },
      include: {
        cars: {
          where: {
            name: 'My new car XX'
          }
        }
      }
    })

    expect(Array.isArray(searchUserWithRelations[0].cars)).toBe(true)
    expect(searchUserWithRelations[0].cars?.length).toBe(0)
  })

  test('Include - (Many to One) Should display null if not found', async () => {
    const { insertedUser } = await insertRelatedData()
    const insertedCars = await Car.findMany({
      where: {
        userId: insertedUser.id
      },
      select: {
        id: true,
        name: true,
        userId: true,
        user: true
      },
      include: {
        // Left Join
        user: {
          where: {
            name: 'JOHN'
          }
        }
      }
    })

    // TODO: $unwind is not returning null in MongoDB, this is most likely a problem with our query
    expect(
      insertedCars[0].user === null || insertedCars[0].user === undefined
    ).toBe(true)
    expect(insertedCars.length).toBe(4)
  })

  test('Include - Should pull info from the main search object if no related data', async () => {
    const { insertedUser } = await insertRelatedData()
    const searchUserWithRelations = await User.findMany({
      select: {
        id: true,
        name: true,
        cars: {
          name: true,
          user: {
            id: true,
            name: true,
            cars: {
              id: true,
              user: true,
              name: true
            }
          }
        }
      },
      // Inner join
      where: {
        id: insertedUser.id
      },
      include: {
        // Left Join
        cars: {
          select: {
            name: true,
            id: true
          },
          where: {
            name: 'My new car XXX'
          },
          include: {
            user: {
              include: {
                cars: {
                  where: {
                    name: 'My new car XXXxX'
                  },
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    })
    expect(searchUserWithRelations[0].id).toBe(insertedUser.id)
    expect(searchUserWithRelations[0].name).toBe(insertedUser.name)
    expect(searchUserWithRelations[0].cars?.length).toBe(0)
  })

  test('Include - Can filter and select specific keys', async () => {
    const { insertedUser } = await insertRelatedData()
    const searchUserWithRelations = await User.findMany({
      select: {
        id: true,
        name: true,
        age: true,
        cars: {
          name: true,
          user: {
            id: true,
            name: true,
            cars: {
              id: true,
              user: true,
              name: true
            }
          }
        }
      },
      // Inner join
      where: {
        id: insertedUser.id
      },
      include: {
        // Left Join
        cars: {
          select: {
            name: true,
            id: true
          },
          where: {
            name: 'My new car 4'
          },
          include: {
            user: {
              include: {
                cars: {
                  where: {
                    name: 'My new car XXXxX'
                  },
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    })

    expect(searchUserWithRelations[0]).toHaveProperty('age')
    expect(searchUserWithRelations[0].age).toBe(insertedUser.age)
    // Should not include property breed
    expect(searchUserWithRelations[0]).not.toHaveProperty('breed')
  })

  test('Include - Should filter keys from nested objects', async () => {
    const { insertedUser } = await insertRelatedData()
    const searchUserWithRelations = await User.findMany({
      select: {
        id: true,
        name: true,
        cars: {
          name: true,
          user: {
            id: true,
            name: true,
            cars: {
              id: true,
              user: true,
              name: true
            }
          }
        }
      },
      // Inner join
      where: {
        id: insertedUser.id
      },
      include: {
        // Left Join
        cars: {
          select: {
            name: true
          },
          where: {
            name: 'My new car 4'
          },
          include: {
            user: {
              select: {
                id: true,
                name: true
              },
              include: {
                cars: {
                  where: {
                    name: 'My new car XXXxX'
                  },
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    })

    expect(searchUserWithRelations[0].cars![0]).not.toHaveProperty('id')
    expect(searchUserWithRelations[0].cars![0]).not.toHaveProperty('userId')
    expect(searchUserWithRelations[0].cars![0]).toHaveProperty('user')
    expect(searchUserWithRelations[0].cars![0].name).toBe('My new car 4')

    expect(searchUserWithRelations[0].cars![0].user).not.toHaveProperty('age')
    expect(searchUserWithRelations[0].cars![0].user).not.toHaveProperty('breed')
    expect(searchUserWithRelations[0].cars![0].user?.id).toBe(insertedUser.id)
  })

  test('Include - Can select keys using main select or nested selects', async () => {
    const { insertedUser } = await insertRelatedData()
    await User.findMany({
      select: {
        id: true,
        name: true,
        cars: {
          name: true,
          user: {
            id: true,
            name: true,
            cars: {
              id: true,
              user: true,
              name: true
            }
          }
        }
      },
      // Inner join
      where: {
        id: insertedUser.id
      },
      include: {
        // Left Join
        cars: {
          select: {
            name: true,
            id: true
          },
          where: {
            name: 'My new car 4'
          },
          include: {
            user: {
              include: {
                cars: {
                  where: {
                    name: 'My new car XXXxX'
                  },
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    })
  })

  test('Include - (Many to Many) should display [] if not found', async () => {
    const { insertedUser } = await insertRelatedData()
    await User.findMany({
      select: {
        id: true,
        name: true,
        cars: {
          name: true,
          user: {
            id: true,
            name: true,
            cars: {
              id: true,
              user: true,
              name: true
            }
          }
        }
      },
      // Inner join
      where: {
        id: insertedUser.id
      },
      include: {
        // Left Join
        cars: {
          select: {
            name: true,
            id: true
          },
          where: {
            name: 'My new car 4'
          },
          include: {
            user: {
              include: {
                cars: {
                  where: {
                    name: 'My new car XXXxX'
                  },
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    })
  })

  test('Query related model - ManyToMany', async () => {
    const insertedUser = await User.insert({
      name: 'testUser',
      age: 20
    })

    expect(typeof insertedUser.id).toBe('string')

    const adminRole = await Role.insert({
      name: 'Administrator'
    })

    const user = await User.loadById(insertedUser.id!)

    const attached = await user.roles().attach(adminRole.id!)

    expect(attached[0].userId).toBe(insertedUser.id)
    expect(attached[0].roleId).toBe(adminRole.id)

    const searchUserWithRelation = await User.findMany({
      where: {
        id: insertedUser.id
      },
      include: {
        roles: {
          withPivot: true
        }
      }
    })

    console.log(searchUserWithRelation[0])

    expect(Array.isArray(searchUserWithRelation[0].roles)).toBe(true)
    expect(searchUserWithRelation[0].roles!.length > 0).toBe(true)
    expect(typeof searchUserWithRelation[0].roles![0].name).toBe('string')
    expect(searchUserWithRelation[0].roles![0].id).toBe(adminRole.id)
    expect(searchUserWithRelation[0].roles![0].pivot.id).toBe(attached[0].id)



    // Query the opposite relation
    const roles = await Role.findMany({
      where: {
        name: 'Administrator'
      },
      include: {
        users: { withPivot: true }
      }
    })

    expect(Array.isArray(roles)).toBe(true)
    expect(roles.length > 0).toBe(true)
    expect(typeof roles[0].users![0].name).toBe('string')
    expect(typeof roles[0].users![0].age).toBe('number')
    expect(roles[0].users![0].pivot).toBeDefined()

    expect(roles[0].users![0].id).toBe(roles[0].users![0].pivot.userId)

    // Have to check every role, some tests run in parallel, so tha DB could have many of the same type "Administrator"
    expect(
      roles.some(r => {
        return r.users!.some(u => u.id === insertedUser.id)
      })
    ).toBe(true)
  })
}
