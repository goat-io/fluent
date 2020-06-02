export const template = `import {
  Get,
  Controller,
  Param,
  Post,
  Body,
  Query,
  BadRequestException,
  NotFoundException,
  Delete,
  Put,
  Patch
} from '@nestjs/common'
import {
  ApiTags,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiParam
} from '@nestjs/swagger'
import { {{_Model.name}}Service } from '../{{_Model.name}}.service'
import { {{_Model.name}}DtoOut, {{_Model.name}}DtoIn} from '../{{_Model.name}}.dto'
import { getModelSchemaRef, SchemaObject } from '@loopback/rest'
import { {{_Model.name}}Entity } from '../{{_Model.name}}.entity'
import to from 'await-to-js'
import { GoatFilter, GoatOutput } from '@goatlab/fluent/dist/Providers/types'
import { For } from '@goatlab/fluent/dist/Helpers/For'
import { getGoatFilterSchema } from '@goatlab/fluent/dist/core/dtos/filterSchema'


@ApiTags('{{_Model.name}}')
@Controller('{{_Model.name}}')
export class {{_Model.name}}BaseController {
  private {{_Model.name}}: {{_Model.name}}Service['model']
  constructor(private readonly {{_Model.name}}Repository: {{_Model.name}}Service) {
    this.{{_Model.name}} = this.{{_Model.name}}Repository.model
  }

    /**
   *
   * @param form
   */
  @Post()
  @ApiResponse({
    status: 200,
    description: 'The created {{_Model.name}}',
    content: {
      'application/json': { schema: getModelSchemaRef({{_Model.name}}DtoOut) }
    },
    isArray: true,
    type: {{_Model.name}}DtoOut
  })
  @ApiBody({
    description: '{{_Model.name}}',
    type: {{_Model.name}}DtoIn
  })
  async create(
    @Body() {{_Model.name}}: {{_Model.name}}DtoIn
  ): Promise<GoatOutput<{{_Model.name}}DtoIn, {{_Model.name}}DtoOut>> {
    const [error, response] = await to(this.{{_Model.name}}.insert({{_Model.name}}))

    if (error) {
      throw new BadRequestException(error)
    }

    return response
  }
  /**
   *
   * @param form
   */
  @Post('/createMany')
  @ApiResponse({
    status: 200,
    description: 'The created {{_Model.name}}',
    content: {
      'application/json': {
        schema: {
          items: getModelSchemaRef({{_Model.name}}DtoOut),
          type: 'array'
        }
      }
    },
    isArray: true,
    type: {{_Model.name}}DtoOut
  })
  @ApiBody({
    description: 'Form',
    type: {{_Model.name}}DtoIn
  })
  createMany(
    @Body() {{_Model.name}}: {{_Model.name}}DtoIn[]
  ): Promise<GoatOutput<{{_Model.name}}DtoIn, {{_Model.name}}DtoOut>[]> {
    return this.{{_Model.name}}.insertMany({{_Model.name}})
  }
  /**
   *
   */
  @Get()
  @ApiQuery({
    name: 'filter',
    required: false,
    type: 'object',
    schema: getGoatFilterSchema({{_Model.name}}Entity)
  })
  @ApiResponse({
    status: 200,
    description: 'The {{_Model.name}} found',
    content: {
      'application/json': {
        schema: {
          items: getModelSchemaRef({{_Model.name}}DtoOut),
          type: 'array'
        }
      }
    },
    isArray: true,
    type: {{_Model.name}}DtoOut
  })
  find(
    @Query('filter') filter: GoatFilter
  ): Promise<GoatOutput<{{_Model.name}}DtoIn, {{_Model.name}}DtoOut>[]> {
    return this.{{_Model.name}}.find(filter)
  }

  /**
   *
   */
  /*
  @Get('/paginated')
  @ApiQuery({
    type: 'object',
    required: false,
    name: 'filter',
    schema: getFilterSchemaFor({{_Model.name}}Entity)
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: 'number'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number'
  })
  @ApiResponse({
    status: 200,
    description: 'The forms found',
    content: {
      'application/json': {
        schema: {
          items: getModelSchemaRef({{_Model.name}}DtoPaginated)
        }
      }
    },
    type: {{_Model.name}}DtoPaginated
  })
  findPaginated(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('filter') filter?: Filter<{{_Model.name}}DtoOut>
  ): Promise<{{_Model.name}}DtoPaginated> {
    limit = limit > 100 ? 100 : limit
    return this.{{_Model.name}}.paginate({
      page,
      limit
    })
  }
  */
  /**
   *
   * @param filter
   */
  @Get(':id')
  @ApiResponse({
    status: 200,
    description: 'The {{_Model.name}} found',
    content: {
      'application/json': {
        schema: {
          items: getModelSchemaRef({{_Model.name}}DtoOut),
          type: 'array'
        }
      }
    },
    isArray: true,
    type: {{_Model.name}}DtoOut
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async findById(
    @Param('id') id: string
  ): Promise<GoatOutput<{{_Model.name}}DtoIn, {{_Model.name}}DtoOut>> {
    const [error, result] = await For.async(this.{{_Model.name}}.findById(id))

    if (error) {
      throw new NotFoundException(error)
    }

    return result
  }

  @Delete(':id')
  @ApiResponse({
    status: 200,
    description: 'The {{_Model.name}} found',
    content: {
      'application/json': {
        schema: {
          type: 'string'
        }
      }
    },
    isArray: true,
    type: {{_Model.name}}DtoOut
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async deleteById(@Param('id') id: string): Promise<string> {
    const [error, result] = await For.async(this.{{_Model.name}}.deleteById(id))

    if (error) {
      throw new NotFoundException(error)
    }

    return result
  }
  /**
   *
   * @param id
   * @param form
   */
  @Put(':id')
  @ApiResponse({
    status: 200,
    description: 'The created {{_Model.name}}',
    content: {
      'application/json': { schema: getModelSchemaRef({{_Model.name}}DtoOut) }
    },
    isArray: true,
    type: {{_Model.name}}DtoOut
  })
  @ApiBody({
    description: '{{_Model.name}}',
    type: {{_Model.name}}DtoIn
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async replaceById(
    @Param('id') id: string,
    @Body() form: {{_Model.name}}DtoIn
  ): Promise<GoatOutput<{{_Model.name}}DtoIn, {{_Model.name}}DtoOut>> {
    const [error, result] = await For.async(this.{{_Model.name}}.replaceById(id, form))

    if (error) {
      throw new NotFoundException(error)
    }

    return result
  }
  /**
   *
   * @param id
   * @param form
   */
  @Patch(':id')
  @ApiResponse({
    status: 200,
    description: 'The created {{_Model.name}}',
    content: {
      'application/json': { schema: getModelSchemaRef({{_Model.name}}DtoOut) }
    },
    isArray: true,
    type: {{_Model.name}}DtoOut
  })
  @ApiBody({
    description: '{{_Model.name}}',
    type: {{_Model.name}}DtoIn
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async updateById(
    @Param('id') id: string,
    @Body() form: {{_Model.name}}DtoIn
  ): Promise<GoatOutput<{{_Model.name}}DtoIn, {{_Model.name}}DtoOut>> {
    const [error, result] = await For.async(this.{{_Model.name}}.updateById(id, form))

    if (error) {
      throw new NotFoundException(error)
    }

    return result
  }
  
}`
