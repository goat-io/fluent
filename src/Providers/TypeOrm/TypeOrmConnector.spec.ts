import { Fluent } from '../../Fluent'
import { TypeOrmConnector } from './TypeOrmConnector'
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ObjectIdColumn,
  ObjectID
} from 'typeorm'
import { ApiProperty } from '@nestjs/swagger'
import { Field, ID } from '@nestjs/graphql'
import { Repository } from 'typeorm'
import { createConnection } from 'typeorm'
import { mongoMemory } from '../../core/Database/mongo.memory'
// jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000
// tslint:disable-next-line: max-classes-per-file
@Entity()
export class GoatEntityOut {
  @ObjectIdColumn()
  @ApiProperty()
  @Field(() => ID)
  _id: ObjectID

  @Column('text')
  @Index()
  @ApiProperty()
  name: string

  @Column('int')
  @ApiProperty()
  age: number
}

@Entity()
export class GoatEntityIn {
  @Column('text')
  @Index()
  @ApiProperty()
  name: string

  @Column('int')
  @ApiProperty()
  age: number
}

const flock = [
  {
    age: 3,
    name: 'Goatee'
  },
  {
    age: 4,
    name: 'GoaToHell'
  },
  {
    age: 5,
    name: 'Oh!MyGoat'
  }
]

let GoatModel: TypeOrmConnector<GoatEntityIn, GoatEntityOut>
let storedId: any

beforeAll(async done => {
  const a = await mongoMemory.start()

  const connection = await createConnection({
    type: 'mongodb',
    url: a.url,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    entities: [GoatEntityOut],
    synchronize: true,
    logging: false
  })

  const repository = connection.getRepository(GoatEntityOut)

  GoatModel = new TypeOrmConnector<GoatEntityIn, GoatEntityOut>({
    repository
  })
  done()
})

test('Get - Should  GET data', async () => {
  const storedGoats = await GoatModel.get()
  expect(Array.isArray(storedGoats)).toBe(true)
})

test('Insert - Should  insert data', async () => {
  const a = await GoatModel.insert({ name: 'myGoat', age: 13 })
  expect(typeof a._id).toBe('object')
  expect(a.name).toBe('myGoat')
  expect(0).toBe(0)
})

it('Create Multiple - Should insert Multiple elements', async () => {
  const insertedFlock = await GoatModel.insertMany(flock)
  expect(insertedFlock[0].name).toBe('Goatee')
  storedId = insertedFlock[0]._id
})

it('UpdateById - Should Update a single element', async () => {
  await GoatModel.insertMany(flock)
  const goats = await GoatModel.get()
  const data = await GoatModel.updateById(goats[0]._id, {
    age: 99,
    name: 'MyUpdatedGoat'
  })
  expect(data.name).toBe('MyUpdatedGoat')
})
