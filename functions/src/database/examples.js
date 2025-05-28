/**
 * Query Builder Framework - Usage Examples
 * Comprehensive examples demonstrating the capabilities of the DB3 Query Builder
 */

const { Database, QueryBuilder, QueryTemplates, TransactionManager, Model } = require('../index');

/**
 * Basic Query Examples
 */
async function basicQueryExamples() {
  console.log('=== Basic Query Examples ===');

  // Initialize database
  const db = new Database();
  await db.initialize();

  // 1. Simple SELECT queries
  console.log('\n1. Simple SELECT queries:');
  
  // Select all users
  const allUsers = await db.table('users').get();
  console.log('All users:', allUsers);

  // Select specific fields
  const userNames = await db.table('users')
    .select(['id', 'name', 'email'])
    .get();
  console.log('User names and emails:', userNames);

  // Select with WHERE conditions
  const activeUsers = await db.table('users')
    .select(['*'])
    .where('active', true)
    .where('age', '>=', 18)
    .get();
  console.log('Active adult users:', activeUsers);

  // 2. INSERT operations
  console.log('\n2. INSERT operations:');
  
  // Single insert
  const newUser = await db.table('users')
    .insert({
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      active: true
    })
    .execute();
  console.log('New user created:', newUser);

  // Batch insert
  const newUsers = await db.table('users')
    .insert([
      { name: 'Jane Smith', email: 'jane@example.com', age: 25 },
      { name: 'Bob Johnson', email: 'bob@example.com', age: 35 }
    ])
    .execute();
  console.log('Batch users created:', newUsers);

  // 3. UPDATE operations
  console.log('\n3. UPDATE operations:');
  
  const updateResult = await db.table('users')
    .update({ 
      last_login: new Date(),
      login_count: db.raw('login_count + 1')
    })
    .where('email', 'john@example.com')
    .execute();
  console.log('User updated:', updateResult);

  // 4. DELETE operations
  console.log('\n4. DELETE operations:');
  
  const deleteResult = await db.table('users')
    .delete()
    .where('active', false)
    .where('last_login', '<', new Date('2022-01-01'))
    .execute();
  console.log('Inactive users deleted:', deleteResult);
}

/**
 * Advanced Query Examples
 */
