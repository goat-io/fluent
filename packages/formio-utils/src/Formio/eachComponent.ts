import { FormioComponent } from './types/FormioComponent'
/**
 *
 * @param components
 * @param fn
 * @param includeAll
 * @param path
 * @param parent
 */
export const eachComponent = (
  components: FormioComponent[],
  fn?: (component: FormioComponent, path?: string) => any,
  includeAll?: boolean,
  path?: string,
  parent?: any
): void => {
  if (!components) {
    return
  }
  path = path || ''
  const componentsLength = components.length
  for (let i = 0; i < componentsLength; i++) {
    const component = components[i]
    if (!component) {
      continue
    }

    const hasColumns = component.columns && Array.isArray(component.columns)
    const hasRows = component.rows && Array.isArray(component.rows)
    const hasComps = component.components && Array.isArray(component.components)
    let noRecurse = false
    const newPath = component.key
      ? path
        ? `${path}.${component.key}`
        : component.key
      : ''

    // Keep track of parent references.
    if (parent) {
      // Ensure we don't create infinite JSON structures.
      component.parent = { ...parent }
      delete component.parent.components
      delete component.parent.componentMap
      delete component.parent.columns
      delete component.parent.rows
    }

    if (
      includeAll ||
      component.tree ||
      (!hasColumns && !hasRows && !hasComps)
    ) {
      noRecurse = fn(component, newPath)
    }

    const subPath = () => {
      if (
        component.key &&
        ![
          'panel',
          'table',
          'well',
          'columns',
          'fieldset',
          'tabs',
          'form'
        ].includes(component.type) &&
        (['datagrid', 'container', 'editgrid'].includes(component.type) ||
          component.tree)
      ) {
        return newPath
      }
      if (component.key && component.type === 'form') {
        return `${newPath}.data`
      }
      return path
    }

    if (!noRecurse) {
      if (hasColumns) {
        const columnsLength = component.columns.length
        for (let j = 0; j < columnsLength; j++) {
          eachComponent(
            component.columns[j].components,
            fn,
            includeAll,
            subPath(),
            parent ? component : null
          )
        }
      } else if (hasRows) {
        const rowsLength = component.rows.length
        for (let j = 0; j < rowsLength; j++) {
          const row = component.rows[j]
          if (Array.isArray(row)) {
            const rowLength = row.length
            for (let k = 0; k < rowLength; k++) {
              eachComponent(
                row[k].components,
                fn,
                includeAll,
                subPath(),
                parent ? component : null
              )
            }
          }
        }
      } else if (hasComps) {
        eachComponent(
          component.components,
          fn,
          includeAll,
          subPath(),
          parent ? component : null
        )
      }
    }
  }
}
