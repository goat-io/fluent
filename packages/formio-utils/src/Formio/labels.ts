import { eachComponent } from './eachComponent'
import { FormioComponent } from './types/FormioComponent'
import { FormioForm } from './types/FormioForm'

const extrapolateTranslations = (text: string) => {
  // The following regex captures all Form.io template interpolations using the
  // formio component's instance i18n translation function (https://regexr.com/43sfm).
  // Warning: the "positive lookbehind" (?<=) feature may not be available for all browsers.
  // const regex = /(?<=\{\{\s*?instance.t\(\s*?[\'|\"])(.*?)(?=([\'|\"]\s*?\))(\s*?)\}\})/g;
  const regex = /\{\{\s*?instance.t\(\s*?['|"](.*?)(?=(['|"]\s*?\))\s*?\}\})/g
  const matched = []
  let match = regex.exec(text)
  // Loop through all matches
  while (match !== null) {
    matched.push(match[0].replace(/.*?instance\.t\(\s*['|"']/, '').trim())
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
          picture: l.picture,
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
      translations: {},
    }
    label.location.forEach(l => {
      newObject[label.text].location.push({
        text: label.text,
        template: label.template,
        type: l.type,
        picture: l.picture,
      })
    })
  } else {
    newObject[label.text] = {
      location: [label],
      translations: {},
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
  'errorLabel',
]

// Process common translated items
const processCommonLabels = (
  component: FormioComponent,
  componentLabels: ILabels,
  formPath: string,
): ILabels => {
  let labels = componentLabels

  formioLabelsPositions.forEach(position => {
    if (component[position] && component[position] !== '') {
      labels = createOrAdd({
        labels,
        label: {
          text: component[position],
          type: position,
          component: component.key,
          form: formPath,
          picture: null,
        },
      })
    }
  })

  return labels
}

// Process tooltips
const processTooltips = (
  component: FormioComponent,
  componentLabels: ILabels,
  formPath: string,
): ILabels => {
  if (!component.tooltip) {
    return componentLabels
  }

  let labels = componentLabels
  const texts = extrapolateTranslations(component.tooltip)

  if (texts.length === 0) {
    texts.push(component.tooltip)
  }

  texts.forEach(text => {
    labels = createOrAdd({
      labels,
      label: {
        text,
        type: 'tooltip',
        component: component.key,
        form: formPath,
        picture: null,
      },
    })
  })

  return labels
}

// Process component values (radio, checkbox, etc.)
const processComponentValues = (
  component: FormioComponent,
  componentLabels: ILabels,
  formPath: string,
): ILabels => {
  if (!component.values) {
    return componentLabels
  }

  let labels = componentLabels

  component.values.forEach(value => {
    if (value.label && value.label !== '') {
      labels = createOrAdd({
        labels,
        label: {
          text: value.label,
          type: 'value',
          component: component.key,
          form: formPath,
          picture: null,
        },
      })
    }
  })

  return labels
}

// Process HTML content
const processHtmlContent = (
  component: FormioComponent,
  componentLabels: ILabels,
  formPath: string,
): ILabels => {
  if (component.type !== 'htmlelement' && component.type !== 'content') {
    return componentLabels
  }

  let labels = componentLabels
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
        labels = createOrAdd({
          labels,
          label: {
            text,
            type: 'html',
            component: component.key,
            form: formPath,
            picture: null,
          },
        })
      }
    })
  }

  return labels
}

// Process select components
const processSelectComponent = (
  component: FormioComponent,
  componentLabels: ILabels,
  formPath: string,
): ILabels => {
  if (component.type !== 'select' || !component.data?.values) {
    return componentLabels
  }

  let labels = componentLabels

  component.data.values.forEach(value => {
    if (value.label && value.label !== '') {
      labels = createOrAdd({
        labels,
        label: {
          text: value.label,
          type: 'selectValue',
          component: component.key,
          form: formPath,
          picture: null,
        },
      })
    }
  })

  return labels
}

// Process survey components
const processSurveyComponent = (
  component: FormioComponent,
  componentLabels: ILabels,
  formPath: string,
): ILabels => {
  if (component.type !== 'survey' || !component.questions) {
    return componentLabels
  }

  let labels = componentLabels

  // Check for every question on the survey
  component.questions.forEach(q => {
    labels = createOrAdd({
      labels,
      label: {
        text: q.label,
        type: 'surveyLabel',
        component: component.key,
        form: formPath,
        picture: null,
      },
    })
  })

  // Check every text of the answers
  if (component.values) {
    component.values.forEach(v => {
      labels = createOrAdd({
        labels,
        label: {
          text: v.label,
          type: 'surveyValues',
          component: component.key,
          form: formPath,
          picture: null,
        },
      })
    })
  }

  return labels
}

// Process EditGrid components
const processEditGridComponent = (
  component: FormioComponent,
  componentLabels: ILabels,
  formPath: string,
): ILabels => {
  if (component.type !== 'editgrid' || !component.templates) {
    return componentLabels
  }

  let labels = componentLabels
  const header = extrapolateTranslations(component.templates.header || '')
  const footer = extrapolateTranslations(component.templates.footer || '')
  const allTexts = [...header, ...footer]

  allTexts.forEach(text => {
    // Omit empty text strings
    if (text !== '') {
      labels = createOrAdd({
        labels,
        label: {
          text,
          type: 'editgrid',
          component: component.key,
          form: formPath,
          picture: null,
        },
      })
    }
  })

  return labels
}

// Process a single component
const processComponent = (
  component: FormioComponent,
  componentLabels: ILabels,
  formPath: string,
): ILabels => {
  let labels = componentLabels

  // Process different types of labels
  labels = processCommonLabels(component, labels, formPath)
  labels = processTooltips(component, labels, formPath)
  labels = processComponentValues(component, labels, formPath)
  labels = processHtmlContent(component, labels, formPath)
  labels = processSelectComponent(component, labels, formPath)
  labels = processSurveyComponent(component, labels, formPath)
  labels = processEditGridComponent(component, labels, formPath)

  return labels
}

export const labels = (Forms: FormioForm[]): ILabels => {
  let componentLabels = {}

  Forms.forEach(form => {
    // Add title of the Forms to the translations
    componentLabels = createOrAdd({
      labels: componentLabels,
      label: {
        text: form.title,
        type: 'formTitle',
        component: form.path,
        form: form.path,
        picture: null,
      },
    })

    // Go across every component
    eachComponent(
      form.components,
      component => {
        componentLabels = processComponent(
          component,
          componentLabels,
          form.path,
        )
      },
      true,
    )
  })

  return componentLabels
}
