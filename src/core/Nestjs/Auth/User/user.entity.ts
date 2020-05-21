import { Field, HideField, ID, ObjectType } from '@nestjs/graphql'
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

@ObjectType()
@Entity()
export class User {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  _id!: string

  @Column({ unique: true })
  email: string

  @HideField()
  @Column('text')
  password: string

  @Column('text')
  firstName?: string

  @Column('text')
  lastName?: string
}
