import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  UpdateDateColumn,
  CreateDateColumn,
  DeleteDateColumn,
  VersionColumn
} from 'typeorm'
import { ApiProperty } from '@nestjs/swagger'
import { Field, ID, ObjectType } from '@nestjs/graphql'
import * as faker from 'faker'

@ObjectType()
export class Access {
  @Column({ nullable: true })
  @ApiProperty()
  type?: string

  @Column({ nullable: true, type: 'simple-array' })
  @ApiProperty()
  roles?: string[]
}

// tslint:disable-next-line: max-classes-per-file
@Entity()
@ObjectType()
export class Form {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  @Field(() => ID)
  _id: string

  @Column()
  @Index({ unique: true })
  @ApiProperty()
  path: string

  @Column()
  @ApiProperty()
  title?: string

  @Column()
  @ApiProperty()
  name?: string

  @Column()
  @ApiProperty()
  type?: string

  @Column()
  @ApiProperty()
  description?: string

  @Column('simple-array')
  @ApiProperty({ type: [String] })
  tags?: string[]

  @Column()
  @ApiProperty()
  display?: string

  @Column()
  @ApiProperty()
  action?: string

  @Column()
  @ApiProperty()
  owner: string

  @Column()
  @ApiProperty()
  settings: number

  @Column('int')
  @ApiProperty()
  properties: number

  @Column()
  @ApiProperty()
  machineName: string

  @CreateDateColumn()
  @ApiProperty()
  created: Date

  @UpdateDateColumn()
  @ApiProperty()
  updated: Date

  @DeleteDateColumn()
  @ApiProperty()
  deleted: Date

  @VersionColumn()
  @ApiProperty()
  version: number

  @Column()
  @ApiProperty()
  components?: string

  @Column(type => Access)
  @ApiProperty({ isArray: true, type: Access, nullable: true })
  access?: Access[]

  @Column(type => Access)
  @ApiProperty({ isArray: true, type: Access, nullable: true })
  submissionAccess?: Access[]
}

export const fakeForm = (): Form => {
  return {
    _id: faker.random.uuid(),
    path: faker.name.firstName(),
    title: faker.name.firstName(),
    name: faker.name.firstName(),
    type: faker.name.firstName(),
    description: faker.random.words(),
    tags: [faker.random.word(), faker.random.word(), faker.random.word()],
    display: String(faker.random.boolean()),
    action: faker.random.word(),
    owner: faker.random.uuid(),
    settings: faker.random.number(),
    properties: faker.random.number(),
    machineName: faker.random.word(),
    created: faker.date.recent(),
    updated: faker.date.recent(),
    deleted: faker.date.recent(),
    version: faker.random.number(),
    components: '',
    access: [
      {
        type: faker.random.word(),
        roles: [faker.random.uuid(), faker.random.uuid()]
      }
    ],
    submissionAccess: [
      {
        type: faker.random.word(),
        roles: [faker.random.uuid(), faker.random.uuid()]
      }
    ]
  }
}
