import {
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  UpdateDateColumn,
  VersionColumn
} from 'typeorm'

import { ApiProperty } from '@nestjs/swagger'
import { Collection } from 'fireorm'
import { Decorators } from '../../Database/decorators'
import { ObjectType } from '@nestjs/graphql'

@ObjectType()
@Entity({ name: 'users' })
@Collection()
export class User {
  @Decorators.id()
  id: string

  @Decorators.property({ required: true, unique: true })
  email: string

  @Decorators.property({ required: false, hidden: true })
  password?: string

  @Decorators.property({ required: false })
  firstName?: string

  @Decorators.property({ required: false })
  lastName?: string

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
}
