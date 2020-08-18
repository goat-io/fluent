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
import { FormService } from './form.service'
import { FormDtoOut, FormDtoIn } from './form.dto'
import { getModelSchemaRef } from '@loopback/rest'
import { Form as FormEntity } from './form.entity'
import to from 'await-to-js'
import { GoatFilter, GoatOutput } from 'Providers/types'
import { For } from '../../../Helpers/For'
import { getGoatFilterSchema } from '../../dtos/filterSchema'

@ApiTags('Forms')
@Controller('forms')
export class FormController {
  private forms: FormService['model']
  constructor(private readonly formRepository: FormService) {
    this.forms = this.formRepository.model
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
      'application/json': { schema: getModelSchemaRef(FormDtoOut) }
    },
    isArray: true,
    type: FormDtoOut
  })
  @ApiBody({
    description: 'Form',
    type: FormDtoIn
  })
  async create(
    @Body() form: FormDtoIn
  ): Promise<GoatOutput<FormDtoIn, FormDtoOut>> {
    const [error, response] = await to(this.forms.insert(form))

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
          items: getModelSchemaRef(FormDtoOut),
          type: 'array'
        }
      }
    },
    isArray: true,
    type: FormDtoOut
  })
  @ApiBody({
    description: 'Form',
    type: FormDtoIn
  })
  createMany(
    @Body() forms: FormDtoIn[]
  ): Promise<GoatOutput<FormDtoIn, FormDtoOut>[]> {
    return this.forms.insertMany(forms)
  }
  /**
   *
   */
  @Get()
  @ApiQuery({
    name: 'filter',
    required: false,
    type: 'object',
    schema: getGoatFilterSchema(FormEntity)
  })
  @ApiResponse({
    status: 200,
    description: 'The forms found',
    content: {
      'application/json': {
        schema: {
          items: getModelSchemaRef(FormDtoOut),
          type: 'array'
        }
      }
    },
    isArray: true,
    type: FormDtoOut
  })
  find(
    @Query('filter') filter: GoatFilter
  ): Promise<GoatOutput<FormDtoIn, FormDtoOut>[]> {
    return this.forms.find(filter)
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
    @Query('filter') filter?: Filter<FormDtoOut>
  ): Promise<FormDtoPaginated> {
    limit = limit > 100 ? 100 : limit
    return this.forms.paginate({
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
          items: getModelSchemaRef(FormDtoOut),
          type: 'array'
        }
      }
    },
    isArray: true,
    type: FormDtoOut
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async findById(
    @Param('id') id: string
  ): Promise<GoatOutput<FormDtoIn, FormDtoOut>> {
    const [error, result] = await For.async(this.forms.findById(id))

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
    type: FormDtoOut
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async deleteById(@Param('id') id: string): Promise<string> {
    const [error, result] = await For.async(this.forms.deleteById(id))

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
      'application/json': { schema: getModelSchemaRef(FormDtoOut) }
    },
    isArray: true,
    type: FormDtoOut
  })
  @ApiBody({
    description: 'Form',
    type: FormDtoIn
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async replaceById(
    @Param('id') id: string,
    @Body() form: FormDtoIn
  ): Promise<GoatOutput<FormDtoIn, FormDtoOut>> {
    const [error, result] = await For.async(this.forms.replaceById(id, form))

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
      'application/json': { schema: getModelSchemaRef(FormDtoOut) }
    },
    isArray: true,
    type: FormDtoOut
  })
  @ApiBody({
    description: 'Form',
    type: FormDtoIn
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: 'string'
  })
  async updateById(
    @Param('id') id: string,
    @Body() form: FormDtoIn
  ): Promise<GoatOutput<FormDtoIn, FormDtoOut>> {
    const [error, result] = await For.async(this.forms.replaceById(id, form))

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
