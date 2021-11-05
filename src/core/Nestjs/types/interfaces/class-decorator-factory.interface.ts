import { ArgsType } from '../decorators/args-type.decorator'
import { InputType } from '../decorators/input-type.decorator'
import { InterfaceType } from '../decorators/interface-type.decorator'
import { ObjectType } from '../object-type.decorator'

export type ClassDecoratorFactory =
  | typeof ArgsType
  | typeof ObjectType
  | typeof InterfaceType
  | typeof InputType
