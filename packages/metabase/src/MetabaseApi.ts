import { deleteAllCollections } from './actions/collections/deleteAllCollections'
import { deleteCollection } from './actions/collections/deleteCollection'
import { getOrCreateCollection } from './actions/collections/getOrCreateCollection'
import { getOrCreateDashboard } from './actions/dashboards/getOrCreateDashboard'
import { createGroup } from './actions/groups/createGroup'
import {
  disableAllDatabaseAccess,
  disableAllUsersGroupDatabaseAccess,
} from './actions/groups/disableAllDatabaseAccess'
import { grantDatabaseAccessByPrefix } from './actions/groups/grantDatabaseAccessByPrefix'
import { getOrCreateGroup } from './actions/groups/getOrCreateGroup'
import { listGroups } from './actions/groups/listGroups'
import { setDatabasePermissionsForGroup } from './actions/groups/setDatabasePermissionsForGroup'
import { updateGroupPermissions } from './actions/groups/updateGroupPermissions'
import { getOrCreateAccountsQuestion } from './actions/questions/getOrCreateAccountsQuestion'
import { getOrCreateQuestion } from './actions/questions/getOrCreateQuestion'
import { addDataSource } from './admin/addDataSource'
import { createAdminUser } from './admin/createAdminUser'
import { createApiKey } from './admin/createApiKey'
import { deleteSampleDatabase } from './admin/deleteSampleDatabase'
import { disableOnboardingSidebar } from './admin/disableOnboardingSidebar'
import { disableTracking } from './admin/disableTracking'
import { enableActionsInDatasource } from './admin/enableActionsInDatasource'
import { enableEmbeddings } from './admin/enableEmbeddings'
import { getEmbeddingSecretKey } from './admin/getEmbeddingSecretKey'
import { loginAdminUser } from './admin/loginAdminUser'
import { waitForMetabase } from './admin/waitForMetabase'

/**
 * Context object containing authentication and connection details for Metabase API
 */
interface MetabaseContext {
  baseUrl: string
  sessionToken?: string // Session-based authentication
  apiKey?: string // API key authentication (preferred for automation)
}

// Type helper to extract remaining properties after context binding
type Rest<Ctx, A> = Omit<A, keyof Ctx>

/**
 * Creates a curried function that binds context properties to API methods.
 * This enables cleaner API design by pre-filling common parameters.
 *
 * @example
 * const withAuth = bindCtx({ baseUrl, sessionToken })
 * const enableEmbeddings = withAuth(enableEmbeddingsImpl)
 * // Now can call: enableEmbeddings() instead of enableEmbeddings({ baseUrl, sessionToken })
 */
function bindCtx<Ctx extends object>(ctx: Ctx) {
  type Callable<F extends (a: any) => any> =
    Rest<Ctx, Parameters<F>[0]> extends Record<string, never>
      ? () => ReturnType<F>
      : (arg: Rest<Ctx, Parameters<F>[0]>) => ReturnType<F>

  return <F extends (a: any) => any>(fn: F): Callable<F> =>
    ((arg?: object) =>
      fn({ ...ctx, ...(arg ?? {}) } as Parameters<F>[0])) as any
}

/**
 * Main API client for interacting with Metabase instance.
 * Provides a fluent interface for admin operations and collection management.
 */
export class MetabaseApi {
  private readonly ctx: MetabaseContext
  private withCtx!: ReturnType<typeof bindCtx<MetabaseContext>>

  constructor({
    sessionToken,
    apiKey,
    baseUrl,
  }: {
    sessionToken?: string
    apiKey?: string
    baseUrl: string
  }) {
    // Validate required parameters
    if (!baseUrl) {
      throw new Error('baseUrl is required for MetabaseApi')
    }
    if (!sessionToken && !apiKey) {
      throw new Error('Either sessionToken or apiKey must be provided')
    }

    this.ctx = { baseUrl, sessionToken, apiKey }
    this.withCtx = bindCtx(this.ctx)
  }

  // Static methods for pre-authentication operations
  static waitForMetabase = waitForMetabase
  static createAdminUser = createAdminUser
  static loginAdminUser = loginAdminUser

  /**
   * Admin operations requiring elevated privileges
   */
  get admin() {
    return {
      enableEmbeddings: this.withCtx(enableEmbeddings),
      deleteSampleDatabase: this.withCtx(deleteSampleDatabase),
      disableOnboardingSidebar: this.withCtx(disableOnboardingSidebar),
      addDataSource: this.withCtx(addDataSource),
      enableActionsInDatasource: this.withCtx(enableActionsInDatasource),
      createApiKey: this.withCtx(createApiKey),
      getEmbeddingSecretKey: this.withCtx(getEmbeddingSecretKey),
      disableTracking: this.withCtx(disableTracking),
    }
  }

  /**
   * Collection management operations
   */
  get collections() {
    return {
      getOrCreate: this.withCtx(getOrCreateCollection),
      delete: this.withCtx(deleteCollection),
      deleteAll: this.withCtx(deleteAllCollections),
    }
  }

  /**
   * Question (card) management operations
   */
  get questions() {
    return {
      getOrCreate: this.withCtx(getOrCreateQuestion),
      getOrCreateAccounts: this.withCtx(getOrCreateAccountsQuestion),
    }
  }

  /**
   * Dashboard management operations
   */
  get dashboards() {
    return {
      getOrCreate: this.withCtx(getOrCreateDashboard),
    }
  }

  /**
   * Permission group management operations
   */
  get groups() {
    return {
      create: this.withCtx(createGroup),
      getOrCreate: this.withCtx(getOrCreateGroup),
      list: this.withCtx(listGroups),
      disableAllDatabaseAccess: this.withCtx(disableAllDatabaseAccess),
      disableAllUsersGroupDatabaseAccess: this.withCtx(
        disableAllUsersGroupDatabaseAccess,
      ),
      grantDatabaseAccessByPrefix: this.withCtx(grantDatabaseAccessByPrefix),
      setDatabasePermissionsForGroup: this.withCtx(setDatabasePermissionsForGroup),
      updatePermissions: this.withCtx(updateGroupPermissions),
    }
  }
}
