import { intercept } from '@loopback/core'
import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where
} from '@loopback/repository'
import {
  del,
  get,
  getFilterSchemaFor,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  put,
  requestBody
} from '@loopback/rest'
import { Form as FormModel } from './form.model'
import { FormRepository } from './form.repository'
import { validateForm } from './form.validation'

const openAPITag: string = 'Forms'

export class Form {
  constructor(
    @repository(FormRepository)
    public formRepository: FormRepository
  ) {}
  /*
   * /POST/
   * Creates a new Form
   */
  @intercept(validateForm)
  @post('/forms', {
    responses: {
      '200': {
        content: {
          'application/json': { schema: getModelSchemaRef(FormModel) }
        },
        description: 'Form model instance'
      }
    },
    tags: [openAPITag]
  })
  public async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(FormModel, {
            exclude: ['id'],
            title: 'NewForm'
          })
        }
      }
    })
    form: Omit<FormModel, 'id'>
  ): Promise<FormModel> {
    return this.formRepository.create(form)
  }
  /*
   * /POST/
   * Creates many new Forms
   */
  @intercept(validateForm)
  @post('/forms/createMany', {
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              items: getModelSchemaRef(FormModel),
              type: 'array'
            }
          }
        },
        description: 'Array of Form model instance'
      }
    },
    tags: [openAPITag]
  })
  public async createMany(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            items: getModelSchemaRef(FormModel),
            type: 'array'
          }
        }
      }
    })
    form: FormModel[]
  ): Promise<FormModel[]> {
    return this.formRepository.createAll(form)
  }
  /*
   * /PUT/
   * Replace a Form by id
   */
  @intercept(validateForm)
  @put('/forms/{id}', {
    responses: {
      '204': {
        description: 'Form PUT success'
      }
    },
    tags: [openAPITag]
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() form: FormModel
  ): Promise<void> {
    await this.formRepository.replaceById(id, form)
  }
  /*
   * /PATCH/
   * Update a Form by id
   */
  @intercept(validateForm)
  @patch('/forms/{id}', {
    responses: {
      '204': {
        description: 'Form PATCH success'
      }
    },
    tags: [openAPITag]
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody() form: FormModel
  ): Promise<void> {
    await this.formRepository.replaceById(id, form)
  }
  /*
   * /PATCH/
   * Update Forms matching WHERE
   */
  @intercept(validateForm)
  @patch('/forms', {
    responses: {
      '200': {
        description: 'Form PATCH success count',
        content: { 'application/json': { schema: CountSchema } }
      }
    },
    tags: [openAPITag]
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(FormModel, { partial: true })
        }
      }
    })
    form: FormModel,
    @param.query.object('where', getWhereSchemaFor(FormModel))
    where?: Where<FormModel>
  ): Promise<Count> {
    return this.formRepository.updateAll(form, where)
  }
  /*
   * /GET/
   * Gets the count of Forms WHERE
   */
  @get('/forms/count', {
    responses: {
      '200': {
        description: 'Form model count',
        content: { 'application/json': { schema: CountSchema } }
      }
    },
    tags: [openAPITag]
  })
  async count(
    @param.query.object('where', getWhereSchemaFor(FormModel))
    where?: Where<FormModel>
  ): Promise<Count> {
    return this.formRepository.count(where)
  }
  /*
   * /GET/
   * Get the forms with Filter
   */
  @get('/forms', {
    responses: {
      '200': {
        description: 'Array of Form model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(FormModel, {
                includeRelations: true
              })
            }
          }
        }
      }
    },
    tags: [openAPITag]
  })
  async find(
    @param.query.object('filter', getFilterSchemaFor(FormModel))
    filter?: Filter<FormModel>
  ): Promise<FormModel[]> {
    return this.formRepository.find(filter)
  }
  /*
   * /GET/
   * Gets a specific Form by id
   */
  @get('/forms/{id}', {
    responses: {
      '200': {
        description: 'Form model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(FormModel, {
              includeRelations: true
            })
          }
        }
      }
    },
    tags: [openAPITag]
  })
  async findById(
    @param.path.string('id') id: string,
    @param.query.object('filter', getFilterSchemaFor(FormModel))
    filter?: Filter<FormModel>
  ): Promise<FormModel> {
    return this.formRepository.findById(id, filter)
  }
  /*
   * /DELETE/
   * Deletes a form by id
   */
  @del('/forms/{id}', {
    responses: {
      '204': {
        description: 'Form DELETE success'
      }
    },
    tags: [openAPITag]
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.formRepository.deleteById(id)
  }
}
