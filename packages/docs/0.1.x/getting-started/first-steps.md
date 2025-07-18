# First Steps

Let's see how Fluent utilities can transform your TypeScript development. We'll build practical examples that demonstrate the power and elegance of Fluent's utility ecosystem.

## Your First Utility

Let's start with a simple but powerful example:

```typescript
import { Arrays, Objects, Strings } from '@fluent/js-utils';

// Sample data
const users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', score: 95 },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user', score: 87 },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'admin', score: 92 },
  { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'user', score: 78 }
];

// Group users by role
const usersByRole = Arrays.groupBy(users, 'role');
console.log(usersByRole);
// {
//   admin: [{ Alice }, { Charlie }],
//   user: [{ Bob }, { Diana }]
// }

// Get average score by role
const averageScores = Objects.mapValues(usersByRole, roleUsers => 
  Arrays.avg(roleUsers, 'score')
);
console.log(averageScores);
// { admin: 93.5, user: 82.5 }

// Create URL-friendly usernames
const usernames = Arrays.map(users, user => ({
  ...user,
  username: Strings.slug(user.name)
}));
console.log(usernames[0].username); // 'alice-johnson'
```

## Real-World Example: Data Processing Pipeline

Let's build a data processing pipeline that showcases multiple utilities working together:

```typescript
import { Arrays, Objects, Strings, Promises } from '@fluent/js-utils';
import { Files, Streams, Security } from '@fluent/node-utils';

interface RawUser {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  joined_date: string;
  purchases: number;
}

async function processUserData() {
  // 1. Read and parse CSV data
  const rawData = await Files.readCsv<RawUser>('./users.csv');

  // 2. Transform and clean data
  const processedUsers = Arrays.map(rawData, (user, index) => ({
    id: Strings.uuid(),
    fullName: `${user.first_name} ${user.last_name}`.trim(),
    email: Strings.toLowerCase(user.email),
    phone: user.phone ? Strings.normalizePhone(user.phone) : null,
    username: Strings.slug(`${user.first_name}-${user.last_name}`),
    joinedDate: new Date(user.joined_date),
    totalPurchases: user.purchases,
    customerTier: user.purchases > 10 ? 'gold' : user.purchases > 5 ? 'silver' : 'bronze'
  }));

  // 3. Validate and filter
  const validUsers = Arrays.filter(processedUsers, user => 
    Strings.isEmail(user.email) && user.fullName.length > 0
  );

  // 4. Remove duplicates by email
  const uniqueUsers = Arrays.unique(validUsers, 'email');

  // 5. Group by customer tier for analysis
  const usersByTier = Arrays.groupBy(uniqueUsers, 'customerTier');
  
  // 6. Calculate statistics
  const tierStats = Objects.mapValues(usersByTier, tierUsers => ({
    count: tierUsers.length,
    avgPurchases: Arrays.avg(tierUsers, 'totalPurchases'),
    users: Arrays.sortBy(tierUsers, 'totalPurchases', 'desc').slice(0, 5)
  }));

  // 7. Save processed data
  await Files.writeJson('./processed-users.json', uniqueUsers);
  await Files.writeJson('./tier-statistics.json', tierStats);

  return { users: uniqueUsers, stats: tierStats };
}
```

## Building an API with Utilities

Here's how Fluent utilities make API development cleaner:

```typescript
import { Arrays, Objects, Strings, Http } from '@fluent/js-utils';
import { JWT, Security, Validation } from '@fluent/node-utils';

// User registration endpoint
export async function registerUser(data: unknown) {
  // 1. Validate input data
  const schema = {
    email: Validation.string().email().required(),
    password: Validation.string().min(8).required(),
    name: Validation.string().min(2).max(50).required(),
    age: Validation.number().min(18).optional()
  };

  const validated = Validation.validate(data, schema);

  // 2. Check if user exists
  const existingUser = await db.users.findOne({ 
    email: Strings.toLowerCase(validated.email) 
  });
  
  if (existingUser) {
    throw new Error('Email already registered');
  }

  // 3. Create user object
  const user = {
    id: Strings.uuid(),
    email: Strings.toLowerCase(validated.email),
    name: Strings.titleCase(validated.name),
    username: Strings.slug(validated.name),
    password: await Security.hash(validated.password),
    age: validated.age || null,
    createdAt: new Date(),
    emailVerified: false,
    verificationToken: Security.randomToken()
  };

  // 4. Save to database
  await db.users.insert(user);

  // 5. Generate JWT token
  const token = JWT.sign(
    { userId: user.id, email: user.email },
    { expiresIn: '7d' }
  );

  // 6. Send verification email
  await Http.post('https://api.emailservice.com/send', {
    to: user.email,
    subject: 'Verify your email',
    template: 'verification',
    data: {
      name: user.name,
      verificationUrl: `https://app.com/verify?token=${user.verificationToken}`
    }
  });

  // 7. Return sanitized user data
  return {
    user: Objects.omit(user, ['password', 'verificationToken']),
    token
  };
}
```

## Stream Processing Example

Process large files efficiently with streaming utilities:

```typescript
import { Arrays, Strings } from '@fluent/js-utils';
import { Streams, Files } from '@fluent/node-utils';

