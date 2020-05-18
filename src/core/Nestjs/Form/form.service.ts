import { Injectable, Inject } from '@nestjs/common'
import { Repository } from 'typeorm'
import { Form } from './form.entity'
import { FormDtoIn, FormDtoOut } from './form.dto'

@Injectable()
export class FormService {
  constructor(
    @Inject('FORM_REPOSITORY')
    private forms: Repository<Form>
  ) {}
  /**
   *
   * @param form
   */
  async create(form: FormDtoIn): Promise<FormDtoOut> {
    return this.forms.create(form)
  }
  /**
   *
   * @param form
   */
  async createMany(forms: FormDtoIn[]): Promise<FormDtoOut[]> {
    return this.forms.save(forms, { chunk: forms.length / 1000 })
  }
  /**
   *
   */
  async findAll(): Promise<Form[]> {
    return this.forms.find()
  }
  /**
   *
   * @param name
   */
  async findByPath(name: string): Promise<Form> {
    const result = await this.forms.find({ path: name })
    return result[0]
  }
}
