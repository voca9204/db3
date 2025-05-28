/**
 * 환경변수 설정 테스트 스크립트
 * 환경변수가 올바르게 로드되고 검증되는지 확인합니다.
 */

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { 
  validateAndLoadEnvironment, 
  getDatabaseConfig, 
  getApiConfig, 
  getLogConfig,
  getEnvironmentStatus, 
  getSafeEnvironmentInfo 
} = require('./src/utils/envConfig');

console.log('🔧 DB3 Environment Configuration Test');
console.log('=====================================\n');

// 1. 환경변수 상태 확인
console.log('1. Environment Status:');
try {
  const status = getEnvironmentStatus();
  console.log('   Node Environment:', status.nodeEnv || 'not set');
  console.log('   Required Variables Status:', status.hasRequiredVars ? '✅ All present' : '❌ Missing variables');
  
  if (status.missingVars.length > 0) {
    console.log('   Missing Variables:', status.missingVars.join(', '));
  }
  
  if (status.loadedVars.length > 0) {
    console.log('   Loaded Variables:', status.loadedVars.join(', '));
  }
  
  if (status.error) {
    console.log('   Error:', status.error);
  }
} catch (error) {
  console.log('   Error checking environment status:', error.message);
}

console.log('\n2. Safe Environment Info:');
try {
  const safeInfo = getSafeEnvironmentInfo();
  Object.entries(safeInfo).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });
} catch (error) {
  console.log('   Error getting safe environment info:', error.message);
}

// 3. 환경변수 검증 및 로드 테스트
console.log('\n3. Environment Validation Test:');
try {
  const config = validateAndLoadEnvironment();
  console.log('   ✅ Environment validation passed');
  console.log('   Total variables loaded:', Object.keys(config).length);
} catch (error) {
  console.log('   ❌ Environment validation failed:', error.message);
}

// 4. 데이터베이스 설정 테스트
console.log('\n4. Database Configuration Test:');
try {
  const dbConfig = getDatabaseConfig();
  console.log('   ✅ Database configuration loaded');
  console.log('   Host:', dbConfig.host);
  console.log('   User:', dbConfig.user);
  console.log('   Database:', dbConfig.database);
  console.log('   Port:', dbConfig.port);
  console.log('   Connection Limit:', dbConfig.connectionLimit);
  console.log('   Timezone:', dbConfig.timezone);
} catch (error) {
  console.log('   ❌ Database configuration failed:', error.message);
}

// 5. API 설정 테스트
console.log('\n5. API Configuration Test:');
try {
  const apiConfig = getApiConfig();
  console.log('   ✅ API configuration loaded');
  console.log('   Default Limit:', apiConfig.defaultLimit);
  console.log('   Max Limit:', apiConfig.maxLimit);
  console.log('   Rate Limit Requests:', apiConfig.rateLimitRequests);
  console.log('   Rate Limit Window:', apiConfig.rateLimitWindow);
  console.log('   Allowed Origins:', apiConfig.allowedOrigins.join(', '));
} catch (error) {
  console.log('   ❌ API configuration failed:', error.message);
}

// 6. 로깅 설정 테스트
console.log('\n6. Logging Configuration Test:');
try {
  const logConfig = getLogConfig();
  console.log('   ✅ Logging configuration loaded');
  console.log('   Log Level:', logConfig.level);
  console.log('   Console Logging:', logConfig.enableConsole ? 'enabled' : 'disabled');
  console.log('   File Logging:', logConfig.enableFile ? 'enabled' : 'disabled');
} catch (error) {
  console.log('   ❌ Logging configuration failed:', error.message);
}

console.log('\n=====================================');
console.log('Environment configuration test completed.');

// 7. 데이터베이스 연결 테스트 (선택적)
if (process.argv.includes('--test-db')) {
  console.log('\n7. Database Connection Test:');
  
  const { executeQuery } = require('./db');
  
  executeQuery('SELECT VERSION() as version')
    .then(result => {
      console.log('   ✅ Database connection successful');
      console.log('   MySQL Version:', result[0]?.version || 'unknown');
    })
    .catch(error => {
      console.log('   ❌ Database connection failed:', error.message);
    })
    .finally(() => {
      process.exit(0);
    });
} else {
  console.log('\nTo test database connection, run: node envTest.js --test-db');
  process.exit(0);
}
