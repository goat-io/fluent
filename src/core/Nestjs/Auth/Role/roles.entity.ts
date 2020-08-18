import * as faker from 'faker'

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm'
import { Field, ID, ObjectType } from '@nestjs/graphql'

import { ApiProperty } from '@nestjs/swagger'
import { Collection } from 'fireorm'

// tslint:disable-next-line: max-classes-per-file
@Entity({ name: 'roles' })
@Collection()
@ObjectType()
export class Role {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  @Field(() => ID)
  id: string

  @Column({ nullable: true })
  @ApiProperty({ nullable: true, required: false })
  description?: string

  @Column({ nullable: false })
  @ApiProperty({ nullable: false, required: true })
  @Index({ unique: true })
  name: string

  @CreateDateColumn()
  @ApiProperty()
  created: Date

  @UpdateDateColumn()
  @ApiProperty()
  updated: Date

  @DeleteDateColumn()
  @ApiProperty()
  deleted: Date
}

export const fakeRole = (): Role => {
  return {
    id: faker.random.uuid(),
    description: faker.name.firstName(),
    name: faker.name.firstName(),
    created: faker.date.recent(),
    updated: faker.date.recent(),
    deleted: faker.date.recent()
  }
}
