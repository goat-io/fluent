# Form.io Integration - Form Parsing and Validation

The `@goatlab/formio-utils` package provides comprehensive tools for parsing, validating, and generating code from Form.io form definitions.

## Overview

Form.io is a powerful form builder that generates JSON-based form definitions. This package provides:

- **Form Parsing**: Convert Form.io forms into usable data structures
- **Code Generation**: Generate TypeScript models, controllers, and repositories
- **Validation**: Comprehensive form and submission validation
- **Component Processing**: Process individual form components
- **Framework Support**: Support for NestJS and Loopback 4

## Installation

```bash
npm install @goatlab/formio-utils
```

## Core Components

### Formio Class

The main interface for Form.io operations:

```typescript
import { Formio } from '@goatlab/formio-utils'

// Parse a form definition
const parsedForm = await Formio.parse(formDefinition, SupportedFrameworks.Nest)

// Process form components
Formio.eachComponent(formDefinition, (component) => {
  console.log('Component:', component.key, component.type)
})

// Extract labels
const labels = Formio.labels(formDefinition)
console.log('Form labels:', labels)
```

### Form Parsing

```typescript
import { Formio, SupportedFrameworks } from '@goatlab/formio-utils'
import type { FormioForm } from '@goatlab/formio-utils'

// Example Form.io form definition
const formDefinition: FormioForm = {
  title: 'User Registration',
  name: 'userRegistration',
  path: 'user-registration',
  components: [
    {
      type: 'textfield',
      key: 'firstName',
      label: 'First Name',
      validate: { required: true }
    },
    {
      type: 'email',
      key: 'email',
      label: 'Email Address',
      validate: { required: true }
    },
    {
      type: 'select',
      key: 'role',
      label: 'Role',
      data: {
        values: [
          { label: 'User', value: 'user' },
          { label: 'Admin', value: 'admin' }
        ]
      }
    }
  ]
}

// Parse the form
const parsedResults = await Formio.parse(formDefinition, SupportedFrameworks.Nest)

console.log('Generated TypeScript models:', parsedResults[0].models)
console.log('Generated controller:', parsedResults[0].controller)
console.log('Generated repository:', parsedResults[0].repository)
```

## Component Processing

### Finding Components

```typescript
// Find components by type
const textFields = Formio.findComponents(formDefinition, {
  type: 'textfield'
})

console.log('Text fields found:', textFields.length)

// Find components by key
const emailComponent = Formio.findComponents(formDefinition, {
  key: 'email'
})

console.log('Email component:', emailComponent[0])
```

### Processing Each Component

```typescript
// Process all components
Formio.eachComponent(formDefinition, (component, path) => {
  console.log(`Component ${component.key} at path ${path}:`, {
    type: component.type,
    label: component.label,
    required: component.validate?.required || false
  })
})
```

### Flattening Components

```typescript
// Flatten nested components
const flatComponents = Formio.flattenComponents(formDefinition)

Object.keys(flatComponents).forEach(key => {
  const component = flatComponents[key]
  console.log(`${key}: ${component.type} - ${component.label}`)
})
```

## Code Generation

### Supported Frameworks

```typescript
export enum SupportedFrameworks {
  Loopback = 'Loopback4',
  Nest = 'Nestjs'
}
```

### NestJS Generation

```typescript
import { Formio, SupportedFrameworks } from '@goatlab/formio-utils'

const results = await Formio.parse(formDefinition, SupportedFrameworks.Nest)

// Generated NestJS components
const parsedModel = results[0]

console.log('NestJS Entity:', parsedModel.models.entity)
console.log('NestJS DTO:', parsedModel.models.dto)
console.log('NestJS Controller:', parsedModel.controller)
console.log('NestJS Repository:', parsedModel.repository)
console.log('NestJS Module:', parsedModel.module)
```

### Loopback 4 Generation

```typescript
const results = await Formio.parse(formDefinition, SupportedFrameworks.Loopback)

// Generated Loopback components
const parsedModel = results[0]

console.log('Loopback Model:', parsedModel.models.model)
console.log('Loopback Controller:', parsedModel.controller)
console.log('Loopback Repository:', parsedModel.repository)
```

## Validation System

### Form Validation

```typescript
import { Formio } from '@goatlab/formio-utils'

// Validate form structure
const isValidForm = Formio.validator.validateForm(formDefinition)

if (!isValidForm) {
  console.error('Form validation failed')
}
```

### Submission Validation

```typescript
// Sample submission data
const submissionData = {
  firstName: 'John',
  email: 'john@example.com',
  role: 'user'
}

// Validate submission against form
const validationResult = Formio.validator.validateSubmission(
  formDefinition,
  submissionData
)

if (validationResult.isValid) {
  console.log('Submission is valid')
} else {
  console.log('Validation errors:', validationResult.errors)
}
```

### Custom Validation Rules

