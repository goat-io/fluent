# @goatlab/tasks-adapter-bullmq

## 0.9.4

### Patch Changes

- Updated dependencies
  - @goatlab/tasks-core@0.14.9
  - @goatlab/js-utils@0.10.3
  - @goatlab/node-utils@0.11.2

## 0.9.3

### Patch Changes

- Updated dependencies
  - @goatlab/tasks-core@0.14.8

## 0.9.2

### Patch Changes

- Updated dependencies
  - @goatlab/tasks-core@0.14.7

## 0.8.1

### Patch Changes

- Fix CROSSSLOT errors on Redis Cluster: auto-wrap BullMQ prefix in {} hash tags when redisInstance is a Cluster

## 0.8.0

### Minor Changes

- Add Redis Cluster support for GCP Memorystore Valkey compatibility

  - node-backend: RedisConnectionPool.getClusterConnection() pools ioredis.Cluster instances with useRedisSets:false (MULTI/EXEC breaks on cluster)
  - node-backend: LazyRedisStore accepts optional ClusterConfig for deferred cluster connections
  - node-backend: Cache accepts cluster option and flush() uses per-node SCAN instead of keys() on cluster
  - node-backend: Export ClusterNode, ClusterOptions, CacheClusterConfig types
  - tasks-adapter-bullmq: BullMQConnectorConfig accepts redisInstance (pre-built ioredis Redis or Cluster)
  - tasks-adapter-bullmq: forTenant() propagates redisInstance for shared cluster connections

## 0.7.1

### Patch Changes

- Updated dependencies
  - @goatlab/tasks-core@0.14.6

## 0.2.6

### Patch Changes

- Updated dependencies
  - @goatlab/tasks-core@0.6.1

## 0.2.5

### Patch Changes

- Updated dependencies
  - @goatlab/tasks-core@0.6.0

## 0.2.4

### Patch Changes

- Updated dependencies
  - @goatlab/tasks-core@0.5.0

## 0.2.3

### Patch Changes

- Updated dependencies
  - @goatlab/js-utils@0.10.3
  - @goatlab/node-utils@0.11.1
  - @goatlab/tasks-core@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies
  - @goatlab/node-utils@0.11.0

## 0.2.1

### Patch Changes

- Fix BullMQ tenant prefix to preserve 'bull' prefix. Keys now use pattern `tenantId:bull:queueName:*` instead of just `tenantId:queueName:*` for proper Redis ACL compatibility.

## 0.2.0

### Minor Changes

- Add multi-tenant support to all task adapters

  - Added `tenantId` property to TaskConnector interface
  - Added `forTenant(tenantId, credentials?)` method for creating tenant-scoped connectors
  - Added `TenantCredentials` type for optional per-tenant authentication
  - Added shared multi-tenant test suite in `@goatlab/tasks-core/test-suite`
  - Added `testPostUrl` option to multi-tenant test suite for HTTP callback adapters

  **BullMQ Adapter:**

  - Tenant isolation via Redis key prefix (`tenantId:queueName:*`)
  - Compatible with Redis ACL patterns (`~tenantId:*`)
  - Prefix applied to both Queue and Worker instances

  **Hatchet Adapter:**

  - Tenant isolation via Hatchet namespace feature
  - Shares same token across tenants (no separate auth required)

  **GCP Cloud Tasks Adapter:**

  - Tenant isolation via task name prefix (`tenantId-taskName`)
  - Avoids queue creation overhead (all tenants share same queue)
  - Added `enablePayloadCache` option for testing (GCP removes completed tasks immediately)

### Patch Changes

- Updated dependencies
  - @goatlab/tasks-core@0.4.0
