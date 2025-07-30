import { FormioComponent } from './types/FormioComponent'

type ComponentProcessor = (component: FormioComponent, path?: string) => any

const CONTAINER_TYPES = [
  'panel',
  'table',
  'well',
  'columns',
  'fieldset',
  'tabs',
  'form'
]

const SPECIAL_CONTAINER_TYPES = ['datagrid', 'container', 'editgrid']

/**
 * Process a single component
 */
const processComponent = (
  component: FormioComponent,
  fn: ComponentProcessor,
  currentPath: string,
  parent?: any
): { noRecurse: boolean; newPath: string } => {
  const newPath = component.key
    ? currentPath
      ? `${currentPath}.${component.key}`
      : component.key
    : ''

  // Keep track of parent references.
  if (parent) {
    // Ensure we don't create infinite JSON structures.
    component.parent = { ...parent }
    component.parent.components = undefined
    component.parent.componentMap = undefined
    component.parent.columns = undefined
    component.parent.rows = undefined
  }

  const noRecurse = fn(component, newPath)
  return { noRecurse, newPath }
}

/**
 * Calculate the sub-path for nested components
 */
const calculateSubPath = (
  component: FormioComponent,
  currentPath: string,
  newPath: string
): string => {
  if (!component.key) {
    return currentPath
  }

  const isNormalContainer = CONTAINER_TYPES.includes(component.type)
  const isSpecialContainer = SPECIAL_CONTAINER_TYPES.includes(component.type)

  if (!isNormalContainer && (isSpecialContainer || component.tree)) {
    return newPath
  }

  if (component.type === 'form') {
    return `${newPath}.data`
  }

  return currentPath
}

/**
 * Process columns structure
 */
const processColumns = (
  component: FormioComponent,
  fn: ComponentProcessor,
  includeAll: boolean,
  subPath: string,
  parent?: any
): void => {
  if (!component.columns || !Array.isArray(component.columns)) {
    return
  }

  const columnsLength = component.columns.length
  for (let j = 0; j < columnsLength; j++) {
    eachComponent(
      component.columns[j].components,
      fn,
      includeAll,
      subPath,
      parent ? component : null
    )
  }
}

/**
 * Process rows structure
 */
const processRows = (
  component: FormioComponent,
  fn: ComponentProcessor,
  includeAll: boolean,
  subPath: string,
  parent?: any
): void => {
  if (!component.rows || !Array.isArray(component.rows)) {
    return
  }

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
          subPath,
          parent ? component : null
        )
      }
    }
  }
}

/**
 * Check if component should be processed
 */
const shouldProcessComponent = (
  component: FormioComponent,
  includeAll?: boolean
): boolean => {
  const hasColumns = component.columns && Array.isArray(component.columns)
  const hasRows = component.rows && Array.isArray(component.rows)
  const hasComps = component.components && Array.isArray(component.components)

  return includeAll || component.tree || (!hasColumns && !hasRows && !hasComps)
}

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
  fn?: ComponentProcessor,
  includeAll?: boolean,
  path?: string,
  parent?: any
): void => {
  if (!components || !fn) {
    return
  }

  const currentPath = path || ''
  const componentsLength = components.length

  for (let i = 0; i < componentsLength; i++) {
    const component = components[i]
    if (!component) {
      continue
    }

    let noRecurse = false
    let newPath = ''

    if (shouldProcessComponent(component, includeAll)) {
      const result = processComponent(component, fn, currentPath, parent)
      noRecurse = result.noRecurse
      newPath = result.newPath
    } else {
      newPath = component.key
        ? currentPath
          ? `${currentPath}.${component.key}`
          : component.key
        : ''
    }

    if (!noRecurse) {
      const subPath = calculateSubPath(component, currentPath, newPath)

      // Process nested structures
      processColumns(component, fn, includeAll, subPath, parent)
      processRows(component, fn, includeAll, subPath, parent)

      // Process direct components
      if (component.components && Array.isArray(component.components)) {
        eachComponent(
          component.components,
          fn,
          includeAll,
          subPath,
          parent ? component : null
        )
      }
    }
  }
}
