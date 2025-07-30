export interface ExtensionsMetadata {
  target: new (...args: any[]) => any
  value: Record<string, unknown>
}

export type ClassExtensionsMetadata = ExtensionsMetadata

export interface PropertyExtensionsMetadata extends ExtensionsMetadata {
  fieldName: string
}
