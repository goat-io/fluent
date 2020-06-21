import { Field, HideField, ID, ObjectType } from '@nestjs/graphql'
import {
  Entity,
  Column,
  ObjectIdColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn
} from 'typeorm'
import { ApiProperty } from '@nestjs/swagger'

@ObjectType()
@Entity()
export class User {
  @ObjectIdColumn()
  @ApiProperty()
  @Field(() => ID)
  id: string

  @Column({ unique: true, nullable: false, type: 'string' })
  @ApiProperty({
    nullable: false,
    required: true
  })
  email: string

  @HideField()
  @Column({ nullable: false, type: 'string' })
  password: string

  @Column({ nullable: true, type: 'string' })
  @ApiProperty({
    nullable: true,
    required: false
  })
  firstName?: string

  @Column({ nullable: true, type: 'string' })
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
