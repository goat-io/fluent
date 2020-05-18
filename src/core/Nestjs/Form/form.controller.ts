import { Get, Controller, Param, Post, Body } from '@nestjs/common'
import { ApiTags, ApiResponse, ApiBody } from '@nestjs/swagger'
import { FormService } from './form.service'
import { Form } from './form.entity'
import { FormDtoOut, FormDtoIn } from './form.dto'
import { getModelSchemaRef } from '@loopback/rest'
import { Filter } from '@loopback/repository'

@ApiTags('Forms')
@Controller('form')
export class FormController {
  constructor(private readonly forms: FormService) {}
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
  create(@Body() form: FormDtoIn): Promise<FormDtoOut> {
    return this.forms.create(form)
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
  createMany(@Body() forms: FormDtoIn[]): Promise<FormDtoOut[]> {
    return this.forms.createMany(forms)
  }
  /**
   *
   */
  @Get()
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
  find(@Param('filter') filter?: Filter<FormDtoOut>): Promise<FormDtoOut[]> {
    return this.forms.findAll()
  }

  @Get(':path')
  @ApiResponse({
    status: 200,
    description: 'The form found',
    type: FormDtoOut
  })
  getFormByPath(@Param() params: any): Promise<FormDtoOut> {
    return this.forms.findByPath(params.path)
  }
}
