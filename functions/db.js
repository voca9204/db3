/**
 * 데이터베이스 연결 및 쿼리 실행 모듈 (DB3용)
 * DB2에서 검증된 성공한 구조를 기반으로 함
 * 서버리스 환경에 최적화된 연결 관리
 */

const mysql = require('mysql2/promise');
const { getDatabaseConfig, getSafeEnvironmentInfo } = require('./src/utils/envConfig');

// 데이터베이스 연결 풀 인스턴스 (전역 관리)
let pool = null;
let poolLastUsed = Date.now();

// 서버리스 환경 최적화 설정
const KEEPALIVE_INTERVAL_MS = 30000; // 30초마다 연결 유지
const IDLE_TIMEOUT_MS = 60000; // 1분 동안 미사용 시 연결 풀 해제
const CONNECTION_LIFETIME_MS = 5 * 60 * 1000; // 5분 후 연결 풀 새로고침

// 재시도 설정
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 5000;

// 간단한 로거
const logger = {
  debug: (message, ...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message, ...args) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
};

/**
 * 데이터베이스 자격 증명 가져오기
 * 환경변수 유틸리티를 사용하여 보안 강화
 */
const getDatabaseCredentials = async () => {
  try {
    const dbConfig = getDatabaseConfig();
    logger.info('Database credentials loaded successfully from environment variables');
    return {
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      port: dbConfig.port,
      connectionLimit: dbConfig.connectionLimit,
      acquireTimeout: dbConfig.acquireTimeout,
      connectTimeout: dbConfig.timeout,
      reconnect: dbConfig.reconnect,
      timezone: dbConfig.timezone
    };
  } catch (error) {
    logger.error('Failed to load database credentials:', error.message);
    
    // 안전한 환경변수 정보 로깅 (디버깅용)
    const safeInfo = getSafeEnvironmentInfo();
    logger.debug('Environment variables status:', safeInfo);
    
    throw error;
  }
};

/**
 * 로깅용 안전한 자격 증명
 */
const getSafeCredentials = (credentials) => {
  if (!credentials) return null;
  
  return {
    host: credentials.host,
    user: credentials.user,
    password: credentials.password ? '********' : null,
    database: credentials.database,
  };
};

/**
 * 데이터베이스 연결 풀 생성
 */
const createPool = async () => {
  try {
    // 기존 풀 해제
    if (pool) {
      logger.info('Closing existing database connection pool');
      await pool.end();
      pool = null;
    }
    
    // 자격 증명 가져오기
    const credentials = await getDatabaseCredentials();
    
    if (!credentials) {
      throw new Error('Failed to retrieve database credentials');
    }
    
    // 연결 풀 설정
    const poolConfig = {
      host: credentials.host,
      user: credentials.user,
      password: credentials.password,
      database: credentials.database,
      port: credentials.port || 3306,
      waitForConnections: true,
      connectionLimit: credentials.connectionLimit || (process.env.NODE_ENV === 'production' ? 5 : 10),
      queueLimit: 10,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      
      // 타임아웃 설정
      connectTimeout: credentials.connectTimeout || 5000,
      acquireTimeout: credentials.acquireTimeout || 10000,
      
      // 보안 설정
      multipleStatements: false,
      
      // 문자열 및 시간대 설정
      timezone: credentials.timezone || '+09:00',
      dateStrings: true,
      charset: 'utf8mb4',
      
      // SSL 설정 (프로덕션)
      ssl: process.env.NODE_ENV === 'production' ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false
      } : undefined,
      
      // 성능 최적화
      namedPlaceholders: true,
    };
    
    // 풀 생성
    const newPool = mysql.createPool(poolConfig);
    newPool.poolId = `pool-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // 연결 테스트
    try {
      logger.info('Creating database connection pool...', getSafeCredentials(poolConfig));
      const connection = await newPool.getConnection();
      
      const [serverInfo] = await connection.query('SELECT VERSION() as version');
      logger.info(`Database connection established successfully. MySQL version: ${serverInfo[0]?.version || 'unknown'}`);
      
      connection.release();
      
      newPool.createdAt = Date.now();
      poolLastUsed = Date.now();
      
      setupKeepAlive(newPool);
      
      return newPool;
    } catch (connError) {
      logger.error(`Failed to connect to database: ${connError.message}`);
      
      try {
        await newPool.end();
      } catch (endError) {
        logger.warn(`Error ending pool after connection failure: ${endError.message}`);
      }
      
      throw connError;
    }
  } catch (error) {
    logger.error(`Failed to create database connection pool: ${error.message}`);
    throw error;
  }
};

/**
 * 연결 유지 타이머 설정
 */
const setupKeepAlive = (dbPool) => {
  if (dbPool.keepAliveTimer) {
    clearInterval(dbPool.keepAliveTimer);
  }
  
  dbPool.keepAliveTimer = setInterval(async () => {
    const idle = Date.now() - poolLastUsed;
    
    if (idle > IDLE_TIMEOUT_MS) {
      logger.info(`Connection pool idle for ${idle}ms, releasing resources`);
      clearInterval(dbPool.keepAliveTimer);
      
      try {
        await dbPool.end();
        pool = null;
      } catch (error) {
        logger.warn(`Error ending idle connection pool: ${error.message}`);
      }
      
      return;
    }
    
    if (Date.now() - dbPool.createdAt > CONNECTION_LIFETIME_MS) {
      logger.info('Connection pool reached maximum lifetime, refreshing');
      clearInterval(dbPool.keepAliveTimer);
      
      createPool().catch(error => {
        logger.error(`Failed to refresh connection pool: ${error.message}`);
      });
      
      return;
    }
    
    try {
      const connection = await dbPool.getConnection();
      try {
        await connection.query('SELECT 1');
        logger.debug('Database keepalive ping successful');
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.warn(`Keepalive ping failed: ${error.message}`);
      
      try {
        await createPool();
      } catch (refreshError) {
        logger.error(`Failed to refresh connection pool after failed ping: ${refreshError.message}`);
      }
    }
  }, KEEPALIVE_INTERVAL_MS);
  
  process.once('SIGTERM', async () => {
    clearInterval(dbPool.keepAliveTimer);
    if (pool) {
      try {
        await pool.end();
      } catch (error) {
        // 무시
      }
    }
  });
};

/**
 * 연결 풀 가져오기
 */
const getPool = async () => {
  if (!pool) {
    pool = await createPool();
  }
  
  poolLastUsed = Date.now();
  return pool;
};

/**
 * 지수적 지연 계산
 */
const calculateExponentialDelay = (attemptNumber) => {
  const delay = Math.min(
    Math.pow(1.5, attemptNumber) * RETRY_DELAY_MS + Math.floor(Math.random() * 250),
    MAX_RETRY_DELAY_MS
  );
  return delay;
};

/**
 * 재시도 로직
 */
const withRetry = async (fn, maxAttempts = RETRY_ATTEMPTS) => {
  let lastError = null;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (
        error.code === 'ER_ACCESS_DENIED_ERROR' ||
        error.code === 'ER_BAD_DB_ERROR' ||
        error.fatal
      ) {
        logger.error(`Fatal database error (${error.code}), not retrying: ${error.message}`);
        throw error;
      }
      
      if (attempt < maxAttempts - 1) {
        const delay = calculateExponentialDelay(attempt);
        logger.warn(`Database operation failed (${error.code}), attempt ${attempt + 1}/${maxAttempts}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT') {
          logger.warn('Connection issue detected, recreating database connection pool before retry');
          pool = await createPool();
        }
      }
    }
  }
  
  logger.error(`Database operation failed after ${maxAttempts} attempts: ${lastError.message}`);
  throw lastError;
};

