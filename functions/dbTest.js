/**
 * Database Connection Test
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('🔌 Testing Database Connection...\n');

  try {
    // Create connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 10000
    });

    console.log('✅ Database connection established');

    // Test query
    const [results] = await connection.execute('SELECT 1 as test, NOW() as timestamp, VERSION() as version');
    console.log('✅ Test query successful:', results[0]);

    // Check tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`✅ Found ${tables.length} tables in database`);
    
    if (tables.length > 0) {
      console.log('📋 Available tables:');
      tables.slice(0, 5).forEach((table, index) => {
        const tableName = Object.values(table)[0];
        console.log(`   ${index + 1}. ${tableName}`);
      });
      if (tables.length > 5) {
        console.log(`   ... and ${tables.length - 5} more tables`);
      }
    }

    await connection.end();
    console.log('\n🎉 Database connection test completed successfully!');

  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   → Database server is not reachable');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   → Invalid credentials');
    }
    
    process.exit(1);
  }
}

testDatabaseConnection();
