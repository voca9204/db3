/**
 * Database Configuration Manager
 * Supports environment-specific configurations and secure credential management
 */

const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Get environment-specific configuration
 */
function getEnvironment() {
  return process.env.NODE_ENV || 'development';
}

/**
 * Database configurations by environment
 */
const configurations = {
  development: {
    database: {
      host: process.env.DB_HOST || '211.248.190.46',
      user: process.env.DB_USER || 'hermes',
      password: process.env.DB_PASSWORD || 'mcygicng!022',
      database: process.env.DB_NAME || 'hermes',
      charset: 'utf8mb4',
      connectionLimit: 10,
      queueLimit: 0,
      acquireTimeout: 60000,
      timeout: 60000,
      slowQueryThreshold: 1000, // 1 second
      ssl: false
    },
    cache: {
      enabled: true,
      ttl: 300, // 5 minutes
      maxKeys: 1000
    },
    logging: {
      level: 'debug',
      logQueries: true,
      logSlowQueries: true
    }
  },

  production: {
    database: {
      host: process.env.DB_HOST || '211.248.190.46',
      user: process.env.DB_USER || 'hermes',
      password: process.env.DB_PASSWORD || 'mcygicng!022',
      database: process.env.DB_NAME || 'hermes',
      charset: 'utf8mb4',
      connectionLimit: 20,
      queueLimit: 0,
      acquireTimeout: 60000,
      timeout: 60000,
      slowQueryThreshold: 500, // 0.5 seconds
      ssl: {
        rejectUnauthorized: false
      }
    },
    cache: {
      enabled: true,
      ttl: 600, // 10 minutes
      maxKeys: 5000
    },
    logging: {
      level: 'info',
      logQueries: false,
      logSlowQueries: true
    }
  },

  test: {
    database: {
      host: process.env.TEST_DB_HOST || 'localhost',
      user: process.env.TEST_DB_USER || 'test',
      password: process.env.TEST_DB_PASSWORD || 'test',
      database: process.env.TEST_DB_NAME || 'test_hermes',
      charset: 'utf8mb4',
      connectionLimit: 5,
      queueLimit: 0,
      acquireTimeout: 30000,
      timeout: 30000,
      slowQueryThreshold: 2000, // 2 seconds
      ssl: false
    },
    cache: {
      enabled: false,
      ttl: 60,
      maxKeys: 100
    },
    logging: {
      level: 'debug',
      logQueries: true,
      logSlowQueries: true
    }
  }
};

/**
 * Get current configuration
 */
function getConfig() {
  const env = getEnvironment();
  const config = configurations[env];
  
  if (!config) {
    throw new Error(`Configuration not found for environment: ${env}`);
  }

  return {
    environment: env,
    ...config,
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID || 'db888',
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    },
    security: {
      allowedOrigins: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : ['*'],
      jwtSecret: process.env.JWT_SECRET,
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
    },
    api: {
      defaultLimit: parseInt(process.env.API_DEFAULT_LIMIT) || 100,
      maxLimit: parseInt(process.env.API_MAX_LIMIT) || 1000,
      rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS) || 100,
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000 // 15 minutes
    }
  };
}

/**
 * Validate configuration
 */
function validateConfig(config) {
  const required = [
    'database.host',
    'database.user', 
    'database.password',
    'database.database'
  ];

  const missing = required.filter(key => {
    const value = key.split('.').reduce((obj, k) => obj && obj[k], config);
    return !value;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }

  return true;
}

/**
 * Get database tables configuration
 */
function getTableConfig() {
  return {
    players: {
      primaryKey: 'id',
      indexes: ['userId', 'email'],
      cache: true
    },
    game_scores: {
      primaryKey: 'id',
      indexes: ['userId', 'gameDate'],
      cache: true,
      partitionBy: 'gameDate'
    },
    promotion_players: {
      primaryKey: 'id',
      indexes: ['player', 'promotion', 'appliedAt'],
      cache: false
    },
    money_flows: {
      primaryKey: 'id',
      indexes: ['userId', 'transactionDate', 'type'],
      cache: false,
      partitionBy: 'transactionDate'
    }
  };
}

// Export functions and configurations
module.exports = {
  getConfig,
  getEnvironment,
  validateConfig,
  getTableConfig,
  configurations
};
