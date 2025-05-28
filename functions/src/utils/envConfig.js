/**
 * 환경변수 설정 및 검증 유틸리티
 * 환경별로 필요한 환경변수를 검증하고 기본값을 제공합니다.
 */

const path = require('path');

/**
 * 필수 환경변수 목록
 */
const REQUIRED_ENV_VARS = [
  'DB_HOST',
  'DB_USER', 
  'DB_PASSWORD',
  'DB_NAME'
];

/**
 * 선택적 환경변수와 기본값
 */
const OPTIONAL_ENV_VARS = {
  NODE_ENV: 'development',
  API_DEFAULT_LIMIT: '100',
  API_MAX_LIMIT: '1000',
  RATE_LIMIT_REQUESTS: '100',
  RATE_LIMIT_WINDOW: '900000',
  LOG_LEVEL: 'info',
  JWT_SECRET: '',
  BCRYPT_ROUNDS: '12',
  ALLOWED_ORIGINS: '*'
};

/**
 * 환경변수 검증 및 로드
 */
const validateAndLoadEnvironment = () => {
  const missingVars = [];
  const config = {};
  
  // 필수 환경변수 검증
  REQUIRED_ENV_VARS.forEach(varName => {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missingVars.push(varName);
    } else {
      config[varName] = value.trim();
    }
  });
  
  // 필수 환경변수가 없으면 오류 발생
  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}. Please check your .env file configuration.`;
    console.error('Environment Configuration Error:', errorMessage);
    throw new Error(errorMessage);
  }
  
  // 선택적 환경변수 설정
  Object.entries(OPTIONAL_ENV_VARS).forEach(([varName, defaultValue]) => {
    config[varName] = process.env[varName] || defaultValue;
  });
  
  return config;
};

/**
 * 데이터베이스 설정 가져오기
 */
const getDatabaseConfig = () => {
  const config = validateAndLoadEnvironment();
  
  return {
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    port: parseInt(config.DB_PORT || '3306', 10),
    connectionLimit: parseInt(config.DB_CONNECTION_LIMIT || '10', 10),
    acquireTimeout: parseInt(config.DB_ACQUIRE_TIMEOUT || '10000', 10),
    timeout: parseInt(config.DB_TIMEOUT || '5000', 10),
    reconnect: config.DB_RECONNECT !== 'false',
    timezone: config.DB_TIMEZONE || '+09:00'
  };
};

/**
 * API 설정 가져오기
 */
const getApiConfig = () => {
  const config = validateAndLoadEnvironment();
  
  return {
    defaultLimit: parseInt(config.API_DEFAULT_LIMIT, 10),
    maxLimit: parseInt(config.API_MAX_LIMIT, 10),
    rateLimitRequests: parseInt(config.RATE_LIMIT_REQUESTS, 10),
    rateLimitWindow: parseInt(config.RATE_LIMIT_WINDOW, 10),
    allowedOrigins: config.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()),
    jwtSecret: config.JWT_SECRET,
    bcryptRounds: parseInt(config.BCRYPT_ROUNDS, 10)
  };
};

/**
 * 로깅 설정 가져오기
 */
const getLogConfig = () => {
  const config = validateAndLoadEnvironment();
  
  return {
    level: config.LOG_LEVEL,
    enableConsole: config.NODE_ENV !== 'production',
    enableFile: config.ENABLE_FILE_LOGGING === 'true'
  };
};

/**
 * 환경변수 상태 확인 (디버깅용)
 */
const getEnvironmentStatus = () => {
  const status = {
    nodeEnv: process.env.NODE_ENV,
    hasRequiredVars: true,
    missingVars: [],
    loadedVars: []
  };
  
  try {
    REQUIRED_ENV_VARS.forEach(varName => {
      if (!process.env[varName]) {
        status.hasRequiredVars = false;
        status.missingVars.push(varName);
      } else {
        status.loadedVars.push(varName);
      }
    });
  } catch (error) {
    status.error = error.message;
    status.hasRequiredVars = false;
  }
  
  return status;
};

/**
 * 안전한 환경변수 정보 (비밀번호 마스킹)
 */
const getSafeEnvironmentInfo = () => {
  const info = {};
  
  REQUIRED_ENV_VARS.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      if (varName.toLowerCase().includes('password') || 
          varName.toLowerCase().includes('secret') ||
          varName.toLowerCase().includes('key')) {
        info[varName] = '****' + value.slice(-4);
      } else {
        info[varName] = value;
      }
    } else {
      info[varName] = '<NOT_SET>';
    }
  });
  
  return info;
};

module.exports = {
  validateAndLoadEnvironment,
  getDatabaseConfig,
  getApiConfig,
  getLogConfig,
  getEnvironmentStatus,
  getSafeEnvironmentInfo,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS
};
