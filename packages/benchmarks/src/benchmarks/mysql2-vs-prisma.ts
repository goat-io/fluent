import { DatabaseConnections } from '../database/connections';
import { createBenchmarkRunner } from '../core/BenchmarkRunner';
import { BenchmarkReporter } from '../core/Reporter';
import { DatabaseConfig, QueryBenchmark } from '../types';
import { SeedData } from '../setup/seedData';

export class MySQL2VsPrismaBenchmark {
  private config: DatabaseConfig;
  private runner = createBenchmarkRunner();
  private reporter = new BenchmarkReporter();

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async runBenchmarks(): Promise<void> {
    console.log('🚀 Starting MySQL2 vs Prisma Benchmark Suite\n');

    // Test connections
    console.log('🔌 Testing database connections...');
    const connected = await DatabaseConnections.testConnections(this.config);
    if (!connected) {
      throw new Error('Failed to connect to database');
    }
    console.log('✅ Database connections established\n');

    // Setup test data
    console.log('🌱 Setting up test data...');
    const seeder = new SeedData(this.config);
    await seeder.seedDatabase(10000);
    console.log('✅ Test data ready\n');

    // Define benchmark queries
    const queryBenchmarks: QueryBenchmark[] = [
      {
        name: 'Simple Select',
        description: 'SELECT * FROM users LIMIT 100',
        query: 'SELECT * FROM users LIMIT 100',
        expectedResults: 100,
      },
      {
        name: 'Filtered Select',
        description: 'SELECT * FROM users WHERE status = ? AND age > ?',
        query: 'SELECT * FROM users WHERE status = ? AND age > ?',
        params: ['active', 25],
      },
      {
        name: 'Join Query',
        description: 'Users with their orders',
        query: `
          SELECT u.id, u.email, u.first_name, u.last_name, 
                 COUNT(o.id) as order_count, SUM(o.total_amount) as total_spent
          FROM users u
          LEFT JOIN orders o ON u.id = o.user_id
          WHERE u.status = 'active'
          GROUP BY u.id
          LIMIT 50
        `,
        params: [],
      },
      {
        name: 'Complex Join',
        description: 'Products with categories and review stats',
        query: `
          SELECT p.id, p.name, p.price, c.name as category_name,
                 COUNT(r.id) as review_count, AVG(r.rating) as avg_rating
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          LEFT JOIN reviews r ON p.id = r.product_id
          WHERE p.is_active = true
          GROUP BY p.id
          ORDER BY avg_rating DESC
          LIMIT 100
        `,
        params: [],
      },
      {
        name: 'Insert Operation',
        description: 'INSERT INTO users',
        query: 'INSERT INTO users (email, first_name, last_name, status, age, country) VALUES (?, ?, ?, ?, ?, ?)',
        params: ['test@example.com', 'Test', 'User', 'active', 30, 'US'],
      },
      {
        name: 'Update Operation',
        description: 'UPDATE users SET age = ? WHERE id = ?',
        query: 'UPDATE users SET age = ? WHERE id = ?',
        params: [35, 1],
      },
    ];

    // Run benchmarks for each query
    for (const queryBenchmark of queryBenchmarks) {
      console.log(`\n📊 Benchmarking: ${queryBenchmark.name}`);
      await this.runQueryBenchmark(queryBenchmark);
    }

    // Cleanup
    await DatabaseConnections.closeConnections();
    console.log('\n✅ Benchmark suite completed!');
  }

