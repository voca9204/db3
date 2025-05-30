/**
 * Indexing API Module - DB3 Database Query System
 * Contains index management, optimization, and monitoring APIs
 */

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

// Import database utilities
const { executeQuery, queryOne } = require('../db');

// Import optimization engine
const { OptimizationEngine } = require('../src/optimization');

// Import authentication utilities
const admin = require('firebase-admin');

// Import index monitoring API
const indexMonitoringAPI = require('../index_monitoring_api');

// Initialize optimization engine
const optimizationEngine = new OptimizationEngine({
  enableCaching: true,
  enableOptimization: false,
  enableAnalysis: false,
  enableIndexRecommendations: true, // Enable for indexing
  maxCacheSize: 100,
  defaultTTL: 600000,
  slowQueryThreshold: 5000
});

/**
 * Helper function to get auto index optimizer
 */
function getAutoIndexOptimizer() {
  const { AutoIndexOptimizer } = require('../src/optimization/AutoIndexOptimizer');
  return new AutoIndexOptimizer();
}

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
 * Get Index Recommendations API
 * Provides intelligent index recommendations based on query patterns
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
 * Index Performance Dashboard API
 * Wrapper for index monitoring API
 */
exports.getIndexPerformanceDashboard = indexMonitoringAPI.getIndexPerformanceDashboard;

/**
 * Check Index Status API
 * Wrapper for index monitoring API
 */
exports.checkIndexStatus = indexMonitoringAPI.checkIndexStatus;

/**
 * Run Index Performance Test API
 * Wrapper for index monitoring API
 */
exports.runIndexPerformanceTest = indexMonitoringAPI.runIndexPerformanceTest;

/**
 * Get Index Monitoring Status API
 * Wrapper for index monitoring API
 */
exports.getIndexMonitoringStatus = indexMonitoringAPI.getIndexMonitoringStatus;

/**
 * Run Auto Index Analysis API
 * Performs comprehensive analysis of database indexes
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
            executionTime: plan.estimatedExecutionTime
          }
        },
        detailedAnalysis: analysis,
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
 * Get Auto Index Optimizer Status API
 * Returns detailed status of the auto index optimizer
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
 * Quick Index Health Check API
 * Performs a quick assessment of index health and performance
 */
exports.quickIndexHealthCheck = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const startTime = Date.now();
      
      // Quick index statistics
      const indexStats = await executeQuery(`
        SELECT 
          TABLE_NAME,
          INDEX_NAME,
          CARDINALITY,
          INDEX_TYPE,
          COMMENT
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = 'hermes' 
        AND INDEX_NAME != 'PRIMARY'
        ORDER BY TABLE_NAME, INDEX_NAME
      `);
      
      // Table sizes
      const tableSizes = await executeQuery(`
        SELECT 
          TABLE_NAME,
          TABLE_ROWS,
          ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'SIZE_MB'
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = 'hermes'
        ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
      `);
      
      // Quick performance test on key tables
      const performanceTests = [];
      const testTables = ['players', 'game_scores', 'money_flows'];
      
      for (const table of testTables) {
        const testStart = Date.now();
        const result = await executeQuery(`SELECT COUNT(*) as count FROM ${table} LIMIT 1`);
        const testTime = Date.now() - testStart;
        
        performanceTests.push({
          table,
          responseTime: `${testTime}ms`,
          status: testTime < 100 ? "✅ Fast" : testTime < 500 ? "⚠️ Moderate" : "❌ Slow",
          rowCount: result[0]?.count || 0
        });
      }
      
      const totalTime = Date.now() - startTime;
      
      // Calculate health score
      const avgResponseTime = performanceTests.reduce((sum, test) => 
        sum + parseInt(test.responseTime), 0) / performanceTests.length;
      
      let healthScore = 100;
      if (avgResponseTime > 500) healthScore -= 30;
      else if (avgResponseTime > 200) healthScore -= 15;
      
      const healthGrade = healthScore >= 90 ? 'A' : 
                         healthScore >= 80 ? 'B' : 
                         healthScore >= 70 ? 'C' : 'D';
      
      res.json({
        status: "success",
        message: "Index health check completed",
        healthScore,
        healthGrade,
        summary: {
          totalIndexes: indexStats.length,
          totalTables: tableSizes.length,
          largestTable: tableSizes[0],
          averageResponseTime: `${Math.round(avgResponseTime)}ms`,
          totalCheckTime: `${totalTime}ms`
        },
        indexStatistics: indexStats.slice(0, 10), // Top 10 indexes
        tableStatistics: tableSizes.slice(0, 5), // Top 5 tables
        performanceTests,
        recommendations: healthScore < 80 ? [
          "Consider reviewing slow-performing tables",
          "Analyze query patterns for optimization opportunities",
          "Check for missing indexes on frequently queried columns"
        ] : [
          "Index performance is good",
          "Continue monitoring for optimization opportunities"
        ],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Quick index health check error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Index Usage Statistics API
 * Returns statistics about index usage patterns
 */
exports.getIndexUsageStats = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      // Get index usage from performance schema (if available)
      const indexUsage = await executeQuery(`
        SELECT 
          OBJECT_SCHEMA as database_name,
          OBJECT_NAME as table_name,
          INDEX_NAME as index_name,
          COUNT_FETCH as fetch_count,
          COUNT_INSERT as insert_count,
          COUNT_UPDATE as update_count,
          COUNT_DELETE as delete_count
        FROM performance_schema.table_io_waits_summary_by_index_usage
        WHERE OBJECT_SCHEMA = 'hermes'
        ORDER BY COUNT_FETCH DESC
        LIMIT 20
      `).catch(() => {
        // Fallback if performance schema is not available
        return [];
      });
      
      // Get basic index information
      const basicIndexInfo = await executeQuery(`
        SELECT 
          TABLE_NAME,
          INDEX_NAME,
          COLUMN_NAME,
          CARDINALITY,
          SUB_PART,
          INDEX_TYPE
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = 'hermes'
        ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
      `);
      
      // Group by table
      const indexesByTable = basicIndexInfo.reduce((acc, index) => {
        if (!acc[index.TABLE_NAME]) {
          acc[index.TABLE_NAME] = [];
        }
        acc[index.TABLE_NAME].push(index);
        return acc;
      }, {});
      
      res.json({
        status: "success",
        message: "Index usage statistics retrieved",
        usageData: {
          performanceSchemaAvailable: indexUsage.length > 0,
          totalIndexes: basicIndexInfo.length,
          tablesWithIndexes: Object.keys(indexesByTable).length
        },
        indexUsage: indexUsage.length > 0 ? indexUsage : "Performance schema not available",
        indexesByTable,
        summary: {
          mostUsedIndexes: indexUsage.slice(0, 5),
          indexTypes: [...new Set(basicIndexInfo.map(i => i.INDEX_TYPE))],
          averageCardinality: Math.round(
            basicIndexInfo.reduce((sum, i) => sum + (i.CARDINALITY || 0), 0) / basicIndexInfo.length
          )
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Index usage statistics error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});
