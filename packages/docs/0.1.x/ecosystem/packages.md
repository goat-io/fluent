# Package Architecture

The Fluent ecosystem follows a **modular monorepo architecture** with clear separation of concerns and well-defined dependency chains. Each package is designed to work independently while providing enhanced functionality when used together.

## 🏗️ Architectural Principles

### **1. Dependency Hierarchy**
Packages are organized in a clear dependency tree to avoid circular dependencies:

```
Foundation Layer:
├── @goat-io/js-utils          (Browser & Node.js utilities)
├── @goat-io/js-html           (HTML processing)
├── @goat-io/node-xlsx         (Excel processing)
└── @goat-io/node-metascraper  (Web scraping)

Core Layer:
├── @goat-io/node-utils        (extends js-utils)
├── @goat-io/node-backend      (extends js-utils)
└── @goat-io/formio-utils      (extends js-utils)

Application Layer:
├── @goat-io/fluent            (extends node-utils)
├── @goat-io/queue-core        (extends node-utils)
├── @goat-io/queue-node        (extends queue-core)
├── @goat-io/uploads           (extends node-utils)
└── @goat-io/tasks-core        (extends node-utils)

Connector Layer:
├── @goat-io/fluent-firebase   (extends fluent)
├── @goat-io/fluent-loki       (extends fluent)
├── @goat-io/fluent-pouchdb    (extends fluent)
└── @goat-io/fluent-formio     (extends fluent)

Task Processing Layer:
├── @goat-io/tasks-adapter-gcp     (extends tasks-core)
└── @goat-io/tasks-adapter-hatchet (extends tasks-core)

Development Tools:
├── @goat-io/benchmarks        (testing & performance)
└── @goat-io/eslint           (code quality)
```

### **2. Package Categories**

#### **Foundation Packages**
These provide core utilities and have no dependencies on other Fluent packages:

- **js-utils**: Core browser and Node.js utilities
- **js-html**: HTML processing and sanitization
- **node-xlsx**: Excel file processing
- **node-metascraper**: Web scraping utilities

#### **Core Packages**
These extend foundation packages with more specific functionality:

- **node-utils**: Node.js-specific utilities (extends js-utils)
- **node-backend**: Backend utilities and caching (extends js-utils)
- **formio-utils**: Form.io integration utilities (extends js-utils)

#### **Application Packages**
These provide major application functionality:

- **fluent**: Query builder and database abstraction
- **queue-core**: Queue processing abstractions
- **uploads**: File upload utilities
- **tasks-core**: Task processing abstractions

#### **Connector Packages**
These extend the core fluent package with specific database support:

- **fluent-firebase**: Firebase/Firestore connector
- **fluent-loki**: LokiJS connector
- **fluent-pouchdb**: PouchDB connector
- **fluent-formio**: Form.io connector

#### **Development Tools**
These provide development and testing utilities:

- **benchmarks**: Performance testing suite
- **eslint**: TypeScript-aware linting configuration

## 📦 Package Details

### **Foundation Layer**

#### **@goat-io/js-utils**
- **Purpose**: Core utilities for browser and Node.js
- **Dependencies**: None
- **Key Features**: Arrays, Objects, Strings, HTTP client, Promises, Validation
- **Bundle Size**: ~50KB minified

#### **@goat-io/js-html**
- **Purpose**: HTML processing and sanitization
- **Dependencies**: None
- **Key Features**: HTML parsing, link detection, content cleaning
- **Bundle Size**: ~15KB minified

#### **@goat-io/node-xlsx**
- **Purpose**: Excel file processing
- **Dependencies**: None
- **Key Features**: Streaming Excel processing, memory optimization
- **Bundle Size**: ~25KB minified

#### **@goat-io/node-metascraper**
- **Purpose**: Web scraping and metadata extraction
- **Dependencies**: None
- **Key Features**: Link previews, asset metadata, social cards
- **Bundle Size**: ~30KB minified

### **Core Layer**

#### **@goat-io/node-utils**
- **Purpose**: Node.js-specific utilities
- **Dependencies**: js-utils
- **Key Features**: JWT, Security, Streams, Files, Processes
- **Bundle Size**: ~40KB minified

#### **@goat-io/node-backend**
- **Purpose**: Backend utilities and caching
- **Dependencies**: js-utils
- **Key Features**: Redis LRU cache, session management
- **Bundle Size**: ~20KB minified

#### **@goat-io/formio-utils**
- **Purpose**: Form.io integration utilities
- **Dependencies**: js-utils
- **Key Features**: Form parsing, validation, code generation
- **Bundle Size**: ~35KB minified

### **Application Layer**

#### **@goat-io/fluent**
- **Purpose**: Query builder and database abstraction
- **Dependencies**: node-utils
- **Key Features**: Type-safe queries, multi-database support
- **Bundle Size**: ~80KB minified

