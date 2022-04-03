import { Directive } from '../decorators/directive.decorator'
import { Extensions } from '../decorators/extensions.decorator'
import { PropertyMetadata } from '../metadata'

export function applyFieldDecorators(
  targetClass: Function,
  item: PropertyMetadata
) {
  if (item.extensions) {
    Extensions(item.extensions)(targetClass.prototype, item.name)
  }
  if (item.directives?.length) {
    item.directives.map(directive => {
      Directive(directive.sdl)(targetClass.prototype, item.name)
    })
  }
}