  private async runQueryBenchmark(queryBenchmark: QueryBenchmark): Promise<void> {
    const mysql2Conn = await DatabaseConnections.getMysql2Connection(this.config);
    const prisma = await DatabaseConnections.getPrismaClient();

    // MySQL2 benchmark
    const mysql2Result = await this.runner.run(
      async () => {
        if (queryBenchmark.name === 'Simple Select') {
          await mysql2Conn.execute('SELECT * FROM users LIMIT 100');
        } else if (queryBenchmark.name === 'Filtered Select') {
          await mysql2Conn.execute(
            'SELECT * FROM users WHERE status = ? AND age > ?',
            ['active', 25]
          );
        } else if (queryBenchmark.name === 'Join Query') {
          await mysql2Conn.execute(`
            SELECT u.id, u.email, u.first_name, u.last_name, 
                   COUNT(o.id) as order_count, SUM(o.total_amount) as total_spent
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            WHERE u.status = 'active'
            GROUP BY u.id
            LIMIT 50
          `);
        } else if (queryBenchmark.name === 'Complex Join') {
          await mysql2Conn.execute(`
            SELECT p.id, p.name, p.price, c.name as category_name,
                   COUNT(r.id) as review_count, AVG(r.rating) as avg_rating
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN reviews r ON p.id = r.product_id
            WHERE p.is_active = true
            GROUP BY p.id
            ORDER BY avg_rating DESC
            LIMIT 100
          `);
        } else if (queryBenchmark.name === 'Insert Operation') {
          const randomId = Math.floor(Math.random() * 1000000);
          await mysql2Conn.execute(
            'INSERT INTO users (email, first_name, last_name, status, age, country) VALUES (?, ?, ?, ?, ?, ?)',
            [`test${randomId}@example.com`, 'Test', 'User', 'active', 30, 'US']
          );
        } else if (queryBenchmark.name === 'Update Operation') {
          const randomId = Math.floor(Math.random() * 1000) + 1;
          await mysql2Conn.execute(
            'UPDATE users SET age = ? WHERE id = ?',
            [Math.floor(Math.random() * 50) + 18, randomId]
          );
        }
      },
      {
        name: `MySQL2 - ${queryBenchmark.name}`,
        description: queryBenchmark.description,
        iterations: 1000,
        warmupRuns: 100,
        concurrency: 1,
      }
    );

    // Prisma benchmark
    const prismaResult = await this.runner.run(
      async () => {
        if (queryBenchmark.name === 'Simple Select') {
          await prisma.user.findMany({
            take: 100,
          });
        } else if (queryBenchmark.name === 'Filtered Select') {
          await prisma.user.findMany({
            where: {
              status: 'active',
              age: { gt: 25 },
            },
          });
        } else if (queryBenchmark.name === 'Join Query') {
          await prisma.user.findMany({
            where: { status: 'active' },
            include: {
              orders: {
                select: {
                  id: true,
                  totalAmount: true,
                },
              },
            },
            take: 50,
          });
        } else if (queryBenchmark.name === 'Complex Join') {
          await prisma.product.findMany({
            where: { isActive: true },
            include: {
              category: {
                select: { name: true },
              },
              reviews: {
                select: {
                  rating: true,
                },
              },
            },
            take: 100,
          });
        } else if (queryBenchmark.name === 'Insert Operation') {
          const randomId = Math.floor(Math.random() * 1000000);
          await prisma.user.create({
            data: {
              email: `test${randomId}@example.com`,
              firstName: 'Test',
              lastName: 'User',
              status: 'active',
              age: 30,
              country: 'US',
            },
          });
        } else if (queryBenchmark.name === 'Update Operation') {
          const randomId = Math.floor(Math.random() * 1000) + 1;
          await prisma.user.update({
            where: { id: randomId },
            data: { age: Math.floor(Math.random() * 50) + 18 },
          });
        }
      },
      {
        name: `Prisma - ${queryBenchmark.name}`,
        description: queryBenchmark.description,
        iterations: 1000,
        warmupRuns: 100,
        concurrency: 1,
      }
    );

    // Display results
    this.reporter.compareResults([mysql2Result, prismaResult]);
  }
}

// Main execution
async function main() {
  const config: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'benchmark_db',
  };

  const benchmark = new MySQL2VsPrismaBenchmark(config);
  await benchmark.runBenchmarks();
}

if (require.main === module) {
  main().catch(console.error);
}