async function advancedQueryExamples() {
  console.log('\n=== Advanced Query Examples ===');

  const db = new Database();

  // 1. Complex WHERE conditions
  console.log('\n1. Complex WHERE conditions:');
  
  // Multiple OR conditions
  const priorityUsers = await db.table('users')
    .select(['*'])
    .where('role', 'admin')
    .orWhere('priority', 'high')
    .orWhere('department', 'engineering')
    .get();

  // IN and NOT IN clauses
  const specificUsers = await db.table('users')
    .select(['*'])
    .whereIn('id', [1, 2, 3, 4, 5])
    .whereNotIn('status', ['banned', 'suspended'])
    .get();

  // BETWEEN and NULL checks
  const recentActiveUsers = await db.table('users')
    .select(['*'])
    .whereBetween('created_at', '2023-01-01', '2023-12-31')
    .whereNotNull('email_verified_at')
    .whereNull('deleted_at')
    .get();

  // LIKE queries for search
  const searchResults = await db.table('users')
    .select(['*'])
    .whereLike('name', '%john%')
    .orWhereLike('email', '%gmail.com%')
    .get();

  // 2. JOIN operations
  console.log('\n2. JOIN operations:');
  
  // Inner join with user profiles
  const usersWithProfiles = await db.table('users')
    .select([
      'users.id',
      'users.name',
      'users.email',
      'profiles.bio',
      'profiles.avatar_url'
    ])
    .join('profiles', 'users.id', 'profiles.user_id')
    .where('users.active', true)
    .get();

  // Left join to include users without profiles
  const allUsersWithOptionalProfiles = await db.table('users')
    .select([
      'users.id',
      'users.name',
      'profiles.bio'
    ])
    .leftJoin('profiles', 'users.id', 'profiles.user_id')
    .get();

  // Multiple joins
  const usersWithOrdersAndAddresses = await db.table('users')
    .select([
      'users.name',
      'COUNT(orders.id) as order_count',
      'addresses.city'
    ])
    .leftJoin('orders', 'users.id', 'orders.customer_id')
    .leftJoin('addresses', 'users.id', 'addresses.user_id')
    .groupBy('users.id', 'addresses.city')
    .get();

  // 3. Aggregation and grouping
  console.log('\n3. Aggregation and grouping:');
  
  // Group by with aggregation
  const orderStatsByCustomer = await db.table('orders')
    .select([
      'customer_id',
      'COUNT(*) as total_orders',
      'SUM(amount) as total_spent',
      'AVG(amount) as average_order'
    ])
    .groupBy('customer_id')
    .having('total_orders', '>', 5)
    .orderByDesc('total_spent')
    .get();

  // Date-based grouping
  const dailyRevenue = await db.table('orders')
    .select([
      'DATE(created_at) as order_date',
      'COUNT(*) as order_count',
      'SUM(amount) as daily_revenue'
    ])
    .where('status', 'completed')
    .groupBy('DATE(created_at)')
    .orderBy('order_date')
    .get();

  // 4. Subqueries and advanced patterns
  console.log('\n4. Advanced patterns:');
  
  // Using raw SQL for complex operations
  const topCustomers = await db.raw(`
    SELECT 
      u.id,
      u.name,
      u.email,
      customer_stats.total_orders,
      customer_stats.total_spent
    FROM users u
    JOIN (
      SELECT 
        customer_id,
        COUNT(*) as total_orders,
        SUM(amount) as total_spent
      FROM orders 
      WHERE status = 'completed'
        AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
      GROUP BY customer_id
      HAVING total_spent > 1000
    ) customer_stats ON u.id = customer_stats.customer_id
    ORDER BY customer_stats.total_spent DESC
    LIMIT 10
  `);

  console.log('Advanced query results processed');
}

/**
 * Query Templates Examples
 */
async function queryTemplateExamples() {
  console.log('\n=== Query Template Examples ===');

  // 1. Basic CRUD operations
  console.log('\n1. Template CRUD operations:');
  
  // Find by ID
  const user = await QueryTemplates.findById('users', 1).first();
  console.log('User found:', user);

  // Find by field
  const userByEmail = await QueryTemplates.findBy('users', 'email', 'john@example.com').first();
  console.log('User by email:', userByEmail);

  // Create with timestamps
  const newUser = await QueryTemplates.create('users', {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    department: 'marketing'
  }).execute();

  // Update by ID
  const updateResult = await QueryTemplates.updateById('users', 1, {
    last_login: new Date(),
    login_count: 5
  }).execute();

  // 2. Pagination
  console.log('\n2. Pagination:');
  
  const page1 = await QueryTemplates.paginate('users', 1, 10).get();
  const page2 = await QueryTemplates.paginate('users', 2, 10, 'name', 'john').get();
  console.log('Paginated results:', { page1: page1.length, page2: page2.length });

  // 3. Soft delete operations
  console.log('\n3. Soft delete operations:');
  
  // Soft delete a user
  await QueryTemplates.softDelete('users', 1).execute();
  
  // Find only active (non-deleted) users
  const activeUsers = await QueryTemplates.findActive('users').get();
  
  // Restore a soft-deleted user
  await QueryTemplates.restore('users', 1).execute();

  // 4. Bulk operations
  console.log('\n4. Bulk operations:');
  
  // Bulk create
  const bulkUsers = await QueryTemplates.bulkCreate('users', [
    { name: 'User 1', email: 'user1@example.com' },
    { name: 'User 2', email: 'user2@example.com' },
    { name: 'User 3', email: 'user3@example.com' }
  ]).execute();

  // Bulk update
  const bulkUpdate = await QueryTemplates.bulkUpdate('users', [1, 2, 3], {
    status: 'verified',
    verified_at: new Date()
  }).execute();

  // 5. Search and filtering
  console.log('\n5. Search and filtering:');
  
  // Full-text search
  const searchResults = await QueryTemplates.fullTextSearch(
    'articles',
    ['title', 'content'],
    'database optimization',
    ['id', 'title', 'summary'],
    20
  ).get();

  // Recent records
  const recentUsers = await QueryTemplates.getRecent('users', 'created_at', 7).get();
  
  // Date range query
  const usersThisMonth = await QueryTemplates.getByDateRange(
    'users',
    'created_at',
    new Date('2023-12-01'),
    new Date('2023-12-31')
  ).get();
}

