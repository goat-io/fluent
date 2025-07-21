# @goatlab/fluentjs

A JavaScript implementation of the Goat Fluent query interface, providing a readable and composable way to work with multiple database types including LokiJS, Firebase, and remote APIs.

## Installation

```bash
npm install @goatlab/fluentjs
```

## Basic Usage

```javascript
import Fluent from '@goatlab/fluentjs'

// Configure connectors
Fluent.config({
  LOCAL_CONNECTORS: [
    {
      name: 'loki',
      connector: LokiConnector,
      default: true
    }
  ],
  REMOTE_CONNECTORS: [
    {
      name: 'api',
      connector: ApiConnector
    }
  ]
})

// Create a model
const User = Fluent.model({
  properties: {
    name: 'User'
  }
})

// Query data
const users = await User.local()
  .where('age', '>', 18)
  .orderBy('name')
  .get()
```

## Key Features

- **Multiple Database Support** - Works with LokiJS (in-memory), Firebase, Form.io, and custom APIs
- **Fluent Query Interface** - Chainable methods for intuitive query building
- **Composable Models** - Built with stampit for flexible model composition
- **Local/Remote/Merge Modes** - Query local cache, remote API, or merge both
- **Browser & Node.js** - Works in both environments
- **Collection Utilities** - Built-in collection manipulation tools
- **Form.io Integration** - Special support for Form.io forms and submissions