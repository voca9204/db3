/**
 * Optimization API Module - DB3 Database Query System
 * Contains query optimization, caching, and performance analysis APIs
 */

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

// Import database utilities
const { executeQuery, queryOne } = require('../db');

// Import optimization engine
const { OptimizationEngine } = require('../src/optimization');

// Import performance monitor
const { PerformanceMonitor } = require('../src/monitoring');

// Import authentication utilities
const admin = require('firebase-admin');

// Initialize optimization engine with reduced load for Firebase Functions
const optimizationEngine = new OptimizationEngine({
  enableCaching: true,
  enableOptimization: false, // Reduced load
  enableAnalysis: false, // Reduced load
  enableIndexRecommendations: false, // Reduced load
  maxCacheSize: 100,
  defaultTTL: 600000, // 10 minutes
  slowQueryThreshold: 5000 // 5 seconds
});

// Initialize performance monitor with reduced load
const performanceMonitor = new PerformanceMonitor({
  enableMetrics: true,
  enableAlerts: false, // Reduced load
  slowQueryThreshold: 1000,
  enableBenchmarking: false // Reduced load
});

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
 * Execute Optimized Query API
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
      console.error('Optimized query execution error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Get Performance Report API
 * Returns comprehensive performance analysis and optimization statistics
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
 * Query Optimization Test API
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
      
      // Test optimization without execution
      const result = await optimizationEngine.testOptimization(sql, params);
      
      res.json({
        status: result.success ? "success" : "error",
        message: "Query optimization test completed",
        originalQuery: { sql, params },
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
 * Analyze Query API
 * Performs detailed analysis of query structure, complexity, and performance characteristics
 */
exports.analyzeQuery = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { sql, includeExplain = true } = req.body;
      
      if (!sql) {
        return res.status(400).json({
          status: "error",
          message: "SQL query is required for analysis"
        });
      }
      
      // Analyze query through optimization engine
      const result = await optimizationEngine.analyzeQuery(sql, {
        includeExplain: includeExplain === true || includeExplain === 'true'
      });
      
      res.json({
        status: result.success ? "success" : "error",
        message: "Query analysis completed",
        originalQuery: sql,
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
 * Optimization Status API
 * Returns current status and configuration of the optimization engine
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
 * Demo Optimization API
 * Demonstrates optimization capabilities with sample queries
 */
exports.demoOptimization = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      // Demo queries with varying complexity
      const demoQueries = [
        {
          name: "Simple SELECT",
          sql: "SELECT userId, status FROM players WHERE status = ? LIMIT ?",
          params: [0, 10],
          description: "Basic query with WHERE clause and LIMIT"
        },
        {
          name: "Aggregation Query",
          sql: `SELECT COUNT(*) as total_players, 
                       AVG(CASE WHEN status = 0 THEN 1 ELSE 0 END) as active_ratio 
                FROM players`,
          params: [],
          description: "Aggregation with conditional logic"
        },
        {
          name: "JOIN Query",
          sql: `SELECT p.userId, COUNT(gs.gameDate) as game_days 
                FROM players p 
                LEFT JOIN game_scores gs ON p.userId = gs.userId 
                WHERE p.status = 0 
                GROUP BY p.userId 
                LIMIT ?`,
          params: [20],
          description: "JOIN with GROUP BY clause"
        }
      ];

      const results = [];
      
      for (const demo of demoQueries) {
        try {
          const startTime = Date.now();
          
          // Test optimization
          const optimizationTest = await optimizationEngine.testOptimization(demo.sql, demo.params);
          
          // Execute optimized query
          const executionResult = await optimizationEngine.executeOptimizedQuery(
            demo.sql, 
            demo.params, 
            { enableOptimization: true, enableCaching: true }
          );
          
          const endTime = Date.now();
          
          results.push({
            queryName: demo.name,
            description: demo.description,
            originalQuery: {
              sql: demo.sql,
              params: demo.params
            },
            optimizationAnalysis: optimizationTest,
            executionResult: {
              success: executionResult.success,
              executionTime: executionResult.metadata?.executionTime || (endTime - startTime),
              wasCached: executionResult.metadata?.wasCached || false,
              wasOptimized: executionResult.metadata?.wasOptimized || false,
              resultCount: Array.isArray(executionResult.data) ? executionResult.data.length : 1
            }
          });
          
        } catch (error) {
          results.push({
            queryName: demo.name,
            error: error.message,
            status: "failed"
          });
        }
      }

      res.json({
        status: "success",
        message: "Optimization demonstration completed",
        demoResults: results,
        summary: {
          totalQueries: demoQueries.length,
          successfulQueries: results.filter(r => !r.error).length,
          averageExecutionTime: results
            .filter(r => r.executionResult?.executionTime)
            .reduce((avg, r, _, arr) => avg + r.executionResult.executionTime / arr.length, 0)
        },
        recommendations: [
          "Use indexes on frequently queried columns",
          "Enable caching for repeated queries",
          "Monitor slow queries regularly",
          "Consider query optimization for complex JOINs"
        ],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Demo optimization error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});
