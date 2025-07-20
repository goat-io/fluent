import { FormioConnector } from '../FormioConnector'
import { GoatEntity, GoatInputSchema } from './entities/goat.entity'
import { AdvancedEntity, AdvancedInputSchema } from './entities/advanced.entity'

export class FormioGoatRepository extends FormioConnector<GoatEntity, GoatInputSchema> {
  constructor() {
    super({
      baseEndPoint: 'http://localhost:3001/goats'
    })
  }
}

export class FormioAdvancedRepository extends FormioConnector<AdvancedEntity, AdvancedInputSchema> {
  constructor() {
    super({
      baseEndPoint: 'http://localhost:3001/advanced'
    })
  }
}