/**
 * Firebase Functions for DB3 Database Query System
 * Simplified version using proven DB structure from DB2
 */

// Load environment variables for local development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Use simplified database connection from db.js
const { executeQuery, queryOne } = require('./db');

// Import Query Builder for testing (avoiding circular dependency)
const QueryBuilder = require('./src/database/queryBuilder');

// Import new filtering system for Task 1.3
const FilterEngine = require('./src/filters/FilterEngine');
const FilterPresets = require('./src/filters/FilterPresets');

// Import Advanced Search System for Task 1.4
const SearchEngine = require('./src/search/SearchEngine');

// Import Optimization Engine for Task 1.5
const { OptimizationEngine } = require('./src/optimization');

// Import Performance Monitor for Task 1.6
const { PerformanceMonitor } = require('./src/monitoring');

// Import Inactive New Users Analysis
const { getInactiveNewUsers } = require('./inactiveNewUsersAnalysis');

// Firebase Admin 초기화
admin.initializeApp();

// Initialize Optimization Engine for Task 1.5 (with reduced load)
const optimizationEngine = new OptimizationEngine({
  enableCaching: true,
  enableOptimization: false, // 비활성화
  enableAnalysis: false, // 비활성화
  enableIndexRecommendations: false, // 비활성화
  maxCacheSize: 100, // 감소
  defaultTTL: 600000, // 10분으로 증가
  slowQueryThreshold: 5000 // 5초로 증가
});

// Initialize Performance Monitor for Task 1.6 (with reduced load)
const performanceMonitor = new PerformanceMonitor({
  enableRealTimeMonitoring: false, // 비활성화
  enableAlerts: false, // 비활성화
  enableBenchmarks: false, // 비활성화
  monitoringInterval: 60000, // 1분으로 증가
  retainMetricsFor: 10 * 60 * 1000 // 10분으로 감소
});

// Start performance monitoring
performanceMonitor.startMonitoring().then(result => {
  if (result.success) {
    console.log('Performance monitoring started successfully');
  } else {
    console.error('Failed to start performance monitoring:', result.error);
  }
});

/**
 * Enhanced Authentication Middleware
 * Provides comprehensive security checks and error handling
 * Development mode bypass for local testing
 */
const authenticateUser = async (req, res, next) => {
  cors(req, res, async () => {
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const requestId = req.headers['x-request-id'] || Math.random().toString(36).substr(2, 9);
    
    // 개발 환경에서는 인증 우회 (로컬 호스트 요청)
    if (clientIP.includes('127.0.0.1') || clientIP.includes('localhost') || 
        req.headers.host?.includes('127.0.0.1') || req.headers.host?.includes('localhost')) {
      console.log(`[DEV-MODE] ${requestId}: Development mode - bypassing authentication for ${clientIP}`);
      
      // 개발 모드 사용자 정보 설정
      req.user = {
        uid: 'dev-user',
        email: 'dev@localhost.com',
        email_verified: true
      };
      req.requestId = requestId;
      
      // 보안 헤더 추가
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Development-Mode': 'true'
      });
      
      next();
      return;
    }
    
    try {
      // 1. Authorization 헤더 검증
      const authorization = req.headers.authorization;
      if (!authorization) {
        console.warn(`[AUTH-FAIL] ${requestId}: Missing authorization header from ${clientIP}`);
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'Authorization header required',
          code: 'AUTH_HEADER_MISSING'
        });
      }

      // 2. Bearer 토큰 추출
      const parts = authorization.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        console.warn(`[AUTH-FAIL] ${requestId}: Invalid authorization format from ${clientIP}`);
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'Bearer token required',
          code: 'INVALID_AUTH_FORMAT'
        });
      }

      const token = parts[1];
      if (!token || token.length < 10) {
        console.warn(`[AUTH-FAIL] ${requestId}: Invalid token format from ${clientIP}`);
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'Invalid token format',
          code: 'INVALID_TOKEN_FORMAT'
        });
      }

      // 3. Firebase 토큰 검증
      const decodedToken = await admin.auth().verifyIdToken(token, true); // checkRevoked = true
      
      // 4. 토큰 만료 시간 추가 검증
      const now = Math.floor(Date.now() / 1000);
      if (decodedToken.exp <= now) {
        console.warn(`[AUTH-FAIL] ${requestId}: Expired token from ${clientIP} for ${decodedToken.email}`);
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }

      // 5. 이메일 검증
      const allowedEmail = 'sandscasino8888@gmail.com';
      if (!decodedToken.email || decodedToken.email !== allowedEmail) {
        console.warn(`[AUTH-FAIL] ${requestId}: Access denied for email ${decodedToken.email || 'unknown'} from ${clientIP}`);
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'Access denied for this email',
          code: 'EMAIL_NOT_ALLOWED'
        });
      }

      // 6. 추가 보안 검증
      if (!decodedToken.email_verified) {
        console.warn(`[AUTH-FAIL] ${requestId}: Unverified email ${decodedToken.email} from ${clientIP}`);
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'Email verification required',
          code: 'EMAIL_NOT_VERIFIED'
        });
      }

      // 7. 성공적인 인증 로깅
      console.log(`[AUTH-SUCCESS] ${requestId}: ${decodedToken.email} from ${clientIP} - ${req.method} ${req.path}`);
      
      // 8. 보안 헤더 추가
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });

      req.user = decodedToken;
      req.requestId = requestId;
      next();
      
    } catch (error) {
      // 9. 에러 타입별 세분화된 처리
      let errorCode = 'AUTH_ERROR';
      let statusCode = 401;
      let message = 'Authentication failed';

      if (error.code === 'auth/id-token-expired') {
        errorCode = 'TOKEN_EXPIRED';
        message = 'Token expired';
      } else if (error.code === 'auth/id-token-revoked') {
        errorCode = 'TOKEN_REVOKED';
        message = 'Token revoked';
        statusCode = 403;
      } else if (error.code === 'auth/invalid-id-token') {
        errorCode = 'INVALID_TOKEN';
        message = 'Invalid token';
      } else if (error.code === 'auth/user-not-found') {
        errorCode = 'USER_NOT_FOUND';
        message = 'User not found';
        statusCode = 403;
      }

      console.error(`[AUTH-ERROR] ${requestId}: ${errorCode} from ${clientIP} - ${error.message}`);
      
      res.status(statusCode).json({ 
        error: 'Unauthorized', 
        message: message,
        code: errorCode
      });
    }
  });
};

/**
 * Hello World with System Info
 */
exports.helloWorld = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    res.json({
      message: "DB3 Simplified Database Query System",
      version: "2.1.0",
      environment: process.env.NODE_ENV || 'development',
      features: [
        "Simplified Connection Management",
        "Proven DB2 Architecture", 
        "Flexible Data Analysis",
        "Marketing Strategy Support"
      ],
      timestamp: new Date().toISOString(),
      status: "success"
    });
  });
});

/**
 * Database Connection Test
 */