#### **@goat-io/queue-core**
- **Purpose**: Queue processing abstractions
- **Dependencies**: node-utils
- **Key Features**: Universal queue interface, message brokers
- **Bundle Size**: ~25KB minified

#### **@goat-io/uploads**
- **Purpose**: File upload utilities
- **Dependencies**: node-utils
- **Key Features**: Multi-cloud uploads (S3, GCP, Azure)
- **Bundle Size**: ~30KB minified

#### **@goat-io/tasks-core**
- **Purpose**: Task processing abstractions
- **Dependencies**: node-utils
- **Key Features**: Type-safe task definitions, status tracking
- **Bundle Size**: ~20KB minified

## 🔄 Release Strategy

### **Versioning**
All packages follow **semantic versioning** (semver) with coordinated releases:

- **Major versions**: Breaking changes across ecosystem
- **Minor versions**: New features, backward compatible
- **Patch versions**: Bug fixes and small improvements

### **Release Process**
Using **changesets** for coordinated releases:

1. **Foundation packages** are released first
2. **Core packages** follow (depend on foundation)
3. **Application packages** are released next
4. **Connector packages** are released last

### **Dependency Management**
Each package specifies exact version ranges for Fluent dependencies:

```json
{
  "dependencies": {
    "@goat-io/js-utils": "^0.5.0",
    "@goat-io/node-utils": "^0.5.0"
  }
}
```

## 🎯 Installation Strategies

### **Individual Package Installation**
Install only what you need:

```bash
# Just utilities
npm install @goat-io/js-utils @goat-io/node-utils

# Just query builder
npm install @goat-io/fluent

# Just queue processing
npm install @goat-io/queue-core
```

### **Feature-Based Installation**
Install related packages for specific features:

```bash
# Database operations
npm install @goat-io/fluent @goat-io/fluent-firebase

# File processing
npm install @goat-io/uploads @goat-io/node-xlsx

# Background processing
npm install @goat-io/queue-core @goat-io/tasks-core
```

### **Complete Ecosystem Installation**
Install the full ecosystem:

```bash
# Core ecosystem
npm install @goat-io/fluent @goat-io/js-utils @goat-io/node-utils @goat-io/queue-core @goat-io/uploads

# With connectors
npm install @goat-io/fluent-firebase @goat-io/fluent-loki @goat-io/tasks-adapter-gcp
```

## 🔧 Package Development

### **Adding New Packages**
New packages must follow the established patterns:

1. **Choose appropriate layer** based on dependencies
2. **Follow naming conventions** (@goat-io/package-name)
3. **Use shared TypeScript configuration** from @goat-io/tsconfig
4. **Include comprehensive tests** and documentation
5. **Follow release process** with changesets

### **Dependency Guidelines**
- **Minimize dependencies** between packages
- **Use peer dependencies** for optional integrations
- **Avoid circular dependencies** at all costs
- **Document all dependencies** and their purpose

### **Testing Strategy**
Each package includes:
- **Unit tests** for individual functions
- **Integration tests** for package interactions
- **Performance benchmarks** where applicable
- **Type checking** with TypeScript

## 🎨 Integration Examples

### **Cross-Package Usage**
```typescript
import { Arrays, HttpClient } from '@goat-io/js-utils';
import { JWT, StreamProcessor } from '@goat-io/node-utils';
import { Fluent } from '@goat-io/fluent';
import { Queue } from '@goat-io/queue-core';

// All packages work together seamlessly
const users = await db.collection('users').find();
const grouped = Arrays.groupBy(users, 'department');
const token = JWT.sign({ userId: users[0].id });
```

### **Package-Specific Features**
```typescript
// Each package provides specialized functionality
import { ExcelProcessor } from '@goat-io/node-xlsx';
import { HtmlProcessor } from '@goat-io/js-html';
import { UploadService } from '@goat-io/uploads';

// Process Excel file, clean HTML, and upload result
const processor = new ExcelProcessor();
const html = new HtmlProcessor();
const uploads = new UploadService();
```

## 🔍 Package Selection Guide

### **For Web Development**
- **js-utils**: Core utilities
- **js-html**: HTML processing
- **fluent**: Database operations

### **For Backend Development**
- **node-utils**: Node.js utilities
- **fluent**: Database operations
- **queue-core**: Background processing
- **uploads**: File handling

### **For Data Processing**
- **node-xlsx**: Excel processing
- **node-metascraper**: Web scraping
- **node-utils**: Stream processing

### **For Enterprise Applications**
- **Complete ecosystem**: All packages
- **Security focus**: node-utils, fluent
- **Performance focus**: benchmarks, queue-core

The modular architecture ensures you can start small and grow your usage as needed, while maintaining consistency and type safety across your entire application.