/**
 * Transaction Examples
 */
async function transactionExamples() {
  console.log('\n=== Transaction Examples ===');

  // 1. Basic transaction
  console.log('\n1. Basic transaction:');
  
  try {
    const result = await TransactionManager.run(async (transaction) => {
      // Create user
      const { results: [userResult] } = await transaction.executeQuery(
        QueryBuilder.table('users').insert({
          name: 'Transaction User',
          email: 'transaction@example.com'
        })
      );
      
      const userId = userResult.insertId;
      
      // Create user profile
      await transaction.executeQuery(
        QueryBuilder.table('profiles').insert({
          user_id: userId,
          bio: 'Created in transaction',
          preferences: JSON.stringify({ theme: 'dark' })
        })
      );
      
      // Update user with profile_id
      await transaction.executeQuery(
        QueryBuilder.table('users')
          .update({ has_profile: true })
          .where('id', userId)
      );
      
      return { userId, success: true };
    });
    
    console.log('Transaction completed:', result);
  } catch (error) {
    console.error('Transaction failed:', error.message);
  }

  // 2. Transaction with savepoints
  console.log('\n2. Transaction with savepoints:');
  
  try {
    const result = await TransactionManager.run(async (transaction) => {
      // First operation
      await transaction.executeQuery(
        QueryBuilder.table('users').update({ status: 'processing' }).where('id', 1)
      );
      
      // Create savepoint
      const savepoint1 = await transaction.savepoint('after_status_update');
      
      try {
        // Risky operation that might fail
        await transaction.executeQuery(
          QueryBuilder.table('orders').insert({
            user_id: 1,
            amount: -100 // This might violate constraints
          })
        );
      } catch (error) {
        // Rollback to savepoint
        await transaction.rollbackTo(savepoint1);
        console.log('Rolled back to savepoint due to error:', error.message);
        
        // Continue with alternative approach
        await transaction.executeQuery(
          QueryBuilder.table('users').update({ status: 'failed' }).where('id', 1)
        );
      }
      
      return { success: true };
    });
  } catch (error) {
    console.error('Transaction with savepoints failed:', error.message);
  }

  // 3. Batch operations in transaction
  console.log('\n3. Batch operations in transaction:');
  
  const operations = [
    // Operation 1: Create users
    async (transaction) => {
      return await transaction.executeQuery(
        QueryTemplates.bulkCreate('users', [
          { name: 'Batch User 1', email: 'batch1@example.com' },
          { name: 'Batch User 2', email: 'batch2@example.com' }
        ])
      );
    },
    
    // Operation 2: Update existing users
    async (transaction) => {
      return await transaction.executeQuery(
        QueryBuilder.table('users')
          .update({ batch_processed: true })
          .where('email', 'LIKE', '%batch%')
      );
    },
    
    // Operation 3: Create audit log
    async (transaction) => {
      return await transaction.executeQuery(
        QueryBuilder.table('audit_logs').insert({
          action: 'batch_user_creation',
          details: 'Created batch users and updated existing ones',
          created_at: new Date()
        })
      );
    }
  ];

  try {
    const results = await TransactionManager.run(async (transaction) => {
      return await transaction.batch(operations);
    });
    
    console.log('Batch operations completed:', results.length);
  } catch (error) {
    console.error('Batch operations failed:', error.message);
  }

  // 4. Transaction with retry on deadlock
  console.log('\n4. Transaction with retry:');
  
  try {
    const result = await TransactionManager.runWithRetry(async (transaction) => {
      // Simulate operations that might cause deadlock
      await transaction.executeQuery(
        QueryBuilder.table('counters')
          .update({ value: db.raw('value + 1') })
          .where('name', 'user_registrations')
      );
      
      await transaction.executeQuery(
        QueryBuilder.table('counters')
          .update({ value: db.raw('value + 1') })
          .where('name', 'total_operations')
      );
      
      return { success: true };
    }, { maxRetries: 3, retryDelay: 100 });
    
    console.log('Transaction with retry completed:', result);
  } catch (error) {
    console.error('Transaction with retry failed:', error.message);
  }
}

