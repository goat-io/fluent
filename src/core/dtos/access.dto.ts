import { ApiProperty, ObjectType, Column } from '../../core/types'

@ObjectType()
export class Access {
  @Column({ nullable: true })
  @ApiProperty()
  type?: string

  @Column({ nullable: true, type: 'simple-array' })
  @ApiProperty()
  roles?: string[]
}
