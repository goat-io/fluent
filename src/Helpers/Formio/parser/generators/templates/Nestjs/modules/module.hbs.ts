export const template = `import { Module } from '@nestjs/common'
import { {{_Model.name}} } from './{{_Model.name}}.controller'
import { {{_Model.name}}Service } from './{{_Model.name}}.service'
import { Connection } from 'typeorm'
import { {{_Model.name}}Entity } from './{{_Model.name}}.entity'
import { DatabaseModule } from '../Database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: '{{_Model.name}}_REPOSITORY',
      useFactory: (connection: Connection) =>
        connection.getRepository({{_Model.name}}Entity),
      inject: ['MAIN_DATABASE'],
    },
    {
      provide: '{{_Model.name}}Out_REPOSITORY',
      useFactory: (connection: Connection) =>
        connection.getRepository({{_Model.name}}Entity),
      inject: ['MAIN_DATABASE'],
    },
    {{_Model.name}}Service,
  ],
  controllers: [{{_Model.name}}],
})
export class {{_Model.name}}Module {}`
