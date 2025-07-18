# Aggregation Queries

This guide covers aggregation operations, grouping, and statistical calculations using the Fluent ecosystem.

## Setup

Let's define an e-commerce analytics domain:

```typescript
import { TypeOrmConnector, f, Collection } from '@goatlab/fluent'
import { DataSource } from 'typeorm'
import { z } from 'zod'

// Order entity
@f.entity('orders')
class Order {
  @f.id()
  id: string

  @f.property()
  userId: string

  @f.property()
  total: number

  @f.property()
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

  @f.property()
  items: OrderItem[]

  @f.property()
  shippingAddress: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }

  @f.property()
  createdAt: Date

  @f.property()
  updatedAt: Date
}

// OrderItem entity
@f.entity('order_items')
class OrderItem {
  @f.id()
  id: string

  @f.property()
  orderId: string

  @f.property()
  productId: string

  @f.property()
  quantity: number

  @f.property()
  price: number

  @f.property()
  productName: string

  @f.property()
  productCategory: string
}

// Product entity
@f.entity('products')
class Product {
  @f.id()
  id: string

  @f.property()
  name: string

  @f.property()
  category: string

  @f.property()
  price: number

  @f.property()
  cost: number

  @f.property()
  stockQuantity: number

  @f.property()
  brand: string

  @f.property()
  createdAt: Date
}

// User entity
@f.entity('users')
class User {
  @f.id()
  id: string

  @f.property()
  name: string

  @f.property()
  email: string

  @f.property()
  segment: 'premium' | 'standard' | 'basic'

  @f.property()
  registrationDate: Date

  @f.property()
  lastPurchaseDate: Date
}
```

## Basic Aggregations

### Count Operations

```typescript
// Count total orders
const getTotalOrders = async () => {
  const orders = await orderRepo.findMany({
    select: { id: true }
  })
  return orders.length
}

// Count orders by status
const getOrdersByStatus = async () => {
  const orders = await orderRepo.collect()
  
  return {
    pending: orders.where('status', 'pending').length,
    processing: orders.where('status', 'processing').length,
    shipped: orders.where('status', 'shipped').length,
    delivered: orders.where('status', 'delivered').length,
    cancelled: orders.where('status', 'cancelled').length
  }
}

// Count orders in date range
const getOrdersInDateRange = async (startDate: Date, endDate: Date) => {
  const orders = await orderRepo.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    select: { id: true }
  })
  
  return orders.length
}
```

### Sum Operations

```typescript
// Calculate total revenue
const getTotalRevenue = async () => {
  const orders = await orderRepo.findMany({
    where: { status: 'delivered' },
    select: { total: true }
  })
  
  return orders.reduce((sum, order) => sum + order.total, 0)
}

// Calculate revenue by period
const getRevenueByPeriod = async (startDate: Date, endDate: Date) => {
  const orders = await orderRepo.findMany({
    where: {
      status: 'delivered',
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    select: { total: true }
  })
  
  return orders.reduce((sum, order) => sum + order.total, 0)
}

// Calculate total quantity sold by product
const getTotalQuantitySold = async (productId: string) => {
  const orderItems = await orderItemRepo.findMany({
    where: { productId },
    select: { quantity: true }
  })
  
  return orderItems.reduce((sum, item) => sum + item.quantity, 0)
}
```

### Average Operations

```typescript
// Calculate average order value
const getAverageOrderValue = async () => {
  const orders = await orderRepo.findMany({
    where: { status: 'delivered' },
    select: { total: true }
  })
  
  if (orders.length === 0) return 0
  
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
  return totalRevenue / orders.length
}

// Calculate average order value by user segment
const getAverageOrderValueBySegment = async () => {
  const orders = await orderRepo.findMany({
    where: { status: 'delivered' },
    include: {
      user: {
        select: { segment: true }
      }
    }
  })
  
  const collection = new Collection(orders)
  const groupedBySegment = collection.groupBy(order => order.user.segment)
  
  return Object.entries(groupedBySegment).reduce((acc, [segment, orders]) => {
    const total = orders.reduce((sum, order) => sum + order.total, 0)
    acc[segment] = orders.length > 0 ? total / orders.length : 0
    return acc
  }, {} as Record<string, number>)
}
```

## Advanced Grouping

### Group by Single Field

