import { ObjectType } from '@nestjs/graphql'
import { ApiProperty } from '@nestjs/swagger'
import { Column } from 'typeorm'

@ObjectType()
export class Access {
  @Column({ nullable: true })
  @ApiProperty()
  type?: string

  @Column({ nullable: true, type: 'simple-array' })
  @ApiProperty()
  roles?: string[]
}
