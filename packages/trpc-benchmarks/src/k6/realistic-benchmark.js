// Realistic k6 benchmark with database operations
// Run: k6 run src/k6/realistic-benchmark.js --env BASE_URL=http://localhost:3001
// This simulates real e-commerce API traffic patterns

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Trend, Rate, Counter } from 'k6/metrics'
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js'

// Custom metrics by operation type
var productListLatency = new Trend('db_product_list_latency', true)
var productGetLatency = new Trend('db_product_get_latency', true)
var productSearchLatency = new Trend('db_product_search_latency', true)
var orderCreateLatency = new Trend('db_order_create_latency', true)
var orderGetLatency = new Trend('db_order_get_latency', true)
var userGetLatency = new Trend('db_user_get_latency', true)
var categoryListLatency = new Trend('db_category_list_latency', true)
var dashboardLatency = new Trend('db_dashboard_latency', true)

var errorRate = new Rate('error_rate')
var throughput = new Counter('total_requests')

// Configuration
var BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'
var TRPC_URL = BASE_URL + '/trpc'

// Track created resources for cleanup/reuse
var createdOrders = []
var seenUsers = []
var seenProducts = []
var seenCategories = []

export var options = {
  scenarios: {
    realistic_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 5 },
        { duration: '30s', target: 10 },
        { duration: '20s', target: 20 },
        { duration: '10s', target: 5 },
      ],
      gracefulRampDown: '5s',
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    error_rate: ['rate<0.05'],
    db_product_list_latency: ['p(95)<300'],
    db_order_create_latency: ['p(95)<500'],
    db_dashboard_latency: ['p(95)<800']
  }
}

function wrapInput(input) {
  return { json: input }
}

function trpcQuery(procedure, input) {
  var url = input
    ? TRPC_URL + '/' + procedure + '?input=' + encodeURIComponent(JSON.stringify(wrapInput(input)))
    : TRPC_URL + '/' + procedure
  return http.get(url, { headers: { 'Content-Type': 'application/json' } })
}

function trpcMutation(procedure, input) {
  return http.post(TRPC_URL + '/' + procedure, JSON.stringify(wrapInput(input)), {
    headers: { 'Content-Type': 'application/json' }
  })
}

function extractResult(response) {
  try {
    var data = JSON.parse(response.body)
    if (data && data.result && data.result.data) {
      return data.result.data.json || data.result.data
    }
    return null
  } catch (e) {
    return null
  }
}

function getNestedProp(obj, path) {
  var parts = path.split('.')
  var current = obj
  for (var i = 0; i < parts.length; i++) {
    if (current === null || current === undefined) return undefined
    current = current[parts[i]]
  }
  return current
}

// Browsing behavior - most common (60% of traffic)
function browseProducts() {
  group('Browse Products', function() {
    var page = randomIntBetween(1, 10)
    var listRes = trpcQuery('product.list', { page: page, pageSize: 20 })
    throughput.add(1)
    productListLatency.add(listRes.timings.duration)

    var listOk = check(listRes, { 'product.list ok': function(r) { return r.status === 200 } })
    errorRate.add(!listOk)

    var result = extractResult(listRes)
    if (result && result.products) {
      result.products.forEach(function(p) {
        if (seenProducts.indexOf(p.id) === -1) seenProducts.push(p.id)
      })
    }

    sleep(0.1)

    if (seenProducts.length > 0) {
      var productId = randomItem(seenProducts)
      var getRes = trpcQuery('product.get', { id: productId })
      throughput.add(1)
      productGetLatency.add(getRes.timings.duration)

      var getOk = check(getRes, { 'product.get ok': function(r) { return r.status === 200 } })
      errorRate.add(!getOk)
    }

    sleep(0.1)

    var catRes = trpcQuery('category.list')
    throughput.add(1)
    categoryListLatency.add(catRes.timings.duration)

    var catOk = check(catRes, { 'category.list ok': function(r) { return r.status === 200 } })
    errorRate.add(!catOk)

    var categories = extractResult(catRes)
    if (Array.isArray(categories)) {
      categories.forEach(function(c) {
        if (seenCategories.indexOf(c.id) === -1) seenCategories.push(c.id)
      })
    }
  })
}

// Search behavior (15% of traffic)
function searchProducts() {
  group('Search Products', function() {
    var searchTerms = ['Premium', 'Professional', 'Ultra', 'Smart', 'Deluxe', 'Widget', 'Tool']
    var query = randomItem(searchTerms)

    var res = trpcQuery('product.search', { query: query, page: 1, pageSize: 20 })
    throughput.add(1)
    productSearchLatency.add(res.timings.duration)

    var ok = check(res, { 'product.search ok': function(r) { return r.status === 200 } })
    errorRate.add(!ok)

    var result = extractResult(res)
    if (result && result.products) {
      result.products.forEach(function(p) {
        if (seenProducts.indexOf(p.id) === -1) seenProducts.push(p.id)
      })
    }
  })
}