```typescript
// Extended validation with custom rules
const customValidation = {
  ...submissionData,
  customField: 'value'
}

const extendedValidation = Formio.validator.validateWithCustomRules(
  formDefinition,
  customValidation,
  {
    customField: {
      required: true,
      minLength: 5
    }
  }
)
```

## Advanced Features

### Table View Configuration

```typescript
// Get table view components
const tableComponents = Formio.tableViewComponents(formDefinition)

console.log('Table view columns:', tableComponents.map(c => c.key))

// Get table view labels
const tableLabels = Formio.tableViewLabels(formDefinition)
console.log('Table labels:', tableLabels)
```

### Component Mutators

```typescript
// Get form data with mutators
const formData = Formio.getter(formDefinition)
console.log('Processed form data:', formData)

// Set form data with mutators
const updatedForm = Formio.setter(formDefinition, {
  title: 'Updated Form Title',
  components: [...formDefinition.components]
})
```

### Label Extraction

```typescript
// Extract all labels from form
const allLabels = Formio.labels(formDefinition)

console.log('Form labels:', allLabels)
// Output: { firstName: 'First Name', email: 'Email Address', role: 'Role' }
```

## Component Types

### Supported Components

The system supports various Form.io component types:

```typescript
// Text-based components
const textComponents = [
  'textfield',
  'textarea',
  'email',
  'password',
  'phonenumber'
]

// Selection components
const selectionComponents = [
  'select',
  'selectbox',
  'radio',
  'checkbox'
]

// Container components
const containerComponents = [
  'container',
  'datagrid',
  'survey'
]

// Numeric components
const numericComponents = [
  'number'
]
```

### Component Processing Examples

```typescript
// Process different component types
Formio.eachComponent(formDefinition, (component) => {
  switch (component.type) {
    case 'textfield':
      console.log('Text field:', component.key, component.label)
      break
    case 'email':
      console.log('Email field:', component.key, component.validate)
      break
    case 'select':
      console.log('Select field:', component.key, component.data?.values)
      break
    case 'datagrid':
      console.log('Data grid:', component.key, component.components)
      break
    default:
      console.log('Unknown component:', component.type)
  }
})
```

## Integration Examples

### Express.js Integration

```typescript
import express from 'express'
import { Formio, SupportedFrameworks } from '@goatlab/formio-utils'

const app = express()

// Form processing endpoint
app.post('/process-form', async (req, res) => {
  try {
    const { formDefinition, submissionData } = req.body

    // Parse form
    const parsedResults = await Formio.parse(
      formDefinition,
      SupportedFrameworks.Nest
    )

    // Validate submission
    const validationResult = Formio.validator.validateSubmission(
      formDefinition,
      submissionData
    )

    if (!validationResult.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validationResult.errors
      })
    }

    // Process the valid submission
    const processedData = await processFormSubmission(submissionData)

    res.json({
      success: true,
      data: processedData,
      generatedCode: parsedResults[0]
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

### Database Integration

```typescript
// Generate database models from forms
const generateDatabaseModels = async (forms: FormioForm[]) => {
  const models = []

  for (const form of forms) {
    const parsedResults = await Formio.parse(form, SupportedFrameworks.Nest)
    
    // Extract model definition
    const modelDefinition = parsedResults[0].models.entity
    
    // Create database table/collection
    await createDatabaseTable(form.name, modelDefinition)
    
    models.push({
      name: form.name,
      definition: modelDefinition,
      repository: parsedResults[0].repository
    })
  }

  return models
}
```

### React Integration

```typescript
// React component for form processing
import React, { useState } from 'react'
import { Formio } from '@goatlab/formio-utils'

const FormProcessor: React.FC = () => {
  const [formData, setFormData] = useState({})
  const [validation, setValidation] = useState(null)

  const handleSubmit = async (formDefinition: FormioForm, data: any) => {
    // Validate form data
    const validationResult = Formio.validator.validateSubmission(
      formDefinition,
      data
    )

    setValidation(validationResult)

    if (validationResult.isValid) {
      // Process valid form
      await processFormData(data)
    }
  }

  return (
    <div>
      {/* Form rendering logic */}
      {validation && !validation.isValid && (
        <div className="errors">
          {validation.errors.map((error, index) => (
            <p key={index} className="error">{error.message}</p>
          ))}
        </div>
      )}
    </div>
  )
}
```

## Error Handling

### Validation Errors

```typescript
// Comprehensive error handling
const validateFormWithErrorHandling = (
  formDefinition: FormioForm,
  submissionData: any
) => {
  try {
    const validationResult = Formio.validator.validateSubmission(
      formDefinition,
      submissionData
    )

    if (!validationResult.isValid) {
      // Group errors by field
      const errorsByField = validationResult.errors.reduce((acc, error) => {
        const field = error.field || 'general'
        if (!acc[field]) acc[field] = []
        acc[field].push(error.message)
        return acc
      }, {})

      return {
        isValid: false,
        errors: errorsByField,
        fieldErrors: validationResult.errors
      }
    }

    return { isValid: true, errors: null }
  } catch (error) {
    console.error('Validation error:', error)
    return {
      isValid: false,
      errors: { general: ['Validation failed'] },
      systemError: error.message
    }
  }
}
```

### Parsing Errors

```typescript
// Handle parsing errors
const parseFormSafely = async (
  formDefinition: FormioForm,
  framework: SupportedFrameworks
) => {
  try {
    const results = await Formio.parse(formDefinition, framework)
    return { success: true, results }
  } catch (error) {
    console.error('Form parsing failed:', error)
    return {
      success: false,
      error: error.message,
      details: error.stack
    }
  }
}
```

## Performance Optimization

### Caching

```typescript
// Cache parsed forms
const formCache = new Map<string, any>()

