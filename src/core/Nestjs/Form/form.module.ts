import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { FormController } from './form.controller'
import { Form } from './form.entity'
import { FormService } from './form.service'
import { Connection } from 'typeorm'
import { DatabaseModule } from '../Database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: 'FORM_REPOSITORY',
      useFactory: (connection: Connection) => connection.getRepository(Form),
      inject: ['SQLITE3']
    },
    FormService
  ],
  controllers: [FormController]
})
export class FormModule {}
