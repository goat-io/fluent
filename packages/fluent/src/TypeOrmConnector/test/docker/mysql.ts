import startContainer, {
  Options as WithContainerOptions,
  killOldContainers
} from './docker'
const {createConnection} = require('mysql2');

const DEFAULT_IMAGE = 'mysql:8.0';
const DEFAULT_CONTAINER_NAME = `fluent-${DEFAULT_IMAGE.replace(':', '-')}-test`
const DEFAULT_CONNECT_TIMEOUT_SECONDS=10
const DEFAULT_MYSQL_PORT = 3306;
const DEFAULT_MYSQL_USER = 'test-user';
const DEFAULT_MYSQL_PASSWORD = 'password'
const DEFAULT_MYSQL_DB = 'test-db'
const DEFAULT_MYSQL_DEBUG =false

export interface Options
  extends Omit<
    WithContainerOptions,
    'internalPort' | 'enableDebugInstructions' | 'testConnection'
  > {
  mysqlUser: string;
  mysqlPassword: string;
  mysqlDb: string;
}

export async function waitForConnection(
  databaseURL: string,
  timeoutSeconds: number,
) {
  const start = Date.now();
  const timeoutMilliseconds = timeoutSeconds * 1000;
  let lastAttempt = false;
  while (true) {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    let conn: any;
    try {
      try {
        await new Promise<void>((resolve, reject) => {
          let errored = false;
          conn = createConnection(databaseURL);
          const createConnectionErr: any = new Error();
          conn.once('connect', () => {
            resolve();
          });
          conn.on('error', (err: any) => {
            if (errored) return;
            errored = true;
            createConnectionErr.message = err.message;
            createConnectionErr.code = err.code;
            createConnectionErr.errno = err.errno;
            createConnectionErr.sqlState = err.sqlState;
            reject(createConnectionErr);
          });
        });
        const result = await new Promise<any>((resolve, reject) => {
          const queryErr: any = new Error();
          conn.query(`SELECT 1 + 1 AS foo;`, (err: any, result: any) => {
            if (err) {
              queryErr.message = err.message;
              reject(queryErr);
            } else {
              resolve(result);
            }
          });
        });
        if (result && result[0] && result[0].foo === 2) {
          break;
        } else {
          if (lastAttempt) {
            throw new Error('Got unexpected result: ' + JSON.stringify(result));
          }
        }
      } catch (ex) {
        if (lastAttempt) {
          throw ex;
        }
      }
    } finally {
      conn.end(() => {
        // ignore error closing connection
      });
    }
    if (Date.now() - timeoutMilliseconds > start) {
      lastAttempt = true;
    }
  }
}

export async function killDatabase(options: Partial<Options> = {}) {
  await killOldContainers({
    debug: DEFAULT_MYSQL_DEBUG,
    containerName: DEFAULT_CONTAINER_NAME,
    ...options,
  });
}

export default async function getDatabase(options: Partial<Options> = {}) {
  const {
    mysqlUser,
    mysqlPassword,
    mysqlDb,
    environment,
    ...rawOptions
  }: Options = {
    debug: DEFAULT_MYSQL_DEBUG,
    image: DEFAULT_IMAGE,
    containerName: DEFAULT_CONTAINER_NAME,
    connectTimeoutSeconds: DEFAULT_CONNECT_TIMEOUT_SECONDS,
    mysqlUser: DEFAULT_MYSQL_USER,
    mysqlPassword: DEFAULT_MYSQL_PASSWORD,
    mysqlDb: DEFAULT_MYSQL_DB,
    defaultExternalPort: DEFAULT_MYSQL_PORT,
    // externalPort: config.test.port,
    ...options,
  };

  const {proc, externalPort, kill} = await startContainer({
    ...rawOptions,
    internalPort: DEFAULT_MYSQL_PORT,
    environment: {
      MYSQL_ALLOW_EMPTY_PASSWORD: 'true',
      MYSQL_HOST: '127.0.0.1',
      MYSQL_ROOT_HOST: '%',
      ...environment,
      MYSQL_USER: mysqlUser,
      MYSQL_ROOT_PASSWORD:mysqlPassword,
      MYSQL_PASSWORD: mysqlPassword,
      MYSQL_DATABASE: mysqlDb,
    },
    enableDebugInstructions: `To view logs, run with MYSQL_TEST_DEBUG=true environment variable.`,
    command: [
        '--default_authentication_plugin=mysql_native_password',
        '--character-set-server=utf8mb4',
        '--collation-server=utf8mb4_unicode_ci'
    ],
    cap_add: 'SYS_NICE'
  });

  const databaseURL = `mysql://${mysqlUser}:${mysqlPassword}@localhost:${externalPort}/${mysqlDb}`;

  await waitForConnection(databaseURL, rawOptions.connectTimeoutSeconds);

  return {
    proc,
    databaseURL,
    kill,
    user: mysqlUser,
    password: mysqlPassword,
    port: externalPort,
    dbName: mysqlDb
  };
}