// User account behavior (10% of traffic)
function viewUserAccount() {
  group('User Account', function() {
    var listRes = trpcQuery('user.list', { page: randomIntBetween(1, 50), pageSize: 10 })
    throughput.add(1)

    var result = extractResult(listRes)
    if (result && result.users) {
      result.users.forEach(function(u) {
        if (seenUsers.indexOf(u.id) === -1) seenUsers.push(u.id)
      })
    }

    if (seenUsers.length > 0) {
      var userId = randomItem(seenUsers)

      var userRes = trpcQuery('user.get', { id: userId })
      throughput.add(1)
      userGetLatency.add(userRes.timings.duration)

      var userOk = check(userRes, { 'user.get ok': function(r) { return r.status === 200 } })
      errorRate.add(!userOk)

      sleep(0.05)

      var ordersRes = trpcQuery('user.orders', { userId: userId, page: 1, pageSize: 10 })
      throughput.add(1)
      check(ordersRes, { 'user.orders ok': function(r) { return r.status === 200 } })
    }
  })
}

// Place order (10% of traffic)
function placeOrder() {
  group('Place Order', function() {
    if (seenUsers.length === 0 || seenProducts.length < 2) {
      var userRes = trpcQuery('user.list', { page: 1, pageSize: 10 })
      var prodRes = trpcQuery('product.list', { page: 1, pageSize: 20 })
      throughput.add(2)

      var users = extractResult(userRes)
      var products = extractResult(prodRes)

      if (users && users.users) {
        users.users.forEach(function(u) { seenUsers.push(u.id) })
      }
      if (products && products.products) {
        products.products.forEach(function(p) { seenProducts.push(p.id) })
      }
    }

    if (seenUsers.length > 0 && seenProducts.length >= 2) {
      var userId = randomItem(seenUsers)
      var numItems = randomIntBetween(1, 3)
      var items = []
      var usedProducts = {}

      for (var i = 0; i < numItems && i < seenProducts.length; i++) {
        var productId
        var attempts = 0
        do {
          productId = randomItem(seenProducts)
          attempts++
        } while (usedProducts[productId] && attempts < 10)

        if (!usedProducts[productId]) {
          usedProducts[productId] = true
          items.push({
            productId: productId,
            quantity: randomIntBetween(1, 2)
          })
        }
      }

      if (items.length > 0) {
        var res = trpcMutation('order.create', { userId: userId, items: items })
        throughput.add(1)
        orderCreateLatency.add(res.timings.duration)

        var ok = check(res, {
          'order.create ok or stock issue': function(r) { return r.status === 200 || r.status === 400 }
        })
        errorRate.add(res.status >= 500)

        var order = extractResult(res)
        if (order && order.id) {
          createdOrders.push(order.id)
        }
      }
    }
  })
}

// View order (3% of traffic)
function viewOrder() {
  group('View Order', function() {
    var recentRes = trpcQuery('order.recent', { page: 1, pageSize: 10 })
    throughput.add(1)

    var result = extractResult(recentRes)
    var orderIds = (result && result.orders) ? result.orders.map(function(o) { return o.id }) : createdOrders

    if (orderIds.length > 0) {
      var orderId = randomItem(orderIds)
      var res = trpcQuery('order.get', { id: orderId })
      throughput.add(1)
      orderGetLatency.add(res.timings.duration)

      var ok = check(res, { 'order.get ok': function(r) { return r.status === 200 } })
      errorRate.add(!ok)
    }
  })
}

// Admin/Analytics (2% of traffic)
function viewDashboard() {
  group('Dashboard Analytics', function() {
    var res = trpcQuery('analytics.dashboard')
    throughput.add(1)
    dashboardLatency.add(res.timings.duration)

    var ok = check(res, { 'analytics.dashboard ok': function(r) { return r.status === 200 } })
    errorRate.add(!ok)

    sleep(0.1)

    var revenueRes = trpcQuery('analytics.revenueByCategory')
    throughput.add(1)
    check(revenueRes, { 'analytics.revenueByCategory ok': function(r) { return r.status === 200 } })
  })
}

// Main test function
export default function() {
  var rand = Math.random()

  if (rand < 0.60) {
    browseProducts()
  } else if (rand < 0.75) {
    searchProducts()
  } else if (rand < 0.85) {
    viewUserAccount()
  } else if (rand < 0.95) {
    placeOrder()
  } else if (rand < 0.98) {
    viewOrder()
  } else {
    viewDashboard()
  }

  sleep(randomIntBetween(1, 3) / 10)
}

export function setup() {
  console.log('Starting realistic benchmark against ' + BASE_URL)

  var healthRes = http.get(BASE_URL + '/health')
  if (healthRes.status !== 200) {
    throw new Error('Server not responding at ' + BASE_URL)
  }

  var health = JSON.parse(healthRes.body)
  console.log('Server: ' + health.runtime + ' + ' + health.framework + ' + ' + (health.database || 'no-db'))

  var prodRes = trpcQuery('product.list', { page: 1, pageSize: 1 })
  var products = extractResult(prodRes)
  if (!products || !products.total || products.total < 100) {
    console.warn('Warning: Database may not be seeded. Run: pnpm db:seed')
  } else {
    console.log('Database has ' + products.total + ' products')
  }

  return health
}

export function teardown(data) {
  console.log('\nBenchmark complete for: ' + data.runtime + ' + ' + data.framework)
  console.log('Created ' + createdOrders.length + ' orders during test')
}
