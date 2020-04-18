import { ReferenceObject, SecuritySchemeObject } from '@loopback/openapi-v3'

export const OPERATION_SECURITY_SPEC = [{ bearerAuth: [] }]

// tslint:disable-next-line: interface-over-type-literal
export type SecuritySchemeObjects = {
  [securityScheme: string]: SecuritySchemeObject | ReferenceObject
}

export const SECURITY_SCHEME_SPEC: SecuritySchemeObjects = {
  bearerAuth: {
    bearerFormat: 'JWT',
    scheme: 'bearer',
    type: 'http'
  }
}