```typescript
// Group orders by status
const groupOrdersByStatus = async () => {
  const orders = await orderRepo.collect()
  
  return orders.groupBy('status')
}

// Group products by category with statistics
const getProductsByCategory = async () => {
  const products = await productRepo.collect()
  const grouped = products.groupBy('category')
  
  return Object.entries(grouped).map(([category, products]) => ({
    category,
    count: products.length,
    totalValue: products.reduce((sum, p) => sum + (p.price * p.stockQuantity), 0),
    averagePrice: products.reduce((sum, p) => sum + p.price, 0) / products.length,
    totalStock: products.reduce((sum, p) => sum + p.stockQuantity, 0)
  }))
}
```

### Group by Multiple Fields

```typescript
// Group orders by status and month
const groupOrdersByStatusAndMonth = async () => {
  const orders = await orderRepo.collect()
  
  return orders.groupBy(order => {
    const month = order.createdAt.toISOString().substring(0, 7) // YYYY-MM
    return `${order.status}-${month}`
  })
}

// Group by user segment and product category
const groupSalesBySegmentAndCategory = async () => {
  const orders = await orderRepo.findMany({
    where: { status: 'delivered' },
    include: {
      user: { select: { segment: true } },
      items: { select: { productCategory: true, quantity: true, price: true } }
    }
  })
  
  const results = {}
  
  orders.forEach(order => {
    const segment = order.user.segment
    
    order.items.forEach(item => {
      const key = `${segment}-${item.productCategory}`
      
      if (!results[key]) {
        results[key] = {
          segment,
          category: item.productCategory,
          totalQuantity: 0,
          totalRevenue: 0,
          orderCount: 0
        }
      }
      
      results[key].totalQuantity += item.quantity
      results[key].totalRevenue += item.quantity * item.price
      results[key].orderCount++
    })
  })
  
  return Object.values(results)
}
```

### Time-Based Grouping

```typescript
// Group orders by day
const getDailyOrders = async (startDate: Date, endDate: Date) => {
  const orders = await orderRepo.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    select: { createdAt: true, total: true }
  })
  
  return orders.reduce((acc, order) => {
    const date = order.createdAt.toISOString().split('T')[0] // YYYY-MM-DD
    
    if (!acc[date]) {
      acc[date] = {
        date,
        orderCount: 0,
        revenue: 0
      }
    }
    
    acc[date].orderCount++
    acc[date].revenue += order.total
    
    return acc
  }, {} as Record<string, any>)
}

// Group orders by month and year
const getMonthlyStats = async (year: number) => {
  const startDate = new Date(year, 0, 1)
  const endDate = new Date(year + 1, 0, 1)
  
  const orders = await orderRepo.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate
      }
    },
    select: { createdAt: true, total: true, status: true }
  })
  
  const monthlyData = {}
  
  orders.forEach(order => {
    const month = order.createdAt.getMonth() + 1
    const key = `${year}-${month.toString().padStart(2, '0')}`
    
    if (!monthlyData[key]) {
      monthlyData[key] = {
        month: key,
        totalOrders: 0,
        totalRevenue: 0,
        deliveredOrders: 0,
        cancelledOrders: 0
      }
    }
    
    monthlyData[key].totalOrders++
    monthlyData[key].totalRevenue += order.total
    
    if (order.status === 'delivered') {
      monthlyData[key].deliveredOrders++
    } else if (order.status === 'cancelled') {
      monthlyData[key].cancelledOrders++
    }
  })
  
  return Object.values(monthlyData)
}
```

## Statistical Calculations

### Descriptive Statistics

```typescript
// Calculate comprehensive order statistics
const getOrderStatistics = async () => {
  const orders = await orderRepo.findMany({
    where: { status: 'delivered' },
    select: { total: true }
  })
  
  if (orders.length === 0) {
    return {
      count: 0,
      sum: 0,
      mean: 0,
      median: 0,
      mode: 0,
      min: 0,
      max: 0,
      standardDeviation: 0,
      variance: 0
    }
  }
  
  const values = orders.map(order => order.total).sort((a, b) => a - b)
  const sum = values.reduce((acc, val) => acc + val, 0)
  const mean = sum / values.length
  
  // Median
  const median = values.length % 2 === 0
    ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
    : values[Math.floor(values.length / 2)]
  
  // Mode
  const frequency = values.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1
    return acc
  }, {} as Record<number, number>)
  
  const mode = Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)[0][0]
  
  // Standard deviation and variance
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length
  const standardDeviation = Math.sqrt(variance)
  
  return {
    count: values.length,
    sum,
    mean,
    median,
    mode: parseFloat(mode),
    min: values[0],
    max: values[values.length - 1],
    standardDeviation,
    variance
  }
}
```