/**
 * Model Class Examples
 */
class User extends Model {
  constructor() {
    super('users', 'id');
  }

  // Custom methods for User model
  async findByEmail(email) {
    return await this.findBy('email', email);
  }

  async getActiveUsers() {
    return await this.query()
      .where('active', true)
      .whereNull('deleted_at')
      .orderBy('created_at', 'DESC')
      .get();
  }

  async getUsersWithProfiles() {
    return await this.query()
      .select([
        'users.id',
        'users.name',
        'users.email',
        'profiles.bio'
      ])
      .join('profiles', 'users.id', 'profiles.user_id')
      .get();
  }

  async createUserWithProfile(userData, profileData) {
    return await TransactionManager.run(async (transaction) => {
      // Create user
      const { results: [userResult] } = await transaction.executeQuery(
        QueryBuilder.table(this.tableName).insert(userData)
      );
      
      const userId = userResult.insertId;
      
      // Create profile
      await transaction.executeQuery(
        QueryBuilder.table('profiles').insert({
          ...profileData,
          user_id: userId
        })
      );
      
      return userId;
    });
  }
}

async function modelExamples() {
  console.log('\n=== Model Examples ===');

  const userModel = new User();

  // 1. Basic model operations
  console.log('\n1. Basic model operations:');
  
  // Find user by ID
  const user = await userModel.find(1);
  console.log('User found:', user);

  // Create new user
  const newUserId = await userModel.create({
    name: 'Model User',
    email: 'model@example.com',
    active: true
  });

  // Update user
  await userModel.update(newUserId, {
    last_login: new Date(),
    login_count: 1
  });

  // 2. Custom model methods
  console.log('\n2. Custom model methods:');
  
  // Find by email
  const userByEmail = await userModel.findByEmail('model@example.com');
  
  // Get active users
  const activeUsers = await userModel.getActiveUsers();
  
  // Get users with profiles
  const usersWithProfiles = await userModel.getUsersWithProfiles();

  // 3. Complex operations
  console.log('\n3. Complex model operations:');
  
  // Create user with profile in transaction
  const userId = await userModel.createUserWithProfile(
    {
      name: 'Complex User',
      email: 'complex@example.com'
    },
    {
      bio: 'This user was created with a profile',
      preferences: JSON.stringify({ notifications: true })
    }
  );

  // 4. Pagination with model
  const paginatedUsers = await userModel.paginate(1, 10, 'name', 'user');
  console.log('Paginated users:', paginatedUsers);
}

/**
 * Performance and Monitoring Examples
 */
