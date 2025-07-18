# Collections

Fluent's collection utilities make working with arrays and objects a pleasure. Inspired by functional programming principles, these utilities help you write cleaner, more expressive code.

## The Collection Class

The `Collection` class provides a fluent interface for working with arrays:

```typescript
import { Collection } from '@fluent/utils';

const users = new Collection([
  { id: 1, name: 'Alice', age: 30, department: 'Engineering' },
  { id: 2, name: 'Bob', age: 25, department: 'Design' },
  { id: 3, name: 'Charlie', age: 35, department: 'Engineering' },
  { id: 4, name: 'Diana', age: 28, department: 'Marketing' }
]);

// Chain operations together
const result = users
  .filter(user => user.age > 25)
  .groupBy('department')
  .map(group => ({
    department: group.key,
    count: group.items.length,
    averageAge: group.items.avg('age')
  }))
  .sortBy('count', 'desc')
  .all();
```

## Transforming Data

### map()

Transform each item in the collection:

```typescript
const users = collect([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' }
]);

// Transform to display names
const displayNames = users.map(user => `${user.name} <${user.email}>`);
// Result: ['Alice <alice@example.com>', 'Bob <bob@example.com>']

// Extract specific properties
const names = users.map('name');
// Result: ['Alice', 'Bob']
```

### pluck()

Extract values from nested objects:

```typescript
const posts = collect([
  { title: 'Post 1', author: { name: 'Alice', email: 'alice@example.com' } },
  { title: 'Post 2', author: { name: 'Bob', email: 'bob@example.com' } }
]);

const authorNames = posts.pluck('author.name');
// Result: ['Alice', 'Bob']

const authorEmails = posts.pluck('author.email');
// Result: ['alice@example.com', 'bob@example.com']
```

### flatten()

Flatten nested arrays:

```typescript
const nested = collect([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]
]);

const flattened = nested.flatten();
// Result: [1, 2, 3, 4, 5, 6, 7, 8, 9]

// Flatten with depth control
const deepNested = collect([
  [1, [2, [3, 4]]],
  [5, [6, [7, 8]]]
]);

const partiallyFlattened = deepNested.flatten(1);
// Result: [1, [2, [3, 4]], 5, [6, [7, 8]]]
```

## Filtering Data

### filter()

Keep items that match a condition:

```typescript
const numbers = collect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

// Filter even numbers
const evenNumbers = numbers.filter(n => n % 2 === 0);
// Result: [2, 4, 6, 8, 10]

// Filter objects
const users = collect([
  { name: 'Alice', active: true, age: 30 },
  { name: 'Bob', active: false, age: 25 },
  { name: 'Charlie', active: true, age: 35 }
]);

const activeUsers = users.filter(user => user.active);
const seniorsUsers = users.filter(user => user.age >= 30);
```

### where()

Filter using key-value pairs:

```typescript
const products = collect([
  { name: 'iPhone', category: 'Electronics', price: 999 },
  { name: 'Shirt', category: 'Clothing', price: 29 },
  { name: 'Laptop', category: 'Electronics', price: 1299 }
]);

// Simple where clause
const electronics = products.where('category', 'Electronics');

// Where with operators
const expensiveProducts = products.where('price', '>', 500);
const cheapProducts = products.where('price', '<=', 50);

// Where in array
const categories = products.whereIn('category', ['Electronics', 'Clothing']);
```

### reject()

Remove items that match a condition:

```typescript
const numbers = collect([1, 2, 3, 4, 5]);

const withoutEvens = numbers.reject(n => n % 2 === 0);
// Result: [1, 3, 5]

const users = collect([
  { name: 'Alice', banned: false },
  { name: 'Bob', banned: true },
  { name: 'Charlie', banned: false }
]);

const activateUsers = users.reject(user => user.banned);
```

## Grouping and Sorting

### groupBy()

Group items by a key or function:

```typescript
const users = collect([
  { name: 'Alice', department: 'Engineering', salary: 90000 },
  { name: 'Bob', department: 'Design', salary: 75000 },
  { name: 'Charlie', department: 'Engineering', salary: 95000 },
  { name: 'Diana', department: 'Marketing', salary: 70000 }
]);

// Group by department
const byDepartment = users.groupBy('department');
// Result: {
//   Engineering: [Alice, Charlie],
//   Design: [Bob],
//   Marketing: [Diana]
// }

// Group by salary range
const bySalaryRange = users.groupBy(user => {
  if (user.salary < 80000) return 'Junior';
  if (user.salary < 100000) return 'Mid';
  return 'Senior';
});
```

### sortBy()

Sort items by a key or function:

```typescript
const users = collect([
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Charlie', age: 35 }
]);

// Sort by age (ascending)
const byAge = users.sortBy('age');

// Sort by age (descending)
const byAgeDesc = users.sortBy('age', 'desc');

// Sort by multiple criteria
const sorted = users.sortBy([
  ['department', 'asc'],
  ['salary', 'desc']
]);
```

## Aggregation

### reduce()

Reduce collection to a single value:

```typescript
const numbers = collect([1, 2, 3, 4, 5]);

const sum = numbers.reduce((total, num) => total + num, 0);
// Result: 15

const product = numbers.reduce((total, num) => total * num, 1);
// Result: 120

// Complex reduction
const users = collect([
  { name: 'Alice', posts: 5, comments: 20 },
  { name: 'Bob', posts: 3, comments: 15 },
  { name: 'Charlie', posts: 8, comments: 30 }
]);

const totalActivity = users.reduce((total, user) => ({
  posts: total.posts + user.posts,
  comments: total.comments + user.comments
}), { posts: 0, comments: 0 });
```

