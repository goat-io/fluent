import { eachComponent } from './eachComponent'
import { FormioForm } from './types/FormioForm'

const extrapolateTranslations = (text: string) => {
  // The following regex captures all Form.io template interpolations using the
  // formio component's instance i18n translation function (https://regexr.com/43sfm).
  // Warning: the "positive lookbehind" (?<=) feature may not be available for all browsers.
  // const regex = /(?<=\{\{\s*?instance.t\(\s*?[\'|\"])(.*?)(?=([\'|\"]\s*?\))(\s*?)\}\})/g;
  const regex =
    /\{\{\s*?instance.t\(\s*?[\'|\"](.*?)(?=([\'|\"]\s*?\))\s*?\}\})/g
  const matched = []
  let match = regex.exec(text)
  // Loop through all matches
  while (match !== null) {
    matched.push(match[0].replace(/.*?instance\.t\(\s*[\'|\"']/, '').trim())
    match = regex.exec(text)
  }
  return matched
}

const createOrAdd = ({ labels, label }) => {
  const newObject = { ...labels }

  if (!label) {
    return newObject
  }

  // If the label already exists
  if (newObject[label.text]) {
    // If the location is an Array of Locations
    if (label.location && Array.isArray(label.location)) {
      label.location.forEach(l => {
        newObject[label.text].location.push({
          text: label.text,
          template: label.template,
          type: l.type,
          picture: l.picture
        })
      })
    } else {
      newObject[label.text].location.push(label)
    }
    // If the label does not exist
  } else if (label.location && Array.isArray(label.location)) {
    newObject[label.text] = {
      location: [],
      template: label.template,
      translations: {}
    }
    label.location.forEach(l => {
      newObject[label.text].location.push({
        text: label.text,
        template: label.template,
        type: l.type,
        picture: l.picture
      })
    })
  } else {
    newObject[label.text] = {
      location: [label],
      translations: {}
    }
  }
  return newObject
}

export interface ILabelLocation {
  text: string
  template: string
  type: string
  picture: string
}
export interface ILabels {
  [key: string]: {
    location: ILabelLocation[]
    translations: any
  }
}

export const labels = (Forms: FormioForm[]): ILabels => {
  let componentLabels = {}
  // Extract all labels for all available forms
  const formioLabelsPositions = [
    'suffix',
    'prefix',
    'addAnother',
    'removeRow',
    'saveRow',
    'legend',
    'title',
    'label',
    'placeholder',
    'errorLabel'
  ]

  Forms.forEach(form => {
    // Add title of the Forms to the translations
    componentLabels = createOrAdd({
      labels: componentLabels,
      label: {
        text: form.title,
        type: 'formTitle',
        component: form.path,
        form: form.path,
        picture: null
      }
    })
    // Go across every component
    eachComponent(
      form.components,
      component => {
        // Check for the common translated Items listed above
        formioLabelsPositions.forEach(position => {
          if (component[position] && component[position] !== '') {
            // Add the Label if is not empty
            componentLabels = createOrAdd({
              labels: componentLabels,
              label: {
                text: component[position],
                type: position,
                component: component.key,
                form: form.path,
                picture: null
              }
            })
          }
        })

        // Check for components that have tooltips
        if (component.tooltip) {
          const texts = extrapolateTranslations(component.tooltip)

          if (texts.length === 0) {
            texts.push(component.tooltip)
          }

          texts.forEach(text => {
            componentLabels = createOrAdd({
              labels: componentLabels,
              label: {
                text,
                type: 'tooltip',
                component: component.key,
                form: form.path,
                picture: null
              }
            })
          })
        }

        // Check for components that have values with labels (i.e: radio)
        if (component.values) {
          component.values.forEach(value => {
            if (value.label && value.label !== '') {
              componentLabels = createOrAdd({
                labels: componentLabels,
                label: {
                  text: value.label,
                  type: 'value',
                  component: component.key,
                  form: form.path,
                  picture: null
                }
              })
            }
          })
        }

        // Check for html text in HTML or Content components
        if (component.type === 'htmlelement' || component.type === 'content') {
          const html = (component.content || component.html || '').trim()

          if (html !== '') {
            const texts = extrapolateTranslations(html)
            // If no interpolation found check if content is simple text (no html string)
            if (texts.length === 0 && !/<[a-z][\s\S]*>/i.test(html)) {
              texts.push(html)
            }
            // Create a label for each match (if none, don't anything)
            texts.forEach(text => {
              // Omit empty text strings
              if (text !== '') {
                componentLabels = createOrAdd({
                  labels: componentLabels,
                  label: {
                    text,
                    type: 'html',
                    component: component.key,
                    form: form.path,
                    picture: null
                  }
                })
              }
            })
          }
        }

        // Check specificaly for select elements
        if (component.type === 'select') {
          if (component.data && component.data.values) {
            component.data.values.forEach(value => {
              if (value.label && value.label !== '') {
                componentLabels = createOrAdd({
                  labels: componentLabels,
                  label: {
                    text: value.label,
                    type: 'selectValue',
                    component: component.key,
                    form: form.path,
                    picture: null
                  }
                })
              }
            })
          }
        }

        // Check for survey elements
        if (component.type === 'survey') {
          if (component.questions) {
            // Check for every question on the survey
            component.questions.forEach(q => {
              componentLabels = createOrAdd({
                labels: componentLabels,
                label: {
                  text: q.label,
                  type: 'surveyLabel',
                  component: component.key,
                  form: form.path,
                  picture: null
                }
              })
            })
            // Check every text of the answers
            component.values.forEach(v => {
              componentLabels = createOrAdd({
                labels: componentLabels,
                label: {
                  text: v.label,
                  type: 'surveyValues',
                  component: component.key,
                  form: form.path,
                  picture: null
                }
              })
            })
          }
        }

        // Check for Edit Grid component header and footer templates
        if (component.type === 'editgrid' && component.templates) {
          const header = extrapolateTranslations(component.templates.header)
          const footer = extrapolateTranslations(component.templates.footer)
          const a = []
          // Create a label for each match (if none, don't anything)
          a.concat(header, footer).forEach(text => {
            // Omit empty text strings
            if (text !== '') {
              componentLabels = createOrAdd({
                labels: componentLabels,
                label: {
                  text,
                  type: 'editgrid',
                  component: component.key,
                  form: form.path,
                  picture: null
                }
              })
            }
          })
        }
      },
      true
    )
  })

  return componentLabels
}
