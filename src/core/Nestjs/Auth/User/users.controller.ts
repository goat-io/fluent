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
import { UsersService } from './users.service'
import { UserDtoOut, UserDtoIn } from './users.dto'
import { getModelSchemaRef } from '@loopback/rest'
import { User as UserEntity } from './user.entity'
import to from 'await-to-js'
import { GoatFilter, GoatOutput } from 'Providers/types'
import { For } from '../../../../Helpers/For'
import { getGoatFilterSchema } from '../../../dtos/filterSchema'

@ApiTags('Users')
@Controller('users')
export class UserController {
  private users: UsersService['model']
  constructor(private readonly userRepository: UsersService) {
    this.users = this.userRepository.model
  }
  /**
   *
   * @param form
   */
  @Post()
  @ApiResponse({
    status: 200,
    description: 'The created form',
    content: {
      'application/json': { schema: getModelSchemaRef(UserDtoOut) }
    },
    isArray: true,
    type: UserDtoOut
  })
  @ApiBody({
    description: 'Form',
    type: UserDtoIn
  })
  async create(
    @Body() form: UserDtoIn
  ): Promise<GoatOutput<UserDtoIn, UserDtoOut>> {
    const [error, response] = await to(this.users.insert(form))

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
    description: 'The created forms',
    content: {
      'application/json': {
        schema: {
          items: getModelSchemaRef(UserDtoOut),
          type: 'array'
        }
      }
    },
    isArray: true,
    type: UserDtoOut
  })
  @ApiBody({
    description: 'Form',
    type: UserDtoIn
  })
  createMany(
    @Body() forms: UserDtoIn[]
  ): Promise<GoatOutput<UserDtoIn, UserDtoOut>[]> {
    return this.users.insertMany(forms)
  }
  /**
   *
   */
  @Get()
  @ApiQuery({
    name: 'filter',
    required: false,
    type: 'object',
    schema: getGoatFilterSchema(UserEntity)
  })
  @ApiResponse({
    status: 200,
    description: 'The forms found',
    content: {
      'application/json': {
        schema: {
          items: getModelSchemaRef(UserDtoOut),
          type: 'array'
        }
      }
    },
    isArray: true,
    type: UserDtoOut
  })
  find(
    @Query('filter') filter: GoatFilter
  ): Promise<GoatOutput<UserDtoIn, UserDtoOut>[]> {
    return this.users.find(filter)
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
    schema: getFilterSchemaFor(Form)
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
          items: getModelSchemaRef(FormDtoPaginated)
        }
      }
    },
    type: FormDtoPaginated
  })
  findPaginated(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('filter') filter?: Filter<UserDtoOut>
  ): Promise<FormDtoPaginated> {
    limit = limit > 100 ? 100 : limit
    return this.users.paginate({
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
    description: 'The forms found',
    content: {
      'application/json': {
        schema: {
          items: getModelSchemaRef(UserDtoOut),
          type: 'array'
        }
      }
    },
    isArray: true,
    type: UserDtoOut
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async findById(
    @Param('id') id: string
  ): Promise<GoatOutput<UserDtoIn, UserDtoOut>> {
    const [error, result] = await For.async(this.users.findById(id))

    if (error) {
      throw new NotFoundException(error)
    }

    return result
  }

  @Delete(':id')
  @ApiResponse({
    status: 200,
    description: 'The forms found',
    content: {
      'application/json': {
        schema: {
          type: 'string'
        }
      }
    },
    isArray: true,
    type: UserDtoOut
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async deleteById(@Param('id') id: string): Promise<string> {
    const [error, result] = await For.async(this.users.deleteById(id))

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
    description: 'The created form',
    content: {
      'application/json': { schema: getModelSchemaRef(UserDtoOut) }
    },
    isArray: true,
    type: UserDtoOut
  })
  @ApiBody({
    description: 'Form',
    type: UserDtoIn
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async replaceById(
    @Param('id') id: string,
    @Body() form: UserDtoIn
  ): Promise<GoatOutput<UserDtoIn, UserDtoOut>> {
    const [error, result] = await For.async(this.users.replaceById(id, form))

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
    description: 'The created form',
    content: {
      'application/json': { schema: getModelSchemaRef(UserDtoOut) }
    },
    isArray: true,
    type: UserDtoOut
  })
  @ApiBody({
    description: 'Form',
    type: UserDtoIn
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async updateById(
    @Param('id') id: string,
    @Body() form: UserDtoIn
  ): Promise<GoatOutput<UserDtoIn, UserDtoOut>> {
    const [error, result] = await For.async(this.users.replaceById(id, form))

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
