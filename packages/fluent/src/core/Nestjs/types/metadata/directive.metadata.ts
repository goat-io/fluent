export interface DirectiveMetadata {
  sdl: string
  target: new (...args: any[]) => any
}

export type ClassDirectiveMetadata = DirectiveMetadata

export interface PropertyDirectiveMetadata extends DirectiveMetadata {
  fieldName: string
}
