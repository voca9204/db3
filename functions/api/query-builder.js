/**
 * Query Builder API Module - DB3 Database Query System
 * Contains query builder framework and testing APIs
 */

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

// Import database utilities
const { executeQuery, queryOne } = require('../db');

// Import advanced Query Builder
const QueryBuilder = require('../src/database/queryBuilder');

// Import authentication utilities
const admin = require('firebase-admin');

/**
 * Authentication middleware for protected APIs
 */
async function authenticateUser(req, res, callback) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: "error",
      message: "Authentication required"
    });
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Check if user email is authorized
    const authorizedEmail = 'sandscasino8888@gmail.com';
    if (decodedToken.email !== authorizedEmail) {
      return res.status(403).json({
        status: "error",
        message: "Access denied"
      });
    }
    
    req.user = decodedToken;
    await callback();
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      status: "error",
      message: "Invalid authentication token"
    });
  }
}

/**
 * Simple Query Builder Class
 * Basic query builder for testing and simple operations
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
 * Query Builder Test API
 * Tests basic query builder functionality with multiple query types
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
 * Connection Stats API
 * Tests connection pooling with concurrent queries
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
 * Query Builder Test - Simple SELECT
 * Tests basic SELECT operations with advanced query builder
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
 * Query Builder Test - JOIN Operations
 * Tests JOIN functionality with advanced query builder
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
 * Query Builder Test - Protected API
 * Tests complex query operations with authentication
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
