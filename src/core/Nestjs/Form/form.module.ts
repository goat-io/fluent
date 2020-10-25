import { FormController } from './form.controller'
import { FormService } from './form.service'
import { Module } from '@nestjs/common'

@Module({
  providers: [FormService],
  controllers: [FormController]
})
export class FormModule {}
