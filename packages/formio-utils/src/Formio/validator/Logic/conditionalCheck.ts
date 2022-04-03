import vm from 'vm'
import * as _ from 'lodash'
import util from '../utils'
/*
 * Returns true or false based on visibility.
 *
 * @param {Object} component
 *   The form component to check.
 * @param {Object} row
 *   The local data to check.
 * @param {Object} data
 *   The full submission data.
 */
export const checkConditional = (
  component: any,
  row: any,
  data: any,
  recurse = false
): any => {
  let isVisible = true

  if (!component || !component.hasOwnProperty('key')) {
    return isVisible
  }

  // Custom conditional logic. Need special case so the eval is isolated in a sandbox
  if (component.customConditional) {
    // Create the sandbox.
    const sandbox = vm.createContext({
      data,
      row
    })

    // Execute the script.
    const script = new vm.Script(component.customConditional)
    script.runInContext(sandbox, {
      timeout: 250
    })

    if (util.isBoolean(sandbox.show)) {
      isVisible = util.boolean(sandbox.show)
    }
  } else {
    isVisible = util.checkCondition(component, row, data)
  }

  // If visible and recurse, continue down tree to check parents.
  if (isVisible && recurse && component.parent.type !== 'form') {
    return (
      !component.parent || checkConditional(component.parent, row, data, true)
    )
  }
  return isVisible
}
