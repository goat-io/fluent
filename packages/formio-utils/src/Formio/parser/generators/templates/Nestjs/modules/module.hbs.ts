export const template = `import { Module } from '@nestjs/common'
import { {{_Model.name}} } from './{{_Model.name}}.controller'
import { {{_Model.name}}Service } from './{{_Model.name}}.service'
import { createRepository } from '@goatlab/fluent/dist/core/Nestjs/Database/createRepository'
import { {{_Model.name}}Entity } from './{{_Model.name}}.entity'
import { DatabaseModule } from '../Database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [
    createRepository({
      connectionName: 'MAIN_DATABASE',
      repositoryName: '{{_Model.name}}_REPOSITORY',
      entity: {{_Model.name}}Entity,
    }),
    createRepository({
      connectionName: 'MAIN_DATABASE',
      repositoryName: '{{_Model.name}}Out_REPOSITORY',
      entity: {{_Model.name}}Entity,
    }),
    {{_Model.name}}Service,
  ],
  controllers: [{{_Model.name}}],
})
export class {{_Model.name}}Module {}`
