# @goatlab/fluent-formio

A fluent query interface connector for Form.io that provides a type-safe, consistent API for CRUD operations with Form.io data sources.

## Installation

```bash
npm install @goatlab/fluent-formio
# or
yarn add @goatlab/fluent-formio
# or
pnpm add @goatlab/fluent-formio
```

## Basic Usage

```typescript
import { FormioConnector } from '@goatlab/fluent-formio'

// Create a connector instance
const userConnector = new FormioConnector({
  baseEndPoint: 'https://api.form.io/project/users',
  token: 'your-formio-jwt-token'
})

// Perform CRUD operations
const user = await userConnector.insert({
  data: {
    name: 'John Doe',
    email: 'john@example.com'
  }
})

const users = await userConnector.findMany({
  where: { 'data.status': 'active' },
  limit: 10
})
```

## Key Features

- **Form.io REST API Integration** - Full support for Form.io submission and form APIs
- **Type-Safe Queries** - TypeScript support with auto-completion
- **Fluent Query Builder** - Chainable query methods for complex operations
- **Built-in Mock Storage** - In-memory implementation for testing and development
- **Form.io Authentication** - JWT token and API key support
- **Advanced Filtering** - Support for nested properties, date ranges, and complex conditions

## Documentation

For comprehensive documentation, see the [Form.io Connector Guide](https://docs.goatlab.io/connectors/formio).

## License

MIT