const parseFormWithCache = async (
  formDefinition: FormioForm,
  framework: SupportedFrameworks
) => {
  const cacheKey = `${formDefinition.name}-${framework}`
  
  if (formCache.has(cacheKey)) {
    return formCache.get(cacheKey)
  }

  const results = await Formio.parse(formDefinition, framework)
  formCache.set(cacheKey, results)
  
  return results
}
```

### Batch Processing

```typescript
// Process multiple forms efficiently
const batchProcessForms = async (
  forms: FormioForm[],
  framework: SupportedFrameworks
) => {
  const results = await Promise.all(
    forms.map(form => Formio.parse(form, framework))
  )

  return results.flat()
}
```

## Best Practices

1. **Validation First**: Always validate form definitions before processing
2. **Error Handling**: Implement comprehensive error handling
3. **Caching**: Cache parsed forms for better performance
4. **Type Safety**: Use TypeScript interfaces for better type safety
5. **Component Processing**: Use appropriate component processing methods
6. **Framework Selection**: Choose the right framework for your needs

## Common Use Cases

### Dynamic Form Builder

```typescript
// Build forms dynamically
const buildDynamicForm = (fields: any[]) => {
  const components = fields.map(field => ({
    type: field.type,
    key: field.key,
    label: field.label,
    validate: { required: field.required }
  }))

  return {
    title: 'Dynamic Form',
    name: 'dynamicForm',
    components
  }
}

// Use the dynamic form
const dynamicForm = buildDynamicForm([
  { type: 'textfield', key: 'name', label: 'Name', required: true },
  { type: 'email', key: 'email', label: 'Email', required: true }
])

const results = await Formio.parse(dynamicForm, SupportedFrameworks.Nest)
```

### Form Migration

```typescript
// Migrate forms between versions
const migrateFormDefinition = (oldForm: any, targetVersion: string) => {
  // Migration logic based on version
  const migratedForm = { ...oldForm }
  
  // Apply version-specific transformations
  if (targetVersion === '2.0') {
    migratedForm.components = migratedForm.components.map(component => {
      // Update component structure
      return {
        ...component,
        version: '2.0'
      }
    })
  }

  return migratedForm
}
```

## Testing

### Unit Tests

```typescript
import { Formio, SupportedFrameworks } from '@goatlab/formio-utils'

describe('Form.io Integration', () => {
  test('should parse form definition', async () => {
    const formDefinition = {
      title: 'Test Form',
      name: 'testForm',
      components: [
        { type: 'textfield', key: 'name', label: 'Name' }
      ]
    }

    const results = await Formio.parse(formDefinition, SupportedFrameworks.Nest)
    
    expect(results).toHaveLength(1)
    expect(results[0].model.name).toBe('testForm')
  })

  test('should validate submission', () => {
    const formDefinition = {
      components: [
        { type: 'textfield', key: 'name', validate: { required: true } }
      ]
    }

    const validSubmission = { name: 'John' }
    const invalidSubmission = {}

    const validResult = Formio.validator.validateSubmission(
      formDefinition,
      validSubmission
    )
    const invalidResult = Formio.validator.validateSubmission(
      formDefinition,
      invalidSubmission
    )

    expect(validResult.isValid).toBe(true)
    expect(invalidResult.isValid).toBe(false)
  })
})
```

## Troubleshooting

### Common Issues

1. **Component Not Found**: Check component type spelling and availability
2. **Validation Errors**: Verify form structure and validation rules
3. **Generation Errors**: Ensure form definition is complete and valid
4. **Performance Issues**: Use caching and batch processing for large forms

### Debug Mode

```typescript
// Enable debug logging
const debugParsing = async (formDefinition: FormioForm) => {
  console.log('Parsing form:', formDefinition.name)
  console.log('Components:', formDefinition.components.length)
  
  Formio.eachComponent(formDefinition, (component, path) => {
    console.log(`Debug: ${path} - ${component.type}`)
  })

  const results = await Formio.parse(formDefinition, SupportedFrameworks.Nest)
  console.log('Parsing completed:', results.length, 'models generated')
  
  return results
}
```

## Next Steps

- Learn about [Workflow Patterns](workflow-patterns.md) for complex form processing
- Explore [Error Handling Strategies](error-handling.md) for robust form validation
- Check out [Uploads Integration](uploads.md) for file handling in forms