/**
 * Database Credentials Manager for DB3
 * Simplified version from DB2's successful implementation
 */

const functions = require('firebase-functions');
const { getContextLogger } = require('./logger');

// Memory cache for credentials (cold start optimization)
let credentialsCache = null;
let credentialsCacheExpiry = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Get database credentials with multiple fallback sources
 * Priority:
 * 1. Memory cache (performance optimization)
 * 2. Firebase Config (production/staging)
 * 3. Environment variables (development)
 * 4. Default values (fallback)
 * 
 * @param {string} environment Execution environment
 * @return {Object} Database connection info
 */
const getDatabaseCredentials = async (environment = process.env.NODE_ENV || 'development') => {
  const logger = getContextLogger();
  
  // Check cache first (cold start optimization)
  const now = Date.now();
  if (credentialsCache && credentialsCacheExpiry > now) {
    logger.debug('Using cached database credentials');
    return credentialsCache;
  }
  
  let dbConfig = null;
  
  // Try Firebase Config first (production/staging)
  try {
    const config = functions.config();
    if (config && config.db) {
      dbConfig = {
        host: config.db.host,
        user: config.db.user,
        password: config.db.password,
        database: config.db.name,
      };
      
      if (dbConfig.host && dbConfig.user && dbConfig.password && dbConfig.database) {
        logger.info('Using database credentials from Firebase Config');
        
        // Set cache
        credentialsCache = dbConfig;
        credentialsCacheExpiry = now + CACHE_TTL_MS;
        
        return dbConfig;
      }
    }
  } catch (error) {
    logger.warn('Failed to get database credentials from Firebase Config:', error.message);
  }
  
  // Fallback to environment variables (development)
  if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME) {
    logger.info('Using database credentials from environment variables');
    
    dbConfig = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };
    
    // Cache with shorter TTL for development
    credentialsCache = dbConfig;
    credentialsCacheExpiry = now + (CACHE_TTL_MS / 3); // 5 minutes
    
    return dbConfig;
  }
  
  // Default fallback (development only)
  logger.warn('Using default database credentials! This should only happen in development.');
  
  dbConfig = {
    host: '211.248.190.46',
    user: 'hermes',
    password: 'mcygicng!022',
    database: 'hermes',
  };
  
  // Cache with short TTL
  credentialsCache = dbConfig;
  credentialsCacheExpiry = now + (CACHE_TTL_MS / 6); // 2.5 minutes
  
  return dbConfig;
};

/**
 * Get safe credentials for logging (password masked)
 * @param {Object} credentials Database credentials
 * @return {Object} Credentials with masked password
 */
const getSafeCredentials = (credentials) => {
  if (!credentials) return null;
  
  return {
    host: credentials.host,
    user: credentials.user,
    password: credentials.password ? '********' : null,
    database: credentials.database,
    ssl: credentials.ssl,
    connectTimeout: credentials.connectTimeout,
  };
};

module.exports = {
  getDatabaseCredentials,
  getSafeCredentials
};
