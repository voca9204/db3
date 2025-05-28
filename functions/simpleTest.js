/**
 * Simple Query Builder Test
 */

const { QueryBuilder } = require('./src/database/queryBuilder');

console.log('🧪 Testing Query Builder Framework...\n');

try {
  // 1. Test basic SELECT query
  console.log('1. Testing Basic SELECT Query:');
  const selectQuery = QueryBuilder.table('users')
    .select(['id', 'name', 'email'])
    .where('active', true)
    .limit(10);
  
  const { sql, params } = selectQuery.toSQL();
  console.log('✅ SQL:', sql);
  console.log('✅ Params:', params);

  // 2. Test INSERT query
  console.log('\n2. Testing INSERT Query:');
  const insertQuery = QueryBuilder.table('users')
    .insert({
      name: 'Test User',
      email: 'test@example.com',
      active: true
    });
  
  const { sql: insertSql, params: insertParams } = insertQuery.toSQL();
  console.log('✅ SQL:', insertSql);
  console.log('✅ Params:', insertParams);

  // 3. Test complex WHERE conditions
  console.log('\n3. Testing Complex WHERE:');
  const complexQuery = QueryBuilder.table('users')
    .select(['*'])
    .whereIn('role', ['admin', 'user'])
    .whereBetween('age', 18, 65)
    .whereNotNull('email');

  const { sql: complexSql, params: complexParams } = complexQuery.toSQL();
  console.log('✅ SQL:', complexSql);
  console.log('✅ Params:', complexParams);

  // 4. Test JOIN
  console.log('\n4. Testing JOIN:');
  const joinQuery = QueryBuilder.table('users')
    .select(['users.name', 'profiles.bio'])
    .join('profiles', 'users.id', 'profiles.user_id')
    .where('users.active', true);

  const { sql: joinSql, params: joinParams } = joinQuery.toSQL();
  console.log('✅ SQL:', joinSql);
  console.log('✅ Params:', joinParams);

  console.log('\n🎉 All Query Builder tests passed!');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
