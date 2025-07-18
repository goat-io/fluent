import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import { DatabaseConfig } from '../types';

export class DatabaseConnections {
  private static mysql2Connection: mysql.Connection | null = null;
  private static prismaClient: PrismaClient | null = null;

  static async getMysql2Connection(config: DatabaseConfig): Promise<mysql.Connection> {
    if (!this.mysql2Connection) {
      this.mysql2Connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        namedPlaceholders: true,
      });
    }
    return this.mysql2Connection;
  }

  static async getPrismaClient(): Promise<PrismaClient> {
    if (!this.prismaClient) {
      this.prismaClient = new PrismaClient({
        log: ['error'], // Minimal logging for benchmarks
      });
      await this.prismaClient.$connect();
    }
    return this.prismaClient;
  }

  static async closeConnections(): Promise<void> {
    if (this.mysql2Connection) {
      await this.mysql2Connection.end();
      this.mysql2Connection = null;
    }

    if (this.prismaClient) {
      await this.prismaClient.$disconnect();
      this.prismaClient = null;
    }
  }

  static async testConnections(config: DatabaseConfig): Promise<boolean> {
    try {
      // Test MySQL2 connection
      const mysql2Conn = await this.getMysql2Connection(config);
      await mysql2Conn.execute('SELECT 1');

      // Test Prisma connection
      const prisma = await this.getPrismaClient();
      await prisma.$queryRaw`SELECT 1`;

      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
}