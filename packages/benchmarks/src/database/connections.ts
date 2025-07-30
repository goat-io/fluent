import { PrismaClient } from '@prisma/client'
import mysql from 'mysql2/promise'
import { DatabaseConfig } from '../types'

export class DatabaseConnections {
  private static mysql2Connection: mysql.Connection | null = null
  private static prismaClient: PrismaClient | null = null

  static async getMysql2Connection(
    config: DatabaseConfig
  ): Promise<mysql.Connection> {
    if (!DatabaseConnections.mysql2Connection) {
      DatabaseConnections.mysql2Connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        namedPlaceholders: true
      })
    }
    return DatabaseConnections.mysql2Connection
  }

  static async getPrismaClient(): Promise<PrismaClient> {
    if (!DatabaseConnections.prismaClient) {
      DatabaseConnections.prismaClient = new PrismaClient({
        log: ['error'] // Minimal logging for benchmarks
      })
      await DatabaseConnections.prismaClient.$connect()
    }
    return DatabaseConnections.prismaClient
  }

  static async closeConnections(): Promise<void> {
    if (DatabaseConnections.mysql2Connection) {
      await DatabaseConnections.mysql2Connection.end()
      DatabaseConnections.mysql2Connection = null
    }

    if (DatabaseConnections.prismaClient) {
      await DatabaseConnections.prismaClient.$disconnect()
      DatabaseConnections.prismaClient = null
    }
  }

  static async testConnections(config: DatabaseConfig): Promise<boolean> {
    try {
      // Test MySQL2 connection
      const mysql2Conn = await DatabaseConnections.getMysql2Connection(config)
      await mysql2Conn.execute('SELECT 1')

      // Test Prisma connection
      const prisma = await DatabaseConnections.getPrismaClient()
      await prisma.$queryRaw`SELECT 1`

      return true
    } catch (error) {
      console.error('Database connection test failed:', error)
      return false
    }
  }
}
