import { ApiProperty, InputType, Column } from '../types'

// tslint:disable-next-line: max-classes-per-file
@InputType()
export class PaginationMeta {
  @Column('number')
  @ApiProperty()
  itemCount: number

  @Column('number')
  @ApiProperty()
  totalItems: number

  @Column('number')
  @ApiProperty()
  itemsPerPage: number

  @Column('number')
  @ApiProperty()
  totalPages: number

  @Column('number')
  @ApiProperty()
  currentPage: number
}

// tslint:disable-next-line: max-classes-per-file
@InputType()
export class PaginationLinks {
  @Column('text')
  @ApiProperty()
  first?: string

  @Column('text')
  @ApiProperty()
  previous?: string

  @Column('text')
  @ApiProperty()
  next?: string

  @Column('text')
  @ApiProperty()
  last?: string
}