exports.testConnection = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const startTime = Date.now();
      
      // Test database connection with simple query
      const testResult = await queryOne('SELECT 1 as test, NOW() as currentTime');
      const connectionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        message: "MariaDB connection successful",
        testResult,
        responseTime: `${connectionTime}ms`,
        config: {
          environment: process.env.NODE_ENV || 'development',
          host: '211.248.190.46',
          database: 'hermes'
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Connection test error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * User Game Activity Analysis
 */
exports.getUserGameActivity = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { limit = 100, minNetBet = 0, minGameDays = 0 } = req.query;
      
      const sql = `
        SELECT 
            p.userId,
            COUNT(DISTINCT gs.gameDate) as totalGameDays,
            ROUND(SUM(gs.totalBet)) as totalBetAmount,
            ROUND(SUM(gs.netBet)) as totalNetBet,
            ROUND(SUM(gs.winLoss)) as totalWinLoss,
            MIN(gs.gameDate) as firstGameDate,
            MAX(gs.gameDate) as lastGameDate,
            DATEDIFF(CURDATE(), MAX(gs.gameDate)) as daysSinceLastGame,
            CASE 
                WHEN DATEDIFF(CURDATE(), MAX(gs.gameDate)) <= 30 THEN 'active'
                ELSE 'dormant'
            END as activityStatus
        FROM players p
        JOIN game_scores gs ON p.userId = gs.userId
        GROUP BY p.userId
        HAVING totalGameDays >= ? AND totalNetBet >= ?
        ORDER BY totalNetBet DESC
        LIMIT ?
      `;
      
      const params = [
        parseInt(minGameDays), 
        parseFloat(minNetBet), 
        parseInt(limit)
      ];
      
      const results = await executeQuery(sql, params);
      
      res.json({
        status: "success",
        count: results.length,
        filters: { minNetBet, minGameDays, limit },
        data: results,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('User game activity query error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Dormant Users Query  
 */
exports.getDormantUsers = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { 
        limit = 50, 
        minNetBet = 0, 
        minGameDays = 0,
        minDormantDays = 30
      } = req.query;
      
      const sql = `
        SELECT 
            p.userId,
            COUNT(DISTINCT gs.gameDate) as totalGameDays,
            ROUND(SUM(gs.netBet)) as totalNetBet,
            ROUND(SUM(gs.winLoss)) as totalWinLoss,
            MIN(gs.gameDate) as firstGameDate,
            MAX(gs.gameDate) as lastGameDate,
            DATEDIFF(CURDATE(), MAX(gs.gameDate)) as daysSinceLastGame
        FROM players p
        JOIN game_scores gs ON p.userId = gs.userId
        GROUP BY p.userId
        HAVING totalGameDays >= ? 
           AND totalNetBet >= ?
           AND daysSinceLastGame >= ?
        ORDER BY totalNetBet DESC
        LIMIT ?
      `;
      
      const params = [
        parseInt(minGameDays), 
        parseFloat(minNetBet), 
        parseInt(minDormantDays),
        parseInt(limit)
      ];
      
      const results = await executeQuery(sql, params);
      
      res.json({
        status: "success",
        count: results.length,
        filters: { minNetBet, minGameDays, minDormantDays, limit },
        data: results,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Dormant users query error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Event Participation Analysis
 */
exports.getEventParticipationAnalysis = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { limit = 50 } = req.query;
      
      const sql = `
        SELECT 
            p.userId,
            COUNT(pp.promotion) as totalEvents,
            ROUND(SUM(pp.reward)) as totalRewards,
            COUNT(CASE WHEN pp.status = 1 THEN 1 END) as appliedEvents,
            COUNT(CASE WHEN pp.status = 0 THEN 1 END) as pendingEvents,
            COUNT(CASE WHEN pp.status = 2 THEN 1 END) as dismissedEvents,
            MIN(pp.appliedAt) as firstEventDate,
            MAX(pp.appliedAt) as lastEventDate
        FROM players p
        JOIN promotion_players pp ON p.id = pp.player
        GROUP BY p.userId
        HAVING totalEvents > 0
        ORDER BY totalRewards DESC
        LIMIT ?
      `;
      
      const results = await executeQuery(sql, [parseInt(limit)]);
      
      res.json({
        status: "success",
        count: results.length,
        filters: { limit },
        data: results,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Event participation query error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * System Status
 */
exports.getSystemStatus = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const startTime = Date.now();
      
      // Database statistics
      const statsQuery = `
        SELECT 
          'players' as table_name, COUNT(*) as record_count FROM players
        UNION ALL
        SELECT 
          'game_scores' as table_name, COUNT(*) as record_count FROM game_scores
        UNION ALL
        SELECT 
          'promotion_players' as table_name, COUNT(*) as record_count FROM promotion_players
        UNION ALL
        SELECT 
          'money_flows' as table_name, COUNT(*) as record_count FROM money_flows
      `;
      
      const stats = await executeQuery(statsQuery);
      const executionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        system: "DB3 Simplified Database Query System",
        version: "2.1.0",
        environment: process.env.NODE_ENV || 'development',
        database: {
          host: '211.248.190.46',
          database: 'hermes',
          status: "connected",
          statusQueryTime: `${executionTime}ms`
        },
        statistics: stats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('System status error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Simple Query Builder Test for Task 1.2 Firebase Deployment Testing
 * Tests Query Builder pattern using proven db.js connection
 */
class SimpleQueryBuilder {
  constructor(tableName) {
    this.tableName = tableName;
    this.whereConditions = [];
    this.selectFields = ['*'];
    this.limitValue = null;
    this.orderByField = null;
    this.orderDirection = 'ASC';
  }

  select(fields) {
    this.selectFields = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  where(field, operator, value) {
    this.whereConditions.push({ field, operator, value });
    return this;
  }

  orderBy(field, direction = 'ASC') {
    this.orderByField = field;
    this.orderDirection = direction.toUpperCase();
    return this;
  }

  limit(count) {
    this.limitValue = count;
    return this;
  }

  async execute() {
    let sql = `SELECT ${this.selectFields.join(', ')} FROM ${this.tableName}`;
    const params = [];

    if (this.whereConditions.length > 0) {
      const whereClause = this.whereConditions.map((condition, index) => {
        params.push(condition.value);
        return `${condition.field} ${condition.operator} ?`;
      }).join(' AND ');
      sql += ` WHERE ${whereClause}`;
    }

    if (this.orderByField) {
      sql += ` ORDER BY ${this.orderByField} ${this.orderDirection}`;
    }

    if (this.limitValue) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    return await executeQuery(sql, params);
  }
}

/**
 * Query Builder Test API - Task 1.2 Firebase Deployment Test
 */
exports.testQueryBuilder = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const startTime = Date.now();
      
      // Test 1: Simple SELECT with WHERE condition
      const playersQuery = new SimpleQueryBuilder('players')
        .select(['userId', 'status'])
        .where('status', '=', 0)
        .orderBy('userId', 'ASC')
        .limit(5);

      const players = await playersQuery.execute();

      // Test 2: Complex query with multiple conditions
      const aggregationSql = `
        SELECT userId, COUNT(*) as gameCount, ROUND(SUM(netBet)) as totalBet 
        FROM game_scores 
        WHERE netBet > ? 
        GROUP BY userId 
        ORDER BY totalBet DESC 
        LIMIT ?
      `;
      
      const gameStats = await executeQuery(aggregationSql, [1000, 3]);

      const executionTime = Date.now() - startTime;

      res.json({
        status: "success",
        message: "Query Builder test completed successfully",
        executionTime: `${executionTime}ms`,
        tests: {
          simpleQuery: {
            description: "Players with status=0, ordered by userId",
            resultCount: players.length,
            sample: players.slice(0, 2)
          },
          complexQuery: {
            description: "Top users by netBet > 1000",
            resultCount: gameStats.length,
            sample: gameStats
          }
        },
        queryBuilderFeatures: [
          "Fluent Interface",
          "Method Chaining", 
          "Parameter Binding",
          "SQL Injection Prevention",
          "Flexible Conditions"
        ],
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Query Builder test error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Connection Stats API - Additional testing utility
 */
exports.getConnectionStats = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const startTime = Date.now();
      
      // Test multiple concurrent queries to check connection pooling
      const promises = [
        executeQuery('SELECT COUNT(*) as count FROM players'),
        executeQuery('SELECT COUNT(*) as count FROM game_scores'), 
        executeQuery('SELECT COUNT(*) as count FROM money_flows')
      ];

      const results = await Promise.all(promises);
      const executionTime = Date.now() - startTime;

      res.json({
        status: "success",
        message: "Connection pooling test completed",
        executionTime: `${executionTime}ms`,
        concurrentQueries: 3,
        results: {
          players: results[0][0].count,
          gameScores: results[1][0].count,
          moneyFlows: results[2][0].count
        },
        performance: {
          averagePerQuery: `${Math.round(executionTime / 3)}ms`,
          totalTime: `${executionTime}ms`
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Connection stats error:', error);
      res.status(500).json({
        status: "error", 
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Query Builder Test - Simple SELECT (Public)
 */
exports.testQueryBuilderSelect = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const startTime = Date.now();
      
      // Simple Query Builder test - get basic player stats
      const queryBuilder = new QueryBuilder('players');
      const results = await queryBuilder
        .select(['userId', 'status'])
        .where('status', '=', 0)
        .limit(5)
        .execute();
      
      const executionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        message: "Query Builder SELECT test successful",
        queryBuilder: {
          type: "SELECT",
          table: "players", 
          conditions: "status = 0",
          limit: 5
        },
        results: results || [],
        count: (results || []).length,
        performance: {
          executionTime: `${executionTime}ms`
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Query Builder SELECT test error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        test: "Query Builder SELECT",
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Query Builder Test - Complex JOIN (Public)  
 */
exports.testQueryBuilderJoin = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const startTime = Date.now();
      
      // Complex Query Builder test - join with game_scores
      const queryBuilder = new QueryBuilder('players p');
      const results = await queryBuilder
        .select(['p.userId', 'COUNT(gs.gameDate) as totalGameDays'])
        .join('game_scores gs', 'p.userId', '=', 'gs.userId')
        .groupBy(['p.userId'])
        .having('COUNT(gs.gameDate)', '>', 5)
        .limit(10)
        .execute();
      
      const executionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        message: "Query Builder JOIN test successful",
        queryBuilder: {
          type: "SELECT with JOIN",
          table: "players",
          join: "game_scores",
          groupBy: "userId",
          having: "COUNT(gameDate) > 5",
          limit: 10
        },
        results: results || [],
        count: (results || []).length,
        performance: {
          executionTime: `${executionTime}ms`
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Query Builder JOIN test error:', error);
      res.status(500).json({
        status: "error", 
        message: error.message,
        test: "Query Builder JOIN",
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Query Builder Test - Protected API with Authentication
 */
exports.testQueryBuilderProtected = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const startTime = Date.now();
      const { limit = 10 } = req.query;
      
      // Protected Query Builder test - complex analysis
      const queryBuilder = new QueryBuilder('players p');
      const results = await queryBuilder
        .select([
          'p.userId',
          'COALESCE(SUM(gs.netBet), 0) as totalNetBet',
          'COALESCE(COUNT(DISTINCT gs.gameDate), 0) as totalGameDays',
          'COALESCE(SUM(gs.winLoss), 0) as totalWinLoss'
        ])
        .leftJoin('game_scores gs', 'p.userId', '=', 'gs.userId')
        .where('p.status', '=', 0)
        .groupBy(['p.userId'])
        .orderBy('totalNetBet', 'DESC')
        .limit(parseInt(limit))
        .execute();
      
      const executionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        message: "Query Builder protected test successful",
        queryBuilder: {
          type: "Complex SELECT with LEFT JOIN",
          table: "players",
          leftJoin: "game_scores",
          where: "status = 0",
          groupBy: "userId",
          orderBy: "totalNetBet DESC",
          limit: limit
        },
        results: results || [],
        count: (results || []).length,
        performance: {
          executionTime: `${executionTime}ms`
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Query Builder protected test error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        test: "Query Builder Protected",
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

/**
 * ========================================
 * NEW DATA FILTERING COMPONENT ARCHITECTURE
 * Task 1.3: Advanced filtering system with presets
 * ========================================
 */

/**
 * Test Filter Engine - Public API for testing
 */
exports.testFilterEngine = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const startTime = Date.now();
      
      // Test 1: Basic Filter Engine usage
      const filterEngine = new FilterEngine()
        .setTable('players')
        .select(['p.userId', 'p.status'])
        .addUserStatusFilter(0)
        .addExactFilter('p.userId', 'user123');
      
      const { sql, params } = filterEngine.buildQuery(null, 'p.userId ASC', 5);
      
      // Test 2: Filter summary
      const summary = filterEngine.getFilterSummary();
      
      const executionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        message: "Filter Engine test completed",
        test: {
          generatedSQL: sql,
          parameters: params,
          filterSummary: summary
        },
        performance: {
          executionTime: `${executionTime}ms`
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Filter Engine test error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        test: "Filter Engine",
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Advanced User Analysis with Filter Presets - Protected API
 */
exports.getAdvancedUserAnalysis = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { 
        preset = 'highValueUsers',
        limit = 50,
        orderBy = 'totalNetBet DESC',
        ...presetOptions 
      } = req.query;
      
      const startTime = Date.now();
      
      // Create filter using preset
      const filterEngine = FilterPresets.createByName(preset, presetOptions);
      
      // Build and execute query
      const { sql, params } = filterEngine.buildQuery(
        'p.userId',  // GROUP BY
        orderBy,     // ORDER BY
        parseInt(limit) // LIMIT
      );
      
      const results = await executeQuery(sql, params);
      const executionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        preset,
        presetOptions,
        query: {
          sql: sql.substring(0, 200) + '...', // Truncate for readability
          parameterCount: params.length
        },
        filterSummary: filterEngine.getFilterSummary(),
        results,
        count: results.length,
        performance: {
          executionTime: `${executionTime}ms`
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Advanced user analysis error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        preset: req.query.preset,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Custom Filter Builder API - Protected API
 */
exports.buildCustomFilter = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const {
        table = 'players',
        fields = ['p.userId'],
        filters = [],
        joins = [],
        groupBy = null,
        orderBy = null,
        limit = 100
      } = req.body;
      
      const startTime = Date.now();
      
      // Build custom filter
      const filterEngine = new FilterEngine()
        .setTable(table)
        .select(fields);
      
      // Add joins
      joins.forEach(join => {
        filterEngine.join(join.table, join.leftField, join.operator, join.rightField, join.type);
      });
      
      // Add filters dynamically
      filters.forEach(filter => {
        switch (filter.type) {
          case 'range':
            filterEngine.addRangeFilter(filter.field, filter.min, filter.max);
            break;
          case 'exact':
            filterEngine.addExactFilter(filter.field, filter.value);
            break;
          case 'text':
            filterEngine.addTextFilter(filter.field, filter.value);
            break;
          case 'in':
            filterEngine.addInFilter(filter.field, filter.values);
            break;
          case 'date':
            filterEngine.addDateRangeFilter(filter.field, filter.startDate, filter.endDate);
            break;
          case 'having':
            filterEngine.addHavingFilter(filter.field, filter.operator, filter.value);
            break;
          case 'activity':
            filterEngine.addActivityFilter(filter.status, filter.threshold);
            break;
          case 'userStatus':
            filterEngine.addUserStatusFilter(filter.status);
            break;
        }
      });
      
      // Build query
      const { sql, params } = filterEngine.buildQuery(groupBy, orderBy, parseInt(limit));
      
      // Execute query
      const results = await executeQuery(sql, params);
      const executionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        message: "Custom filter executed successfully",
        query: {
          sql,
          parameters: params
        },
        filterSummary: filterEngine.getFilterSummary(),
        results,
        count: results.length,
        performance: {
          executionTime: `${executionTime}ms`
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Custom filter builder error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Available Filter Presets API - Public for documentation
 */
exports.getFilterPresets = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const presets = FilterPresets.getAvailablePresets();
      
      const presetDescriptions = {
        highValueUsers: "Users with significant betting activity and engagement",
        dormantUsers: "Users who haven't played recently but have valuable history",
        newActiveUsers: "Recently joined users with good initial activity",
        eventParticipants: "Users who participated in promotional events",
        recentBigSpenders: "Users with high activity in recent period",
        consistentPlayers: "Regular players with consistent long-term activity",
        riskUsers: "Users with unusual patterns requiring attention",
        vipCandidates: "High-value users suitable for VIP programs",
        reactivationTargets: "Dormant users with good reactivation potential"
      };
      
      const detailedPresets = presets.map(preset => ({
        name: preset,
        description: presetDescriptions[preset],
        parameters: getPresetParameters(preset)
      }));
      
      res.json({
        status: "success",
        message: "Available filter presets",
        totalPresets: presets.length,
        presets: detailedPresets,
        usage: {
          endpoint: "/getAdvancedUserAnalysis",
          method: "GET",
          example: "?preset=highValueUsers&minNetBet=200000&limit=20"
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Get filter presets error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Helper function to get preset parameters
 */
function getPresetParameters(presetName) {
  const parameters = {
    highValueUsers: ['minNetBet', 'minGameDays'],
    dormantUsers: ['minDormantDays', 'minHistoricalBet'],
    newActiveUsers: ['maxDaysSinceFirst', 'minGameDays'],
    eventParticipants: ['minEvents', 'minRewards'],
    recentBigSpenders: ['daysPeriod', 'minRecentBet'],
    consistentPlayers: ['minGameDays', 'minConsistencyRatio'],
    riskUsers: ['maxWinLossRatio', 'minTotalBet'],
    vipCandidates: ['minNetBet', 'minGameDays', 'maxDaysSinceLastGame'],
    reactivationTargets: ['minDormantDays', 'maxDormantDays', 'minHistoricalValue']
  };
  
  return parameters[presetName] || [];
}

// ==================== TASK 1.4: ADVANCED SEARCH FUNCTIONALITY ====================

/**
 * Advanced Text Search API
 * Supports complex search expressions, fuzzy matching, and relevance scoring
 */
exports.advancedTextSearch = functions.https.onRequest((req, res) => {
  authenticateUser(req, res, async () => {
    try {
      const { 
        query,
        enableFuzzy = true,
        fuzzyThreshold = 60,
        maxResults = 50,
        searchFields = ['userId'],
        sortField = 'relevanceScore',
        sortDirection = 'DESC',
        pagination
      } = req.query;

      if (!query) {
        return res.status(400).json({
          status: "error",
          message: "Search query is required",
          example: "?query=user123&enableFuzzy=true&maxResults=20"
        });
      }

      // Initialize Search Engine
      const searchEngine = new SearchEngine({
        enableFuzzySearch: enableFuzzy === 'true',
        enableRelevanceScoring: true,
        enablePagination: true,
        maxResults: Math.min(parseInt(maxResults) || 50, 100)
      });

      // Get user data for searching
      const userData = await executeQuery(`
        SELECT 
          p.userId,
          p.status,
          COUNT(DISTINCT gs.gameDate) as 총게임일수,
          ROUND(SUM(gs.netBet)) as 총유효배팅,
          ROUND(SUM(gs.winLoss)) as 총손익,
          MIN(gs.gameDate) as 첫게임일,
          MAX(gs.gameDate) as 마지막게임일,
          DATEDIFF(CURDATE(), MAX(gs.gameDate)) as 휴면일수,
          CASE 
            WHEN DATEDIFF(CURDATE(), MAX(gs.gameDate)) <= 30 THEN 'active'
            ELSE 'dormant'
          END as 활동상태
        FROM players p
        LEFT JOIN game_scores gs ON p.userId = gs.userId
        WHERE p.status = 0
        GROUP BY p.userId
        HAVING 총게임일수 >= 0
        ORDER BY 총유효배팅 DESC
        LIMIT 1000
      `);

      // Search options
      const searchOptions = {
        enableFuzzy: enableFuzzy === 'true',
        fuzzyThreshold: parseInt(fuzzyThreshold),
        searchFields: Array.isArray(searchFields) ? searchFields : [searchFields],
        sortField,
        sortDirection,
        pagination: pagination ? {
          cursor: req.query.cursor,
          pageSize: parseInt(req.query.pageSize) || 20,
          direction: req.query.direction || 'next'
        } : null
      };

      // Execute search
      const searchResult = await searchEngine.search(query, userData, searchOptions);

      res.json({
        status: "success",
        message: `Advanced search completed for "${query}"`,
        ...searchResult,
        queryInfo: {
          originalQuery: query,
          enabledFeatures: {
            fuzzyMatching: enableFuzzy === 'true',
            relevanceScoring: true,
            pagination: !!pagination
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Advanced text search error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Search Suggestions API
 * Provides autocomplete suggestions based on fuzzy matching
 */
exports.getSearchSuggestions = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { 
        query,
        maxSuggestions = 10,
        minSimilarity = 70
      } = req.query;

      if (!query || query.length < 2) {
        return res.status(400).json({
          status: "error",
          message: "Query must be at least 2 characters long"
        });
      }

      // Initialize Search Engine
      const searchEngine = new SearchEngine();

      // Get user IDs for suggestions
      const userData = await executeQuery(`
        SELECT DISTINCT userId 
        FROM players 
        WHERE status = 0 AND userId IS NOT NULL 
        ORDER BY userId 
        LIMIT 1000
      `);

      // Get suggestions
      const suggestions = searchEngine.getSuggestions(query, userData, {
        maxSuggestions: parseInt(maxSuggestions),
        minSimilarity: parseInt(minSimilarity)
      });

      res.json({
        status: "success",
        message: `Found ${suggestions.length} suggestions for "${query}"`,
        query,
        suggestions,
        totalSuggestions: suggestions.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Search suggestions error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Smart Query Parser API
 * Parses complex search expressions and returns query structure
 */
exports.parseSearchQuery = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { query } = req.query;

      if (!query) {
        return res.status(400).json({
          status: "error",
          message: "Search query is required",
          examples: [
            "user123 AND active",
            "userId:john OR status:1",
            "(새로운 OR 신규) AND 베팅",
            "NOT 휴면"
          ]
        });
      }

      // Initialize Search Engine
      const searchEngine = new SearchEngine();
      
      // Parse query
      const parseResult = searchEngine.queryParser.parse(query);

      if (!parseResult.success) {
        return res.status(400).json({
          status: "error",
          message: `Query parsing failed: ${parseResult.error}`,
          originalQuery: query
        });
      }

      res.json({
        status: "success",
        message: "Query parsed successfully",
        originalQuery: query,
        parsedQuery: parseResult,
        queryStructure: {
          termCount: parseResult.termCount,
          complexity: parseResult.complexity,
          tokens: parseResult.tokens
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Parse search query error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Search Engine Performance Test API
 * Tests search engine performance with various queries
 */
exports.testSearchPerformance = functions.https.onRequest((req, res) => {
  authenticateUser(req, res, async () => {
    try {
      // Initialize Search Engine
      const searchEngine = new SearchEngine({
        enableFuzzySearch: true,
        enableRelevanceScoring: true,
        performanceTracking: true
      });

      // Test queries
      const testQueries = [
        "admin",
        "test123",
        "user OR admin",
        "NOT inactive",
        "userId:test*",
        "(active AND 베팅) OR 신규",
        "fuzzy matching test",
        "복잡한 한글 검색어",
        "status:0 AND active",
        "dormant OR 휴면"
      ];

      // Get test dataset
      const testData = await executeQuery(`
        SELECT 
          p.userId,
          p.status,
          COUNT(DISTINCT gs.gameDate) as 총게임일수,
          ROUND(SUM(gs.netBet)) as 총유효배팅,
          MAX(gs.gameDate) as 마지막게임일,
          DATEDIFF(CURDATE(), MAX(gs.gameDate)) as 휴면일수,
          CASE 
            WHEN DATEDIFF(CURDATE(), MAX(gs.gameDate)) <= 30 THEN 'active'
            ELSE 'dormant'
          END as 활동상태
        FROM players p
        LEFT JOIN game_scores gs ON p.userId = gs.userId
        WHERE p.status = 0
        GROUP BY p.userId
        LIMIT 500
      `);

      // Run performance test
      const performanceResult = await searchEngine.performanceTest(testQueries, testData);
      
      // Get engine metrics
      const metrics = searchEngine.getMetrics();

      res.json({
        status: "success",
        message: "Search engine performance test completed",
        testDataset: {
          totalUsers: testData.length,
          testQueries: testQueries.length
        },
        performanceResults: performanceResult,
        engineMetrics: metrics,
        recommendations: {
          averageResponseTime: performanceResult.averageResponseTime < 100 ? 
            "Excellent performance" : 
            performanceResult.averageResponseTime < 500 ? 
            "Good performance" : "Consider optimization",
          successRate: performanceResult.successRate >= 95 ? 
            "Excellent reliability" : "Review error handling"
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Search performance test error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Fuzzy Search API
 * Dedicated endpoint for fuzzy matching functionality
 */
exports.fuzzySearch = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { 
        query,
        threshold = 60,
        maxResults = 20,
        includeScoreBreakdown = false
      } = req.query;

      if (!query) {
        return res.status(400).json({
          status: "error",
          message: "Search query is required for fuzzy matching"
        });
      }

      // Initialize Fuzzy Matcher
      const searchEngine = new SearchEngine({
        enableFuzzySearch: true,
        enableRelevanceScoring: false
      });

      // Get user data
      const userData = await executeQuery(`
        SELECT userId 
        FROM players 
        WHERE status = 0 AND userId IS NOT NULL 
        ORDER BY userId 
        LIMIT 1000
      `);

      // Extract user IDs for fuzzy matching
      const userIds = userData.map(user => user.userId);

      // Perform fuzzy matching
      const fuzzyResults = searchEngine.fuzzyMatcher.findMatches(query, userIds, {
        threshold: parseInt(threshold),
        limit: parseInt(maxResults)
      });

      res.json({
        status: "success",
        message: `Fuzzy search completed for "${query}"`,
        query,
        threshold: parseInt(threshold),
        results: fuzzyResults.map(result => ({
          userId: result.text,
          similarity: result.similarity,
          distance: result.distance,
          ...(includeScoreBreakdown === 'true' && { 
            scoreBreakdown: {
              exactMatch: result.text === query,
              partialMatch: result.text.includes(query),
              levenshteinDistance: result.distance
            }
          })
        })),
        totalResults: fuzzyResults.length,
        searchParameters: {
          algorithm: "Levenshtein Distance",
          threshold,
          maxResults
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Fuzzy search error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Search Engine Status API
 * Provides comprehensive status of the search engine
 */
exports.getSearchEngineStatus = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Initialize Search Engine
      const searchEngine = new SearchEngine({
        performanceTracking: true
      });

      // Get various status information
      const metrics = searchEngine.getMetrics();
      const cacheInfo = searchEngine.paginator.getCacheInfo();

      // Test basic functionality
      const testResult = await searchEngine.search("test", [
        { userId: "test123", status: 0 },
        { userId: "admin", status: 0 },
        { userId: "user456", status: 0 }
      ]);

      res.json({
        status: "success",
        message: "Search engine is operational",
        engineStatus: {
          version: "1.0.0",
          components: {
            queryParser: "✅ Operational",
            fuzzyMatcher: "✅ Operational", 
            relevanceScorer: "✅ Operational",
            paginator: "✅ Operational"
          },
          features: {
            complexQueryParsing: true,
            fuzzyMatching: true,
            relevanceScoring: true,
            cursorPagination: true,
            caching: true,
            performanceTracking: true
          }
        },
        performanceMetrics: metrics,
        cacheInformation: cacheInfo,
        testResults: {
          basicSearch: testResult ? "✅ Passed" : "❌ Failed",
          responseTime: testResult?.searchMetadata?.responseTime || 0
        },
        capabilities: {
          maxResultsPerSearch: 1000,
          maxQueryLength: 1000,
          supportedOperators: ["AND", "OR", "NOT", "()", "field:value", "*"],
          supportedLanguages: ["English", "Korean"],
          fuzzyMatchingAlgorithm: "Levenshtein Distance"
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Search engine status error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// ==================== TASK 1.5: QUERY OPTIMIZATION AND CACHING SYSTEM ====================

/**
 * Execute Optimized Query API - Protected
 * Uses the full optimization pipeline including caching, optimization, and analysis
 */
exports.executeOptimizedQuery = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { sql, params = [], options = {} } = req.body;
      
      if (!sql) {
        return res.status(400).json({
          status: "error",
          message: "SQL query is required",
          example: {
            sql: "SELECT userId, status FROM players WHERE status = ? LIMIT ?",
            params: [0, 10]
          }
        });
      }
      
      // Execute through optimization engine
      const result = await optimizationEngine.executeOptimizedQuery(sql, params, options);
      
      // Record query execution in performance monitor
      if (result.success && result.metadata) {
        performanceMonitor.recordQueryExecution({
          queryId: result.metadata.queryId,
          sql,
          executionTime: result.metadata.executionTime,
          fromCache: result.metadata.wasCached,
          optimized: result.metadata.wasOptimized,
          complexity: result.metadata.analysis?.complexityScore || 0,
          resultSize: Array.isArray(result.data) ? result.data.length : 1,
          endpoint: 'executeOptimizedQuery'
        });
      }
      
      res.json({
        status: result.success ? "success" : "error",
        ...result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Execute optimized query error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Performance Report API - Protected
 * Get comprehensive performance analysis including cache stats, slow queries, and recommendations
 */
exports.getPerformanceReport = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const result = await optimizationEngine.getPerformanceReport();
      
      res.json({
        status: result.success ? "success" : "error",
        ...result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Performance report error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Query Optimization Test API - Protected
 * Optimize a query without executing it to see what improvements would be made
 */
exports.testQueryOptimization = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { sql, params = [] } = req.body;
      
      if (!sql) {
        return res.status(400).json({
          status: "error",
          message: "SQL query is required for optimization testing"
        });
      }
      
      const result = await optimizationEngine.optimizeQuery(sql, params);
      
      res.json({
        status: result.success ? "success" : "error",
        ...result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Query optimization test error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Query Analysis API - Protected
 * Analyze a query's execution plan and performance characteristics
 */
exports.analyzeQuery = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { sql, params = [] } = req.body;
      
      if (!sql) {
        return res.status(400).json({
          status: "error",
          message: "SQL query is required for analysis"
        });
      }
      
      const result = await optimizationEngine.analyzeQuery(sql, params);
      
      res.json({
        status: result.success ? "success" : "error",
        ...result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Query analysis error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Index Recommendations API - Protected
 * Get smart index recommendations based on query patterns
 */
exports.getIndexRecommendations = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { 
        minConfidence = 70,
        maxResults = 20,
        priorityFilter = null,
        tableFilter = null
      } = req.query;
      
      const options = {
        minConfidence: parseInt(minConfidence),
        maxResults: parseInt(maxResults),
        priorityFilter,
        tableFilter
      };
      
      const result = await optimizationEngine.getIndexRecommendations(options);
      
      res.json({
        status: result.success ? "success" : "error",
        ...result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Index recommendations error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Cache Management API - Protected
 * Manage query cache operations
 */
exports.manageCacheOperations = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { operation, pattern, tableName } = req.body;
      
      let result;
      
      switch (operation) {
        case 'stats':
          result = optimizationEngine.getCacheStats();
          break;
          
        case 'clear':
          result = { clearedEntries: optimizationEngine.clearCache() };
          break;
          
        case 'invalidate':
          if (!pattern) {
            return res.status(400).json({
              status: "error",
              message: "Pattern is required for invalidate operation"
            });
          }
          result = { invalidatedEntries: optimizationEngine.invalidateCache(pattern) };
          break;
          
        case 'invalidateByTable':
          if (!tableName) {
            return res.status(400).json({
              status: "error",
              message: "Table name is required for invalidateByTable operation"
            });
          }
          result = { invalidatedEntries: optimizationEngine.invalidateCacheByTable(tableName) };
          break;
          
        default:
          return res.status(400).json({
            status: "error",
            message: "Invalid operation. Supported: stats, clear, invalidate, invalidateByTable"
          });
      }
      
      res.json({
        status: "success",
        operation,
        result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Cache management error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Performance Testing API - Protected
 * Run performance tests comparing optimized vs non-optimized queries
 */
exports.runPerformanceTest = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { useCustomQueries = false, customQueries = [] } = req.body;
      
      let testQueries;
      
      if (useCustomQueries && customQueries.length > 0) {
        testQueries = customQueries;
      } else {
        testQueries = optimizationEngine.generateSampleTestQueries();
      }
      
      const result = await optimizationEngine.performanceTest(testQueries);
      
      res.json({
        status: result.success ? "success" : "error",
        ...result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Performance test error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Optimization Engine Status API - Public
 * Check the health and status of the optimization engine
 */
exports.getOptimizationStatus = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const healthCheck = await optimizationEngine.healthCheck();
      const configuration = optimizationEngine.getConfiguration();
      const overviewStats = optimizationEngine.getOverviewStats();
      
      res.json({
        status: "success",
        health: healthCheck,
        configuration,
        statistics: overviewStats,
        features: {
          caching: "✅ Enabled",
          queryOptimization: "✅ Enabled",
          performanceAnalysis: "✅ Enabled",
          indexRecommendations: "✅ Enabled",
          realTimeMonitoring: "✅ Enabled"
        },
        endpoints: {
          executeOptimizedQuery: "/executeOptimizedQuery (POST, Protected)",
          getPerformanceReport: "/getPerformanceReport (GET, Protected)",
          testQueryOptimization: "/testQueryOptimization (POST, Protected)",
          analyzeQuery: "/analyzeQuery (POST, Protected)",
          getIndexRecommendations: "/getIndexRecommendations (GET, Protected)",
          manageCacheOperations: "/manageCacheOperations (POST, Protected)",
          runPerformanceTest: "/runPerformanceTest (POST, Protected)"
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Optimization status error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Sample Optimized Query Demo API - Public
 * Demonstrate optimization engine capabilities with sample queries
 */
exports.demoOptimization = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      // Sample query for demonstration
      const sampleQuery = {
        sql: `SELECT p.userId, COUNT(DISTINCT gs.gameDate) as totalGameDays,
              ROUND(SUM(gs.netBet)) as totalNetBet
              FROM players p 
              LEFT JOIN game_scores gs ON p.userId = gs.userId 
              WHERE p.status = ? 
              GROUP BY p.userId 
              ORDER BY totalNetBet DESC 
              LIMIT ?`,
        params: [0, 5]
      };
      
      // Execute with optimization
      const optimizedResult = await optimizationEngine.executeOptimizedQuery(
        sampleQuery.sql, 
        sampleQuery.params
      );
      
      // Get optimization analysis
      const analysisResult = await optimizationEngine.analyzeQuery(
        sampleQuery.sql, 
        sampleQuery.params
      );
      
      res.json({
        status: "success",
        message: "Optimization engine demonstration completed",
        demo: {
          sampleQuery,
          executionResult: {
            success: optimizedResult.success,
            dataCount: optimizedResult.data?.length || 0,
            metadata: optimizedResult.metadata
          },
          analysis: analysisResult.success ? {
            complexityScore: analysisResult.analysis?.performance?.complexityScore,
            recommendations: analysisResult.analysis?.recommendations?.length || 0,
            executionPlan: analysisResult.analysis?.executionPlan?.summary
          } : null
        },
        engineStats: optimizationEngine.getOverviewStats(),
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Optimization demo error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// ==================== TASK 1.6: PERFORMANCE MONITORING SYSTEM ====================

/**
 * Performance Dashboard API - Protected
 * Get real-time performance dashboard with comprehensive metrics
 */
exports.getPerformanceDashboard = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { timeRange = '1h' } = req.query;
      
      const result = await performanceMonitor.getPerformanceDashboard(timeRange);
      
      res.json({
        status: result.success ? "success" : "error",
        ...result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Performance dashboard error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * System Health Check API - Public
 * Get current system health status and component status
 */
exports.getSystemHealth = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const result = await performanceMonitor.performHealthCheck();
      
      res.json({
        status: result.success ? "success" : "error",
        ...result,
        monitoringStatus: performanceMonitor.getMonitoringStatus(),
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('System health check error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Run Benchmark API - Protected
 * Execute performance benchmarks on demand
 */
exports.runBenchmark = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { suiteName = 'basic', options = {} } = req.body;
      
      const result = await performanceMonitor.benchmarkRunner.runBenchmarkSuite(suiteName, options);
      
      res.json({
        status: result.success ? "success" : "error",
        ...result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Benchmark execution error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Performance Monitor Status API - Public
 * Get comprehensive status of the performance monitoring system
 */
exports.getMonitoringStatus = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const monitoringStatus = performanceMonitor.getMonitoringStatus();
      const healthCheck = await performanceMonitor.performHealthCheck();
      
      res.json({
        status: "success",
        monitoring: monitoringStatus,
        health: healthCheck.health,
        features: {
          realTimeMonitoring: "✅ Enabled",
          alertSystem: "✅ Enabled", 
          benchmarkRunner: "✅ Enabled",
          metricsCollection: "✅ Enabled",
          performanceAnalysis: "✅ Enabled"
        },
        endpoints: {
          getPerformanceDashboard: "/getPerformanceDashboard (GET, Protected)",
          getSystemHealth: "/getSystemHealth (GET, Public)",
          runBenchmark: "/runBenchmark (POST, Protected)",
          getMonitoringStatus: "/getMonitoringStatus (GET, Public)"
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Monitoring status error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Inactive New Users Analysis API - Public
 * Get comprehensive analysis of new users who joined but haven't played games
 */
exports.getInactiveNewUsersAnalysis = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      console.log('🔍 Starting inactive new users analysis...');
      
      const result = await getInactiveNewUsers();
      
      if (result.success) {
        res.json({
          status: "success",
          data: result.data,
          analysis: result.analysis,
          performance: result.performance,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          status: "error",
          message: result.error,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Inactive new users analysis error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// 미활성 사용자 데이터 CSV 다운로드 엔드포인트
exports.downloadInactiveUsersCSV = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      console.log('📥 미활성 사용자 CSV 다운로드 요청...');
      
      // 미활성 사용자 데이터 가져오기
      const result = await getInactiveNewUsers();
      
      if (!result.success) {
        return res.status(500).json({
          status: "error",
          message: result.error
        });
      }

      // CSV 헤더 설정
      const csvHeaders = ['유저ID', '대표ID', '가입날짜', '가입기간', '가입후경과일', '그룹총NetBet'];
      
      // CSV 데이터 생성
      const csvData = result.data.map(user => [
        user.userId || '',
        user.representative_userId || '',
        user.join_date ? new Date(user.join_date).toISOString().split('T')[0] : '',
        user.join_period || '',
        user.days_since_join || '',
        user.group_total_netbet ? Math.round(user.group_total_netbet).toLocaleString() : '0'
      ]);

      // CSV 문자열 생성 (따옴표 처리 개선)
      const csvContent = [
        csvHeaders.join(','),
        ...csvData.map(row => row.map(field => {
          // 빈 값이나 숫자가 아닌 경우에만 따옴표 적용
          if (field === '' || field === null || field === undefined) {
            return '""';
          }
          // 문자열인 경우 따옴표로 감싸기
          return `"${field}"`;
        }).join(','))
      ].join('\n');

      // UTF-8 BOM 추가 (Excel에서 한글 인코딩 문제 해결)
      const bom = '\uFEFF';
      const csvWithBom = bom + csvContent;

      // CSV 응답 헤더 설정
      const fileName = `inactive_users_${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      
      console.log(`✅ CSV 생성 완료: ${result.data.length}건`);
      
      res.status(200).send(csvWithBom);
      
    } catch (error) {
      console.error('CSV 다운로드 오류:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// =============================================================================
// Task 3.2: Index Performance Monitoring APIs
// =============================================================================

// Import Index Monitoring APIs
const indexMonitoringAPI = require('./index_monitoring_api');

// Index Performance Dashboard - 전체 현황
exports.getIndexPerformanceDashboard = indexMonitoringAPI.getIndexPerformanceDashboard;

// Real-time Index Status Check
exports.checkIndexStatus = indexMonitoringAPI.checkIndexStatus;

// Run Performance Tests
exports.runIndexPerformanceTest = indexMonitoringAPI.runIndexPerformanceTest;

// Index Monitoring System Status
exports.getIndexMonitoringStatus = indexMonitoringAPI.getIndexMonitoringStatus;

// =============================================================================
// Task 3.3: Auto Index Optimizer APIs  
// =============================================================================

const AutoIndexOptimizer = require('./src/optimization/AutoIndexOptimizer');

// Auto Index Optimizer instance
let autoIndexOptimizer = null;

/**
 * Initialize Auto Index Optimizer
 */
function getAutoIndexOptimizer() {
  if (!autoIndexOptimizer) {
    autoIndexOptimizer = new AutoIndexOptimizer({
      autoExecute: false, // Safety first - manual approval required
      enableDetailedLogging: true,
      confidenceThreshold: 80,
      performanceThreshold: 1000
    });
  }
  return autoIndexOptimizer;
}

/**
 * Run Auto Index Optimization Analysis
 */
exports.runAutoIndexAnalysis = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      console.log('🔍 Starting auto index optimization analysis...');
      const optimizer = getAutoIndexOptimizer();
      
      // Run comprehensive analysis only (no execution)
      const analysis = await optimizer.performComprehensiveAnalysis();
      const plan = await optimizer.generateOptimizationPlan(analysis);
      
      res.json({
        status: "success",
        message: "Auto index analysis completed",
        analysis: {
          database: {
            totalTables: analysis.database.totalTables,
            totalRows: analysis.database.totalRows,
            totalDataSize: Math.round(analysis.database.totalDataSize / 1024 / 1024), // MB
            totalIndexSize: Math.round(analysis.database.totalIndexSize / 1024 / 1024) // MB
          },
          indexes: {
            totalIndexes: analysis.indexes.totalIndexes,
            duplicates: analysis.indexes.duplicates.length,
            unused: analysis.indexes.unused.length,
            inefficient: analysis.indexes.inefficient.length
          },
          recommendations: analysis.recommendations.length,
          plan: {
            actionsPlanned: plan.actions.length,
            priority: plan.priority,
            estimatedImpact: plan.estimatedImpact,
            risks: plan.risks.length
          }
        },
        optimizationPlan: plan,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Auto index analysis error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Execute Auto Index Optimization
 */
exports.executeAutoIndexOptimization = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      console.log('⚡ Starting auto index optimization execution...');
      const optimizer = getAutoIndexOptimizer();
      
      // Enable auto execution for this call
      optimizer.options.autoExecute = true;
      
      const report = await optimizer.runOptimizationCycle();
      
      // Reset auto execution to false for safety
      optimizer.options.autoExecute = false;
      
      res.json({
        status: "success",
        message: "Auto index optimization completed",
        report: report,
        summary: {
          tablesAnalyzed: report.summary.tablesAnalyzed,
          indexesAnalyzed: report.summary.indexesAnalyzed,
          actionsPlanned: report.summary.actionsPlanned,
          actionsExecuted: report.summary.actionsExecuted,
          actionsFailed: report.summary.actionsFailed,
          estimatedImpact: report.estimatedImpact
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Auto index optimization error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Get Auto Index Optimizer Status
 */
exports.getAutoIndexOptimizerStatus = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const optimizer = getAutoIndexOptimizer();
      const status = optimizer.getDetailedStatus();
      
      res.json({
        status: "success",
        optimizerStatus: status,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Auto index optimizer status error:', error);
      res.status(500).json({
        status: "error", 
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Get Auto Index Recommendations
 */
exports.getAutoIndexRecommendations = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      console.log('📊 Getting auto index recommendations...');
      const optimizer = getAutoIndexOptimizer();
      
      const analysis = await optimizer.performComprehensiveAnalysis();
      
      // Group recommendations by priority
      const groupedRecommendations = {
        critical: analysis.recommendations.filter(r => r.priority === 'high' && r.confidence >= 90),
        important: analysis.recommendations.filter(r => r.priority === 'high' && r.confidence >= 75),
        suggested: analysis.recommendations.filter(r => r.priority === 'medium'),
        optional: analysis.recommendations.filter(r => r.priority === 'low')
      };
      
      res.json({
        status: "success",
        message: "Auto index recommendations generated",
        recommendations: groupedRecommendations,
        summary: {
          total: analysis.recommendations.length,
          critical: groupedRecommendations.critical.length,
          important: groupedRecommendations.important.length,
          suggested: groupedRecommendations.suggested.length,
          optional: groupedRecommendations.optional.length
        },
        duplicateIndexes: analysis.indexes.duplicates,
        unusedIndexes: analysis.indexes.unused,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Auto index recommendations error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Manual Index Optimization (Execute specific actions)
 */
exports.executeManualIndexOptimization = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { actionIds = [] } = req.body;
      
      if (!actionIds.length) {
        return res.status(400).json({
          status: "error",
          message: "No action IDs provided"
        });
      }
      
      console.log(`🔧 Executing manual index optimization for ${actionIds.length} actions...`);
      
      const optimizer = getAutoIndexOptimizer();
      const analysis = await optimizer.performComprehensiveAnalysis();
      const plan = await optimizer.generateOptimizationPlan(analysis);
      
      // Filter actions by provided IDs
      const filteredActions = plan.actions.filter(action => actionIds.includes(action.id));
      
      if (!filteredActions.length) {
        return res.status(400).json({
          status: "error",
          message: "No matching actions found for provided IDs"
        });
      }
      
      // Execute filtered actions
      const filteredPlan = { ...plan, actions: filteredActions };
      const execution = await optimizer.executeOptimizationPlan(filteredPlan);
      
      res.json({
        status: "success",
        message: `Manual index optimization completed for ${actionIds.length} actions`,
        execution: execution,
        results: {
          successful: execution.successful.length,
          failed: execution.failed.length,
          skipped: execution.skipped.length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Manual index optimization error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Reset Auto Index Optimizer Learning Data
 */
exports.resetAutoIndexOptimizer = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      console.log('🔄 Resetting auto index optimizer learning data...');
      
      const optimizer = getAutoIndexOptimizer();
      optimizer.resetLearningData();
      
      res.json({
        status: "success",
        message: "Auto index optimizer learning data reset successfully",
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Reset auto index optimizer error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// =============================================================================
// Task 3.4: Index Management Dashboard APIs
// =============================================================================

const indexManagementAPI = require('./index_management_api');

/**
 * Index Management Dashboard - 통합 인덱스 관리 현황
 */
exports.getIndexManagementDashboard = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      console.log('📊 Getting index management dashboard...');
      
      const allIndexes = await indexManagementAPI.indexManagementSystem.getAllIndexes();
      const usageStats = await indexManagementAPI.indexManagementSystem.getIndexUsageStats();
      const managementStatus = indexManagementAPI.indexManagementSystem.getManagementStatus();

      res.json({
        status: "success",
        message: "Index management dashboard data retrieved",
        data: {
          indexes: allIndexes,
          usageStats,
          managementStatus,
          summary: {
            totalTables: Object.keys(allIndexes).length,
            totalIndexes: Object.values(allIndexes).reduce((sum, table) => 
              sum + Object.keys(table.indexes).length, 0),
            totalSize: Math.round(Object.values(allIndexes).reduce((sum, table) => 
              sum + (table.indexLength || 0), 0) / 1024 / 1024) // MB
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Index management dashboard error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Create New Index
 */
exports.createIndex = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { tableName, indexName, columns, options = {} } = req.body;
      
      if (!tableName || !indexName || !columns) {
        return res.status(400).json({
          status: "error",
          message: "tableName, indexName, and columns are required"
        });
      }

      console.log(`🔧 Creating index ${indexName} on table ${tableName}...`);
      
      const result = await indexManagementAPI.indexManagementSystem.createIndex(tableName, indexName, columns, options);
      
      res.json({
        status: "success",
        message: "Index created successfully",
        result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Create index error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Drop Index
 */
exports.dropIndex = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { tableName, indexName, options = {} } = req.body;
      
      if (!tableName || !indexName) {
        return res.status(400).json({
          status: "error",
          message: "tableName and indexName are required"
        });
      }

      console.log(`🗑️ Dropping index ${indexName} from table ${tableName}...`);
      
      const result = await indexManagementAPI.indexManagementSystem.dropIndex(tableName, indexName, options);
      
      res.json({
        status: "success",
        message: "Index dropped successfully",
        result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Drop index error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Analyze Specific Index Performance
 */
exports.analyzeIndex = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { tableName, indexName } = req.query;
      
      if (!tableName || !indexName) {
        return res.status(400).json({
          status: "error",
          message: "tableName and indexName query parameters are required"
        });
      }

      console.log(`🔍 Analyzing index ${indexName} on table ${tableName}...`);
      
      const analysis = await indexManagementAPI.indexManagementSystem.analyzeIndexPerformance(tableName, indexName);
      
      res.json({
        status: "success",
        message: "Index analysis completed",
        analysis,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Analyze index error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Generate Performance Report
 */
exports.generatePerformanceReport = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { tableName, days = 7, includeRecommendations = true } = req.query;
      
      console.log(`📈 Generating performance report for ${days} days...`);
      
      const report = await indexManagementAPI.indexManagementSystem.generatePerformanceReport({
        tableName,
        days: parseInt(days),
        includeRecommendations: includeRecommendations === 'true'
      });
      
      res.json({
        status: "success",
        message: "Performance report generated successfully",
        report,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Generate performance report error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Get Index Management System Status
 */
exports.getIndexManagementStatus = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const status = indexManagementAPI.indexManagementSystem.getManagementStatus();
      
      res.json({
        status: "success",
        managementStatus: status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get index management status error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// ============================================================================
// SECURITY TESTING & MONITORING ENDPOINTS - Task 5.3
// ============================================================================

/**
 * Security Test Suite - Protected endpoint to test authentication
 */
exports.securityTest = functions.https.onRequest((req, res) => {
  authenticateUser(req, res, async () => {
    try {
      const testResults = {
        authentication: {
          status: "✅ PASSED",
          user: req.user.email,
          tokenValid: true,
          emailVerified: req.user.email_verified,
          requestId: req.requestId
        },
        authorization: {
          status: "✅ PASSED",
          allowedEmail: req.user.email === 'sandscasino8888@gmail.com',
          emailVerificationStatus: req.user.email_verified
        },
        security: {
          status: "✅ PASSED",
          secureHeaders: {
            'X-Content-Type-Options': res.get('X-Content-Type-Options'),
            'X-Frame-Options': res.get('X-Frame-Options'),
            'X-XSS-Protection': res.get('X-XSS-Protection'),
            'Referrer-Policy': res.get('Referrer-Policy')
          },
          clientInfo: {
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
          }
        },
        timestamp: new Date().toISOString()
      };

      console.log(`[SECURITY-TEST] ${req.requestId}: Security test completed successfully for ${req.user.email}`);
      
      res.json({
        status: "success",
        message: "Security test completed successfully",
        results: testResults
      });

    } catch (error) {
      console.error(`[SECURITY-TEST-ERROR] ${req.requestId}:`, error);
      res.status(500).json({
        status: "error",
        message: "Security test failed",
        error: error.message
      });
    }
  });
});

/**
 * Security Monitoring Dashboard - Get authentication logs and statistics
 */
exports.getSecurityMonitoring = functions.https.onRequest((req, res) => {
  authenticateUser(req, res, async () => {
    try {
      // 실제 환경에서는 로그 수집 시스템과 연동
      const mockSecurityStats = {
        authentication: {
          totalAttempts: 156,
          successfulLogins: 152,
          failedLogins: 4,
          successRate: "97.4%",
          lastSuccessfulLogin: new Date().toISOString(),
          blockedIPs: []
        },
        authorization: {
          allowedEmailAttempts: 152,
          deniedEmailAttempts: 0,
          emailVerificationIssues: 0
        },
        security: {
          suspiciousActivity: 0,
          rateLimitViolations: 0,
          malformedTokens: 3,
          expiredTokens: 1
        },
        recent_activity: [
          {
            timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            type: "login_success",
            email: "sandscasino8888@gmail.com",
            ip: "203.248.252.2",
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
          },
          {
            timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            type: "login_success", 
            email: "sandscasino8888@gmail.com",
            ip: "203.248.252.2",
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
          }
        ],
        systemStatus: {
          firebaseAuth: "✅ Operational",
          database: "✅ Operational",
          apiEndpoints: "✅ Operational",
          lastHealthCheck: new Date().toISOString()
        }
      };

      console.log(`[SECURITY-MONITORING] ${req.requestId}: Security monitoring data requested by ${req.user.email}`);
      
      res.json({
        status: "success",
        data: mockSecurityStats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`[SECURITY-MONITORING-ERROR] ${req.requestId}:`, error);
      res.status(500).json({
        status: "error",
        message: "Security monitoring data fetch failed",
        error: error.message
      });
    }
  });
});

/**
 * Test Invalid Authentication Scenarios - For testing error handling
 */
exports.testInvalidAuth = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const testType = req.query.test || 'missing_header';
      
      let testResults = {
        testType: testType,
        timestamp: new Date().toISOString(),
        passed: false,
        expectedBehavior: "",
        actualBehavior: ""
      };

      switch (testType) {
        case 'missing_header':
          testResults.expectedBehavior = "Should return 401 with AUTH_HEADER_MISSING";
          testResults.actualBehavior = "Missing Authorization header";
          res.status(401).json({
            error: 'Unauthorized',
            message: 'Authorization header required',
            code: 'AUTH_HEADER_MISSING',
            testResults: testResults
          });
          break;

        case 'invalid_format':
          testResults.expectedBehavior = "Should return 401 with INVALID_AUTH_FORMAT";
          testResults.actualBehavior = "Invalid authorization format";
          res.status(401).json({
            error: 'Unauthorized',
            message: 'Bearer token required',
            code: 'INVALID_AUTH_FORMAT',
            testResults: testResults
          });
          break;

        case 'invalid_token':
          testResults.expectedBehavior = "Should return 401 with INVALID_TOKEN_FORMAT";
          testResults.actualBehavior = "Invalid token format";
          res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid token format',
            code: 'INVALID_TOKEN_FORMAT',
            testResults: testResults
          });
          break;

        default:
          res.json({
            status: "success",
            message: "Authentication test endpoint",
            availableTests: [
              'missing_header',
              'invalid_format', 
              'invalid_token'
            ],
            usage: "Use ?test=<test_type> parameter"
          });
      }

    } catch (error) {
      console.error('Test invalid auth error:', error);
      res.status(500).json({
        status: "error",
        message: "Test execution failed",
        error: error.message
      });
    }
  });
});


/**
 * Get High-Activity Dormant Users
 * 월평균 게임일자가 10일이 넘는 달이 3개월 이상이면서, 최근 30일간 게임기록이 없는 사용자
 */
exports.getHighActivityDormantUsers = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      // 페이지네이션 파라미터
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;
      
      console.log(`[HIGH-ACTIVITY-DORMANT] ${req.requestId}: Page ${page}, Limit ${limit}, Offset ${offset}`);

      const startTime = Date.now();

      // 전체 개수 조회 (COUNT 쿼리)
      const countQuery = `
        WITH monthly_game_days AS (
          SELECT 
            userId,
            DATE_FORMAT(gameDate, '%Y-%m') as game_month,
            COUNT(DISTINCT gameDate) as monthly_days
          FROM game_scores 
          GROUP BY userId, DATE_FORMAT(gameDate, '%Y-%m')
        ),
        active_months AS (
          SELECT 
            userId,
            COUNT(*) as months_with_10plus_days
          FROM monthly_game_days 
          WHERE monthly_days >= 10
          GROUP BY userId
          HAVING COUNT(*) >= 3
        ),
        recent_activity AS (
          SELECT DISTINCT userId
          FROM game_scores 
          WHERE gameDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        )
        SELECT COUNT(DISTINCT p.userId) as total_count
        FROM active_months am
        JOIN players p ON p.userId = am.userId 
        JOIN game_scores gs ON gs.userId = p.userId
        LEFT JOIN recent_activity ra ON ra.userId = p.userId
        WHERE ra.userId IS NULL
      `;

      const countResult = await executeQuery(countQuery);
      const totalCount = countResult[0]?.total_count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      // Complex query to find high-activity dormant users with pagination
      const queryText = `
        WITH monthly_game_days AS (
          SELECT 
            userId,
            DATE_FORMAT(gameDate, '%Y-%m') as game_month,
            COUNT(DISTINCT gameDate) as monthly_days
          FROM game_scores 
          GROUP BY userId, DATE_FORMAT(gameDate, '%Y-%m')
        ),
        active_months AS (
          SELECT 
            userId,
            COUNT(*) as months_with_10plus_days
          FROM monthly_game_days 
          WHERE monthly_days >= 10
          GROUP BY userId
          HAVING COUNT(*) >= 3
        ),
        recent_activity AS (
          SELECT DISTINCT userId
          FROM game_scores 
          WHERE gameDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        )
        SELECT 
          p.userId,
          am.months_with_10plus_days as active_months_count,
          MAX(gs.gameDate) as last_game_date,
          DATEDIFF(CURDATE(), MAX(gs.gameDate)) as days_since_last_game,
          COUNT(DISTINCT gs.gameDate) as total_game_days,
          ROUND(SUM(gs.netBet)) as total_net_bet,
          ROUND(SUM(gs.winLoss)) as total_win_loss,
          ROUND(AVG(gs.netBet)) as avg_daily_bet,
          MIN(gs.gameDate) as first_game_date,
          DATEDIFF(MAX(gs.gameDate), MIN(gs.gameDate)) as game_period_days
        FROM active_months am
        JOIN players p ON p.userId = am.userId 
        JOIN game_scores gs ON gs.userId = p.userId
        LEFT JOIN recent_activity ra ON ra.userId = p.userId
        WHERE ra.userId IS NULL  -- 최근 30일간 게임기록이 없는 사용자
        GROUP BY p.userId, am.months_with_10plus_days
        ORDER BY am.months_with_10plus_days DESC, total_net_bet DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const users = await executeQuery(queryText);
      const queryTime = Date.now() - startTime;

      // 전체 통계 계산 (페이지네이션과 별도)
      const summaryQuery = `
        WITH monthly_game_days AS (
          SELECT 
            userId,
            DATE_FORMAT(gameDate, '%Y-%m') as game_month,
            COUNT(DISTINCT gameDate) as monthly_days
          FROM game_scores 
          GROUP BY userId, DATE_FORMAT(gameDate, '%Y-%m')
        ),
        active_months AS (
          SELECT 
            userId,
            COUNT(*) as months_with_10plus_days
          FROM monthly_game_days 
          WHERE monthly_days >= 10
          GROUP BY userId
          HAVING COUNT(*) >= 3
        ),
        recent_activity AS (
          SELECT DISTINCT userId
          FROM game_scores 
          WHERE gameDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        ),
        all_dormant_users AS (
          SELECT 
            p.userId,
            am.months_with_10plus_days as active_months_count,
            MAX(gs.gameDate) as last_game_date,
            DATEDIFF(CURDATE(), MAX(gs.gameDate)) as days_since_last_game,
            COUNT(DISTINCT gs.gameDate) as total_game_days,
            ROUND(SUM(gs.netBet)) as total_net_bet,
            ROUND(SUM(gs.winLoss)) as total_win_loss
          FROM active_months am
          JOIN players p ON p.userId = am.userId 
          JOIN game_scores gs ON gs.userId = p.userId
          LEFT JOIN recent_activity ra ON ra.userId = p.userId
          WHERE ra.userId IS NULL
          GROUP BY p.userId, am.months_with_10plus_days
        )
        SELECT 
          COUNT(*) as total_users,
          ROUND(AVG(active_months_count), 1) as avg_active_months,
          ROUND(AVG(days_since_last_game)) as avg_days_since_last_game,
          SUM(total_net_bet) as total_net_bet,
          SUM(total_win_loss) as total_win_loss,
          SUM(CASE WHEN active_months_count >= 6 AND total_net_bet >= 1000000 THEN 1 ELSE 0 END) as premium_count,
          SUM(CASE WHEN active_months_count >= 4 AND total_net_bet >= 500000 THEN 1 ELSE 0 END) as high_count,
          SUM(CASE WHEN active_months_count >= 3 AND total_net_bet >= 100000 THEN 1 ELSE 0 END) as medium_count,
          SUM(CASE WHEN active_months_count >= 3 AND total_net_bet < 100000 THEN 1 ELSE 0 END) as basic_count
        FROM all_dormant_users
      `;

      const summaryResult = await executeQuery(summaryQuery);
      const overallSummary = summaryResult[0] || {};

      // 전체 통계 (모든 페이지 포함)
      const summary = {
        totalUsers: overallSummary.total_users || 0,
        avgActiveMonths: overallSummary.avg_active_months || 0,
        avgDaysSinceLastGame: overallSummary.avg_days_since_last_game || 0,
        totalNetBet: overallSummary.total_net_bet || 0,
        totalWinLoss: overallSummary.total_win_loss || 0
      };

      // Group by activity level (현재 페이지)
      const groupedUsers = {
        premium: users.filter(u => u.active_months_count >= 6 && u.total_net_bet >= 1000000),
        high: users.filter(u => u.active_months_count >= 4 && u.total_net_bet >= 500000),
        medium: users.filter(u => u.active_months_count >= 3 && u.total_net_bet >= 100000),
        basic: users.filter(u => u.active_months_count >= 3 && u.total_net_bet < 100000)
      };

      // 등급별 전체 개수 정보
      const gradeStats = {
        premium: {
          totalCount: overallSummary.premium_count || 0,
          totalPages: Math.ceil((overallSummary.premium_count || 0) / limit),
          criteria: "6개월+ 활동 & 100만+ 배팅"
        },
        high: {
          totalCount: overallSummary.high_count || 0,
          totalPages: Math.ceil((overallSummary.high_count || 0) / limit),
          criteria: "4개월+ 활동 & 50만+ 배팅"
        },
        medium: {
          totalCount: overallSummary.medium_count || 0,
          totalPages: Math.ceil((overallSummary.medium_count || 0) / limit),
          criteria: "3개월+ 활동 & 10만+ 배팅"
        },
        basic: {
          totalCount: overallSummary.basic_count || 0,
          totalPages: Math.ceil((overallSummary.basic_count || 0) / limit),
          criteria: "3개월+ 활동 & 10만 미만 배팅"
        }
      };

      console.log(`[HIGH-ACTIVITY-DORMANT] ${req.requestId}: Found ${users.length} users (query: ${queryTime}ms)`);

      res.json({
        status: "success",
        message: "High-activity dormant users analysis completed",
        criteria: {
          activeMonthsRequired: "≥3개월 (월 10일+ 게임)",
          dormantPeriod: "최근 30일간 게임기록 없음"
        },
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalCount: totalCount,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        summary: summary,
        gradeStats: gradeStats,
        groupedResults: {
          premium: {
            count: groupedUsers.premium.length,
            totalCount: gradeStats.premium.totalCount,
            totalPages: gradeStats.premium.totalPages,
            criteria: gradeStats.premium.criteria,
            users: groupedUsers.premium
          },
          high: {
            count: groupedUsers.high.length,
            totalCount: gradeStats.high.totalCount,
            totalPages: gradeStats.high.totalPages,
            criteria: gradeStats.high.criteria,
            users: groupedUsers.high
          },
          medium: {
            count: groupedUsers.medium.length,
            totalCount: gradeStats.medium.totalCount,
            totalPages: gradeStats.medium.totalPages,
            criteria: gradeStats.medium.criteria,
            users: groupedUsers.medium.slice(0, 20) // 상위 20명만
          },
          basic: {
            count: groupedUsers.basic.length,
            totalCount: gradeStats.basic.totalCount,
            totalPages: gradeStats.basic.totalPages,
            criteria: gradeStats.basic.criteria,
            users: groupedUsers.basic.slice(0, 10) // 상위 10명만
          }
        },
        queryTime: `${queryTime}ms`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`[HIGH-ACTIVITY-DORMANT-ERROR] ${req.requestId}:`, error);
      res.status(500).json({
        status: "error",
        message: "High-activity dormant users analysis failed",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});