async function performanceExamples() {
  console.log('\n=== Performance and Monitoring Examples ===');

  const db = new Database();

  // 1. Query performance monitoring
  console.log('\n1. Query performance monitoring:');
  
  // Execute some queries to generate stats
  await db.table('users').where('active', true).get();
  await db.table('orders').join('users', 'orders.customer_id', 'users.id').get();
  await db.table('products').where('price', '>', 100).orderBy('created_at').limit(50).get();

  // Get performance statistics
  const stats = await db.getStats();
  console.log('Database statistics:', JSON.stringify(stats, null, 2));

  // 2. Query optimization suggestions
  console.log('\n2. Query optimization:');
  
  const query = db.table('orders')
    .select(['*'])
    .join('customers', 'orders.customer_id', 'customers.id')
    .where('orders.status', 'pending')
    .orderBy('orders.created_at');

  const optimizations = db.utils.QueryOptimizer.suggestOptimizations(query);
  console.log('Optimization suggestions:', optimizations);

  const indexSuggestions = db.utils.QueryOptimizer.suggestIndexes(query);
  console.log('Index suggestions:', indexSuggestions);

  // 3. Query complexity analysis
  console.log('\n3. Query complexity analysis:');
  
  const complexQuery = db.table('orders')
    .select([
      'orders.id',
      'customers.name',
      'products.title',
      'SUM(order_items.quantity * order_items.price) as total'
    ])
    .join('customers', 'orders.customer_id', 'customers.id')
    .join('order_items', 'orders.id', 'order_items.order_id')
    .join('products', 'order_items.product_id', 'products.id')
    .where('orders.created_at', '>=', new Date('2023-01-01'))
    .groupBy('orders.id')
    .having('total', '>', 100)
    .orderBy('total', 'DESC');

  const { sql } = complexQuery.toSQL();
  const complexity = db.utils.SqlUtils.estimateComplexity(sql);
  console.log('Query complexity score:', complexity);
  console.log('Complex query SQL:', sql);
}

/**
 * Error Handling Examples
 */
async function errorHandlingExamples() {
  console.log('\n=== Error Handling Examples ===');

  const db = new Database();

  // 1. Validation errors
  console.log('\n1. Validation errors:');
  
  try {
    // Invalid table name
    await db.table('123invalid').select(['*']).get();
  } catch (error) {
    console.log('Caught validation error:', error.message);
  }

  try {
    // Empty WHERE IN clause
    await db.table('users').whereIn('id', []).get();
  } catch (error) {
    console.log('Caught WHERE IN error:', error.message);
  }

  // 2. Transaction rollback on error
  console.log('\n2. Transaction rollback:');
  
  try {
    await TransactionManager.run(async (transaction) => {
      // First operation succeeds
      await transaction.executeQuery(
        QueryBuilder.table('users').update({ status: 'processing' }).where('id', 1)
      );
      
      // Second operation fails (simulate constraint violation)
      await transaction.executeQuery(
        QueryBuilder.table('users').insert({
          id: 1, // Duplicate primary key
          name: 'Duplicate User',
          email: 'duplicate@example.com'
        })
      );
    });
  } catch (error) {
    console.log('Transaction rolled back due to error:', error.message);
  }

  // 3. Graceful error handling with fallbacks
  console.log('\n3. Graceful error handling:');
  
  async function findUserWithFallback(userId) {
    try {
      // Try to find user with profile
      const user = await db.table('users')
        .select(['users.*', 'profiles.bio'])
        .join('profiles', 'users.id', 'profiles.user_id')
        .where('users.id', userId)
        .first();
      
      return user;
    } catch (error) {
      console.log('Join failed, falling back to user only:', error.message);
      
      // Fallback to basic user data
      return await db.table('users').where('id', userId).first();
    }
  }

  const userWithFallback = await findUserWithFallback(1);
  console.log('User found with fallback:', userWithFallback ? 'Success' : 'Not found');
}

/**
 * Main execution function
 */
async function runAllExamples() {
  try {
    console.log('🚀 Starting Query Builder Framework Examples\n');

    await basicQueryExamples();
    await advancedQueryExamples();
    await queryTemplateExamples();
    await transactionExamples();
    await modelExamples();
    await performanceExamples();
    await errorHandlingExamples();

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// Export examples for testing
module.exports = {
  basicQueryExamples,
  advancedQueryExamples,
  queryTemplateExamples,
  transactionExamples,
  modelExamples,
  performanceExamples,
  errorHandlingExamples,
  runAllExamples,
  User
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}
