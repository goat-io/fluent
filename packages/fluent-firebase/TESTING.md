# Firebase Testing Setup

This document describes how to run tests for the fluent-firebase package.

## Docker Setup

The package includes a Firebase emulator Docker setup that can be used for testing:

### Building the Firebase Emulator Docker Image

```bash
make build.firebase
docker tag goatlab/firebase-emulator:latest goatlab/firebase-emulator:1.2
```

### Manual Testing with Docker

You can start the Firebase emulator manually for testing:

```bash
docker run -p 8080:8080 -p 9099:9099 -p 4000:4000 goatlab/firebase-emulator:1.2
```

This will start:
- Firestore emulator on port 8080
- Auth emulator on port 9099
- Firebase UI on port 4000

## Test Structure

The package includes:

1. **Firebase Test Container** (`src/test/firebase.testcontainer.ts`)
   - Manages Docker container lifecycle
   - Sets up emulator environment variables
   - Provides port mapping

2. **Repository Factories** (`src/test/repository.factory.ts`)
   - `FirebaseGoatRepositoryFactory` - For basic tests
   - `FirebaseTypeOrmRepositoryFactory` - For advanced tests

3. **Test Suites**
   - `src/test/testsuites/basicTestSuite.ts` - Basic CRUD operations
   - `src/test/testsuites/advancedTestSuite.ts` - Complex queries and filtering

4. **Main Test File** (`src/test/firebaseConnector.spec.ts`)
   - Orchestrates container setup
   - Runs test suites

## Running Tests

### Prerequisites

1. Docker must be running
2. Firebase emulator Docker image must be built

### Execute Tests

```bash
pnpm test
```

## Current Limitations

### Build Issues

There are currently TypeScript compilation issues due to Zod version conflicts in the fluent package dependencies. The Zod v4 library uses newer TypeScript syntax (`const` in generics) that conflicts with TypeScript 4.6.3.

**Workaround**: Tests can be run using ts-jest which handles compilation differently, but the build command may fail.

### Testcontainers Integration

The current testcontainers setup may encounter ES module compatibility issues with Jest. Alternative approaches:

1. Use the Docker image manually and run tests against it
2. Use Firebase emulator CLI directly
3. Use a real Firebase project for integration testing

## Manual Setup for Testing

If automated Docker setup doesn't work, you can run tests manually:

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Start emulators: `firebase emulators:start --only firestore,auth`
3. Set environment variables:
   ```bash
   export FIRESTORE_EMULATOR_HOST=localhost:8080
   export FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
   ```
4. Run tests: `pnpm test`

## Test Coverage

The test suites cover:

- **Basic Operations**: insert, insertMany, findById, findByIds, findMany, findFirst, updateById, replaceById, deleteById
- **Query Features**: where clauses, select fields, orderBy, limit, offset
- **Advanced Queries**: AND/OR conditions, nested field queries, comparison operators
- **Data Validation**: Input/output schema validation
- **Error Handling**: Required field validation, not found scenarios

## Usage Example

```typescript
import { FirebaseGoatRepositoryFactory } from './repository.factory'

const repository = new FirebaseGoatRepositoryFactory()

// Insert data
const goat = await repository.insert({ name: 'TestGoat', age: 5 })

// Query data
const goats = await repository.findMany({
  where: { age: { greaterThan: 3 } },
  orderBy: [{ name: 'asc' }],
  limit: 10
})
```