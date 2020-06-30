import { Field, HideField, ID, ObjectType } from '@nestjs/graphql'
import {
  Entity,
  Column,
  ObjectIdColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  ObjectID,
  Index,
  PrimaryColumn
} from 'typeorm'
import { ApiProperty, ApiHideProperty } from '@nestjs/swagger'
import { Collection } from 'fireorm'

@ObjectType()
@Entity({ name: 'users' })
@Collection()
export class User {
  @ApiProperty()
  @Field(() => ID)
  @Column({ type: 'string' })
  @ObjectIdColumn()
  @PrimaryColumn()
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
