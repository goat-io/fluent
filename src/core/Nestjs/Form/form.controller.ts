import {
  Get,
  Controller,
  Param,
  Post,
  Body,
  Query,
  HttpException,
  HttpStatus,
  BadRequestException
} from '@nestjs/common'
import { ApiTags, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger'
import { FormService } from './form.service'
import { Form } from '../../Loopback/Form/form.model'
import { FormDtoOut, FormDtoIn, FormDtoPaginated } from './form.dto'
import { getModelSchemaRef, getFilterSchemaFor } from '@loopback/rest'
import { Filter } from '@loopback/repository'
import { GoatOutput } from '../../../BaseConnector'
import to from 'await-to-js'

@ApiTags('Forms')
@Controller('form')
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
    schema: {
      ...getFilterSchemaFor(Form),
      ...{
        type: 'object'
      }
    }
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
    @Query() filter: Filter<GoatOutput<FormDtoIn, FormDtoOut>>
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
  @Get(':path')
  @ApiResponse({
    status: 200,
    description: 'The form found',
    type: FormDtoOut
  })
  getFormByPath(
    @Param() params: any
  ): Promise<GoatOutput<FormDtoIn, FormDtoOut>> {
    return this.forms.where(this.forms._keys.path, '=', params.path).first()
  }
}