### Percentile Calculations

```typescript
// Calculate order value percentiles
const getOrderValuePercentiles = async () => {
  const orders = await orderRepo.findMany({
    where: { status: 'delivered' },
    select: { total: true }
  })
  
  const values = orders.map(order => order.total).sort((a, b) => a - b)
  
  const getPercentile = (values: number[], percentile: number) => {
    const index = (percentile / 100) * (values.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    
    if (lower === upper) {
      return values[lower]
    }
    
    return values[lower] + (values[upper] - values[lower]) * (index - lower)
  }
  
  return {
    p25: getPercentile(values, 25),
    p50: getPercentile(values, 50), // median
    p75: getPercentile(values, 75),
    p90: getPercentile(values, 90),
    p95: getPercentile(values, 95),
    p99: getPercentile(values, 99)
  }
}
```

## Business Intelligence Queries

### Customer Segmentation

```typescript
// Customer lifetime value analysis
const getCustomerLifetimeValue = async () => {
  const orders = await orderRepo.findMany({
    where: { status: 'delivered' },
    select: { userId: true, total: true, createdAt: true }
  })
  
  const customerData = orders.reduce((acc, order) => {
    if (!acc[order.userId]) {
      acc[order.userId] = {
        userId: order.userId,
        totalSpent: 0,
        orderCount: 0,
        firstOrder: order.createdAt,
        lastOrder: order.createdAt
      }
    }
    
    acc[order.userId].totalSpent += order.total
    acc[order.userId].orderCount++
    
    if (order.createdAt < acc[order.userId].firstOrder) {
      acc[order.userId].firstOrder = order.createdAt
    }
    
    if (order.createdAt > acc[order.userId].lastOrder) {
      acc[order.userId].lastOrder = order.createdAt
    }
    
    return acc
  }, {} as Record<string, any>)
  
  return Object.values(customerData).map(customer => ({
    ...customer,
    averageOrderValue: customer.totalSpent / customer.orderCount,
    customerLifetimeDays: Math.ceil(
      (customer.lastOrder.getTime() - customer.firstOrder.getTime()) / (1000 * 60 * 60 * 24)
    )
  }))
}

// RFM Analysis (Recency, Frequency, Monetary)
const getRFMAnalysis = async () => {
  const currentDate = new Date()
  const orders = await orderRepo.findMany({
    where: { status: 'delivered' },
    select: { userId: true, total: true, createdAt: true }
  })
  
  const customerMetrics = orders.reduce((acc, order) => {
    if (!acc[order.userId]) {
      acc[order.userId] = {
        userId: order.userId,
        lastOrderDate: order.createdAt,
        totalSpent: 0,
        orderCount: 0
      }
    }
    
    acc[order.userId].totalSpent += order.total
    acc[order.userId].orderCount++
    
    if (order.createdAt > acc[order.userId].lastOrderDate) {
      acc[order.userId].lastOrderDate = order.createdAt
    }
    
    return acc
  }, {} as Record<string, any>)
  
  return Object.values(customerMetrics).map(customer => {
    const recencyDays = Math.floor(
      (currentDate.getTime() - customer.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    
    return {
      userId: customer.userId,
      recency: recencyDays,
      frequency: customer.orderCount,
      monetary: customer.totalSpent
    }
  })
}
```

### Product Performance Analysis

