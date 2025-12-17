# @goatlab/tasks-adapter-bullmq

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
