import { DataSource } from 'loopback-datasource-juggler';

export default class RepositoryHelper {
  public readonly dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  async query(sql: string, params?: any, options?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const connector = this.dataSource.connector!;
      connector.execute!(sql, params, options, (err: any, ...results: any) => {
        if (err) {
          return reject(err);
        }

        // Results are returned in nested array for some reason
        results = results[0];

        if (results.length === 0) {
          return resolve([]);
        }

        resolve(results);
      });
    });
  }
}
