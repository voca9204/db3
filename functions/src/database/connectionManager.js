/**
 * Enhanced Database Connection Manager for DB3
 * Based on successful DB2 implementation
 * Optimized for Firebase Functions serverless environment
 */

const mysql = require('mysql2/promise');
const { getDatabaseCredentials, getSafeCredentials } = require('../utils/secrets');
const { getContextLogger } = require('../utils/logger');

// Global connection pool instance
let pool = null;
let poolLastUsed = Date.now();

// Serverless environment optimization settings
const KEEPALIVE_INTERVAL_MS = 30000; // 30 seconds
const IDLE_TIMEOUT_MS = 60000; // 1 minute idle timeout
const CONNECTION_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes lifetime

// Retry settings
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 5000;

// Connection tracking
let connectionCounter = 0;

/**
 * Create database connection pool
 * Optimized for serverless environment
 * 
 * @return {Promise<mysql.Pool>} MySQL connection pool
 */
const createPool = async () => {
  const logger = getContextLogger();
  
  try {
    // Close existing pool if exists
    if (pool) {
      logger.info('Closing existing database connection pool');
      await pool.end();
      pool = null;
    }
    
    // Get database credentials (async)
    const credentials = await getDatabaseCredentials();
    
    if (!credentials) {
      throw new Error('Failed to retrieve database credentials');
    }
    
    // Serverless-optimized pool configuration
    const poolConfig = {
      host: credentials.host,
      user: credentials.user,
      password: credentials.password,
      database: credentials.database,
      waitForConnections: true,
      connectionLimit: process.env.NODE_ENV === 'production' ? 5 : 10,
      queueLimit: 10,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      
      // Serverless-optimized timeouts
      connectTimeout: 5000,
      acquireTimeout: 10000,
      
      // Security settings
      multipleStatements: false,
      
      // Timezone and character settings
      timezone: '+09:00',
      dateStrings: true,
      charset: 'utf8mb4',
      
      // SSL settings (production)
      ssl: process.env.NODE_ENV === 'production' ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false // Relaxed for MariaDB compatibility
      } : undefined,
      
      // Performance optimization
      namedPlaceholders: true,
    };
    
    // Create pool
    const newPool = mysql.createPool(poolConfig);
    
    // Add pool ID for debugging
    newPool.poolId = `pool-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Test connection
    try {
      logger.info('Creating database connection pool...', getSafeCredentials(poolConfig));
      const connection = await newPool.getConnection();
      
      // Get server info
      const [serverInfo] = await connection.query('SELECT VERSION() as version');
      logger.info(`Database connection established successfully. MySQL version: ${serverInfo[0]?.version || 'unknown'}`);
      
      connection.release();
      
      // Set creation timestamp
      newPool.createdAt = Date.now();
      poolLastUsed = Date.now();
      
      // Setup keepalive
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
 * Setup keepalive timer for connection pool
 * Prevents connections from timing out in serverless environment
 * 
 * @param {mysql.Pool} dbPool MySQL connection pool
 */
const setupKeepAlive = (dbPool) => {
  // Clear previous timer
  if (dbPool.keepAliveTimer) {
    clearInterval(dbPool.keepAliveTimer);
  }
  
  // Setup periodic ping
  dbPool.keepAliveTimer = setInterval(async () => {
    const logger = getContextLogger();
    const idle = Date.now() - poolLastUsed;
    
    // Release pool if idle too long
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
    
    // Refresh pool if lifetime exceeded
    if (Date.now() - dbPool.createdAt > CONNECTION_LIFETIME_MS) {
      logger.info('Connection pool reached maximum lifetime, refreshing');
      clearInterval(dbPool.keepAliveTimer);
      
      // Async pool recreation
      createPool().catch(error => {
        logger.error(`Failed to refresh connection pool: ${error.message}`);
      });
      
      return;
    }
    
    // Normal keepalive ping
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
      
      // Try to refresh pool
      try {
        await createPool();
      } catch (refreshError) {
        logger.error(`Failed to refresh connection pool after failed ping: ${refreshError.message}`);
      }
    }
  }, KEEPALIVE_INTERVAL_MS);
  
  // Cleanup on process termination
  process.once('SIGTERM', async () => {
    clearInterval(dbPool.keepAliveTimer);
    if (pool) {
      try {
        await pool.end();
      } catch (error) {
        // Ignore
      }
    }
  });
};

/**
 * Get connection pool (create if needed)
 * Serverless-optimized lazy initialization
 * 
 * @return {Promise<mysql.Pool>} MySQL connection pool
 */
const getPool = async () => {
  if (!pool) {
    pool = await createPool();
  }
  
  // Update usage timestamp
  poolLastUsed = Date.now();
  
  return pool;
};

/**
 * Calculate exponential delay for retries
 * 
 * @param {number} attemptNumber Retry attempt number
 * @return {number} Delay time in milliseconds
 */
const calculateExponentialDelay = (attemptNumber) => {
  const delay = Math.min(
    Math.pow(1.5, attemptNumber) * RETRY_DELAY_MS + Math.floor(Math.random() * 250),
    MAX_RETRY_DELAY_MS
  );
  return delay;
};

/**
 * Execute function with retry logic
 * 
 * @param {Function} fn Function to execute
 * @param {number} maxAttempts Maximum retry attempts
 * @return {Promise<any>} Function execution result
 */
const withRetry = async (fn, maxAttempts = RETRY_ATTEMPTS) => {
  const logger = getContextLogger();
  let lastError = null;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry fatal errors
      if (
        error.code === 'ER_ACCESS_DENIED_ERROR' ||
        error.code === 'ER_BAD_DB_ERROR' ||
        error.fatal
      ) {
        logger.error(`Fatal database error (${error.code}), not retrying: ${error.message}`);
        throw error;
      }
      
      // Retry if not the last attempt
      if (attempt < maxAttempts - 1) {
        const delay = calculateExponentialDelay(attempt);
        logger.warn(`Database operation failed (${error.code}), attempt ${attempt + 1}/${maxAttempts}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Recreate pool on connection issues
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
 * Execute SQL query
 * Serverless-optimized with performance tracking and error handling
 * 
 * @param {string} sql SQL query
 * @param {Array|Object} params Query parameters
 * @param {Object} options Additional options
 * @return {Promise<Array>} Query results
 */
const executeQuery = async (sql, params = [], options = {}) => {
  const logger = getContextLogger();
  const start = Date.now();
  const queryId = `q-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  const { 
    maxAttempts = RETRY_ATTEMPTS, 
    timeout = 10000
  } = options;
  
  logger.debug(`[DB:${queryId}] Executing query: ${sql.substring(0, 100)}...`);
  
  try {
    // Get connection pool
    const dbPool = await withRetry(() => getPool(), maxAttempts);
    
    // Execute query with retry logic
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
    
    // Performance logging
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      logger.warn(`[DB:${queryId}] Slow query (${duration}ms): ${sql.substring(0, 100)}...`);
    } else {
      logger.debug(`[DB:${queryId}] Query completed in ${duration}ms`);
    }
    
    return result[0]; // Return results array
  } catch (error) {
    const duration = Date.now() - start;
    
    logger.error(`[DB:${queryId}] Query error (${duration}ms):`, {
      message: error.message,
      code: error.code,
      query: sql.substring(0, 200)
    });
    
    // Sanitize error message
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
 * Query single record convenience function
 * 
 * @param {string} sql SQL query
 * @param {Array|Object} params Query parameters
 * @param {Object} options Additional options
 * @return {Promise<Object|null>} Single record or null
 */
const queryOne = async (sql, params = [], options = {}) => {
  const results = await executeQuery(sql, params, options);
  return results && results.length > 0 ? results[0] : null;
};

/**
 * Get connection statistics
 * 
 * @return {Object} Connection statistics
 */
const getConnectionStats = async () => {
  if (!pool) {
    return { status: 'no_pool', message: 'No connection pool initialized' };
  }
  
  return {
    status: 'active',
    poolId: pool.poolId,
    createdAt: pool.createdAt,
    lastUsed: poolLastUsed,
    idleTime: Date.now() - poolLastUsed,
    lifetime: Date.now() - pool.createdAt
  };
};

module.exports = {
  getPool,
  executeQuery,
  queryOne,
  withRetry,
  createPool,
  getConnectionStats
};
