import { ApiProperty } from '@nestjs/swagger'
import { Column } from 'typeorm'
import { InputType } from '@nestjs/graphql'
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class IPaginationMeta {
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
export class IPaginationLinks {
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