async function processLargeDataset() {
  const results = await Streams.pipeline(
    // 1. Read large CSV file as stream
    Files.createReadStream('./sales-data.csv'),
    
    // 2. Parse CSV rows
    Streams.csv({ headers: true }),
    
    // 3. Transform each row
    Streams.transform(row => ({
      orderId: row.order_id,
      customer: Strings.titleCase(row.customer_name),
      product: row.product_name,
      quantity: parseInt(row.quantity),
      price: parseFloat(row.price),
      total: parseInt(row.quantity) * parseFloat(row.price),
      date: new Date(row.order_date),
      region: row.region.toUpperCase()
    })),
    
    // 4. Filter valid orders
    Streams.filter(order => 
      order.total > 0 && 
      order.customer && 
      !isNaN(order.total)
    ),
    
    // 5. Batch for processing
    Streams.batch(1000),
    
    // 6. Process each batch
    Streams.transform(async batch => {
      // Group by region for this batch
      const byRegion = Arrays.groupBy(batch, 'region');
      
      // Calculate regional totals
      const regionalTotals = Objects.mapValues(byRegion, orders => ({
        orderCount: orders.length,
        totalRevenue: Arrays.sum(orders, 'total'),
        avgOrderValue: Arrays.avg(orders, 'total'),
        topProduct: Arrays.mostFrequent(orders, 'product')
      }));
      
      // Save batch results
      await Files.appendJson('./regional-analysis.json', regionalTotals);
      
      return regionalTotals;
    }),
    
    // 7. Collect all results
    Streams.collect()
  );

  console.log('Processing complete!', results);
}
```

## Utility Patterns

### Pattern 1: Data Transformation Chain

```typescript
import { Arrays, Objects, Strings } from '@fluent/js-utils';

const rawProducts = [
  { name: 'iPhone 13 Pro', price: '999.99', category: 'electronics', tags: 'phone,apple,smartphone' },
  { name: 'Samsung Galaxy S21', price: '799.99', category: 'electronics', tags: 'phone,android,smartphone' },
  { name: 'Nike Air Max', price: '129.99', category: 'footwear', tags: 'shoes,sports,running' }
];

const products = Arrays.pipe(rawProducts,
  // Parse and transform
  products => Arrays.map(products, p => ({
    ...p,
    price: parseFloat(p.price),
    tags: p.tags.split(',').map(t => t.trim()),
    slug: Strings.slug(p.name)
  })),
  
  // Add computed properties
  products => Arrays.map(products, p => ({
    ...p,
    displayPrice: `$${p.price.toFixed(2)}`,
    isExpensive: p.price > 500,
    tagCount: p.tags.length
  })),
  
  // Sort by price
  products => Arrays.sortBy(products, 'price', 'desc')
);
```

### Pattern 2: Error Handling with Retries

```typescript
import { Promises, Http } from '@fluent/js-utils';

async function fetchUserDataWithRetry(userId: string) {
  const data = await Promises.retry(
    async () => {
      const response = await Http.get(`https://api.example.com/users/${userId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.status}`);
      }
      
      return response.data;
    },
    {
      retries: 3,
      delay: 1000,
      onRetry: (error, attempt) => {
        console.log(`Retry attempt ${attempt} after error:`, error.message);
      }
    }
  );
  
  return data;
}
```

### Pattern 3: Concurrent Processing

```typescript
import { Promises, Arrays } from '@fluent/js-utils';

async function processUsersInParallel(userIds: string[]) {
  // Process in chunks to avoid overwhelming the API
  const chunks = Arrays.chunk(userIds, 10);
  
  const results = await Promises.sequential(chunks, async chunk => {
    // Process each chunk in parallel
    return await Promises.parallel(chunk, async userId => {
      const user = await fetchUser(userId);
      const processed = await processUser(user);
      return processed;
    });
  });
  
  // Flatten results
  return Arrays.flatten(results);
}
```

## Next Steps

Now that you've seen the power of Fluent utilities, here's where to go next:

<div class="content-list">

### 🔧 **Deep Dive into Utilities**
Explore specific utility categories:
- [Collections & Arrays](../utilities/collections.md) - Advanced array manipulation
- [HTTP Client](../guides/http-client.md) - Building robust API clients
- [Security Patterns](../guides/security-patterns.md) - Authentication and encryption

### ⚡ **Advanced Features**
Level up with advanced capabilities:
- [Stream Processing](../guides/stream-processing.md) - Handle large datasets
- [Queue System](../queues/queue-core.md) - Background job processing
- [File Operations](../guides/file-operations.md) - Advanced file handling

### 📚 **Reference Documentation**
- [Complete API Reference](../api/utility-api.md) - Every function documented
- [TypeScript Types](../api/types.md) - Type definitions and interfaces

</div>

---

You've just scratched the surface of what's possible with Fluent utilities. Start integrating them into your projects and watch your code become cleaner, safer, and more maintainable! 🚀