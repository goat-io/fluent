import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ObjectIdColumn
} from 'typeorm'
import { Field, ID, ObjectType } from '@nestjs/graphql'
import { ApiProperty } from '@nestjs/swagger'

@ObjectType()
export class Breed {
  @Column({ nullable: true })
  @ApiProperty()
  family?: string

  @Column({ nullable: true })
  @ApiProperty()
  members?: number
}

// tslint:disable-next-line: max-classes-per-file
@Entity()
@ObjectType()
export class GoatEntity {
  @PrimaryGeneratedColumn('uuid')
  @ObjectIdColumn()
  @ApiProperty()
  @Field(() => ID)
  _id: string

  @Column()
  @Index()
  @ApiProperty()
  name: string

  @Column('int')
  @ApiProperty()
  age: number

  @Column(type => Breed)
  @ApiProperty({ type: Breed })
  breed?: Breed
}
