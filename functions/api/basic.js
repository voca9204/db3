/**
 * Basic API Module - DB3 Database Query System
 * Contains fundamental system APIs: health check, connection test, system status
 */

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

// Import database utilities
const { executeQuery, queryOne } = require('../db');

// Import performance monitor for health checks
const { PerformanceMonitor } = require('../src/monitoring');

// Initialize performance monitor
const performanceMonitor = new PerformanceMonitor({
  enableMetrics: true,
  enableAlerts: false, // Reduced load
  slowQueryThreshold: 1000,
  enableBenchmarking: false // Reduced load
});

/**
 * Hello World - System Information
 * Returns basic system information and status
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
 * Tests database connectivity and response time
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
 * System Status - Database Statistics
 * Returns comprehensive system statistics and database info
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
 * System Health Check
 * Performs comprehensive health check using performance monitor
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
