import { Loki, LokiStorageType} from '../Loki'

export const lokiDataSource = Loki.createDb({
  dbName: 'MyLocalDB',
  storage: LokiStorageType.memory
})
