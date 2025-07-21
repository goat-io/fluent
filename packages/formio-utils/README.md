# @goatlab/formio-utils

TypeScript utilities for parsing and validating Form.io forms. Generate models, controllers, and repositories for NestJS and Loopback frameworks from Form.io schemas.

## Installation

```bash
npm install @goatlab/formio-utils
# or
yarn add @goatlab/formio-utils
# or
pnpm add @goatlab/formio-utils
```

## Basic Usage

### Form Parsing and Code Generation

```typescript
import { Formio, SupportedFrameworks } from '@goatlab/formio-utils'
import type { FormioForm } from '@goatlab/formio-utils'

// Define a Form.io form
const form: FormioForm = {
  title: 'User Registration',
  name: 'userRegistration',
  path: 'user',
  components: [
    {
      type: 'textfield',
      key: 'name',
      label: 'Name',
      validate: { required: true }
    },
    {
      type: 'number',
      key: 'age',
      label: 'Age'
    }
  ]
}

// Parse form and generate NestJS/Loopback code
const parsedModels = await Formio.parse(form, SupportedFrameworks.Nest)

// Access generated code
parsedModels.forEach(model => {
  console.log(model.controller) // Generated controller code
  console.log(model.repository) // Generated repository code
  console.log(model.models)     // Generated model code
  console.log(model.types)      // Generated TypeScript types
})
```

### Form Validation

```typescript
import { Validate } from '@goatlab/formio-utils/dist/Formio/validator/Validate'

// Validate form submission
const submission = {
  data: {
    name: 'John Doe',
    age: 25
  }
}

try {
  const validatedData = await Validate.submission(form, submission)
  console.log('Valid submission:', validatedData)
} catch (error) {
  console.error('Validation errors:', error.details)
}
```

### Form Utilities

```typescript
// Get all form components
Formio.eachComponent(form, (component) => {
  console.log(component.key, component.type)
})

// Find specific components
const textFields = Formio.findComponents(form, { type: 'textfield' })

// Get table view components
const tableColumns = Formio.tableViewComponents(form)

// Get form labels
const labels = Formio.labels(form)
```

## Key Features

- **Form Parsing**: Convert Form.io schemas into framework-specific code (NestJS, Loopback)
- **Form Validation**: Validate form submissions against Form.io schemas with detailed error reporting
- **Code Generation**: Automatically generate models, controllers, repositories, and TypeScript types
- **Form Utilities**: Helper functions for working with Form.io components (find, flatten, iterate)
- **TypeScript Support**: Full TypeScript support with exported types
- **Framework Support**: Generate code for NestJS and Loopback frameworks