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
import { Access } from '../../dtos/access.dto'
import * as faker from 'faker'
import { Collection } from 'fireorm'

// tslint:disable-next-line: max-classes-per-file
@Entity()
@Collection()
@ObjectType()
export class Form {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  @Field(() => ID)
  id: string

  @Column()
  @Index({ unique: true })
  @ApiProperty()
  path: string

  @Column({ nullable: true })
  @ApiProperty({ nullable: true, required: false })
  title?: string

  @Column({ nullable: true })
  @ApiProperty({ nullable: true, required: false })
  name?: string

  @Column({ nullable: true })
  @ApiProperty({ nullable: true, required: false })
  type?: string

  @Column({ nullable: true })
  @ApiProperty({ nullable: true, required: false })
  description?: string

  @Column({ type: 'simple-array', nullable: true })
  @ApiProperty({ type: [String], nullable: true, required: false })
  tags?: string[]

  @Column({ nullable: true })
  @ApiProperty({ nullable: true, required: false })
  display?: string

  @Column({ nullable: true })
  @ApiProperty({ nullable: true, required: false })
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
  machineName?: string

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

  @Column({ nullable: true })
  @ApiProperty({ nullable: true, required: false })
  components?: string

  @Column(type => Access)
  @ApiProperty({ isArray: true, type: Access, nullable: true, required: false })
  access?: Access[]

  @Column(type => Access)
  @ApiProperty({ isArray: true, type: Access, nullable: true, required: false })
  submissionAccess?: Access[]
}

export const fakeForm = (): Form => {
  return {
    id: faker.random.uuid(),
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
