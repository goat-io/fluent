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

  @Column('text')
  @ApiProperty()
  type?: string

  @Column('simple-array')
  @ApiProperty()
  roles?: string[]
}

// tslint:disable-next-line: max-classes-per-file
@Entity()
export class Form {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  @Field(() => ID)
  _id: string

  @Column('text')
  @Index()
  @ApiProperty()
  path: string

  @Column('text')
  @ApiProperty()
  title?: string

  @Column('text')
  @ApiProperty()
  name?: string

  @Column('text')
  @ApiProperty()
  type?: string

  @Column('text')
  @ApiProperty()
  description?: string

  @Column('simple-array')
  @ApiProperty({ type: [String] })
  tags?: string[]

  @Column('text')
  @ApiProperty()
  display?: string

  @Column('text')
  @ApiProperty()
  action?: string

  @Column('text')
  @ApiProperty()
  owner: string

  @Column('text')
  @ApiProperty()
  settings: number

  @Column('int')
  @ApiProperty()
  properties: number

  @Column('text')
  @ApiProperty()
  machineName: string

  @Column('text')
  @ApiProperty()
  created: string

  @Column('text')
  @ApiProperty()
  deleted?: number

  @Column('text')
  @ApiProperty()
  modified: string

  @Column('text')
  @ApiProperty()
  components?: string

  @Column(type => Access)
  @ApiProperty({ isArray: true, type: Access })
  access?: Access[]

  @Column(type => Access)
  @ApiProperty({ isArray: true, type: Access })
  submissionAccess?: Access[]
}
