import {
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
import { RoleService } from './roles.service'
import { RoleDtoOut, RoleDtoIn } from './roles.dto'
import { getModelSchemaRef, SchemaObject } from '@loopback/rest'
import { Role as RoleEntity } from './roles.entity'
import to from 'await-to-js'
import { GoatFilter, GoatOutput } from 'Providers/types'
import { For } from '../../../../Helpers/For'
import { getGoatFilterSchema } from '../../../dtos/filterSchema'

@ApiTags('Roles')
@Controller('roles')
export class RoleController {
  private roles: RoleService['model']
  constructor(private readonly roleRepository: RoleService) {
    this.roles = this.roleRepository.model
  }
  /**
   *
   * @param role
   */
  @Post()
  @ApiResponse({
    status: 200,
    description: 'The created role',
    content: {
      'application/json': { schema: getModelSchemaRef(RoleDtoOut) }
    },
    isArray: true,
    type: RoleDtoOut
  })
  @ApiBody({
    description: 'Role',
    type: RoleDtoIn
  })
  async create(
    @Body() role: RoleDtoIn
  ): Promise<GoatOutput<RoleDtoIn, RoleDtoOut>> {
    const [error, response] = await to(this.roles.insert(role))

    if (error) {
      throw new BadRequestException(error)
    }

    return response
  }
  /**
   *
   * @param role
   */
  @Post('/createMany')
  @ApiResponse({
    status: 200,
    description: 'The created roles',
    content: {
      'application/json': {
        schema: {
          items: getModelSchemaRef(RoleDtoOut),
          type: 'array'
        }
      }
    },
    isArray: true,
    type: RoleDtoOut
  })
  @ApiBody({
    description: 'Role',
    type: RoleDtoIn
  })
  createMany(
    @Body() roles: RoleDtoIn[]
  ): Promise<GoatOutput<RoleDtoIn, RoleDtoOut>[]> {
    return this.roles.insertMany(roles)
  }
  /**
   *
   */
  @Get()
  @ApiQuery({
    name: 'filter',
    required: false,
    type: 'object',
    schema: getGoatFilterSchema(RoleEntity)
  })
  @ApiResponse({
    status: 200,
    description: 'The roles found',
    content: {
      'application/json': {
        schema: {
          items: getModelSchemaRef(RoleDtoOut),
          type: 'array'
        }
      }
    },
    isArray: true,
    type: RoleDtoOut
  })
  find(
    @Query('filter') filter: GoatFilter
  ): Promise<GoatOutput<RoleDtoIn, RoleDtoOut>[]> {
    return this.roles.find(filter)
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
    schema: getFilterSchemaFor(Role)
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
    description: 'The roles found',
    content: {
      'application/json': {
        schema: {
          items: getModelSchemaRef(RoleDtoPaginated)
        }
      }
    },
    type: RoleDtoPaginated
  })
  findPaginated(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('filter') filter?: Filter<RoleDtoOut>
  ): Promise<RoleDtoPaginated> {
    limit = limit > 100 ? 100 : limit
    return this.roles.paginate({
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
    description: 'The roles found',
    content: {
      'application/json': {
        schema: {
          items: getModelSchemaRef(RoleDtoOut),
          type: 'array'
        }
      }
    },
    isArray: true,
    type: RoleDtoOut
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async findById(
    @Param('id') id: string
  ): Promise<GoatOutput<RoleDtoIn, RoleDtoOut>> {
    const [error, result] = await For.async(this.roles.findById(id))

    if (error) {
      throw new NotFoundException(error)
    }

    return result
  }

  @Delete(':id')
  @ApiResponse({
    status: 200,
    description: 'The roles found',
    content: {
      'application/json': {
        schema: {
          type: 'string'
        }
      }
    },
    isArray: true,
    type: RoleDtoOut
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async deleteById(@Param('id') id: string): Promise<string> {
    const [error, result] = await For.async(this.roles.deleteById(id))

    if (error) {
      throw new NotFoundException(error)
    }

    return result
  }
  /**
   *
   * @param id
   * @param role
   */
  @Put(':id')
  @ApiResponse({
    status: 200,
    description: 'The created role',
    content: {
      'application/json': { schema: getModelSchemaRef(RoleDtoOut) }
    },
    isArray: true,
    type: RoleDtoOut
  })
  @ApiBody({
    description: 'Role',
    type: RoleDtoIn
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async replaceById(
    @Param('id') id: string,
    @Body() role: RoleDtoIn
  ): Promise<GoatOutput<RoleDtoIn, RoleDtoOut>> {
    const [error, result] = await For.async(this.roles.replaceById(id, role))

    if (error) {
      throw new NotFoundException(error)
    }

    return result
  }
  /**
   *
   * @param id
   * @param role
   */
  @Patch(':id')
  @ApiResponse({
    status: 200,
    description: 'The created role',
    content: {
      'application/json': { schema: getModelSchemaRef(RoleDtoOut) }
    },
    isArray: true,
    type: RoleDtoOut
  })
  @ApiBody({
    description: 'Role',
    type: RoleDtoIn
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async updateById(
    @Param('id') id: string,
    @Body() role: RoleDtoIn
  ): Promise<GoatOutput<RoleDtoIn, RoleDtoOut>> {
    const [error, result] = await For.async(this.roles.replaceById(id, role))

    if (error) {
      throw new NotFoundException(error)
    }

    return result
  }
}

/*
replaceById
updateWhere
countWhere
*/
