import { FindByIdFilter, FluentQuery, QueryOutput } from './types'

export interface FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO> {
  // CREATE
  insert(data: InputDTO): Promise<OutputDTO>
  insertMany(data: InputDTO[]): Promise<OutputDTO[]>

  // READ
  /// Id
  findById<T extends FindByIdFilter<ModelDTO>>(
    id: string,
    q?: T
  ): Promise<QueryOutput<T, ModelDTO> | null>

  findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T
  ): Promise<QueryOutput<T, ModelDTO>[]>

  /// Find
  findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>[]>
  findFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO> | null>

  /// Require
  requireById(
    id: string,
    q?: FindByIdFilter<ModelDTO>
  ): Promise<QueryOutput<FindByIdFilter<ModelDTO>, ModelDTO>>
  requireFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>>

  // Update
  updateById(id: string, data: InputDTO): Promise<OutputDTO>
  replaceById(id: string, data: InputDTO): Promise<OutputDTO>
  // updateMany<T extends FluentQuery<ModelDTO>['where']>(
  //   where: FluentQuery<T>['where'],
  //   data: InputDTO
  // ): Promise<OutputDTO>
  // replaceMany<T extends FluentQuery<ModelDTO>['where']>(
  //   where: FluentQuery<T>['where'],
  //   data: InputDTO
  // ): Promise<OutputDTO>

  //DELETE
  deleteById(id: string): Promise<string>
  // deleteMany<T extends FluentQuery<ModelDTO>['where']>(
  //   where: FluentQuery<T>['where']
  // ): Promise<string[]>
  // clear(): Promise<boolean>

  // Relations
  loadFirst(query?: FluentQuery<ModelDTO>)
  loadById(id: string)
  // clone()

  raw(): any
  // softDelete(): Promise<T>
}
