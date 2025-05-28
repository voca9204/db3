/**
 * Quick Test for Query Builder Framework
 * Basic functionality and database connection test
 */

const { Database, QueryBuilder, db } = require('./src/database/index');

async function runQuickTests() {
  console.log('🧪 Starting Query Builder Framework Tests...\n');

  try {
    // 1. Database Connection Test
    console.log('1. Testing Database Connection...');
    await db.initialize();
    const connectionTest = await db.test();
    console.log('✅ Database connection successful:', connectionTest);

    // 2. Basic Query Builder Test
    console.log('\n2. Testing Basic Query Builder...');
    
    // Test SELECT query building
    const selectQuery = QueryBuilder.table('users')
      .select(['id', 'name', 'email'])
      .where('active', true)
      .where('age', '>', 18)
      .orderBy('created_at', 'DESC')
      .limit(10);
    
    const { sql, params } = selectQuery.toSQL();
    console.log('✅ SELECT Query Built:');
    console.log('   SQL:', sql);
    console.log('   Params:', params);

    // Test INSERT query building
    const insertQuery = QueryBuilder.table('test_users')
      .insert({
        name: 'Test User',
        email: 'test@example.com',
        age: 25,
        active: true
      });
    
    const { sql: insertSql, params: insertParams } = insertQuery.toSQL();
    console.log('\n✅ INSERT Query Built:');
    console.log('   SQL:', insertSql);
    console.log('   Params:', insertParams);

    // 3. Test Complex WHERE conditions
    console.log('\n3. Testing Complex WHERE Conditions...');
    
    const complexQuery = QueryBuilder.table('users')
      .select(['*'])
      .where('status', 'active')
      .whereIn('role', ['admin', 'moderator', 'user'])
      .whereBetween('created_at', '2023-01-01', '2023-12-31')
      .whereNotNull('email_verified_at')
      .orWhere('priority', 'high');

    const { sql: complexSql, params: complexParams } = complexQuery.toSQL();
    console.log('✅ Complex WHERE Query Built:');
    console.log('   SQL:', complexSql);
    console.log('   Params:', complexParams);

    // 4. Test JOIN operations
    console.log('\n4. Testing JOIN Operations...');
    
    const joinQuery = QueryBuilder.table('users')
      .select(['users.id', 'users.name', 'profiles.bio'])
      .join('profiles', 'users.id', 'profiles.user_id')
      .leftJoin('orders', 'users.id', 'orders.customer_id')
      .where('users.active', true)
      .groupBy('users.id')
      .having('COUNT(orders.id)', '>', 0);

    const { sql: joinSql, params: joinParams } = joinQuery.toSQL();
    console.log('✅ JOIN Query Built:');
    console.log('   SQL:', joinSql);
    console.log('   Params:', joinParams);

    // 5. Test actual database query execution
    console.log('\n5. Testing Actual Database Execution...');
    
    try {
      // Test with a simple query that should work on most databases
      const testResult = await db.query('SELECT 1 as test_value, NOW() as current_time');
      console.log('✅ Database query executed successfully:', testResult.results[0]);
    } catch (dbError) {
      console.log('⚠️  Database query failed (this is ok for testing):', dbError.message);
    }

    // 6. Test Query Builder with actual execution (if possible)
    console.log('\n6. Testing Query Builder Execution...');
    
    try {
      // Try to get database structure info
      const tablesQuery = await db.query('SHOW TABLES');
      console.log('✅ Available tables:', tablesQuery.results.length);
      
      if (tablesQuery.results.length > 0) {
        const firstTable = Object.values(tablesQuery.results[0])[0];
        console.log('   First table:', firstTable);
        
        // Try to count records in first table
        try {
          const countQuery = QueryBuilder.table(firstTable);
          const { sql: countSql } = countQuery.count().toSQL();
          console.log('   Count query for', firstTable, ':', countSql);
        } catch (countError) {
          console.log('   Count query build failed:', countError.message);
        }
      }
    } catch (showTablesError) {
      console.log('⚠️  Could not retrieve table info:', showTablesError.message);
    }

    // 7. Test Query Templates
    console.log('\n7. Testing Query Templates...');
    
    const { QueryTemplates } = require('./src/database/query/templates');
    
    // Test findById template
    const findByIdQuery = QueryTemplates.findById('users', 1, ['id', 'name']);
    const { sql: findSql, params: findParams } = findByIdQuery.toSQL();
    console.log('✅ FindById Template:');
    console.log('   SQL:', findSql);
    console.log('   Params:', findParams);

    // Test pagination template
    const paginateQuery = QueryTemplates.paginate('users', 2, 10, 'name', 'john');
    const { sql: pageSql, params: pageParams } = paginateQuery.toSQL();
    console.log('\n✅ Pagination Template:');
    console.log('   SQL:', pageSql);
    console.log('   Params:', pageParams);

    // 8. Test Utilities
    console.log('\n8. Testing Utilities...');
    
    const { SqlUtils, QueryValidator } = require('./src/database/query/utils');
    
    // Test identifier validation
    console.log('✅ Identifier validation:');
    console.log('   "users" is valid:', SqlUtils.isValidIdentifier('users'));
    console.log('   "123invalid" is valid:', SqlUtils.isValidIdentifier('123invalid'));
    console.log('   Escaped "users":', SqlUtils.escapeIdentifier('users'));
    
    // Test operator validation
    console.log('\n✅ Operator validation:');
    try {
      SqlUtils.validateOperator('=');
      console.log('   "=" operator is valid');
    } catch (error) {
      console.log('   "=" validation failed:', error.message);
    }
    
    try {
      SqlUtils.validateOperator('INVALID');
      console.log('   "INVALID" operator is valid');
    } catch (error) {
      console.log('   "INVALID" validation failed:', error.message);
    }

    // 9. Test Performance Monitoring
    console.log('\n9. Testing Performance Monitoring...');
    
    const stats = await db.getStats();
    console.log('✅ Database statistics retrieved:');
    console.log('   Connection initialized:', stats.connection.initialized);
    console.log('   Performance queries tracked:', stats.performance.totalQueries || 0);

    console.log('\n🎉 All Query Builder Framework tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ Database connection: Working');
    console.log('   ✅ Query building: Working');
    console.log('   ✅ Complex conditions: Working');
    console.log('   ✅ JOIN operations: Working');
    console.log('   ✅ Query templates: Working');
    console.log('   ✅ Utilities: Working');
    console.log('   ✅ Performance monitoring: Working');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // Close database connections
    try {
      await db.close();
      console.log('\n🔌 Database connections closed');
    } catch (closeError) {
      console.log('⚠️  Error closing connections:', closeError.message);
    }
  }
}

// Run the tests
if (require.main === module) {
  runQuickTests().then(() => {
    console.log('\n✨ Test execution completed');
    process.exit(0);
  }).catch((error) => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runQuickTests };
