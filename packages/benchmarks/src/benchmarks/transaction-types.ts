export interface TransactionMix {
  name: string
  weight: number // Percentage of workload (0-100)
  complexity: 'simple' | 'moderate' | 'complex'
  description: string
}

export interface ThinkTimeConfig {
  keyingTime: { min: number; max: number } // Time to input/prepare data (ms)
  thinkingTime: { min: number; max: number } // Time to process results (ms)
  distribution: 'uniform' | 'exponential' | 'normal'
}

export interface WorkloadProfile {
  name: string
  description: string
  transactions: TransactionMix[]
  thinkTime: ThinkTimeConfig
  targetThroughput?: number // Target operations per second
}

// Standard OLTP workload based on TPC-C patterns
export const OLTP_WORKLOAD: WorkloadProfile = {
  name: 'OLTP Standard',
  description:
    'Transaction processing workload with mixed read/write operations',
  transactions: [
    {
      name: 'simpleSelect',
      weight: 35,
      complexity: 'simple',
      description: 'Quick lookups and point queries'
    },
    {
      name: 'filteredSelect',
      weight: 25,
      complexity: 'moderate',
      description: 'Filtered queries with conditions'
    },
    {
      name: 'joinQuery',
      weight: 20,
      complexity: 'complex',
      description: 'Multi-table joins with aggregation'
    },
    {
      name: 'insert',
      weight: 15,
      complexity: 'moderate',
      description: 'Single record insertions'
    },
    {
      name: 'complexJoin',
      weight: 5,
      complexity: 'complex',
      description: 'Complex analytical queries'
    }
  ],
  thinkTime: {
    keyingTime: { min: 100, max: 500 },
    thinkingTime: { min: 300, max: 1500 },
    distribution: 'exponential'
  }
}

// E-commerce workload pattern
export const ECOMMERCE_WORKLOAD: WorkloadProfile = {
  name: 'E-Commerce',
  description: 'Read-heavy e-commerce workload with occasional writes',
  transactions: [
    {
      name: 'simpleSelect',
      weight: 45,
      complexity: 'simple',
      description: 'Product browsing and search'
    },
    {
      name: 'filteredSelect',
      weight: 30,
      complexity: 'moderate',
      description: 'Category filtering and search'
    },
    {
      name: 'joinQuery',
      weight: 15,
      complexity: 'complex',
      description: 'Cart and order queries'
    },
    {
      name: 'insert',
      weight: 8,
      complexity: 'moderate',
      description: 'Order placement'
    },
    {
      name: 'complexJoin',
      weight: 2,
      complexity: 'complex',
      description: 'Analytics and reporting'
    }
  ],
  thinkTime: {
    keyingTime: { min: 200, max: 1000 },
    thinkingTime: { min: 1000, max: 5000 },
    distribution: 'normal'
  }
}

// Analytics workload pattern
export const ANALYTICS_WORKLOAD: WorkloadProfile = {
  name: 'Analytics',
  description: 'Read-heavy analytical workload with complex queries',
  transactions: [
    {
      name: 'complexJoin',
      weight: 40,
      complexity: 'complex',
      description: 'Complex analytical queries'
    },
    {
      name: 'joinQuery',
      weight: 35,
      complexity: 'complex',
      description: 'Aggregation queries'
    },
    {
      name: 'filteredSelect',
      weight: 20,
      complexity: 'moderate',
      description: 'Filtered data exploration'
    },
    {
      name: 'simpleSelect',
      weight: 5,
      complexity: 'simple',
      description: 'Quick data checks'
    }
  ],
  thinkTime: {
    keyingTime: { min: 500, max: 2000 },
    thinkingTime: { min: 5000, max: 30000 },
    distribution: 'uniform'
  }
}

// High-frequency trading pattern
export const HIGH_FREQUENCY_WORKLOAD: WorkloadProfile = {
  name: 'High Frequency',
  description: 'Ultra-low latency workload with minimal think time',
  transactions: [
    {
      name: 'simpleSelect',
      weight: 50,
      complexity: 'simple',
      description: 'Market data queries'
    },
    {
      name: 'insert',
      weight: 30,
      complexity: 'moderate',
      description: 'Trade execution'
    },
    {
      name: 'filteredSelect',
      weight: 20,
      complexity: 'moderate',
      description: 'Position queries'
    }
  ],
  thinkTime: {
    keyingTime: { min: 0, max: 10 },
    thinkingTime: { min: 0, max: 50 },
    distribution: 'uniform'
  },
  targetThroughput: 10000 // 10k ops/sec target
}

// Batch processing pattern
export const BATCH_WORKLOAD: WorkloadProfile = {
  name: 'Batch Processing',
  description: 'Bulk operations with large think times',
  transactions: [
    {
      name: 'batchInsert',
      weight: 60,
      complexity: 'complex',
      description: 'Bulk data import'
    },
    {
      name: 'complexJoin',
      weight: 25,
      complexity: 'complex',
      description: 'Data transformation queries'
    },
    {
      name: 'filteredSelect',
      weight: 15,
      complexity: 'moderate',
      description: 'Data validation queries'
    }
  ],
  thinkTime: {
    keyingTime: { min: 1000, max: 5000 },
    thinkingTime: { min: 2000, max: 10000 },
    distribution: 'normal'
  }
}

// Connection pool stress patterns
export interface ConnectionPoolConfig {
  name: string
  size: number
  acquisitionTimeout: number
  idleTimeout: number
  maxLifetime: number
  validationQuery?: string
}

export const CONNECTION_POOL_CONFIGS: ConnectionPoolConfig[] = [
  {
    name: 'minimal',
    size: 1,
    acquisitionTimeout: 30000,
    idleTimeout: 600000,
    maxLifetime: 1800000
  },
  {
    name: 'small',
    size: 10,
    acquisitionTimeout: 30000,
    idleTimeout: 600000,
    maxLifetime: 1800000
  },
  {
    name: 'medium',
    size: 50,
    acquisitionTimeout: 30000,
    idleTimeout: 300000,
    maxLifetime: 900000
  },
  {
    name: 'large',
    size: 200,
    acquisitionTimeout: 10000,
    idleTimeout: 60000,
    maxLifetime: 300000
  },
  {
    name: 'stress',
    size: 500,
    acquisitionTimeout: 5000,
    idleTimeout: 30000,
    maxLifetime: 120000
  }
]

// Data distribution patterns
export interface DataDistribution {
  type: 'uniform' | 'hotspot' | 'zipfian' | 'temporal'
  parameters: {
    hotspotPercentage?: number // % of queries hitting hot data
    skewFactor?: number // For zipfian distribution (1.0 = highly skewed)
    temporalWindow?: number // Hours of recent data to prefer
  }
}

export const DATA_DISTRIBUTIONS: Record<string, DataDistribution> = {
  uniform: {
    type: 'uniform',
    parameters: {}
  },
  hotspot: {
    type: 'hotspot',
    parameters: {
      hotspotPercentage: 80 // 80% of queries hit 20% of data
    }
  },
  zipfian: {
    type: 'zipfian',
    parameters: {
      skewFactor: 1.2
    }
  },
  temporal: {
    type: 'temporal',
    parameters: {
      temporalWindow: 24 // Prefer last 24 hours
    }
  }
}