/**
 * SQL 쿼리 실행
 */
const executeQuery = async (sql, params = [], options = {}) => {
  const start = Date.now();
  const queryId = `q-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  const { 
    maxAttempts = RETRY_ATTEMPTS, 
    timeout = 10000
  } = options;
  
  logger.debug(`[DB:${queryId}] Executing query: ${sql.substring(0, 100)}...`);
  
  try {
    const dbPool = await withRetry(() => getPool(), maxAttempts);
    
    const result = await withRetry(async () => {
      const connection = await dbPool.getConnection();
      
      try {
        const executionPromise = Array.isArray(params) 
          ? connection.execute(sql, params)
          : connection.execute(sql, params);
          
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Query timeout after ${timeout}ms`)), timeout)
        );
        
        return await Promise.race([executionPromise, timeoutPromise])
          .finally(() => {
            connection.release();
          });
      } catch (error) {
        connection.release();
        throw error;
      }
    }, maxAttempts);
    
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      logger.warn(`[DB:${queryId}] Slow query (${duration}ms): ${sql.substring(0, 100)}...`);
    } else {
      logger.debug(`[DB:${queryId}] Query completed in ${duration}ms`);
    }
    
    return result[0];
  } catch (error) {
    const duration = Date.now() - start;
    
    logger.error(`[DB:${queryId}] Query error (${duration}ms):`, {
      message: error.message,
      code: error.code,
      query: sql.substring(0, 200)
    });
    
    const sanitizedMessage = error.message.replace(/(password=)[^&]*/gi, '$1*****');
    
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error(`Duplicate entry: ${sanitizedMessage}`);
    } else if (error.message.includes('timeout')) {
      throw new Error(`Database query timeout: ${sanitizedMessage}`);
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      throw new Error(`Database access denied: Check credentials configuration`);
    } else if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      throw new Error(`Database connection lost: ${sanitizedMessage}`);
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error(`Database connection refused: Check network configuration`);
    } else {
      throw new Error(`Database query failed: ${sanitizedMessage}`);
    }
  }
};

/**
 * 단일 레코드 조회
 */
const queryOne = async (sql, params = [], options = {}) => {
  const results = await executeQuery(sql, params, options);
  return results && results.length > 0 ? results[0] : null;
};

module.exports = {
  getPool,
  executeQuery,
  queryOne,
  withRetry,
  createPool
};