```typescript
// Top selling products
const getTopSellingProducts = async (limit: number = 10) => {
  const orderItems = await orderItemRepo.findMany({
    include: {
      order: {
        select: { status: true }
      }
    }
  })
  
  // Filter only delivered orders
  const deliveredItems = orderItems.filter(item => item.order.status === 'delivered')
  
  const productSales = deliveredItems.reduce((acc, item) => {
    if (!acc[item.productId]) {
      acc[item.productId] = {
        productId: item.productId,
        productName: item.productName,
        category: item.productCategory,
        totalQuantity: 0,
        totalRevenue: 0,
        orderCount: 0
      }
    }
    
    acc[item.productId].totalQuantity += item.quantity
    acc[item.productId].totalRevenue += item.quantity * item.price
    acc[item.productId].orderCount++
    
    return acc
  }, {} as Record<string, any>)
  
  return Object.values(productSales)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit)
}

// Product margin analysis
const getProductMarginAnalysis = async () => {
  const products = await productRepo.findMany({
    select: { id: true, name: true, price: true, cost: true, category: true }
  })
  
  const orderItems = await orderItemRepo.findMany({
    include: {
      order: {
        select: { status: true }
      }
    }
  })
  
  const deliveredItems = orderItems.filter(item => item.order.status === 'delivered')
  
  return products.map(product => {
    const productItems = deliveredItems.filter(item => item.productId === product.id)
    const totalQuantitySold = productItems.reduce((sum, item) => sum + item.quantity, 0)
    const totalRevenue = productItems.reduce((sum, item) => sum + item.quantity * item.price, 0)
    const totalCost = totalQuantitySold * product.cost
    
    return {
      productId: product.id,
      productName: product.name,
      category: product.category,
      unitPrice: product.price,
      unitCost: product.cost,
      unitMargin: product.price - product.cost,
      marginPercentage: ((product.price - product.cost) / product.price) * 100,
      quantitySold: totalQuantitySold,
      revenue: totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost
    }
  })
}
```

### Cohort Analysis

```typescript
// Monthly cohort analysis
const getCohortAnalysis = async () => {
  const users = await userRepo.findMany({
    select: { id: true, registrationDate: true }
  })
  
  const orders = await orderRepo.findMany({
    where: { status: 'delivered' },
    select: { userId: true, createdAt: true, total: true }
  })
  
  const cohorts = {}
  
  users.forEach(user => {
    const cohortMonth = user.registrationDate.toISOString().substring(0, 7) // YYYY-MM
    
    if (!cohorts[cohortMonth]) {
      cohorts[cohortMonth] = {
        cohortMonth,
        totalUsers: 0,
        periods: {}
      }
    }
    
    cohorts[cohortMonth].totalUsers++
    
    // Find user's orders
    const userOrders = orders.filter(order => order.userId === user.id)
    
    userOrders.forEach(order => {
      const orderMonth = order.createdAt.toISOString().substring(0, 7)
      const monthsFromRegistration = getMonthsDifference(user.registrationDate, order.createdAt)
      
      if (!cohorts[cohortMonth].periods[monthsFromRegistration]) {
        cohorts[cohortMonth].periods[monthsFromRegistration] = {
          activeUsers: new Set(),
          revenue: 0,
          orders: 0
        }
      }
      
      cohorts[cohortMonth].periods[monthsFromRegistration].activeUsers.add(user.id)
      cohorts[cohortMonth].periods[monthsFromRegistration].revenue += order.total
      cohorts[cohortMonth].periods[monthsFromRegistration].orders++
    })
  })
  
  // Convert Sets to counts
  Object.values(cohorts).forEach((cohort: any) => {
    Object.values(cohort.periods).forEach((period: any) => {
      period.activeUsers = period.activeUsers.size
      period.retentionRate = period.activeUsers / cohort.totalUsers
    })
  })
  
  return cohorts
}

// Helper function
const getMonthsDifference = (date1: Date, date2: Date): number => {
  const months = (date2.getFullYear() - date1.getFullYear()) * 12
  return months + (date2.getMonth() - date1.getMonth())
}
```

## Advanced Analytics

### Seasonal Analysis

```typescript
// Seasonal sales patterns
const getSeasonalAnalysis = async () => {
  const orders = await orderRepo.findMany({
    where: { status: 'delivered' },
    select: { total: true, createdAt: true }
  })
  
  const seasonalData = orders.reduce((acc, order) => {
    const month = order.createdAt.getMonth() + 1
    const season = getSeason(month)
    
    if (!acc[season]) {
      acc[season] = {
        season,
        orderCount: 0,
        revenue: 0,
        months: []
      }
    }
    
    acc[season].orderCount++
    acc[season].revenue += order.total
    
    if (!acc[season].months.includes(month)) {
      acc[season].months.push(month)
    }
    
    return acc
  }, {} as Record<string, any>)
  
  return Object.values(seasonalData).map(season => ({
    ...season,
    averageOrderValue: season.revenue / season.orderCount,
    averageMonthlyRevenue: season.revenue / season.months.length
  }))
}

// Helper function
const getSeason = (month: number): string => {
  if (month >= 3 && month <= 5) return 'Spring'
  if (month >= 6 && month <= 8) return 'Summer'
  if (month >= 9 && month <= 11) return 'Fall'
  return 'Winter'
}
```

