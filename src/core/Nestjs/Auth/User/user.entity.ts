import { ApiHideProperty, ApiProperty } from '@nestjs/swagger'
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  UpdateDateColumn,
  VersionColumn
} from 'typeorm'
import { HideField, ObjectType } from '@nestjs/graphql'

import { Collection } from 'fireorm'
import { Decorators } from '../../Database/decorators'

@ObjectType()
@Entity({ name: 'users' })
@Collection()
export class User {
  @Decorators.id()
  _id: string

  @Column({ nullable: false })
  @ApiProperty({
    nullable: false,
    required: true
  })
  @Index({ unique: true })
  email: string

  @HideField()
  @Column({ select: false })
  @ApiProperty({
    nullable: true,
    required: false
  })
  @ApiHideProperty()
  password?: string

  @Column({ nullable: true })
  @ApiProperty({
    nullable: true,
    required: false
  })
  firstName?: string

  @Column({ nullable: true })
  @ApiProperty({
    nullable: true,
    required: false
  })
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
