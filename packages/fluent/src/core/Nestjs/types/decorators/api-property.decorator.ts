import { SchemaObjectMetadata } from '../interfaces/schema-object-metadata.interface'
import { getEnumType, getEnumValues } from '../utils/enum.utils'
import {
  createPropertyDecorator,
  getTypeIsArrayTuple
} from './create-property.decorator'

export const DECORATORS_PREFIX = 'swagger'
export const DECORATORS = {
  API_OPERATION: `${DECORATORS_PREFIX}/apiOperation`,
  API_RESPONSE: `${DECORATORS_PREFIX}/apiResponse`,
  API_PRODUCES: `${DECORATORS_PREFIX}/apiProduces`,
  API_CONSUMES: `${DECORATORS_PREFIX}/apiConsumes`,
  API_TAGS: `${DECORATORS_PREFIX}/apiUseTags`,
  API_PARAMETERS: `${DECORATORS_PREFIX}/apiParameters`,
  API_HEADERS: `${DECORATORS_PREFIX}/apiHeaders`,
  API_MODEL_PROPERTIES: `${DECORATORS_PREFIX}/apiModelProperties`,
  API_MODEL_PROPERTIES_ARRAY: `${DECORATORS_PREFIX}/apiModelPropertiesArray`,
  API_SECURITY: `${DECORATORS_PREFIX}/apiSecurity`,
  API_EXCLUDE_ENDPOINT: `${DECORATORS_PREFIX}/apiExcludeEndpoint`,
  API_EXCLUDE_CONTROLLER: `${DECORATORS_PREFIX}/apiExcludeController`,
  API_EXTRA_MODELS: `${DECORATORS_PREFIX}/apiExtraModels`,
  API_EXTENSION: `${DECORATORS_PREFIX}/apiExtension`
}

export interface ApiPropertyOptions
  extends Omit<SchemaObjectMetadata, 'name' | 'enum'> {
  name?: string
  enum?: any[] | Record<string, any>
  enumName?: string
}

const isEnumArray = (obj: ApiPropertyOptions): boolean =>
  obj.isArray && !!obj.enum

export function ApiProperty(
  options: ApiPropertyOptions = {}
): PropertyDecorator {
  return createApiPropertyDecorator(options)
}

export function createApiPropertyDecorator(
  options: ApiPropertyOptions = {},
  overrideExisting = true
): PropertyDecorator {
  const [type, isArray] = getTypeIsArrayTuple(options.type, options.isArray)
  options = {
    ...options,
    type,
    isArray
  }

  if (isEnumArray(options)) {
    options.type = 'array'

    const enumValues = getEnumValues(options.enum)
    options.items = {
      type: getEnumType(enumValues),
      enum: enumValues
    }
    delete options.enum
  } else if (options.enum) {
    const enumValues = getEnumValues(options.enum)

    options.enum = enumValues
    options.type = getEnumType(enumValues)
  }

  return createPropertyDecorator(
    DECORATORS.API_MODEL_PROPERTIES,
    options,
    overrideExisting
  )
}

export function ApiPropertyOptional(
  options: ApiPropertyOptions = {}
): PropertyDecorator {
  return ApiProperty({
    ...options,
    required: false
  })
}

export function ApiResponseProperty(
  options: Pick<
    ApiPropertyOptions,
    'type' | 'example' | 'format' | 'enum' | 'deprecated'
  > = {}
): PropertyDecorator {
  return ApiProperty({
    readOnly: true,
    ...options
  })
}