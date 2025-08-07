<!-- PROJECT SHIELDS -->

[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/github_username/repo">
       <img src="https://docs.goatlab.io/logo.png" alt="Logo" width="150" height="150">
  </a>

  <h3 align="center">GOAT-FLUENT</h3>

  <p align="center">
    Fluent - Time Saving (TS) utils
    <br />
    <a href="https://docs.goatlab.io/#/0.7.x/fluent/fluent"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    ·
    <a href="https://github.com/goat-io/fluent/issues">Report Bug</a>
    ·
    <a href="https://github.com/goat-io/fluent/issues">Request Feature</a>
  </p>
</p>

# Goat - Fluent (Monorepo)

A comprehensive TypeScript ecosystem for building data-driven applications with unified query interfaces, multi-database support, and extensive utilities for Node.js and browser environments.

## 🚀 Quick Start

```bash
# Install the core package
pnpm add @goatlab/fluent

# Install specific database connectors
pnpm add @goatlab/fluent-firebase  # For Firebase/Firestore
pnpm add @goatlab/fluent-loki      # For in-memory database
pnpm add @goatlab/fluent-pouchdb   # For PouchDB

# Install utilities
pnpm add @goatlab/js-utils         # Browser/Node utilities
pnpm add @goatlab/node-utils       # Node.js specific utilities
```

## 📦 Packages

### Core Query Interface

- **[@goatlab/fluent](./packages/fluent)** - TypeScript query builder and ORM wrapper with multi-database support via TypeORM
- **[@goatlab/fluentjs](./packages/fluentjs)** - JavaScript implementation of the Fluent query interface

### Database Connectors

- **[@goatlab/fluent-firebase](./packages/fluent-firebase)** - Firebase/Firestore connector with real-time capabilities
- **[@goatlab/fluent-loki](./packages/fluent-loki)** - LokiJS in-memory database connector
- **[@goatlab/fluent-pouchdb](./packages/fluent-pouchdb)** - PouchDB connector for offline-first applications
- **[@goatlab/fluent-formio](./packages/fluent-formio)** - Form.io API connector for form-based data

### Utilities

- **[@goatlab/js-utils](./packages/js-utils)** - Comprehensive utilities for browser and Node.js (arrays, objects, HTTP, promises)
- **[@goatlab/node-utils](./packages/node-utils)** - Node.js specific utilities (JWT, encryption, streams, file operations)
- **[@goatlab/js-html](./packages/js-html)** - HTML processing with sanitization and text extraction
- **[@goatlab/node-xlsx](./packages/node-xlsx)** - Excel file streaming and processing
- **[@goatlab/formio-utils](./packages/formio-utils)** - Form.io form parsing and validation utilities

### Task Processing & Queues

- **[@goatlab/queue-core](./packages/queue-core)** - Unified interface for message brokers (Kafka, RabbitMQ) and job schedulers (Bull, Agenda)
- **[@goatlab/queue-node](./packages/queue-node)** - Node.js cron-based scheduler implementation
- **[@goatlab/tasks-core](./packages/tasks-core)** - Common interface for queueable tasks
- **[@goatlab/tasks-adapter-gcp](./packages/tasks-adapter-gcp)** - Google Cloud Tasks adapter
- **[@goatlab/tasks-adapter-hatchet](./packages/tasks-adapter-hatchet)** - Hatchet workflow engine adapter

### Cloud Services

- **[@goatlab/uploads](./packages/uploads)** - Multi-cloud file upload middleware (S3, Google Cloud, Azure)
- **[@goatlab/node-backend](./packages/node-backend)** - Flexible caching with Redis and LRU support
- **[@goatlab/node-metascraper](./packages/node-metascraper)** - Web metadata extraction

### API Integrations

- **[@goatlab/metabase](./packages/metabase)** - Comprehensive Metabase API wrapper
- **[@goatlab/typesense](./packages/typesense)** - Modern TypeScript wrapper for Typesense search engine

### Development Tools

- **[@goatlab/benchmarks](./packages/benchmarks)** - Performance benchmarking for database operations
- **[@goatlab/eslint](./packages/eslint)** - Shared ESLint configuration
- **[@goatlab/tsconfig](./packages/tsconfig)** - Shared TypeScript configuration
- **[@goatlab/ts-package-template](./packages/base_project)** - Template for new TypeScript packages
- **[@sodium/delphi](./packages/delphi)** - Multi-agent consensus system with flexible AI model configuration, session management, and production-ready agreement protocols

## 🗄️ Supported Databases

### Via TypeORM Connector (@goatlab/fluent)

- PostgreSQL
- MySQL / MariaDB
- SQLite
- Microsoft SQL Server
- Oracle
- MongoDB
- CockroachDB
- SAP Hana
- sql.js

### Native Connectors

- Firebase / Firestore
- LokiJS (in-memory)
- PouchDB (offline-first)
- Form.io (API-based)

## 🏗️ Architecture

This monorepo follows a modular architecture with:

- **Unified Query Interface**: All database connectors implement the same Fluent API
- **Type Safety**: Full TypeScript support with Zod schema validation
- **Decorator-based Entities**: Define your models using decorators
- **Extensible Connectors**: Easy to add new database support
- **Monorepo Structure**: Managed with pnpm workspaces and Turbo

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run development mode
pnpm dev

# Lint code
pnpm lint
```

## 📝 Example Usage

```typescript
import { Fluent, TypeOrmConnector } from '@goatlab/fluent'
import { z } from 'zod'

// Define your schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional()
})

// Create a repository
class UserRepository extends TypeOrmConnector<User> {
  constructor() {
    super({
      entity: User,
      dataSource: myDataSource
    })
  }
}

// Use the Fluent API
const users = await userRepo
  .where({ age: { $gte: 18 } })
  .orderBy({ name: 'ASC' })
  .limit(10)
  .find()
```

## 🚢 Release Process

This monorepo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

```bash
# Create a changeset
pnpm changeset

# Version packages
pnpm changeset version

# Build and publish
pnpm changeset publish
```

Release dependency chain: `js-utils` → `node-utils` → `fluent` → other packages

## License

Distributed under the MIT License. See `LICENSE` for more information.

<!-- CONTACT -->

## Contact

Ignacio Cabrera - [@twitter_handle](https://twitter.com/cabrerabywaters) - <ignacio.cabrera@goatlab.io>

<!-- ACKNOWLEDGEMENTS -->

<!-- ACKNOWLEDGMENTS -->

## Acknowledgments

This library is based on the work of other Authors and Open Source Libraries. Have a look at them and give them a well deserved Star ⭐!

- [sindresorhus - p-map](https://github.com/sindresorhus/p-map)
- [sindresorhus - p-props](https://github.com/sindresorhus/p-props)
- [Natural Cycles - NodeJS](https://github.com/NaturalCycles/nodejs-lib)
- [Natural Cycles - JS-Lib](https://github.com/NaturalCycles/js-lib)

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[stars-shield]: https://img.shields.io/github/stars/goat-io/fluent?style=flat-square
[stars-url]: https://github.com/goat-io/fluent/stargazers
[issues-shield]: https://img.shields.io/github/issues/goat-io/fluent?style=flat-square
[issues-url]: https://github.com/goat-io/fluent/issues
[license-shield]: https://img.shields.io/github/license/goat-io/fluent?style=flat-square
[license-url]: https://github.com/goat-io/fluent/blob/master/LICENSE.txt