### Forecasting Data

```typescript
// Simple moving average for sales forecasting
const getSalesMovingAverage = async (days: number = 30) => {
  const orders = await orderRepo.findMany({
    where: { status: 'delivered' },
    select: { total: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }]
  })
  
  const dailySales = orders.reduce((acc, order) => {
    const date = order.createdAt.toISOString().split('T')[0]
    
    if (!acc[date]) {
      acc[date] = {
        date,
        revenue: 0,
        orders: 0
      }
    }
    
    acc[date].revenue += order.total
    acc[date].orders++
    
    return acc
  }, {} as Record<string, any>)
  
  const sortedDates = Object.keys(dailySales).sort()
  const movingAverages = []
  
  for (let i = days - 1; i < sortedDates.length; i++) {
    const windowDates = sortedDates.slice(i - days + 1, i + 1)
    const windowRevenue = windowDates.reduce((sum, date) => sum + dailySales[date].revenue, 0)
    
    movingAverages.push({
      date: sortedDates[i],
      actualRevenue: dailySales[sortedDates[i]].revenue,
      movingAverage: windowRevenue / days
    })
  }
  
  return movingAverages
}
```

## Real-Time Analytics

### Dashboard Metrics

```typescript
// Real-time dashboard metrics
const getDashboardMetrics = async () => {
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const startOfYear = new Date(today.getFullYear(), 0, 1)
  
  const [
    todayOrders,
    monthOrders,
    yearOrders,
    totalCustomers,
    totalProducts
  ] = await Promise.all([
    orderRepo.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { total: true, status: true }
    }),
    orderRepo.findMany({
      where: { createdAt: { gte: startOfMonth } },
      select: { total: true, status: true }
    }),
    orderRepo.findMany({
      where: { createdAt: { gte: startOfYear } },
      select: { total: true, status: true }
    }),
    userRepo.findMany({ select: { id: true } }),
    productRepo.findMany({ select: { id: true } })
  ])
  
  const calculateMetrics = (orders: any[]) => ({
    totalOrders: orders.length,
    totalRevenue: orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0),
    averageOrderValue: orders.length > 0 ? orders.reduce((sum, o) => sum + o.total, 0) / orders.length : 0,
    conversionRate: orders.length > 0 ? (orders.filter(o => o.status === 'delivered').length / orders.length) * 100 : 0
  })
  
  return {
    today: calculateMetrics(todayOrders),
    thisMonth: calculateMetrics(monthOrders),
    thisYear: calculateMetrics(yearOrders),
    totalCustomers: totalCustomers.length,
    totalProducts: totalProducts.length
  }
}
```

## Performance Optimization

### Efficient Aggregation Queries

```typescript
// Optimized aggregation using selective loading
const getOptimizedSalesReport = async (startDate: Date, endDate: Date) => {
  // Load only necessary fields
  const orders = await orderRepo.findMany({
    where: {
      status: 'delivered',
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      total: true,
      createdAt: true,
      userId: true
    }
  })
  
  const orderItems = await orderItemRepo.findMany({
    where: {
      order: {
        status: 'delivered',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    },
    select: {
      productCategory: true,
      quantity: true,
      price: true
    }
  })
  
  // Process in memory for better performance
  const collection = new Collection(orders)
  const itemsCollection = new Collection(orderItems)
  
  return {
    summary: {
      totalOrders: collection.length,
      totalRevenue: collection.reduce((sum, order) => sum + order.total, 0),
      averageOrderValue: collection.reduce((sum, order) => sum + order.total, 0) / collection.length,
      uniqueCustomers: collection.unique('userId').length
    },
    categoryBreakdown: itemsCollection
      .groupBy('productCategory')
      .map(([category, items]) => ({
        category,
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        revenue: items.reduce((sum, item) => sum + item.quantity * item.price, 0)
      }))
  }
}
```

## Next Steps

- [Performance Guide](../guides/performance.md) - Optimization strategies
- [Testing Analytics](../guides/testing.md) - Testing aggregation queries
- [Real-time Updates](../guides/real-time.md) - Real-time analytics
- [Advanced Patterns](../guides/advanced-patterns.md) - Complex analytics patterns