### Mathematical Operations

```typescript
const numbers = collect([10, 20, 30, 40, 50]);

const sum = numbers.sum();          // 150
const avg = numbers.avg();          // 30
const min = numbers.min();          // 10
const max = numbers.max();          // 50
const median = numbers.median();    // 30

// Operations on object properties
const products = collect([
  { name: 'iPhone', price: 999 },
  { name: 'iPad', price: 599 },
  { name: 'MacBook', price: 1299 }
]);

const totalValue = products.sum('price');    // 2897
const avgPrice = products.avg('price');      // 965.67
const cheapest = products.min('price');      // 599
const mostExpensive = products.max('price'); // 1299
```

## Utility Methods

### chunk()

Split collection into chunks:

```typescript
const numbers = collect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

const chunks = numbers.chunk(3);
// Result: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]

// Process data in batches
const users = collect(largeUserArray);
const batches = users.chunk(100);

for (const batch of batches) {
  await processUserBatch(batch.all());
}
```

### unique()

Get unique items:

```typescript
const numbers = collect([1, 2, 2, 3, 3, 3, 4, 5]);
const unique = numbers.unique();
// Result: [1, 2, 3, 4, 5]

// Unique by property
const users = collect([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Alice', email: 'alice@gmail.com' }
]);

const uniqueNames = users.unique('name');
// Result: [Alice (first occurrence), Bob]
```

### shuffle()

Randomize collection order:

```typescript
const cards = collect(['A', 'K', 'Q', 'J', '10', '9', '8', '7']);
const shuffled = cards.shuffle();
// Result: Random order of cards
```

## Real-World Examples

### E-commerce Analytics

```typescript
const orders = collect([
  { id: 1, customer: 'Alice', total: 150, items: ['iPhone Case', 'Charger'] },
  { id: 2, customer: 'Bob', total: 75, items: ['T-Shirt'] },
  { id: 3, customer: 'Alice', total: 200, items: ['Headphones'] },
  { id: 4, customer: 'Charlie', total: 300, items: ['Laptop'] }
]);

// Customer analytics
const customerStats = orders
  .groupBy('customer')
  .map(group => ({
    customer: group.key,
    orders: group.items.length,
    totalSpent: group.items.sum('total'),
    averageOrder: group.items.avg('total')
  }))
  .sortBy('totalSpent', 'desc');

// Top selling items
const allItems = orders
  .pluck('items')
  .flatten()
  .countBy()
  .sortBy('count', 'desc')
  .take(5);
```

### Data Processing Pipeline

```typescript
const rawData = collect(csvData);

const processedData = rawData
  // Clean and validate data
  .filter(row => row.email && row.name)
  .map(row => ({
    ...row,
    email: row.email.toLowerCase().trim(),
    name: row.name.trim(),
    createdAt: new Date(row.created_at)
  }))
  // Remove duplicates
  .unique('email')
  // Group by signup date
  .groupBy(user => user.createdAt.toISOString().split('T')[0])
  // Calculate daily metrics
  .map(group => ({
    date: group.key,
    signups: group.items.length,
    domains: group.items.pluck('email').map(email => email.split('@')[1]).unique().length
  }))
  // Sort by date
  .sortBy('date');
```

## Performance Tips

### Lazy Evaluation

Use lazy evaluation for large datasets:

```typescript
import { LazyCollection } from '@fluent/utils';

const largeDataset = new LazyCollection(millionRecords);

// Operations are not executed until you call a terminal method
const result = largeDataset
  .filter(record => record.active)
  .map(record => record.email)
  .unique()
  .take(100) // Only process what you need
  .all();    // Terminal method - executes the chain
```

### Memory Efficient Operations

```typescript
// Instead of loading everything into memory
const allUsers = await User.query().get();
const processed = collect(allUsers).map(processUser).all();

// Use chunked processing for large datasets
await User.query().chunk(1000, users => {
  const processed = collect(users).map(processUser);
  return processed.all();
});
```

## API Reference

### Creation Methods

```typescript
// Create from array
const collection = collect([1, 2, 3]);

// Create from object
const collection = collect({ a: 1, b: 2 });

// Create lazy collection
const lazy = new LazyCollection(generator);
```

### Transformation Methods

- `map(callback)` - Transform each item
- `pluck(key)` - Extract values by key
- `flatten(depth?)` - Flatten nested arrays
- `zip(arrays...)` - Combine arrays
- `chunk(size)` - Split into chunks

### Filtering Methods

- `filter(callback)` - Keep matching items
- `reject(callback)` - Remove matching items
- `where(key, value)` - Filter by key-value
- `whereIn(key, values)` - Filter by multiple values
- `unique(key?)` - Get unique items
- `take(count)` - Take first N items
- `skip(count)` - Skip first N items

### Sorting Methods

- `sortBy(key, direction?)` - Sort by key
- `sortByDesc(key)` - Sort descending
- `reverse()` - Reverse order
- `shuffle()` - Randomize order

### Aggregation Methods

- `reduce(callback, initial)` - Reduce to single value
- `sum(key?)` - Sum numeric values
- `avg(key?)` - Average numeric values
- `min(key?)` - Find minimum value
- `max(key?)` - Find maximum value
- `count()` - Count items
- `isEmpty()` - Check if empty
- `isNotEmpty()` - Check if not empty

---

Collections make data manipulation elegant and expressive. Master these utilities to write cleaner, more maintainable code! 🚀