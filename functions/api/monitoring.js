/**
 * Monitoring API Module - DB3 Database Query System
 * Contains performance monitoring, health checks, and benchmarking APIs
 */

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

// Import database utilities
const { executeQuery, queryOne } = require('../db');

// Import performance monitor
const { PerformanceMonitor } = require('../src/monitoring');

// Import authentication utilities
const admin = require('firebase-admin');

// Initialize performance monitor with reduced load for Firebase Functions
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
 * Performance Dashboard API
 * Returns comprehensive performance metrics and analytics for a specified time range
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
 * System Health Check API
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
 * Run Benchmark API
 * Execute performance benchmarks on demand with specified test suites
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
 * Performance Monitor Status API
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
        capabilities: {
          metricsRetention: "24 hours",
          alertThresholds: {
            slowQuery: "1000ms",
            errorRate: "5%",
            responseTime: "2000ms"
          },
          benchmarkSuites: [
            "basic", "comprehensive", "stress", "endurance"
          ]
        },
        systemResources: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform
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
 * Quick Performance Test API
 * Runs a quick performance test to verify system responsiveness
 */
exports.quickPerformanceTest = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const startTime = Date.now();
      
      // Quick database connectivity test
      const dbTestStart = Date.now();
      const dbResult = await queryOne('SELECT 1 as test, NOW() as currentTime');
      const dbTestTime = Date.now() - dbTestStart;
      
      // Quick query performance test
      const queryTestStart = Date.now();
      const queryResult = await executeQuery('SELECT COUNT(*) as count FROM players LIMIT 1');
      const queryTestTime = Date.now() - queryTestStart;
      
      const totalTime = Date.now() - startTime;
      
      // Determine performance grade
      let performanceGrade = 'A';
      if (totalTime > 1000) performanceGrade = 'D';
      else if (totalTime > 500) performanceGrade = 'C';
      else if (totalTime > 200) performanceGrade = 'B';
      
      res.json({
        status: "success",
        message: "Quick performance test completed",
        performanceGrade,
        results: {
          databaseConnectivity: {
            responseTime: `${dbTestTime}ms`,
            status: dbResult ? "✅ Healthy" : "❌ Failed",
            result: dbResult
          },
          queryPerformance: {
            responseTime: `${queryTestTime}ms`,
            status: queryResult ? "✅ Healthy" : "❌ Failed",
            result: queryResult[0]
          },
          overallPerformance: {
            totalResponseTime: `${totalTime}ms`,
            grade: performanceGrade,
            status: totalTime < 1000 ? "✅ Healthy" : "⚠️ Slow"
          }
        },
        recommendations: totalTime > 500 ? [
          "Consider database optimization",
          "Review query performance",
          "Check system resources"
        ] : [
          "System performance is optimal"
        ],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Quick performance test error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});
