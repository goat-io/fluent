import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm'
import { ApiProperty } from '@nestjs/swagger'
import { Field, ID, ObjectType } from '@nestjs/graphql'

@Entity()
@ObjectType()
export class Access {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  @Field(() => ID)
  _id: string

  @Column()
  @ApiProperty()
  type?: string

  @Column('simple-array')
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
  @Index()
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

  @Column()
  @ApiProperty()
  created: string

  @Column()
  @ApiProperty()
  deleted?: number

  @Column()
  @ApiProperty()
  modified: string

  @Column()
  @ApiProperty()
  components?: string

  @Column(type => Access)
  @ApiProperty({ isArray: true, type: Access })
  access?: Access[]

  @Column(type => Access)
  @ApiProperty({ isArray: true, type: Access })
  submissionAccess?: Access[]
}
