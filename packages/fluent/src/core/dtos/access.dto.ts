import { ApiProperty, ObjectType, Column } from '../types'

@ObjectType()
export class Access {
  @Column({ nullable: true })
  @ApiProperty()
  type?: string

  @Column({ nullable: true, type: 'simple-array' })
  @ApiProperty()
  roles?: string[]
}